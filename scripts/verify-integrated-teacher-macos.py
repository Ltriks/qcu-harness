#!/usr/bin/env python3
"""Verify the actual pinned Mac ZIP, permissions/links/signatures and cold native bootstrap."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import stat
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('integrated_builder', ROOT / 'scripts/build-integrated-teacher-macos.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def verify_zip_inventory(archive, expected):
    """Check exact names, hashes, modes and link bytes before ditto can extract anything."""
    rows, seen, root_seen = {r['path']: r for r in expected}, set(), False
    prefix = archive.stem + '/'
    with zipfile.ZipFile(archive) as z:
        for member in z.infolist():
            name = member.filename
            # ditto may store UTF-8 filename bytes without the ZIP UTF-8 flag.
            if not member.flag_bits & 0x800:
                try:
                    name = name.encode('cp437').decode('utf8')
                except (UnicodeError, UnicodeEncodeError):
                    pass
            if name == prefix:
                if root_seen or not member.is_dir() or member.file_size:
                    raise ValueError('Invalid/duplicate ZIP root')
                root_seen = True
                continue
            if not name.startswith(prefix):
                raise ValueError('ZIP member leaves payload root')
            relative = builder.PINNING.SOURCES.safe_path(name[len(prefix):].rstrip('/'))
            if relative in seen or relative not in rows or member.flag_bits & 1:
                raise ValueError('Unexpected/duplicate/encrypted ZIP member')
            seen.add(relative)
            row, mode = rows[relative], member.external_attr >> 16
            if not any(check(mode) for check in (stat.S_ISREG, stat.S_ISLNK, stat.S_ISDIR)):
                raise ValueError('Unsafe ZIP member type')
            kind = 'link' if stat.S_ISLNK(mode) else 'directory' if member.is_dir() else 'file'
            if kind != row['kind'] or stat.S_IMODE(mode) != row['mode']:
                raise ValueError('ZIP member type/mode mismatch')
            if kind == 'link':
                if member.file_size > 4096 or z.read(member).decode() != row['link']:
                    raise ValueError('ZIP link target mismatch')
            elif kind == 'file':
                if member.file_size != row['bytes']:
                    raise ValueError('ZIP member size mismatch')
                digest = hashlib.sha256()
                with z.open(member) as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        digest.update(block)
                if digest.hexdigest() != row['sha256']:
                    raise ValueError('ZIP member hash mismatch')
    if seen != set(rows) or not root_seen:
        raise ValueError('ZIP member inventory mismatch')


def native_preparation_probe(current_app, out, name, env):
    stdout_file, stderr_file = (out / (name + suffix) for suffix in ('.stdout.log', '.stderr.log'))
    def row(status, **details):
        return {'name': name, 'status': status, 'stdoutLog': stdout_file.name, 'stderrLog': stderr_file.name,
                'stdoutBytes': stdout_file.stat().st_size, 'stderrBytes': stderr_file.stat().st_size, **details}
    try:
        with stdout_file.open('w') as stdout, stderr_file.open('w') as stderr:
            result = subprocess.run([str(current_app / 'Contents/MacOS/城院助手'), '--prepare-only'],
                                    stdout=stdout, stderr=stderr, env=env, timeout=30)
        token = '"result":"prepared"' if name == 'native-first' else 'already-prepared'
        passed = result.returncode == 0 and token in stdout_file.read_text()
        return row('passed' if passed else 'failed', exitCode=result.returncode)
    except subprocess.TimeoutExpired:
        return row('timeout', timeoutSeconds=30)
    except OSError as error:
        return row('failed-to-execute', errno=error.errno)


def verify(archive, out, validation_runtime=None, proofs=None, native_prepare=False):
    archive, out = archive.absolute(), out.absolute()
    proofs = Path(proofs).absolute() if proofs else archive.parent
    input_file = proofs / 'input-pins.json'
    config = json.loads(input_file.read_text())
    prepared = builder.prepare_inputs(config)
    build = json.loads((proofs / 'BUILD.json').read_text())
    if archive.stat().st_size != build['archive']['bytes'] or builder.digest(archive) != build['archive']['sha256']:
        raise ValueError('Immutable build ZIP pin mismatch')
    verify_zip_inventory(archive, json.loads((proofs / 'payload-files.json').read_text()))
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
    if sorted(p.name for p in package.iterdir()) != sorted(builder.SHIP_FILES):
        raise ValueError('Unexpected public payload files')
    if builder.inventory(package) != json.loads((proofs / 'payload-files.json').read_text()):
        raise ValueError('Actual ZIP payload bytes/modes/links mismatch')
    app = package / 'QCU助手.app'
    expected = json.loads((proofs / 'app-files.json').read_text())
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
    proof = json.loads((proofs / 'vendor-proof.json').read_text())
    if builder.inventory(vendor) != proof['candidate'] or not proof['allOtherBytesModesAndLinksUnchanged']:
        raise ValueError('Vendor proof mismatch')
    m = json.loads((kit / 'support/manifest.json').read_text())
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    theme_version = builder.PINNING.theme_version(config)
    bundle_id = 'cn.qcu.assistant.teacher.' + m['version'].removeprefix('0.1.0-').replace('.', '-') + '.b' + m['seedId'][:12]
    if (m['version'] != config['version'] or info.get('CFBundleIdentifier') != bundle_id
            or info.get('QCUReleaseVersion') != m['version'] or info.get('CFBundleVersion') != m['version'].removeprefix('0.1.0-rc.')
            or info.get('CFBundleDisplayName') != 'QCU助手'):
        raise ValueError('Distinct outer release identity mismatch')
    guide = json.loads((package / 'guide-package.json').read_text())
    if guide['guide']['file'] != 'QCU助手使用指南.html' or guide['runtimeVersion'] != m['version'] or guide['themeVersion'] != theme_version or builder.digest(package / guide['guide']['file']) != guide['guide']['sha256'] or (package / guide['guide']['file']).read_bytes() != builder.guide_bytes(m['version'], theme_version):
        raise ValueError('Current guide identity mismatch')
    for name in ['README.txt', '先读我.txt', '开始使用.html']:
        text = (package / name).read_text()
        if not all(token in text for token in [m['version'], 'teacher/' + m['version'] + '/', '不会自动导入', '预装', '自己的 API Key', '费用']):
            raise ValueError('Current startup documentation incomplete: ' + name)
    policy = json.loads((kit / 'seed/profiles/desktop/pnpm-workspace.yaml').read_text())
    if policy != {'autoInstallPeers': False, 'ignoreScripts': True, 'packageImportMethod': 'copy'}:
        raise ValueError('Unexpected twelve-source pnpm policy')
    if m['branding']['version'] != theme_version or len(m['localSources']) != 12 or 'migrateFrom' in m:
        raise ValueError('Unexpected dependency/migration policy')
    if json.loads((package / 'composition.json').read_text()) != builder.composition(m):
        raise ValueError('App/component/candidate composition mismatch')
    expected_sources = [{k: p[k] for k in ('id', 'version', 'file', 'bytes', 'sha256')} for p in prepared[5]]
    if [{k: p[k] for k in ('id', 'version', 'file', 'bytes', 'sha256')} for p in m['localSources']] != expected_sources:
        raise ValueError('Shipped component pins differ from reviewed composition')
    home = out / '合成 教师 数据'
    env = {k: os.environ[k] for k in ['PATH', 'TMPDIR', 'LANG'] if k in os.environ}
    sandbox_home = out / 'interpreter-home'
    sandbox_home.mkdir()
    env['HOME'] = str(sandbox_home)
    env['QCU_TEACHER_TEST_HOME'] = str(home)
    guard = out / 'guard.cjs'
    guard.write_text("require(process.env.QCU_OFFLINE_GUARD);\n"
                     "const fs=require('node:fs');const deny=()=>{fs.appendFileSync(process.env.QCU_OFFLINE_TEST_LOG,JSON.stringify({event:'child-process-blocked'})+'\\n');throw Error('Child processes disabled for cold proof')};for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('node:child_process')[k]=deny;\n")
    env['QCU_OFFLINE_GUARD'] = str(kit / 'support/deny-network.cjs')
    env['QCU_OFFLINE_TEST_LOG'] = str(out / 'preparation-guard.jsonl')
    reference = builder.checked(config['trustedRuntime'])
    if validation_runtime and validation_runtime.absolute() != reference:
        raise ValueError('Only the exact trusted reference interpreter is admitted')
    executable = validation_runtime or reference
    env['ELECTRON_RUN_AS_NODE'] = '1'
    if validation_runtime:
        env['QCU_INTEGRATED_SDK_ONLY'] = '1'
    native_results = {'status': 'untested', 'probes': []}
    def native_probe(name, current_app):
        native_env = {**env, 'QCU_TEACHER_TEST_HOME': str(out / 'native-disposable-profile')}
        # Native OS refusal is independent evidence. Never relax OS policy or retry a failed probe.
        row = native_preparation_probe(current_app, out, name, native_env)
        native_results['probes'].append(row)
        native_results['status'] = 'passed' if all(r['status'] == 'passed' for r in native_results['probes']) else 'failed'
        builder.write_json(out / 'native-prepare.json', native_results)
        return row['status'] == 'passed'
    native_ok = native_probe('native-first', app) if native_prepare else False
    if native_ok:
        native_ok = native_probe('native-repeat', app)
    def preparation(app):
        resources = app / 'Contents/Resources'
        return [executable, '--expose-internals', '--require', guard, resources / 'support/start.cjs', 'prepare', '--kit', resources]
    first = run('prepare-first', preparation(app), env)
    if '"result":"prepared"' not in first:
        raise ValueError('First guarded JavaScript preparation not confirmed')
    patch = home / 'profiles/desktop/cordis.patch.yml'
    rows = json.loads(patch.read_text())
    rows.append({'id': 'synthetic-personal-setting', 'config': {'fixture': 'keep-local'}})
    patch.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    before = patch.read_bytes()
    sentinel = home / 'workspace/保留我的备课.txt'
    sentinel.write_text('Synthetic anonymous sentinel only')
    if 'already-prepared' not in run('prepare-repeat', preparation(app), env):
        raise ValueError('Repeat guarded JavaScript preparation failed')
    moved = out / '移动 应用 中文 空格'
    package.rename(moved)
    app = moved / 'QCU助手.app'
    kit = app / 'Contents/Resources'
    env['QCU_OFFLINE_GUARD'] = str(kit / 'support/deny-network.cjs')
    if native_ok:
        native_probe('native-moved-repeat', app)
    if 'already-prepared' not in run('prepare-moved-repeat', preparation(app), env) or patch.read_bytes() != before or not sentinel.exists():
        raise ValueError('Moved app did not preserve synthetic settings/work')
    # Guard cold JavaScript bootstrap and actual ASAR module loading; deny subprocesses too.
    probe_env = {**env, 'QCU_OFFLINE_TEST_LOG': str(out / 'guard-self-test.jsonl')}
    run('guard-self-test', [executable, '--require', guard, '-e', "const a=require('node:assert/strict');a.throws(()=>require('node:http').get('http://127.0.0.1:1'),/network access denied/);a.throws(()=>require('node:child_process').spawnSync('/usr/bin/true'),/Child processes disabled/);console.log('both guards refused before effects')"], probe_env)
    probe_events = [json.loads(line)['event'] for line in (out / 'guard-self-test.jsonl').read_text().splitlines()]
    if probe_events != ['guard-installed', 'blocked', 'child-process-blocked']:
        raise ValueError('Guard denial self-test failed')
    env.update(ELECTRON_RUN_AS_NODE='1', QCU_OFFLINE_TEST_LOG=str(out / 'guard.jsonl'), QCU_INTEGRATED_INPUTS=str(input_file))
    fresh = out / '断网 首次 数据'
    guarded = {**env, 'QCU_TEACHER_TEST_HOME': str(fresh)}
    run('guarded-first', [executable, '--expose-internals', '--require', guard, kit / 'support/start.cjs', 'prepare', '--kit', kit], guarded)
    output = run('actual-zip-cold', [executable, '--expose-internals', '--require', guard, ROOT / 'tests/support/integrated-cold.cjs', kit, fresh], guarded)
    cold = json.loads(next(line.split(':', 1)[1] for line in output.splitlines() if line.startswith('INTEGRATED_COLD:')))
    output = run('actual-client-ssr', [executable, '--expose-internals', '--require', guard, ROOT / 'tests/support/integrated-client.cjs', kit, fresh, config['officialSdk'], out], guarded)
    client = json.loads(next(line.split(':', 1)[1] for line in output.splitlines() if line.startswith('INTEGRATED_CLIENT:')))
    updater = builder.load_module('verify_updater', ROOT / 'tools/teacher-branding/managed-updates.py')
    patched = out / 'actual-zip-main.mjs'
    patched.write_bytes(updater.member((kit / 'program/DeepSeek Harness.app/Contents/Resources/app.asar').read_bytes(), 'lib/main.js'))
    run('actual-managed-updates', [executable, '--require', guard, ROOT / 'tools/teacher-branding/verify-managed-updates.cjs', patched], guarded)
    events = [json.loads(line) for line in (out / 'guard.jsonl').read_text().splitlines()]
    if len(cold['imports']) != 12 or not cold['networkGuard'] or any(e['event'] != 'guard-installed' for e in events):
        raise ValueError('Guarded offline resolution failed')
    preparation_events = [json.loads(line)['event'] for line in (out / 'preparation-guard.jsonl').read_text().splitlines()]
    if preparation_events != ['guard-installed'] * 3:
        raise ValueError('First/repeat/move guards reported an attempt')
    if any(p.name in ['.pnpm', '.npm', 'pnpm-lock.yaml', '.npmrc'] for p in fresh.rglob('*')):
        raise ValueError('Unexpected package manager invocation in first preparation')
    # Native CLI execution is part of native acceptance when OS quarantine blocks this copy.
    if native_results['status'] == 'passed':
        run('native-cli', [fresh / 'bin/lark-cli', '--version'])
        if '1.0.84' not in (out / 'native-cli.log').read_text():
            raise ValueError('Native CLI baseline mismatch')
    result = {'status': 'passed' if native_results['status'] == 'passed' and not validation_runtime else 'passed-with-native-execution-pending', 'archive': {'path': str(archive), 'bytes': archive.stat().st_size, 'sha256': builder.digest(archive)}, 'actualZipInventoryFilesPermissionsLinksMatch': True, 'inventoryEntries': len(expected), 'linkCount': sum(r['kind'] == 'link' for r in expected), 'adHocInnerOuterSignaturesVerified': True, 'vendorSignatureIntact': False, 'vendorUnchangedOutsideFrozenExceptionsAndSigning': True, 'nativeFirstRepeatMoved': native_results, 'javascriptFirstRepeatMoved': True, 'validationRuntime': str(executable), 'validationRuntimeSha256': builder.digest(executable), 'syntheticSettingsSentinelPreserved': True, 'defaultHomeVersion': m['version'], 'networkAttempts': 0, 'childProcessAttempts': 0, 'bootstrapPackageManagerCalls': 0, 'cold': cold, 'cliVersion': '1.0.84' if native_results['status'] == 'passed' else 'untested', 'testApp': str(app), 'testHome': str(home), 'freshHome': str(fresh), 'guiAccepted': False, 'modelCalls': 0}
    result['client'] = client
    result['outerIdentity'] = {k: info[k] for k in ['CFBundleIdentifier', 'CFBundleVersion', 'CFBundleDisplayName', 'QCUReleaseVersion']}
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
    parser.add_argument('--proofs', type=Path, help='builder output with non-shipping input pins and inventories')
    parser.add_argument('--native-prepare', action='store_true', help='bounded prepare-only probe; failure is recorded independently')
    args = parser.parse_args()
    verify(args.archive, args.out, args.validation_runtime, args.proofs, args.native_prepare)
