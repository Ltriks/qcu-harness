import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('stage_study_coach',Path(__file__).resolve().parents[1]/'scripts/stage-study-coach-pilot.py')
pack=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


class StudyCoachPackTests(unittest.TestCase):
    def test_deterministic_bytes_and_existing_output_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);a=pack.stage(root/'a');b=pack.stage(root/'b')
            self.assertEqual(a['sha256'],b['sha256'])
            self.assertEqual((root/'a/plugins'/a['file']).read_bytes(),(root/'b/plugins'/b['file']).read_bytes())
            with self.assertRaises(ValueError):pack.stage(root/'a')
            self.assertEqual(len(a['archiveMembers']),8)
            self.assertFalse(a['installed']);self.assertFalse(a['miniDirectoryOrServiceChanged'])

    def test_changed_source_and_symlink_rejected_before_output_creation(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);skill=root/'skill.md';skill.write_bytes(pack.SKILL.read_bytes()+b'changed')
            with self.assertRaises(ValueError):pack.stage(root/'bad',skill_path=skill)
            self.assertFalse((root/'bad').exists())
            linked=root/'link.md';linked.symlink_to(pack.SKILL)
            with self.assertRaises(ValueError):pack.stage(root/'bad',skill_path=linked)

    def test_scripts_and_activated_default_refused(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);src=root/'source';shutil.copytree(pack.PACKAGE,src)
            manifest=json.loads((src/'package.json').read_text(encoding='utf-8'));manifest['scripts']={'postinstall':'not allowed'};(src/'package.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):pack.stage(root/'bad',source_root=src)
            manifest.pop('scripts');(src/'package.json').write_text(json.dumps(manifest))
            patch=json.loads((src/'cordis.patch.yml').read_text());patch[0]['insert'][0]['disabled']=False;(src/'cordis.patch.yml').write_text(json.dumps(patch))
            with self.assertRaises(ValueError):pack.stage(root/'bad',source_root=src)
            self.assertFalse((root/'bad').exists())


if __name__=='__main__':unittest.main()
