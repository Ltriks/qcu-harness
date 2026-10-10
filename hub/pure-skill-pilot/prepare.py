"""Offline fixed package preparation only. No Home, network, CLI or App access."""
import hashlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ID = 'qcu-study-coach-text-pilot'
VERSION = '0.1.0-pilot.2'
SOURCE = ROOT / 'skills/chengyuan-study-coach/SKILL.md'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def payload():
    original = SOURCE.read_bytes()
    if sha(original) != 'dfd2fac7624c2f46f0bdcb15c7ea475156082d538b44d023f39b7e445e42de32':
        raise ValueError('canonical-source-drift')
    license_text = (ROOT / 'LICENSE').read_bytes()
    if sha(license_text) != '79832ece489707e2f1c9d5ddeaa9c38958a3bbce2a0d5b67645af5a4039ad787':
        raise ValueError('license-drift')
    text = original.decode('utf-8')
    old = 'name: chengyuan-study-coach\n'
    assert text.count(old) == 1
    text = text.replace(old, f'name: {ID}\nmetadata:\n  version: "{VERSION}"\n', 1)
    text = text.replace('城院', 'QCU')
    return {f'{ID}/SKILL.md': text.encode(), f'{ID}/LICENSE.txt': license_text}


def archive(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 10, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    return output.getvalue()


def validate(data, expected):
    # Fixed two-file acceptance artifact, not a general archive installer.
    if len(data) > 65536:
        raise ValueError('archive-size')
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries = z.infolist()
        names = [e.filename for e in entries]
        if len(names) != len(set(names)) or set(names) != set(expected):
            raise ValueError('exact-members')
        result = {}
        for entry in entries:
            if entry.flag_bits & 1 or entry.compress_type not in (0, 8):
                raise ValueError('archive-format')
            if entry.file_size > 16384 or entry.file_size > max(1, entry.compress_size) * 100:
                raise ValueError('expanded-size')
            if entry.create_system != 3 or entry.external_attr >> 16 != stat.S_IFREG | 0o600:
                raise ValueError('member-mode')
            content = z.read(entry)
            content.decode('utf-8')
            if content != expected[entry.filename]:
                raise ValueError('content-mismatch')
            result[entry.filename] = content
        return result


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.files = payload()

    def test_roundtrip_and_determinism(self):
        self.assertEqual(archive(self.files), archive(self.files))
        self.assertEqual(validate(archive(self.files), self.files), self.files)

    def test_extra_traversal_absolute_script_rejected(self):
        for name in ('../escape', '/tmp/escape', f'{ID}/run.sh', f'{ID}/nested/SKILL.md'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate(archive({**self.files, name: b'no'}), self.files)

    def test_changed_content_rejected(self):
        bad = dict(self.files)
        bad[f'{ID}/SKILL.md'] += b'changed'
        with self.assertRaises(ValueError):
            validate(archive(bad), self.files)

    def test_symlink_and_executable_rejected(self):
        for mode in (stat.S_IFLNK | 0o600, stat.S_IFREG | 0o700):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as z:
                for name, data in self.files.items():
                    info = zipfile.ZipInfo(name)
                    info.create_system = 3
                    info.external_attr = mode << 16
                    z.writestr(info, data)
            with self.assertRaises(ValueError):
                validate(buffer.getvalue(), self.files)

    def test_duplicate_rejected(self):
        import warnings
        buffer = io.BytesIO(archive(self.files))
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(buffer, 'a') as z:
                z.writestr(f'{ID}/SKILL.md', b'duplicate')
        with self.assertRaises(ValueError):
            validate(buffer.getvalue(), self.files)

    def test_synthetic_stage_commit_and_rollback(self):
        # All writes confined to a newly created temporary root owned by this test.
        with tempfile.TemporaryDirectory(prefix='qcu-pure-skill-test-') as tmp:
            base = Path(tmp)
            stage = base / 'stage'
            stage.mkdir(mode=0o700)
            for name, content in validate(archive(self.files), self.files).items():
                target = stage / Path(name).name
                with target.open('xb') as stream:
                    stream.write(content)
                target.chmod(0o600)
            destination = base / ID
            self.assertFalse(destination.exists())
            stage.rename(destination)
            self.assertEqual((destination / 'SKILL.md').read_bytes(), self.files[f'{ID}/SKILL.md'])
            # Existing target is a conflict; never overwrite in this harness.
            self.assertTrue(destination.exists())
            for name, content in self.files.items():
                path = destination / Path(name).name
                self.assertEqual(path.read_bytes(), content)
            for child in destination.iterdir():
                child.unlink()
            destination.rmdir()
            self.assertEqual(list(base.iterdir()), [])


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SafetyTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    import sys
    if '--test-only' in sys.argv:
        raise SystemExit(0)
    files = payload()
    packed = archive(files)
    out = Path(tempfile.mkdtemp(prefix='qcu-pure-skill-offline-'))
    filename = f'{ID}-{VERSION}.zip'
    (out / filename).write_bytes(packed)
    manifest = {
        'id': ID, 'version': VERSION, 'kind': 'pure-text-skill', 'license': 'MIT',
        'canonicalSource': 'skills/chengyuan-study-coach/SKILL.md',
        'canonicalSourceSha256': sha(SOURCE.read_bytes()),
        'changes': 'Frontmatter name/version and product display renamed to QCU; business instructions unchanged.',
        'archive': filename, 'archiveBytes': len(packed), 'sha256': sha(packed),
        'files': [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(files.items())],
        'relativeTarget': f'skills/{ID}/', 'published': False, 'signed': False,
        'tests': {'passed': result.testsRun, 'scope': 'temporary directories only'},
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'output': str(out), **manifest}, indent=2))
