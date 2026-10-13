"""Audit only public SDK/config code against the fixed official ASAR. No app/auth/profile access."""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--asar', type=Path, required=True)
p.add_argument('--dependencies', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
digest = lambda b: hashlib.sha256(b).hexdigest()
records, manifests, visited = [], [], set()
with a.asar.open('rb') as f:
    _, size, _, n = struct.unpack('<4I', f.read(16))
    header = json.loads(f.read(n))

    def entry(path):
        v = header
        for part in path.split('/'):
            v = v['files'][part]
        return v

    def official(path):
        v = entry(path)
        assert not v.get('unpacked') and not v.get('link'), path
        f.seek(8 + size + int(v['offset']))
        return f.read(v['size'])

    def files(node, prefix=''):
        for name, item in sorted(node['files'].items()):
            path = prefix + name
            if 'files' in item:
                yield from files(item, path + '/')
            else:
                yield path

    def audit(name, recurse=True, selected=None):
        if name in visited:
            return
        visited.add(name)
        base = 'dsh/node_modules/@deepseek-ai/' + name + '/'
        local = a.dependencies / 'node_modules/@deepseek-ai' / name
        ob = official(base + 'package.json')
        lb = (local / 'package.json').read_bytes()
        om, lm = json.loads(ob), json.loads(lb)
        assert om['name'] == lm['name'] and om['version'] == lm['version'], name
        # Only these fields choose JS imports. Peer range rewriting is reported, not silently ignored.
        for key in ['type', 'main', 'module', 'exports']:
            assert om.get(key) == lm.get(key), (name, key, 'runtime resolver drift')
        manifests.append({'package': om['name'], 'version': om['version'],
                          'officialSha256': digest(ob), 'sourceSha256': digest(lb),
                          'bytesEqual': ob == lb,
                          'differentFields': sorted(k for k in set(om) | set(lm) if om.get(k) != lm.get(k)),
                          'runtimeResolverEqual': True, 'officialPeers': om.get('peerDependencies', {})})
        children = set()
        names = selected or [x for x in files(entry(base.rstrip('/'))) if x.startswith('lib/') and x.endswith(('.js', '.mjs', '.cjs'))]
        for path in names:
            b = official(base + path)
            l = (local / path).read_bytes()
            if recurse and name != 'dsh-app-boot':
                assert b == l, ('runtime bytes differ', name, path)
            else:
                review = Path('.work/feishu-refine/official-sdk') / name / path
                review.parent.mkdir(parents=True, exist_ok=True)
                review.write_bytes(b)
                # Resolve every external dependency through the existing package's dependency tree.
                package_root = review.parents[len(Path(path).parts) - 1]
                (package_root / 'package.json').write_bytes(ob)
                link = package_root / 'node_modules'
                target = local / 'node_modules'
                if not target.exists():
                    target = a.dependencies / 'node_modules'
                if link.is_symlink():
                    assert link.resolve() == target.resolve()
                else:
                    assert not link.exists()
                    link.symlink_to(target.resolve(), target_is_directory=True)
            records.append({'package': om['name'], 'file': path, 'sourceEqualsAsar': b == l,
                            'officialSha256': digest(b), 'sourceSha256': digest(l),
                            'role': ('official-asar-execution' if name == 'dsh-app-boot' else 'execution-runtime') if recurse else 'configuration-review-only'})
            if recurse:
                children.update(re.findall(r'(?:from\s*|import\s*|require\s*\()\s*[\x22\x27]@deepseek-ai/([a-zA-Z0-9-]+)', b.decode()))
        for child in sorted(children):
            audit(child)

    for name in ['cordis', 'schemastery', 'dsh-tools', 'dsh-system-prompt', 'dsh-user-approval', 'dsh-session', 'dsh-session-projection']:
        audit(name)
    for name in ['dsh-settings', 'dsh-config-editor', 'dsh-app-boot', 'cordis-plugin-loader', 'cordis-plugin-include']:
        audit(name)
    audit('dsh-plugin-manager', recurse=False, selected=['lib/index.js'])
    audit('dsh-client-ui-plugin-manager', recurse=False, selected=['lib/client.js'])
report = {'asarSha256': digest(a.asar.read_bytes()), 'asarBytes': a.asar.stat().st_size,
          'runtimeFiles': records, 'manifests': manifests,
          'scope': 'All lib JS artifacts for reachable @deepseek-ai runtime imports plus explicit configuration review files; no app launch.'}
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'verifiedFiles': len(records), 'packages': len(manifests), 'report': str(a.out)}))
