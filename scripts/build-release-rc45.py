"""Build the rc4.5 offline suites from pinned rc44.2 vendor runtimes.

Only pristine seed data is used. Never read an installed user's profile.
Windows launcher compilation and native checks run separately on Windows.
"""
import argparse
import gzip
import hashlib
import io
import json
import plistlib
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.1.0-rc.4.5'
BUILD = 'rc45.1'
CHANGED = ['qcu-market', 'qcu-expert-teams', 'qcu-branding']
EXTRA = ['qcu-hallmark-design', 'qcu-accounting-suite', 'qcu-deep-research',
         'qcu-document-team', 'qcu-data-copilot', 'qcu-ket-prep', 'qcu-ncre-prep']
BASE_HASH = {'mac-arm64': '7fb571edbb1067553160e1e649741f61ea6a2f45156fd67ba890ae4e81cf966b',
             'win-x64': '6303006068d3e3803b302df4acf5afa107736535850d9f63293d98b7918c1dee'}


def sha(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def package(name, output):
    folder = ROOT / ('hub/plugins' if name in CHANGED else 'packages') / name
    pkg = json.loads((folder / 'package.json').read_text())
    names = sorted(['package.json', *pkg['files']])
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name in names:
            p = folder / name
            if p.is_symlink() or '..' in Path(name).parts:
                raise ValueError('Unsafe source member')
            data = p.read_bytes()
            info = tarfile.TarInfo('package/' + name)
            info.size, info.mode, info.mtime = len(data), 0o644, 0
            tar.addfile(info, io.BytesIO(data))
    # Match existing deterministic publishers, which use an empty gzip filename.
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0, compresslevel=9) as f:
        f.write(raw.getvalue())
    data = compressed.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    filename = f'{pkg["name"]}-{pkg["version"]}-{digest}.tgz'
    output.mkdir(parents=True, exist_ok=True)
    target = output / filename
    if target.exists() and target.read_bytes() != data:
        raise ValueError('Immutable package conflict')
    target.write_bytes(data)
    return folder, {'id': pkg['name'], 'version': pkg['version'], 'file': filename,
                    'bytes': len(data), 'sha256': digest,
                    'source': 'file:./.qcu-bundles/' + filename,
                    'status': 'frozen-rc45-offline-input'}


