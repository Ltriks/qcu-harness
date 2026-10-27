"""P16 opt-in private feedback inbox. No admin/auth/key imports or default paths."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import threading
import time
from datetime import datetime, timezone

LIMIT = 16384
CAPACITY = 500
STATE_LIMIT = 8 * 1048576
REQUEST = re.compile(r'^[a-f0-9]{64}$')
STATES = ('received', 'in-progress', 'resolved')
SECRET = re.compile(r'\b(?:sk(?:-proj|-ant)?-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|Bearer\s+[A-Za-z0-9._~+/=-]+|Basic\s+[A-Za-z0-9+/=]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)|-----BEGIN .*PRIVATE KEY|/(?:Users|home)/[^\s]+|[A-Z]:[\\/]Users[\\/]', re.I)
# A one-character lookbehind preserves the old substring email check without
# retrying a greedy local-part at every character of long ordinary text.
EMAIL = re.compile(r'(?<=[\w.+-])@[\w.-]+\.[A-Za-z]{2,}', re.I)
URL = re.compile(r'https?://[^\s]*', re.I)
PRIVATE_URL = re.compile(r'[?&#](?:token|code|state|key)=|/(?:docx|wiki|sheets|base)/', re.I)
CREDENTIAL = re.compile(r'(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|token|authorization|auth|password|密码|密钥)\s*[=:：]\s*([^\n,;，；]+)', re.I)


class Refused(Exception):
    def __init__(self, code='feedback.invalid', status=400):
        self.code, self.status = code, status


def need(value, code='feedback.invalid', status=400):
    if not value:
        raise Refused(code, status)


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def parse(raw, limit=LIMIT):
    need(len(raw) <= limit, 'feedback.limit', 413)
    depth, quoted, escape = 0, False, False
    for b in raw:
        if quoted:
            if escape: escape = False
            elif b == 92: escape = True
            elif b == 34: quoted = False
        elif b == 34: quoted = True
        elif b in (91, 123):
            depth += 1
            need(depth <= 8, 'feedback.depth')
        elif b in (93, 125): depth -= 1
    def pairs(rows):
        out = {}
        for k, v in rows:
            need(k not in out, 'feedback.duplicate')
            out[k] = v
        return out
    try:
        return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (UnicodeError, ValueError, RecursionError):
        raise Refused() from None


def fields(body, names):
    need(type(body) is dict and set(body) == set(names.split()))


def text(value, maximum, empty=False):
    need(type(value) is str and (empty or bool(value.strip())) and len(value) <= maximum)
    need(not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', value))
    try: value.encode('utf-8')
    except UnicodeError: raise Refused() from None
    need(not SECRET.search(value)
         and not EMAIL.search(value)
         and not any(PRIVATE_URL.search(m.group()) for m in URL.finditer(value))
         and not any(not m.group(1).lstrip(" \t\"'").startswith('[授权值已移除]') for m in CREDENTIAL.finditer(value)), 'feedback.sensitive')
    return value


def receipt_id(request_id):
    need(type(request_id) is str and bool(REQUEST.fullmatch(request_id)), 'feedback.missing', 404)
    return hashlib.sha256(('QCU-FEEDBACK/V1:' + request_id).encode()).hexdigest()


def submission(body):
    fields(body, 'requestId category title steps expected actual knownVersions text previewSha256 confirmed')
    receipt_id(body['requestId'])
    need(body['category'] in ('ui', 'install', 'model', 'other'))
    for k, cap in [('title', 160), ('steps', 1200), ('expected', 600), ('actual', 600), ('text', 6000)]: text(body[k], cap)
    fields(body['knownVersions'], 'market runtime')
    for value in body['knownVersions'].values():
        need(type(value) is str and bool(re.fullmatch(r'[a-zA-Z0-9.-]{1,80}', value)))
    preview = {k: body[k] for k in ('category', 'title', 'steps', 'expected', 'actual', 'knownVersions', 'text')}
    need(body['confirmed'] is True and body['previewSha256'] == hashlib.sha256(encoded(preview)).hexdigest(), 'feedback.preview')
    need(len(encoded(body)) <= LIMIT, 'feedback.limit', 413)
    return body


def timestamp_text(value):
    need(type(value) is str and bool(re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?\+00:00', value)), 'feedback.corrupt', 409)
    try: return datetime.fromisoformat(value)
    except ValueError: raise Refused('feedback.corrupt', 409) from None


def directory(path):
    path = Path(path)
    need(path.is_absolute() and '..' not in path.parts, 'feedback.root')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:]:
            new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd); fd = new
        return fd
    except BaseException:
        os.close(fd); raise


def validate_root(root, protected=()):
    root = Path(root)
    need(root.is_absolute() and '..' not in root.parts, 'feedback.root')
    repo = Path(__file__).absolute().parents[1]
    for other in [repo, *map(Path, protected)]:
        need(root != other and root not in other.parents and other not in root.parents, 'feedback.overlap')
    # Detect known account, signing and public trees; never open their files.
    for p in [root, *root.parents]:
        need(not any((p / n).exists() for n in ('.git', 'admin-auth.json', 'signing.key', 'current.json', 'manifest.json')), 'feedback.overlap')
    return root


class Inbox:
    def __init__(self, root, *, initialize=False, protected=(), clock=time.time, lock_wait=1.0):
        self.root = validate_root(root, protected)
        need(type(lock_wait) in (int, float) and 0 < lock_wait <= 1, 'feedback.configuration')
        self.clock, self.mutex, self.lock_wait = clock, threading.RLock(), lock_wait
        if initialize:
            fd = directory(self.root.parent)
            try: os.mkdir(self.root.name, 0o700, dir_fd=fd); os.fsync(fd)
            finally: os.close(fd)
        self.fd = directory(self.root)
        try:
            info = os.fstat(self.fd)
            need(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700, 'feedback.permissions')
            self.lock = os.open('inbox.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600, dir_fd=self.fd)
            self.check(os.fstat(self.lock))
            with self.transaction():
                if initialize: self.write({'schema': 1, 'records': {}})
                self.read()
        except BaseException:
            self.close(); raise

    def close(self):
        for key in ('lock', 'fd'):
            if getattr(self, key, None) is not None:
                os.close(getattr(self, key)); setattr(self, key, None)

    @staticmethod
    def check(s):
        need(stat.S_ISREG(s.st_mode) and s.st_uid == os.getuid() and s.st_nlink == 1 and stat.S_IMODE(s.st_mode) == 0o600, 'feedback.permissions')

    @contextlib.contextmanager
    def transaction(self):
        deadline = time.monotonic() + self.lock_wait
        need(self.mutex.acquire(timeout=self.lock_wait), 'feedback.store-busy', 503)
        locked = False
        try:
            while not locked:
                try:
                    fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    locked = True
                except BlockingIOError:
                    need(time.monotonic() < deadline, 'feedback.store-busy', 503)
                    time.sleep(min(0.01, max(0, deadline - time.monotonic())))
            yield
        finally:
            if locked: fcntl.flock(self.lock, fcntl.LOCK_UN)
            self.mutex.release()

    def read(self):
        fd = os.open('inbox.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=self.fd)
        try:
            self.check(os.fstat(fd)); raw = os.read(fd, STATE_LIMIT + 1)
        finally: os.close(fd)
        value = parse(raw, STATE_LIMIT)
        fields(value, 'schema records')
        need(value['schema'] == 1 and type(value['records']) is dict and len(value['records']) <= CAPACITY, 'feedback.corrupt', 409)
        for rid, record in value['records'].items():
            fields(record, 'receiptId payload digest state updatedAt revision message audit')
            need(rid == record['receiptId'] == receipt_id(record['payload']['requestId']), 'feedback.corrupt', 409)
            submission(record['payload'])
            need(record['digest'] == hashlib.sha256(encoded(record['payload'])).hexdigest() and record['state'] in STATES and type(record['revision']) is int and record['revision'] > 0 and type(record['audit']) is list and len(record['audit']) <= 50, 'feedback.corrupt', 409)
            timestamp_text(record['updatedAt'])
            text(record['message'], 300, True)
            need(len(record['audit']) == min(record['revision'] - 1, 50), 'feedback.corrupt', 409)
            previous_time = None
            for index, event in enumerate(record['audit']):
                fields(event, 'state time revision actor')
                need(event['state'] in STATES and event['actor'] == 'qcu-admin' and type(event['revision']) is int and 1 < event['revision'] <= record['revision'], 'feedback.corrupt', 409)
                event_time = timestamp_text(event['time'])
                need(event['revision'] == record['revision'] - len(record['audit']) + index + 1 and (previous_time is None or event_time >= previous_time), 'feedback.corrupt', 409)
                previous_time = event_time
            if record['audit']:
                last = record['audit'][-1]
                need(last['state'] == record['state'] and last['revision'] == record['revision'] and last['time'] == record['updatedAt'], 'feedback.corrupt', 409)
            else:
                need(record['state'] == 'received' and record['message'] == '', 'feedback.corrupt', 409)
        return value

    def write(self, state):
        raw = encoded(state); need(len(raw) <= STATE_LIMIT, 'feedback.capacity', 507)
        temp = '.pending-' + secrets.token_hex(16)
        try:
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.fd)
            with os.fdopen(fd, 'wb') as f: f.write(raw); f.flush(); os.fsync(f.fileno())
            try: self.check(os.stat('inbox.json', dir_fd=self.fd, follow_symlinks=False))
            except FileNotFoundError: pass
            os.replace(temp, 'inbox.json', src_dir_fd=self.fd, dst_dir_fd=self.fd); os.fsync(self.fd)
        finally:
            try: os.unlink(temp, dir_fd=self.fd)
            except FileNotFoundError: pass

    def timestamp(self): return datetime.fromtimestamp(self.clock(), timezone.utc).isoformat()

    @staticmethod
    def public(record):
        return {k: record[k] for k in ('receiptId', 'state', 'updatedAt', 'revision', 'message')}

    def submit(self, body):
        body = submission(body); rid = receipt_id(body['requestId']); digest = hashlib.sha256(encoded(body)).hexdigest()
        with self.transaction():
            state = self.read(); old = state['records'].get(rid)
            if old:
                need(old['digest'] == digest, 'feedback.conflict', 409); return self.public(old)
            need(len(state['records']) < CAPACITY, 'feedback.capacity', 507)
            record = dict(receiptId=rid, payload=body, digest=digest, state='received', updatedAt=self.timestamp(), revision=1, message='', audit=[])
            state['records'][rid] = record; self.write(state); return self.public(record)

    def status(self, body):
        try: fields(body, 'requestId'); rid = receipt_id(body['requestId'])
        except (Refused, KeyError, TypeError): raise Refused('feedback.missing', 404) from None
        with self.transaction():
            record = self.read()['records'].get(rid); need(record is not None, 'feedback.missing', 404)
            return self.public(record)

    def list(self, authorize=lambda: None):
        with self.transaction():
            state = self.read(); authorize()
            return [dict(self.public(r), title=r['payload']['title'], category=r['payload']['category']) for r in state['records'].values()]

    def detail(self, rid, authorize=lambda: None):
        need(bool(REQUEST.fullmatch(rid)), 'feedback.missing', 404)
        with self.transaction():
            r = self.read()['records'].get(rid); authorize(); need(r is not None, 'feedback.missing', 404); return r

    def update(self, rid, body, authorize=lambda: None):
        fields(body, 'revision state message')
        need(type(body['revision']) is int and body['state'] in STATES); text(body['message'], 300, True)
        with self.transaction():
            authorize()
            state = self.read(); r = state['records'].get(rid); need(r is not None, 'feedback.missing', 404)
            need(body['revision'] == r['revision'], 'feedback.stale', 409)
            updated = max(timestamp_text(r['updatedAt']), datetime.fromtimestamp(self.clock(), timezone.utc)).isoformat()
            authorize()
            r.update(state=body['state'], message=body['message'], revision=r['revision'] + 1, updatedAt=updated)
            r['audit'] = (r['audit'] + [dict(state=r['state'], time=r['updatedAt'], revision=r['revision'], actor='qcu-admin')])[-50:]
            self.write(state); return self.public(r)


class Receiver:
    def __init__(self, inbox, clock=time.monotonic): self.inbox, self.clock, self.peers, self.mutex = inbox, clock, {}, threading.Lock()
    def accept(self, handler, origin):
        try:
            need(handler.path in ('/feedback/submit', '/feedback/status'), 'feedback.route', 404)
            need(handler.headers.get_all('Host') == [origin.removeprefix('http://')], 'feedback.host', 403)
            origins = handler.headers.get_all('Origin', [])
            need(not origins or origins == [origin], 'feedback.origin', 403)
            need(handler.headers.get_all('Content-Type') == ['application/json'], 'feedback.content_type', 415)
            need(not handler.headers.get_all('Transfer-Encoding'), 'feedback.length')
            lengths = handler.headers.get_all('Content-Length', [])
            need(len(lengths) == 1 and bool(re.fullmatch('[1-9][0-9]{0,4}', lengths[0])), 'feedback.length')
            size = int(lengths[0]); need(size <= LIMIT, 'feedback.limit', 413)
            with self.mutex:
                now = self.clock(); self.peers = {k: v for k, v in self.peers.items() if now - v[0] < 60}
                peer = handler.client_address[0]; since, count = self.peers.get(peer, (now, 0))
                need(count < 20 and (peer in self.peers or len(self.peers) < 1024), 'feedback.rate', 429)
                self.peers[peer] = (since, count + 1)
            deadline, chunks = time.monotonic() + 5, []
            while size:
                remaining = deadline - time.monotonic(); need(remaining > 0, 'feedback.timeout', 408)
                handler.connection.settimeout(min(remaining, 2))
                chunk = handler.rfile.read1(min(size, LIMIT)); need(bool(chunk), 'feedback.length'); chunks.append(chunk); size -= len(chunk)
            body = parse(b''.join(chunks))
            result = self.inbox.submit(body) if handler.path == '/feedback/submit' else self.inbox.status(body)
            self.reply(handler, 200, result)
        except Refused as e: self.reply(handler, e.status, {'error': e.code})
        except (OSError, ValueError, KeyError, TypeError): self.reply(handler, 503, {'error': 'feedback.unavailable'})
    @staticmethod
    def reply(handler, status, value):
        raw = encoded(value); handler.send_response(status)
        for k, v in [('Content-Type', 'application/json; charset=utf-8'), ('Content-Length', str(len(raw))), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('Connection', 'close')]: handler.send_header(k, v)
        handler.end_headers(); handler.close_connection = True; handler.wfile.write(raw)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--feedback-root', required=True, type=Path); parser.add_argument('--init', action='store_true')
    args = parser.parse_args()
    box = Inbox(args.feedback_root, initialize=args.init); box.close(); print('{"feedbackRootValidated":true}')
