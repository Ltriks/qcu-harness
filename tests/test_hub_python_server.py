import hashlib
import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location('hub_server', Path(__file__).resolve().parents[1] / 'hub/release/serve-hub.py')
hub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hub)


class HubPythonServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-hub-py-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package = b'synthetic bytes; never installed'
        h = hashlib.sha256(self.package).hexdigest()
        self.file = 'qcu-probe-0.0.1-test.1-' + h + '.tgz'
        self.catalog = {'schemaVersion': 1, 'audience': 'lan-private', 'publicRelease': False, 'skills': [], 'plugins': [{'file': self.file, 'status': 'published', 'review': 'approved', 'bytes': len(self.package), 'sha256': h}]}
        (self.root / 'plugins').mkdir()
        (self.root / 'plugins' / self.file).write_bytes(self.package)
        for name, data in {'catalog.json': json.dumps(self.catalog).encode(), 'index.html': b'<p>Synthetic</p>', 'themes.html': b'<p>Themes</p>', 'README.txt': b'Operator instructions only'}.items():
            (self.root / name).write_bytes(data)
        self.manifest = {'schemaVersion': 1, 'files': {}}
        for p in self.root.rglob('*'):
            if p.is_file():
                data = p.read_bytes()
                self.manifest['files'][str(p.relative_to(self.root))] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        self.pin = self.save_manifest()

    def save_manifest(self):
        raw = json.dumps(self.manifest).encode()
        (self.root / 'manifest.json').write_bytes(raw)
        return hashlib.sha256(raw).hexdigest()

    def test_valid_snapshot_and_nonservable_readme(self):
        resources = hub.load_snapshot(self.root, self.pin)
        self.assertEqual(resources['/plugins/' + self.file], self.package)
        self.assertNotIn('/README.txt', resources)
        self.assertNotIn('/manifest.json', resources)

    def test_tampering_refused(self):
        with self.assertRaisesRegex(ValueError, 'trust-mismatch'):
            hub.load_snapshot(self.root, '0' * 64)
        (self.root / 'plugins' / self.file).write_bytes(b'changed')
        with self.assertRaises(ValueError):
            hub.load_snapshot(self.root, self.pin)

    def test_symlink_refused(self):
        p = self.root / 'plugins' / self.file
        p.unlink()
        p.symlink_to(self.root / 'index.html')
        with self.assertRaisesRegex(ValueError, 'unsafe-file'):
            hub.load_snapshot(self.root, self.pin)

    def test_unknown_path_refused_before_read(self):
        self.manifest['files']['../private'] = {'bytes': 1, 'sha256': '0' * 64}
        with self.assertRaisesRegex(ValueError, 'unknown-file'):
            hub.load_snapshot(self.root, self.save_manifest())

    def test_lan_bind_requires_explicit_approval(self):
        for host, approved in [('192.168.1.68', False), ('0.0.0.0', True), ('8.8.8.8', True)]:
            with self.assertRaises(ValueError):
                hub.make_server({}, host, 0, approved)

    def test_real_temporary_loopback_routes_and_host(self):
        server = hub.make_server(hub.load_snapshot(self.root, self.pin), port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = 'http://127.0.0.1:%s' % server.server_port
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url + '/themes.html') as response:
            self.assertEqual(response.status, 200)
        for path in ['/catalog.json?query=1', '/manifest.json', '/README.txt', '/plugins/']:
            with self.assertRaises(urllib.error.HTTPError) as e:
                opener.open(url + path)
            self.assertEqual(e.exception.code, 404)
        with self.assertRaises(urllib.error.HTTPError) as e:
            opener.open(urllib.request.Request(url + '/catalog.json', headers={'Host': 'foreign.example'}))
        self.assertEqual(e.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError) as e:
            opener.open(urllib.request.Request(url + '/catalog.json', method='POST'))
        self.assertEqual(e.exception.code, 405)


if __name__ == '__main__':
    unittest.main()
