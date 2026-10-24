#!/usr/bin/env python3
# coding: utf-8
"""Assemble fixed, self-contained platform kits from already acquired inputs."""
import argparse
import hashlib
import html
import json
import shutil
import tarfile
import zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
LARK = {
    'mac-arm64': ('lark-cli-1.0.84-darwin-arm64.tar.gz', 'bc56a15fce5b6fdb065702ac03ef4d051bc71ea511b75f316461008e4a359ba5', 'lark-cli'),
    'win-x64': ('lark-cli-1.0.84-windows-amd64.zip', '458e1fe338c3150f2d9ae0cf5781d59f8dc6e416e63f8d4668cb76de1ae6ec75', 'lark-cli.exe'),
}
WORKBUDDY = '168507c26cc841689f3685bf766323b17b5271fbd8fa9a81bafe7f317815882a'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()


def checked(path, expected, size=None):
    if path.is_symlink() or not path.is_file() or (size is not None and path.stat().st_size != size) or digest(path) != expected:
        raise ValueError('Input integrity failed: ' + path.name)
    return path


def copy(source, target, executable=False):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    target.chmod(0o755 if executable else 0o644)


def bundle_metadata(file, record):
    with tarfile.open(file) as t:
        for m in t.getmembers():
            if not m.isfile() or not m.name.startswith('package/') or '..' in Path(m.name).parts or m.size > 2_000_000:
                raise ValueError('Unexpected archive member: ' + file.name)
        pkg = json.load(t.extractfile('package/package.json'))
        if pkg['name'] != record['id'] or pkg['version'] != record['version']:
            raise ValueError('Product mismatch')
        if pkg.get('dependencies') or pkg.get('optionalDependencies') or pkg.get('scripts'):
            raise ValueError('Extra runtime dependencies need a reviewed offline closure')
        patch = json.load(t.extractfile('package/' + pkg['dsh']['bundle']['patch'].removeprefix('./')))
        rows = [row for entry in patch for row in entry.get('insert', [])]
        if len(rows) != 1 or rows[0]['id'] != record['componentId']:
            raise ValueError('Component identity mismatch')
        notices = {name: t.extractfile('package/' + name).read()
                   for name in ['LICENSE', 'NOTICE'] if 'package/' + name in t.getnames()}
        if 'LICENSE' not in notices:
            raise ValueError('Missing product license')
        return notices


def lark_binary(file, target):
    wanted = LARK[target][2]
    if target == 'mac-arm64':
        with tarfile.open(file) as t:
            members = [m for m in t.getmembers() if m.isfile() and Path(m.name).name == wanted]
            if len(members) != 1 or members[0].size > 100_000_000:
                raise ValueError('Unexpected Lark binary')
            return t.extractfile(members[0]).read()
    with zipfile.ZipFile(file) as z:
        members = [m for m in z.infolist() if not m.is_dir() and Path(m.filename).name == wanted]
        if len(members) != 1 or members[0].file_size > 100_000_000:
            raise ValueError('Unexpected Lark binary')
        return z.read(members[0])


