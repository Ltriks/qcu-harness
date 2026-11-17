"""Immutable Mac Apple Silicon hotfix on rc45.1: cloud market + verify native updater lock.

Keeps the rc4.5 data home, updates only the frozen managed market component,
and refuses independently edited existing installations. Never reads user data.
Does not re-apply Windows ASAR patches; verifies the existing Mac managed ASAR.
"""
import argparse
import hashlib
import importlib.util
import json
import plistlib
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = '8d7112cd3f65a20b239d0ab1d4daef46e116cb7170bbf1f0fe7235c7934c0612'
EXPECTED_CUSTOM_ASAR = '759bf095f7e4e6b97380f6103a9a6b8c34fc980c4b7b9b34bd1c1cf1f8ed0583'
PACKAGE = '0.1.0-rc.4.5.1'
BUILD = 'rc45.2'


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


def verify_existing_mac_guard(kit):
    proof = json.loads((kit / 'support/managed-updates.json').read_text())
    asar = kit / 'program/DeepSeek Harness.app/Contents/Resources/app.asar'
    if proof.get('customAsarSha256') != EXPECTED_CUSTOM_ASAR or sha(asar) != EXPECTED_CUSTOM_ASAR:
        raise ValueError('Mac managed ASAR digest mismatch; refusing Windows-style re-patch')
    if proof.get('managedUpdates') is not True or proof.get('minimumVersionPolicyUnchanged') is not True:
        raise ValueError('Mac managed-updates policy markers missing')
    if proof.get('securityFusesChanged') is not False or proof.get('vendorExecutableCodePatched') is not False:
        raise ValueError('Unexpected Mac fuse/vendor patch state')
    guard = load('guard', ROOT / 'tools/teacher-branding/managed-updates.py')
    main = guard.member(asar.read_bytes(), 'lib/main.js')
    if b'QCU_MANAGED_UPDATES' not in main or '套件版本说明'.encode() not in main:
        raise ValueError('Mac ASAR managed-update markers missing')
    return {**proof, 'target': 'mac-arm64',
            'policy': 'native-kernel-update-blocked; verified-existing-mac-asar; manual-verified-suite-update',
            'asarRepatched': False, 'verifiedMainHasManagedGuard': True}


