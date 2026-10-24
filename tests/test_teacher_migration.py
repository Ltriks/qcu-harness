"""Only disposable rc3 fixtures, frozen public packages and synthetic private values."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('migration', ROOT / 'scripts/migrate-teacher-home.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
spec = importlib.util.spec_from_file_location('sources', ROOT / 'scripts/prepare-preinstalled-local-sources.py')
sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sources)
KIT = Path(os.environ['QCU_INTEGRATED_TEST_KIT']).absolute()
INPUT = ROOT / '.work/preinstalled-proof-inputs'


def tree(root):
    return [(str(p.relative_to(root)), p.lstat().st_mode & 0o777,
             'link:' + os.readlink(p) if p.is_symlink() else hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else 'directory')
            for p in sorted(root.rglob('*'))]


class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_temp = tempfile.TemporaryDirectory(prefix='qcu-rc3-base-', dir='/private/tmp')
        cls.base = Path(cls.base_temp.name)
        baseline = json.loads((KIT / 'support/migration-baseline.json').read_text())
        frozen = json.loads((INPUT / 'INPUTS.json').read_text())
        for product in frozen['products']:
            for name, data in sources.archive_files((INPUT / 'archives' / product['file']).read_bytes()).items():
                file = cls.base / 'profiles/desktop/node_modules' / product['id'] / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
        shutil.copytree(INPUT / 'branding', cls.base / 'profiles/desktop/node_modules/qcu-branding')
        for name in ['package.json', 'cordis.yml', 'cordis.patch.yml']:
            shutil.copy2(INPUT / 'profile-template' / name, cls.base / 'profiles/desktop' / name)
        (cls.base / 'bin').mkdir()
        shutil.copy2(KIT / 'seed/bin/lark-cli', cls.base / 'bin/lark-cli')
        for row in baseline['seedFiles']:
            p = cls.base / row['path'].removeprefix('seed/')
            assert p.stat().st_size == row['bytes'] and m.digest(p) == row['sha256']
        receipt = {'version': baseline['version'], 'seedId': baseline['seedId'], 'products': [{k: p[k] for k in ['id', 'version']} for p in baseline['products']]}
        (cls.base / 'qcu-teacher.json').write_text(json.dumps(receipt))

    @classmethod
    def tearDownClass(cls):
        cls.base_temp.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qcu-migration-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.target = self.root / '旧 教师 数据', self.root / '新 教师 数据'
        shutil.copytree(self.base, self.source)
        self.secret = 'FAKE_CREDENTIAL_LOCAL_ONLY_746cc0'
        self.put('workspace/保留备课.txt', 'Synthetic anonymous lesson')
        self.put('opaque/provider.json', json.dumps({'apiKey': self.secret}))
        self.put('electron/Preferences', 'Synthetic persistent preference')
        self.put('electron/Local Storage/leveldb/data', 'Opaque synthetic bytes')
        for name in ['electron/Cache/locked', 'electron/Default/Code Cache/locked']:
            self.put(name, 'Synthetic transient cache')
        (self.source / 'electron/SingletonLock').symlink_to('/private/tmp/synthetic-not-a-live-process')
        self.patchfile = self.source / 'profiles/desktop/cordis.patch.yml'
        rows = json.loads(self.patchfile.read_text())
        rows[0]['disabled'] = True
        rows.append({'id': 'synthetic-model-settings', 'config': {'apiKey': self.secret, 'workspacePath': '/private/tmp/retained-absolute-synthetic-workspace'}})
        next(r for r in rows if r['id'] == 'qcu-feishu-readonly')['config']['cliPath'] = str(self.source / 'bin/lark-cli')
        self.patchfile.write_text('# genuine YAML teacher settings\n' + json.dumps(rows, ensure_ascii=False))
        pkgfile = self.source / 'profiles/desktop/package.json'
        pkg = json.loads(pkgfile.read_text())
        pkg['syntheticTeacherSetting'] = {'preserve': self.secret}
        pkg['dsh']['profile']['bundles'].remove('qcu-course-workbench')
        pkgfile.write_text(json.dumps(pkg))

    def put(self, name, text):
        p = self.source / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def unchanged_refusal(self, action):
        before = tree(self.source)
        with self.assertRaises((ValueError, OSError)):
            action()
        self.assertEqual(tree(self.source), before)
        self.assertFalse(any(self.root.glob('.qcu-migrate-*')))

    def test_preview_cancel_is_read_only_and_no_setting_values_logged(self):
        before = tree(self.source)
        plan = m.preview(KIT, self.source, self.target)
        self.assertNotIn(self.secret, json.dumps(plan))
        self.assertEqual(plan['absoluteWorkspaceReferencesPending'], 1)
        self.assertFalse(self.target.exists())
        self.assertEqual(tree(self.source), before)

    def test_digest_confirmed_copy_preserves_source_settings_opaque_data_and_original_choices(self):
        before = tree(self.source)
        plan = m.preview(KIT, self.source, self.target)
        result = m.apply(KIT, plan, plan['digest'])
        self.assertEqual(tree(self.source), before)
        self.assertNotIn(self.secret, json.dumps(result))
        self.assertEqual((self.source / 'opaque/provider.json').read_bytes(), (self.target / 'opaque/provider.json').read_bytes())
        self.assertEqual((self.source / 'electron/Preferences').read_bytes(), (self.target / 'electron/Preferences').read_bytes())
        for rel in ['electron/Cache', 'electron/Default/Code Cache', 'electron/SingletonLock']:
            self.assertFalse((self.target / rel).exists())
        pkg = json.loads((self.target / 'profiles/desktop/package.json').read_text())
        self.assertEqual(len(pkg['dependencies']), 12)
        self.assertTrue(all(p.startswith('file:./.qcu-bundles/') for p in pkg['dependencies'].values()))
        self.assertNotIn('qcu-course-workbench', pkg['dsh']['profile']['bundles'])
        for id in ['qcu-market', 'qcu-expert-teams']:
            self.assertNotIn(id, pkg['dsh']['profile']['bundles'])
        rows = json.loads((self.target / 'profiles/desktop/cordis.patch.yml').read_text())
        self.assertTrue(rows[0]['disabled'])
        for id in ['qcu-market', 'qcu-expert-teams']:
            self.assertTrue(next(r for r in rows if r['id'] == id)['disabled'])
        self.assertEqual(next(r for r in rows if r['id'] == 'synthetic-model-settings')['config']['apiKey'], self.secret)
        self.assertEqual(next(r for r in rows if r['id'] == 'synthetic-model-settings')['config']['workspacePath'], '/private/tmp/retained-absolute-synthetic-workspace')
        self.assertEqual(result['absoluteWorkspaceReferencesPending'], 1)

    def test_unrecognized_receipts_refuse_before_any_inventory_or_opaque_open(self):
        receipt = self.source / 'qcu-teacher.json'
        original = receipt.read_bytes()
        for state in ['missing', 'foreign', 'oversize', 'symlink', 'fifo', 'hardlink']:
            with self.subTest(state=state):
                receipt.unlink()
                if state == 'foreign':
                    receipt.write_text('{}')
                elif state == 'oversize':
                    receipt.write_bytes(b' ' * (64 * 1024 + 1))
                elif state == 'symlink':
                    receipt.symlink_to(self.source / 'opaque/provider.json')
                elif state == 'fifo':
                    os.mkfifo(receipt)
                elif state == 'hardlink':
                    os.link(self.source / 'opaque/provider.json', receipt)
                original_read = m.safe_read
                def receipt_only(file):
                    if str(file).startswith(str(self.source)):
                        self.assertEqual(file, receipt, 'unrelated content opened before receipt recognition')
                    return original_read(file)
                with patch.object(m, 'safe_read', side_effect=receipt_only), patch.object(m, 'snapshot', side_effect=AssertionError('traversal before recognition')), patch.object(Path, 'iterdir', side_effect=AssertionError('inventory before recognition')):
                    with self.assertRaises((ValueError, OSError)):
                        m.preview(KIT, self.source, self.target)
                if receipt.exists() or receipt.is_symlink():
                    receipt.unlink()
                receipt.write_bytes(original)
        self.assertFalse(self.target.exists())

    def test_managed_verification_precedes_opaque_reads_and_metadata_is_bounded(self):
        file = self.source / 'profiles/desktop/node_modules/qcu-study-coach/index.js'
        file.write_text('Synthetic changed managed bytes')
        original = m.safe_read
        def spy(file):
            self.assertFalse(str(file).startswith(str(self.source / 'opaque')))
            self.assertFalse(str(file).startswith(str(self.source / 'electron')))
            return original(file)
        with patch.object(m, 'safe_read', side_effect=spy):
            with self.assertRaises(ValueError):
                m.preview(KIT, self.source, self.target)
        pkg = self.source / 'profiles/desktop/package.json'
        pkg.write_bytes(b' ' * (m.METADATA_LIMIT + 1))
        with patch.object(m, 'snapshot', side_effect=AssertionError('inventory before metadata')):
            with self.assertRaises(ValueError):
                m.preview(KIT, self.source, self.target)

    def test_inactive_branding_preserves_official_navigation_and_selection(self):
        for state in ['disabled', 'unselected']:
            with self.subTest(state=state):
                target = self.target.with_name(self.target.name + state)
                pkgfile = self.source / 'profiles/desktop/package.json'
                pkg = json.loads(pkgfile.read_text())
                rows = m.yaml_value(KIT, self.patchfile.read_text())
                rows = [r for r in rows if r.get('id') not in ['qcu-branding', 'ui-sidebar', 'ui-brand-official']]
                rows += [{'id': 'ui-sidebar', 'disabled': False}, {'id': 'ui-brand-official', 'disabled': False}]
                if state == 'disabled':
                    rows.append({'id': 'qcu-branding', 'disabled': True})
                else:
                    pkg['dsh']['profile']['bundles'].remove('qcu-branding')
                pkgfile.write_text(json.dumps(pkg))
                self.patchfile.write_text(json.dumps(rows))
                plan = m.preview(KIT, self.source, target)
                m.apply(KIT, plan, plan['digest'])
                migrated = json.loads((target / 'profiles/desktop/cordis.patch.yml').read_text())
                for id in ['ui-sidebar', 'ui-brand-official']:
                    self.assertFalse(next(r for r in migrated if r['id'] == id)['disabled'])
                self.assertEqual(json.loads((target / 'profiles/desktop/package.json').read_text())['dsh'], pkg['dsh'])
                self.assertTrue(next(r for r in migrated if r['id'] == 'qcu-branding')['disabled'])

    def test_opaque_workspace_paths_are_preserved_but_not_claimed_inspected(self):
        path = '/private/tmp/SYNTHETIC_OPAQUE_WORKSPACE_794'
        self.put('electron/Local Storage/leveldb/workspace', path)
        rows = m.yaml_value(KIT, self.patchfile.read_text())
        next(r for r in rows if r['id'] == 'synthetic-model-settings')['config'].pop('workspacePath')
        self.patchfile.write_text(json.dumps(rows))
        plan = m.preview(KIT, self.source, self.target)
        self.assertEqual(plan['absoluteWorkspaceReferencesPending'], 0)
        self.assertFalse(plan['opaqueWorkspaceReferencesInspected'])
        self.assertTrue(plan['workspaceLocationReviewRequired'])
        result = m.apply(KIT, plan, plan['digest'])
        self.assertNotIn(path, json.dumps([plan, result]))
        self.assertEqual((self.target / 'electron/Local Storage/leveldb/workspace').read_text(), path)

    def test_digest_mismatch_and_stale_source_refuse_without_target(self):
        plan = m.preview(KIT, self.source, self.target)
        self.unchanged_refusal(lambda: m.apply(KIT, plan, '0' * 64))
        self.put('workspace/保留备课.txt', 'Changed after preview')
        self.unchanged_refusal(lambda: m.apply(KIT, plan, plan['digest']))
        self.assertFalse(self.target.exists())

    def test_running_source_is_refused(self):
        child = subprocess.Popen([sys.executable, '-c', 'import sys,time;f=open(sys.argv[1]);print("ready",flush=True);time.sleep(30)', str(self.source / 'electron/Preferences')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.assertEqual(child.stdout.readline().strip(), b'ready')
        try:
            self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        finally:
            child.terminate()
            child.wait(timeout=10)
            child.stdout.close()

    def test_unknown_dependency_and_added_managed_file_are_refused(self):
        file = self.source / 'profiles/desktop/package.json'
        pkg = json.loads(file.read_text())
        pkg['dependencies']['qcu-unknown-addition'] = '0.0.1'
        file.write_text(json.dumps(pkg))
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        del pkg['dependencies']['qcu-unknown-addition']
        file.write_text(json.dumps(pkg))
        self.put('profiles/desktop/node_modules/qcu-study-coach/user-added.js', 'Synthetic user addition')
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))

    def test_foreign_receipt_unsupported_profile_and_symlinks_are_refused(self):
        file = self.source / 'qcu-teacher.json'
        before = file.read_bytes()
        receipt = json.loads(before)
        receipt['seedId'] = 'foreign'
        file.write_text(json.dumps(receipt))
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        file.write_bytes(before)
        (self.source / 'profiles/additional').mkdir()
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        (self.source / 'profiles/additional').rmdir()
        (self.source / 'workspace/unsafe').symlink_to(self.source / 'opaque/provider.json')
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))

    def test_overlap_symlink_target_and_occupied_partial_target_refused(self):
        for target in [self.source, self.source / 'nested', self.root]:
            self.unchanged_refusal(lambda: m.preview(KIT, self.source, target))
        self.target.symlink_to(self.root / 'absent')
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        self.target.unlink()
        self.target.mkdir()
        (self.target / 'keep.txt').write_text('Synthetic existing partial target')
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, self.target))
        self.assertEqual((self.target / 'keep.txt').read_text(), 'Synthetic existing partial target')

    def test_copy_failure_rolls_back_only_own_staging(self):
        plan = m.preview(KIT, self.source, self.target)
        unrelated = self.root / '.qcu-migrate-not-owned'
        unrelated.mkdir()
        with patch.object(m, 'exclusive_rename', side_effect=OSError('Synthetic commit failure')):
            before = tree(self.source)
            with self.assertRaises(OSError):
                m.apply(KIT, plan, plan['digest'])
            self.assertEqual(tree(self.source), before)
        self.assertTrue(unrelated.exists())
        self.assertEqual(list(self.root.glob('.qcu-migrate-*')), [unrelated])
        self.assertFalse(self.target.exists())

    def test_target_race_cannot_replace_even_empty_existing_directory(self):
        plan = m.preview(KIT, self.source, self.target)
        original = m.exclusive_rename
        def race(stage, target):
            target.mkdir()
            original(stage, target)
        with patch.object(m, 'exclusive_rename', side_effect=race):
            self.unchanged_refusal(lambda: m.apply(KIT, plan, plan['digest']))
        self.assertTrue(self.target.is_dir())

    def test_unsafe_fifo_and_hardlink_are_refused_without_opening(self):
        file = self.source / 'opaque/unsafe'
        os.mkfifo(file)
        with self.assertRaises(ValueError):
            m.preview(KIT, self.source, self.target)
        file.unlink()
        os.link(self.source / 'opaque/provider.json', file)
        with self.assertRaises(ValueError):
            m.preview(KIT, self.source, self.target)
        self.assertFalse(self.target.exists())

    def test_mac_case_alias_cannot_put_target_staging_inside_source(self):
        alias = self.root.with_name(self.root.name.upper()) / self.source.name
        if not alias.exists():
            self.skipTest('Case-sensitive filesystem; physical alias unavailable')
        self.unchanged_refusal(lambda: m.preview(KIT, self.source, alias / 'new-target'))

    def test_source_change_during_copy_invalidates_preview_and_removes_only_staging(self):
        plan = m.preview(KIT, self.source, self.target)
        before = tree(self.source)
        original = m.copy_opaque
        def changed(source, stage):
            original(source, stage)
            self.put('workspace/保留备课.txt', 'Synthetic concurrent user edit')
        with patch.object(m, 'copy_opaque', side_effect=changed):
            with self.assertRaises(ValueError):
                m.apply(KIT, plan, plan['digest'])
        after = tree(self.source)
        self.assertEqual([r for r in before if r[0] != 'workspace/保留备课.txt'], [r for r in after if r[0] != 'workspace/保留备课.txt'])
        self.assertEqual((self.source / 'workspace/保留备课.txt').read_text(), 'Synthetic concurrent user edit')
        self.assertFalse(self.target.exists())
        self.assertFalse(any(self.root.glob('.qcu-migrate-*')))


if __name__ == '__main__':
    unittest.main()
