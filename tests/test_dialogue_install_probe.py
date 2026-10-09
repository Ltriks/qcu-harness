"""Only stage and inspect synthetic bytes; no App, install, network or credentials."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/stage-dialogue-install-probe.py'
spec = importlib.util.spec_from_file_location('stage_probe', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageProbeTests(unittest.TestCase):
    def test_deterministic_fixed_bytes_catalog_and_closed_default(self):
        with tempfile.TemporaryDirectory() as temporary:
            first, second = Path(temporary) / 'a', Path(temporary) / 'b'
            a, b = module.stage(first), module.stage(second)
            self.assertEqual(a, b)
            entry = json.loads((first / 'catalog.json').read_text())['plugins'][0]
            package = first / 'plugins' / entry['file']
            self.assertEqual(hashlib.sha256(package.read_bytes()).hexdigest(), entry['sha256'])
            self.assertEqual(package.read_bytes(), (second / 'plugins' / entry['file']).read_bytes())
            with tarfile.open(package) as archive:
                self.assertEqual(sorted(archive.getnames()), sorted('package/' + n for n in module.FILES))
                self.assertTrue(all(member.isfile() for member in archive.getmembers()))
                patch = json.load(archive.extractfile('package/cordis.patch.yml'))
                self.assertTrue(patch[0]['insert'][0]['disabled'])
            self.assertFalse(a['installed'])
            self.assertFalse(a['serverStarted'])
            self.assertFalse(a['appOrProfileModified'])

    def test_existing_output_and_symlink_are_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            existing = Path(temporary) / 'existing'
            existing.mkdir()
            marker = existing / 'keep'
            marker.write_text('unchanged')
            with self.assertRaises(ValueError):
                module.stage(existing)
            self.assertEqual(marker.read_text(), 'unchanged')
            link = Path(temporary) / 'link'
            link.symlink_to(existing, target_is_directory=True)
            with self.assertRaises(ValueError):
                module.stage(link)
            self.assertEqual(marker.read_text(), 'unchanged')

if __name__ == '__main__':
    unittest.main()

