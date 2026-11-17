"""Build deterministic offline pilot packages and market handoff materials."""
import argparse
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['qcu-deep-research', 'qcu-document-team', 'qcu-data-copilot', 'qcu-ket-prep', 'qcu-ncre-prep']

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def build(output):
    evidence = json.loads((ROOT / '.work/workbuddy-expert-migration/sdk-check.json').read_text())
    results = []
    for name in NAMES:
        source = ROOT / 'packages' / name
        pkg = json.loads((source / 'package.json').read_text())
        manifest = json.loads((source / 'manifest.json').read_text())
        provenance = json.loads((source / 'SOURCE.json').read_text())
        files = sorted(['package.json', *pkg['files']])
        if files != sorted(p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file()) or any(p.is_symlink() for p in source.rglob('*')):
            raise ValueError('Unexpected package contents: ' + name)
        members, raw = [], io.BytesIO()
        with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
            for file in files:
                data = (source / file).read_bytes()
                members.append({'path': file, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
                item = tarfile.TarInfo('package/' + file)
                item.size, item.mode, item.mtime = len(data), 0o644, 0
                tar.addfile(item, io.BytesIO(data))
        compressed = io.BytesIO()
        with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
            gz.write(raw.getvalue())
        data = compressed.getvalue()
        sha = hashlib.sha256(data).hexdigest()
        filename = f'{name}-{pkg["version"]}-{sha}.tgz'
        dest = output / name
        handoff = dest / 'handoff'
        handoff.mkdir(parents=True, exist_ok=True)
        (handoff / filename).write_bytes(data)
        dump(handoff / 'members.json', {'schemaVersion': 1, 'members': members})
        (handoff / 'LICENSE.txt').write_bytes((source / 'LICENSE').read_bytes())
        (handoff / 'SOURCE.md').write_bytes((source / 'SOURCE.json').read_bytes())
        (handoff / 'BUILD.md').write_text('Pinned source; import-workbuddy-experts.py then check-workbuddy-experts.cjs and pack-workbuddy-experts.py. No installation hooks.\n')
        (handoff / 'PLUGIN-SPEC.md').write_text('Official DSH skill provider; disabled by default, separate enable. Directory role resources; native session agents and tools, not the legacy text-review executor. No credentials or background worker.\n')
        check = next(c for c in evidence['checks'] if c['name'] == name)
        if not all(check[k] for k in ['discovery', 'resourceAccess', 'provenanceHashes', 'activationGate', 'disposal']):
            raise ValueError('SDK checks incomplete')
        dump(handoff / 'provider-evidence.json', {'actualAsar': True, 'modelsCalled': 0, **check})
        dump(handoff / 'source-evidence.json', provenance)
        limits = ['真实模型及工具端到端任务尚待验收', '需会话实际提供独立代理、检索或代码工具；本包不额外授予权限', '不是旧专家团页面的配置包，不自动增加该页卡片', '原平台预算与后台续跑未实现，不承诺无人值守', '社区改编包不保证与官方原版一致']
        release = {'id': name, 'version': pkg['version'], 'file': filename, 'bytes': len(data), 'sha256': sha}
        meta = {'schemaVersion': 1, 'templateOnly': False, 'id': name, 'title': manifest['title'],
                'version': pkg['version'], 'productType': 'skill', 'sourceRevision': provenance['revision'],
                'license': 'MIT', 'runtime': '0.2.0-rc.2', 'components': [name], 'skills': [name],
                'peerDependencies': pkg['peerDependencies'], 'runtimeDependencies': {}, 'installScripts': [],
                'permissionSummary': ['加载只注册技能和角色资源', '任务可按当前会话权限检索、读写工作区和执行代码', '独立代理使用已有模型，可能产生多次请求；不含密钥或自动安装依赖'],
                'archive': {k: release[k] for k in ['file', 'bytes', 'sha256']},
                'materials': {'spec': 'PLUGIN-SPEC.md', 'build': 'BUILD.md', 'license': 'LICENSE.txt', 'source': 'SOURCE.md', 'memberManifest': 'members.json', 'lock': None},
                'testEvidence': {'source': {'status': 'passed', 'file': 'source-evidence.json'}, 'preview': {'status': 'passed', 'file': 'provider-evidence.json'},
                                 'liveInstall': {'status': 'untested', 'file': None}, 'businessAcceptance': {'status': 'untested', 'file': None}},
                'knownLimits': limits, 'published': False}
        dump(handoff / 'submission.json', meta)
        entry = {'purpose': pkg['description'], 'scenario': manifest['title'] + '任务，通过主会话调用技能和真实工具。',
                 'prerequisites': 'DSH 0.2.0-rc.2；安装后另行启用。需要实际可用的子代理及相关检索/代码工具；Python和依赖不随包安装。',
                 'example': '/' + name + ' 请先预览本次任务的范围、角色和输出文件；用合成示例试跑，不连接生产数据库。',
                 'risk': '多角色可能产生多次模型请求和联网操作；代码沿用会话审批。原始角色资格为虚构角色设定，不代表真人。',
                 'testStatus': '官方SDK发现、角色资源哈希、启停已验证；真实模型端到端、市场实机安装和业务效果尚未验收。',
                 'provenance': {'ownership': 'third-party', 'author': provenance['author']['name'] + '; QCU DSH adaptation',
                                'upstreamSource': provenance['repository'] + '/tree/' + provenance['revision'], 'pinnedRevision': provenance['revision'],
                                'license': 'MIT', 'modifications': '原角色正文保留；另加DSH工具协议适配、来源差异及审核状态修正。来源类型：' + provenance['sourceKind']}}
        dump(dest / 'market-entry.json', entry)
        dump(dest / 'release.json', release)
        results.append(release)
    dump(output / 'releases.json', results)
    return results

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path, required=True)
    print(json.dumps(build(p.parse_args().out), ensure_ascii=False))
