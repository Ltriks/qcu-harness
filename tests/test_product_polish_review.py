import concurrent.futures
import contextlib
import copy
import fcntl
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import re
import threading
import time
import unittest
from test_product_polish_feedback import FeedbackTests, feedback, admin, payload


def hold_lock(path, ready, release):
    with open(path, 'r+b') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        ready.set()
        release.wait(8)
        fcntl.flock(f, fcntl.LOCK_UN)


class ParentReviewTests(FeedbackTests):
    # Inherit helpers and the original eight affected regressions.
    def holder(self, path):
        ctx = multiprocessing.get_context('fork')
        ready, release = ctx.Event(), ctx.Event()
        child = ctx.Process(target=hold_lock, args=(path, ready, release)); child.start()
        self.assertTrue(ready.wait(3))
        def stop():
            release.set(); child.join(3)
            if child.is_alive(): child.terminate(); child.join()
        self.addCleanup(stop)
        return release

    def test_whole_preview_hash_and_unicode_agree(self):
        b = payload()
        for delta in [dict(category='other'), dict(title='新标题'), dict(knownVersions=dict(b['knownVersions'], runtime='0.2.0-rc.2'))]:
            with self.assertRaises(feedback.Refused) as caught: self.inbox.submit(dict(b, **delta))
            self.assertEqual(caught.exception.code, 'feedback.preview')
        b['title'] = '中文😀 e\u0301\t匿名'
        b['previewSha256'] = hashlib.sha256(feedback.encoded({k:b[k] for k in ('category','title','steps','expected','actual','knownVersions','text')})).hexdigest()
        self.assertEqual(self.inbox.submit(b)['state'], 'received')
        with self.assertRaises(feedback.Refused): self.inbox.submit(dict(b, title='\ud800'))

    def test_real_flock_wait_is_bounded_no_commit(self):
        origin = self.start(); release = self.holder(self.inbox.root / 'inbox.lock')
        before = time.monotonic(); status, raw, _ = self.request(origin, '/feedback/submit', self.body)
        elapsed = time.monotonic() - before
        self.assertEqual(status, 503); self.assertEqual(json.loads(raw)['error'], 'feedback.store-busy')
        self.assertGreaterEqual(elapsed, .9); self.assertLess(elapsed, 1.8)
        release.set(); time.sleep(.05); self.assertEqual(self.inbox.list(), [])

    def test_real_wait_and_read_recheck_expired_login_for_list_detail_update(self):
        clock = [1000.0]
        store = admin.Store(self.root / 'account', True, initial_password='synthetic-review-password', clock=lambda:clock[0]); self.addCleanup(store.close)
        store.configure_feedback(self.inbox.root)
        server = admin.Server(('127.0.0.1',0),store); threading.Thread(target=server.serve_forever,daemon=True).start(); self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        rid = self.inbox.submit(self.body)['receiptId']
        original = store.feedback.transaction
        for suffix, body in [('',None),('/'+rid,None),('/'+rid+'/status',{'revision':1,'state':'resolved','message':''})]:
            token = store.login({'account':'qcu-admin','password':'synthetic-review-password'})['token']
            release = self.holder(self.inbox.root / 'inbox.lock'); entered = threading.Event()
            @contextlib.contextmanager
            def observed():
                entered.set()
                with original(): yield
            store.feedback.transaction = observed
            headers = {'Authorization':'Bearer '+token, 'Origin':server.origin, 'Content-Type':'application/vnd.qcu.submission+json'}
            with concurrent.futures.ThreadPoolExecutor(1) as pool:
                future = pool.submit(self.request, server.origin, '/api/feedback'+suffix, body, headers)
                self.assertTrue(entered.wait(2))
                clock[0] += admin.SESSION_TTL + 1
                release.set()
                status, raw, _ = future.result(3)
            self.assertEqual(status,401,(suffix,raw))
            self.assertNotIn(self.body['title'].encode(), raw)
            self.assertEqual(self.inbox.detail(rid)['revision'],1)
        store.feedback.transaction = original
        # Expiry while reading, after the lock is already acquired, also refuses disclosure.
        token = store.login({'account':'qcu-admin','password':'synthetic-review-password'})['token']
        read = store.feedback.read
        def expire_after_read():
            result = read(); clock[0] += admin.SESSION_TTL + 1; return result
        store.feedback.read = expire_after_read
        self.assertEqual(self.request(server.origin,'/api/feedback',headers={'Authorization':'Bearer '+token})[0],401)

    def test_corrupt_restart_timestamp_audit_and_machine_independent_root(self):
        rid = self.inbox.submit(self.body)['receiptId']
        self.inbox.update(rid, {'revision':1,'state':'in-progress','message':''})
        path = self.inbox.root / 'inbox.json'; good = path.read_bytes()
        for mutate in [lambda r:r.update(updatedAt='private/path'), lambda r:r['audit'][0].update(actor='other'), lambda r:r['audit'][0].update(revision=99), lambda r:r['audit'][0].update(state='resolved'), lambda r:r['audit'].append(dict(r['audit'][0]))]:
            value = json.loads(good); mutate(value['records'][rid]); path.write_bytes(feedback.encoded(value))
            with self.assertRaises(feedback.Refused): feedback.Inbox(self.inbox.root)
        path.write_bytes(good)
        self.assertNotIn('/Users/mcq/Repos', Path(feedback.__file__).read_text())

    def test_public_encoded_and_private_paths_disclose_no_text(self):
        origin = self.start(); self.inbox.submit(self.body)
        for path in ['/feedback/../inbox.json','/feedback/%2e%2e/inbox.json','/feedback/status%3frequestId=x','/api/feedback/'+feedback.receipt_id(self.body['requestId']),'/feedback/inbox.lock']:
            status, raw, _ = self.request(origin,path)
            self.assertNotEqual(status,200); self.assertNotIn(self.body['title'].encode(),raw)

    def test_privacy_filter_preserves_email_url_and_credential_rejections(self):
        private = ['a@b.co', '教师+匿名@例子.edu', '.@a.co', 'prefix user+tag@example.org suffix',
                   'https://example.invalid/?token=synthetic', 'HTTP://example.invalid/#KEY=synthetic',
                   'https://example.invalid/docx/synthetic', 'https://x.invalid/http://y.invalid/wiki/synthetic',
                   'https://example.invalid/sheets/synthetic', 'https://example.invalid/base/synthetic',
                   '/home/synthetic/private', 'C:\\Users\\synthetic', 'Basic c3ludGhldGlj',
                   'eyJsynthetic.synthetic.synthetic', '-----BEGIN SYNTHETIC PRIVATE KEY',
                   'ghp_' + 's' * 16, 'refresh_token: synthetic', '密码：合成秘密']
        for value in private:
            with self.subTest(value=value), self.assertRaises(feedback.Refused) as caught:
                feedback.text(value, 6000)
            self.assertEqual(caught.exception.code, 'feedback.sensitive')
        # Preserve the old substring semantics, including Unicode local-parts and
        # nested URL text; only the scan strategy changes.
        previous = re.compile(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?://[^\s]*(?:[?&#](?:token|code|state|key)=|/(?:docx|wiki|sheets|base)/)', re.I)
        for value in private[:10] + ['@a.co', 'a@b.c', 'a@', 'https://example.invalid/help', '匿名问题', 'a' * 5999 + '@']:
            actual = bool(feedback.EMAIL.search(value) or any(feedback.PRIVATE_URL.search(m.group()) for m in feedback.URL.finditer(value)))
            self.assertEqual(actual, bool(previous.search(value)))

    def test_maximum_valid_text_batch_has_bounded_validation_cost(self):
        timings = {}
        for label, value in [('chinese', '教' * 6000), ('ascii', 'a' * 6000),
                             ('trailing_at', 'a' * 5999 + '@'), ('repeated_url', ('http://x.invalid/' * 400)[:6000])]:
            before = time.perf_counter()
            for _ in range(20): self.assertEqual(feedback.text(value, 6000), value)
            timings[label] = time.perf_counter() - before
        self.assertLess(sum(timings.values()), 1.5, timings)
        print('PRIVACY-PERF ' + json.dumps({'validationsPerInput': 20, 'charactersPerInput': 6000, 'seconds': timings, 'combinedSeconds': sum(timings.values()), 'budgetSeconds': 1.5}, sort_keys=True))


del FeedbackTests

if __name__ == '__main__': unittest.main()
