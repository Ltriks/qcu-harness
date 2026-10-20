"""Private loopback-only submission preparation. Python 3.9+, no dependencies.

Uploaded code is data. Public Hub and marketplace are deliberately independent.
"""
import argparse
import base64
import binascii
import copy
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import stat
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPO = Path(__file__).absolute().parents[2]
spec = importlib.util.spec_from_file_location('submission_checker', REPO / 'scripts/qcu-check-submission.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
MAX_BODY = 15 * 1048576
MAX_FILE = 1048576
MAX_JSON = 262144
MAX_TOTAL = 10 * 1048576
CHECKLIST = ('source', 'license', 'permissions', 'evidenceBoundaries')
CAVEAT = '现有市场固定目录不会自动接纳此候选；需独立目录关联发行。无安装、发布或启用授权。'


class Refused(Exception):
    def __init__(self, code='request.invalid', status=400):
        self.code, self.status = code, status


def need(condition, code, status=400):
    if not condition:
        raise Refused(code, status)


def encoded(value):
    return checker.encoded(value)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def parse(data, limit=MAX_BODY):
    """Bound nesting BEFORE json.loads, reject duplicate keys and non-JSON numbers."""
    need(len(data) <= limit, 'json.limit', 413)
    depth, string, escape = 0, False, False
    for byte in data:
        if string:
            if escape:
                escape = False
            elif byte == 92:
                escape = True
            elif byte == 34:
                string = False
        elif byte == 34:
            string = True
        elif byte in (91, 123):
            depth += 1
            need(depth <= 24, 'json.depth')
        elif byte in (93, 125):
            depth -= 1
    def pairs(rows):
        result = {}
        for key, value in rows:
            need(key not in result, 'json.duplicate')
            result[key] = value
        return result
    try:
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (UnicodeError, ValueError, RecursionError):
        raise Refused('json.invalid') from None


def preflight(envelope):
    need(type(envelope) is dict and set(envelope) == {'files'}, 'upload.envelope')
    rows = envelope['files']
    need(type(rows) is list and 0 < len(rows) <= 64, 'upload.count')
    files, total = {}, 0
    for row in rows:
        need(type(row) is dict and set(row) == {'path', 'base64'}, 'upload.member')
        name, value = row['path'], row['base64']
        need(checker.safe_path(name) and len(name.split('/')) <= 16, 'upload.path')
        need(name not in files, 'upload.duplicate')
        need(type(value) is str and len(value) <= 4 * ((MAX_FILE + 2) // 3), 'upload.size', 413)
        try:
            raw = base64.b64decode(value, validate=True)
        except (ValueError, binascii.Error):
            raise Refused('upload.base64') from None
        need(base64.b64encode(raw).decode() == value, 'upload.base64')
        need(len(raw) <= (MAX_JSON if name.lower().endswith('.json') else MAX_FILE), 'upload.size', 413)
        total += len(raw)
        need(total <= MAX_TOTAL, 'upload.total', 413)
        files[name] = raw
    # Reject case-fold aliases too: the operator's default macOS volume may be
    # case insensitive even though archive member names are case sensitive.
    names = {name.casefold() for name in files}
    need(len(names) == len(files), 'upload.collision')
    for name in names:
        parts = name.split('/')
        need(not any('/'.join(parts[:i]) in names for i in range(1, len(parts))), 'upload.collision')
    need('submission.json' in files, 'upload.submission_missing')
    return files


def inventory(files):
    return [dict(path=name, bytes=len(raw), sha256=sha(raw)) for name, raw in sorted(files.items())]


class Disk:
    """All private IO is descriptor relative, with no symlink traversal."""
    def __init__(self, root):
        self.root = Path(root)

    def directory(self, name=''):
        fd = checker.open_directory(self.root)
        try:
            for part in name.split('/') if name else []:
                new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = new
            return fd
        except BaseException:
            os.close(fd)
            raise

    def mkdir(self, name):
        parent, _, leaf = name.rpartition('/')
        fd = self.directory(parent)
        try:
            os.mkdir(leaf, 0o700, dir_fd=fd)
            os.fsync(fd)
        finally:
            os.close(fd)

    def write(self, name, raw, replace=False, mode=0o400):
        parent, _, leaf = name.rpartition('/')
        fd, temporary = self.directory(parent), '.write-' + secrets.token_hex(16)
        try:
            file_fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=fd)
            with os.fdopen(file_fd, 'wb') as file:
                file.write(raw)
                file.flush()
                os.fsync(file.fileno())
            if replace:
                # Replacing a symlink would be safe, but indicates tampering: refuse.
                info = os.stat(leaf, dir_fd=fd, follow_symlinks=False)
                need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'store.unsafe', 409)
                os.replace(temporary, leaf, src_dir_fd=fd, dst_dir_fd=fd)
            else:
                os.link(temporary, leaf, src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
                os.unlink(temporary, dir_fd=fd)
            os.fsync(fd)
        finally:
            try:
                os.unlink(temporary, dir_fd=fd)
            except FileNotFoundError:
                pass
            os.close(fd)

    def read(self, name, limit=MAX_BODY):
        fd = self.directory()
        try:
            # Checker handles each ancestor using O_NOFOLLOW, bounded regular reads.
            return checker.read_relative(fd, name, limit, 'store')
        finally:
            os.close(fd)

    def tree(self, name):
        result = {}
        directories = []
        def walk(relative, depth=0):
            need(depth <= 16, 'store.inventory', 409)
            fd = self.directory(relative)
            try:
                for entry in os.listdir(fd):
                    need(checker.safe_path(entry) and '/' not in entry, 'store.inventory', 409)
                    full = relative + '/' + entry
                    info = os.stat(entry, dir_fd=fd, follow_symlinks=False)
                    if stat.S_ISDIR(info.st_mode):
                        need(len(directories) < 1024, 'store.inventory', 409)
                        directories.append(full[len(name) + 1:])
                        walk(full, depth + 1)
                    else:
                        need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and len(result) < 64,
                             'store.inventory', 409)
                        result[full[len(name) + 1:]] = self.read(full, MAX_FILE)
            finally:
                os.close(fd)
        walk(name)
        need(all(any(file.startswith(directory + '/') for file in result) for directory in directories), 'store.inventory', 409)
        return result


def validate_root(root):
    need('..' not in Path(root).parts, 'store.root')
    root = Path(os.path.abspath(root))
    need('..' not in Path(root).parts, 'store.root')
    # Reject all known workspace/public trees, as well as any Git workspace ancestor.
    protected = [REPO, Path('/Users/mcq/Repos')]
    for other in protected:
        need(root != other and root not in other.parents and other not in root.parents, 'store.overlap')
    for parent in [root, *root.parents]:
        need(not (parent / '.git').exists(), 'store.workspace')
        need(not ((parent / 'manifest.json').exists() and (parent / 'catalog.json').exists()), 'store.public_root')
    fd = checker.open_directory(root.parent)
    os.close(fd)
    return root


class Store:
    def __init__(self, root, initialize=False):
        self.root = validate_root(root)
        self.mutex = threading.RLock()
        self.lock_fd = None
        self.healthy = True
        try:
            if initialize:
                parent_fd = checker.open_directory(self.root.parent)
                try:
                    os.mkdir(self.root.name, 0o700, dir_fd=parent_fd)  # explicit new root only
                    os.fsync(parent_fd)
                finally:
                    os.close(parent_fd)
            self.disk = Disk(self.root)
            fd = self.disk.directory()
            try:
                info = os.fstat(fd)
                need(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700, 'store.permissions')
                self.lock_fd = os.open('process.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600, dir_fd=fd)
                info = os.fstat(self.lock_fd)
                need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'store.lock')
                fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            finally:
                os.close(fd)
            if initialize:
                self.disk.mkdir('submissions')
                self.disk.mkdir('candidates')
                self.disk.write('credentials.json', encoded({role: secrets.token_urlsafe(32) for role in ('submitter', 'maintainer')}), mode=0o600)
                self.disk.write('state.json', encoded({'schemaVersion': 1, 'records': {}}), mode=0o600)
            info = (self.root / 'credentials.json').lstat()
            need(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1, 'store.credentials')
            self.credentials = parse(self.disk.read('credentials.json'), MAX_JSON)
            need(set(self.credentials) == {'submitter', 'maintainer'} and
                 all(type(t) is str and len(t) >= 40 for t in self.credentials.values()) and
                 self.credentials['submitter'] != self.credentials['maintainer'], 'store.credentials')
            self.state = parse(self.disk.read('state.json'))
            need(self.state['schemaVersion'] == 1 and type(self.state['records']) is dict, 'store.state')
            recovered = False
            for record in self.state['records'].values():
                if record['status'] in ('checking', 'preparing'):
                    record['status'] = 'recoverable-failure'
                    record['failure'] = 'interrupted.operation'
                    record['audit'].append(self.audit('recovery', 'system', record['materialsDigest'], 'Interrupted operation; inspect and submit a new revision.'))
                    recovered = True
            if recovered:
                self.save()
        except BaseException:
            self.close()
            raise

    def close(self):
        if self.lock_fd is not None:
            os.close(self.lock_fd)
            self.lock_fd = None

    def save(self):
        try:
            raw = encoded(self.state)
            need(len(raw) <= MAX_BODY, 'store.capacity', 409)
            self.disk.write('state.json', raw, replace=True, mode=0o600)
        except BaseException:
            self.healthy = False  # fail closed until an operator restarts and checks disk state
            raise

    @staticmethod
    def audit(action, actor, digest, reason, **extra):
        return dict(action=action, actor=actor, materialsDigest=digest, reason=reason, time=now(), **extra)

    def role(self, authorization):
        for role, token in self.credentials.items():
            if secrets.compare_digest(authorization, 'Bearer ' + token):
                return role
        raise Refused('auth.required', 401)

    def get(self, sid):
        need(bool(re.fullmatch(r'sub-[a-f0-9]{32}', sid)), 'record.missing', 404)
        need(sid in self.state['records'], 'record.missing', 404)
        return self.state['records'][sid]

    def verify(self, record):
        try:
            files = self.disk.tree('submissions/' + record['id'])
            rows = inventory(files)
            need(rows == record['inventory'] and sha(encoded(rows)) == record['materialsDigest'], 'materials.changed', 409)
            # All derived metadata/report must still match the admitted bytes.
            meta = self.metadata(files)
            need(meta == record['metadata'], 'materials.changed', 409)
            return files
        except (OSError, checker.Rejected):
            raise Refused('materials.changed', 409) from None

    @staticmethod
    def metadata(files):
        try:
            meta = checker.load_json(files['submission.json'], 'submission')
            return meta if type(meta) is dict else {}
        except (checker.Rejected, KeyError):
            return {}

    def upload(self, envelope):
        files = preflight(envelope)  # before any admitted writes
        rows, meta = inventory(files), self.metadata(files)
        digest = sha(encoded(rows))
        with self.mutex:
            for existing in self.state['records'].values():
                if existing['materialsDigest'] == digest:
                    self.verify(existing)
                    need(existing['status'] != 'recoverable-failure', 'record.recovery_required', 409)
                    return copy.deepcopy(existing)
            need(len(self.state['records']) < 32, 'store.capacity', 409)
            # Compare actual archive bytes, never trust a declared SHA.
            identity, arc = meta.get('id'), meta.get('archive')
            arc = arc if type(arc) is dict else {}
            arc_name = arc.get('file')
            archive_hash = sha(files[arc_name]) if type(arc_name) is str and arc_name in files else None
            if isinstance(identity, str) and checker.ID.fullmatch(identity) and checker.semver(meta.get('version')) and archive_hash:
                for old in self.state['records'].values():
                    if old['metadata'].get('id') == identity and old['metadata'].get('version') == meta['version'] and old['archiveHash']:
                        need(old['archiveHash'] == archive_hash, 'version.archive_conflict', 409)
            sid = 'sub-' + secrets.token_hex(16)
            self.disk.mkdir('submissions/' + sid)
            dirs = set()
            for name, raw in sorted(files.items()):
                parts = name.split('/')
                for i in range(1, len(parts)):
                    folder = '/'.join(parts[:i])
                    if folder not in dirs:
                        self.disk.mkdir('submissions/' + sid + '/' + folder)
                        dirs.add(folder)
                self.disk.write('submissions/' + sid + '/' + name, raw)
            record = dict(id=sid, createdAt=now(), status='checking', materialsDigest=digest,
                          inventory=rows, metadata=meta, archiveHash=archive_hash, report=None,
                          audit=[self.audit('submit', 'submitter', digest, 'Local-role submission.')], approval=None, candidate=None)
            self.state['records'][sid] = record
            self.save()
            try:
                report, _ = checker.check_submission(self.root / 'submissions' / sid / 'submission.json')
                # Scan ALL attachments too; checker references alone do not cover extras.
                scanner = checker.Checker(None)
                for name, raw in files.items():
                    scanner.scan(name.encode() + b'\n' + raw, 'upload.attachments')
                    if not name.endswith('.tgz'):
                        try:
                            scanner.member_policy(name, raw)
                        except checker.Rejected:
                            scanner.issue('upload.attachment_policy', 'upload.attachments')
                for issue in scanner.report['errors']:
                    if issue not in report['errors']:
                        report['errors'].append(issue)
                report['counts']['errors'] = len(report['errors'])
                report['staticChecksPassed'] = not (report['errors'] or report['unsupported'])
                record['report'] = report
                self.verify(record)
                record['status'] = 'in-review' if report['staticChecksPassed'] else 'needs-changes'
                self.save()
            except BaseException:
                record['status'], record['failure'] = 'recoverable-failure', 'checking.failed'
                self.save()
                raise
            return copy.deepcopy(record)

    def review(self, sid, body):
        need(type(body) is dict and set(body) == {'action', 'reason', 'materialsDigest', 'checklist'}, 'review.fields')
        need(body['action'] in ('return', 'approve'), 'review.action')
        reason = body['reason']
        need(type(reason) is str and 0 < len(reason.strip()) <= 2000 and not checker.SECRET.search(reason.encode()), 'review.reason')
        need(type(body['checklist']) is dict and set(body['checklist']) == set(CHECKLIST)
             and all(type(value) is bool for value in body['checklist'].values()), 'review.checklist')
        with self.mutex:
            record = self.get(sid)
            need(record['status'] == 'in-review' and record['materialsDigest'] == body['materialsDigest'], 'review.stale', 409)
            self.verify(record)
            if body['action'] == 'approve':
                need(all(body['checklist'].values()), 'review.checklist')
                need(record['report']['staticChecksPassed'], 'review.static_failure', 409)
            event = self.audit(body['action'], 'maintainer', record['materialsDigest'], reason.strip(), checklist=body['checklist'])
            record['audit'].append(event)
            record['approval'] = event if body['action'] == 'approve' else None
            record['status'] = 'approved' if body['action'] == 'approve' else 'needs-changes'
            self.save()
            return copy.deepcopy(record)

    def proposal(self, record):
        return dict(schemaVersion=1, status='local-candidate-not-published', marketAvailable=False,
                    catalogIntegrationRequired=True, submissionId=record['id'], materialsDigest=record['materialsDigest'],
                    metadata=record['metadata'], inventory=record['inventory'], archiveHash=record['archiveHash'],
                    checkerReportSha256=sha(encoded(record['report'])), approval=record['approval'],
                    audit=[event for event in record['audit'] if event['action'] != 'prepare'],
                    limitations=record['report']['limitations'], marketplaceCaveat=CAVEAT)

    def preview(self, sid):
        with self.mutex:
            record = self.get(sid)
            need(record['status'] in ('approved', 'release-prepared'), 'candidate.not_approved', 409)
            self.verify(record)
            proposal = self.proposal(record)
            return dict(proposal=proposal, proposalDigest=sha(encoded(proposal)))

    def candidate_files(self, record):
        candidate = record['candidate']
        need(record['status'] == 'release-prepared' and candidate is not None, 'candidate.missing', 404)
        self.verify(record)
        try:
            files = self.disk.tree('candidates/' + candidate['id'])
            need(inventory(files) == candidate['inventory'], 'candidate.changed', 409)
            return files
        except (OSError, checker.Rejected):
            raise Refused('candidate.changed', 409) from None

    def prepare(self, sid, body):
        need(type(body) is dict and set(body) == {'materialsDigest', 'proposalDigest', 'confirm'} and body['confirm'] is True, 'candidate.confirm')
        with self.mutex:
            record = self.get(sid)
            preview = self.preview(sid)
            need(body['materialsDigest'] == record['materialsDigest'] and body['proposalDigest'] == preview['proposalDigest'], 'candidate.stale', 409)
            if record['status'] == 'release-prepared':
                self.candidate_files(record)
                return copy.deepcopy(record)
            files = self.verify(record)
            record['status'] = 'preparing'
            record['audit'].append(self.audit('prepare', 'maintainer', record['materialsDigest'],
                                             'Explicit local candidate confirmation; not published.',
                                             proposalDigest=preview['proposalDigest'], result='intent'))
            self.save()
            try:
                cid = 'candidate-' + secrets.token_hex(16)
                self.disk.mkdir('candidates/' + cid)
                archive = record['metadata']['archive']['file']
                contents = {archive: files[archive], 'submission.json': files['submission.json'],
                            'materials.json': encoded(record['inventory']), 'checker-report.json': encoded(record['report']),
                            'proposal.json': encoded(dict(**preview['proposal'], proposalDigest=preview['proposalDigest']))}
                for name, raw in contents.items():
                    self.disk.write('candidates/' + cid + '/' + name, raw)
                preparation = self.audit('prepare', 'maintainer', record['materialsDigest'],
                                         'Local candidate bytes prepared; not published.',
                                         proposalDigest=preview['proposalDigest'], result='completed')
                contents['approval-audit.json'] = encoded(dict(approval=record['approval'], audit=record['audit'] + [preparation]))
                self.disk.write('candidates/' + cid + '/approval-audit.json', contents['approval-audit.json'])
                record['candidate'] = dict(id=cid, createdAt=now(), proposalDigest=preview['proposalDigest'], inventory=inventory(contents))
                record['audit'].append(preparation)
                record['status'] = 'release-prepared'
                self.save()
            except BaseException:
                record['status'], record['failure'] = 'recoverable-failure', 'preparing.failed'
                record['audit'].append(self.audit('prepare', 'maintainer', record['materialsDigest'],
                                                 'Candidate operation failed; inspect private state before resubmitting.',
                                                 proposalDigest=preview['proposalDigest'], result='failed'))
                self.save()
                raise
            return copy.deepcopy(record)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, address, store):
        need(address[0] == '127.0.0.1', 'server.loopback_only')
        self.store = store
        super().__init__(address, Handler)
        self.origin = 'http://127.0.0.1:' + str(self.server_address[1])
        self.host = '127.0.0.1:' + str(self.server_address[1])

    def handle_error(self, request, client_address):
        pass  # no request, exception path or secret logging


