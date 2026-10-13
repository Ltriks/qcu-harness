import importlib.util
import io
import json
import re
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('feishu_pack', ROOT / 'scripts/pack-feishu-readonly.py')
packer = importlib.util.module_from_spec(spec); spec.loader.exec_module(packer)

class PackageChecks(unittest.TestCase):
    def test_reproducible_member_allowlist_metadata_and_exact_peers(self):
        body, manifest = packer.build(); body2, manifest2 = packer.build()
        self.assertEqual(body, body2); self.assertEqual(manifest, manifest2)
        with tarfile.open(fileobj=io.BytesIO(body), mode='r:gz') as archive:
            members = archive.getmembers()
            self.assertEqual([m.name for m in members], ['package/' + n for n in packer.MEMBERS])
            for member in members:
                self.assertTrue(member.isfile()); self.assertEqual(member.mode, 0o644)
                self.assertEqual((member.mtime, member.uid, member.gid), (0, 0, 0))
                self.assertFalse(member.linkname)
                self.assertEqual(archive.extractfile(member).read(), (packer.SOURCE / member.name.removeprefix('package/')).read_bytes())
        runtime = json.loads((ROOT / '.work/feishu-refine/runtime-parity.json').read_text())
        versions = {m['package']: m['version'] for m in runtime['manifests']}
        for name, version in packer.PEERS.items():
            self.assertEqual(versions[name], version)
        imports = set(re.findall(r"from '(@deepseek-ai/[^']+)'", (packer.SOURCE / 'index.js').read_text()))
        self.assertTrue(imports <= set(packer.PEERS))

    def test_immutable_collision_refused(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.work/feishu') as temp:
            path = Path(temp) / 'candidate.tgz'
            packer.immutable(path, b'synthetic'); packer.immutable(path, b'synthetic')
            with self.assertRaisesRegex(RuntimeError, 'immutable artifact collision'):
                packer.immutable(path, b'different')
            self.assertEqual(path.read_bytes(), b'synthetic')

    def test_only_synthetic_urls_no_install_scripts_dependencies_binaries_or_body_log_calls(self):
        metadata = json.loads((packer.SOURCE / 'package.json').read_text())
        for key in ['dependencies', 'optionalDependencies', 'scripts', 'bundledDependencies']:
            self.assertNotIn(key, metadata)
        code = '\n'.join((packer.SOURCE / p).read_text() for p in ['index.js', 'src/core.mjs', 'src/authority.mjs'])
        self.assertNotRegex(code, r'console\.|writeFile|appendFile|readFile|fetch\(|execSync|shell:\s*true')
        self.assertNotRegex(code, r'--yes|--as[\s,]+[\x22\x27]bot|auth/login|access_token|refresh_token|appSecret')
        for name in packer.MEMBERS:
            text = (packer.SOURCE / name).read_text()
            urls = re.findall(r'https://[^\s`"<>]+\.feishu\.cn/(?:wiki|docx)/[A-Za-z0-9]+', text)
            self.assertTrue(all(u == 'https://fixture.feishu.cn/docx/DocSynthetic01' for u in urls))

if __name__ == '__main__':
    unittest.main()
