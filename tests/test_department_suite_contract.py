import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('contract', ROOT / 'hub/admin/department_suite_contract.py')
contract = importlib.util.module_from_spec(spec); spec.loader.exec_module(contract)

class Api:
    @staticmethod
    def need(value, code, *args):
        if not value: raise ValueError(code)
    @staticmethod
    def sha(data): return hashlib.sha256(data).hexdigest()

class SuiteContractTest(unittest.TestCase):
    def setUp(self):
        source = ROOT / 'packages/qcu-accounting-suite'
        self.files = {'package/' + p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file()}
        manifest = json.loads(self.files['package/skill-bundle.json'])
        self.meta = {'id': manifest['id'], 'version': manifest['version'], 'productType': 'skill', 'components': [manifest['id']], 'license': 'MIT', 'skills': [m['id'] for m in manifest['skills']]}
    def test_full_declaration(self): contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_hidden_members_rejected(self):
        self.meta['skills'] = [self.meta['id']]
        with self.assertRaisesRegex(ValueError, 'coverage'): contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_tampered_member_rejected(self):
        self.files['package/skills/qcu-accounting-journals/SKILL.md'] += b'changed'
        with self.assertRaisesRegex(ValueError, 'digest'): contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_path_escape_rejected(self):
        manifest = json.loads(self.files['package/skill-bundle.json']); manifest['skills'][1]['file'] = '../SKILL.md'; self.files['package/skill-bundle.json'] = json.dumps(manifest).encode()
        with self.assertRaisesRegex(ValueError, 'path'): contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_legacy_single_skill(self):
        self.meta['skills'] = [self.meta['id']]; del self.files['package/skill-bundle.json']; contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_single_component_rule_preserved(self):
        self.meta['components'].append('qcu-extra')
        with self.assertRaisesRegex(ValueError, 'single_component'): contract.validate_skill_bundle(Api, self.meta, self.files)
    def test_existing_workbench_exception_preserved(self):
        meta = {'id': 'qcu-course-workbench', 'productType': 'plugin', 'components': ['qcu-course-workbench'], 'skills': ['qcu-course-draft'], 'license': 'MIT'}
        contract.validate_skill_bundle(Api, meta, {})

if __name__ == '__main__': unittest.main()
