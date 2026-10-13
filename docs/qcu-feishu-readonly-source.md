# QCU-FEISHU-READONLY-REFINE — 1.1 本地源码交接

> 父线程后续检查：26源码、26归档及3打包检查通过，实际CLI目录与选定第一节读取通过；桌面/模型仍未测。见[父线程检查](qcu-feishu-readonly-parent-validation.md)。下文保留实现交接时的未测范围。

2026-10-13。交付独立 `qcu-feishu-readonly@0.1.0-pilot.1.1` 候选，面向官方 DSH `0.2.0-rc.2`。已修复合成复现的目录包装不兼容，并验证官方可编辑配置与授权撤销。只读本地源码/测试阶段；没有访问真实飞书文档、认证存储、实际 CLI、网络或正式 profile，没有安装、部署、下载依赖、改市场目录、提交/推送或启动 agent。父线程拥有真实验收和发布。

## 实现及边界

旧 `0.1.0-pilot.1` 归档中的 parser 可读平铺标题，却以 `response` 拒绝 `<fragment mode="outline"><outline><h1 id="SyntheticHeading01">Synthetic heading</h1></outline></fragment>`。复现使用旧归档代码及合成字符串，见 [复现结果](evidence/qcu-feishu-readonly-wrapper-reproduction.json)。新 parser 兼容平铺标题和恰好一个无属性 outline 容器，保留 ID/重复/数量/标题长度限制，新增 20,000 字符目录限制；任意嵌套、属性、其他正文、DTD 和未知实体均拒绝。成功响应的有界 stderr 进度信息被丢弃，不进入结果或日志。

`cliPath`、`documentUrl` 采用公开 schemastery `.volatile()`，使用公开 cosmokit `isVolatile` 与引用 `.get()`。两字段提供中文名称说明。`enabled` 不可通过表单实时修改，仍走正常启用。组件可在空配置下注册受正常工具策略控制的两个工具并供 Settings 展示；挂载不读文件、不启动 CLI、不调用模型。配置不完整/无效时返回中文设置提示，零子进程。不会把组件已加载宣称为已配置或可读。

官方所属 fiber 的 `loader/volatile-update` 同步触发授权 generation 递增、撤销旧 runner/回执并取消旧进程。新读取等待所有旧 runner 完成关闭；途中又改配置或卸载则旧调用/排队调用/迟到成功结果均拒绝。无效字符串和空字段让读取保持未配置，不静默沿用旧绑定。官方表单拒绝类型错误、未知字段、非 volatile enabled 和过期编辑 revision，拒绝的编辑没有被应用。其他组件的 volatile 事件不撤销本组件回执。

配置仍只允许可信原生 CLI 绝对路径和唯一 canonical HTTPS Feishu Wiki/Docx URL。此次选择**严格拒绝所有 query/anchor**，没有采用任务允许的可选导航字段归一化。固定命令、用户身份、receipt/session/CLI/document 绑定、正整数 revision 快照、输出/时间/并发限制及正常 guards/approval/execute wrappers 全部保留。章节正文为不可信任务数据；没有其他文档、素材、sheet/bitable 下钻，没有正文缓存/日志。宿主及 CLI 仍以应用用户身份运行，CLI 可刷新自身凭据/缓存；不承诺 OS 沙箱或凭据存储不可变。

源码见 [包说明](../hub/plugins/qcu-feishu-readonly/README.md)、[组件](../hub/plugins/qcu-feishu-readonly/index.js)、[授权生命周期](../hub/plugins/qcu-feishu-readonly/src/authority.mjs)。没有 Skill、自定义 UI、installer 或私有 Host 配置写入。测试专用 runner factory/limits 是可信核心测试接口，不属于插件配置或模型参数。

## 老师设置流程与已验证程度

1. 父线程使用官方安装流程，显式传 `enabled:false`；唯一 bundle 行 `disabled:true`，内部 `config.enabled:true`，两个设置值为空。rc.2 manager 不传 enabled 会默认启用，必须保留安装与启用两次确认。
2. 经正常确认启用后，在官方插件配置表单填写“本机 CLI 路径”和“授权文档链接”。本机必须已有可信的原生 CLI 和本人正常只读授权；不使用可能自动下载的 npm/npx 启动器，不转移其他机器凭据。
3. 保存设置；调用目录、让用户选标题、只读该节。每次修改设置后必须重新列目录。初始空配置能展示表单，但任何读取都返回中文未配置提示。