def page(manifest):
    extension = 'command' if manifest['target'] == 'mac-arm64' else 'cmd'
    client = html.escape(manifest['client']['path'])
    products = ''.join('<tr><td>' + html.escape(p['id']) + '</td><td>' + html.escape(p['version']) + '</td></tr>' for p in manifest['products'])
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>城院 DSH 离线套件</title><style>body{margin:0;background:#edf3f8;color:#17304c;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif}main{max-width:900px;margin:45px auto;padding:0 24px 50px}h1{font-size:30px;margin-bottom:8px}h2{font-size:19px;margin:26px 0 8px}a{color:#225dcf}section{background:white;border:1px solid #d4dfeb;border-radius:10px;padding:22px 26px;margin:20px 0}li{padding:6px 0}small{color:#53697d}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;border-bottom:1px solid #e1e7ee;padding:9px;overflow-wrap:anywhere}code{overflow-wrap:anywhere}.notice{padding:10px 15px;background:#e4ede8;color:#285f52;border-radius:5px}@media(max-width:600px){main{margin-top:20px;padding:0 14px 30px}section{padding:16px}h1{font-size:25px}table{font-size:11px}}</style><main>
<small>城院教学工具 / 内测候选 ''' + html.escape(manifest['suiteVersion']) + ''' / ''' + html.escape(manifest['target']) + '''</small>
<h1>带走整套工具，离线完成安装。</h1><p>官方 DSH 客户端、自带运行时、十个固定能力包与 WorkBuddy 技能导入包。</p>
<p class="notice">安装无需 Hub 或包仓库。模型使用、本人登录和飞书服务按各自网络条件配置。</p>
<section><h2>依次完成三步</h2><ol><li>打开 <a href="''' + client + '''">client 中的官方安装器</a>，按官方界面安装 DSH。</li>
<li>正常退出已有 DSH，然后在文件夹中双击 <code>02-install-QCU.''' + extension + '''</code>。安装后另选是否启用七项技能与市场。</li>
<li>双击 <code>03-start-QCU.''' + extension + '''</code> 打开独立城院环境，配置自己的模型并试用。</li></ol><small>安装脚本请在解压后的文件夹中打开。浏览器中的下载动作不能代替系统执行。</small></section>
<section><h2>先让一项技能可用</h2><p>建议先用“备课教案”设计20分钟纸笔课程，检查总时长和目标是否对应。课程工作台、飞书工具在官方插件设置中分别启用。</p><p>WorkBuddy 使用 <code>workbuddy</code> 文件夹中的手工导入包；解压后上传单项 Skill ZIP。</p><a href="开始使用.md">完整安装说明</a>　<a href="验收与限制.md">验收与限制</a></section>
<h2>本套件的固定版本</h2><table><tr><th>产品</th><th>版本</th></tr>''' + products + '''</table><p><small>精确来源与摘要见 manifest.json 和 SHA256SUMS。独立城院环境保留本人配置，不会自动迁移旧 DSH 数据。</small></p></main></html>'''


def build(inputs, out, target):
    config = json.loads((BASE / 'release/offline-products.json').read_text(encoding='utf-8'))
    if target not in config['clients'] or out.exists():
        raise ValueError('Choose a supported target and a new output directory')
    client = config['clients'][target]
    checked(inputs / client['file'], client['sha256'], client['bytes'])
    notices = {}
    for p in config['products']:
        source = checked(inputs / 'bundles' / p['file'], p['sha256'], p['bytes'])
        notices[p['id']] = bundle_metadata(source, p)
    if len(config['products']) != 10 or len({p['id'] for p in config['products']}) != 10:
        raise ValueError('Unexpected product scope')
    asset, expected, native_name = LARK[target]
    native = lark_binary(checked(inputs / asset, expected), target)
    workbuddy = checked(inputs / 'QCU-WorkBuddy-Skills-0.1.0-rc.1.zip', WORKBUDDY, 43243)
    if not (inputs / 'lark-cli.LICENSE').is_file():
        raise ValueError('Missing Lark license')
    out.mkdir(parents=True)
    client_path = 'client/' + client['file']
    copy(inputs / client['file'], out / client_path)
    checked(out / client_path, client['sha256'], client['bytes'])
    products = []
    for p in config['products']:
        relative = 'bundles/' + p['file']
        copy(inputs / 'bundles' / p['file'], out / relative)
        checked(out / relative, p['sha256'], p['bytes'])
        products.append({**p, 'path': relative})
        for name, data in notices[p['id']].items():
            file = out / 'licenses' / p['id'] / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
    templates = BASE / 'tools/offline-suite'
    for name in ['offline.cjs', 'deny-network.cjs', 'smoke.cjs']:
        copy(templates / name, out / 'installer' / name)
    mac = target == 'mac-arm64'
    for src, dest in [('install-mac.command' if mac else 'install-win.cmd', '02-install-QCU.command' if mac else '02-install-QCU.cmd'),
                      ('start-mac.command' if mac else 'start-win.cmd', '03-start-QCU.command' if mac else '03-start-QCU.cmd')]:
        copy(templates / src, out / dest, executable=mac)
        if not mac:
            (out / dest).write_bytes((out / dest).read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
    for name in ['开始使用.md', '验收与限制.md']:
        copy(templates / name, out / name)
    copy(workbuddy, out / 'workbuddy' / workbuddy.name)
    native_path = 'third-party/' + native_name
    (out / 'third-party').mkdir()
    (out / native_path).write_bytes(native)
    (out / native_path).chmod(0o755)
    copy(inputs / 'lark-cli.LICENSE', out / 'licenses/lark-cli/LICENSE')
    copy(BASE / 'LICENSE', out / 'licenses/QCU-MIT-LICENSE')
    manifest = {
        'schemaVersion': 1, 'suiteVersion': config['suiteVersion'], 'target': target,
        'dshVersion': config['dshVersion'], 'client': {**client, 'path': client_path},
        'products': products, 'requiresHubForInstallation': False,
        'requiresRegistryForInstallation': False, 'containsModelWeights': False,
        'lark': {'version': '1.0.84', 'path': native_path, 'sha256': hashlib.sha256(native).hexdigest(),
                 'source': 'https://github.com/larksuite/cli/releases/download/v1.0.84/' + asset,
                 'sourceArchiveSha256': expected, 'license': 'MIT'},
        'workbuddy': {'path': 'workbuddy/' + workbuddy.name, 'sha256': WORKBUDDY,
                      'nativeImportStatus': 'not-verified'},
        'validation': {'nativeGui': 'not-verified', 'officialInstallerInteraction': 'not-verified',
                       'modelBehavior': 'not-verified'},
    }
    (out / '开始使用.html').write_text(page(manifest), encoding='utf-8')
    files = []
    for p in sorted(out.rglob('*')):
        if p.is_file():
            files.append({'path': p.relative_to(out).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p)})
    manifest['files'] = files
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sums = ''.join(p['sha256'] + '  ' + p['path'] + '\n' for p in files)
    sums += digest(out / 'manifest.json') + '  manifest.json\n'
    (out / 'SHA256SUMS').write_text(sums, encoding='utf-8')
    return manifest


def pack(root, output):
    if output.exists():
        raise ValueError('Archive already exists')
    with zipfile.ZipFile(output, 'x', allowZip64=True) as z:
        for p in sorted(root.rglob('*')):
            if not p.is_file():
                continue
            info = zipfile.ZipInfo(root.name + '/' + p.relative_to(root).as_posix(), (2026, 10, 20, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (0o100755 if p.stat().st_mode & 0o111 else 0o100644) << 16
            info.compress_type = zipfile.ZIP_STORED if p.suffix in ['.zip', '.tgz', '.dmg', '.exe'] else zipfile.ZIP_DEFLATED
            with p.open('rb') as src, z.open(info, 'w', force_zip64=True) as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
    return {'file': output.name, 'bytes': output.stat().st_size, 'sha256': digest(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--target', choices=sorted(LARK), required=True)
    parser.add_argument('--zip', action='store_true')
    args = parser.parse_args()
    try:
        manifest = build(args.inputs, args.out, args.target)
        result = {'target': args.target, 'products': len(manifest['products']), 'directory': str(args.out.resolve())}
        if args.zip:
            result['archive'] = pack(args.out, Path(str(args.out) + '.zip'))
        print(json.dumps(result))
    except (ValueError, OSError, KeyError, tarfile.TarError, zipfile.BadZipFile) as exc:
        parser.exit(2, 'Build refused: ' + str(exc) + '\n')


if __name__ == '__main__':
    main()
