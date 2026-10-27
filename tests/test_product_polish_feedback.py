import concurrent.futures
import copy
import hashlib
import importlib.util
import json
import multiprocessing
import os
from pathlib import Path
import secrets
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

REPO = Path(__file__).absolute().parents[1]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, REPO / path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value
feedback = module('feedback', 'hub/feedback.py')
hub = module('hub', 'hub/release/serve-hub.py')
admin = module('admin', 'hub/admin/server.py')

def payload():
    fields = {'title': '合成界面反馈', 'steps': '打开工具市场', 'expected': '显示按钮', 'actual': '按钮换行'}
    text = 'QCU问题反馈记录（尚未提交）\n市场版本：0.1.0-pilot.16.1\n' + '\n'.join(label + '：' + fields[key] for key, label in [('title', '场景与阶段'), ('steps', '复现步骤（匿名）'), ('expected', '期望行为'), ('actual', '实际行为')])
    body = dict(fields, requestId=secrets.token_hex(32), category='ui', knownVersions={'market': '0.1.0-pilot.16.1', 'runtime': 'unobserved'}, text=text, previewSha256=hashlib.sha256(text.encode()).hexdigest(), confirmed=True)
    body['previewSha256'] = hashlib.sha256(feedback.encoded({k:body[k] for k in ('category','title','steps','expected','actual','knownVersions','text')})).hexdigest()
    return body

def submit_process(root, body):
    store = feedback.Inbox(root)
    try: return store.submit(body)
    finally: store.close()

