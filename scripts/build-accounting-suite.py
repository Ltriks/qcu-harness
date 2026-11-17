"""Build the QCU-authored teaching suite and immutable archive; no install/network."""
from pathlib import Path
import argparse, gzip, hashlib, io, json, tarfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'packages/qcu-accounting-suite'
ID, VERSION = 'qcu-accounting-suite', '0.1.0-pilot.1'
TITLES = {ID: '会计系技能选用入口', 'qcu-accounting-journals': '会计分录实训',
          'qcu-accounting-vouchers': '凭证审核模拟', 'qcu-accounting-statements': '报表勾稽练习',
          'qcu-accounting-lessons': '课堂案例设计'}
def dump(v): return json.dumps(v, ensure_ascii=False, indent=2) + '\n'
def sha(data): return hashlib.sha256(data).hexdigest()

def build(output):
    members = []
    for name, title in TITLES.items():
        file = 'SKILL.md' if name == ID else f'skills/{name}/SKILL.md'
        content = (SOURCE / file).read_text()
        if f'name: {name}\n' not in content: raise ValueError('Skill name mismatch')
        description = next(line.removeprefix('description: ') for line in content.splitlines() if line.startswith('description: '))
        members.append({'name': name, 'title': title, 'description': description, 'file': file, 'sha256': sha(content.encode()), 'content': content})
    manifest = {'schemaVersion': 1, 'id': ID, 'version': VERSION, 'title': '会计系教学技能包（示例）',
                'description': '基础会计教学：分录实训、凭证审核、报表勾稽和课堂案例；统一安装，成员独立使用。',
                'skills': [{**{k: m[k] for k in ['title', 'description', 'file', 'sha256']}, 'id': m['name'], 'entrypoint': m['name'] == ID} for m in members]}
    (SOURCE / 'skill-bundle.json').write_text(dump(manifest))
    (SOURCE / 'skills-content.mjs').write_text('// Generated from packaged SKILL.md files.\nexport const provider=' + json.dumps(ID + '@' + VERSION) + '\nexport const members=' + dump(members))
    generated = {'package.json', 'SOURCE.json', 'skills-content.mjs', 'skill-bundle.json'}
    authored = [{'path': p.relative_to(SOURCE).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
                for p in sorted(SOURCE.rglob('*')) if p.is_file() and p.relative_to(SOURCE).as_posix() not in generated]
    builder_sha = sha(Path(__file__).read_bytes())
    revision = hashlib.sha1(json.dumps({'files': authored, 'builderSha256': builder_sha, 'manifest': manifest}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    (SOURCE / 'SOURCE.json').write_text(dump({'ownership': 'qcu', 'author': 'QCU teaching prototype contributors', 'license': 'MIT', 'revision': revision, 'revisionKind': 'sha1-content-snapshot-not-git-commit', 'builderSha256': builder_sha, 'authoredFiles': authored, 'syntheticData': True, 'teacherApproved': False}))
    files = sorted(p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*') if p.is_file() and p.name != 'package.json')
    pkg = {'name': ID, 'version': VERSION, 'type': 'module', 'private': True, 'license': 'MIT',
           'description': manifest['description'], 'exports': {'.': './index.js', './package.json': './package.json'},
           'dsh': {'bundle': {'patch': './cordis.patch.yml'}},
           'peerDependencies': {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/dsh-skill': '0.2.0-rc.2', '@deepseek-ai/dsh-scope': '0.2.0-rc.2'}, 'files': files}
    (SOURCE / 'package.json').write_text(dump(pkg))
    names = sorted(['package.json', *files]); raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name in names:
            p = SOURCE / name
            if p.is_symlink(): raise ValueError('Symlinks refused')
            data = p.read_bytes(); info = tarfile.TarInfo('package/' + name)
            info.size, info.mode, info.mtime = len(data), 0o644, 0
            tar.addfile(info, io.BytesIO(data))
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0, compresslevel=9) as gz: gz.write(raw.getvalue())
    data = compressed.getvalue(); digest = sha(data); filename = f'{ID}-{VERSION}-{digest}.tgz'
    output.mkdir(parents=True, exist_ok=True); (output / filename).write_bytes(data)
    result = {'id': ID, 'version': VERSION, 'file': filename, 'bytes': len(data), 'sha256': digest,
              'skill': ID, 'skillSha256': members[0]['sha256'], 'provider': ID + '@' + VERSION,
              'sourceRevision': revision, 'skillNames': list(TITLES)}
    (output / 'release.json').write_text(dump(result))
    (output / 'members.json').write_text(dump({'schemaVersion': 1, 'members': [{'path': n, 'bytes': (SOURCE / n).stat().st_size, 'sha256': sha((SOURCE / n).read_bytes())} for n in names]}))
    return result
if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--out', type=Path, required=True)
    print(dump(build(parser.parse_args().out)))