def stage(args):
    if sha(args.base) != BASE_HASH[args.target]:
        raise ValueError('Pinned base ZIP mismatch')
    output = args.stage.resolve()
    if output.exists():
        raise ValueError('Stage must be fresh')
    output.mkdir(parents=True)
    if args.target == 'mac-arm64':
        subprocess.run(['/usr/bin/ditto', '-x', '-k', str(args.base), str(output)], check=True)
        app = output / 'QCU助手.app'
        kit = app / 'Contents/Resources'
    else:
        with zipfile.ZipFile(args.base) as z:
            if any('..' in Path(n).parts or n.startswith('/') for n in z.namelist()):
                raise ValueError('Unsafe base member')
            z.extractall(output)
        kit = output / 'QCU助手'
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    profile = kit / 'seed/profiles/desktop'
    pkg = json.loads((profile / 'package.json').read_text())
    patches = json.loads((profile / 'cordis.patch.yml').read_text())
    rows = manifest['localSources']
    archives = output / 'component-packages'
    for name in CHANGED + EXTRA:
        source, row = package(name, archives)
        old = next((r for r in rows if r['id'] == name), None)
        if old:
            rows.remove(old)
            (profile / '.qcu-bundles' / old['file']).unlink()
            shutil.rmtree(profile / 'node_modules' / name)
        dest = profile / 'node_modules' / name
        dest.mkdir()
        names = ['package.json', *json.loads((source / 'package.json').read_text())['files']]
        for n in names:
            p = dest / n
            p.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / n, p)
            p.chmod(0o644)
        shutil.copyfile(archives / row['file'], profile / '.qcu-bundles' / row['file'])
        rows.append(row)
        if not any(p['id'] == name for p in patches):
            patches.append({'id': name, 'disabled': False, 'config': {'enabled': True}})
    pkg['dependencies'] = {r['id']: r['source'] for r in rows}
    pkg['dsh']['profile']['bundles'] = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] + [r['id'] for r in rows]
    write(profile / 'package.json', pkg)
    write(profile / 'cordis.patch.yml', patches)
    for n in ['pnpm-lock.yaml', 'node_modules/.modules.yaml']:
        (profile / n).unlink(missing_ok=True)
    shutil.copytree(ROOT / 'release/rc45' / args.target / 'support', kit / 'support', dirs_exist_ok=True)
    composition = [{k: r[k] for k in ['id', 'version', 'sha256']} for r in rows]
    write(kit / 'support/rc45-composition.json', composition)
    manifest.update(version=VERSION, buildId=BUILD, target=args.target, localSources=rows,
                    branding={'id': 'qcu-branding', 'version': next(r['version'] for r in rows if r['id'] == 'qcu-branding')},
                    products=[{k: r[k] for k in ['id', 'version', 'file', 'bytes', 'sha256']} for r in rows if r['id'] != 'qcu-branding'])
    manifest.pop('migrateFrom', None)
    seed = []
    for p in sorted((kit / 'seed').rglob('*')):
        if p.is_symlink():
            raise ValueError('Seed must contain plain files only')
        if p.is_file():
            seed.append({'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size,
                         'sha256': sha(p), 'mode': p.stat().st_mode & 0o777})
    manifest['seedFiles'] = seed
    manifest['seedId'] = hashlib.sha256(json.dumps(seed, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    write(kit / 'support/manifest.json', manifest)
    guide = '# 城院助手 rc.4.5\n\n完整解压后打开 QCU助手。首次离线准备无需访问市场；模型服务及联网工具需自己的账号。\n\n数据目录为 teacher/0.1.0-rc.4.5，与旧版独立；不删除或自动迁移旧配置，请在设置中重新配置模型。已有工作文件夹可重新选择。\n\n首页常用直接打开任务草稿；工作助手支持收藏和固定；专家团从模板创建自己的可编辑团队。生成内容须由使用者检查。\n'
    (kit / '先读我.md').write_text(guide)
    if args.target == 'mac-arm64':
        info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
        info.update(QCUReleaseVersion=VERSION, QCUReleaseBuild=BUILD, CFBundleVersion='4.5.1',
                    CFBundleIdentifier='cn.qcu.teacher.rc45')
        (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
        launcher = app / 'Contents/MacOS' / info['CFBundleExecutable']
        subprocess.run(['/usr/bin/clang', '-fobjc-arc', '-mmacosx-version-min=13.0', '-framework', 'Cocoa',
                        str(ROOT / 'release/rc45/mac-arm64/Launcher.m'), '-o', str(launcher)], check=True)
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', str(app)], check=True)
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    write(output / 'composition.json', {'version': VERSION, 'build': BUILD, 'target': args.target,
          'baseSha256': BASE_HASH[args.target], 'seedId': manifest['seedId'], 'components': composition,
          'modelConfigured': False, 'coursePreinstalled': False, 'guiAccepted': False})
    print(kit)


def pack(args):
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=True)
    root = args.stage.resolve()
    kit = root / ('QCU助手.app/Contents/Resources' if args.target == 'mac-arm64' else 'QCU助手')
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    for r in manifest['seedFiles']:
        if sha(kit / r['path']) != r['sha256']:
            raise ValueError('Seed modified after staging')
    archive = output / f'QCU-Teacher-{VERSION}-{args.target}.zip'
    if archive.exists():
        raise ValueError('Refusing immutable ZIP overwrite')
    if args.target == 'mac-arm64':
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(root / 'QCU助手.app')], check=True)
        subprocess.run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(root / 'QCU助手.app'), str(archive)], check=True)
    else:
        exe = (kit / 'QCU助手.exe').read_bytes()
        import struct
        at = struct.unpack_from('<I', exe, 60)[0]
        if exe[:2] != b'MZ' or struct.unpack_from('<H', exe, at + 4)[0] != 0x8664:
            raise ValueError('Expected compiled x64 launcher')
        rows = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
                for p in sorted(kit.rglob('*')) if p.is_file() and p.relative_to(kit).as_posix() not in ['support/files.json', 'SHA256SUMS']]
        write(kit / 'support/files.json', rows)
        (kit / 'SHA256SUMS').write_text(''.join(r['sha256'] + '  ' + r['path'] + '\n' for r in rows))
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:
            for p in sorted(kit.rglob('*')):
                if p.is_file():
                    z.write(p, 'QCU助手/' + p.relative_to(kit).as_posix())
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP integrity failed')
    result = {'version': VERSION, 'build': BUILD, 'target': args.target, 'file': archive.name,
              'bytes': archive.stat().st_size, 'sha256': sha(archive), 'seedId': manifest['seedId'],
              'modelCalls': 0, 'guiAcceptance': 'pending', 'legacyDataMigration': 'not-automatic'}
    write(output / 'delivery.json', result)
    (output / 'SHA256SUMS').write_text(result['sha256'] + '  ' + archive.name + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['stage', 'pack'])
    p.add_argument('--target', choices=list(BASE_HASH), required=True)
    p.add_argument('--base', type=Path)
    p.add_argument('--stage', type=Path, required=True)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    (stage if a.action == 'stage' else pack)(a)
