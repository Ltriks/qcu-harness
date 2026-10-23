"""P15 immutable signed publication. Private audit stays in the administrator store.

Only trusted operator configuration selects Node, key root, public root or origin.
"""
import base64
import copy
import fcntl
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tarfile
import time
import urllib.request
import urllib.error


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


class Publication:
    def __init__(self, store, api, public_root, trust, node, *, initialize=False, test=False, fault=lambda _: None):
        self.store, self.api, self.trust, self.node, self.test, self.fault = store, api, trust, str(node), test, fault
        api.need(Path(node).is_absolute() and Path(node).is_file(), 'publication.node_required')
        self.root = api.validate_root(public_root)
        api.need(self.root != store.root and self.root not in store.root.parents and store.root not in self.root.parents, 'publication.overlap')
        api.need(trust.get('origin') == 'http://192.168.1.68:8080' or test and re.fullmatch(r'http://127\.0\.0\.1:[1-9][0-9]{0,4}', trust.get('origin', '')), 'publication.origin')
        self.crypto('configuration', root=str(self.store.root / 'signing'))
        if initialize:
            parent = api.checker.open_directory(self.root.parent)
            try:
                os.mkdir(self.root.name, 0o700, dir_fd=parent)
                os.fsync(parent)
            finally:
                os.close(parent)
        self.disk = api.Disk(self.root)
        fd = self.disk.directory()
        try:
            info = os.fstat(fd)
            api.need(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700, 'publication.permissions')
            self.lock = os.open('publisher.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600, dir_fd=fd)
            info = os.fstat(self.lock)
            api.need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o600, 'publication.lock')
            try:
                fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BaseException:
                os.close(self.lock)
                self.lock = None
                raise
        finally:
            os.close(fd)
        if initialize:
            for name in ('snapshots', 'archives'):
                self.disk.mkdir(name)
            self.disk.write('current.json', canonical(dict(revision=0, digest=None, snapshot=None)))
            store.disk.mkdir('publications')
        try:
            self.reconcile()
        except BaseException:
            self.close()
            raise

    def close(self):
        if getattr(self, 'lock', None) is not None:
            os.close(self.lock)
            self.lock = None

    def crypto(self, action, **values):
        api = self.api
        body = canonical(dict(trust=self.trust, test=self.test, **values))
        api.need(len(body) <= 1048576, 'publication.crypto_size')
        try:
            result = subprocess.run([self.node, str(api.REPO / 'scripts/qcu-market-sign.mjs'), action], input=body,
                                    capture_output=True, timeout=10, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}, cwd='/')
            api.need(result.returncode == 0 and len(result.stdout) <= 1048576 and len(result.stderr) <= 1024, 'publication.crypto_failed', 409)
            return api.parse(result.stdout, 1048576)
        except (subprocess.SubprocessError, OSError):
            raise api.Refused('publication.crypto_failed', 409) from None

    def pointer(self):
        p = self.api.parse(self.disk.read('current.json', 2048), 2048)
        self.api.need(type(p) is dict and set(p) == {'revision', 'digest', 'snapshot'} and type(p['revision']) is int and p['revision'] >= 0, 'publication.pointer', 409)
        if p['revision']:
            self.api.need(re.fullmatch(r'[a-f0-9]{64}', p['digest'] or '') and p['snapshot'] == str(p['revision']) + '-' + p['digest'], 'publication.pointer', 409)
        else:
            self.api.need(p['digest'] is None and p['snapshot'] is None, 'publication.pointer', 409)
        return p

    def snapshot(self, pointer=None):
        p = self.pointer() if pointer is None else pointer
        if not p['revision']:
            return dict(entries=[], withdrawn=[]), None
        raw = self.disk.read('snapshots/' + p['snapshot'] + '/catalog.signed.json', 524288)
        verified = self.crypto('verify', raw=base64.b64encode(raw).decode(), allowExpired=True)
        self.api.need(verified['fingerprint'] == p['digest'] and verified['payload']['revision'] == p['revision'], 'publication.pointer_mismatch', 409)
        return verified['payload'], raw

    def reconcile(self):
        # Pointer is commit truth, even if private bookkeeping was interrupted.
        p = self.pointer()
        self.snapshot(p)
        self.current = p

    def status(self):
        self.reconcile()
        p = self.current
        recoverable = [dict(submissionId=h['submissionId'], operation=h['operation'], revision=h['pointer']['revision'])
                       for h in self.history() if h['previous'] == p and h['pointer']['revision'] > p['revision']]
        if not p['revision']:
            return dict(configured=True, state='empty', current=p, recoverable=recoverable,
                        message='尚无公开发行。' + ('存在中断发布意图；在对应投稿重新预览并确认可恢复。' if recoverable else ''))
        audit = self.api.parse(self.store.disk.read('publications/' + p['snapshot'] + '.json'))
        payload, _ = self.snapshot(p)
        expired = payload['expiresAt'] <= int(time.time() * 1000)
        try:
            verified = self.api.parse(self.store.disk.read('publications/verification-' + p['snapshot'] + '.json'))['httpVerified'] is True
        except FileNotFoundError:
            verified = False
        return dict(configured=True, state='expired' if expired else 'verified' if verified else 'visible-verification-pending', current=p,
                    operation=audit['operation'], submissionId=audit.get('submissionId'), httpVerified=verified,
                    recoverable=recoverable, expiresAt=payload['expiresAt'],
                    message='签名目录已过期；新安装与启用停止。请预览恢复此版本，以更高修订续发。' if expired else '公开指针已生效；HTTP 下载复核未通过或尚未完成，可重试复核。' if not verified else '公开下载复核通过。')

    def entry(self, record, attachment):
        api = self.api
        fields = {'purpose', 'scenario', 'prerequisites', 'example', 'risk', 'testStatus', 'provenance'}
        api.need(type(attachment) is dict and set(attachment) == fields, 'entry.fields')
        api.need(not api.checker.SECRET.search(canonical(attachment)), 'entry.secret_pattern')
        for key in fields - {'provenance'}:
            api.need(type(attachment[key]) is str and 0 < len(attachment[key]) <= 2000 and not re.search(r'[\x00-\x1f\x7f]', attachment[key]) and not api.checker.SECRET.search(attachment[key].encode()), 'entry.text')
        meta = record['metadata']
        api.need(meta['components'] == [meta['id']] and meta['skills'] in ([], [meta['id']]) and meta['license'] in ('MIT', 'Apache-2.0'), 'entry.unsupported_shape_use_single_component', 409)
        api.need(meta['productType'] != 'skill' or meta['skills'] == [meta['id']], 'entry.skill_mismatch')
        provenance = attachment['provenance']
        api.need(type(provenance) is dict and set(provenance) == {'ownership', 'author', 'upstreamSource', 'pinnedRevision', 'license', 'modifications'}, 'entry.provenance')
        api.need(provenance['pinnedRevision'] == meta['sourceRevision'] and provenance['license'] == meta['license'], 'entry.provenance_mismatch')
        raw = self.store.verify(record)[meta['archive']['file']]
        # P10 has already checked every member. Read only exact static declarations.
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
            files = {member.name: tar.extractfile(member).read() for member in tar.getmembers() if member.isfile()}
        skill = meta['id'] if meta['skills'] else None
        if skill:
            api.need('package/SKILL.md' in files, 'entry.skill_missing')
        release = dict(id=meta['id'], version=meta['version'], skill=skill,
                       skillSha256=api.sha(files['package/SKILL.md']) if skill else None,
                       provider=meta['id'] + '@' + meta['version'] if skill else None,
                       origin=self.trust['origin'], runtime=meta['runtime'], releaseStatus='published', license=meta['license'], **meta['archive'])
        entry = dict(id=meta['id'], title=meta['title'], kind='skill' if meta['productType'] == 'skill' else 'bundle',
                     capabilities=['skill' if skill else 'tools'], sourceLabel='QCU自有' if provenance.get('ownership') == 'qcu' else '第三方改编',
                     release=release, **copy.deepcopy(attachment))
        # Evidence is an explicit administrator statement; immutable submission boundaries are appended verbatim.
        entry['testStatus'] += '；投稿声明：' + '; '.join(k + '=' + v['status'] for k, v in meta['testEvidence'].items())
        entry['risk'] += '；权限声明：' + '；'.join(meta['permissionSummary'])
        api.need(len(entry['risk']) <= 2000 and len(entry['testStatus']) <= 2000, 'entry.text')
        # Reuse the exact signed-protocol validator before admission, not just UI checks.
        self.sign_payload(1, [entry], [])
        return entry

    def attach(self, sid, body):
        record = self.store.get(sid)
        self.api.need(record['status'] == 'in-review' and set(body) == {'materialsDigest', 'entry'} and body['materialsDigest'] == record['materialsDigest'], 'entry.reapproval_required', 409)
        entry = self.entry(record, body['entry'])
        record['marketEntry'] = entry
        record['marketAttachment'] = copy.deepcopy(body['entry'])
        record['marketEntryDigest'] = self.api.sha(canonical(entry))
        record['audit'].append(self.store.audit('market-entry', 'qcu-admin', record['materialsDigest'], 'Market entry admitted; requires subsequent approval.', entryDigest=record['marketEntryDigest']))
        self.store.save()
        return copy.deepcopy(record)

    def sign_payload(self, revision, entries, withdrawn):
        issued = int(time.time() * 1000)
        payload = dict(domain='QCU-MARKET-CATALOG/ED25519/V1', schema=1, origin=self.trust['origin'], revision=revision,
                       issuedAt=issued, expiresAt=issued + 7 * 86400000,
                       catalog=dict(schemaVersion=4, protocol=4, revision=revision, entries=entries), withdrawn=withdrawn)
        return self.crypto('sign', root=str(self.store.root / 'signing'), payload=payload)

    def preview(self, sid, operation='publish'):
        api = self.api
        api.need(operation in ('publish', 'withdraw', 'rollback'), 'publication.operation')
        record = self.store.get(sid)
        api.need(record['status'] == 'release-prepared' and record.get('marketEntry') is not None and record.get('marketEntryDigest') == record['approval'].get('entryDigest'), 'publication.entry_not_approved', 409)
        api.need(api.sha(canonical(record['marketEntry'])) == record['marketEntryDigest'], 'entry.changed', 409)
        self.store.candidate_files(record)
        self.api.need(self.store.preview(sid)['proposalDigest'] == record['candidate']['proposalDigest'], 'publication.candidate_binding', 409)
        p = self.pointer()
        proposal = dict(operation=operation, submissionId=sid, materialsDigest=record['materialsDigest'],
                        candidate=record['candidate'], entry=record['marketEntry'], entryDigest=record['marketEntryDigest'],
                        approval=record['approval'], previous=p)
        return dict(proposal=proposal, previewDigest=api.sha(canonical(proposal)))

    def history(self):
        fd = self.store.disk.directory('publications')
        try:
            names = os.listdir(fd)
        finally:
            os.close(fd)
        return [self.api.parse(self.store.disk.read('publications/' + name)) for name in sorted(names) if re.fullmatch(r'[1-9][0-9]*-[a-f0-9]{64}\.json', name)]

    def confirm(self, sid, body):
        api = self.api
        api.need(type(body) is dict and set(body) == {'operation', 'previewDigest', 'confirm'} and body['confirm'] is True, 'publication.confirm')
        # Durable intent makes retries idempotent, including postcommit crashes.
        for old in self.history():
            if old['previewDigest'] == body['previewDigest'] and old['submissionId'] == sid and old['operation'] == body['operation']:
                p = self.pointer()
                if p == old['previous']:
                    payload, _ = self.snapshot(old['pointer'])
                    for e in payload['catalog']['entries']:
                        b = self.disk.read('archives/' + e['release']['file'])
                        api.need(len(b) == e['release']['bytes'] and api.sha(b) == e['release']['sha256'], 'publication.incomplete', 409)
                    self.disk.write('current.json', canonical(old['pointer']), replace=True)
                    p = self.pointer()
                api.need(p == old['pointer'], 'publication.retry_superseded', 409)
                return self.self_check(old)
        preview = self.preview(sid, body['operation'])
        api.need(preview['previewDigest'] == body['previewDigest'], 'publication.stale', 409)
        record = self.store.get(sid)
        item = record['marketEntry']
        previous, _ = self.snapshot()
        entries = [e for e in previous.get('catalog', {}).get('entries', []) if e['id'] != item['id']]
        withdrawn = set(previous['withdrawn'])
        for old in self.history():
            for e in old.get('entries', [old.get('entry')]):
                api.need(e['id'] != item['id'] or e['release']['version'] != item['release']['version'] or e['release']['sha256'] == item['release']['sha256'], 'publication.version_conflict', 409)
        if body['operation'] == 'withdraw':
            api.need(any(e['id'] == item['id'] for e in previous.get('catalog', {}).get('entries', [])), 'publication.not_active', 409)
            withdrawn.add(item['id'])
        else:
            entries.append(item)
            withdrawn.discard(item['id'])
        revision = self.pointer()['revision'] + 1
        # Never reuse orphan revision directories or signatures after a precommit crash.
        histories = self.history()
        revision = max([revision] + [h['pointer']['revision'] + 1 for h in histories])
        archive = record['metadata']['archive']['file']
        contents = self.store.candidate_files(record)[archive]
        api.need(len(contents) == item['release']['bytes'] and api.sha(contents) == item['release']['sha256'], 'publication.archive_changed', 409)
        return self.commit_snapshot(revision, entries, sorted(withdrawn), {archive: contents}, preview['proposal'], body['previewDigest'])

    def commit_snapshot(self, revision, entries, withdrawn, archives, proposal, preview_digest):
        api = self.api
        for old in self.history():
            for before in old.get('entries', [old.get('entry')]):
                for entry in entries:
                    api.need(before['id'] != entry['id'] or before['release']['version'] != entry['release']['version'] or before['release']['sha256'] == entry['release']['sha256'], 'publication.version_conflict', 409)
        signed = self.sign_payload(revision, entries, withdrawn)
        raw = base64.b64decode(signed['raw'], validate=True)
        pointer = dict(revision=revision, digest=signed['fingerprint'], snapshot=str(revision) + '-' + signed['fingerprint'])
        for archive, contents in archives.items():
            try:
                self.disk.write('archives/' + archive, contents)
            except FileExistsError:
                api.need(self.disk.read('archives/' + archive) == contents, 'publication.archive_conflict', 409)
        self.disk.mkdir('snapshots/' + pointer['snapshot'])
        self.disk.write('snapshots/' + pointer['snapshot'] + '/catalog.signed.json', raw)
        downloads = [] if not self.pointer()['revision'] else api.parse(self.disk.read('snapshots/' + self.pointer()['snapshot'] + '/downloads.json'))
        self.disk.write('snapshots/' + pointer['snapshot'] + '/downloads.json', canonical(sorted(set(downloads + list(archives)))))
        # Verify exact durable staged bytes, all active packages, before the commit point.
        self.snapshot(pointer)
        for e in entries:
            b = self.disk.read('archives/' + e['release']['file'])
            api.need(len(b) == e['release']['bytes'] and api.sha(b) == e['release']['sha256'], 'publication.incomplete', 409)
        audit = dict(**proposal, previewDigest=preview_digest, pointer=pointer, time=self.api.now(), httpVerified=False)
        self.store.disk.write('publications/' + pointer['snapshot'] + '.json', canonical(audit), mode=0o600)
        self.fault('precommit')
        self.disk.write('current.json', canonical(pointer), replace=True)
        self.fault('postcommit')
        return self.self_check(audit)

    def bootstrap_preview(self, resources, manifest_pin, seed_raw):
        """Trusted operator-only entrypoint: resources MUST come from load_snapshot.

        Preserve every published installable product in the pinned static snapshot;
        self-update and explicitly synthetic probes stay in the static channel.
        No remote metadata or uploaded source is used as a trust root.
        """
        api = self.api
        api.need(self.pointer()['revision'] == 0, 'bootstrap.already_published', 409)
        api.need(not api.checker.SECRET.search(seed_raw), 'bootstrap.secret_pattern')
        api.need(type(manifest_pin) is str and re.fullmatch(r'[a-f0-9]{64}', manifest_pin), 'bootstrap.manifest')
        seed = api.parse(seed_raw, 262144)
        api.need(type(seed) is dict and set(seed) == {'schemaVersion', 'revision', 'protocol', 'entries'} and seed['schemaVersion'] == 4 and seed['protocol'] == 4 and seed['revision'] == 1 and type(seed['entries']) is list, 'bootstrap.schema')
        static = api.parse(resources['/catalog.json'])
        expected = {e['id']: e for e in static['plugins'] if e['id'] not in ('qcu-market', 'qcu-dialogue-install-probe') and e.get('synthetic') is not True}
        api.need(expected and len(expected) <= 100 and len(seed['entries']) == len(expected) and {e['id'] for e in seed['entries']} == set(expected), 'bootstrap.preserve_all_products')
        for entry in seed['entries']:
            e, old = entry['release'], expected[entry['id']]
            api.need(old['status'] == 'published' and old['review'] == 'approved' and all(e[k] == old[k] for k in ('version', 'file', 'bytes', 'sha256')) and old['dshVersions'] == [e['runtime']], 'bootstrap.pin_mismatch')
            raw = resources['/plugins/' + e['file']]
            api.need(len(raw) == e['bytes'] and api.sha(raw) == e['sha256'], 'bootstrap.archive')
            with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
                members = tar.getmembers()
                api.need(len(members) <= 256 and all(m.isfile() and m.name.startswith('package/') and '..' not in Path(m.name).parts and m.size <= 1048576 for m in members) and sum(m.size for m in members) <= 4 * 1048576, 'bootstrap.package_shape')
                files = {m.name: tar.extractfile(m).read() for m in members}
            package = api.parse(files['package/package.json'], 262144)
            api.need(package['name'] == entry['id'] and package['version'] == e['version'] and package['license'] == e['license'], 'bootstrap.package_metadata')
            api.need(package.get('peerDependencies', {}).get('@deepseek-ai/cordis') == '4.0.4' and all(v == e['runtime'] for k, v in package.get('peerDependencies', {}).items() if k.startswith('@deepseek-ai/dsh-')), 'bootstrap.runtime')
            path = package['dsh']['bundle']['patch']
            api.need(type(path) is str and path.startswith('./') and api.checker.safe_path(path[2:]), 'bootstrap.patch')
            patch = api.parse(files['package/' + path[2:]], 262144)
            api.need(type(patch) is list and len(patch) == 1 and set(patch[0]) == {'insert'} and len(patch[0]['insert']) == 1, 'bootstrap.single_component')
            row = patch[0]['insert'][0]
            api.need(row['id'] == entry['id'] and row['name'] == entry['id'] and row['disabled'] is True, 'bootstrap.component')
            if e['skill']:
                skill_path = 'SKILL.md'
                if entry['id'] == e['id'] == 'qcu-course-workbench' and entry['capabilities'] == ['workbench'] and e['skill'] == 'qcu-course-draft':
                    skill_path = 'skills/qcu-course-draft/SKILL.md'
                    api.need(type(package.get('files')) is list and skill_path in package['files'], 'bootstrap.skill_declaration')
                api.need('package/' + skill_path in files and api.sha(files['package/' + skill_path]) == e['skillSha256'], 'bootstrap.skill')
        # Reuse the full dynamic metadata/signature validator; nothing is published.
        self.sign_payload(1, seed['entries'], [])
        proposal = dict(operation='bootstrap', submissionId=None, previous=self.pointer(), manifestSha256=manifest_pin,
                        seedSha256=api.sha(seed_raw), entries=seed['entries'],
                        review='Operator must verify published source/version/provenance and all untested boundaries; separate explicit digest confirmation.')
        return dict(proposal=proposal, previewDigest=api.sha(canonical(proposal)))

    def bootstrap(self, resources, manifest_pin, seed_raw, confirm_digest):
        for old in self.history():
            if old['operation'] == 'bootstrap' and old['previewDigest'] == confirm_digest and old['manifestSha256'] == manifest_pin and old['seedSha256'] == self.api.sha(seed_raw):
                p = self.pointer()
                if p == old['previous']:
                    payload, _ = self.snapshot(old['pointer'])
                    for e in payload['catalog']['entries']:
                        raw = self.disk.read('archives/' + e['release']['file'])
                        self.api.need(len(raw) == e['release']['bytes'] and self.api.sha(raw) == e['release']['sha256'], 'bootstrap.incomplete', 409)
                    self.disk.write('current.json', canonical(old['pointer']), replace=True)
                    p = self.pointer()
                self.api.need(p == old['pointer'], 'bootstrap.retry_superseded', 409)
                return self.self_check(old)
        preview = self.bootstrap_preview(resources, manifest_pin, seed_raw)
        self.api.need(confirm_digest == preview['previewDigest'], 'bootstrap.stale', 409)
        revision = max([1] + [h['pointer']['revision'] + 1 for h in self.history()])
        entries = preview['proposal']['entries']
        archives = {e['release']['file']: resources['/plugins/' + e['release']['file']] for e in entries}
        return self.commit_snapshot(revision, entries, [], archives, preview['proposal'], confirm_digest)

    def self_check(self, audit=None):
        p = self.pointer()
        if audit is None:
            self.api.need(p['revision'] > 0, 'publication.empty', 409)
            audit = self.api.parse(self.store.disk.read('publications/' + p['snapshot'] + '.json'))
        self.api.need(audit['pointer'] == p, 'publication.stale', 409)
        _, expected = self.snapshot(p)
        try:
            def get(path, limit):
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
                with opener.open(urllib.request.Request(self.trust['origin'] + path, headers={'Accept-Encoding': 'identity'}), timeout=5) as response:
                    self.api.need(response.status == 200 and response.geturl() == self.trust['origin'] + path and response.headers.get('Content-Encoding') in (None, 'identity'), 'publication.http')
                    raw = response.read(limit + 1)
                    self.api.need(len(raw) <= limit and response.headers.get('Content-Length') == str(len(raw)), 'publication.http')
                    return raw
            raw = get('/market/catalog.signed.json', 524288)
            self.api.need(raw == expected, 'publication.http_catalog')
            self.crypto('verify', raw=base64.b64encode(raw).decode())
            for item in audit.get('entries', [audit.get('entry')]):
                e = item['release']
                package = get('/plugins/' + e['file'], 1048576)
                self.api.need(len(package) == e['bytes'] and self.api.sha(package) == e['sha256'], 'publication.http_archive')
            audit['httpVerified'] = True
        except (OSError, ValueError, self.api.Refused):
            audit['httpVerified'] = False
        name = 'publications/verification-' + p['snapshot'] + '.json'
        value = canonical(dict(pointer=p, httpVerified=audit['httpVerified'], checkedAt=self.api.now()))
        try:
            self.store.disk.write(name, value, mode=0o600)
        except FileExistsError:
            self.store.disk.write(name, value, replace=True, mode=0o600)
        return self.status()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None
