#!/usr/bin/env python3
"""Build a pinned rc4.1/rc4.2 Mac suite from frozen public inputs. No install or network."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import shutil
import stat
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(file):
    h = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def checked(pin):
    p = Path(pin['path'])
    if not p.is_absolute():
        p = ROOT / p
    for parent in [p, *p.parents]:
        if parent.is_symlink():
            raise ValueError('Linked build input refused')
    if not p.is_file() or p.stat().st_size != pin['bytes'] or digest(p) != pin['sha256']:
        raise ValueError('Pinned build input mismatch: ' + str(p))
    return p


def inventory(root):
    rows = []
    for p in sorted(Path(root).rglob('*')):
        s = p.lstat()
        row = {'path': p.relative_to(root).as_posix(), 'mode': stat.S_IMODE(s.st_mode)}
        if p.is_symlink():
            row.update(kind='link', link=os.readlink(p))
        elif p.is_dir():
            row.update(kind='directory')
        elif p.is_file():
            row.update(kind='file', bytes=s.st_size, sha256=digest(p))
        else:
            raise ValueError('Unsafe build entry')
        rows.append(row)
    return rows


def write_json(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def run(*args, env=None):
    subprocess.run([str(a) for a in args], check=True, env=env)


def build(config_file, out):
    config = json.loads(config_file.read_text())
    theme_version = {'0.1.0-rc.4.1': '0.2.3', '0.1.0-rc.4.2': '0.2.4'}.get(config['version'])
    if theme_version is None or config['target'] != 'mac-arm64':
        raise ValueError('Only pinned rc4.1/rc4.2 Mac releases are supported')
    def current_text(value):
        return value.replace('0.1.0-rc.4.1', config['version']).replace('rc4.1', config['version'].removeprefix('0.1.0-')).replace('0.2.3', theme_version)

    if config.get('packagePolicy') != {'autoInstallPeers': False, 'ignoreScripts': True, 'packageImportMethod': 'copy'}:
        raise ValueError('Unexpected twelve-source package policy')
    out = out.absolute()
    if out.exists():
        raise ValueError('Fresh output required')
    for p in [out, *out.parents]:
        if p.is_symlink():
            raise ValueError('Linked output refused')
    pins = {k: checked(v) for k, v in config.items() if isinstance(v, dict) and 'sha256' in v}
    sources = load_module('local_sources', ROOT / 'scripts/prepare-preinstalled-local-sources.py')
    frozen = json.loads(pins['legacyInputs'].read_text())
    theme = json.loads(pins['themeManifest'].read_text())
    products = []
    archives = {}
    for p in frozen['products']:
        # Check all nine original archives, including the superseded course1.2 input.
        file = pins['legacyInputs'].parent / 'archives' / p['file']
        checked({**p, 'path': str(file)})
        if p['id'] != 'qcu-course-workbench':
            products.append(p.copy())
            archives[p['id']] = file.read_bytes()
    for key, id in [('courseManifest', 'qcu-course-workbench'), ('marketManifest', 'qcu-market'), ('expertManifest', 'qcu-expert-teams')]:
        m = json.loads(pins[key].read_text())
        p = {k: m[k] for k in ('version', 'file', 'bytes', 'sha256')}
        p['id'] = id
        archives[id] = checked({**p, 'path': str(pins[key].parent / p['file'])}).read_bytes()
        products.append(p)
    if len(products) != 11:
        raise ValueError('Expected eleven teaching products')
    theme_files = {f['path']: checked({**f, 'path': str(pins['themeManifest'].parent / 'qcu-branding' / f['path'])}).read_bytes() for f in theme['files']}
    if theme['version'] != theme_version or len(theme_files) != 6:
        raise ValueError('Frozen six-file branding required')
    data = sources.branding_archive(theme_files)
    brand = {'id': 'qcu-branding', 'version': theme_version, 'bytes': len(data), 'sha256': sources.sha(data)}
    brand['file'] = 'qcu-branding-' + theme_version + '-local-build-' + brand['sha256'] + '.tgz'
    archives[brand['id']] = data
    managed = products + [brand]
    members = {p['id']: sources.archive_files(archives[p['id']]) for p in managed}
    for p in managed:
        sources.identity(members[p['id']], p['id'], p['version'])
    out.mkdir(parents=True)
    # All extraction and mutations below are confined to the fresh output.
    with tempfile.TemporaryDirectory(prefix='.base-', dir=out) as tmp:
        run('/usr/bin/ditto', '-x', '-k', pins['base'], tmp)
        original = Path(tmp) / pins['base'].stem
        app = out / 'QCU助手.app'
        (original / 'QCU助手.app').rename(app)
        for file in original.iterdir():
            if file.name == 'app-files.json':
                continue
            if file.is_dir():
                shutil.copytree(file, out / file.name, symlinks=True)
            else:
                shutil.copy2(file, out / file.name)
    kit = app / 'Contents/Resources'
    vendor = kit / 'program/DeepSeek Harness.app'
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', vendor)
    original_vendor = inventory(vendor)
    baseline = json.loads((kit / 'support/manifest.json').read_text())
    if baseline != json.loads(pins['legacyManifest'].read_text()):
        raise ValueError('Frozen rc3 seed manifest mismatch')
    original_rows = {r['path']: r for r in baseline['seedFiles']}
    for p in frozen['products']:
        if p['id'] == 'qcu-course-workbench':
            continue
        prefix = 'seed/profiles/desktop/node_modules/' + p['id'] + '/'
        expected = {name.removeprefix(prefix): row for name, row in original_rows.items() if name.startswith(prefix)}
        if set(expected) != set(members[p['id']]) or any(sources.sha(data) != expected[name]['sha256'] or len(data) != expected[name]['bytes'] for name, data in members[p['id']].items()):
            raise ValueError('Original teaching package bytes differ from frozen seed')
    write_json(kit / 'support/migration-baseline.json', baseline)
    profile = kit / 'seed/profiles/desktop'
    original_package = json.loads((profile / 'package.json').read_text())
    patches = json.loads((profile / 'cordis.patch.yml').read_text())
    shutil.rmtree(profile / 'node_modules')
    local_sources = []
    for p in managed:
        for name, content in members[p['id']].items():
            target = profile / 'node_modules' / p['id'] / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            target.chmod(0o644)
        target = profile / '.qcu-bundles' / p['file']
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(archives[p['id']])
        local_sources.append({**p, 'source': 'file:./.qcu-bundles/' + p['file'], 'status': 'deterministic-local-build-not-published' if p['id'] == 'qcu-branding' else 'frozen-local-input-not-production-published'})
        row = next((r for r in patches if r.get('id') == p['id']), None)
        if row is None:
            row = {'id': p['id']}
            patches.append(row)
        row['disabled'] = False
        if p['id'] == 'qcu-expert-teams':
            row['config'] = {'enabled': True}
    for id in ['ui-brand-official', 'ui-sidebar']:
        row = next((r for r in patches if r.get('id') == id), None)
        if row is None:
            row = {'id': id}
            patches.append(row)
        row['disabled'] = True
    original_package['dependencies'] = {p['id']: p['source'] for p in local_sources}
    original_package['dsh']['profile']['bundles'] = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] + [p['id'] for p in managed]
    write_json(profile / 'package.json', original_package)
    write_json(profile / 'cordis.patch.yml', patches)
    write_json(profile / 'pnpm-workspace.yaml', {'autoInstallPeers': False, 'ignoreScripts': True, 'packageImportMethod': 'copy'})
    for name in ['start.cjs', 'integrated.cjs']:
        shutil.copy2(ROOT / 'tools/teacher-suite' / name, kit / 'support' / name)
    shutil.copy2(ROOT / 'scripts/migrate-teacher-home.py', kit / 'support/migrate-teacher-home.py')
    updater = load_module('managed_updates', pins['managedUpdatesScript'])
    customization = updater.apply(vendor / 'Contents/Resources', 'mac-arm64')
    if customization['customAsarSha256'] != config['customAsarSha256']:
        raise ValueError('Frozen r4 ASAR mismatch')
    write_json(kit / 'support/managed-updates.json', customization)
    (out / 'patched-main.mjs').write_bytes(updater.member((vendor / 'Contents/Resources/app.asar').read_bytes(), 'lib/main.js'))
    # Isolate JS validation; OS signing tools retain their normal system environment.
    test_home = out / 'build-test-home'
    test_home.mkdir()
    for name in ['empty-user.npmrc', 'empty-global.npmrc']:
        (test_home / name).write_text('')
    test_env = {k: os.environ[k] for k in ['PATH', 'TMPDIR', 'LANG'] if k in os.environ}
    test_env.update(HOME=str(test_home), ELECTRON_RUN_AS_NODE='1',
                    QCU_TEACHER_TEST_HOME=str(test_home / 'teacher'),
                    XDG_CONFIG_HOME=str(test_home / 'config'),
                    npm_config_userconfig=str(test_home / 'empty-user.npmrc'),
                    npm_config_globalconfig=str(test_home / 'empty-global.npmrc'))
    run(pins['trustedRuntime'], ROOT / 'tools/teacher-branding/verify-managed-updates.cjs', out / 'patched-main.mjs', env=test_env)
    seed = [{'path': 'seed/' + r['path'], 'bytes': r['bytes'], 'sha256': r['sha256'], 'mode': r['mode']} for r in inventory(kit / 'seed') if r['kind'] == 'file']
    release = {**baseline, 'version': config['version'], 'products': products, 'branding': {'id': 'qcu-branding', 'version': theme_version}, 'localSources': local_sources, 'seedFiles': seed, 'seedId': sources.sha(json.dumps(seed, ensure_ascii=False, separators=(',', ':')).encode()), 'marketIncluded': True, 'modelConfigured': False, 'managedUpdates': True, 'migrationBaselineSha256': digest(kit / 'support/migration-baseline.json')}
    release.pop('migrateFrom', None)
    write_json(kit / 'support/manifest.json', release)
    write_json(kit / 'support/integrated-inputs.json', config)
    infofile = app / 'Contents/Info.plist'
    info = plistlib.loads(infofile.read_bytes())
    info.update(CFBundleVersion=config['version'].removeprefix('0.1.0-rc.'), CFBundleShortVersionString='0.1.0',
                CFBundleIdentifier='cn.qcu.assistant.teacher.' + config['version'].removeprefix('0.1.0-').replace('.', '-') + '.b' + release['seedId'][:12],
                QCUReleaseVersion=config['version'])
    infofile.write_bytes(plistlib.dumps(info))
    # Save the base executable only in this disposable build for a signature-stripped comparison.
    binary = vendor / 'Contents/MacOS/DeepSeek Harness'
    with tempfile.TemporaryDirectory(prefix='.signature-', dir=out) as tmp:
        before = Path(tmp) / 'before'
        shutil.copy2(binary, before)
        run('/usr/bin/codesign', '--force', '--sign', '-', '--preserve-metadata=entitlements', vendor)
        after = Path(tmp) / 'after'
        shutil.copy2(binary, after)
        for file in [before, after]:
            run('/usr/bin/codesign', '--remove-signature', file)
        if digest(before) != digest(after):
            raise ValueError('Vendor executable changed beyond signing metadata')
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', vendor)
    launcher = app / 'Contents/MacOS' / info['CFBundleExecutable']
    with tempfile.TemporaryDirectory(prefix='.launcher-signature-', dir=out) as tmp:
        before, after = (Path(tmp) / name for name in ['before', 'after'])
        shutil.copy2(launcher, before)
        run('/usr/bin/codesign', '--force', '--sign', '-', app)
        shutil.copy2(launcher, after)
        for file in [before, after]:
            run('/usr/bin/codesign', '--remove-signature', file)
        if digest(before) != digest(after):
            raise ValueError('Base native launcher changed beyond signing metadata')
        launcher_digest = digest(after)
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', app)
    final_vendor = inventory(vendor)
    old, new = ({r['path']: r for r in rows} for rows in [original_vendor, final_vendor])
    differences = [p for p in sorted(old.keys() | new.keys()) if old.get(p) != new.get(p)]
    allowed = {'Contents/Resources/app.asar', 'Contents/MacOS/DeepSeek Harness', 'Contents/_CodeSignature/CodeResources'}
    if set(differences) - allowed:
        raise ValueError('Unexpected vendor customization: ' + str(differences))
    write_json(out / 'vendor-proof.json', {'source': config['base'], 'modifiedFiles': differences, 'signatureStrippedExecutableUnchanged': True, 'allOtherBytesModesAndLinksUnchanged': True, 'original': original_vendor, 'candidate': final_vendor, 'customization': customization})
    write_json(out / 'manifest.json', release)
    write_json(out / 'app-files.json', inventory(app))
    (out / 'README.txt').write_text(current_text('QCU助手 Mac 教师套件 0.1.0-rc.4.1 · Apple Silicon / macOS 13+\n\n解压后双击 QCU助手.app，可把整个 APP 移至应用程序。无需终端操作。\n十一项教学能力及清蓝主题已预装。点击“插件市场”或“专家团”只打开页面；生成任务与模型费用须另行确认。\n新数据目录：~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4.1/\n不会自动导入旧版的配置、Key 或工作文件；如需迁移，请联系维护人员。首次由本人配置自己的 API Key 和飞书授权；模型服务可能产生费用。\n此候选为本地临时签名，未经 Developer ID 签名或公证；本次完整包的验证范围见交付记录；真实模型与教师试用仍须独立验收。\n请打开同目录的 QCU助手使用指南.html，按 Mac rc4.1 指南操作。Windows rc4.1 尚未发布。\n'))
    # Ship the actual current guide under its established entry filename.
    shutil.copy2(ROOT / 'tools/teacher-guide/QCU助手使用指南.html', out / 'QCU助手使用指南.html')
    write_json(out / 'guide-package.json', {'schemaVersion': 1, 'runtimeVersion': config['version'], 'target': 'mac-arm64', 'themeVersion': theme_version, 'guide': {'file': 'QCU助手使用指南.html', 'sha256': digest(out / 'QCU助手使用指南.html'), 'updatedAt': '2026-10-26'}, 'baseArchive': config['base'], 'applicationChanged': True, 'personalDataIncluded': False, 'dataHomeChanged': True, 'automaticMigration': False, 'windowsRc4Released': False})
    if (out / '先读我.txt').exists():
        (out / '先读我.txt').rename(out / '原版rc3说明.txt')
    shutil.copy2(out / 'README.txt', out / '先读我.txt')
    (out / '开始使用.html').write_text(current_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>QCU助手 · 开始使用</title><style>body{font:20px/1.8 system-ui;max-width:780px;margin:64px auto;padding:24px;color:#16334a}h1{color:#16688d}</style><h1>QCU助手 · 教师套件</h1><p>解压后双击 <b>QCU助手.app</b>。可移动整个 APP，无需使用终端。</p><p>七项教学技能、飞书只读、课程设计工作台、插件市场与专家团已预装。侧栏按钮只打开对应页面；模型生成须另行确认。</p><p>本版数据目录：~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4.1/。不会自动导入旧版配置、密钥或工作文件。旧数据迁移请联系维护人员；首次由本人配置自己的 API Key 和飞书授权，模型服务可能产生费用。</p><p>本地验收候选，验证范围见交付记录；模型与教师试用须独立验收。<a href="QCU助手使用指南.html">打开 Mac rc4.1 完整使用指南</a>。Windows rc4.1 尚未发布。</p></html>'))
    archive = out / ('QCU-Teacher-' + config['version'] + '-mac-arm64.zip')
    # The archive lives inside rc4.1; stage its payload elsewhere so it cannot contain itself.
    with tempfile.TemporaryDirectory(prefix='.zip-', dir=out.parent) as tmp:
        staged = Path(tmp) / archive.stem
        staged.mkdir()
        for p in out.iterdir():
            if p.name == 'patched-main.mjs':
                continue
            if p.is_dir():
                run('/usr/bin/ditto', p, staged / p.name)
            else:
                shutil.copy2(p, staged / p.name)
        run('/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', staged, archive)
    result = {'version': release['version'], 'products': 11, 'directDependencies': 12, 'seedId': release['seedId'], 'outerBundleIdentifier': info['CFBundleIdentifier'], 'releaseLabel': info['QCUReleaseVersion'], 'nativeLauncherReusedSignatureStrippedSha256': launcher_digest, 'archive': {'path': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest(archive)}, 'adHocSignatures': True, 'notarized': False, 'vendorSignatureIntact': False, 'guiAccepted': False}
    write_json(out / 'BUILD.json', result)
    (out / 'SHA256SUMS').write_text(result['archive']['sha256'] + '  ' + archive.name + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / 'release/integrated-teacher-macos.json')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.config, args.out), ensure_ascii=False))
