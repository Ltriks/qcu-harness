from contextlib import closing
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

REPO = Path(__file__).absolute().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, REPO / path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


distribution = module('distribution', 'hub/distribution.py')
hub = module('distribution_hub', 'hub/release/serve-hub.py')


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-distribution-')
        self.addCleanup(self.temp.cleanup)
        # macOS temp paths may themselves use /var -> /private/var.
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'distribution'
        (self.root / 'downloads').mkdir(parents=True)
        self.data = b'synthetic reviewed download\n'
        (self.root / 'downloads/reviewed.zip').write_bytes(self.data)
        (self.root / 'downloads/guide.html').write_bytes(b'<style>p{color:navy}</style><p>Guide</p>')
        (self.root / 'private').mkdir()
        (self.root / 'private/secret.txt').write_bytes(b'synthetic private fixture')
        (self.root / 'downloads/unlisted.txt').write_bytes(b'unlisted fixture')
        self.manifest = {'schemaVersion': 1, 'files': {}}
        for name in ['downloads/reviewed.zip', 'downloads/guide.html']:
            data = (self.root / name).read_bytes()
            self.manifest['files'][name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        self.pin = self.save()

    def save(self, raw=None):
        raw = raw if raw is not None else json.dumps(self.manifest).encode()
        (self.root / 'manifest.json').write_bytes(raw)
        return hashlib.sha256(raw).hexdigest()

    def load(self):
        return distribution.Distribution(self.root, self.pin)

    def serve(self, enabled=True):
        server = hub.make_server({'/': b'unchanged snapshot'}, port=0,
                                 distribution=self.load() if enabled else None)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server

    def request(self, server, path='/downloads/reviewed.zip', method='GET', headers=None):
        with closing(http.client.HTTPConnection(*server.server_address, timeout=2)) as client:
            client.request(method, path, headers=headers or {})
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()

    def test_disabled_behavior_and_public_snapshot_unchanged(self):
        server = self.serve(False)
        self.assertEqual(self.request(server, '/')[::2], (200, b'unchanged snapshot'))
        self.assertEqual(self.request(server)[0], 404)
        self.assertEqual(self.request(server, '/manifest.json')[0], 404)

    def test_actual_get_head_headers_and_html_csp(self):
        server = self.serve()
        status, headers, body = self.request(server)
        self.assertEqual((status, body), (200, self.data))
        self.assertEqual(headers['Content-Length'], str(len(body)))
        self.assertEqual(headers['Content-Type'], 'application/zip')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(headers['Accept-Ranges'], 'bytes')
        self.assertEqual(headers['ETag'], '"sha256-' + hashlib.sha256(body).hexdigest() + '"')
        status, head_headers, body = self.request(server, method='HEAD')
        self.assertEqual((status, body), (200, b''))
        for name in ['Content-Length', 'Content-Type', 'ETag', 'X-Content-Type-Options']:
            self.assertEqual(head_headers[name], headers[name])
        status, html_headers, _ = self.request(server, '/downloads/guide.html')
        self.assertEqual(status, 200)
        self.assertEqual(html_headers['Content-Type'], 'text/html; charset=utf-8')
        self.assertIn("script-src 'none'", html_headers['Content-Security-Policy'])
        self.assertIn("style-src 'unsafe-inline'", html_headers['Content-Security-Policy'])
        self.assertIn('sandbox', html_headers['Content-Security-Policy'])
        self.assertEqual(server.RequestHandlerClass.timeout, 5.0)

    def test_single_ranges_and_if_range(self):
        server = self.serve()
        for value, start, end in [('bytes=2-5', 2, 5), ('bytes=3-', 3, len(self.data)-1),
                                  ('bytes=-4', len(self.data)-4, len(self.data)-1),
                                  ('bytes=0-999', 0, len(self.data)-1),
                                  ('bytes=-999', 0, len(self.data)-1)]:
            with self.subTest(value=value):
                status, headers, body = self.request(server, headers={'Range': value})
                self.assertEqual((status, body), (206, self.data[start:end+1]))
                self.assertEqual(headers['Content-Length'], str(len(body)))
                self.assertEqual(headers['Content-Range'], 'bytes %s-%s/%s' % (start, end, len(self.data)))
        status, headers, body = self.request(server, method='HEAD', headers={'Range': 'bytes=2-5'})
        self.assertEqual((status, body, headers['Content-Length']), (206, b'', '4'))
        self.assertEqual(self.request(server, headers={'Range':'bytes=2-5', 'If-Range':'"stale"'})[::2], (200, self.data))

    def test_malformed_multiple_and_unsatisfiable_ranges(self):
        server = self.serve()
        for value in ['bytes=0-1,3-4', 'bytes=100-', 'bytes=5-2', 'bytes=-0', 'bytes=-',
                      'bytes=+1-2', 'bytes=0- 2', 'items=0-1', 'bytes=0-1junk', 'bytes=' + '9'*101 + '-']:
            with self.subTest(value=value):
                status, headers, body = self.request(server, headers={'Range':value})
                self.assertEqual((status, body), (416, b''))
                self.assertEqual(headers['Content-Range'], 'bytes */%s' % len(self.data))
        with closing(http.client.HTTPConnection(*server.server_address, timeout=2)) as client:
            client.putrequest('GET', '/downloads/reviewed.zip')
            client.putheader('Range', 'bytes=0-1')
            client.putheader('Range', 'bytes=3-4')
            client.endheaders()
            response = client.getresponse()
            self.assertEqual(response.status, 416)
            response.read()

    def test_exact_raw_routes_no_private_access_or_writes(self):
        server = self.serve()
        for path in ['/manifest.json', '/private/secret.txt', '/downloads/unlisted.txt', '/downloads/',
                     '/downloads/reviewed.zip?x=1', '/downloads/reviewed.zip#fragment',
                     '/downloads/../private/secret.txt', '/downloads/%2e%2e/private/secret.txt',
                     '/downloads/%72eviewed.zip', '/downloads%2freviewed.zip',
                     '//downloads/reviewed.zip', '/downloads/sub/reviewed.zip']:
            with self.subTest(path=path):
                status, _, body = self.request(server, path)
                self.assertEqual(status, 404)
                self.assertNotIn(str(self.root).encode(), body)
                self.assertNotIn(b'synthetic private fixture', body)
        for method in ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']:
            self.assertEqual(self.request(server, method=method)[0], 405)
        self.assertEqual(self.request(server, headers={'Host':'foreign.example'})[0], 403)

    def test_large_file_startup_and_http_reads_bounded(self):
        path = self.root / 'downloads/reviewed.zip'
        block = b'z' * distribution.CHUNK
        digest = hashlib.sha256()
        with path.open('wb') as stream:
            for _ in range(529):
                stream.write(block)
                digest.update(block)
        size = path.stat().st_size
        self.assertGreater(size, hub.MAX_FILE)
        self.manifest['files']['downloads/reviewed.zip'] = {'bytes':size, 'sha256':digest.hexdigest()}
        self.pin = self.save()
        original_read, requested = os.read, []
        def bounded_read(fd, count):
            requested.append(count)
            self.assertLessEqual(count, 65536)
            return original_read(fd, count)
        with patch.object(distribution.os, 'read', bounded_read):
            server = self.serve()
            with closing(http.client.HTTPConnection(*server.server_address, timeout=3)) as client:
                client.request('GET', '/downloads/reviewed.zip')
                response = client.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Content-Length'], str(size))
                received, actual = 0, hashlib.sha256()
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    received += len(chunk)
                    actual.update(chunk)
                self.assertEqual(received, size)
                self.assertEqual(actual.hexdigest(), digest.hexdigest())
        self.assertGreater(len(requested), 1058)
        self.assertEqual(max(requested), 65536)
        self.assertEqual((hub.MAX_FILE, hub.MAX_TOTAL), (32*1024*1024, 64*1024*1024))

    def test_invalid_pin_size_hash_and_strict_manifest(self):
        with self.assertRaises(ValueError):
            distribution.Distribution(self.root, '0'*64)
        for raw in [b'not JSON', b'[]', b'{}', b'{"schemaVersion":true,"files":{}}',
                    b'{"schemaVersion":1,"files":{},"extra":1}',
                    b'{"schemaVersion":1,"files":{},"schemaVersion":1}',
                    b'{"schemaVersion":1,"files":{"downloads/a.txt":{"bytes":1,"bytes":1,"sha256":"' + b'0'*64 + b'"}}}',
                    b'{"schemaVersion":1,"files":{"downloads/a.txt":{},"downloads/a.txt":{}}}',
                    b'{"schemaVersion":1,"files":{"downloads/a.txt":{"bytes":NaN,"sha256":"' + b'0'*64 + b'"}}}',
                    b' '* (distribution.MANIFEST_LIMIT + 1), b'\xff', b'['*2000 + b']'*2000]:
            with self.subTest(raw=raw[:80]):
                with self.assertRaisesRegex(ValueError, '^distribution.invalid$'):
                    distribution.Distribution(self.root, self.save(raw))
        self.pin = self.save()
        entry = self.manifest['files']['downloads/reviewed.zip']
        for field, value in [('bytes', True), ('bytes', -1), ('bytes', 1.0), ('bytes', len(self.data)+1),
                             ('sha256', '0'*64), ('sha256', 'invalid'), ('extra', 1)]:
            original = dict(entry)
            entry[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                distribution.Distribution(self.root, self.save())
            entry.clear(); entry.update(original)

    def test_names_counts_and_all_size_caps(self):
        for name in ['../private.txt', '/downloads/a.zip', 'downloads/../a.zip', 'downloads/nested/a.zip',
                     'downloads/.hidden.zip', 'downloads/a.zip?x=1', 'downloads/%61.zip',
                     'downloads/中文.zip', 'downloads/a.py', 'downloads/a\\b.zip']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                manifest = {'schemaVersion':1, 'files':{name:{'bytes':0, 'sha256':hashlib.sha256(b'').hexdigest()}}}
                distribution.Distribution(self.root, self.save(json.dumps(manifest).encode()))
        for extension, cap in distribution.LIMITS.items():
            with self.subTest(extension=extension), self.assertRaises(ValueError):
                manifest = {'schemaVersion':1, 'files':{'downloads/a.' + extension:{'bytes':cap+1, 'sha256':'0'*64}}}
                distribution.Distribution(self.root, self.save(json.dumps(manifest).encode()))
        for sizes in [[0]*9, [512*1024*1024]*3]:
            manifest = {'schemaVersion':1, 'files':{'downloads/a%s.zip' % i:{'bytes':size, 'sha256':'0'*64} for i,size in enumerate(sizes)}}
            with self.assertRaises(ValueError), patch.object(distribution.Distribution, 'open_file', side_effect=AssertionError('must validate limits before payloads')):
                distribution.Distribution(self.root, self.save(json.dumps(manifest).encode()))

    def test_links_ancestors_and_special_files_rejected(self):
        for relative in ['manifest.json', 'downloads/reviewed.zip', 'downloads']:
            path = self.root / relative
            moved = path.with_name(path.name + '.moved')
            path.rename(moved)
            path.symlink_to(moved, target_is_directory=moved.is_dir())
            with self.subTest(relative=relative), self.assertRaises(ValueError):
                self.load()
            path.unlink(); moved.rename(path)
        alias = self.base / 'alias'
        alias.symlink_to(self.root, target_is_directory=True)
        for root in [alias, alias / '.', Path('relative'), self.root / '..' / 'distribution']:
            with self.subTest(root=root), self.assertRaises(ValueError):
                distribution.Distribution(root, self.pin)
        base_alias = self.base / 'parent-alias'
        base_alias.symlink_to(self.base, target_is_directory=True)
        with self.assertRaises(ValueError):
            distribution.Distribution(base_alias / 'distribution', self.pin)
        for relative in ['manifest.json', 'downloads/reviewed.zip']:
            link = self.base / 'hardlink'
            os.link(self.root / relative, link)
            with self.subTest(hardlink=relative), self.assertRaises(ValueError):
                self.load()
            link.unlink()
        path = self.root / 'downloads/reviewed.zip'
        path.unlink(); os.mkfifo(path)
        with self.assertRaises(ValueError):
            self.load()

    def test_unsafe_permissions_rejected(self):
        for path in [self.base, self.root, self.root / 'downloads', self.root / 'manifest.json', self.root / 'downloads/reviewed.zip']:
            before = stat.S_IMODE(path.stat().st_mode)
            for unsafe in [before | 0o020, before | 0o002]:
                path.chmod(unsafe)
                try:
                    with self.subTest(path=path.name, mode=unsafe), self.assertRaises(ValueError):
                        self.load()
                finally:
                    path.chmod(before)
        path = self.root / 'downloads/reviewed.zip'
        path.chmod(0o755)
        with self.assertRaises(ValueError):
            self.load()

    def test_changed_missing_replaced_linked_and_unsafe_files_rejected_over_http(self):
        for change in ['same-size', 'mtime-restored', 'replace', 'missing', 'symlink', 'hardlink', 'permissions', 'parent-link', 'root-link']:
            with self.subTest(change=change):
                path = self.root / 'downloads/reviewed.zip'
                path.write_bytes(self.data)
                server = self.serve()
                before = path.stat()
                moved = self.base / 'moved'
                if change in ['same-size', 'mtime-restored']:
                    path.write_bytes(b'x'*len(self.data))
                    if change == 'mtime-restored': os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))
                elif change == 'replace':
                    replacement = self.root / 'replacement'
                    replacement.write_bytes(self.data)
                    replacement.replace(path)
                elif change == 'missing': path.unlink()
                elif change == 'symlink':
                    path.unlink(); path.symlink_to(self.root / 'private/secret.txt')
                elif change == 'hardlink': os.link(path, self.base / 'hardlink')
                elif change == 'permissions': path.chmod(0o666)
                else:
                    directory = self.root / 'downloads' if change == 'parent-link' else self.root
                    directory.rename(moved); directory.symlink_to(moved, target_is_directory=True)
                for method in ['GET', 'HEAD']:
                    status, _, body = self.request(server, method=method)
                    self.assertEqual(status, 404)
                    self.assertNotIn(str(self.root).encode(), body)
                if change in ['parent-link', 'root-link']:
                    directory.unlink(); moved.rename(directory)
                if change == 'hardlink': (self.base / 'hardlink').unlink()
                if path.is_symlink(): path.unlink()
                if path.exists(): path.chmod(0o644)

    def test_zero_length_and_other_static_types(self):
        self.manifest['files'] = {}
        for extension in ['txt', 'md', 'tgz']:
            name = 'downloads/empty.' + extension
            (self.root / name).write_bytes(b'')
            self.manifest['files'][name] = {'bytes':0, 'sha256':hashlib.sha256(b'').hexdigest()}
        self.pin = self.save()
        server = self.serve()
        for extension in ['txt', 'md', 'tgz']:
            status, headers, body = self.request(server, '/downloads/empty.' + extension)
            self.assertEqual((status, body, headers['Content-Length']), (200, b'', '0'))
            self.assertEqual(headers['Content-Type'], distribution.TYPES[extension])
            self.assertEqual(self.request(server, '/downloads/empty.' + extension, headers={'Range':'bytes=0-'})[0], 416)

    def test_cli_pair_and_validation_only(self):
        snapshot = self.base / 'snapshot'
        snapshot.mkdir()
        files = {'index.html':b'<p>Synthetic</p>', 'themes.html':b'<p>Themes</p>',
                 'catalog.json':json.dumps({'schemaVersion':1, 'audience':'lan-private', 'publicRelease':False, 'plugins':[], 'skills':[]}).encode()}
        for name, data in files.items(): (snapshot / name).write_bytes(data)
        raw = json.dumps({'schemaVersion':1, 'files':{name:{'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()}}).encode()
        (snapshot / 'manifest.json').write_bytes(raw)
        command = [sys.executable, '-B', str(REPO / 'hub/release/serve-hub.py'), '--root', str(snapshot), '--manifest-sha256', hashlib.sha256(raw).hexdigest()]
        for options in [[], ['--distribution-root', str(self.root), '--distribution-manifest-sha256', self.pin]]:
            result = subprocess.run(command + options, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {'verified':True, 'servableResources':4, 'serviceStarted':False})
        for options in [['--distribution-root', str(self.root)], ['--distribution-manifest-sha256', self.pin],
                        ['--distribution-root', str(self.root), '--distribution-manifest-sha256', '0'*64]]:
            result = subprocess.run(command + options, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(result.stdout)
            self.assertNotIn(str(self.root).encode(), result.stderr)


if __name__ == '__main__':
    unittest.main()
