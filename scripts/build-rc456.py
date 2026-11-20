"""QCU Buddy rc.4.5.6 / rc45.7: approved school symbol and display-name release.

Base: published 0.1.0-rc.4.5.5 ZIPs. Keeps teacher/0.1.0-rc.4.5 data home.
"""
import argparse
import hashlib
import importlib.util
import json
import plistlib
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = '0.1.0-rc.4.5.6'
BUILD = 'rc45.7'
SUITE = '0.1.0-rc.4.5'
BASE = {
    'win-x64': {
        'sha': '667b3131c5a1f82836fe209bea9c2f31ff35a7e481ddd5a064f039bf953a6cad',
        'zip_name': 'QCU-Teacher-0.1.0-rc.4.5.5-win-x64.zip',
        'previous_seed': '37f512bb8a4940f0c41750c4961cbe4db02b2a69a7702048d31bb77470894e8b',
    },
    'mac-arm64': {
        'sha': 'd583d40d87dd835bec1a94291f77fed4001c67ae092dc5e0bcda1c1a68bd8ed9',
        'zip_name': 'QCU-Teacher-0.1.0-rc.4.5.5-mac-arm64.zip',
        'previous_seed': '0ddf9a0a028f58ccb4b73d1e44ab867f03e39615eb67288fc4f274bb6de14bd0',
        'asar': '759bf095f7e4e6b97380f6103a9a6b8c34fc980c4b7b9b34bd1c1cf1f8ed0583',
    },
}


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


def kit_paths(stage, target):
    if target == 'mac-arm64':
        app = stage / 'QCU Buddy.app'
        return app, app / 'Contents/Resources'
    return None, stage / 'QCU Buddy'


def snapshot_branding(profile):
    root = profile / 'node_modules/qcu-branding'
    rows = []
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise ValueError('branding link')
        if p.is_file():
            rows.append({
                'path': p.relative_to(root).as_posix(),
                'bytes': p.stat().st_size,
                'sha256': sha(p),
            })
    return rows


def replace_branding(kit, stage):
    builder = load('rc45builder', ROOT / 'scripts/build-release-rc45.py')
    source, row = builder.package('qcu-branding', stage / 'component-packages')
    gate = (source / 'index.js').read_text()
    if "0.1.0-rc.4.5" not in gate or 'rc45' not in gate or 'rc44' in gate:
        raise ValueError('Branding diagnostics gate is not rc.4.5 / rc45')
    profile = kit / 'seed/profiles/desktop'
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    old = next(r for r in manifest['localSources'] if r['id'] == 'qcu-branding')
    write(kit / 'support/rc452-previous-branding.json', snapshot_branding(profile))
    module = profile / 'node_modules/qcu-branding'
    shutil.rmtree(module)
    module.mkdir()
    pkg = json.loads((source / 'package.json').read_text())
    for name in ['package.json', *pkg['files']]:
        dest = module / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, dest)
        dest.chmod(0o644)
    (profile / '.qcu-bundles' / old['file']).unlink()
    shutil.copyfile(stage / 'component-packages' / row['file'], profile / '.qcu-bundles' / row['file'])
    pkg_json = json.loads((profile / 'package.json').read_text())
    pkg_json['dependencies']['qcu-branding'] = row['source']
    write(profile / 'package.json', pkg_json)
    manifest['localSources'] = [row if r['id'] == row['id'] else r for r in manifest['localSources']]
    return manifest, row


def bump_support(kit, target):
    # Keep RPC onboarding and its pinned preference implementation in the same kit.
    for name in ['diagnostics-api.cjs', 'lan-report.cjs']:
        shutil.copyfile(ROOT / 'release/rc45' / target / 'support' / name, kit / 'support' / name)
    refresh = (ROOT / 'release/rc456/refresh-managed.cjs').read_text()
    if f"m.buildId!=='{BUILD}'" not in refresh:
        raise ValueError('Refresh hook build mismatch')
    (kit / 'support/refresh-managed.cjs').write_text(refresh)
    integrated = (kit / 'support/integrated.cjs').read_text()
    branding_version = json.loads((ROOT / 'hub/plugins/qcu-branding/package.json').read_text())['version']
    integrated = re.sub(r"'0\.1\.0-rc\.4\.5':\[[^\]]+\]", "'0.1.0-rc.4.5':['" + branding_version + "']", integrated)
    # Base 4.5.1 ships rc45.2; always retarget the managed-refresh hook to this BUILD.
    integrated = re.sub(r"m\.buildId==='rc45\.[0-9]+'", f"m.buildId==='{BUILD}'", integrated, count=1)
    if f"m.buildId==='{BUILD}'" not in integrated:
        raise ValueError('Expected rc45.x refresh hook in integrated.cjs')
    (kit / 'support/integrated.cjs').write_text(integrated)
    for name in ['release-info.json', 'incidents.cjs']:
        p = kit / 'support' / name
        text = p.read_text()
        if not re.search(r'rc45\.[0-9]+', text):
            raise ValueError(f'Missing rc45.x marker in {name}')
        p.write_text(re.sub(r'rc45\.[0-9]+', BUILD, text))
    guide = ROOT / ('release/rc456/使用说明-mac.md' if target == 'mac-arm64' else 'release/rc456/使用说明.md')
    text = re.sub(r'rc\.4\.5\.[0-9]+', 'rc.4.5.6', guide.read_text())
    text = re.sub(r'rc45\.[0-9]+', BUILD, text)
    for name in ['先读我.md', '使用说明.txt']:
        (kit / name).write_text(text)


