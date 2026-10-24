#!/usr/bin/env python3
"""Verify the actual rc4 ZIP, permissions/links/signatures and cold native bootstrap."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('integrated_builder', ROOT / 'scripts/build-integrated-teacher-macos.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def verify(archive, out, validation_runtime=None):
    archive, out = archive.absolute(), out.absolute()
    out.mkdir(parents=True, exist_ok=False)

    def run(name, command, env=None):
        logfile = out / (name + '.log')
        with logfile.open('w') as stream:
            p = subprocess.run([str(v) for v in command], stdout=stream, stderr=subprocess.STDOUT, text=True, env=env, timeout=60)
        if p.returncode:
            raise ValueError(name + ' failed; see isolated log')
        return logfile.read_text()

    extracted = out / '解压 中文 空格'
    run('extract', ['/usr/bin/ditto', '-x', '-k', archive, extracted])
    package = extracted / archive.stem
    app = package / 'QCU助手.app'
    expected = json.loads((package / 'app-files.json').read_text())
    if builder.inventory(app) != expected:
        raise ValueError('Actual ZIP file/permission/link inventory mismatch')
    kit = app / 'Contents/Resources'
    vendor = kit / 'program/DeepSeek Harness.app'
    run('outer-signature', ['/usr/bin/codesign', '--verify', '--deep', '--strict', app])
    run('inner-signature', ['/usr/bin/codesign', '--verify', '--deep', '--strict', vendor])
    for name, file in [('outer', app), ('inner', vendor)]:
        run(name + '-signature-kind', ['/usr/bin/codesign', '-d', '--verbose=4', file])
        if 'Signature=adhoc' not in (out / (name + '-signature-kind.log')).read_text():
            raise ValueError('Expected explicit ad-hoc signature')
    proof = json.loads((package / 'vendor-proof.json').read_text())
    if builder.inventory(vendor) != proof['candidate'] or not proof['allOtherBytesModesAndLinksUnchanged']:
        raise ValueError('Vendor proof mismatch')
    m = json.loads((kit / 'support/manifest.json').read_text())
    guide = json.loads((package / 'guide-package.json').read_text())
    if guide['runtimeVersion'] != '0.1.0-rc.4' or guide['themeVersion'] != '0.2.2' or builder.digest(package / guide['guide']['file']) != guide['guide']['sha256'] or (package / guide['guide']['file']).read_bytes() != (ROOT / 'tools/teacher-guide/QCU助手使用指南.html').read_bytes():
        raise ValueError('Current guide identity mismatch')
    policy = json.loads((kit / 'seed/profiles/desktop/pnpm-workspace.yaml').read_text())
    if policy != {'autoInstallPeers': False, 'ignoreScripts': True, 'packageImportMethod': 'copy'}:
        raise ValueError('Unexpected twelve-source pnpm policy')
    if m['branding']['version'] != '0.2.2' or len(m['localSources']) != 12 or 'migrateFrom' in m:
        raise ValueError('Unexpected dependency/migration policy')
    home = out / '合成 教师 数据'
    env = {k: os.environ[k] for k in ['PATH', 'TMPDIR', 'LANG'] if k in os.environ}
    sandbox_home = out / 'interpreter-home'
    sandbox_home.mkdir()
    env['HOME'] = str(sandbox_home)
    env['QCU_TEACHER_TEST_HOME'] = str(home)
    native = app / 'Contents/MacOS/城院助手'
    if validation_runtime:
        pin = json.loads((kit / 'support/integrated-inputs.json').read_text())['trustedRuntime']
        if validation_runtime.absolute() != builder.checked(pin):
            raise ValueError('Only the exact trusted reference interpreter is admitted')
        env['ELECTRON_RUN_AS_NODE'] = '1'
        env['QCU_INTEGRATED_SDK_ONLY'] = '1'
    def preparation(app):
        resources = app / 'Contents/Resources'
        return [validation_runtime, '--expose-internals', resources / 'support/start.cjs', 'prepare', '--kit', resources] if validation_runtime else [app / 'Contents/MacOS/城院助手', '--prepare-only']
    first = run('prepare-first', preparation(app), env)
    if '"result":"prepared"' not in first:
        raise ValueError('First native preparation not confirmed')
    patch = home / 'profiles/desktop/cordis.patch.yml'
    rows = json.loads(patch.read_text())
    rows.append({'id': 'synthetic-personal-setting', 'config': {'fixture': 'keep-local'}})
    patch.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    before = patch.read_bytes()
    sentinel = home / 'workspace/保留我的备课.txt'
    sentinel.write_text('Synthetic anonymous sentinel only')
    if 'already-prepared' not in run('prepare-repeat', preparation(app), env):
        raise ValueError('Repeat native preparation failed')
    moved = out / '移动 应用 中文 空格'
    package.rename(moved)
    app = moved / 'QCU助手.app'
    kit = app / 'Contents/Resources'
    native = app / 'Contents/MacOS/城院助手'
    if 'already-prepared' not in run('prepare-moved-repeat', preparation(app), env) or patch.read_bytes() != before or not sentinel.exists():
        raise ValueError('Moved app did not preserve synthetic settings/work')
    executable = validation_runtime or kit / 'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
    # Guard cold JavaScript bootstrap and actual ASAR module loading; deny subprocesses too.
    guard = out / 'guard.cjs'
    guard.write_text('require(' + json.dumps(str(kit / 'support/deny-network.cjs')) + ');\n'
                     "const fs=require('node:fs');const deny=()=>{fs.appendFileSync(process.env.QCU_OFFLINE_TEST_LOG,JSON.stringify({event:'child-process-blocked'})+'\\n');throw Error('Child processes disabled for cold proof')};for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('node:child_process')[k]=deny;\n")
    probe_env = {**env, 'QCU_OFFLINE_TEST_LOG': str(out / 'guard-self-test.jsonl')}
    run('guard-self-test', [executable, '--require', guard, '-e', "const a=require('node:assert/strict');a.throws(()=>require('node:http').get('http://127.0.0.1:1'),/network access denied/);a.throws(()=>require('node:child_process').spawnSync('/usr/bin/true'),/Child processes disabled/);console.log('both guards refused before effects')"], probe_env)
    probe_events = [json.loads(line)['event'] for line in (out / 'guard-self-test.jsonl').read_text().splitlines()]
    if probe_events != ['guard-installed', 'blocked', 'child-process-blocked']:
        raise ValueError('Guard denial self-test failed')
    env.update(ELECTRON_RUN_AS_NODE='1', QCU_OFFLINE_TEST_LOG=str(out / 'guard.jsonl'))
    fresh = out / '断网 首次 数据'
    guarded = {**env, 'QCU_TEACHER_TEST_HOME': str(fresh)}
    run('guarded-first', [executable, '--expose-internals', '--require', guard, kit / 'support/start.cjs', 'prepare', '--kit', kit], guarded)
    output = run('actual-zip-cold', [executable, '--expose-internals', '--require', guard, ROOT / 'tests/support/integrated-cold.cjs', kit, fresh], guarded)
    cold = json.loads(next(line.split(':', 1)[1] for line in output.splitlines() if line.startswith('INTEGRATED_COLD:')))
    config = json.loads((kit / 'support/integrated-inputs.json').read_text())
    output = run('actual-client-ssr', [executable, '--expose-internals', '--require', guard, ROOT / 'tests/support/integrated-client.cjs', kit, fresh, config['officialSdk'], out], guarded)
    client = json.loads(next(line.split(':', 1)[1] for line in output.splitlines() if line.startswith('INTEGRATED_CLIENT:')))
    updater = builder.load_module('verify_updater', ROOT / 'tools/teacher-branding/managed-updates.py')
    patched = out / 'actual-zip-main.mjs'
    patched.write_bytes(updater.member((kit / 'program/DeepSeek Harness.app/Contents/Resources/app.asar').read_bytes(), 'lib/main.js'))
    run('actual-managed-updates', [executable, '--require', guard, ROOT / 'tools/teacher-branding/verify-managed-updates.cjs', patched], guarded)
    events = [json.loads(line) for line in (out / 'guard.jsonl').read_text().splitlines()]
    if len(cold['imports']) != 12 or not cold['networkGuard'] or any(e['event'] != 'guard-installed' for e in events):
        raise ValueError('Guarded offline resolution failed')
    if any(p.name in ['.pnpm', '.npm', 'pnpm-lock.yaml', '.npmrc'] for p in fresh.rglob('*')):
        raise ValueError('Unexpected package manager invocation in first preparation')
    # Native CLI execution is part of native acceptance when OS quarantine blocks this copy.
    if not validation_runtime:
        run('native-cli', [fresh / 'bin/lark-cli', '--version'])
        if '1.0.84' not in (out / 'native-cli.log').read_text():
            raise ValueError('Native CLI baseline mismatch')
    result = {'status': 'passed-with-native-execution-pending' if validation_runtime else 'passed', 'archive': {'path': str(archive), 'bytes': archive.stat().st_size, 'sha256': builder.digest(archive)}, 'actualZipInventoryFilesPermissionsLinksMatch': True, 'inventoryEntries': len(expected), 'linkCount': sum(r['kind'] == 'link' for r in expected), 'adHocInnerOuterSignaturesVerified': True, 'vendorSignatureIntact': False, 'vendorUnchangedOutsideFrozenExceptionsAndSigning': True, 'nativeFirstRepeatMoved': 'pending-OS-local-execution-approval' if validation_runtime else True, 'javascriptFirstRepeatMoved': True, 'validationRuntime': str(executable), 'validationRuntimeSha256': builder.digest(executable), 'syntheticSettingsSentinelPreserved': True, 'defaultHomeVersion': '0.1.0-rc.4', 'networkAttempts': 0, 'childProcessAttempts': 0, 'bootstrapPackageManagerCalls': 0, 'cold': cold, 'cliVersion': '1.0.84-byte-identical-base' if validation_runtime else '1.0.84', 'testApp': str(app), 'testHome': str(home), 'freshHome': str(fresh), 'guiAccepted': False, 'modelCalls': 0}
    result['client'] = client
    result['guardDenialSelfTest'] = {'networkBlocked': True, 'childProcessBlocked': True, 'effectsExecuted': 0}
    result['guideCurrentIdentityAndHashVerified'] = True
    result['actualZipManagedUpdateDynamicChecks'] = True
    builder.write_json(out / 'RESULT.json', result)
    print(json.dumps(result, ensure_ascii=False))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--validation-runtime', type=Path)
    args = parser.parse_args()
    verify(args.archive, args.out, args.validation_runtime)
