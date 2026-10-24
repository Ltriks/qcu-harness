#!/usr/bin/env python3
"""Verify the shipped ZIP, native preparation and actual offline skill loading."""
import argparse
import hashlib
import importlib.util
import json
import os
import plistlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Choose a fresh test directory')
    args.out.mkdir(parents=True)
    args.out = args.out.resolve()
    archive = args.archive.resolve()
    spec = importlib.util.spec_from_file_location('mac_builder', ROOT / 'scripts/build-teacher-macos.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    def digest(p):
        with p.open('rb') as f:
            h = hashlib.sha256()
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
            return h.hexdigest()
    def run(name, command, env=None):
        result = subprocess.run([str(v) for v in command], env=env, capture_output=True, text=True, timeout=120)
        (args.out / (name + '.log')).write_text(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError(name + ' failed: ' + result.stderr[-2000:])
        return result.stdout
    extracted = args.out / '解压 中文 空格'
    run('extract', ['/usr/bin/ditto', '-x', '-k', archive, extracted])
    package = extracted / archive.stem
    apps = list(package.glob('*.app'))
    if len(apps) != 1:
        raise ValueError('Expected one user entry app')
    app = apps[0]
    app_name = app.name
    resources = app / 'Contents/Resources'
    expected = json.loads((package / 'app-files.json').read_text())
    if builder.inventory(app, digest) != expected:
        raise ValueError('Extracted app differs from archive inventory')
    run('signature', ['/usr/bin/codesign', '--verify', '--deep', '--strict', app])
    run('official-signature', ['/usr/bin/codesign', '--verify', '--deep', '--strict', resources / 'program/DeepSeek Harness.app'])
    actual_vendor = builder.inventory(resources / 'program/DeepSeek Harness.app', digest)
    original_vendor = json.loads((resources / 'support/vendor-files.json').read_text())
    manifest = json.loads((resources / 'support/manifest.json').read_text())
    vendor_info = plistlib.loads((resources / 'program/DeepSeek Harness.app/Contents/Info.plist').read_bytes())
    helper = resources / 'program/DeepSeek Harness.app/Contents/Frameworks' / (vendor_info['CFBundleName'] + ' Helper.app')
    if not helper.is_dir():
        raise ValueError('Electron helper bundle missing for CFBundleName')
    branded = bool(manifest.get('branding'))
    changes = []
    if branded:
        original = {row['path']: row for row in original_vendor}
        current = {row['path']: row for row in actual_vendor}
        changes = [name for name in sorted(original.keys() | current.keys()) if original.get(name) != current.get(name)]
        allowed = {'Contents/Info.plist', 'Contents/MacOS/DeepSeek Harness', 'Contents/Resources/QCU.icns', 'Contents/_CodeSignature/CodeResources'}
        if set(changes) - allowed:
            raise ValueError('Unexpected customization changes: ' + str(changes))
    elif actual_vendor != original_vendor:
        raise ValueError('Vendor payload differs from verified DMG')
    executable = resources / 'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
    home = args.out / '城院 个人 数据'
    env = os.environ.copy()
    env.pop('NODE_OPTIONS', None)
    env['QCU_TEACHER_TEST_HOME'] = str(home)
    native = app / 'Contents/MacOS/城院助手'
    first = run('native-first', [native, '--prepare-only'], env)
    if '"result":"prepared"' not in first:
        raise ValueError('Expected a first preparation')
    patch = home / 'profiles/desktop/cordis.patch.yml'
    patch.write_bytes(patch.read_bytes() + b'\n')
    before = patch.read_bytes()
    note = home / 'workspace/保留我的备课.txt'
    note.write_text('合成验收内容；不含个人资料。')
    # Move the complete application, then repeat from a new path.
    moved = args.out / '移动后的 城院应用'
    package.rename(moved)
    app = moved / app_name
    resources = app / 'Contents/Resources'
    repeat = run('native-repeat', [app / 'Contents/MacOS/城院助手', '--prepare-only'], env)
    if 'already-prepared' not in repeat or patch.read_bytes() != before or not note.exists():
        raise ValueError('Repeat after relocation did not preserve data')
    executable = resources / 'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
    env['ELECTRON_RUN_AS_NODE'] = '1'
    guard = args.out / 'guard.cjs'
    guard.write_text("require(" + json.dumps(str(resources / 'support/deny-network.cjs')) + ");\n"
                     "const fs=require('node:fs');const deny=()=>{fs.appendFileSync(process.env.QCU_OFFLINE_TEST_LOG,JSON.stringify({event:'child-process-blocked'})+'\\n');throw Error('Child processes disabled for offline proof')};for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('node:child_process')[k]=deny;\n")
    env['QCU_OFFLINE_TEST_LOG'] = str(args.out / 'guard.jsonl')
    fresh = args.out / '空白 离线 数据'
    guarded = env.copy()
    guarded['QCU_TEACHER_TEST_HOME'] = str(fresh)
    run('guarded-prepare', [executable, '--require', guard, '--expose-internals', resources / 'support/start.cjs', 'prepare', '--kit', resources], guarded)
    output = run('smoke', [executable, '--require', guard, '--expose-internals', resources / 'support/smoke.cjs',
                           resources / 'program/DeepSeek Harness.app/Contents/Resources', fresh, resources / 'support'], env)
    smoke = json.loads(next(line.split(':', 1)[1] for line in output.splitlines() if line.startswith('QCU_OFFLINE_SMOKE:')))
    events = [json.loads(line) for line in (args.out / 'guard.jsonl').read_text().splitlines()]
    if any(e['event'] != 'guard-installed' for e in events) or len(smoke['imports']) != 9 or len(smoke['skills']) != 7 or not smoke['networkGuard']:
        raise ValueError('Offline runtime checks failed')
    patches = json.loads((fresh / 'profiles/desktop/cordis.patch.yml').read_text())
    if len([p for p in patches if p.get('disabled') is False]) != 9:
        raise ValueError('Expected all nine products enabled')
    if (fresh / 'profiles/desktop/node_modules/qcu-market').exists():
        raise ValueError('Unexpected market')
    for root in [home, fresh]:
        if any(p.name in ['.pnpm', '.npm', 'pnpm-lock.yaml', '.npmrc'] for p in root.rglob('*')):
            raise ValueError('Unexpected package manager state')
    run('native-lark', [fresh / 'bin/lark-cli', '--version'])
    result = {'status': 'passed', 'target': 'mac-arm64', 'archive': {'path': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest(archive)},
              'extractedAppMatches': True, 'vendorUnchanged': not branded, 'vendorAsarUnchanged': True, 'customizedVendorFiles': changes, 'signatureChecks': 'passed', 'nativePrepare': 'passed',
              'repeatAfterRelocationPreservesConfig': True, 'unicodeSpacePath': True, 'imports': 9, 'skills': 7,
              'enabledProducts': 9, 'marketIncluded': False, 'guardedJavaScriptPrepareAndSmoke': True,
              'networkAttempts': 0, 'childProcessAttempts': 0, 'packageManagerState': False,
              'nativeLarkVersion': '1.0.84', 'nativeGui': 'pending-manual', 'modelCalls': 0, 'notarized': False,
              'testApp': str(app)}
    (args.out / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