实际使用官方 Settings + ConfigEditor + Loader + **精确官方 ASAR app-boot**，在 `.work/feishu-refine/` 下的合成 profile/home/patch 文件中验证：公开表单 uid/refs schema 仅含这两个字段、持久化确由 ConfigEditor 完成、Loader 原地更新稳定 Ref、fiber 不重挂载、回执立即失效、旧进程被杀并关闭、新读取不并行、无效新值不沿用旧文档、冲突编辑拒绝。没有改写官方服务。真实桌面表单显示/点击保存、正式安装/启用、实际 native CLI/auth、DSH 模型会话与教师效果仍待父线程验收；合成服务测试不能替代它们。

## 实际测试

| 检查 | 当前实际结果 |
| --- | --- |
| 旧归档包装不兼容复现 | 平铺通过；包装失败 category=response；全合成 |
| 完整源码 fixture/official runtime/settings suite | **26 passed, 0 failed** |
| pack/allowlist/peers/重现/不可变冲突/source scan | **3 passed, 0 failed** |
| 新归档哈希/元数据/8 个成员提取 | 全部核验 |
| 提取归档后的完整 fixture/runtime/settings suite | **26 passed, 0 failed**，见 `.work/feishu-refine/archive-tests.tap` |
| SDK 对照 | 82 runtime JS 与 ASAR 相同；2 app-boot JS 使用精确提取 bytes；2 附加 review 文件单独标记 |
| 真实 native UI/CLI/document/model/teacher | 未测，父线程负责 |

完整 26 项包含既有身份/命令注入/资源拒绝/安全 auth 错误/超限/超时/abort/并发/回执/版本/session/unload/duplicate/guard/wrapper/approval 回归、包装和进度响应、6 项 Settings/授权生命周期测试。核心 fixture suite 在归档测试中使用已逐成员哈希比对的相同源码；正式注册/执行/Settings 测试导入提取归档插件。测试使用 Node `25.8.1`、Python `3.9.6`、rtk `0.44.2`。当前没有失败；初期两个 Settings fixture 假设（schema 是 uid/refs 图、完整 profile composition 需 include insert）已按官方实际格式改正，没有改服务绕过失败。

## 精确 SDK 证据

[当前 SDK 报告](evidence/qcu-feishu-readonly-sdk.json)覆盖 27 包、86 JS artifacts，比较官方 manifest 版本与 JS resolver 字段，并列出本地 workspace dependency/peer metadata 改写。82 执行 JS 与官方相同。app-boot 的 index 本地构建不同，配置测试 loader 显式映射到 `.work/feishu-refine/official-sdk/dsh-app-boot/lib/index.js` 的精确 ASAR bytes；它的两项 lib artifact 单独标为 `official-asar-execution`。官方 plugin-manager Client 文件也不同，但仅以提取的官方 bytes 进行 UI 接口审阅，不用作测试运行代码。其他 setup runtime 及其可达 DeepSeek imports 经过同一审计。不声称全桌面或全部第三方依赖的字节对等。

固定 ASAR SHA256：`18d5036bbb58eaff41d351ede99314b8d06505aec06fb2e164c49874ada30f9e`。

| 相关官方 JS | SHA256 |
| --- | --- |
| `cordis-plugin-loader/lib/index.js` | `b57c5075e881b4ceb3a15382f506ce549bcbdcd2a0f5bae292f67e6a83a45b1f` |
| `dsh-settings/lib/index.js` | `9432b872597b7a31473072eb38a55979ab23375c76bd1d86d751388a692a0136` |
| `dsh-config-editor/lib/index.js` | `373e05c8250d25dda983ccf6e214a55e3792a211d1a7b883affcd66de47b5bf8` |
| `cosmokit/lib/index.js` | `ba44c0871656e4c7cac2c3c8a2ff644e0d2eb9d6bda7f6355866d686d513268e` |
| `schemastery/lib/index.mjs` | `cfcbe46c7416bdb35ce891c252152bbf519e08199bede5930dd7cb880c65f1ef` |
| 精确 ASAR `dsh-app-boot/lib/index.js` | `234db45e1b3f8c683b5bc1f551948b2a2ec52a6468c7b6937725a23f1c0e0d96` |

