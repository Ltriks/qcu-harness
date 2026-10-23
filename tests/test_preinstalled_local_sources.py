"""Build-only safety and relocation checks; no package execution or installation."""
import copy
from contextlib import contextmanager
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_sources', Path(__file__).resolve().parents[1] / 'scripts/prepare-preinstalled-local-sources.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
INPUTS = Path(__file__).resolve().parents[1] / '.work/preinstalled-proof-inputs'
INPUTS_SHA = 'b06e8167b009fc9b708fbdee801d7c3cc945326c4d6a84c601c47791a3ef5eec'
TEACHER_SHA = 'b3dac199cf39787b6b4d3897adaec085b8a5eb6e1b444e2acc5259729813b7c3'


@contextmanager
def observe_input_opens(inputs, forbidden=lambda name: False):
    """Catch content opens through both the old Path reader and the bounded reader."""
    opened = []
    path_open, os_open = Path.open, os.open

    def check(path):
        name = Path(path).relative_to(inputs).as_posix()
        opened.append(name)
        if forbidden(name):
            raise AssertionError('forbidden input content open: ' + name)

    def traced_path(path, *args, **kwargs):
        check(path)
        return path_open(path, *args, **kwargs)

    def traced_os(path, *args, **kwargs):
        check(path)
        return os_open(path, *args, **kwargs)

    with patch.object(Path, 'open', traced_path), patch.object(os, 'open', traced_os):
        yield opened


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-source-prep-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def prepare(self, inputs=INPUTS, output=None, inventory_sha=INPUTS_SHA):
        return helper.prepare(inputs, output or self.root / 'prepared', inventory_sha, TEACHER_SHA)

    def clone(self):
        return Path(shutil.copytree(INPUTS, self.root / 'inputs'))

    def test_exact_seed_contents_sources_order_and_relocation(self):
        a, b = self.root / 'a', self.root / 'elsewhere' / 'b'
        report = self.prepare(output=a)
        self.prepare(output=b)
        original = json.loads((INPUTS / 'profile-template/package.json').read_text())
        prepared = json.loads((a / 'package.json').read_text())
        self.assertEqual(prepared['dsh'], original['dsh'])
        self.assertEqual(list(prepared['dependencies']), list(original['dependencies']))
        self.assertEqual(report['installed'], False)
        policy = (a / 'pnpm-workspace.yaml').read_bytes()
        self.assertEqual(json.loads(policy), {'autoInstallPeers': False, 'ignoreScripts': True})
        self.assertIn({'path': 'pnpm-workspace.yaml', 'bytes': len(policy), 'sha256': helper.sha(policy)}, report['files'])
        for source in report['sources']:
            relative = prepared['dependencies'][source['id']].removeprefix('file:./')
            data = (b / relative).read_bytes()
            self.assertEqual(helper.sha(data), source['sha256'])
            if source['id'] != 'qcu-branding':
                self.assertEqual(data, (INPUTS / 'archives' / source['file']).read_bytes())
        self.assertEqual({p.relative_to(a): p.read_bytes() for p in a.rglob('*') if p.is_file()}, {p.relative_to(b): p.read_bytes() for p in b.rglob('*') if p.is_file()})
        for name in ('cordis.yml', 'cordis.patch.yml'):
            self.assertEqual((a / name).read_bytes(), (INPUTS / 'profile-template' / name).read_bytes())

    def test_existing_output_is_preserved_including_empty_directory(self):
        out = self.root / 'prepared'
        out.mkdir()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.prepare(output=out)
        (out / 'sentinel').write_bytes(b'preserve exactly')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.prepare(output=out)
        self.assertEqual(list(out.iterdir()), [out / 'sentinel'])
        self.assertEqual((out / 'sentinel').read_bytes(), b'preserve exactly')

    def test_altered_or_missing_sources_rejected_before_output(self):
        inputs = self.clone()
        archive = next((inputs / 'archives').iterdir())
        original = archive.read_bytes()
        archive.write_bytes(bytes([original[0] ^ 1]) + original[1:])
        with self.assertRaisesRegex(ValueError, 'hash/size mismatch'):
            self.prepare(inputs)
        archive.write_bytes(original + b'tampered')
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            self.prepare(inputs)
        self.assertFalse((self.root / 'prepared').exists())
        archive.unlink()
        with self.assertRaisesRegex(ValueError, 'missing source'):
            self.prepare(inputs)
        self.assertFalse((self.root / 'prepared').exists())

    def test_unknown_sentinel_content_is_never_opened(self):
        inputs = self.clone()
        (inputs / 'public-review-sentinel.txt').write_text('synthetic public sentinel')
        with observe_input_opens(inputs, lambda name: name == 'public-review-sentinel.txt') as opened:
            with self.assertRaisesRegex(ValueError, 'unexpected source'):
                self.prepare(inputs)
        self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])

    def test_unknown_directory_and_special_file_are_not_read_or_traversed(self):
        inputs = self.clone()
        extra = inputs / 'unknown'
        extra.mkdir()
        (extra / 'public-sentinel').write_text('public fixture')
        scandir = os.scandir

        def guard(path):
            self.assertNotEqual(Path(path), extra, 'must not descend into an unknown directory')
            return scandir(path)

        with patch.object(os, 'scandir', guard), observe_input_opens(inputs) as opened:
            with self.assertRaisesRegex(ValueError, 'unexpected source'):
                self.prepare(inputs)
        self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])
        shutil.rmtree(extra)
        os.mkfifo(extra)
        with observe_input_opens(inputs, lambda name: name == 'unknown') as opened:
            with self.assertRaisesRegex(ValueError, 'unsafe source type'):
                self.prepare(inputs)
        self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])

    def test_wrong_inventory_hash_prevents_payload_opens_and_traversal(self):
        inputs = self.clone()
        for inventory in ('INPUTS.json', 'teacher-manifest.json'):
            with self.subTest(inventory=inventory):
                original = (inputs / inventory).read_bytes()
                (inputs / inventory).write_bytes(original + b' ')
                with patch.object(Path, 'rglob', side_effect=AssertionError('tree traversal')), patch.object(os, 'scandir', side_effect=AssertionError('tree traversal')), observe_input_opens(inputs, lambda name: name not in ('INPUTS.json', 'teacher-manifest.json')) as opened:
                    with self.assertRaisesRegex(ValueError, 'untrusted'):
                        self.prepare(inputs)
                self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])
                (inputs / inventory).write_bytes(original)

    def test_missing_inventory_fails_before_tree_traversal_or_payload_read(self):
        # Synthetic used-Home shape only; never selects an actual Home.
        for missing in ('INPUTS.json', 'teacher-manifest.json'):
            with self.subTest(missing=missing):
                inputs = self.root / missing
                inputs.mkdir()
                (inputs / 'public-history-sentinel').write_text('synthetic public history')
                present = 'teacher-manifest.json' if missing == 'INPUTS.json' else 'INPUTS.json'
                shutil.copyfile(INPUTS / present, inputs / present)
                with patch.object(Path, 'rglob', side_effect=AssertionError('tree traversal')), patch.object(os, 'scandir', side_effect=AssertionError('tree traversal')), observe_input_opens(inputs, lambda name: name not in ('INPUTS.json', 'teacher-manifest.json')) as opened:
                    with self.assertRaises(FileNotFoundError):
                        self.prepare(inputs)
                self.assertEqual(opened, [] if missing == 'INPUTS.json' else ['INPUTS.json'])

    def test_oversized_inventories_are_rejected_without_opening_them(self):
        inputs = self.clone()
        for name in ('INPUTS.json', 'teacher-manifest.json'):
            with self.subTest(inventory=name):
                original = (inputs / name).read_bytes()
                (inputs / name).write_bytes(b' ' * (helper.MAX_INVENTORY_BYTES + 1))
                with observe_input_opens(inputs, lambda opened: opened == name) as opened:
                    with self.assertRaisesRegex(ValueError, 'size bound'):
                        self.prepare(inputs)
                self.assertNotIn(name, opened)
                (inputs / name).write_bytes(original)

    def test_declared_per_file_and_aggregate_limits_precede_payload_reads(self):
        inputs = self.clone()
        original = json.loads((inputs / 'INPUTS.json').read_bytes())
        for aggregate in (False, True):
            with self.subTest(aggregate=aggregate):
                inventory = copy.deepcopy(original)
                for product in inventory['products'] if aggregate else inventory['products'][:1]:
                    product['bytes'] = helper.MAX_INPUT_FILE_BYTES + (0 if aggregate else 1)
                data = json.dumps(inventory).encode()
                (inputs / 'INPUTS.json').write_bytes(data)
                with observe_input_opens(inputs, lambda name: name not in ('INPUTS.json', 'teacher-manifest.json')) as opened:
                    with self.assertRaisesRegex(ValueError, 'aggregate source size bound' if aggregate else 'declared source size bound'):
                        self.prepare(inputs, inventory_sha=helper.sha(data))
                self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])

    def test_actual_size_mismatch_is_rejected_before_payload_opens(self):
        inputs = self.clone()
        archive = next((inputs / 'archives').iterdir())
        for size in (archive.stat().st_size + 1, helper.MAX_INPUT_FILE_BYTES + 1):
            with self.subTest(size=size):
                with archive.open('wb') as stream:
                    stream.truncate(size)
                with observe_input_opens(inputs, lambda name: name not in ('INPUTS.json', 'teacher-manifest.json')) as opened:
                    with self.assertRaisesRegex(ValueError, 'size mismatch'):
                        self.prepare(inputs)
                self.assertEqual(opened, ['INPUTS.json', 'teacher-manifest.json'])

    def test_growing_file_read_is_bounded_even_after_metadata_checks(self):
        source = self.root / 'growing'
        source.write_bytes(b'public')
        fdopen = os.fdopen
        requests = []

        def grow(fd, mode):
            # Simulate growth after the lstat/open checks, with stale fstat size.
            with source.open('ab') as stream:
                stream.write(b' extra public bytes')
            stream = fdopen(fd, mode)
            read = stream.read

            def bounded(size=-1):
                requests.append(size)
                self.assertEqual(size, 7)
                return read(size)

            stream.read = bounded
            return stream

        info = source.stat()
        with patch.object(os, 'fdopen', grow), patch.object(os, 'fstat', return_value=info):
            with self.assertRaisesRegex(ValueError, 'size bound'):
                helper.bounded_read(source, 6)
        self.assertEqual(requests, [7])

    def test_arbitrary_profile_files_and_symlinks_rejected(self):
        inputs = self.clone()
        extra = inputs / '.npmrc'
        extra.write_text('synthetic account data must never be copied')
        with self.assertRaisesRegex(ValueError, 'unexpected source'):
            self.prepare(inputs)
        extra.unlink()
        extra.symlink_to(INPUTS / 'INPUTS.json')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.prepare(inputs)
        extra.unlink()
        (self.root / 'link').symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.prepare(output=self.root / 'link' / 'new')
        self.assertFalse((self.root / 'prepared').exists())

    def test_identity_and_inventory_trust_are_checked(self):
        inputs = self.clone()
        with self.assertRaisesRegex(ValueError, 'untrusted'):
            self.prepare(inputs, inventory_sha='0' * 64)
        inventory = json.loads((inputs / 'INPUTS.json').read_text())
        inventory['products'][0]['id'] = 'qcu-not-the-declared-package'
        data = json.dumps(inventory).encode()
        (inputs / 'INPUTS.json').write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'identities'):
            self.prepare(inputs, inventory_sha=helper.sha(data))
        with self.assertRaisesRegex(ValueError, 'identity'):
            helper.identity({'package.json': b'{"name":"wrong","version":"1"}'}, 'expected', '1')
        self.assertFalse((self.root / 'prepared').exists())

    def test_input_output_traversal_and_overlap_rejected(self):
        for inputs, output in [(INPUTS, self.root / '..' / 'escaped'), (INPUTS, INPUTS / 'nested-output'), (INPUTS / '..', self.root / 'prepared')]:
            with self.assertRaisesRegex(ValueError, 'unsafe|overlap'):
                self.prepare(inputs, output=output)
        self.assertFalse((self.root / 'prepared').exists())

    def test_archive_traversal_symlinks_duplicates_and_unsafe_names(self):
        for name, kind in [('package/../escape', 'file'), ('/package/absolute', 'file'), ('package/link', 'symlink'), ('package/hard', 'hardlink'), ('package/duplicate', 'duplicate')]:
            with self.subTest(name=name):
                out = io.BytesIO()
                with tarfile.open(fileobj=out, mode='w:gz') as tar:
                    entry = tarfile.TarInfo(name)
                    if kind == 'symlink':
                        entry.type, entry.linkname = tarfile.SYMTYPE, '/outside'
                    elif kind == 'hardlink':
                        entry.type, entry.linkname = tarfile.LNKTYPE, 'package/file'
                    tar.addfile(entry)
                    if kind == 'duplicate':
                        tar.addfile(copy.copy(entry))
                with self.assertRaisesRegex(ValueError, 'unsafe|duplicate'):
                    helper.archive_files(out.getvalue())


if __name__ == '__main__':
    unittest.main()