class Handler(BaseHTTPRequestHandler):
    server_version = 'QCU-Local'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *_):
        pass

    def send_error(self, code, message=None, explain=None):
        self.reply(code, encoded({'error': 'http.invalid'}))

    def reply(self, code, raw, content_type='application/json; charset=utf-8', attachment=None):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
        self.send_header('Connection', 'close')
        if attachment:
            self.send_header('Content-Disposition', 'attachment; filename="' + attachment + '"')
        self.end_headers()
        self.close_connection = True
        if self.command != 'HEAD':
            self.wfile.write(raw)

    def one(self, name, required=True):
        values = self.headers.get_all(name, [])
        need(len(values) == 1 if required else len(values) <= 1, 'http.headers')
        return values[0] if values else ''

    def dispatch(self):
        try:
            need(self.one('Host') == self.server.host, 'http.host', 403)
            need(self.command in ('GET', 'HEAD', 'POST'), 'http.method', 405)
            need(not self.headers.get_all('Transfer-Encoding'), 'http.transfer_encoding')
            if self.command == 'POST':
                need(self.one('Origin') == self.server.origin, 'http.origin', 403)
                need(self.one('Content-Type') == 'application/vnd.qcu.submission+json', 'http.content_type', 415)
                length = self.one('Content-Length')
                need(bool(re.fullmatch(r'[1-9][0-9]{0,7}', length)), 'http.length')
                need(int(length) <= MAX_BODY, 'http.length', 413)
            else:
                need(not self.one('Content-Length', False) or self.one('Content-Length') == '0', 'http.length')
            need('?' not in self.path and '%' not in self.path and '#' not in self.path, 'http.route', 404)
            static = {'/': ('index.html', 'text/html; charset=utf-8'), '/app.js': ('app.js', 'text/javascript; charset=utf-8'), '/style.css': ('style.css', 'text/css; charset=utf-8')}
            if self.path in static and self.command in ('GET', 'HEAD'):
                name, mime = static[self.path]
                return self.reply(200, (Path(__file__).parent / 'static' / name).read_bytes(), mime)
            role = self.server.store.role(self.one('Authorization', False))
            store = self.server.store
            need(store.healthy, 'store.recovery_required', 409)
            if self.command == 'POST':
                deadline, chunks, remaining = time.monotonic() + 10, [], int(length)
                while remaining:
                    timeout = deadline - time.monotonic()
                    need(timeout > 0, 'http.timeout', 408)
                    self.connection.settimeout(min(5, timeout))
                    chunk = self.rfile.read1(min(65536, remaining))
                    need(bool(chunk), 'http.length')
                    chunks.append(chunk)
                    remaining -= len(chunk)
                raw = b''.join(chunks)
                body = parse(raw)
            with store.mutex:
                value = None
                if self.path == '/api/session' and self.command == 'GET':
                    value = {'role': role}
                elif self.path == '/api/submissions' and self.command == 'GET':
                    value = list(store.state['records'].values())
                elif self.path == '/api/submissions' and self.command == 'POST':
                    need(role == 'submitter', 'auth.role', 403)
                    value = store.upload(body)
                else:
                    parts = self.path.split('/')
                    need(len(parts) >= 4 and parts[1:3] == ['api', 'submissions'], 'http.route', 404)
                    record = store.get(parts[3])
                    if len(parts) == 4 and self.command == 'GET':
                        value = record
                    else:
                        need(role == 'maintainer', 'auth.role', 403)
                        action = parts[4] if len(parts) >= 5 else ''
                        if len(parts) == 5 and self.command == 'POST' and action == 'review':
                            value = store.review(record['id'], body)
                        elif len(parts) == 5 and self.command == 'POST' and action == 'prepare':
                            value = store.prepare(record['id'], body)
                        elif len(parts) == 5 and self.command == 'GET' and action == 'preview':
                            value = store.preview(record['id'])
                        elif len(parts) == 5 and self.command == 'GET' and action == 'report':
                            store.verify(record)
                            return self.reply(200, encoded(display_value(record['report'])), attachment='checker-report.json')
                        elif len(parts) == 6 and self.command == 'GET' and action in ('materials', 'candidate'):
                            need(bool(re.fullmatch(r'0|[1-9][0-9]?', parts[5])), 'download.missing', 404)
                            index = int(parts[5])
                            rows = record['inventory'] if action == 'materials' else (record['candidate'] or {}).get('inventory', [])
                            need(index < len(rows), 'download.missing', 404)
                            files = store.verify(record) if action == 'materials' else store.candidate_files(record)
                            name = rows[index]['path']
                            return self.reply(200, files[name], 'application/octet-stream', 'material-' + str(index) + ('.tgz' if name.endswith('.tgz') else '.bin'))
                        else:
                            raise Refused('http.route', 404)
                return self.reply(200, encoded(display_value(value)))
        except Refused as error:
            self.reply(error.status, encoded({'error': error.code}))
        except (TimeoutError, OSError, checker.Rejected, ValueError, KeyError, TypeError):
            self.reply(409, encoded({'error': 'operation.refused'}))

    do_GET = dispatch
    do_HEAD = dispatch
    do_POST = dispatch
    do_PUT = dispatch
    do_DELETE = dispatch
    do_OPTIONS = dispatch
    do_PATCH = dispatch


def display_value(value):
    """Never reflect secret-pattern bytes in JSON diagnostics or metadata views.

    Authorized attachment downloads intentionally preserve original bytes.
    """
    if isinstance(value, str):
        return checker.SECRET.sub(b'[redacted]', value.encode()).decode()
    if isinstance(value, list):
        return [display_value(item) for item in value]
    if isinstance(value, dict):
        return {display_value(key): display_value(item) for key, item in value.items()}
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-root', required=True, type=Path)
    parser.add_argument('--init', action='store_true', help='Create a NEW private state root')
    parser.add_argument('--bind', default='127.0.0.1', choices=['127.0.0.1'])
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    store = server = None
    try:
        store = Store(args.state_root, args.init)
        server = Server((args.bind, args.port), store)
        print('Private credentials file: ' + str(store.root / 'credentials.json'), flush=True)
        print('Local preparation only: ' + server.origin, flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    except (Refused, checker.Rejected, OSError, ValueError, KeyError, TypeError):
        print('startup.refused', flush=True)
        return 2
    finally:
        if server:
            server.server_close()
        if store:
            store.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
