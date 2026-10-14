"""Adversarial bounded synthetic handoffs; never import or execute package code."""
import copy
import errno
import gzip
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/qcu-check-submission.py'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


checker = module('qcu_submission_checker', SCRIPT)
example = module('qcu_submission_example', ROOT / 'templates/qcu-submission/generate-example.py')


class SubmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-submission-tests-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'handoff'
        self.meta = example.write_handoff(self.root)
        self.input = self.root / 'submission.json'

    def save(self):
        self.input.write_bytes(example.encoded(self.meta))

    def check(self):
        self.save()
        return checker.check_submission(self.input)

    def codes(self, report, kind='errors'):
        return {item['code'] for item in report[kind]}

    def reject(self, code):
        report, status = self.check()
        self.assertEqual(status, 1, report)
        self.assertFalse(report['staticChecksPassed'])
        self.assertIn(code, self.codes(report))
        self.assertEqual(report['approval'], 'required')
        return report

    def replace_archive(self, raw, members=None):
        old = self.root / self.meta['archive']['file']
        old.unlink()
        digest = example.digest(raw)
        filename = f"{self.meta['id']}-{self.meta['version']}-{digest}.tgz"
        (self.root / filename).write_bytes(raw)
        self.meta['archive'] = {'file': filename, 'bytes': len(raw), 'sha256': digest}
        if members is not None:
            manifest = {'schemaVersion': 1, 'members': [{'path': name, 'bytes': len(body), 'sha256': example.digest(body)} for name, body in sorted(members.items())]}
            (self.root / 'members.json').write_bytes(example.encoded(manifest))

    def package_change(self, change):
        files = example.example_files()
        pkg = json.loads(files['package.json'])
        change(pkg)
        files['package.json'] = example.encoded(pkg)
        self.replace_archive(example.archive(files), files)

    def tar_entries(self, entries, fmt=tarfile.USTAR_FORMAT):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w', format=fmt) as tar:
            for name, body, kind in entries:
                row = tarfile.TarInfo(name)
                row.mode, row.size, row.type = 0o644, len(body), kind
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    row.linkname, row.size = '../outside', 0
                tar.addfile(row, io.BytesIO(body))
        return gzip.compress(buffer.getvalue(), mtime=0)

    def cli(self, *args):
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), *map(str, args)], capture_output=True, timeout=15)
        self.assertEqual(result.stderr, b'')
        self.assertNotIn(str(self.base).encode(), result.stdout)
        return result

    def test_canonical_valid_and_deterministic_no_input_writes(self):
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.iterdir()}
        report, status = checker.check_submission(self.input)
        self.assertEqual(status, 0, report)
        self.assertTrue(report['staticChecksPassed'])
        self.assertEqual(report['counts']['members'], 6)
        self.assertEqual(report, checker.check_submission(self.input)[0])
        self.assertEqual(before, {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.iterdir()})
        self.assertEqual(report['approval'], 'required')
        self.assertIn('evidence.native_review', self.codes(report, 'reviewRequirements'))

    def test_archive_byte_mismatch(self):
        self.meta['archive']['bytes'] += 1
        self.reject('archive.byte_mismatch')

    def test_archive_hash_mismatch(self):
        old = self.root / self.meta['archive']['file']
        self.meta['archive']['sha256'] = 'f' * 64
        self.meta['archive']['file'] = f"{self.meta['id']}-{self.meta['version']}-{'f'*64}.tgz"
        old.rename(self.root / self.meta['archive']['file'])
        self.reject('archive.hash_mismatch')

    def test_manifest_missing_extra_bytes_hash_and_duplicate(self):
        original = json.loads((self.root / 'members.json').read_bytes())
        for kind in ('missing', 'extra', 'bytes', 'hash', 'duplicate'):
            with self.subTest(kind=kind):
                manifest = copy.deepcopy(original)
                if kind == 'missing':
                    manifest['members'].pop()
                elif kind == 'extra':
                    manifest['members'].append({'path': 'extra.js', 'bytes': 0, 'sha256': 'f' * 64})
                elif kind == 'bytes':
                    manifest['members'][0]['bytes'] += 1
                elif kind == 'hash':
                    manifest['members'][0]['sha256'] = 'f' * 64
                else:
                    manifest['members'].append(manifest['members'][0])
                (self.root / 'members.json').write_bytes(example.encoded(manifest))
                self.reject('manifest.duplicate' if kind == 'duplicate' else 'manifest.mismatch')

    def test_duplicate_json_submission_and_package(self):
        self.input.write_bytes(b'{"schemaVersion":1,"schemaVersion":1}')
        report, status = checker.check_submission(self.input)
        self.assertEqual(status, 1)
        self.assertIn('json.duplicate_key', self.codes(report))
        files = example.example_files()
        files['package.json'] = b'{"name":"a","name":"b"}'
        self.replace_archive(example.archive(files), files)
        self.reject('json.duplicate_key')

    def test_duplicate_members(self):
        self.replace_archive(self.tar_entries([('package/a.js', b'a', tarfile.REGTYPE)] * 2))
        self.reject('archive.duplicate_member')

    def test_escaped_noncanonical_paths(self):
        for path in ('../evil.js', '/package/evil.js', 'package/../evil.js', 'package/./evil.js',
                     'package//evil.js', 'package/evil.js/', 'package\\evil.js', 'C:/package/evil.js',
                     'package/C:evil.js', 'other/evil.js'):
            with self.subTest(path=path):
                self.replace_archive(self.tar_entries([(path, b'a', tarfile.REGTYPE)]))
                self.reject('archive.path')

    def test_links_directories_and_special_members(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.DIRTYPE, tarfile.FIFOTYPE,
                     tarfile.CHRTYPE, tarfile.BLKTYPE, tarfile.XHDTYPE, tarfile.GNUTYPE_LONGNAME):
            with self.subTest(kind=kind):
                self.replace_archive(self.tar_entries([('package/evil.js', b'', kind)]))
                self.reject('archive.special_member')

    def test_gnu_format_rejected(self):
        self.replace_archive(self.tar_entries([('package/a.js', b'', tarfile.REGTYPE)], tarfile.GNU_FORMAT))
        self.reject('archive.format_unsupported')

    def test_gzip_bomb_payload_limit(self):
        self.replace_archive(gzip.compress(b'\0' * (checker.PAYLOAD_LIMIT + 1), mtime=0))
        self.reject('archive.payload_limit')

    def test_member_count_limit(self):
        self.replace_archive(self.tar_entries([(f'package/f{i}.js', b'', tarfile.REGTYPE) for i in range(checker.MEMBER_LIMIT + 1)]))
        self.reject('archive.member_limit')

    def test_member_size_limit(self):
        self.replace_archive(self.tar_entries([('package/large.js', b'a' * (checker.FILE_LIMIT + 1), tarfile.REGTYPE)]))
        self.reject('archive.member_size')

    def test_compressed_cap(self):
        path = self.root / self.meta['archive']['file']
        path.write_bytes(b'x' * (checker.ARCHIVE_LIMIT + 1))
        self.reject('file.limit')

    def test_truncated_gzip_and_tar(self):
        raw = (self.root / self.meta['archive']['file']).read_bytes()
        for sample in (raw[:-6], b'not-gzip'):
            self.replace_archive(sample)
            self.reject('archive.gzip_invalid')
        self.replace_archive(gzip.compress(gzip.decompress(raw)[:700], mtime=0))
        self.reject('archive.truncated')

    def test_trailing_archive_data(self):
        raw = (self.root / self.meta['archive']['file']).read_bytes()
        self.replace_archive(gzip.compress(gzip.decompress(raw) + b'not-zero', mtime=0))
        self.reject('archive.terminator')

    def test_header_checksum(self):
        raw = (self.root / self.meta['archive']['file']).read_bytes()
        tar = bytearray(gzip.decompress(raw))
        tar[0] ^= 1
        self.replace_archive(gzip.compress(tar, mtime=0))
        self.reject('archive.header_invalid')

    def test_exports_patch_and_files_unsafe(self):
        changes = [
            (lambda p: p.update(exports={'.': '../evil.js'}), 'package.target'),
            (lambda p: p.update(exports={'.': './missing.js'}), 'package.target_missing'),
            (lambda p: p.update(exports={'.': ['./index.js']}), 'package.exports_unsupported'),
            (lambda p: p.update(exports={'.': './**/index.js'}), 'package.pattern_unsupported'),
            (lambda p: p['dsh']['bundle'].update(patch='../outside'), 'package.patch'),
            (lambda p: p.update(files=['**/*.js']), 'package.files_pattern_unsupported'),
            (lambda p: p['files'].remove('src'), 'package.files_coverage'),
        ]
        for change, code in changes:
            with self.subTest(code=code):
                self.package_change(change)
                self.reject(code)

    def test_conditional_exports_and_bounded_wildcard(self):
        self.package_change(lambda p: p.update(exports={'.': {'import': './index.js', 'default': './index.js'}, './src/*.mjs': './src/*.mjs'}))
        report, status = self.check()
        self.assertEqual(status, 0, report)

    def test_component_default_and_config_are_separate(self):
        for patch, code in [([{'insert': [{'id': example.PRODUCT, 'name': example.PRODUCT, 'disabled': False, 'config': {'enabled': True}}]}], 'patch.default_enabled'),
                            ([{'insert': []}], 'patch.component_coverage')]:
            files = example.example_files()
            files['cordis.patch.yml'] = example.encoded(patch)
            self.replace_archive(example.archive(files), files)
            self.reject(code)

    def test_yaml_is_not_evaluated(self):
        files = example.example_files()
        files['cordis.patch.yml'] = b'- insert: !!python/object/apply:os.system [echo unsafe]\n'
        self.replace_archive(example.archive(files), files)
        self.reject('json.invalid')

    def test_metadata_placeholders_schema_and_source_revision(self):
        original = copy.deepcopy(self.meta)
        for key, value, code in [('sourceRevision', None, 'metadata.revision'), ('sourceRevision', '0' * 40, 'metadata.revision'),
                                 ('sourceRevision', 'main', 'metadata.revision'), ('templateOnly', True, 'metadata.template'),
                                 ('schemaVersion', 2, 'schema.version'), ('schemaVersion', True, 'schema.version'),
                                 ('published', True, 'metadata.published'), ('title', '待填写', 'metadata.placeholder'),
                                 ('id', '../escape', 'metadata.id'), ('version', '^0.1.0', 'metadata.version'),
                                 ('version', '1.0.0-01', 'metadata.version'), ('runtime', 'latest', 'metadata.runtime')]:
            with self.subTest(key=key, value=value):
                self.meta = copy.deepcopy(original)
                self.meta[key] = value
                self.reject(code)

    def test_wrong_types_do_not_traceback(self):
        original = copy.deepcopy(self.meta)
        for key in original:
            for wrong in (None, [], {}, 2, True):
                if wrong == original[key] and type(wrong) is type(original[key]):
                    continue
                with self.subTest(key=key, wrong=wrong):
                    self.meta = copy.deepcopy(original)
                    self.meta[key] = wrong
                    report, status = self.check()
                    # Some empty collections are valid declarations; no exception is allowed.
                    self.assertIn(status, (0, 1))
                    self.assertIsInstance(report, dict)

    def test_json_depth_size_and_string_limits(self):
        for raw, code in [(b'[' * 30 + b'0' + b']' * 30, 'json.depth'),
                          (b'x' * (checker.JSON_LIMIT + 1), 'file.limit'),
                          (json.dumps({'x': 'a' * 8193}).encode(), 'json.string_limit'),
                          (b'{"x":NaN}', 'json.invalid'), (b'{"x":1.2}', 'json.number')]:
            self.input.write_bytes(raw)
            report, status = checker.check_submission(self.input)
            self.assertEqual(status, 1)
            self.assertIn(code, self.codes(report))

    def test_dependencies_mismatch_pins_and_lock(self):
        self.package_change(lambda p: p['peerDependencies'].update({'@deepseek-ai/cordis': '4.0.3'}))
        self.reject('dependency.cordis_version')
        self.package_change(lambda p: p['peerDependencies'].update({'@deepseek-ai/dsh-scope': '^0.2.0-rc.2'}))
        self.reject('dependency.unpinned')
        self.package_change(lambda p: p['peerDependencies'].update({'@deepseek-ai/dsh-scope': '0.2.0-rc.1'}))
        self.reject('dependency.dsh_version')
        self.package_change(lambda p: p['peerDependencies'].update({'@deepseek-ai/cosmokit': '1.8.5'}))
        self.reject('package.dependency_mismatch')
        self.meta['runtimeDependencies'] = {'some-unknown-service': '1.2.3'}
        self.package_change(lambda p: p.update(dependencies=self.meta['runtimeDependencies']))
        report = self.reject('dependency.lock_required')
        self.assertIn('dependency.unknown', self.codes(report, 'reviewRequirements'))

    def test_optional_bundled_and_native_rejected(self):
        for name, value in [('optionalDependencies', {'native': '1.0.0'}), ('bundledDependencies', ['native']), ('bin', './index.js')]:
            with self.subTest(name=name):
                self.package_change(lambda p: p.update({name: value}))
                report, status = self.check()
                self.assertEqual(status, 1)
                self.assertIn('package.native_or_optional_unsupported', self.codes(report, 'unsupported'))
        self.meta['peerDependencies'] = {**example.PEERS, 'sharp': '1.0.0'}
        self.package_change(lambda p: p.update(peerDependencies=self.meta['peerDependencies']))
        report, status = self.check()
        self.assertEqual(status, 1)
        self.assertIn('dependency.native', self.codes(report, 'unsupported'))

    def test_scripts_must_match_and_never_execute(self):
        sentinel = self.base / 'SHOULD-NOT-EXIST'
        command = f'touch {sentinel}'  # synthetic body, never passed to a shell
        self.package_change(lambda p: p.update(scripts={'preinstall': command, 'prepare': command}))
        report = self.reject('package.script_mismatch')
        self.assertNotIn(command, json.dumps(report))
        self.meta['installScripts'] = [{'name': n, 'command': command} for n in ('preinstall', 'prepare')]
        report, status = self.check()
        self.assertEqual(status, 0, report)
        self.assertIn('scripts.execution_review', self.codes(report, 'reviewRequirements'))
        self.assertFalse(sentinel.exists())
        self.assertNotIn(command, json.dumps(report))

    def test_secret_patterns_and_denied_names_are_redacted(self):
        for secret in (b'-----BEGIN OPENSSH PRIVATE KEY-----', b'ghp_' + b'A' * 36, b'sk-' + b'B' * 40, b'AKIA' + b'C' * 16):
            files = example.example_files()
            files['index.js'] += b'\n// ' + secret
            self.replace_archive(example.archive(files), files)
            report = self.reject('secret.pattern')
            self.assertNotIn(secret.decode(), json.dumps(report))
        for name in ('node_modules/a.js', '.git/config.json', '.env', 'credentials.json', 'Home/a.js', 'logs/a.txt', 'bin/native.node', 'key.pem'):
            files = example.example_files()
            files[name] = b'synthetic only'
            self.replace_archive(example.archive(files), files)
            report, status = self.check()
            self.assertEqual(status, 1)
            self.assertTrue(self.codes(report) & {'archive.denied_filename', 'archive.file_type_unsupported'})
            self.assertNotIn(name, json.dumps(report))

    def test_binary_and_executable_modes(self):
        files = example.example_files()
        files['index.js'] = b'\x7fELF\0\0'
        self.replace_archive(example.archive(files), files)
        self.reject('archive.binary_unsupported')
        tar = io.BytesIO()
        with tarfile.open(fileobj=tar, mode='w', format=tarfile.USTAR_FORMAT) as file:
            item = tarfile.TarInfo('package/index.js')
            item.mode = 0o755
            file.addfile(item, io.BytesIO(b''))
        self.replace_archive(gzip.compress(tar.getvalue(), mtime=0))
        self.reject('archive.mode_or_link')

    def test_reference_containment_and_symlinks(self):
        original = self.meta['materials']['spec']
        for value in ('../outside.md', '/tmp/private.md', 'https://example.invalid/evidence', 'dir/../PLUGIN-SPEC.md', 'dir\\file.md'):
            self.meta['materials']['spec'] = value
            self.reject('reference.unsafe')
        (self.base / 'outside.md').write_bytes(b'should not read')
        (self.root / 'symlink.md').symlink_to(self.base / 'outside.md')
        self.meta['materials']['spec'] = 'symlink.md'
        self.reject('reference.unreadable_or_unsafe')
        (self.root / 'ancestor').symlink_to(self.base, target_is_directory=True)
        self.meta['materials']['spec'] = 'ancestor/outside.md'
        self.reject('reference.missing_or_unsafe')
        self.meta['materials']['spec'] = original
        alias = self.base / 'alias'
        alias.symlink_to(self.root, target_is_directory=True)
        report, status = checker.check_submission(alias / 'submission.json')
        self.assertEqual(status, 2)
        self.assertIn('io.directory', self.codes(report))

    def test_reference_regular_and_size(self):
        (self.root / 'directory').mkdir()
        self.meta['materials']['spec'] = 'directory'
        self.reject('reference.regular_file_required')
        (self.root / 'large.md').write_bytes(b'x' * (checker.FILE_LIMIT + 1))
        self.meta['materials']['spec'] = 'large.md'
        self.reject('file.limit')
        os.mkfifo(self.root / 'pipe')
        self.meta['materials']['spec'] = 'pipe'
        self.reject('reference.regular_file_required')

    def test_passed_evidence_never_approves_missing_and_failed(self):
        for item in self.meta['testEvidence'].values():
            item['status'] = 'passed'
        report, status = self.check()
        self.assertEqual(status, 0)
        self.assertEqual(report['approval'], 'required')
        self.assertIn('evidence.teacher_review', self.codes(report, 'reviewRequirements'))
        self.meta['testEvidence']['liveInstall'] = None
        report, status = self.check()
        self.assertEqual(status, 0)
        self.assertIn('evidence.missing', self.codes(report, 'reviewRequirements'))
        self.meta['testEvidence']['businessAcceptance']['status'] = 'failed'
        self.reject('evidence.failed')

    def test_cli_help_zero_one_two_json_and_output(self):
        result = self.cli('--help')
        self.assertEqual(result.returncode, 0)
        self.assertIn(b'without executing', result.stdout)
        report_path = self.base / 'report.json'
        result = self.cli('--submission', self.input, '--report', report_path)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, report_path.read_bytes())
        self.meta['templateOnly'] = True
        self.save()
        self.assertEqual(self.cli('--submission', self.input).returncode, 1)
        for args in ([], ['--arbitrary', '/private/sensitive'], ['--submission', self.base / 'missing.json']):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2)
            self.assertIsInstance(json.loads(result.stdout), dict)

    def test_report_existing_input_tree_and_symlink_refused_atomically(self):
        before = self.input.read_bytes()
        existing = self.base / 'existing.json'
        existing.write_bytes(b'keep')
        alias = self.base / 'out-link'
        alias.symlink_to(self.base, target_is_directory=True)
        for output in (existing, self.input, self.root / 'new.json', self.base / 'missing' / 'new.json', alias / 'new.json'):
            result = self.cli('--submission', self.input, '--report', output)
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertFalse(json.loads(result.stdout)['staticChecksPassed'])
        self.assertEqual(self.input.read_bytes(), before)
        self.assertEqual(existing.read_bytes(), b'keep')
        self.assertFalse((self.root / 'new.json').exists())
        self.assertFalse((self.base / 'new.json').exists())
        self.assertFalse(list(self.base.glob('.qcu-report-*')))

    def test_cli_untrusted_errors_have_no_path_secret_or_traceback(self):
        secret = 'ghp_' + 'Q' * 36
        self.input.write_text('{"untrusted": "' + secret + '", broken ' + str(self.base))
        result = self.cli('--submission', self.input)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(secret.encode(), result.stdout)
        self.assertNotIn(b'Traceback', result.stdout)

    def test_nested_schema_types_and_missing_fields(self):
        original = copy.deepcopy(self.meta)
        cases = [('archive', {'file': [], 'bytes': True, 'sha256': {}}),
                 ('materials', {**original['materials'], 'memberManifest': []}),
                 ('testEvidence', {**original['testEvidence'], 'source': {'status': [], 'file': {}}}),
                 ('installScripts', [{'name': {}, 'command': []}]),
                 ('peerDependencies', {'pinned': []})]
        for name, value in cases:
            with self.subTest(name=name):
                self.meta = copy.deepcopy(original)
                self.meta[name] = value
                report, status = self.check()
                self.assertEqual(status, 1)
                self.assertTrue(report['errors'])
        self.meta = copy.deepcopy(original)
        del self.meta['runtime']
        self.reject('schema.fields')

    def test_package_types_mandatory_metadata_and_permissions(self):
        for change, code in [(lambda p: p.update(exports=[]), 'package.exports_type'),
                             (lambda p: p.update(dsh=[]), 'package.dsh'),
                             (lambda p: p.update(files={}), 'package.files_type'),
                             (lambda p: p.update(scripts=[]), 'package.scripts_type'),
                             (lambda p: p.update(permissionSummary=['Different']), 'package.permissions_mismatch'),
                             (lambda p: p.update(license='ISC'), 'package.identity_mismatch')]:
            with self.subTest(code=code):
                self.package_change(change)
                self.reject(code)
        files = example.example_files()
        del files['README.md']
        self.replace_archive(example.archive(files), files)
        self.reject('package.mandatory_files')

    def test_client_and_skill_are_statically_limited(self):
        self.package_change(lambda p: p['dsh'].update(client={'platform': 'web', 'inject': ['undeclared-service']}))
        self.reject('package.client_inject')
        self.package_change(lambda p: p['dsh'].update(client={'platform': 'web', 'inject': ['@deepseek-ai/dsh-scope']}))
        report, status = self.check()
        self.assertEqual(status, 0, report)
        self.assertIn('package.client_review', self.codes(report, 'reviewRequirements'))
        self.meta['productType'] = 'skill'
        self.meta['skills'] = [example.PRODUCT]
        self.reject('skill.instructions_missing')

    def test_reference_secret_and_evidence_file_required(self):
        secret = b'ghp_' + b'R' * 36
        (self.root / 'SOURCE.md').write_bytes(b'synthetic ' + secret)
        report = self.reject('secret.pattern')
        self.assertNotIn(secret.decode(), json.dumps(report))
        (self.root / 'SOURCE.md').write_bytes(b'synthetic source')
        self.meta['testEvidence']['source']['file'] = None
        self.reject('evidence.file_required')

    def test_failed_report_publish_cleans_temporary_file(self):
        output = self.base / 'new-report.json'
        with mock.patch.object(checker.os, 'link', side_effect=OSError('Synthetic write failure, private detail')):
            with self.assertRaises(checker.Rejected) as result:
                checker.write_report(output, b'{}', self.input)
            self.assertEqual(result.exception.code, 'report.write_refused')
        self.assertFalse(output.exists())
        self.assertFalse(list(self.base.glob('.qcu-report-*')))

    def test_ustar_hidden_path_bytes_and_numeric_extensions(self):
        raw = (self.root / self.meta['archive']['file']).read_bytes()
        for kind in ('path', 'number'):
            tar = bytearray(gzip.decompress(raw))
            if kind == 'path':
                tar[50] = ord('X')  # after the filename NUL, before field end
                code = 'archive.header_noncanonical'
            else:
                tar[124] = 128  # unsupported base256 numeric extension
                code = 'archive.numeric_extension'
            tar[148:156] = b'        '
            checksum = sum(tar[:512])
            tar[148:156] = f'{checksum:06o}\0 '.encode()
            self.replace_archive(gzip.compress(tar, mtime=0))
            self.reject(code)

    def test_exact_wrapper_license_member(self):
        files = example.example_files()
        files['WRAPPER-LICENSE'] = b'MIT License\nSynthetic wrapper license regression fixture.\n'
        pkg = json.loads(files['package.json'])
        pkg['files'].append('WRAPPER-LICENSE')
        files['package.json'] = example.encoded(pkg)
        self.replace_archive(example.archive(files), files)
        report, status = self.check()
        self.assertEqual(status, 0, report)
        self.assertEqual(report['counts']['members'], 7)
        self.assertEqual(report['approval'], 'required')
        # This exception must still use exact files and independent manifest coverage.
        pkg['files'].remove('WRAPPER-LICENSE')
        files['package.json'] = example.encoded(pkg)
        self.replace_archive(example.archive(files), files)
        self.reject('package.files_coverage')
        pkg['files'].append('WRAPPER-LICENSE')
        files['package.json'] = example.encoded(pkg)
        self.replace_archive(example.archive(files), example.example_files())
        self.reject('manifest.mismatch')

    def test_wrapper_license_does_not_allow_other_names_or_binary_or_secrets(self):
        for name, body, code in [('wrapper-license', b'Synthetic', 'archive.file_type_unsupported'),
                                 ('WRAPPER-LICENSE-EXTRA', b'Synthetic', 'archive.file_type_unsupported'),
                                 ('UNREVIEWED', b'Synthetic', 'archive.file_type_unsupported'),
                                 ('WRAPPER-LICENSE', b'\xff', 'archive.binary_unsupported'),
                                 ('WRAPPER-LICENSE', b'sk-' + b'Y' * 28, 'secret.pattern')]:
            with self.subTest(name=name, code=code):
                files = example.example_files()
                files[name] = body
                self.replace_archive(example.archive(files), files)
                self.reject(code)

    def test_header_secret_uname_gname_name_redacted(self):
        original = gzip.decompress(example.archive(example.example_files()))
        token = b'sk-' + b'Z' * 28  # synthetic marker, never a credential
        for field, start, width in [('uname', 265, 32), ('gname', 297, 32), ('name', 0, 100)]:
            with self.subTest(field=field):
                tar = bytearray(original)
                value = b'package/' + token + b'.txt' if field == 'name' else token
                tar[start:start + width] = value.ljust(width, b'\0')
                tar[148:156] = b'        '
                tar[148:156] = f'{sum(tar[:512]):06o}\0 '.encode()
                raw = gzip.compress(tar, mtime=0)
                # Isolate header scanning from manifest/path/package checks so a
                # rejection elsewhere cannot disguise a missed header token.
                direct = checker.Checker(None)
                direct.archive(raw)
                report = direct.finish()
                self.assertIn({'code': 'secret.pattern', 'field': 'archive.headers',
                               'message': 'Static input requirement not satisfied.'}, report['errors'])
                self.assertFalse(report['staticChecksPassed'])
                self.assertNotIn(token.decode(), json.dumps(report))
                self.replace_archive(raw)
                self.save()
                result = self.cli('--submission', self.input)
                self.assertEqual(result.returncode, 1)
                self.assertNotIn(token, result.stdout)
                self.assertIn('archive.headers', {item['field'] for item in json.loads(result.stdout)['errors']})

    def test_empty_permissions_have_explicit_review_never_approval(self):
        self.meta['permissionSummary'] = []
        report, status = self.check()
        self.assertEqual(status, 0, report)
        self.assertTrue(report['staticChecksPassed'])
        self.assertEqual(report['approval'], 'required')
        self.assertIn('permissions.summary_missing', self.codes(report, 'reviewRequirements'))
        self.assertIn('permissions.review', self.codes(report, 'reviewRequirements'))

    def test_empty_packaged_readme_and_license_rejected(self):
        for name in ('README.md', 'LICENSE'):
            with self.subTest(name=name):
                files = example.example_files()
                files[name] = b' \n\t'
                self.replace_archive(example.archive(files), files)
                self.reject('package.empty_metadata')

    def test_gzip_filename_secret_cli_redacted_in_stdout_and_report(self):
        token = b'sk-' + b'Z' * 28  # synthetic gzip filename, no real credential
        tar = gzip.decompress(example.archive(example.example_files()))
        buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode='wb', mtime=0, filename=token.decode()) as stream:
            stream.write(tar)
        self.replace_archive(buffer.getvalue())
        self.save()
        output = self.base / 'gzip-secret-report.json'
        result = self.cli('--submission', self.input, '--report', output)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, output.read_bytes())
        self.assertNotIn(token, result.stdout)
        self.assertNotIn(token, output.read_bytes())
        report = json.loads(result.stdout)
        self.assertIn('secret.pattern', self.codes(report))
        self.assertIn('archive.gzipHeaders', {item['field'] for item in report['errors']})
        self.assertFalse(report['staticChecksPassed'])
        self.assertEqual(report['approval'], 'required')
        self.assertEqual(report['counts']['members'], 6)

    def test_gzip_extra_name_comment_fields_scanned_with_binary_boundaries(self):
        token = b'sk-' + b'G' * 28
        original = example.archive(example.example_files())
        for flag, metadata in [(4, len(token).to_bytes(2, 'little') + token),
                               (8, token + b'\0'), (16, token + b'\0')]:
            with self.subTest(flag=flag):
                fixed = bytearray(original[:10])
                fixed[3], fixed[9] = flag, ord('A')  # no raw word boundary before optional field
                raw = bytes(fixed) + metadata + original[10:]
                self.replace_archive(raw)
                self.save()
                result = self.cli('--submission', self.input)
                self.assertEqual(result.returncode, 1)
                report = json.loads(result.stdout)
                self.assertIn('secret.pattern', self.codes(report))
                self.assertEqual(report['counts']['members'], 6)
                self.assertNotIn(token, result.stdout)

    def test_gzip_truncated_optional_metadata_rejected_without_traceback(self):
        fixed = bytearray(example.archive(example.example_files())[:10])
        for flag, metadata in [(4, b'\xff'), (4, b'\xff\xffx'),
                               (8, b'unterminated'), (16, b'unterminated')]:
            with self.subTest(flag=flag, size=len(metadata)):
                fixed[3] = flag
                self.replace_archive(bytes(fixed) + metadata)
                self.save()
                result = self.cli('--submission', self.input)
                self.assertEqual(result.returncode, 1)
                self.assertIn('archive.gzip_invalid', self.codes(json.loads(result.stdout)))
                self.assertNotIn(b'Traceback', result.stdout)

    def test_report_temp_create_denial_api_sanitized_and_directory_closed(self):
        before = {p.name: p.read_bytes() for p in self.root.iterdir()}
        output = self.base / 'new-report.json'
        existing = self.base / 'existing-report.json'
        existing.write_bytes(b'preserve existing output')
        real_open, denied = checker.os.open, []
        marker = 'SYNTHETIC-RECEIVED-OUTPUT-DENIAL'

        def deny_temp(path, *args, **kwargs):
            if isinstance(path, str) and path.startswith('.qcu-report-'):
                denied.append(kwargs['dir_fd'])
                raise PermissionError(marker + ' ' + str(self.base))
            return real_open(path, *args, **kwargs)

        with mock.patch.object(checker.os, 'open', side_effect=deny_temp):
            with self.assertRaises(checker.Rejected) as caught:
                checker.write_report(output, b'{"received":"never echo this body"}', self.input)
        self.assertEqual(caught.exception.code, 'report.write_refused')
        self.assertEqual(caught.exception.field, 'report')
        self.assertTrue(caught.exception.io_failure)
        self.assertNotIn(marker, str(caught.exception))
        self.assertEqual(len(denied), 1)
        with self.assertRaises(OSError) as closed:
            os.fstat(denied[0])
        self.assertEqual(closed.exception.errno, errno.EBADF)
        self.assertFalse(output.exists())
        self.assertFalse(list(self.base.glob('.qcu-report-*')))
        self.assertEqual(existing.read_bytes(), b'preserve existing output')
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir()})

    def test_report_temp_create_denial_real_main_exit2_redacted_no_partial(self):
        before = {p.name: p.read_bytes() for p in self.root.iterdir()}
        existing = self.base / 'existing-report.json'
        existing.write_bytes(b'preserve existing output')
        real_open = checker.os.open
        marker = 'SYNTHETIC-RECEIVED-OUTPUT-DENIAL'

        for output in (self.base / 'new-report.json', existing):
            with self.subTest(existing=output == existing):
                denied = []

                def deny_temp(path, *args, **kwargs):
                    if isinstance(path, str) and path.startswith('.qcu-report-'):
                        denied.append(kwargs['dir_fd'])
                        raise PermissionError(marker + ' ' + str(self.base))
                    return real_open(path, *args, **kwargs)

                stdout = io.TextIOWrapper(io.BytesIO(), encoding='utf-8')
                stderr = io.StringIO()
                with mock.patch.object(checker.os, 'open', side_effect=deny_temp), \
                        mock.patch.object(checker.sys, 'stdout', stdout), \
                        mock.patch.object(checker.sys, 'stderr', stderr):
                    status = checker.main(['--submission', str(self.input), '--report', str(output)])
                received = stdout.buffer.getvalue()
                stdout.close()
                self.assertEqual(status, 2)
                report = json.loads(received)
                self.assertIn('report.write_refused', self.codes(report))
                self.assertFalse(report['staticChecksPassed'])
                self.assertEqual(report['approval'], 'required')
                self.assertEqual(stderr.getvalue(), '')
                for value in (marker.encode(), str(self.base).encode(), b'Traceback'):
                    self.assertNotIn(value, received)
                self.assertEqual(len(denied), 1)
                with self.assertRaises(OSError) as closed:
                    os.fstat(denied[0])
                self.assertEqual(closed.exception.errno, errno.EBADF)
                self.assertFalse(list(self.base.glob('.qcu-report-*')))
                self.assertEqual(existing.read_bytes(), b'preserve existing output')
                self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir()})
                if output != existing:
                    self.assertFalse(output.exists())

    def test_report_missing_created_temp_cleanup_stays_sanitized_and_closes_directory(self):
        output = self.base / 'new-report.json'
        real_open, directories = checker.os.open, []

        def remove_created_temp(path, *args, **kwargs):
            fd = real_open(path, *args, **kwargs)
            if isinstance(path, str) and path.startswith('.qcu-report-'):
                directories.append(kwargs['dir_fd'])
                # Simulate an external removal after creation. Writing the fd
                # still works, but both publication and final unlink now fail.
                os.unlink(path, dir_fd=kwargs['dir_fd'])
            return fd

        with mock.patch.object(checker.os, 'open', side_effect=remove_created_temp):
            with self.assertRaises(checker.Rejected) as caught:
                checker.write_report(output, b'{}', self.input)
        self.assertEqual(caught.exception.code, 'report.write_refused')
        self.assertTrue(caught.exception.io_failure)
        self.assertEqual(len(directories), 1)
        with self.assertRaises(OSError) as closed:
            os.fstat(directories[0])
        self.assertEqual(closed.exception.errno, errno.EBADF)
        self.assertFalse(output.exists())
        self.assertFalse(list(self.base.glob('.qcu-report-*')))


if __name__ == '__main__':
    unittest.main()