def finalize_manifest(kit, manifest):
    manifest['buildId'] = BUILD
    manifest['products'] = [{k: r[k] for k in ['id', 'version', 'file', 'bytes', 'sha256']}
                            for r in manifest['localSources'] if r['id'] != 'qcu-branding']
    manifest['branding'] = {
        'id': 'qcu-branding',
        'version': next(r['version'] for r in manifest['localSources'] if r['id'] == 'qcu-branding'),
    }
    seed = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size,
             'sha256': sha(p), 'mode': p.stat().st_mode & 0o777}
            for p in sorted((kit / 'seed').rglob('*')) if p.is_file()]
    manifest['seedFiles'] = seed
    manifest['seedId'] = hashlib.sha256(
        json.dumps(seed, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    write(kit / 'support/manifest.json', manifest)
    write(kit / 'support/rc45-composition.json',
          [{k: r[k] for k in ['id', 'version', 'sha256']} for r in manifest['localSources']])
    subprocess.run(['node', '-e', "const kit=process.argv[1];require(require('node:path').join(kit,'support/start.cjs')).identity(kit)", str(kit.resolve())], check=True)
    return manifest


def stage(args):
    meta = BASE[args.target]
    if sha(args.base) != meta['sha'] or args.stage.exists():
        raise ValueError('Pinned 4.5.5 base and fresh stage required')
    args.stage.mkdir(parents=True)
    if args.target == 'mac-arm64':
        subprocess.run(['/usr/bin/ditto', '-x', '-k', str(args.base), str(args.stage)], check=True)
    else:
        with zipfile.ZipFile(args.base) as z:
            z.extractall(args.stage)
    # Rename only outer delivery paths; application IDs and data paths are stable.
    old_root = args.stage / ('QCU助手.app' if args.target == 'mac-arm64' else 'QCU助手')
    old_root.rename(args.stage / ('QCU Buddy.app' if args.target == 'mac-arm64' else 'QCU Buddy'))
    app, kit = kit_paths(args.stage, args.target)
    if args.target == 'win-x64':
        (kit / 'QCU助手.exe').rename(kit / 'QCU Buddy.exe')
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    if manifest.get('seedId') != meta['previous_seed'] or manifest.get('buildId') != 'rc45.6':
        raise ValueError('Unexpected 4.5.5 baseline identity')
    previous = manifest['seedId']
    if args.target == 'mac-arm64':
        proof = json.loads((kit / 'support/managed-updates.json').read_text())
        asar = kit / 'program/DeepSeek Harness.app/Contents/Resources/app.asar'
        if proof.get('customAsarSha256') != meta['asar'] or sha(asar) != meta['asar']:
            raise ValueError('Mac managed ASAR digest mismatch')
    else:
        proof = json.loads((kit / 'support/managed-updates.json').read_text())
    manifest, branding = replace_branding(kit, args.stage)
    bump_support(kit, args.target)
    for support_file in ['start.cjs']:
        file = kit / 'support' / support_file
        file.write_text(file.read_text().replace('QCU助手', 'QCU Buddy').replace('城院助手', 'QCU Buddy'))
    proof = load('buddy_brand', ROOT / 'tools/teacher-branding/buddy-brand.py').apply(kit, args.target)
    manifest['displayName'] = 'QCU Buddy'
    manifest = finalize_manifest(kit, manifest)
    if args.target == 'mac-arm64':
        info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
        old_launcher = app / 'Contents/MacOS' / info['CFBundleExecutable']
        old_launcher.rename(app / 'Contents/MacOS/QCU Buddy')
        info.update(CFBundleDisplayName='QCU Buddy', CFBundleName='QCU Buddy', CFBundleExecutable='QCU Buddy')
        icon_name = info.get('CFBundleIconFile', 'QCU.icns')
        shutil.copyfile(ROOT / 'release/rc456/assets/QCUBuddy.icns', kit / icon_name)
        info.update(QCUReleaseVersion=SUITE, QCUReleaseBuild=BUILD, QCUPackageRevision=PACKAGE,
                    CFBundleVersion='4.5.6', CFBundleIdentifier='cn.qcu.teacher.rc45')
        (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
        launcher_src = (ROOT / 'release/rc45/mac-arm64/Launcher.m').read_text()
        if f'BUILD=@"{BUILD}"' not in launcher_src and 'BUILD=@"rc45.' not in launcher_src:
            raise ValueError('Launcher.m build marker missing')
        patched = args.stage / 'Launcher.m'
        patched.write_text(re.sub(r'BUILD=@"rc45\.[0-9]+"', f'BUILD=@"{BUILD}"', launcher_src, count=1))
        launcher = app / 'Contents/MacOS' / info['CFBundleExecutable']
        subprocess.run(['/usr/bin/clang', '-fobjc-arc', '-mmacosx-version-min=13.0', '-framework', 'Cocoa',
                        str(patched), '-o', str(launcher)], check=True)
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', str(kit / 'program/DeepSeek Harness.app')], check=True)
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', str(app)], check=True)
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    else:
        cs = re.sub(r'rc45\.[0-9]+', BUILD, (ROOT / 'release/rc451/Launcher.cs').read_text())
        (args.stage / 'Launcher.cs').write_text(cs)
    write(args.stage / 'hotfix-build.json', {
        'suiteVersion': SUITE, 'build': BUILD, 'packageRevision': PACKAGE,
        'previousSeedId': previous, 'seedId': manifest['seedId'], 'branding': branding,
        'updater': proof, 'existingConfigAutoReset': False,
        'diagGate': '0.1.0-rc.4.5/rc45.*', 'target': args.target,
    })
    print(kit)


def pack(args):
    args.out.mkdir(parents=True, exist_ok=True)
    app, kit = kit_paths(args.stage, args.target)
    info = json.loads((args.stage / 'hotfix-build.json').read_text())
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    if args.target == 'win-x64' and BUILD.encode('utf-16le') not in (kit / 'QCU Buddy.exe').read_bytes():
        raise ValueError('Windows launcher must be compiled for this build before packing')
    for row in manifest['seedFiles']:
        if sha(kit / row['path']) != row['sha256']:
            raise ValueError('Seed changed')
    archive = args.out / f'QCU-Buddy-{PACKAGE}-{args.target}.zip'
    if archive.exists():
        raise ValueError('Refusing immutable ZIP overwrite')
    if args.target == 'mac-arm64':
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True)
        subprocess.run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(app), str(archive)], check=True)
        install = re.sub(r'rc45\.[0-9]+', BUILD, re.sub(r'rc\.4\.5\.[0-9]+', 'rc.4.5.6', (ROOT / 'release/rc456/使用说明-mac.md').read_text()))
        (args.out / 'INSTALL-mac-arm64.md').write_text(install)
        (args.out / '安装说明.md').write_text(install)
    else:
        rows = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
                for p in sorted(kit.rglob('*')) if p.is_file()
                and p.relative_to(kit).as_posix() not in ['support/files.json', 'SHA256SUMS']]
        write(kit / 'support/files.json', rows)
        (kit / 'SHA256SUMS').write_text(''.join(r['sha256'] + '  ' + r['path'] + '\n' for r in rows))
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:
            for p in sorted(kit.rglob('*')):
                if p.is_file():
                    z.write(p, 'QCU Buddy/' + p.relative_to(kit).as_posix())
        install = re.sub(r'rc45\.[0-9]+', BUILD, re.sub(r'rc\.4\.5\.[0-9]+', 'rc.4.5.6', (ROOT / 'release/rc456/使用说明.md').read_text()))
        (args.out / 'INSTALL-win-x64.md').write_text(install)
        (args.out / '安装说明.md').write_text(install)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('CRC failure')
    result = {**info, 'file': archive.name, 'bytes': archive.stat().st_size,
              'sha256': sha(archive), 'modelCalls': 0}
    write(args.out / 'delivery.json', result)
    sums = result['sha256'] + '  ' + archive.name + '\n'
    (args.out / 'SHA256SUMS').write_text(sums)
    (args.out / f'SHA256SUMS-{args.target}.txt').write_text(sums)
    print(json.dumps({k: result[k] for k in ['file', 'bytes', 'sha256', 'seedId', 'build', 'packageRevision']}))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['stage', 'pack'])
    p.add_argument('--target', choices=['win-x64', 'mac-arm64'], required=True)
    p.add_argument('--base', type=Path)
    p.add_argument('--stage', type=Path, required=True)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    (stage if a.action == 'stage' else pack)(a)