class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-p16-', dir='/private/tmp'); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inbox = feedback.Inbox(self.root / 'feedback', initialize=True); self.addCleanup(self.inbox.close)
        self.body = payload()

    def start(self, enabled=True):
        server = hub.make_server({'/': b'synthetic'}, port=0, feedback=feedback.Receiver(self.inbox) if enabled else None)
        threading.Thread(target=server.serve_forever, daemon=True).start(); self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        return 'http://127.0.0.1:' + str(server.server_port)

    def request(self, origin, path, body=None, headers=None, method=None):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(origin + path, data=raw, method=method, headers=headers or {'Content-Type': 'application/json', 'Origin': origin})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try: response = opener.open(req, timeout=10)
        except urllib.error.HTTPError as e: response = e
        with response: return response.status, response.read(), dict(response.headers)

    def test_atomic_cross_process_idempotence_restart_conflict_and_unknown_lookup(self):
        with concurrent.futures.ProcessPoolExecutor(4, mp_context=multiprocessing.get_context('fork')) as pool:
            replies = list(pool.map(submit_process, [self.inbox.root] * 12, [self.body] * 12))
        self.assertEqual(len({r['receiptId'] for r in replies}), 1); self.assertEqual(len(self.inbox.list()), 1)
        restarted = feedback.Inbox(self.inbox.root); self.addCleanup(restarted.close)
        self.assertEqual(restarted.status({'requestId': self.body['requestId']}), replies[0])
        changed = dict(self.body, category='other')
        changed['previewSha256'] = hashlib.sha256(feedback.encoded({k:changed[k] for k in ('category','title','steps','expected','actual','knownVersions','text')})).hexdigest()
        with self.assertRaises(feedback.Refused) as caught: restarted.submit(changed)
        self.assertEqual(caught.exception.code, 'feedback.conflict')
        self.assertEqual(os.stat(self.inbox.root / 'inbox.json').st_mode & 0o777, 0o600)

    def test_validation_and_privacy_fail_closed(self):
        for raw in [b'{"a":1,"a":2}', b'[' * 9 + b']' * 9, b'{"a":NaN}', b'\xff', b'x' * 16385]:
            with self.assertRaises(feedback.Refused): feedback.parse(raw)
        for delta in [{'extra': 1}, {'confirmed': False}, {'previewSha256': '0' * 64}, {'title': 'other'}, {'category': 'x'}, {'knownVersions': {'market': 'v', 'runtime': 'v', 'device': 'x'}}]:
            with self.assertRaises(feedback.Refused): self.inbox.submit(dict(self.body, **delta))
        for secret in ['sk-' + 's' * 20, 'Bearer secretvalue', '/Users/synthetic/private', 'user@example.org', 'password=syntheticsecret', 'token=syntheticsecret', 'client_secret=syntheticsecret', 'auth: syntheticsecret']:
            b = dict(self.body, actual=secret)
            with self.assertRaises(feedback.Refused): self.inbox.submit(b)
        self.assertEqual(feedback.text('APIKey=[授权值已移除]；auth: [授权值已移除]', 200), 'APIKey=[授权值已移除]；auth: [授权值已移除]')
        for value in [{}, {'requestId': 'bad'}, {'requestId': 'a' * 64}, {'requestId': self.body['requestId'], 'extra': 1}]:
            with self.assertRaises(feedback.Refused) as e: self.inbox.status(value)
            self.assertEqual((e.exception.code, e.exception.status), ('feedback.missing', 404))

    def test_no_links_overlap_permissions_and_capacity(self):
        (self.root / 'alias').symlink_to(self.inbox.root, target_is_directory=True)
        with self.assertRaises(OSError): feedback.Inbox(self.root / 'alias')
        for path in [REPO / 'inbox', self.root / 'state' / 'inbox']:
            if path != REPO / 'inbox': (self.root / 'state').mkdir(); (self.root / 'state' / 'admin-auth.json').touch()
            with self.assertRaises(feedback.Refused): feedback.validate_root(path)
        self.inbox.submit(self.body)
        original = feedback.CAPACITY; feedback.CAPACITY = 1
        try:
            with self.assertRaises(feedback.Refused): self.inbox.submit(payload())
            self.assertEqual(self.inbox.submit(self.body)['revision'], 1)
        finally: feedback.CAPACITY = original
        state = self.inbox.root / 'inbox.json'; state.rename(self.root / 'held'); state.symlink_to(self.root / 'held')
        with self.assertRaises(OSError): self.inbox.list()

    def test_real_http_guards_rate_and_private_routes(self):
        origin = self.start(); status, raw, headers = self.request(origin, '/feedback/submit', self.body)
        self.assertEqual(status, 200); self.assertNotIn('Access-Control-Allow-Origin', headers)
        public = json.loads(raw); self.assertEqual(set(public), {'receiptId', 'state', 'revision', 'message', 'updatedAt'})
        self.assertEqual(self.request(origin, '/feedback/status', {'requestId': self.body['requestId']})[0], 200)
        for path in ['/inbox.json', '/feedback/inbox.json', '/api/feedback', '/feedback/status?requestId=x']:
            self.assertEqual(self.request(origin, path)[0], 404)
        self.assertEqual(self.request(origin, '/feedback/submit', self.body, {'Content-Type':'application/json','Origin':'http://evil.invalid'})[0], 403)
        self.assertEqual(self.request(origin, '/feedback/submit', self.body, {'Content-Type':'text/plain'})[0], 415)
        self.assertEqual(self.request(origin, '/feedback/status', b'{"requestId":1,"requestId":2}')[0], 400)
        for _ in range(20): last = self.request(origin, '/feedback/status', {'requestId': self.body['requestId']})
        self.assertEqual(last[0], 429)
        disabled = self.start(False)
        for method in ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']: self.assertEqual(self.request(disabled, '/feedback/submit', self.body, method=method)[0], 405)
        self.assertEqual(self.request(origin, '/feedback/submit', self.body, method='PUT')[0], 405)

    def test_admin_auth_expiry_origin_stale_and_public_status(self):
        clock = [1000.0]
        store = admin.Store(self.root / 'account', True, initial_password='synthetic-fixture-password', clock=lambda: clock[0]); self.addCleanup(store.close)
        store.configure_feedback(self.inbox.root)
        server = admin.Server(('127.0.0.1', 0), store); threading.Thread(target=server.serve_forever, daemon=True).start(); self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        url = server.origin; rid = self.inbox.submit(self.body)['receiptId']; base = '/api/feedback/' + rid
        self.assertEqual(self.request(url, base)[0], 401)
        token = json.loads(self.request(url, '/api/login', {'account':'qcu-admin','password':'synthetic-fixture-password'}, {'Content-Type':'application/vnd.qcu.submission+json','Origin':url})[1])['token']
        headers = {'Content-Type':'application/vnd.qcu.submission+json','Origin':url,'Authorization':'Bearer '+token}
        self.assertEqual(self.request(url, base, headers=headers)[0], 200)
        change = {'revision':1,'state':'resolved','message':'已修正合成界面，请自行复核'}
        self.assertEqual(self.request(url, base + '/status', change, headers)[0], 200)
        self.assertEqual(self.request(url, base + '/status', change, headers)[0], 409)
        self.assertEqual(self.inbox.status({'requestId':self.body['requestId']})['state'], 'resolved')
        self.assertEqual(self.request(url, base + '/status', change, dict(headers, Origin='http://evil.invalid'))[0], 403)
        clock[0] += admin.SESSION_TTL + 1
        self.assertEqual(self.request(url, base + '/status', dict(change, revision=2), headers)[0], 401)
        self.assertEqual(self.inbox.detail(rid)['revision'], 2)

    def test_synthetic_backup_restore_rehearsal(self):
        import shutil
        rid = self.inbox.submit(self.body)['receiptId']; restored = self.root / 'restored'
        # Copy only this explicitly synthetic inbox while no request is running.
        with self.inbox.transaction(): shutil.copytree(self.inbox.root, restored)
        box = feedback.Inbox(restored); self.addCleanup(box.close)
        self.assertEqual(box.detail(rid)['payload'], self.body)
        box.update(rid, {'revision':1,'state':'in-progress','message':''})
        self.assertEqual(self.inbox.detail(rid)['revision'], 1)

    def test_stopped_synthetic_account_backup_restore_and_reauthorization(self):
        import shutil
        original = admin.Store(self.root / 'account', True, initial_password='synthetic-backup-password')
        original.close()
        shutil.copytree(self.root / 'account', self.root / 'restored-account')
        restored = admin.Store(self.root / 'restored-account'); self.addCleanup(restored.close)
        token = restored.login({'account':'qcu-admin', 'password':'synthetic-backup-password'})['token']
        self.assertEqual(restored.principal('Bearer ' + token), 'qcu-admin')
        self.assertEqual(restored.state['records'], {})

    def test_authority_rechecked_inside_feedback_lock_and_bounded_audit(self):
        rid = self.inbox.submit(self.body)['receiptId']
        def expired(): raise admin.Refused('auth.invalid', 401)
        with self.assertRaises(admin.Refused): self.inbox.update(rid, {'revision':1,'state':'resolved','message':''}, expired)
        self.assertEqual(self.inbox.detail(rid)['revision'], 1)
        for revision in range(1, 54): self.inbox.update(rid, {'revision':revision,'state':'in-progress','message':''})
        self.assertEqual(len(self.inbox.detail(rid)['audit']), 50)
        self.assertNotIn('127.0.0.1', (self.inbox.root / 'inbox.json').read_text())

if __name__ == '__main__': unittest.main()
