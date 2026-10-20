"""Synthetic-only unit and real TCP HTTP coverage; never execute uploaded code."""
import base64
from concurrent.futures import ThreadPoolExecutor
import contextlib
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import select
import pty
import time
from unittest import mock
import subprocess
import sys
import tempfile
import threading
import unittest

REPO = Path(__file__).absolute().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


admin = module('hub_admin', REPO / 'hub/admin/server.py')
SYNTHETIC_PASSWORD = 'Synthetic-only-admin-2026!'

fixture = module('handoff_example', REPO / 'templates/qcu-submission/generate-example.py')


class AdminTest(unittest.TestCase):
    def setUp(self):
        # /tmp on macOS is a symlink: use its actual private parent explicitly.
        self.tmp = tempfile.TemporaryDirectory(dir='/private/tmp', prefix='qcu-admin-test-')
        self.root = Path(self.tmp.name)
        self.store = admin.Store(self.root / 'state', True, initial_password=SYNTHETIC_PASSWORD)
        fixture.write_handoff(self.root / 'handoff')
        self.files = {p.name: p.read_bytes() for p in (self.root / 'handoff').iterdir()}

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def envelope(self, files=None):
        return {'files': [{'path': name, 'base64': base64.b64encode(raw).decode()} for name, raw in (self.files if files is None else files).items()]}

    def upload(self, files=None):
        return self.store.upload(self.envelope(files))

    def review(self, record, action='approve', **extra):
        return self.store.review(record['id'], dict(action=action, reason='Synthetic manual inspection; native/business remain untested.',
                               materialsDigest=record['materialsDigest'], checklist={key: True for key in admin.CHECKLIST}, **extra))

    def prepare(self, record):
        preview = self.store.preview(record['id'])
        return self.store.prepare(record['id'], dict(confirm=True, materialsDigest=record['materialsDigest'], proposalDigest=preview['proposalDigest']))

    def refused(self, call, code=None):
        with self.assertRaises(admin.Refused) as caught:
            call()
        if code:
            self.assertEqual(caught.exception.code, code)

    def rewrite(self, path, raw):
        os.chmod(path, 0o600)
        path.write_bytes(raw)

    def test_flow_snapshot_and_immutable_candidate(self):
        original = {p.name: p.read_bytes() for p in (self.root / 'handoff').iterdir()}
        record = self.upload()
        self.assertEqual(record['status'], 'in-review')
        self.assertEqual(record['report']['approval'], 'required')
        self.assertEqual(record['report']['evidence']['liveInstall'], 'untested')
        self.assertEqual(record['inventory'], admin.inventory(self.files))
        self.assertEqual(record['materialsDigest'], admin.sha(admin.encoded(record['inventory'])))
        self.refused(lambda: self.store.preview(record['id']), 'candidate.not_approved')
        approved = self.review(record)
        self.assertEqual(approved['status'], 'approved')
        prepared = self.prepare(approved)
        self.assertEqual(prepared['status'], 'release-prepared')
        contents = self.store.candidate_files(prepared)
        proposal = json.loads(contents['proposal.json'])
        proposal_digest = proposal.pop('proposalDigest')
        self.assertEqual(proposal_digest, admin.sha(admin.encoded(proposal)))
        self.assertFalse(proposal['marketAvailable'])
        self.assertTrue(proposal['catalogIntegrationRequired'])
        self.assertEqual(proposal['status'], 'local-candidate-not-published')
        self.assertEqual(proposal['approval'], approved['approval'])
        audit = json.loads(contents['approval-audit.json'])['audit']
        preparations = [event for event in audit if event['action'] == 'prepare']
        self.assertEqual([event['result'] for event in preparations], ['intent', 'completed'])
        for event in preparations:
            self.assertEqual(event['actor'], admin.ACCOUNT)
            self.assertEqual(event['materialsDigest'], record['materialsDigest'])
            self.assertEqual(event['proposalDigest'], proposal_digest)
            self.assertTrue(event['time'])
        self.assertEqual(prepared['audit'], audit)
        name = record['metadata']['archive']['file']
        self.assertEqual(contents[name], original[name])
        self.assertEqual(self.prepare(prepared)['candidate'], prepared['candidate'])
        self.assertEqual({p.name: p.read_bytes() for p in (self.root / 'handoff').iterdir()}, original)
        self.assertEqual(len(list((self.store.root / 'candidates').iterdir())), 1)
        self.store.close()
        self.store = admin.Store(self.root / 'state')
        self.assertEqual(self.store.preview(prepared['id'])['proposalDigest'], proposal_digest)
        self.assertEqual(self.prepare(prepared), prepared)

    def test_return_checklist_exact_booleans_and_no_change_on_rejection(self):
        record = self.upload()
        before = self.store.disk.read('state.json')
        for checklist in ({}, {'unexpected': {'arbitrary': 'data'}},
                          {key: 1 for key in admin.CHECKLIST},
                          {key: 'false' for key in admin.CHECKLIST},
                          {key: {} for key in admin.CHECKLIST}):
            body = dict(action='return', reason='Needs revision', materialsDigest=record['materialsDigest'], checklist=checklist)
            self.refused(lambda: self.store.review(record['id'], body), 'review.checklist')
            self.assertEqual(self.store.disk.read('state.json'), before)
            self.assertEqual(self.store.get(record['id']), record)
        body['checklist'] = {key: False for key in admin.CHECKLIST}
        returned = self.store.review(record['id'], body)
        self.assertEqual(returned['status'], 'needs-changes')
        self.assertEqual(returned['audit'][-1]['checklist'], body['checklist'])

    def test_invalid_inputs_never_admitted(self):
        cases = [{}, {'files': []}, {'files': 'bad'}, {'files': [{}]}, {'files': [{'path': 'x', 'base64': '!'}]},
                 {'files': [{'path': '../submission.json', 'base64': ''}]},
                 {'files': [{'path': '/submission.json', 'base64': ''}]},
                 {'files': [{'path': 'C:/submission.json', 'base64': ''}]},
                 {'files': [{'path': 'a\\b', 'base64': ''}]},
                 {'files': [{'path': 'x', 'base64': 'Zh=='}]},
                 {'files': [{'path': 'x', 'base64': ''}, {'path': 'x/a', 'base64': ''}]},
                 self.envelope({'submission.json': b'{}', 'A.txt': b'', 'a.txt': b''}),
                 self.envelope({'submission.json': b'{}', 'A': b'', 'a/x': b''}),
                 {'files': [{'path': 'submission.json', 'base64': ''}] * 2},
                 {'files': [{'path': 'x' * 241, 'base64': ''}]},
                 self.envelope({'submission.json': b'{}', **{str(i): b'' for i in range(64)}}),
                 self.envelope({'submission.json': b'x' * (admin.MAX_JSON + 1)}),
                 self.envelope({'submission.json': b'{}', 'large.txt': b'x' * (admin.MAX_FILE + 1)}),
                 self.envelope({'submission.json': b'{}', **{str(i): b'x' * admin.MAX_FILE for i in range(11)}})]
        for case in cases:
            with self.subTest(case=str(case)[:80]):
                self.refused(lambda: self.store.upload(case))
                self.assertEqual(self.store.state['records'], {})
                self.assertEqual(list((self.store.root / 'submissions').iterdir()), [])
        for raw in [b'{"files":[],"files":[]}', b'[' * 10000, b'NaN', b'\xff', b'{']:
            self.refused(lambda: admin.parse(raw))

    def test_static_failures_retained_and_not_approvable(self):
        files = dict(self.files)
        del files['BUILD.md']
        record = self.upload(files)
        self.assertEqual(record['status'], 'needs-changes')
        self.assertTrue(record['report']['errors'])
        self.refused(lambda: self.review(record), 'review.stale')
        bad = self.upload({'submission.json': b'{invalid'})
        self.assertEqual(bad['status'], 'needs-changes')
        self.assertEqual(len(self.store.state['records']), 2)

    def test_all_attachments_scanned_and_json_view_redacted(self):
        secret = b'sk-' + b'A' * 32
        files = dict(self.files, **{'extra.md': secret, 'extra.html': b'<script>throw 1</script>'})
        record = self.upload(files)
        self.assertEqual(record['status'], 'needs-changes')
        self.assertIn('secret.pattern', [e['code'] for e in record['report']['errors']])
        meta = json.loads(files['submission.json'])
        meta['title'] = secret.decode()
        files['submission.json'] = admin.encoded(meta)
        second = self.upload(files)
        self.assertNotIn(secret, admin.encoded(admin.display_value(second)))

    def test_duplicate_revision_and_version_archive_conflict(self):
        record = self.upload()
        self.review(record)
        self.assertEqual(self.upload()['id'], record['id'])
        revised = dict(self.files, **{'SOURCE.md': self.files['SOURCE.md'] + b'\nReviewed source declaration.\n'})
        revision = self.upload(revised)
        self.assertNotEqual(revision['id'], record['id'])
        self.assertEqual(revision['status'], 'in-review')
        self.assertIsNone(revision['approval'])
        changed = dict(self.files)
        name = record['metadata']['archive']['file']
        changed[name] += b'changed archive bytes'
        self.refused(lambda: self.upload(changed), 'version.archive_conflict')
        self.assertEqual(len(self.store.state['records']), 2)

    def test_review_checks_rationale_stale_digest_and_separate_prepare(self):
        record = self.upload()
        body = dict(action='approve', reason='review', materialsDigest=record['materialsDigest'], checklist={key: True for key in admin.CHECKLIST})
        for patch in [dict(reason=''), dict(reason='x' * 2001), dict(checklist={}), dict(materialsDigest='0' * 64), dict(checklist={key: 1 for key in admin.CHECKLIST}), dict(action='publish')]:
            self.refused(lambda: self.store.review(record['id'], dict(body, **patch)))
        returned = self.review(record, 'return')
        self.assertEqual(returned['status'], 'needs-changes')
        self.refused(lambda: self.review(record), 'review.stale')
        files = dict(self.files, **{'SOURCE.md': b'Revised source.\n'})
        approved = self.review(self.upload(files))
        self.assertIsNone(approved['candidate'])
        self.assertEqual(list((self.store.root / 'candidates').iterdir()), [])
        preview = self.store.preview(approved['id'])
        for patch in [dict(confirm=False), dict(proposalDigest='0' * 64), dict(materialsDigest='0' * 64)]:
            body = dict(confirm=True, proposalDigest=preview['proposalDigest'], materialsDigest=approved['materialsDigest'])
            self.refused(lambda: self.store.prepare(approved['id'], dict(body, **patch)))

    def test_tampered_frozen_inventory_blocks_review_preparation_and_export(self):
        for mode in ('change', 'missing', 'extra', 'symlink', 'hardlink', 'directory'):
            with self.subTest(mode=mode):
                record = self.upload(dict(self.files, **{'marker.txt': mode.encode()}))
                approved = self.review(record)
                frozen = self.store.root / 'submissions' / record['id']
                target = frozen / 'SOURCE.md'
                if mode == 'change':
                    self.rewrite(target, b'changed')
                elif mode == 'missing':
                    target.unlink()
                elif mode == 'extra':
                    (frozen / 'unexpected.txt').write_bytes(b'extra')
                elif mode == 'symlink':
                    target.unlink()
                    target.symlink_to(self.root / 'handoff' / 'SOURCE.md')
                elif mode == 'hardlink':
                    target.unlink()
                    os.link(self.root / 'handoff' / 'SOURCE.md', target)
                else:
                    (frozen / 'extra-dir').mkdir()
                self.refused(lambda: self.store.preview(approved['id']))
                self.refused(lambda: self.store.verify(approved))
        record = self.upload(dict(self.files, **{'marker.txt': b'before-review'}))
        self.rewrite(self.store.root / 'submissions' / record['id'] / 'submission.json', b'{}')
        self.refused(lambda: self.review(record), 'materials.changed')

    def test_candidate_tampering_and_metadata_invalidates(self):
        record = self.review(self.upload())
        record = self.prepare(record)
        target = self.store.root / 'candidates' / record['candidate']['id'] / 'proposal.json'
        self.rewrite(target, b'{}')
        self.refused(lambda: self.store.candidate_files(record), 'candidate.changed')
        self.refused(lambda: self.prepare(record), 'candidate.changed')
        live = self.store.get(record['id'])
        live['metadata']['license'] = 'changed'
        self.refused(lambda: self.store.preview(record['id']), 'materials.changed')

    def test_concurrent_duplicates_decisions_and_preparation(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            records = list(pool.map(lambda _: self.upload(), range(6)))
        self.assertEqual(len({r['id'] for r in records}), 1)
        def decision(_):
            try:
                return self.review(records[0])['status']
            except admin.Refused:
                return 'refused'
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(decision, range(6)))
        self.assertEqual(results.count('approved'), 1)
        with ThreadPoolExecutor(max_workers=6) as pool:
            prepared = list(pool.map(lambda _: self.prepare(records[0]), range(6)))
        self.assertEqual(len({r['candidate']['id'] for r in prepared}), 1)

    def test_restart_recovery_and_exclusive_lock(self):
        record = self.upload()
        with self.assertRaises((BlockingIOError, admin.Refused)):
            admin.Store(self.store.root)
        self.store.close()
        self.store = admin.Store(self.root / 'state')
        self.assertEqual(self.store.get(record['id'])['status'], 'in-review')
        for interrupted in ('checking', 'preparing'):
            self.store.get(record['id'])['status'] = interrupted
            self.store.save()
            self.store.close()
            self.store = admin.Store(self.root / 'state')
            recovered = self.store.get(record['id'])
            self.assertEqual(recovered['status'], 'recoverable-failure')
            self.assertEqual(recovered['audit'][-1]['action'], 'recovery')
            self.refused(lambda: self.store.preview(record['id']))

    def test_root_safety_and_symlink_ancestors(self):
        for path in (REPO, REPO / '.work/private', REPO.parent, Path('/'), Path('/Users/mcq/Repos/new-state')):
            self.refused(lambda: admin.Store(path, True, initial_password=SYNTHETIC_PASSWORD))
        self.refused(lambda: admin.Store(self.root / 'raw/../state2', True, initial_password=SYNTHETIC_PASSWORD), 'store.root')
        link = self.root / 'link'
        link.symlink_to(self.store.root, target_is_directory=True)
        with self.assertRaises((admin.Refused, admin.checker.Rejected, OSError)):
            admin.Store(link)
        link.unlink()
        link.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises((admin.Refused, admin.checker.Rejected, OSError)):
            admin.Store(link / 'other', True, initial_password=SYNTHETIC_PASSWORD)
        self.assertEqual((self.store.root / 'admin-auth.json').stat().st_mode & 0o777, 0o600)
        self.assertFalse((self.store.root / 'credentials.json').exists())
        self.refused(lambda: admin.Server(('0.0.0.0', 0), self.store))
        public = self.root / 'public'
        public.mkdir()
        (public / 'manifest.json').write_text('{}')
        (public / 'catalog.json').write_text('{}')
        self.refused(lambda: admin.Store(public / 'private', True, initial_password=SYNTHETIC_PASSWORD), 'store.public_root')

    def test_real_process_crashes_release_lock_and_recover_without_retry(self):
        # Trusted test process kills itself only after a durable checking /
        # preparing checkpoint, proving recovery does not execute unknown work.
        root = self.store.root
        self.store.close()
        common = '''
import importlib.util, os, base64
from pathlib import Path
spec=importlib.util.spec_from_file_location('admin', {module!r})
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
s=a.Store(Path({root!r}))
'''.format(module=str(REPO / 'hub/admin/server.py'), root=str(root))
        upload = '''
files=[dict(path=p.name,base64=base64.b64encode(p.read_bytes()).decode()) for p in Path({handoff!r}).iterdir()]
a.checker.check_submission=lambda _:os._exit(17)
s.upload(dict(files=files))
'''.format(handoff=str(self.root / 'handoff'))
        result = subprocess.run([sys.executable, '-c', common + upload], capture_output=True)
        self.assertEqual(result.returncode, 17, result.stderr.decode())
        self.store = admin.Store(root)
        crashed = next(iter(self.store.state['records'].values()))
        self.assertEqual(crashed['status'], 'recoverable-failure')
        self.assertIsNone(crashed['approval'])
        record = self.upload(dict(self.files, **{'revision.txt': b'new crash-test revision'}))
        record = self.review(record)
        self.store.close()
        preparation = '''
r=s.get({sid!r});p=s.preview(r['id']);original=s.disk.write
def die(name,*args,**kwargs):
    if name.startswith('candidates/'): os._exit(18)
    return original(name,*args,**kwargs)
s.disk.write=die
s.prepare(r['id'],dict(materialsDigest=r['materialsDigest'],proposalDigest=p['proposalDigest'],confirm=True))
'''.format(sid=record['id'])
        result = subprocess.run([sys.executable, '-c', common + preparation], capture_output=True)
        self.assertEqual(result.returncode, 18, result.stderr.decode())
        self.store = admin.Store(root)
        record = self.store.get(record['id'])
        self.assertEqual(record['status'], 'recoverable-failure')
        self.assertIsNone(record['candidate'])
        self.assertEqual(len(list((root / 'candidates').iterdir())), 1)  # orphan retained, never exported
        self.refused(lambda: self.store.preview(record['id']))

    def test_state_write_failure_fails_closed(self):
        original = self.store.disk.write
        def fail(name, *args, **kwargs):
            if name == 'state.json':
                raise OSError('synthetic interruption')
            return original(name, *args, **kwargs)
        self.store.disk.write = fail
        with self.assertRaises(OSError):
            self.upload()
        self.assertFalse(self.store.healthy)

    def test_hash_only_no_defaults_and_strict_auth_file(self):
        raw = self.store.disk.read('admin-auth.json')
        auth = json.loads(raw)
        self.assertNotIn(SYNTHETIC_PASSWORD.encode(), raw)
        self.assertEqual(auth['iterations'], 600000)
        self.assertEqual(auth['passwordHash'], hashlib.pbkdf2_hmac('sha256', SYNTHETIC_PASSWORD.encode(), bytes.fromhex(auth['salt']), 600000).hex())
        for password in (None, '', 'short', 'a'*129, 'a'*12+'\0', '\ud800'*12):
            target = self.root / 'uninitialized'
            self.refused(lambda: admin.Store(target, True, initial_password=password), 'auth.invalid')
            self.assertFalse(target.exists())
        for body in ([], {}, {'account':admin.ACCOUNT, 'password':None}, {'account':admin.ACCOUNT,'password':'x'*129}, {'account':admin.ACCOUNT,'password':'a'*12+'\0'}):
            self.store.login_failures.clear()
            self.refused(lambda: self.store.login(body), 'auth.invalid')
        self.store.login_failures.clear()
        self.refused(lambda: self.store.login({'account':'other', 'password':SYNTHETIC_PASSWORD}), 'auth.invalid')
        self.refused(lambda: self.store.login({'account':admin.ACCOUNT, 'password':'wrong-password-123'}), 'auth.invalid')
        root = self.store.root
        self.store.close()
        for invalid in (b'{}', b'{"salt":"x","salt":"y"}', admin.encoded(dict(auth, iterations=1)), admin.encoded(dict(auth, salt='x'*64)), admin.encoded(dict(auth, passwordHash='g'*64)), admin.encoded(dict(auth, resetEvents=[{}])), admin.encoded(dict(auth, extra='secret')), b'x'*4097):
            self.rewrite(root / 'admin-auth.json', invalid)
            self.refused(lambda: admin.Store(root), 'store.auth')
            self.assertEqual((root / 'admin-auth.json').read_bytes(), invalid)
        self.rewrite(root / 'admin-auth.json', raw)
        os.chmod(root / 'admin-auth.json', 0o644)
        self.refused(lambda: admin.Store(root), 'store.auth')
        os.chmod(root / 'admin-auth.json', 0o600)
        alias = self.root / 'auth-alias'
        os.link(root / 'admin-auth.json', alias)
        self.refused(lambda: admin.Store(root), 'store.auth')
        alias.unlink()
        (root / 'admin-auth.json').unlink()
        (root / 'admin-auth.json').symlink_to(self.root / 'unused')
        self.refused(lambda: admin.Store(root), 'store.auth')

    def test_throttling_serialized_before_kdf_and_clock_window(self):
        clock = [100.0]
        self.store.clock = lambda: clock[0]
        original = admin.hashlib.pbkdf2_hmac
        calls = []
        def count(*args):
            calls.append(1)
            return original(*args)
        def fail(_):
            try:
                self.store.login(dict(account=admin.ACCOUNT, password='Synthetic-wrong-password!'))
            except admin.Refused as error:
                return error.code
        with mock.patch.object(admin.hashlib, 'pbkdf2_hmac', side_effect=count):
            with ThreadPoolExecutor(max_workers=8) as pool:
                codes = list(pool.map(fail, range(8)))
            self.assertEqual(codes.count('auth.invalid'), 5)
            self.assertEqual(codes.count('auth.throttled'), 3)
            self.assertEqual(len(calls), 5)
            self.refused(lambda: self.store.login(dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD)), 'auth.throttled')
            self.assertEqual(len(calls), 5)
            clock[0] += 60
            self.assertIn('token', self.store.login(dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD)))
            self.assertEqual(len(calls), 6)

    def test_sessions_expiry_capacity_logout_restart_and_reset(self):
        clock = [0.0]
        self.store.clock = lambda: clock[0]
        login = lambda: self.store.login(dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD))['token']
        first, second = login(), login()
        self.assertNotEqual(first, second)
        self.assertEqual(self.store.principal('Bearer '+first), admin.ACCOUNT)
        self.store.logout('Bearer '+first)
        self.refused(lambda: self.store.principal('Bearer '+first), 'auth.required')
        # Capacity logic can be checked with synthetic RAM sessions without extra KDF runs.
        self.store.sessions = {'fixture-'+str(i): admin.SESSION_TTL for i in range(16)}
        token = login()
        self.assertEqual(len(self.store.sessions), 16)
        self.assertNotIn('fixture-0', self.store.sessions)
        clock[0] = admin.SESSION_TTL
        self.refused(lambda: self.store.principal('Bearer '+token), 'auth.required')
        record = self.prepare(self.review(self.upload()))
        before = self.store.disk.read('state.json')
        candidates = self.store.disk.tree('candidates/'+record['candidate']['id'])
        old_auth = self.store.disk.read('admin-auth.json')
        token = login()
        root = self.store.root
        self.store.close()
        self.store = admin.Store(root)
        self.refused(lambda: self.store.principal('Bearer '+token), 'auth.required')
        replacement = 'Synthetic-reset-password-2026!'
        with mock.patch.object(admin, 'now', return_value='2026-10-20T02:30:00+00:00'):
            self.store.reset_password(replacement)
        self.store.close()
        self.store = admin.Store(root)
        self.assertEqual(self.store.auth['resetEvents'][-1]['time'], '2026-10-20T02:30:00+00:00')
        self.assertEqual(before, self.store.disk.read('state.json'))
        self.assertEqual(candidates, self.store.candidate_files(record))
        self.assertNotEqual(old_auth, self.store.disk.read('admin-auth.json'))
        self.assertEqual(self.store.auth['resetEvents'][-1]['action'], 'password-reset')
        self.assertEqual(set(self.store.auth['resetEvents'][-1]), {'action','actor','time'})
        self.refused(login, 'auth.invalid')
        self.assertIn('token', self.store.login(dict(account=admin.ACCOUNT, password=replacement)))

    def test_reset_interrupted_state_unchanged_and_no_echo_fallback(self):
        record = self.upload()
        self.store.get(record['id'])['status'] = 'checking'
        self.store.save()
        before = self.store.disk.read('state.json')
        root = self.store.root
        self.store.close()
        code, _ = self.cli_pty(root, '--reset-admin-password', ['Synthetic-interrupted-reset!']*2)
        self.assertEqual(code, 0)
        self.assertEqual((root/'state.json').read_bytes(), before)
        with mock.patch.object(admin.sys.stdin, 'isatty', return_value=True), mock.patch.object(admin.sys.stdout, 'isatty', return_value=True), mock.patch.object(admin.getpass, 'getpass', side_effect=admin.getpass.GetPassWarning):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                # Redirected stdout is intentionally non-TTY, so patch that exact object.
                with mock.patch.object(output, 'isatty', return_value=True):
                    self.refused(admin.prompt_password, 'auth.tty_required')

    def test_legacy_state_refused_without_mutating_any_bytes(self):
        root = self.root / 'legacy'
        root.mkdir(mode=0o700)
        (root/'state.json').write_bytes(b'{"schemaVersion":1,"records":{}}')
        (root/'credentials.json').write_bytes(b'{"submitter":"synthetic-legacy-only","maintainer":"synthetic-other"}')
        before = {p.name:p.read_bytes() for p in root.iterdir()}
        self.refused(lambda: admin.Store(root), 'store.legacy_state')
        result = subprocess.run([sys.executable, 'hub/admin/server.py', '--state-root',str(root)], cwd=REPO, capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout.strip(), b'store.legacy_state')
        self.assertEqual(before, {p.name:p.read_bytes() for p in root.iterdir()})

    def cli_pty(self, root, action, inputs, expect_start=False):
        pid, fd = pty.fork()
        if pid == 0:
            os.execv(sys.executable, [sys.executable, str(REPO/'hub/admin/server.py'), '--state-root',str(root),action,'--port','0'])
        output, sent, status = b'', 0, None
        deadline = time.monotonic()+12
        try:
            while time.monotonic() < deadline:
                if select.select([fd],[],[],0.1)[0]:
                    try:
                        output += os.read(fd,65536)
                    except OSError:
                        break
                prompts = output.count(b'New password:')+output.count(b'Repeat password:')
                if sent < len(inputs) and prompts > sent:
                    os.write(fd, inputs[sent].encode()+b'\n')
                    sent += 1
                if expect_start and b'Local preparation only:' in output:
                    os.kill(pid, 2)
                    expect_start = False
                done, found = os.waitpid(pid, os.WNOHANG)
                if done:
                    status = found
                    break
            if status is None:
                done, found = os.waitpid(pid, os.WNOHANG)
                if not done:
                    os.kill(pid, 9)
                    _, found = os.waitpid(pid, 0)
                status = found
            for password in inputs:
                self.assertNotIn(password.encode(), output, 'PTY unexpectedly echoed synthetic input')
            return os.waitstatus_to_exitcode(status), output
        finally:
            os.close(fd)

    def test_cli_tty_init_reset_and_lock_without_password_arguments(self):
        root = self.root / 'cli-state'
        base = [sys.executable, 'hub/admin/server.py', '--state-root',str(root)]
        invalid = subprocess.run(base+['--password','Synthetic-unsupported-argument!'], capture_output=True, cwd=REPO)
        self.assertEqual(invalid.returncode, 2)
        self.assertNotIn(b'Synthetic-unsupported-argument!', invalid.stdout+invalid.stderr)
        result = subprocess.run(base+['--init'], input=b'Synthetic-not-accepted\n', capture_output=True, cwd=REPO)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(root.exists())
        code, _ = self.cli_pty(root, '--init', [SYNTHETIC_PASSWORD,'Synthetic-mismatch!'])
        self.assertEqual(code, 2)
        self.assertFalse(root.exists())
        code, _ = self.cli_pty(root, '--init', ['short'])
        self.assertEqual(code, 2)
        self.assertFalse(root.exists())
        code, _ = self.cli_pty(root, '--init', [SYNTHETIC_PASSWORD]*2, expect_start=True)
        self.assertEqual(code, 0)
        isolated = admin.Store(root)
        try:
            record = isolated.upload(self.envelope())
            snapshot = isolated.disk.read('state.json')
            auth = isolated.disk.read('admin-auth.json')
            code, output = self.cli_pty(root, '--reset-admin-password', [])
            self.assertEqual(code, 2)
            self.assertNotIn(b'New password:', output)
            self.assertEqual(auth, isolated.disk.read('admin-auth.json'))
        finally:
            isolated.close()
        replacement = 'Synthetic-PTY-reset-2026!'
        code, _ = self.cli_pty(root, '--reset-admin-password', [replacement]*2)
        self.assertEqual(code, 0)
        isolated = admin.Store(root)
        try:
            self.assertEqual(snapshot, isolated.disk.read('state.json'))
            self.assertEqual(isolated.get(record['id']), record)
            self.assertIn('token', isolated.login(dict(account=admin.ACCOUNT,password=replacement)))
            self.assertEqual(isolated.auth['resetEvents'][-1]['actor'], admin.ACCOUNT)
        finally:
            isolated.close()

    def test_real_http_auth_csrf_limits_reads_and_downloads(self):
        server = admin.Server(('127.0.0.1', 0), self.store)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        tokens = {name: self.store.login(dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD))['token'] for name in ('primary', 'secondary')}
        def request(path='/', method='GET', session=None, body=None, headers=None):
            connection = http.client.HTTPConnection(*server.server_address, timeout=3)
            base = {}
            if session:
                base['Authorization'] = 'Bearer ' + tokens[session]
            if body is not None:
                body = admin.encoded(body)
                base.update(Origin=server.origin, **{'Content-Type': 'application/vnd.qcu.submission+json'})
            base.update(headers or {})
            connection.request(method, path, body, base)
            response = connection.getresponse()
            raw = response.read()
            result = (response.status, raw, dict(response.getheaders()))
            connection.close()
            return result
        try:
            self.assertEqual(request()[0], 200)
            for path in ('/', '/app.js', '/style.css', '/api/session', '/unknown'):
                self.assertEqual(request(path, headers={'Host': 'evil.example'})[0], 403)
            self.assertEqual(request('/api/submissions')[0], 401)
            self.assertEqual(request('/api/session', session='primary')[0], 200)
            status, raw, _ = request('/api/login', 'POST', body=dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD))
            self.assertEqual(status, 200)
            fresh = json.loads(raw)['token']
            self.assertNotIn(fresh, tokens.values())
            self.assertEqual(request('/api/session', headers={'Authorization': 'Bearer ' + fresh})[0], 200)
            self.assertEqual(request('/api/logout', 'POST', body={}, headers={'Authorization': 'Bearer ' + fresh})[0], 200)
            self.assertEqual(request('/api/session', headers={'Authorization': 'Bearer ' + fresh})[0], 401)
            for patch in ({'Origin':'null'}, {'Origin':''}, {'Host':'evil'}, {'Content-Type':'application/json'}, {'Content-Length':'5000'}):
                self.assertGreaterEqual(request('/api/login', 'POST', body={}, headers=patch)[0], 400)
            self.assertEqual(request('/api/login', 'POST', body={'account':admin.ACCOUNT,'password':SYNTHETIC_PASSWORD,'extra':True})[0], 401)
            self.assertEqual(request('/api/session', headers={'Authorization':'Bearer '+'legacy-role-token'*4})[0], 401)
            for raw_body in (b'{"account":"qcu-admin","account":"qcu-admin","password":"Synthetic-duplicate!"}', b'{"account":"qcu-admin","password":"' + b'x'*129 + b'"}', b'null'):
                connection = http.client.HTTPConnection(*server.server_address, timeout=3)
                connection.request('POST','/api/login',raw_body,{'Origin':server.origin,'Content-Type':'application/vnd.qcu.submission+json'})
                response=connection.getresponse()
                self.assertEqual(response.status,401)
                self.assertEqual(json.loads(response.read()),{'error':'auth.invalid'})
                connection.close()
            for patch in ({'Origin': 'null'}, {'Origin': ''}, {'Origin': 'https://evil.example'}, {'Content-Type': 'application/json'}, {'Content-Length': '99999999'}, {'Transfer-Encoding': 'chunked'}):
                self.assertGreaterEqual(request('/api/submissions', 'POST', 'primary', self.envelope(), patch)[0], 400)
            status, raw, headers = request('/api/submissions', 'POST', 'primary', self.envelope())
            self.assertEqual(status, 200)
            record = json.loads(raw)
            base = '/api/submissions/' + record['id']
            before = self.store.disk.read('state.json')
            for checklist in ({'unexpected': {'arbitrary': 'data'}}, {key: 1 for key in admin.CHECKLIST}, {}):
                body = dict(action='return', reason='HTTP regression', materialsDigest=record['materialsDigest'], checklist=checklist)
                status, raw, _ = request(base + '/review', 'POST', 'secondary', body)
                self.assertEqual(status, 400)
                self.assertEqual(json.loads(raw), {'error': 'review.checklist'})
                self.assertEqual(self.store.disk.read('state.json'), before)
                self.assertEqual(self.store.get(record['id']), record)
            for path in ('/api/submissions', base, base + '/report'):
                self.assertEqual(request(path, session='secondary')[0], 200)
            self.assertEqual(self.store.disk.read('state.json'), before)
            secret = 'sk-' + 'S' * 32
            self.store.get(record['id'])['report']['limitations'].append(secret)
            for path in (base, base + '/report'):
                status, raw, _ = request(path, session='secondary')
                self.assertEqual(status, 200)
                self.assertNotIn(secret.encode(), raw)
                self.assertIn(b'[redacted]', raw)
            for path, method in [(base, 'GET'), (base+'/report', 'GET'), (base+'/materials/0', 'GET'), (base+'/candidate/0', 'GET'), (base+'/preview', 'GET'), (base+'/review', 'POST'), (base+'/prepare', 'POST'), ('/api/submissions', 'POST'), ('/api/session', 'GET'), ('/api/logout', 'POST')]:
                self.assertEqual(request(path, method, body={} if method == 'POST' else None)[0], 401)
            self.assertEqual(self.store.disk.read('state.json'), before)
            for path in ('/materials/../credentials.json', '/materials/%2e%2e', '/materials/64', '/materials/00'):
                self.assertEqual(request(base + path, session='secondary')[0], 404)
            for i, row in enumerate(record['inventory']):
                status, raw, headers = request(base + '/materials/' + str(i), session='secondary')
                self.assertEqual(status, 200)
                self.assertEqual(len(raw), row['bytes'])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['sha256'])
                self.assertEqual(headers['Content-Type'], 'application/octet-stream')
                self.assertTrue(headers['Content-Disposition'].startswith('attachment;'))
                self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(headers['Cache-Control'], 'no-store')
                self.assertNotIn('Access-Control-Allow-Origin', headers)
            approved = self.review(record)
            prepared = self.prepare(approved)
            for i, row in enumerate(prepared['candidate']['inventory']):
                status, raw, _ = request(base + '/candidate/' + str(i), session='secondary')
                self.assertEqual(status, 200)
                self.assertEqual(admin.sha(raw), row['sha256'])
            token = tokens['primary']
            stdout = io.StringIO()
            with contextlib.redirect_stderr(stdout), contextlib.redirect_stdout(stdout):
                status, raw, _ = request('/' + token, session='secondary')
            self.assertNotIn(token, stdout.getvalue())
            self.assertNotIn(token.encode(), raw)
            self.assertNotIn(str(self.store.root).encode(), raw)
            self.assertEqual(request('/', 'OPTIONS')[0], 405)
            self.assertNotIn(b'<script>', request('/api/submissions', session='primary')[1])
            self.rewrite(self.store.root / 'submissions' / record['id'] / 'SOURCE.md', b'tampered')
            status, raw, _ = request(base + '/report', session='secondary')
            self.assertEqual(status, 409)
            self.assertEqual(json.loads(raw), {'error': 'materials.changed'})
        finally:
            server.shutdown()
            server.server_close()
            thread.join(3)

    def test_raw_http_duplicate_headers_missing_origin_and_bad_lengths(self):
        server = admin.Server(('127.0.0.1', 0), self.store)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        tokens = {'primary': self.store.login(dict(account=admin.ACCOUNT, password=SYNTHETIC_PASSWORD))['token']}
        auth = 'Authorization: Bearer ' + tokens['primary'] + '\r\n'
        base = f'POST /api/submissions HTTP/1.1\r\nHost: {server.host}\r\n' + auth
        cases = [base + 'Content-Length: 2\r\n',
                 base + f'Origin: {server.origin}\r\nContent-Length: -1\r\n',
                 base + f'Origin: {server.origin}\r\nContent-Length: 2\r\nContent-Length: 2\r\n',
                 base + f'Origin: {server.origin}\r\nContent-Length: 2\r\nHost: evil\r\n',
                 base + f'Origin: {server.origin}\r\nContent-Length: 20\r\n']
        try:
            for headers in cases + [header.replace('/api/submissions','/api/login') for header in cases]:
                with socket.create_connection(server.server_address, timeout=3) as connection:
                    connection.sendall((headers + 'Content-Type: application/vnd.qcu.submission+json\r\n\r\n{}').encode())
                    connection.shutdown(socket.SHUT_WR)
                    raw = b''
                    while True:
                        block = connection.recv(65536)
                        if not block:
                            break
                        raw += block
                    self.assertRegex(raw.split(b'\r\n')[0], rb'HTTP/1.0 4\d\d')
                    self.assertNotIn(tokens['primary'].encode(), raw)
            self.assertEqual(self.store.state['records'], {})
        finally:
            server.shutdown()
            server.server_close()
            thread.join(3)


if __name__ == '__main__':
    unittest.main()