def stage(args):
    if sha(args.base) != BASE_SHA or args.stage.exists():
        raise ValueError('Pinned base and fresh stage required')
    args.stage.mkdir(parents=True)
    subprocess.run(['/usr/bin/ditto', '-x', '-k', str(args.base), str(args.stage)], check=True)
    app = args.stage / 'QCU助手.app'
    kit = app / 'Contents/Resources'
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    previous = manifest['seedId']
    if previous != 'b69fcd0a75b0addaac4858162024165e3643b97b71d6da8e54c2f179ec70fb37':
        raise ValueError('Unexpected Mac rc4.5 seedId')
    frozen = [{**r, 'path': r['path'].split('/node_modules/qcu-market/', 1)[1]}
              for r in manifest['seedFiles'] if '/node_modules/qcu-market/' in r['path']]
    write(kit / 'support/rc451-previous-market.json', frozen)
    proof = verify_existing_mac_guard(kit)
    # Extract patched main for offline verifier (does not modify ASAR).
    guard = load('guard', ROOT / 'tools/teacher-branding/managed-updates.py')
    asar = kit / 'program/DeepSeek Harness.app/Contents/Resources/app.asar'
    (args.stage / 'patched-main.js').write_bytes(guard.member(asar.read_bytes(), 'lib/main.js'))
    write(args.stage / 'updater-guard.json', proof)
    builder = load('rc45builder', ROOT / 'scripts/build-release-rc45.py')
    source, row = builder.package('qcu-market', args.stage / 'component-packages')
    if row['version'] != '0.1.0-pilot.16.15':
        raise ValueError('Expected market 16.15')
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
    trust = (module / 'src/public-trust.mjs').read_text()
    if 'https://111.229.103.201' not in trust:
        raise ValueError('Market public trust is not the Tencent cloud origin')
    (profile / '.qcu-bundles' / old['file']).unlink()
    shutil.copyfile(args.stage / 'component-packages' / row['file'], profile / '.qcu-bundles' / row['file'])
    pkg_json = json.loads((profile / 'package.json').read_text())
    pkg_json['dependencies']['qcu-market'] = row['source']
    write(profile / 'package.json', pkg_json)
    shutil.copyfile(ROOT / 'release/rc451/refresh-managed.cjs', kit / 'support/refresh-managed.cjs')
    integrated = (kit / 'support/integrated.cjs').read_text()
    marker = "  if(r.version===m.version&&m.version==='0.1.0-rc.4.4')"
    if marker not in integrated:
        raise ValueError('Frozen startup refresh anchor changed')
    hook = ("  if(r.version===m.version&&m.version==='0.1.0-rc.4.5'&&m.buildId==='rc45.2')"
            "return at('profile',()=>require('./refresh-managed.cjs')(kit,home,m,h,parseYaml,r));\n")
    if hook not in integrated:
        integrated = integrated.replace(marker, hook + marker)
        (kit / 'support/integrated.cjs').write_text(integrated)
    for name in ['release-info.json', 'incidents.cjs']:
        p = kit / 'support' / name
        text = p.read_text()
        if 'rc45.1' not in text:
            raise ValueError(f'Missing rc45.1 marker in {name}')
        p.write_text(text.replace('rc45.1', 'rc45.2'))
    manifest['buildId'] = BUILD
    manifest['products'] = [{k: r[k] for k in ['id', 'version', 'file', 'bytes', 'sha256']}
                            for r in manifest['localSources'] if r['id'] != 'qcu-branding']
    manifest['seedFiles'] = [{'path': p.relative_to(kit).as_posix(), 'bytes': p.stat().st_size,
                              'sha256': sha(p), 'mode': p.stat().st_mode & 0o777}
                             for p in sorted((kit / 'seed').rglob('*')) if p.is_file()]
    manifest['seedId'] = hashlib.sha256(json.dumps(manifest['seedFiles'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    write(kit / 'support/manifest.json', manifest)
    write(kit / 'support/rc45-composition.json', [{k: r[k] for k in ['id', 'version', 'sha256']} for r in manifest['localSources']])
    write(kit / 'support/managed-updates.json', proof)
    for name in ['先读我.md', '使用说明.txt']:
        shutil.copyfile(ROOT / 'release/rc451/使用说明-mac.md', kit / name)
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    info.update(QCUReleaseVersion='0.1.0-rc.4.5', QCUReleaseBuild=BUILD, QCUPackageRevision=PACKAGE,
                CFBundleVersion='4.5.2', CFBundleIdentifier='cn.qcu.teacher.rc45')
    (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
    launcher = app / 'Contents/MacOS' / info['CFBundleExecutable']
    subprocess.run(['/usr/bin/clang', '-fobjc-arc', '-mmacosx-version-min=13.0', '-framework', 'Cocoa',
                    str(ROOT / 'release/rc45/mac-arm64/Launcher.m'), '-o', str(launcher)], check=True)
    subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', str(app)], check=True)
    subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    write(args.stage / 'hotfix-build.json', {
        'suiteVersion': manifest['version'], 'build': BUILD, 'packageRevision': PACKAGE,
        'previousSeedId': previous, 'seedId': manifest['seedId'], 'market': row, 'updater': proof,
        'existingConfigAutoReset': False, 'notarized': False, 'signing': 'ad-hoc',
        'gatekeeperBypass': False
    })
    print(kit)


def pack(args):
    args.out.mkdir(parents=True, exist_ok=True)
    app = args.stage / 'QCU助手.app'
    kit = app / 'Contents/Resources'
    info = json.loads((args.stage / 'hotfix-build.json').read_text())
    manifest = json.loads((kit / 'support/manifest.json').read_text())
    for row in manifest['seedFiles']:
        if sha(kit / row['path']) != row['sha256']:
            raise ValueError('Seed changed')
    archive = args.out / f'QCU-Teacher-{PACKAGE}-mac-arm64.zip'
    if archive.exists():
        raise ValueError('Refusing immutable ZIP overwrite')
    subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    subprocess.run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(app), str(archive)], check=True)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('CRC failure')
    result = {**info, 'target': 'mac-arm64', 'file': archive.name, 'bytes': archive.stat().st_size,
              'sha256': sha(archive), 'modelCalls': 0, 'guiAcceptance': 'pending',
              'legacyDataMigration': 'not-automatic'}
    write(args.out / 'delivery.json', result)
    (args.out / 'SHA256SUMS').write_text(result['sha256'] + '  ' + archive.name + '\n')
    shutil.copyfile(ROOT / 'release/rc451/使用说明-mac.md', args.out / 'INSTALL-mac-arm64.md')
    (args.out / 'SHA256SUMS-mac-arm64.txt').write_text(result['sha256'] + '  ' + archive.name + '\n')
    print(json.dumps({k: result[k] for k in ['file', 'bytes', 'sha256', 'seedId', 'build', 'packageRevision']}))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['stage', 'pack'])
    p.add_argument('--base', type=Path)
    p.add_argument('--stage', type=Path, required=True)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    (stage if a.action == 'stage' else pack)(a)
