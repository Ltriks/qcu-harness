#!/usr/bin/env python3
"""Build a native, preinstalled Mac teacher app from verified offline inputs."""
import argparse
import hashlib
import importlib.util
import json
import plistlib
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def inventory(root, digest):
    return [{'path': p.relative_to(root).as_posix(),
             **({'link': p.readlink().as_posix()} if p.is_symlink() else
                {'bytes': p.stat().st_size, 'sha256': digest(p), 'mode': p.stat().st_mode & 0o777})}
            for p in sorted(root.rglob('*')) if p.is_symlink() or p.is_file()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--zip', action='store_true')
    args = parser.parse_args()
    if args.out.exists() or Path(str(args.out) + '.zip').exists():
        raise ValueError('Fresh output required')
    spec = importlib.util.spec_from_file_location('offline_builder', ROOT / 'scripts/build-offline-suite.py')
    base = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    config = json.loads((ROOT / 'release/offline-products.json').read_text())
    client = config['clients']['mac-arm64']
    dmg = base.checked(args.inputs / client['file'], client['sha256'], client['bytes']).resolve()
    products = [p for p in config['products'] if p['id'] != 'qcu-market']
    if len(products) != 9:
        raise ValueError('Expected nine teacher products')
    notices = {p['id']: base.bundle_metadata(base.checked(args.inputs / 'bundles' / p['file'], p['sha256'], p['bytes']), p) for p in products}
    args.out.mkdir(parents=True)
    app = args.out / '城院助手.app'
    resources = app / 'Contents/Resources'
    resources.mkdir(parents=True)
    vendor = resources / 'program/DeepSeek Harness.app'
    with tempfile.TemporaryDirectory(prefix='qcu-mac-dmg-') as mount:
        run('/usr/bin/hdiutil', 'attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg)
        try:
            original = Path(mount) / 'DeepSeek Harness.app'
            run('/usr/bin/codesign', '--verify', '--deep', '--strict', original)
            run('/usr/bin/ditto', original, vendor)
            vendor_files = inventory(original, base.digest)
            if vendor_files != inventory(vendor, base.digest):
                raise ValueError('Official app copy differs from verified DMG')
        finally:
            run('/usr/bin/hdiutil', 'detach', mount)
    support = resources / 'support'
    templates = ROOT / 'tools/teacher-suite'
    base.copy(templates / 'start.cjs', support / 'start.cjs')
    for name in ['offline.cjs', 'smoke.cjs', 'deny-network.cjs']:
        base.copy(ROOT / 'tools/offline-suite' / name, support / name)
    seed = resources / 'seed'
    profile = seed / 'profiles/desktop'
    profile.mkdir(parents=True)
    for p in products:
        dest = profile / 'node_modules' / p['id']
        with tarfile.open(args.inputs / 'bundles' / p['file']) as archive:
            for member in archive.getmembers():
                file = dest / Path(member.name).relative_to('package')
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(archive.extractfile(member).read())
                file.chmod(0o644)
        for name, data in notices[p['id']].items():
            target = resources / 'licenses' / p['id'] / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    manifest = {'name': 'qcu-teacher-desktop', 'private': True, 'dependencies': {p['id']: p['version'] for p in products},
                'dsh': {'profile': {'bundles': ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] + [p['id'] for p in products]}}}
    (profile / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (profile / 'cordis.yml').write_text('[]\n')
    patches = [{'id': p['componentId'], 'disabled': False,
                **({'config': {'cliPath': '', 'documentUrl': ''}} if p['id'] == 'qcu-feishu-readonly' else {})} for p in products]
    patches.append({'id': 'webserver', 'config': {'host': '127.0.0.1', 'port': 0}})
    (profile / 'cordis.patch.yml').write_text(json.dumps(patches, indent=2) + '\n')
    asset, expected, name = base.LARK['mac-arm64']
    native = base.lark_binary(base.checked(args.inputs / asset, expected), 'mac-arm64')
    (seed / 'bin').mkdir()
    (seed / 'bin' / name).write_bytes(native)
    (seed / 'bin' / name).chmod(0o755)
    base.copy(args.inputs / 'lark-cli.LICENSE', resources / 'licenses/lark-cli/LICENSE')
    base.copy(ROOT / 'LICENSE', resources / 'licenses/QCU-MIT-LICENSE')
    base.copy(templates / 'mac使用说明.txt', args.out / '先读我.txt')
    base.copy(base.checked(args.inputs / 'QCU-WorkBuddy-Skills-0.1.0-rc.1.zip', base.WORKBUDDY, 43243),
              args.out / 'WorkBuddy手工导入' / 'QCU-WorkBuddy-Skills-0.1.0-rc.1.zip')
    rows = inventory(seed, base.digest)
    rows = [{**r, 'path': 'seed/' + r['path']} for r in rows]
    release = {'schemaVersion': 1, 'version': '0.1.0-rc.2', 'target': 'mac-arm64', 'dshVersion': config['dshVersion'],
               'products': products, 'seedFiles': rows, 'seedId': hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(),
               'client': client, 'modelConfigured': False, 'marketIncluded': False}
    (support / 'manifest.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
    (support / 'vendor-files.json').write_text(json.dumps(vendor_files, ensure_ascii=False, indent=2) + '\n')
    vendor_info = plistlib.loads((vendor / 'Contents/Info.plist').read_bytes())
    icon = vendor_info.get('CFBundleIconFile')
    info = {'CFBundleIdentifier': 'cn.edu.qcu.teacher.launcher', 'CFBundleName': '城院助手',
            'CFBundleDisplayName': '城院助手', 'CFBundleExecutable': '城院助手', 'CFBundlePackageType': 'APPL',
            'CFBundleShortVersionString': '0.1.0', 'CFBundleVersion': '2', 'LSMinimumSystemVersion': '13.0',
            'NSHighResolutionCapable': True, 'LSUIElement': True, 'LSApplicationCategoryType': 'public.app-category.education'}
    if icon:
        if not icon.endswith('.icns'):
            icon += '.icns'
        base.copy(vendor / 'Contents/Resources' / icon, resources / 'AppIcon.icns')
        info['CFBundleIconFile'] = 'AppIcon.icns'
    (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
    binary = app / 'Contents/MacOS/城院助手'
    binary.parent.mkdir()
    run('/usr/bin/xcrun', 'clang', '-fobjc-arc', '-framework', 'Cocoa', '-arch', 'arm64', '-mmacosx-version-min=13.0',
        templates / 'Launcher.m', '-o', binary)
    run('/usr/bin/codesign', '--force', '--sign', '-', app)
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', app)
    if inventory(vendor, base.digest) != vendor_files:
        raise ValueError('Signing altered the official app')
    # Sidecars stay outside the signed app, which is never edited after signing.
    records = inventory(app, base.digest)
    (args.out / 'app-files.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    output = {'target': 'mac-arm64', 'directory': str(args.out.resolve()), 'products': 9, 'seedId': release['seedId'],
              'vendorFilesUnchanged': True, 'launcherSignature': 'ad-hoc', 'notarized': False}
    if args.zip:
        archive = Path(str(args.out) + '.zip')
        run('/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', args.out, archive)
        output['archive'] = {'file': archive.name, 'bytes': archive.stat().st_size, 'sha256': base.digest(archive)}
    print(json.dumps(output))


if __name__ == '__main__':
    main()
