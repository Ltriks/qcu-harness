"""QCU offline submission checker. Treat every handoff byte as untrusted data.

No extraction, imports of submitted code, subprocesses, network, or persistent state.
Python 3.9+ standard library; see docs/qcu-market-p10-submission-check.md.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
import re
import stat
import sys
import tarfile
import zlib
from pathlib import Path

CHECKER_VERSION = '0.1.0-pilot.10.1'
RUNTIME = '0.2.0-rc.2'
ARCHIVE_LIMIT = 1048576
PAYLOAD_LIMIT = 8 * 1048576
MEMBER_LIMIT = 256
FILE_LIMIT = 1048576
JSON_LIMIT = 262144
REF_TOTAL_LIMIT = 8 * 1048576
SEMVER = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?\Z')
ID = re.compile(r'qcu-[a-z0-9]+(?:-[a-z0-9]+)*\Z')
HASH = re.compile(r'[0-9a-f]{64}\Z')
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{40,255}|sk-[A-Za-z0-9_-]{24,255}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,255})\b')
LIMITATIONS = [
    'Static declarations and evidence statuses do not prove authenticity or results.',
    'Native DSH, Skill provider/tool discovery and teacher acceptance require separate review.',
    'Pattern scanning cannot guarantee absence of personal data, secrets or unsafe code.',
    'No submitted code or install script was executed; no install or publication is authorized.',
]


class Rejected(Exception):
    def __init__(self, code, field, io_failure=False):
        self.code, self.field, self.io_failure = code, field, io_failure


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + '\n').encode()


def semver(value):
    if not isinstance(value, str) or len(value) > 80:
        return False
    match = SEMVER.fullmatch(value)
    return bool(match and (not match[4] or all(not (p.isdigit() and len(p) > 1 and p[0] == '0') for p in match[4].split('.'))))


def safe_path(value):
    # Deliberately narrower than platform paths: no URL, drive, glob, dot segment.
    return (isinstance(value, str) and 0 < len(value) <= 240
            and all(re.fullmatch(r'[A-Za-z0-9_@+.-]{1,240}', part) and part not in ('.', '..')
                    for part in value.split('/')))


def load_json(data, field):
    if len(data) > JSON_LIMIT:
        raise Rejected('json.limit', field)

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise Rejected('json.duplicate_key', field)
            result[key] = value
        return result

    try:
        value = json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, RecursionError):
        raise Rejected('json.invalid', field) from None

    def bound(item, depth=0):
        if depth > 20:
            raise Rejected('json.depth', field)
        if isinstance(item, (dict, list)):
            if len(item) > 512:
                raise Rejected('json.container_limit', field)
            for child in (list(item.keys()) + list(item.values()) if isinstance(item, dict) else item):
                bound(child, depth + 1)
        elif isinstance(item, str) and len(item) > 8192:
            raise Rejected('json.string_limit', field)
        elif isinstance(item, (float, int)) and not isinstance(item, bool):
            if not isinstance(item, int) or abs(item) > 2**63 - 1:
                raise Rejected('json.number', field)
    bound(value)
    return value


def open_directory(path):
    """Open each actual ancestor, without resolve() or a symlink-following stat."""
    path = Path(path)
    if '..' in path.parts:
        raise Rejected('path.unsafe', 'input')
    absolute = Path(os.path.abspath(path))
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in absolute.parts[1:]:
            new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = new
        return fd
    except (OSError, ValueError):
        os.close(fd)
        raise Rejected('io.directory', 'input', True) from None


def read_relative(root_fd, name, limit, field, primary=False):
    if not safe_path(name):
        raise Rejected('reference.unsafe', field)
    fd = os.dup(root_fd)
    try:
        parts = name.split('/')
        for part in parts[:-1]:
            new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = new
        file_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        info = os.fstat(file_fd)
        if not stat.S_ISREG(info.st_mode):
            os.close(file_fd)
            raise Rejected('reference.regular_file_required', field)
        with os.fdopen(file_fd, 'rb') as file:
            if info.st_size > limit:
                raise Rejected('file.limit', field)
            data = file.read(limit + 1)
            if len(data) > limit:
                raise Rejected('file.limit', field)
            return data
    except (FileNotFoundError, NotADirectoryError):
        raise Rejected('reference.missing_or_unsafe', field, primary) from None
    except (OSError, ValueError):
        raise Rejected('io.read' if primary else 'reference.unreadable_or_unsafe', field, primary) from None
    finally:
        os.close(fd)


class Checker:
    def __init__(self, root_fd):
        self.root_fd = root_fd
        self.report = {'checkerVersion': CHECKER_VERSION, 'schemaVersion': 1,
                       'identity': None, 'archive': None, 'errors': [], 'unsupported': [],
                       'reviewRequirements': [], 'approval': 'required', 'limitations': LIMITATIONS,
                       'evidence': {}, 'counts': {}, 'staticChecksPassed': False}
        self.ref_bytes = 0
        self.cache = {}

    def issue(self, code, field, kind='errors'):
        entry = {'code': code, 'field': field, 'message': 'Separate human validation required.' if kind == 'reviewRequirements' else 'Static input requirement not satisfied.'}
        if entry not in self.report[kind]:
            self.report[kind].append(entry)

    def need(self, condition, code, field):
        if not condition:
            raise Rejected(code, field)

    def scan(self, data, field):
        if SECRET.search(data):
            self.issue('secret.pattern', field)

    def reference(self, value, field, json_file=False):
        self.need(safe_path(value), 'reference.unsafe', field)
        if value not in self.cache:
            data = read_relative(self.root_fd, value, JSON_LIMIT if json_file else FILE_LIMIT, field)
            self.ref_bytes += len(data)
            self.need(self.ref_bytes <= REF_TOTAL_LIMIT, 'reference.total_limit', field)
            self.need(bool(data.strip()), 'reference.empty', field)
            self.scan(data, field)
            self.cache[value] = data
        data = self.cache[value]
        return load_json(data, field) if json_file else data

    def text(self, value, field):
        self.need(isinstance(value, str) and bool(value.strip()) and len(value) <= 4096,
                  'schema.text', field)
        lower = value.strip().lower()
        self.need(lower not in ('todo', 'tbd', 'null', 'none', 'unknown', '待填写', '待填', 'template', 'placeholder')
                  and not re.search(r'_{3,}|\$\{|<[^>]*>', value), 'metadata.placeholder', field)

    def strings(self, value, field, ids=False):
        self.need(isinstance(value, list) and len(value) <= 128, 'schema.list', field)
        for index, item in enumerate(value):
            self.text(item, f'{field}[{index}]')
            if ids:
                self.need(bool(ID.fullmatch(item)) and len(item) <= 80, 'metadata.id', field)
        self.need(len(value) == len(set(value)), 'schema.duplicate', field)

    def dependencies(self, value, field):
        self.need(isinstance(value, dict) and len(value) <= 128, 'schema.dependencies', field)
        for name, version in value.items():
            self.need(bool(re.fullmatch(r'(?:@[a-z0-9-]+/)?[a-z0-9][a-z0-9._-]{0,99}', name)), 'dependency.name', field)
            self.need(semver(version), 'dependency.unpinned', field)
            if name.startswith('@deepseek-ai/dsh-'):
                self.need(version == RUNTIME, 'dependency.dsh_version', field)
            elif name == '@deepseek-ai/cordis':
                self.need(version == '4.0.4', 'dependency.cordis_version', field)
            elif name not in ('@deepseek-ai/cosmokit', '@deepseek-ai/schemastery'):
                self.issue('dependency.unknown', field, 'reviewRequirements')
            if re.search(r'(^|/)(?:node-gyp|node-pre-gyp|sharp|sqlite3|better-sqlite3|fsevents|bindings|prebuild-install)$', name):
                self.issue('dependency.native', field, 'unsupported')

    def metadata(self, meta):
        self.need(isinstance(meta, dict), 'schema.object', 'submission')
        required = {'schemaVersion', 'templateOnly', 'id', 'title', 'version', 'sourceRevision', 'productType',
                    'runtime', 'license', 'components', 'skills', 'peerDependencies', 'runtimeDependencies',
                    'installScripts', 'permissionSummary', 'archive', 'knownLimits', 'published',
                    'materials', 'testEvidence'}
        self.need(set(meta) == required, 'schema.fields', 'submission')
        self.need(type(meta['schemaVersion']) is int and meta['schemaVersion'] == 1, 'schema.version', 'schemaVersion')
        self.need(meta['templateOnly'] is False, 'metadata.template', 'templateOnly')
        self.need(meta['published'] is False, 'metadata.published', 'published')
        self.need(isinstance(meta['id'], str) and len(meta['id']) <= 80 and bool(ID.fullmatch(meta['id'])), 'metadata.id', 'id')
        self.text(meta['title'], 'title')
        self.need(semver(meta['version']), 'metadata.version', 'version')
        self.need(isinstance(meta['sourceRevision'], str) and bool(re.fullmatch(r'[0-9a-f]{40}', meta['sourceRevision']))
                  and len(set(meta['sourceRevision'])) > 1, 'metadata.revision', 'sourceRevision')
        self.need(meta['productType'] in ('plugin', 'skill'), 'metadata.product_type', 'productType')
        self.need(meta['runtime'] == RUNTIME, 'metadata.runtime', 'runtime')
        self.text(meta['license'], 'license')
        if meta['license'] not in ('MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'):
            self.issue('license.unknown', 'license', 'reviewRequirements')
        for name in ('components', 'skills', 'permissionSummary', 'knownLimits'):
            self.strings(meta[name], name, name in ('components', 'skills'))
        if not meta['permissionSummary']:
            self.issue('permissions.summary_missing', 'permissionSummary', 'reviewRequirements')
        self.need(bool(meta['components']), 'metadata.components_empty', 'components')
        if meta['productType'] == 'skill':
            self.need(bool(meta['skills']), 'metadata.skills_empty', 'skills')
        self.dependencies(meta['peerDependencies'], 'peerDependencies')
        self.dependencies(meta['runtimeDependencies'], 'runtimeDependencies')
        scripts = meta['installScripts']
        self.need(isinstance(scripts, list) and len(scripts) <= 128, 'schema.scripts', 'installScripts')
        names = []
        for index, script in enumerate(scripts):
            self.need(isinstance(script, dict) and set(script) == {'name', 'command'}, 'schema.script', f'installScripts[{index}]')
            self.text(script['name'], 'installScripts.name')
            self.text(script['command'], 'installScripts.command')
            names.append(script['name'])
        self.need(len(names) == len(set(names)), 'schema.duplicate', 'installScripts')
        arc = meta['archive']
        self.need(isinstance(arc, dict) and set(arc) == {'file', 'bytes', 'sha256'}, 'schema.archive', 'archive')
        self.need(type(arc['bytes']) is int and 0 < arc['bytes'] <= ARCHIVE_LIMIT, 'archive.bytes', 'archive.bytes')
        self.need(isinstance(arc['sha256'], str) and bool(HASH.fullmatch(arc['sha256'])), 'archive.sha256', 'archive.sha256')
        self.need(safe_path(arc['file']) and '/' not in arc['file'], 'archive.filename', 'archive.file')
        expected = f"{meta['id']}-{meta['version']}-{arc['sha256']}.tgz"
        self.need(arc['file'] == expected, 'archive.filename', 'archive.file')
        # Only syntax-validated identity, never titles, evidence, paths or command bodies.
        if not SECRET.search(encoded({'id': meta['id'], 'version': meta['version']})):
            self.report['identity'] = {'id': meta['id'], 'version': meta['version'], 'productType': meta['productType']}

    def materials(self, meta):
        materials = meta['materials']
        self.need(isinstance(materials, dict) and set(materials) == {'spec', 'build', 'license', 'source', 'memberManifest', 'lock'}, 'schema.materials', 'materials')
        for name in ('spec', 'build', 'license', 'source'):
            self.reference(materials[name], 'materials.' + name)
        if meta['runtimeDependencies']:
            self.need(materials['lock'] is not None, 'dependency.lock_required', 'materials.lock')
        if materials['lock'] is not None:
            self.reference(materials['lock'], 'materials.lock')
        manifest = self.reference(materials['memberManifest'], 'materials.memberManifest', True)
        self.need(isinstance(manifest, dict) and set(manifest) == {'schemaVersion', 'members'}
                  and type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 1,
                  'manifest.schema', 'materials.memberManifest')
        rows = manifest['members']
        self.need(isinstance(rows, list) and 0 < len(rows) <= MEMBER_LIMIT, 'manifest.rows', 'materials.memberManifest')
        declared = {}
        for row in rows:
            self.need(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, 'manifest.row', 'materials.memberManifest')
            self.need(safe_path(row['path']), 'manifest.path', 'materials.memberManifest')
            self.need(row['path'] not in declared, 'manifest.duplicate', 'materials.memberManifest')
            self.need(type(row['bytes']) is int and 0 <= row['bytes'] <= FILE_LIMIT
                      and isinstance(row['sha256'], str) and bool(HASH.fullmatch(row['sha256'])), 'manifest.value', 'materials.memberManifest')
            declared[row['path']] = {'bytes': row['bytes'], 'sha256': row['sha256']}
        return declared

    def evidence(self, meta):
        evidence = meta['testEvidence']
        stages = ('source', 'preview', 'liveInstall', 'businessAcceptance')
        self.need(isinstance(evidence, dict) and set(evidence) == set(stages), 'schema.evidence', 'testEvidence')
        for stage in stages:
            field = 'testEvidence.' + stage
            value = evidence[stage]
            if value is None:
                self.report['evidence'][stage] = 'missing'
                self.issue('evidence.missing', field, 'reviewRequirements')
                continue
            self.need(isinstance(value, dict) and set(value) == {'status', 'file'}, 'schema.evidence_entry', field)
            self.need(value['status'] in ('passed', 'failed', 'untested'), 'schema.evidence_status', field)
            self.report['evidence'][stage] = value['status']
            if value['file'] is not None:
                self.reference(value['file'], field + '.file')
            else:
                self.need(value['status'] == 'untested', 'evidence.file_required', field)
            if value['status'] == 'failed':
                self.issue('evidence.failed', field)
            elif value['status'] == 'untested':
                self.issue('evidence.untested', field, 'reviewRequirements')
        for stage in ('liveInstall', 'businessAcceptance'):
            self.issue('evidence.native_review' if stage == 'liveInstall' else 'evidence.teacher_review', 'testEvidence.' + stage, 'reviewRequirements')

    def scan_gzip_metadata(self, raw):
        # The whole compressed input is already capped; scan it as well as the
        # first gzip header's optional fields. Field boundaries must not depend
        # on adjacent binary bytes satisfying a regex word boundary.
        self.need(len(raw) <= ARCHIVE_LIMIT, 'file.limit', 'archive')
        self.scan(raw, 'archive.gzipHeaders')
        if len(raw) < 10 or raw[:3] != b'\x1f\x8b\x08':
            return  # gzip below reports invalid/truncated fixed headers.
        flags, offset = raw[3], 10
        if flags & 4:  # FEXTRA, bounded by both uint16 XLEN and compressed cap
            self.need(offset + 2 <= len(raw), 'archive.gzip_invalid', 'archive')
            size = int.from_bytes(raw[offset:offset + 2], 'little')
            offset += 2
            self.need(offset + size <= len(raw), 'archive.gzip_invalid', 'archive')
            self.scan(raw[offset:offset + size], 'archive.gzipHeaders')
            offset += size
        for flag in (8, 16):  # FNAME, FCOMMENT: bounded raw search, never decoded
            if flags & flag:
                end = raw.find(b'\0', offset)
                self.need(end != -1, 'archive.gzip_invalid', 'archive')
                self.scan(raw[offset:end], 'archive.gzipHeaders')
                offset = end + 1

    def archive(self, raw):
        self.report['archive'] = {'bytes': len(raw), 'sha256': sha(raw), 'members': []}
        self.scan_gzip_metadata(raw)
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw), mode='rb') as file:
                payload = file.read(PAYLOAD_LIMIT + 1)
        except (OSError, EOFError, ValueError, zlib.error):
            raise Rejected('archive.gzip_invalid', 'archive') from None
        self.need(len(payload) <= PAYLOAD_LIMIT, 'archive.payload_limit', 'archive')
        self.report['archive']['payloadBytes'] = len(payload)
        files, offset, ended = {}, 0, False
        while offset + 512 <= len(payload):
            header = payload[offset:offset + 512]
            if not any(header):
                self.need(len(payload) - offset >= 1024 and not any(payload[offset:]), 'archive.terminator', 'archive')
                ended = True
                break
            self.scan(header, 'archive.headers')
            self.need(len(files) < MEMBER_LIMIT, 'archive.member_limit', 'archive')
            # Inspect one raw header at a time. tarfile never consumes extension records.
            self.need(header[156:157] in (b'0', b'\0'), 'archive.special_member', 'archive')
            self.need(header[257:265] == b'ustar\x0000', 'archive.format_unsupported', 'archive')
            self.need(all(not header[start] & 128 for start in (100, 108, 116, 124, 136)), 'archive.numeric_extension', 'archive')
            for start, end in ((0, 100), (157, 257), (265, 297), (297, 329), (345, 500)):
                raw_field = header[start:end]
                # A field can begin immediately after a word byte (e.g. USTAR
                # version "00" before uname); scan each field independently too.
                self.scan(raw_field, 'archive.headers')
                if b'\0' in raw_field:
                    self.need(not any(raw_field[raw_field.index(0):]), 'archive.header_noncanonical', 'archive')
            try:
                info = tarfile.TarInfo.frombuf(header, 'utf-8', 'strict')
            except (tarfile.TarError, UnicodeError, ValueError):
                raise Rejected('archive.header_invalid', 'archive') from None
            path = info.name
            self.need(safe_path(path) and path.startswith('package/'), 'archive.path', 'archive')
            name = path[len('package/'):]
            self.need(bool(name) and name not in files, 'archive.duplicate_member', 'archive')
            self.need(not info.linkname and info.mode & 0o7111 == 0, 'archive.mode_or_link', 'archive')
            self.need(0 <= info.size <= FILE_LIMIT, 'archive.member_size', 'archive')
            offset += 512
            end = offset + info.size
            padded = offset + ((info.size + 511) // 512) * 512
            self.need(padded <= len(payload), 'archive.truncated', 'archive')
            self.need(not any(payload[end:padded]), 'archive.padding', 'archive')
            data = payload[offset:end]
            self.member_policy(name, data)
            files[name] = data
            offset = padded
        self.need(ended and len(payload) % 512 == 0, 'archive.truncated', 'archive')
        self.report['archive']['members'] = [dict(index=i, pathSha256=sha(name.encode()), bytes=len(data), sha256=sha(data))
                                             for i, (name, data) in enumerate(sorted(files.items()))]
        return files

    def member_policy(self, name, data):
        parts = [p.lower() for p in name.split('/')]
        denied = {'node_modules', '.git', 'home', 'logs', 'log', '.ssh', '.aws', '.codex', 'credentials',
                  'credentials.json', 'auth.json', 'config.json', 'id_rsa', 'id_ed25519', '.npmrc', '.netrc',
                  'keychain', 'private', 'runtime', 'state', 'sessions', 'cookies', 'cookies.json'}
        self.need(not any(p in denied or p.startswith('.env') or re.search(r'(?:credential|secret|private[-_]key)', p)
                          or p.endswith(('.pem', '.key', '.p12', '.pfx', '.log', '.db', '.sqlite')) for p in parts), 'archive.denied_filename', 'archive.members')
        self.need(parts[-1] in ('license', 'notice') or name.split('/')[-1] == 'WRAPPER-LICENSE' or Path(parts[-1]).suffix in
                  ('.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.md', '.txt', '.svg', '.css', '.html'),
                  'archive.file_type_unsupported', 'archive.members')
        try:
            text = data.decode('utf-8')
        except UnicodeError:
            raise Rejected('archive.binary_unsupported', 'archive.members') from None
        self.need('\0' not in text, 'archive.binary_unsupported', 'archive.members')
        self.scan(data, 'archive.members')

    def target(self, value, files, field):
        self.need(isinstance(value, str) and value.startswith('./'), 'package.target', field)
        target = value[2:]
        if '*' in target:
            # One star, one basename segment; supports P9 ./locale/*.json only.
            self.need(target.count('*') == 1 and '/' in target and '*' not in target.rsplit('/', 1)[0], 'package.pattern_unsupported', field)
            directory, basename = target.rsplit('/', 1)
            self.need(safe_path(directory) and safe_path(basename.replace('*', 'qcu')), 'package.target', field)
            pattern = re.compile(re.escape(target).replace(r'\*', '[^/]+') + r'\Z')
            matches = [name for name in files if pattern.fullmatch(name)]
            self.need(bool(matches), 'package.target_missing', field)
        else:
            self.need(safe_path(target) and target in files, 'package.target_missing', field)

    def package(self, meta, files):
        self.need({'package.json', 'README.md', 'LICENSE'} <= set(files), 'package.mandatory_files', 'package')
        self.need(all(files[name].strip() for name in ('package.json', 'README.md', 'LICENSE')), 'package.empty_metadata', 'package')
        pkg = load_json(files['package.json'], 'package')
        self.need(isinstance(pkg, dict), 'package.object', 'package')
        for name in ('name', 'version', 'license'):
            self.need(pkg.get(name) == meta['id' if name == 'name' else name], 'package.identity_mismatch', 'package.' + name)
        self.need(pkg.get('type') == 'module', 'package.type', 'package.type')
        for name, declared in [('peerDependencies', meta['peerDependencies']), ('dependencies', meta['runtimeDependencies'])]:
            actual = pkg.get(name, {})
            self.dependencies(actual, 'package.' + name)
            self.need(actual == declared, 'package.dependency_mismatch', 'package.' + name)
        for name in ('optionalDependencies', 'bundledDependencies', 'bundleDependencies', 'bin', 'gypfile', 'os', 'cpu', 'libc', 'peerDependenciesMeta'):
            if name in pkg:
                self.issue('package.native_or_optional_unsupported', 'package.' + name, 'unsupported')
        if 'permissionSummary' in pkg:
            self.need(pkg['permissionSummary'] == meta['permissionSummary'], 'package.permissions_mismatch', 'package.permissionSummary')
        if 'permissions' in pkg:
            self.issue('package.permissions_unsupported', 'package.permissions', 'unsupported')
        scripts = pkg.get('scripts', {})
        self.need(isinstance(scripts, dict) and all(isinstance(v, str) for v in scripts.values()), 'package.scripts_type', 'package.scripts')
        declared = {item['name']: item['command'] for item in meta['installScripts']}
        self.need(scripts == declared, 'package.script_mismatch', 'package.scripts')
        if scripts:
            self.issue('scripts.execution_review', 'package.scripts', 'reviewRequirements')
        listing = pkg.get('files')
        self.need(isinstance(listing, list) and 0 < len(listing) <= MEMBER_LIMIT, 'package.files_type', 'package.files')
        allowed = {'package.json'}
        for item in listing:
            self.need(isinstance(item, str) and safe_path(item.removesuffix('/')), 'package.files_pattern_unsupported', 'package.files')
            item = item.removesuffix('/')
            matches = {name for name in files if name == item or name.startswith(item + '/')}
            self.need(bool(matches), 'package.files_missing', 'package.files')
            allowed.update(matches)
        self.need(allowed == set(files), 'package.files_coverage', 'package.files')
        exports = pkg.get('exports')
        self.need(isinstance(exports, (dict, str)), 'package.exports_type', 'package.exports')

        def visit(value, depth=0):
            self.need(depth <= 12, 'package.exports_depth', 'package.exports')
            if isinstance(value, str):
                self.target(value, files, 'package.exports')
            elif isinstance(value, dict) and value:
                for key, child in value.items():
                    self.need(key.count('*') <= 1, 'package.pattern_unsupported', 'package.exports')
                    self.need(key in ('.',) or (key.startswith('./') and safe_path(key[2:].replace('*', 'qcu')))
                              or bool(re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_-]{0,63}', key)), 'package.export_key', 'package.exports')
                    visit(child, depth + 1)
            else:
                raise Rejected('package.exports_unsupported', 'package.exports')
        visit(exports)
        dsh = pkg.get('dsh')
        self.need(isinstance(dsh, dict) and isinstance(dsh.get('bundle'), dict), 'package.dsh', 'package.dsh')
        patch = dsh['bundle'].get('patch')
        self.need(isinstance(patch, str) and patch.startswith('./') and safe_path(patch[2:]) and patch[2:] in files,
                  'package.patch', 'package.dsh.bundle.patch')
        if 'client' in dsh:
            client = dsh['client']
            self.need(isinstance(client, dict) and client.get('platform') == 'web'
                      and type(client.get('immediately', False)) is bool, 'package.client', 'package.dsh.client')
            inject = client.get('inject', [])
            self.need(isinstance(inject, list) and all(isinstance(x, str) and x in meta['peerDependencies'] for x in inject),
                      'package.client_inject', 'package.dsh.client')
            self.issue('package.client_review', 'package.dsh.client', 'reviewRequirements')
        patch_data = load_json(files[patch[2:]], 'package.patch')
        self.need(isinstance(patch_data, list) and 0 < len(patch_data) <= 128, 'patch.shape', 'package.patch')
        rows = []
        for operation in patch_data:
            self.need(isinstance(operation, dict) and set(operation) == {'insert'} and isinstance(operation['insert'], list), 'patch.shape', 'package.patch')
            for row in operation['insert']:
                self.need(isinstance(row, dict) and set(row) <= {'id', 'name', 'disabled', 'config'}, 'patch.row', 'package.patch')
                self.need(row.get('disabled') is True, 'patch.default_enabled', 'package.patch')
                self.need(isinstance(row.get('config', {}), dict), 'patch.config', 'package.patch')
                self.need(isinstance(row.get('id'), str) and row['id'] in meta['components'] and row.get('name') == row['id'], 'patch.component', 'package.patch')
                rows.append(row['id'])
        self.need(len(rows) == len(set(rows)) and set(rows) == set(meta['components']), 'patch.component_coverage', 'package.patch')
        if meta['skills']:
            self.need('SKILL.md' in files, 'skill.instructions_missing', 'package')
            self.issue('skill.provider_discovery', 'skills', 'reviewRequirements')
        self.issue('package.host_component_review', 'components', 'reviewRequirements')
        self.issue('permissions.review', 'permissionSummary', 'reviewRequirements')
        self.issue('source_license.review', 'materials', 'reviewRequirements')

    def run(self, raw):
        self.scan(raw, 'submission')
        meta = load_json(raw, 'submission')
        self.metadata(meta)
        # Validate independent sections even if one material is missing.
        declared = None
        for action in (lambda: self.materials(meta), lambda: self.evidence(meta)):
            try:
                result = action()
                if result is not None:
                    declared = result
            except Rejected as error:
                self.issue(error.code, error.field)
        raw_archive = read_relative(self.root_fd, meta['archive']['file'], ARCHIVE_LIMIT, 'archive.file')
        files = self.archive(raw_archive)
        self.need(len(raw_archive) == meta['archive']['bytes'], 'archive.byte_mismatch', 'archive.bytes')
        self.need(sha(raw_archive) == meta['archive']['sha256'], 'archive.hash_mismatch', 'archive.sha256')
        actual = {name: {'bytes': len(data), 'sha256': sha(data)} for name, data in files.items()}
        if declared is not None and declared != actual:
            self.issue('manifest.mismatch', 'materials.memberManifest')
        self.package(meta, files)

    def finish(self):
        for kind in ('errors', 'unsupported', 'reviewRequirements'):
            self.report[kind].sort(key=lambda item: (item['field'], item['code']))
        self.report['counts'] = {kind: len(self.report[kind]) for kind in ('errors', 'unsupported', 'reviewRequirements')}
        self.report['counts']['members'] = len((self.report['archive'] or {}).get('members', []))
        self.report['staticChecksPassed'] = not (self.report['errors'] or self.report['unsupported'])
        return self.report


def check_submission(path):
    fd, checker, exit_code = None, None, 0
    try:
        path = Path(path)
        fd = open_directory(path.parent)
        checker = Checker(fd)
        checker.run(read_relative(fd, path.name, JSON_LIMIT, 'submission', primary=True))
    except Rejected as error:
        checker = checker or Checker(None)
        checker.issue(error.code, error.field)
        exit_code = 2 if error.io_failure else 1
    except OSError:
        checker = checker or Checker(None)
        checker.issue('io.input', 'input')
        exit_code = 2
    finally:
        if fd is not None:
            os.close(fd)
    report = checker.finish()
    return report, exit_code or (0 if report['staticChecksPassed'] else 1)


def write_report(path, data, submission):
    # Publish a fully written temporary file via exclusive hard link. No partial final
    # path, no overwrite, and no following output ancestor symlinks.
    path = Path(path)
    input_parent = Path(os.path.abspath(Path(submission).parent))
    output_path = Path(os.path.abspath(path))
    if output_path == input_parent or input_parent in output_path.parents:
        raise Rejected('report.input_tree', 'report', True)
    fd, temporary = None, None
    try:
        fd = open_directory(path.parent)
        if not safe_path(path.name) or '/' in path.name:
            raise Rejected('report.path', 'report', True)
        # Temporary files operate only in the already opened directory.
        for _ in range(10):
            candidate = '.qcu-report-' + os.urandom(12).hex()
            try:
                temp_fd = os.open(candidate, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
                temporary = candidate
                break
            except FileExistsError:
                continue
        if temporary is None:
            raise OSError()
        with os.fdopen(temp_fd, 'wb') as file:
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        os.link(temporary, path.name, src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
    except (OSError, Rejected):
        raise Rejected('report.write_refused', 'report', True) from None
    finally:
        if fd is not None:
            cleanup_failed = False
            try:
                if temporary is not None:
                    os.unlink(temporary, dir_fd=fd)
            except OSError:
                cleanup_failed = True
            finally:
                try:
                    os.close(fd)
                except OSError:
                    cleanup_failed = True
            if cleanup_failed:
                raise Rejected('report.write_refused', 'report', True) from None


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise Rejected('usage.arguments', 'arguments', True)


def main(argv=None):
    parser = Parser(description='Check one local submission.json without executing or extracting package content. Python 3.9+ stdlib; no shell required. Static pass always requires human/native/teacher review.')
    parser.add_argument('--submission', required=True, help='Local handoff JSON; related references stay inside its parent, with no symlinks.')
    parser.add_argument('--report', help='Optional NEW JSON output outside the handoff tree; existing parent directory required. Never overwritten.')
    try:
        args = parser.parse_args(argv)
        report, exit_code = check_submission(args.submission)
        if args.report:
            try:
                write_report(args.report, encoded(report), args.submission)
            except Rejected as error:
                report['errors'].append({'code': error.code, 'field': error.field, 'message': 'Report output refused.'})
                report['counts']['errors'] += 1
                report['staticChecksPassed'] = False
                exit_code = 2
    except Rejected as error:
        checker = Checker(None)
        checker.issue(error.code, error.field)
        report, exit_code = checker.finish(), 2
    sys.stdout.buffer.write(encoded(report))
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