没有已证实的 SDK 设置/执行 blocker。依赖安装来自既有已审计树，未下载。Node 测试 loader 的 experimental warning 仍存在，它不在插件归档内，也不影响测试结果。

## 新归档与历史保留

候选：`qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz`。

- 大小：**11,263 bytes**；大小写入 manifest，不放在文件名。
- SHA256：**`37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17`**。
- 位置：`$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/`；旁边 `.tgz.json` 包含每成员 hash 和精确 peers。
- 8 个 regular allowlisted members，无 links/executables/scripts/dependencies，固定 uid/gid/mode/mtime，拒绝不可变文件名碰撞。
- peers：Cordis `4.0.4`、cosmokit `1.8.5`、dsh-tools `0.2.0-rc.2`、schemastery `3.18.4`。
- 旧的 9,252/9,370-byte pilot.1 TGZ 与 manifests 未改；历史 [源码交接](qcu-feishu-readonly-source-pilot1.md)、[SDK](evidence/qcu-feishu-readonly-sdk-pilot1.json)、[测试](evidence/qcu-feishu-readonly-validation-pilot1.json)独立保留，不把旧次数归给 1.1。父线程基线与任务文档未修改。

## 父线程精确本地复跑命令

从此 worktree 执行。只读官方 ASAR/既有依赖；只有合成隔离文件和指定 artifacts 会被写入。没有 app launch/install/网络/真实 CLI。

```sh
rtk proxy mkdir -p .work/feishu .work/feishu-refine
rtk proxy python3 scripts/verify-feishu-sdk.py --asar "$HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar" --dependencies "$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" --out .work/feishu-refine/runtime-parity.json
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" QCU_FEISHU_OFFICIAL_APP_BOOT=.work/feishu-refine/official-sdk/dsh-app-boot/lib/index.js node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
rtk proxy python3 -B tests/test_feishu_readonly_pack.py
rtk proxy python3 scripts/pack-feishu-readonly.py
```

验证及提取新归档：

```sh
rtk proxy python3 - <<'EXTRACT'
import hashlib, json, tarfile
from pathlib import Path
name = 'qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz'
archive = Path.home() / 'Artifacts/qcu-harness/0.1.0-pilot.8.1' / name
manifest = json.loads(Path(str(archive) + '.json').read_text())
assert archive.stat().st_size == manifest['bytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
with tarfile.open(archive, 'r:gz') as t:
    assert sorted(t.getnames()) == sorted('package/' + n for n in manifest['members'])
    for member in t.getmembers():
        assert member.isfile() and member.mode == 0o644 and member.mtime == 0
        body = t.extractfile(member).read()
        assert hashlib.sha256(body).hexdigest() == manifest['members'][member.name.removeprefix('package/')]
        target = Path('.work/feishu-refine/extracted') / member.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
EXTRACT
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" QCU_FEISHU_OFFICIAL_APP_BOOT=.work/feishu-refine/official-sdk/dsh-app-boot/lib/index.js QCU_FEISHU_EXTRACTED="$PWD/.work/feishu-refine/extracted/package" node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
```

## 剩余真实验收

父线程先复核最终 hash，依正常官方流程进行独立安装/启用确认；在实际桌面验证表单、逐字段保存与取消/无效输入。确认本机 native CLI 及本人只读授权，再做当前模型会话目录→用户选节→fixed revision 正文及配置变更/卸载拒绝。当前 fixture 中包装 XML 可读，不代表真实 wire/model/教师效果已通过。超限、富嵌套或不同格式仍安全拒绝，若遇到新 wire 形态仅提供去私有信息的合成样例继续修正。

中央私有回执写入此前被 sandbox 拒绝；本次复用同一 local fallback 身份，增量恢复 payload 保存在忽略的 `.work/feishu-private/refine-start.json` 和 `refine-handoff.json`。它们不是已投递的中央回执；父线程可在已授权私有存储中登记。不会绕过权限或反复重试。
