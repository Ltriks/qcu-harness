"""Scoped temporary-home checks; mock App inspection, never install or open a GUI."""
import importlib.util
import json
from pathlib import Path
import tempfile
import tarfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
pilot = load('dialogue_pilot', ROOT / 'hub/pilot/dialogue-pilot.py')
builder = load('dialogue_builder', ROOT / 'scripts/stage-dialogue-install-probe.py')

class PilotHelperTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.kit = self.root / 'kit'
        builder.stage(self.kit)
        self.home = self.root / 'new-home'
        self.overlay = 'tool-plugin-manager: enabled\nmode: workspace-write\n'
    def prepare(self):
        with patch.object(pilot, 'app_resources', return_value=Path('/synthetic/App/Contents/Resources')), patch.object(pilot, 'run', return_value=SimpleNamespace(stdout=self.overlay)):
            pilot.prepare(self.kit, Path('/synthetic/App'), self.home)
    def profile(self):
        profile = self.home / 'profiles/desktop'
        profile.mkdir(parents=True, mode=0o700)
        (profile / 'package.json').write_text(json.dumps({'dependencies': {}, 'dsh': {'profile': {'bundles': []}}}))
        return profile

    def test_new_home_repeat_and_changed_config_preservation(self):
        self.prepare()
        self.prepare()
        p = self.home / 'cordis.patch.yml'
        p.write_text('user-edited-config')
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertEqual(p.read_text(), 'user-edited-config')

    def test_accepted_csv_home_and_symlink_never_adopted(self):
        self.home.mkdir(mode=0o700)
        marker = self.home / '.qcu-csv-pilot-owned.json'
        marker.write_text('accepted-old-home')
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertEqual(marker.read_text(), 'accepted-old-home')
        self.assertFalse((self.home / pilot.MARKER).exists())
        alias = self.root / 'alias'
        alias.symlink_to(self.home, target_is_directory=True)
        with self.assertRaises(ValueError):
            pilot.managed_home(alias)

    def test_rejection_snapshot_detects_change_without_repair(self):
        self.prepare()
        profile = self.profile()
        pilot.inspect(self.kit, self.home, 'snapshot')
        pilot.inspect(self.kit, self.home, 'check-rejected')
        p = profile / 'package.json'
        p.write_text(json.dumps({'dependencies': {'unexpected': '1.0.0'}}))
        before = p.read_bytes()
        with self.assertRaises(ValueError):
            pilot.inspect(self.kit, self.home, 'check-rejected')
        self.assertEqual(p.read_bytes(), before)

    def test_installed_exact_bytes_and_tampering(self):
        self.prepare()
        profile = self.profile()
        (profile / 'package.json').write_text(json.dumps({'dependencies': {pilot.NAME: 'synthetic-fixed-tarball'}}))
        target = profile / 'node_modules' / pilot.NAME
        target.mkdir(parents=True)
        with tarfile.open(self.kit / 'plugins' / pilot.FILE) as archive:
            for member in archive.getmembers():
                (target / member.name.removeprefix('package/')).write_bytes(archive.extractfile(member).read())
        pilot.inspect(self.kit, self.home, 'check-installed')
        with self.assertRaises(ValueError):
            pilot.inspect(self.kit, self.home, 'snapshot')
        (target / 'index.js').write_text('changed synthetic bytes')
        with self.assertRaises(ValueError):
            pilot.inspect(self.kit, self.home, 'check-installed')

    def test_remote_credentials_query_fragment_and_non_catalog_urls_rejected(self):
        self.prepare()
        values=['https://invalid.test/catalog.json', 'http://127.0.0.1:1234/catalog.json?anything=1',
                'http://127.0.0.1:1234/catalog.json#anything', 'http://' + 'user:synthetic' + '@127.0.0.1:1234/catalog.json',
                'http://127.0.0.1:1234/other', 'file:///catalog.json']
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                pilot.fetch(self.kit, self.home, value)
        self.assertFalse((self.home / 'workspace/downloaded').exists())

    def test_package_and_catalog_tampering_rejected(self):
        path = self.kit / 'plugins' / pilot.FILE
        data = path.read_bytes()
        path.write_bytes(data + b'tampered')
        with self.assertRaises(ValueError):
            pilot.package_bytes(self.kit)
        path.write_bytes(data)
        p = self.kit / 'catalog.json'
        obj = json.loads(p.read_text())
        obj['plugins'][0]['sha256'] = '0' * 64
        p.write_text(json.dumps(obj))
        with self.assertRaises(ValueError):
            pilot.catalog(self.kit)

if __name__ == '__main__':
    unittest.main()

