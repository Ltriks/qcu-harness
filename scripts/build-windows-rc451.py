"""Immutable Windows hotfix on rc45.1: cloud market + native updater lock.

Keeps the rc4.5 data home, updates only the frozen managed market component,
and refuses independently edited existing installations. Never reads user data.
"""
import argparse
import hashlib
import importlib.util
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = '7f65d36bcc2d9cbf608c5604ee8bef6c2d7bb9f20cdaa5e546fdfed57e15c37f'


def sha(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1048576), b''):
            h.update(b)
    return h.hexdigest()


def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def stage(args):
    if sha(args.base) != BASE_SHA or args.stage.exists():
        raise ValueError('Pinned base and fresh stage required')
    args.stage.mkdir(parents=True)
    with zipfile.ZipFile(args.base) as z:
        z.extractall(args.stage)
    kit = args.stage / 'QCU助手'
    support = kit / 'support'
    manifest = json.loads((support / 'manifest.json').read_text())
    previous = manifest['seedId']
    frozen = [{**r, 'path': r['path'].split('/node_modules/qcu-market/', 1)[1]}
              for r in manifest['seedFiles'] if '/node_modules/qcu-market/' in r['path']]
    write(support / 'rc451-previous-market.json', frozen)
    guard = load('guard', ROOT / 'release/rc451/managed-updates.py')
    proof = guard.apply(kit / 'program/resources', 'win-x64')
    write(args.stage / 'updater-guard.json', proof)
    (args.stage / 'patched-main.js').write_bytes(guard.member((kit / 'program/resources/app.asar').read_bytes(), 'lib/main.js'))
    builder = load('rc45builder', ROOT / 'scripts/build-release-rc45.py')
    source, row = builder.package('qcu-market', args.stage / 'component-packages')
    profile = kit / 'seed/profiles/desktop'
    old = next(r for r in manifest['localSources'] if r['id'] == row['id'])
    manifest['localSources'] = [row if r['id'] == row['id'] else r for r in manifest['localSources']]
    module = profile / 'node_modules/qcu-market'
    shutil.rmtree(module)
    module.mkdir()
    pkg = json.loads((source / 'package.json').read_text())
    for name in ['package.json', *pkg['files']]:
        dest = module / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, dest)
    (profile / '.qcu-bundles' / old['file']).unlink()
    shutil.copyfile(args.stage / 'component-packages' / row['file'], profile / '.qcu-bundles' / row['file'])
    pkg = json.loads((profile / 'package.json').read_text())
    pkg['dependencies']['qcu-market'] = row['source']
    write(profile / 'package.json', pkg)
    shutil.copyfile(ROOT / 'release/rc451/refresh-managed.cjs', support / 'refresh-managed.cjs')
    integrated = (support / 'integrated.cjs').read_text()
    marker = "  if(r.version===m.version&&m.version==='0.1.0-rc.4.4')"
    if marker not in integrated:
        raise ValueError('Frozen startup refresh anchor changed')
    integrated = integrated.replace(marker,
        "  if(r.version===m.version&&m.version==='0.1.0-rc.4.5'&&m.buildId==='rc45.2')return at('profile',()=>require('./refresh-managed.cjs')(kit,home,m,h,parseYaml,r));\n" + marker)
    (support / 'integrated.cjs').write_text(integrated)
    for name in ['release-info.json', 'incidents.cjs']:
        p = support / name
        p.write_text(p.read_text().replace('rc45.1', 'rc45.2'))
    manifest['buildId'] = 'rc45.2'
    manifest['products'] = [{k: r[k] for k in ['id', 'version', 'file', 'bytes', 'sha256']}
                            for r in manifest['localSources'] if r['id'] != 'qcu-branding']
    manifest['seedFiles'] = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size,
                              'sha256': sha(p), 'mode': p.stat().st_mode & 0o777}
                             for p in sorted((kit / 'seed').rglob('*')) if p.is_file()]
    manifest['seedId'] = hashlib.sha256(json.dumps(manifest['seedFiles'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    write(support / 'manifest.json', manifest)
    write(support / 'rc45-composition.json', [{k: r[k] for k in ['id', 'version', 'sha256']} for r in manifest['localSources']])
    write(support / 'managed-updates.json', {**proof, 'target': 'win-x64', 'policy': 'native-kernel-update-blocked; manual-verified-suite-update'})
    for name in ['先读我.md', '使用说明.txt']:
        shutil.copyfile(ROOT / 'release/rc451/使用说明.md', kit / name)
    shutil.copyfile(ROOT / 'release/rc451/Launcher.cs', args.stage / 'Launcher.cs')
    write(args.stage / 'hotfix-build.json', {'suiteVersion': manifest['version'], 'build': 'rc45.2',
        'packageRevision': '0.1.0-rc.4.5.1', 'previousSeedId': previous, 'seedId': manifest['seedId'],
        'market': row, 'updater': proof, 'existingConfigAutoReset': False})
    print(kit)


def pack(args):
    args.out.mkdir(parents=True, exist_ok=True)
    kit = args.stage / 'QCU助手'
    info = json.loads((args.stage / 'hotfix-build.json').read_text())
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    for row in manifest['seedFiles']:
        if sha(kit / row['path']) != row['sha256']:
            raise ValueError('Seed changed')
    rows = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in sorted(kit.rglob('*')) if p.is_file() and p.relative_to(kit).as_posix() not in ['support/files.json', 'SHA256SUMS']]
    write(kit / 'support/files.json', rows)
    (kit / 'SHA256SUMS').write_text(''.join(r['sha256'] + '  ' + r['path'] + '\n' for r in rows))
    archive = args.out / 'QCU-Teacher-0.1.0-rc.4.5.1-win-x64.zip'
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:
        for p in sorted(kit.rglob('*')):
            if p.is_file():
                z.write(p, 'QCU助手/' + p.relative_to(kit).as_posix())
    with zipfile.ZipFile(archive) as z:
        if z.testzip():
            raise ValueError('CRC failure')
    result = {**info, 'target': 'win-x64', 'file': archive.name, 'bytes': archive.stat().st_size,
              'sha256': sha(archive), 'modelCalls': 0}
    write(args.out / 'delivery.json', result)
    (args.out / 'SHA256SUMS').write_text(result['sha256'] + '  ' + archive.name + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['stage', 'pack'])
    p.add_argument('--base', type=Path)
    p.add_argument('--stage', type=Path, required=True)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    (stage if a.action == 'stage' else pack)(a)
