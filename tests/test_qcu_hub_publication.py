"""P15 synthetic keys/archives, real loopback downloads; no profile or deployment."""
import base64
import copy
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from unittest import mock
from test_qcu_hub_admin import admin, fixture, SYNTHETIC_PASSWORD, module

REPO = Path(__file__).absolute().parents[1]
hub = module('static_hub_p15', REPO / 'hub/release/serve-hub.py')
reader_module = module('reader_p15', REPO / 'hub/release/publication-reader.py')


def attachment(meta):
    return dict(purpose='Synthetic publication acceptance only.', scenario='通用工具', prerequisites='Synthetic manager; no real installation.',
                example='Review synthetic result; no model call.', risk='Inert fixture; no runtime permissions.',
                testStatus='Synthetic local checks only; native DSH and business untested.',
                provenance=dict(ownership='qcu', author='Synthetic fixture authors', upstreamSource='Trusted repository fixture generator',
                                pinnedRevision=meta['sourceRevision'], license=meta['license'], modifications='Synthetic acceptance data only.'))


class PublicationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/private/tmp', prefix='qcu-publication-test-')
        self.root = Path(self.tmp.name)
        self.node = shutil.which('node')
        self.store = admin.Store(self.root / 'private', True, initial_password=SYNTHETIC_PASSWORD)
        # Explicit ephemeral initialization under disposable private test root, never release material.
        key = subprocess.run([self.node, str(REPO / 'scripts/qcu-market-sign.mjs'), 'init', str(self.store.root / 'signing')], capture_output=True, check=True)
        self.trust = json.loads(key.stdout)
        self.reader = None
        class Overlay:
            def read(_, path):
                return self.reader.read(path) if self.reader else None
        self.server = hub.make_server({}, port=0, publication=Overlay())
        self.trust['origin'] = 'http://127.0.0.1:' + str(self.server.server_port)
        self.pub = self.store.configure_publication(self.root / 'public', self.trust, self.node, initialize=True, test=True)
        self.reader = reader_module.PublicationReader(self.root / 'public', self.trust, self.node, test=True)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        fixture.write_handoff(self.root / 'handoff')
        self.files = {p.name: p.read_bytes() for p in (self.root / 'handoff').iterdir()}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.store.close()
        self.tmp.cleanup()

    def prepare(self):
        r = self.store.upload({'files': [{'path': name, 'base64': base64.b64encode(raw).decode()} for name, raw in self.files.items()]})
        self.pub.attach(r['id'], dict(materialsDigest=r['materialsDigest'], entry=attachment(r['metadata'])))
        r = self.store.review(r['id'], dict(action='approve', reason='Synthetic manual review; native/business untested.', materialsDigest=r['materialsDigest'], checklist={k: True for k in admin.CHECKLIST}))
        p = self.store.preview(r['id'])
        return self.store.prepare(r['id'], dict(confirm=True, materialsDigest=r['materialsDigest'], proposalDigest=p['proposalDigest']))

    def body(self, r, operation='publish'):
        p = self.pub.preview(r['id'], operation)
        return dict(operation=operation, previewDigest=p['previewDigest'], confirm=True)

    def request(self, path, method='GET'):
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        try:
            c.request(method, path)
            r = c.getresponse()
            return r.status, r.read()
        finally:
            c.close()

    def test_separate_publish_http_allowlist_idempotent_restart_and_withdraw_rollback(self):
        r = self.prepare()
        self.assertEqual(self.pub.pointer()['revision'], 0)
        self.assertEqual(self.request('/market/catalog.signed.json')[0], 404)
        body = self.body(r)
        result = self.pub.confirm(r['id'], body)
        self.assertEqual(result['state'], 'verified')
        self.assertEqual(self.pub.confirm(r['id'], body)['current'], result['current'])
        raw = self.request('/market/catalog.signed.json')[1]
        payload = self.pub.crypto('verify', raw=base64.b64encode(raw).decode())['payload']
        self.assertEqual(payload['catalog']['entries'][0]['id'], r['metadata']['id'])
        url = '/plugins/' + r['metadata']['archive']['file']
        self.assertEqual(admin.sha(self.request(url)[1]), r['archiveHash'])
        for path in ['/state.json', '/admin-auth.json', '/publisher.lock', '/current.json', '/snapshots/', '/archives/', '/api/login', '/signing/signing.key', '/plugins/../state.json', '/market/catalog.signed.json?x', '/%2e%2e/state.json']:
            self.assertEqual(self.request(path)[0], 404, path)
        for method in ('POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'):
            self.assertEqual(self.request(url, method)[0], 405)
        self.store.close()
        self.store = admin.Store(self.root / 'private')
        self.pub = self.store.configure_publication(self.root / 'public', self.trust, self.node, test=True)
        self.assertEqual(self.pub.status()['state'], 'verified')
        self.assertEqual(self.pub.confirm(r['id'], body)['current'], result['current'])
        self.assertEqual(self.pub.confirm(r['id'], self.body(r, 'withdraw'))['current']['revision'], 2)
        payload, _ = self.pub.snapshot()
        self.assertEqual(payload['catalog']['entries'], [])
        self.assertEqual(payload['withdrawn'], [r['metadata']['id']])
        self.assertEqual(self.request(url)[0], 200)
        self.assertEqual(self.pub.confirm(r['id'], self.body(r, 'rollback'))['current']['revision'], 3)

    def test_entry_and_candidate_tamper_stale_and_approval_freeze(self):
        r = self.prepare()
        with self.assertRaises(admin.Refused):
            self.pub.attach(r['id'], dict(materialsDigest=r['materialsDigest'], entry=attachment(r['metadata'])))
        stale = self.body(r)
        self.pub.confirm(r['id'], stale)
        fresh = self.body(r, 'withdraw')
        self.pub.confirm(r['id'], fresh)
        with self.assertRaises(admin.Refused):
            self.pub.confirm(r['id'], stale)
        saved = copy.deepcopy(self.store.get(r['id'])['marketEntry'])
        self.store.get(r['id'])['marketEntry']['purpose'] = 'tampered'
        with self.assertRaises(admin.Refused):
            self.pub.preview(r['id'])
        self.store.get(r['id'])['marketEntry'] = saved
        candidate = self.store.root / 'candidates' / r['candidate']['id'] / 'proposal.json'
        os.chmod(candidate, 0o600)
        candidate.write_bytes(b'{}')
        with self.assertRaises(admin.Refused):
            self.pub.preview(r['id'])

    def test_pre_and_post_commit_failure_retry_recovers_actual_pointer(self):
        r = self.prepare()
        for phase in ('precommit', 'postcommit'):
            body = self.body(r, 'publish' if phase == 'precommit' else 'rollback')
            before = self.pub.pointer()
            def fault(stage):
                if stage == phase:
                    raise OSError('Synthetic failure')
            self.pub.fault = fault
            with self.assertRaises(OSError):
                self.pub.confirm(r['id'], body)
            after = self.pub.pointer()
            self.assertEqual(before == after, phase == 'precommit')
            self.store.close()
            self.store = admin.Store(self.root / 'private')
            self.pub = self.store.configure_publication(self.root / 'public', self.trust, self.node, test=True)
            self.assertEqual(self.pub.confirm(r['id'], body)['state'], 'verified')

    def test_visible_failed_http_and_recheck_and_history_version_conflict(self):
        r = self.prepare()
        reader = self.reader
        self.reader = None
        result = self.pub.confirm(r['id'], self.body(r))
        self.assertEqual(result['state'], 'visible-verification-pending')
        self.reader = reader
        self.assertEqual(self.pub.self_check()['state'], 'verified')
        self.pub.confirm(r['id'], self.body(r, 'withdraw'))
        # All durable history participates, including withdrawn releases.
        old = self.pub.history()[0]
        old['entry']['release']['sha256'] = '0' * 64
        name = 'publications/' + old['pointer']['snapshot'] + '.json'
        self.store.disk.write(name, admin.encoded(old), replace=True, mode=0o600)
        with self.assertRaises(admin.Refused) as e:
            self.pub.confirm(r['id'], self.body(r, 'rollback'))
        self.assertEqual(e.exception.code, 'publication.version_conflict')

    def test_new_routes_auth_csrf_and_no_trust_override(self):
        server = admin.Server(('127.0.0.1', 0), self.store)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            r = self.prepare()
            token = self.store.login(dict(account='qcu-admin', password=SYNTHETIC_PASSWORD))['token']
            for path, body in [('/api/publication', None), ('/api/publication/recheck', {}),
                               ('/api/submissions/' + r['id'] + '/publish', self.body(r)),
                               ('/api/submissions/' + r['id'] + '/market-entry', {})]:
                def call(auth=None, origin=server.origin):
                    conn = http.client.HTTPConnection('127.0.0.1', server.server_port)
                    try:
                        headers = {} if auth is None else {'Authorization': 'Bearer ' + auth}
                        if body is not None:
                            headers.update(Origin=origin, **{'Content-Type': 'application/vnd.qcu.submission+json'})
                        conn.request('GET' if body is None else 'POST', path, None if body is None else admin.encoded(body), headers)
                        response = conn.getresponse()
                        response.read()
                        return response.status
                    finally:
                        conn.close()
                self.assertEqual(call(), 401)
                if body is not None:
                    self.assertEqual(call(token, 'http://foreign.invalid'), 403)
            body = dict(self.body(r), url='https://untrusted.invalid', trust={})
            with self.assertRaises(admin.Refused):
                self.pub.confirm(r['id'], body)
            self.assertEqual(self.pub.pointer()['revision'], 0)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_unsupported_shape_and_provenance_refused_before_approval(self):
        record = self.store.upload({'files': [{'path': name, 'base64': base64.b64encode(raw).decode()} for name, raw in self.files.items()]})
        meta = record['metadata']
        before = copy.deepcopy(self.store.get(record['id']))
        for change in [dict(provenance=dict(attachment(meta)['provenance'], license='ISC')),
                       dict(scenario=''), dict(extra='not allowed')]:
            value = dict(attachment(meta), **change)
            with self.assertRaises(admin.Refused):
                self.pub.attach(record['id'], dict(materialsDigest=record['materialsDigest'], entry=value))
        self.assertEqual(self.store.get(record['id']), before)
        self.store.get(record['id'])['metadata']['components'].append('qcu-other')
        with self.assertRaises(admin.Refused):
            self.pub.attach(record['id'], dict(materialsDigest=record['materialsDigest'], entry=attachment(meta)))

    def test_normal_admission_supports_only_exact_declared_course_skill_without_publishing(self):
        files = fixture.example_files()
        pkg = json.loads(files['package.json'])
        pkg['name'] = 'qcu-course-workbench'
        path = 'skills/qcu-course-draft/SKILL.md'
        pkg['files'].append(path)
        files['package.json'] = admin.encoded(pkg)
        files[path] = b'# Anonymous course draft method'
        files['cordis.patch.yml'] = admin.encoded([{'insert': [{'id': pkg['name'], 'name': pkg['name'], 'disabled': True}]}])
        raw = fixture.archive(files)
        meta = dict(id=pkg['name'], title='Synthetic course admission', productType='plugin', components=[pkg['name']], skills=['qcu-course-draft'], sourceRevision='0123456789abcdef0123456789abcdef01234567', license='MIT', runtime='0.2.0-rc.2', version=fixture.VERSION, testEvidence={}, permissionSummary=[], archive=dict(file=pkg['name']+'-'+fixture.VERSION+'-'+admin.sha(raw)+'.tgz', bytes=len(raw), sha256=admin.sha(raw)))
        with mock.patch.object(self.store, 'verify', return_value={meta['archive']['file']: raw}):
            entry = self.pub.entry({'metadata': meta}, attachment(meta))
            self.assertEqual(entry['capabilities'], ['workbench'])
            self.assertEqual(entry['release']['skill'], 'qcu-course-draft')
            self.assertEqual(entry['release']['skillSha256'], admin.sha(files[path]))
            for change in [dict(id='qcu-other'), dict(productType='skill'), dict(skills=['qcu-course-draft', 'qcu-other'])]:
                with self.assertRaises(admin.Refused):
                    self.pub.entry({'metadata': dict(meta, **change)}, attachment(meta))
        for declared, present in [(False, True), (True, False)]:
            changed = dict(files)
            changed_pkg = dict(pkg, files=pkg['files'] if declared else [p for p in pkg['files'] if p != path])
            changed['package.json'] = admin.encoded(changed_pkg)
            if not present:
                del changed[path]
            archive = fixture.archive(changed)
            with mock.patch.object(self.store, 'verify', return_value={meta['archive']['file']: archive}):
                with self.assertRaises(admin.Refused) as caught:
                    self.pub.entry({'metadata': meta}, attachment(meta))
                self.assertEqual(caught.exception.code, 'entry.skill_missing')
        self.assertEqual(self.pub.pointer()['revision'], 0)

    def test_newer_release_then_explicit_new_revision_rollback_retains_both_packages(self):
        first = self.prepare()
        self.pub.confirm(first['id'], self.body(first))
        with mock.patch.object(fixture, 'VERSION', '0.0.2-example.1'):
            fixture.write_handoff(self.root / 'handoff-new')
        self.files = {p.name: p.read_bytes() for p in (self.root / 'handoff-new').iterdir()}
        second = self.prepare()
        self.pub.confirm(second['id'], self.body(second))
        payload, _ = self.pub.snapshot()
        self.assertEqual(payload['catalog']['entries'][0]['release']['version'], '0.0.2-example.1')
        self.pub.confirm(first['id'], self.body(first, 'rollback'))
        payload, _ = self.pub.snapshot()
        self.assertEqual(payload['revision'], 3)
        self.assertEqual(payload['catalog']['entries'][0]['release']['version'], '0.0.1-example.1')
        for record in (first, second):
            self.assertEqual(self.request('/plugins/' + record['metadata']['archive']['file'])[0], 200)
        with mock.patch.object(admin.publication_module.time, 'time', return_value=payload['expiresAt'] / 1000 + 1):
            self.assertEqual(self.pub.status()['state'], 'expired')

    def test_operator_key_init_no_overwrite_public_root_or_links_and_exclusive_publisher(self):
        helper = str(REPO / 'scripts/qcu-market-sign.mjs')
        key = self.store.disk.read('signing/signing.key')
        self.assertEqual((self.store.root / 'signing/signing.key').stat().st_mode & 0o777, 0o600)
        for path in [self.store.root / 'signing', self.root / 'public/signing']:
            result = subprocess.run([self.node, helper, 'init', str(path)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn(key, result.stdout + result.stderr)
        (self.root / 'alias').symlink_to(self.store.root)
        result = subprocess.run([self.node, helper, 'init', str(self.root / 'alias/signing')], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.store.disk.read('signing/signing.key'), key)
        other = admin.Store(self.root / 'other-private', True, initial_password=SYNTHETIC_PASSWORD)
        try:
            (self.root / '.git').write_text('gitdir: synthetic-worktree-marker\n')
            result = subprocess.run([self.node, helper, 'init', str(other.root / 'signing')], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((other.root / 'signing').exists())
        finally:
            (self.root / '.git').unlink()
            other.close()
        with self.assertRaises(BlockingIOError):
            type(self.pub)(self.store, self.pub.api, self.root / 'public', self.trust, self.node, test=True)

    def test_operator_bootstrap_pins_preserves_and_confirms_before_publishing(self):
        r = self.store.upload({'files': [{'path': name, 'base64': base64.b64encode(raw).decode()} for name, raw in self.files.items()]})
        entry = self.pub.entry(r, attachment(r['metadata']))
        meta = r['metadata']
        product = dict(id=meta['id'], status='published', review='approved', dshVersions=[meta['runtime']], **meta['archive'], version=meta['version'])
        catalog = dict(schemaVersion=1, audience='lan-private', publicRelease=False, plugins=[product], skills=[])
        resources = {'/catalog.json': admin.encoded(catalog), '/index.html': b'example', '/themes.html': b'example', '/plugins/' + meta['archive']['file']: self.files[meta['archive']['file']]}
        # Actual pinned static snapshot loader, not a remote JSON trust override.
        static = self.root / 'static'
        static.mkdir()
        (static / 'plugins').mkdir()
        for name, raw in resources.items():
            (static / name[1:]).write_bytes(raw)
        manifest = admin.encoded(dict(schemaVersion=1, files={name[1:]: dict(bytes=len(raw), sha256=admin.sha(raw)) for name, raw in resources.items()}))
        (static / 'manifest.json').write_bytes(manifest)
        resources = hub.load_snapshot(static, admin.sha(manifest))
        seed = admin.encoded(dict(schemaVersion=4, protocol=4, revision=1, entries=[entry]))
        preview = self.pub.bootstrap_preview(resources, admin.sha(manifest), seed)
        self.assertEqual(self.pub.pointer()['revision'], 0)
        with self.assertRaises(admin.Refused):
            self.pub.bootstrap(resources, admin.sha(manifest), seed, '0' * 64)
        with self.assertRaises(admin.Refused):
            self.pub.bootstrap_preview(resources, admin.sha(manifest), admin.encoded(dict(schemaVersion=4, protocol=4, revision=1, entries=[])))
        changed = copy.deepcopy(entry)
        changed['release']['version'] = '9.0.0'
        with self.assertRaises(admin.Refused):
            self.pub.bootstrap_preview(resources, admin.sha(manifest), admin.encoded(dict(schemaVersion=4, protocol=4, revision=1, entries=[changed])))
        result = self.pub.bootstrap(resources, admin.sha(manifest), seed, preview['previewDigest'])
        self.assertEqual(result['state'], 'verified')
        self.assertEqual(self.pub.snapshot()[0]['catalog']['entries'], [entry])
        self.assertEqual(self.pub.bootstrap(resources, admin.sha(manifest), seed, preview['previewDigest'])['current'], result['current'])


class BootstrapSkillTest(unittest.TestCase):
    """Operator preview only: ephemeral private keys, no sockets or publication."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/private/tmp', prefix='qcu-bootstrap-skill-')
        self.root = Path(self.tmp.name)
        self.store = admin.Store(self.root / 'private', True, initial_password=SYNTHETIC_PASSWORD)
        self.node = shutil.which('node')
        result = subprocess.run([self.node, str(REPO / 'scripts/qcu-market-sign.mjs'), 'init', str(self.store.root / 'signing')], capture_output=True, check=True)
        self.trust = json.loads(result.stdout)
        self.pub = self.store.configure_publication(self.root / 'public', self.trust, self.node, initialize=True)
        self.case = 0

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def preview_case(self, *, workbench=True, declared=True, nested=True, missing=False, wrong_hash=False):
        product_id = 'qcu-course-workbench' if workbench else fixture.PRODUCT
        skill_id = 'qcu-course-draft' if workbench else product_id
        path = 'skills/qcu-course-draft/SKILL.md' if nested else 'SKILL.md'
        skill = b'# Synthetic Skill\nBootstrap path/hash regression only; native and business untested.\n'
        files = fixture.example_files()
        package = json.loads(files['package.json'])
        package['name'] = product_id
        if declared:
            package['files'].append(path)
        files['package.json'] = admin.encoded(package)
        files['cordis.patch.yml'] = admin.encoded([{'insert': [{'id': product_id, 'name': product_id, 'disabled': True}]}])
        if not missing:
            files[path] = skill
        archive = fixture.archive(files)
        release = dict(id=product_id, version=fixture.VERSION, origin=self.trust['origin'], runtime='0.2.0-rc.2',
                       skill=skill_id, skillSha256='0' * 64 if wrong_hash else admin.sha(skill), provider=product_id + '@' + fixture.VERSION,
                       bytes=len(archive), sha256=admin.sha(archive), file=product_id + '-' + fixture.VERSION + '-' + admin.sha(archive) + '.tgz',
                       releaseStatus='published', license='MIT')
        entry = dict(id=product_id, title='Synthetic bootstrap Skill regression', kind='bundle' if workbench else 'skill',
                     capabilities=['workbench' if workbench else 'skill'], sourceLabel='QCU自有', release=release,
                     **attachment(dict(sourceRevision='0123456789abcdef0123456789abcdef01234567', license='MIT')))
        product = dict(id=product_id, version=fixture.VERSION, file=release['file'], bytes=release['bytes'], sha256=release['sha256'],
                       status='published', review='approved', dshVersions=['0.2.0-rc.2'])
        resources = {'/catalog.json': admin.encoded(dict(schemaVersion=1, audience='lan-private', publicRelease=False, plugins=[product], skills=[])),
                     '/index.html': b'Synthetic fixture', '/themes.html': b'Synthetic fixture', '/plugins/' + release['file']: archive}
        self.case += 1
        static = self.root / ('static-' + str(self.case))
        static.mkdir()
        (static / 'plugins').mkdir()
        for name, raw in resources.items():
            (static / name[1:]).write_bytes(raw)
        manifest = admin.encoded(dict(schemaVersion=1, files={name[1:]: dict(bytes=len(raw), sha256=admin.sha(raw)) for name, raw in resources.items()}))
        (static / 'manifest.json').write_bytes(manifest)
        seed = admin.encoded(dict(schemaVersion=4, protocol=4, revision=1, entries=[entry]))
        return self.pub.bootstrap_preview(hub.load_snapshot(static, admin.sha(manifest)), admin.sha(manifest), seed)

    def test_exact_nested_workbench_and_existing_root_provider_preview_without_publication(self):
        for workbench, nested in [(True, True), (False, False)]:
            with self.subTest(workbench=workbench):
                preview = self.preview_case(workbench=workbench, nested=nested)
                self.assertEqual(preview['proposal']['entries'][0]['release']['skill'], 'qcu-course-draft' if workbench else fixture.PRODUCT)
                self.assertEqual(self.pub.pointer()['revision'], 0)
                self.assertEqual(self.pub.history(), [])

    def test_workbench_requires_exact_declared_nested_file_and_reviewed_hash(self):
        for change, code in [({'declared': False}, 'bootstrap.skill_declaration'),
                             ({'nested': False}, 'bootstrap.skill_declaration'),
                             ({'missing': True}, 'bootstrap.skill'),
                             ({'wrong_hash': True}, 'bootstrap.skill')]:
            with self.subTest(change=change):
                with self.assertRaises(admin.Refused) as caught:
                    self.preview_case(**change)
                self.assertEqual(caught.exception.code, code)
        self.assertEqual(self.pub.pointer()['revision'], 0)

    def test_generic_provider_does_not_discover_nested_paths_or_accept_wrong_hash(self):
        for change in [dict(nested=True), dict(nested=False, wrong_hash=True)]:
            with self.subTest(change=change):
                with self.assertRaises(admin.Refused) as caught:
                    self.preview_case(workbench=False, **change)
                self.assertEqual(caught.exception.code, 'bootstrap.skill')


if __name__ == '__main__':
    unittest.main()
