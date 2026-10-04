"""Validate public source inputs and classify sensitive-pattern matches without printing values."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', '__pycache__', '.work', '.local', 'lib-generated'}

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def verify():
    baseline = json.loads((ROOT / 'upstream/baseline.json').read_text())
    assert digest(ROOT / 'upstream/qcu-office.patch') == baseline['patchSha256']
    assert digest(ROOT / 'upstream/source/pnpm-lock.yaml') == baseline['lockfileSha256']
    pkg = ROOT / 'packages/qcu-thesis-workbench'
    resources = json.loads((pkg / 'RESOURCE-SHA256.json').read_text())
    for name, expected in resources.items(): assert digest(pkg / name) == expected, name
    index = json.loads((ROOT / 'skills/INDEX.json').read_text())['canonicalSkills']
    assert len(index) == 13
    for name, expected in index.items(): assert digest(ROOT / 'skills' / name / 'SKILL.md') == expected, name
    rules = {
        'private-library-reference': r'(?:libfile_|libdir_|file_0000)[A-Za-z0-9]+',
        'machine-path': r'(?<![\w.-])/(?:Users/mcq|home/oai|mnt/data|workspace)(?:/|\b)',
        'private-key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY',
        'credential-prefix': r'(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}',
        'url-userinfo': r'https?://[^/\s:@]+:[^/\s@]+@',
    }
    classified, blocked = [], []
    files = []
    for p in ROOT.rglob('*'):
        relative = p.relative_to(ROOT)
        if any(x in EXCLUDED for x in relative.parts) or str(relative).startswith('packages/qcu-thesis-workbench/lib/'):
            continue
        if not p.is_file(): continue
        assert not p.is_symlink(), str(relative)
        if p.suffix in {'.zip', '.tgz', '.log', '.dmg', '.exe', '.pyc'}:
            blocked.append({'path':str(relative),'rule':'excluded-runtime-artifact'})
        files.append(p)
        try: text = p.read_text()
        except UnicodeDecodeError:
            if relative.as_posix() != 'tests/fixtures/01-demo-match.docx':
                blocked.append({'path':str(relative),'rule':'unapproved-binary'})
            continue
        for number, line in enumerate(text.splitlines(), 1):
            for rule, pattern in rules.items():
                if not re.search(pattern, line): continue
                item = {'path':str(relative),'line':number,'rule':rule}
                test_url = rule == 'url-userinfo' and relative.as_posix() in {
                    'packages/qcu-thesis-workbench/tests/qcu-service.spec.ts',
                    'packages/qcu-thesis-workbench/tests/native-adapter.spec.ts'}
                fixture_literal = "'" + '/' + 'workspace' + "'"
                fixture_path = rule == 'machine-path' and relative.as_posix() == 'upstream/source/apps/desktop/tests/preload-app.spec.ts' and fixture_literal in line
                if test_url or fixture_path:
                    item['classification'] = 'synthetic negative-test input' if test_url else 'synthetic preload workspace fixture'
                    classified.append(item)
                else: blocked.append(item)
    result = {'files':len(files),'bytes':sum(p.stat().st_size for p in files),'resourceHashesVerified':len(resources),
              'canonicalSkillsVerified':len(index),'classifiedFindings':classified,'blockedFindings':blocked,
              'modelsInvoked':False,'candidateNativeGUIValidated':False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if blocked: raise SystemExit(1)

if __name__ == '__main__': verify()
