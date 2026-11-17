"""Prepare reviewable submission materials, without publishing or signing."""
from pathlib import Path
import hashlib, importlib.util, json, shutil

ROOT = Path(__file__).resolve().parents[1]
OPS = ROOT / '.work/accounting-suite'
SOURCE = ROOT / 'packages/qcu-accounting-suite'
OUT = OPS / 'handoff'
OUT.mkdir(exist_ok=True)
def dump(v): return json.dumps(v, ensure_ascii=False, indent=2) + '\n'
release = json.loads((OPS / 'release/release.json').read_text())
package = json.loads((SOURCE / 'package.json').read_text())
provenance = json.loads((SOURCE / 'SOURCE.json').read_text())
for name in [release['file'], 'members.json']: shutil.copy2(OPS / 'release' / name, OUT / name)
shutil.copy2(SOURCE / 'LICENSE', OUT / 'LICENSE.txt')
shutil.copy2(OPS / 'provider-evidence.json', OUT / 'provider-evidence.json')
case = json.loads((OPS / 'case-evidence.json').read_text())
assert case['passed'] and json.loads((OPS / 'provider-evidence.json').read_text())['passed']
for member in provenance['authoredFiles']:
    assert hashlib.sha256((SOURCE / member['path']).read_bytes()).hexdigest() == member['sha256']
(OUT / 'source-evidence.json').write_text(dump({'passed': True, 'sourceSnapshot': provenance['revision'], 'revisionKind': provenance['revisionKind'], 'authoredFilesVerified': len(provenance['authoredFiles']), 'syntheticCase': case, 'modelsCalled': 0, 'teacherApproved': False}))
for name, text in {
    'PLUGIN-SPEC.md': '一个官方DSH组件注册五项静态技能：一个选用入口和四项独立教学方法。安装默认停用，启用统一注册，停用统一移除。无工具注册、后台服务、账套或申报连接。成员、路径和内容SHA256在skill-bundle.json中明确声明。',
    'BUILD.md': '运行 scripts/build-accounting-suite.py --out .work/accounting-suite/release。使用确定性USTAR/gzip，无下载、安装钩子或运行时依赖。SOURCE.json中的内容快照SHA1不是Git提交；包含源文件SHA256和构建器SHA256。官方SDK证据见provider-evidence.json，业务验收仍untested。',
    'SOURCE.md': dump(provenance)
}.items(): (OUT / name).write_text(text + '\n')
metadata = {'schemaVersion': 1, 'templateOnly': False, 'id': release['id'], 'title': '会计系教学技能包（示例）', 'version': release['version'], 'productType': 'skill', 'sourceRevision': release['sourceRevision'], 'license': 'MIT', 'runtime': '0.2.0-rc.2', 'components': [release['id']], 'skills': release['skillNames'], 'peerDependencies': package['peerDependencies'], 'runtimeDependencies': {}, 'installScripts': [], 'permissionSummary': ['Host组件启用时读取并校验包内五项教学说明，统一注册静态技能与资源目录', '不注册工具、不联网、不访问账套、无后台任务；校验脚本只读包内虚构案例且不自动运行', '技能调用使用本人配置的模型和既有工具；实际工具调用仍遵循当前审批'], 'archive': {k: release[k] for k in ['file', 'bytes', 'sha256']}, 'materials': {'spec': 'PLUGIN-SPEC.md', 'build': 'BUILD.md', 'license': 'LICENSE.txt', 'source': 'SOURCE.md', 'memberManifest': 'members.json', 'lock': None}, 'testEvidence': {'source': {'status': 'passed', 'file': 'source-evidence.json'}, 'preview': {'status': 'passed', 'file': 'provider-evidence.json'}, 'liveInstall': {'status': 'untested', 'file': None}, 'businessAcceptance': {'status': 'untested', 'file': None}}, 'knownLimits': ['仅为本科基础会计教学示例，全部业务数据虚构，未经过会计系教师验收', '不涉及税费、折旧、利润分配及正式财税处理；科目口径为示例设定', '包内技能统一启停与升级，不支持成员独立升级或停用', 'SDK与静态案例通过不代表真实模型输出、教学效果或原生市场操作已验收'], 'published': False}
(OUT / 'submission.json').write_text(dump(metadata))
entry = {'purpose': '一次安装获得会计分录实训、凭证审核模拟、报表勾稽练习、课堂案例设计四项技能及一个选用入口；成员可独立使用、收藏和固定到首页。', 'scenario': '会计系基础教学与课堂实训', 'prerequisites': 'DSH 0.2.0-rc.2；安装后另行启用，启停及升级作用于整个包。市场16.11及配套首页支持成员独立显示；旧客户端可显式调用命名技能。', 'example': '/qcu-accounting-suite 为本科基础会计入门学生选一个教学任务：设计两笔虚构业务分录练习，学生题目和教师参考分开，不含税费和折旧。', 'risk': 'QCU自有教学示例，Host以应用用户权限校验并注册五项静态说明及资源。无新增工具或账套连接，案例全部虚构。成员不能独立停用或升级，真实账务、财税处理和正式教学采用需专业人员确认。', 'testStatus': '源与成员哈希、虚构案例勾稽、实际官方SDK五项发现/获取/资源及统一停用通过；冲突与篡改拒绝通过。未调用真实模型，教师验收、原生市场点击及正式业务效果尚未验收。', 'provenance': {'ownership': 'qcu', 'author': 'QCU teaching prototype contributors', 'upstreamSource': 'packages/qcu-accounting-suite; SHA1 content snapshot (not Git commit) ' + release['sourceRevision'], 'pinnedRevision': release['sourceRevision'], 'license': 'MIT', 'modifications': '原创基础会计教学示例；一包注册一个选用入口和四项成员。SOURCE.json固定内容快照，示例不含教师教材或真实企业数据。'}}
(OPS / 'market-entry.json').write_text(dump(entry))
checker = Path('/Users/mcq/Repos/worktrees/qcu-harness/teacher-product-delivery/scripts/qcu-check-submission.py')
spec = importlib.util.spec_from_file_location('checker', checker); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
report, code = module.check_submission(OUT / 'submission.json')
(OPS / 'check-report.json').write_text(dump(report))
print(dump({k: report[k] for k in ['staticChecksPassed', 'counts', 'errors', 'unsupported']}))
raise SystemExit(code)
