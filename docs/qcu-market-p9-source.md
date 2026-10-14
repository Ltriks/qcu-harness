# P9 新人指引本地源码与固定包交接

> 父线程最终独立检查：253源＋16HTTP＋26浏览器，合计295不同条目通过；21归档通过。精确最新候选/保留/真实截图与未测边界见[父线程交付检查](qcu-market-p9-parent-validation.md)。以下保留两轮CLI实现与审查历史。

## 2026-10-14 父审查两项修正（当前交付）

按 `.ai/tasks/QCU-MARKET-P9-PARENT-REVIEW.md` 仅修正授权/回调URL整段遮盖与新手短文案。**当前固定交付以refined为准，下文保留初次交付历史与原始包信息，不覆盖旧产物。**

授权URL在其他键值脱敏前按完整原文识别：授权、登录、OAuth、回调路径或敏感授权查询参数整段移除；同时覆盖编码参数和OAuth令牌片段。普通错误/帮助链接保持可用，未增加链接访问或网络能力。虚构输入纯回归验证17种授权URL、幂等性和3个普通链接对照；实际Chromium验证勾选前剪贴板不变，人工确认后复制的文本无授权URL/参数，帮助URL仍在，保持“尚未提交”。任意个人信息仍须人工检查，确认门槛未削弱。

五步指引改为短动作说明，不含P9下载/待部署、库存、系统级锚定、页面内存、持久化等开发概念；已在市场的教师看到的是选技能和发送任务的介绍，外部安装文档用于尚未安装者。保留第二步标题、可选上/下步、跳过、重入、手动设置/安装/发送和结果检查。任务草稿说明保留内部返回、清空、重新加载及正常退出DSH，不声称仅隐藏面板会销毁草稿。反馈使用自身生命周期说明，敏感信息人工检查保持醒目，较长脱敏机制折叠为可键盘展开的“隐私提醒与脱敏说明”。

新源码变化仅为两个teacher helper/view和重新生成的client.js；相对初交付TGZ，14成员中**仅package/client.js字节变化**，包版本仍为0.1.0-pilot.9.1，原README/Host/RPC/元数据/allowlist保持不变。安装保持禁用、独立启用审批、取消、撤销、未知结果锁及所有权限语义未修改。八个产品归档及121个已捕获保护源文件均无变化。

父级精确官方ASAR审查位于 `source-checks/parent-public-ui-audit.json`：公开“插件/添加插件/包名或地址”和“设置→模型/API密钥”及openBundle/registered selectPanel得到核对。**下文同版本源码树UI证据仅是补充，不是与官方ASAR字节相同的证明**；parent audit明确显示UI bundle存在差异。本次不调整运行时SDK或引入导航API；外部官方安装引用由父线程维护。

| 本次相关验证 | 通过/失败/未测 | 独立新证据（source-checks/） |
| --- | --- | --- |
| helper纯函数先行检查 | 11通过，0失败，0跳过 | refined-helper-tests.txt |
| 相关源、取消、锁、激活、公开配对回归（含上述helper） | 118通过，0失败，0跳过 | refined-source-tests.txt |
| 新固定归档公开Host/Client/Gateway | 21通过，0失败，0跳过 | refined-archive-tests.txt |
| 新固定归档最终HTTP | 16通过，0失败，0跳过 | refined-http-tests.txt |
| 真实共享React Chromium旧/新流程 | 26通过，0失败，0跳过（2父测试、24子场景） | refined-browser-tests.txt |
| 确定性TGZ、14成员与当前源逐字节核对 | 通过 | refined-verification.json、refined/repack/ |
| 5个改动源/测试文件敏感模式和虚构URL检查 | 通过 | refined-scoped-source-audit.json |
| 旧产物保留 | 126个旧文件核对；125个字节不变，1个自动审查日志仅追加且原始前缀完整 | refined-preservation-before.json、refined-verification.json |
| 本机最终预览返回字节 | 与refined/index.html、app.js完全一致 | refined-preview-server.json |
| diff空白检查 | 通过 | refined-diff-check.txt |
| 全库扫描 | 本次未重跑；此前失败的2处基线既有命中保留，不改规则/历史 | 原public-source-final.txt |
| 原生DSH/账号/凭据/模型/教师、部署、Windows/其他架构 | 未测/未执行 | 本轮无真实环境操作 |

未重复未变化的Feishu26+26+3全套回归；原通过记录保留。所有新测试/构建日志使用唯一refined-*名称和对应command JSON，旧日志未重写。`source-checks/review-events.jsonl`由工具审批审查自动追加，已验证起始41875字节前缀SHA256仍与开工快照一致，没有替换旧记录。中途保留性检查因此曾报单一hash变化；已改为核对原前缀并明确记录追加。预览中JS的中文经构建转义，故中文字符串搜索不能核对服务器版本，最终使用响应字节与本地文件逐字节比较；局部安全扫描同时识别已有127.0.0.1合成服务控制。上述核对脚本修正不改变产品验收标准。

新固定包：

`$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/refined/final/market/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz`

**43446字节**，SHA256 **ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12**。固定索引为 `refined/final/INSTALLATION-CANDIDATE.json`、`refined/final/market/MANIFEST.json`、`SHA256SUMS`。这是同版本初始未发布候选的审查修订；没有替换任何已发布包或旧manifest。

最终共享预览为 `refined/preview/`，截图为 `refined/screenshots/`（46张PNG，含360px明暗指引、三任务表单/输出、反馈及实际授权URL脱敏导出）；已查看本轮短文案的指引/备课表单/反馈明暗窄屏和导出图，自动溢出检测通过。它们是实际Chromium+共享React+合成服务，原生截图/验收仍待用户完成。

本机 `http://127.0.0.1:9109/` 当前服务refined预览；原根/bind/port的Python服务已不存在，未结束任何DSH或无关进程，新服务返回的文件字节已核对。关停后重开使用：

```sh
rtk proxy "$HOME/.local/bin/python3.11" -m http.server 9109 --bind 127.0.0.1 --directory "$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/refined/preview"
```

本次构建、夹具和测试的完整复现参数以 `source-checks/refined-*-command.json` 为准；`.work/p9/env.json`及isolated HTTP夹具已指向新TGZ和refined预览。源命令缩小为helper/direct-ui/activation/loop/official/client-scope/host-official，归档命令同下文，HTTP和两个浏览器测试使用新包/预览。无安装、依赖下载、真实Hub/DSH/凭据访问、部署、消息、提交推送或agent。

---

2026-10-14，按 `.ai/tasks/QCU-MARKET-P9-ONBOARDING.md` 实施于 `market-onboarding` / `dev/qcu-market-p9`，基线 `b18240d571cc82cde6d3bfa551fc419828852810`。市场版本 **0.1.0-pilot.9.1**；本轮仅本地源码、文档、固定候选及隔离测试，未部署、提交、推送、创建子agent、下载依赖，也未操作真实DSH/Hub、凭据、文档或模型。

新增 `src/teacher-tools.mjs`（纯函数）与 `src/teacher-view.mjs`（共享React视图），由现有 `build.mjs` 编译进 `client.js`；`market-view.mjs` 只添加辅助路由和内存状态，`styles.mjs` 添加市场内语义token样式。更新包版本、Client生成注释和 `marketRuntime` 的精确配对；根README仅增加P9导航。新增教师安装指引、独立原生用户验收表、纯函数和实际浏览器回归。仅必要的旧版本断言更新；夹具脚本新增可选 `--p8`，保留旧调用接口，本轮显式使用固定P8归档核对同协议版本混配。

市场默认不启动教程。五步可上/下步、跳过和重入，完成只表示“已浏览引导”；没有安装、认证或模型验收勾选推断。三模板准确对应 `qcu-lesson-planning`、`qcu-tiered-practice`、`qcu-team-briefing`，使用完整虚构示例及必填有界字段，输入改变使旧输出失效。文本可编辑和显式复制，剪贴板不可用时可手选。查看技能详情只导航，返回保留任务草稿。教师在新对话选择真实Skill、粘贴、发送、审核；没有会话创建或模型调用。

反馈只生成本地记录；导出重新验证输入，并要求人工敏感信息检查确认。脱敏覆盖高置信度 `sk-`、Key/token/auth键值、Bearer/Basic、JWT、文档链接、邮箱、Mac/Linux/Windows个人目录；不能完全识别任意个人/学生信息。原文仅留表单内存，输出只含脱敏文本；复制失败仍能手选脱敏预览，始终标记尚未提交。没有文件、网络、日志、storage、遥测、设备/账号/实际DSH自动检测。版本来自已审核市场运行时，DSH0.2.0-rc.2仅是支持基线。任务草稿在市场内部切换保留，清空/卸载/重载移除；反馈页离开即销毁，输入修改撤销预览和确认。

## 公开接口证据和边界

核对的是已存在的审核依赖 `$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source/node_modules/@deepseek-ai/`，没有读取运行中的应用或profile。确切包版本/源文件SHA256见 `source-checks/public-api-evidence.json`。

| 公开包（全部0.2.0-rc.2） | 核对文件 | 支持的结论 |
| --- | --- | --- |
| dsh-client-ui-layout | src/client/service.ts，ILayout/LayoutController | selectPanel仅选已注册main面板或返回现有对话；不能证明设置页面可安全直达或新建对话能力 |
| dsh-client-ui-plugin-manager | src/client/locales.ts | 中文“插件”“添加插件”“包名或地址”“安装”“更改将在下次启动生效”，TGZ直链/本地路径安装说明 |
| dsh-client-ui-settings-general | src/client/locales.ts | 官方“设置”文字 |
| dsh-client-ui-settings-models | src/client/locales.ts | 官方“模型”“添加模型提供商”“API 密钥”“保存”文字 |

P9采用**市场槽位内stepper**，官方设置、新建对话、Skill选择、粘贴和发送给出手动说明；没有应用全局DOM tour、私有renderer/controller导入或system-wide anchored tips。原有公开 `pluginNavigation.openBundle` 仅在原有“官方插件详情”动作使用，新模板查看详情在本市场路由内完成。

`direct-flow.mjs`、Host准备/校验机制和四个公开RPC保持不变，没有新增RPC/schema字段、settings、tools、sessions或权限。**schema4 / revision4 / protocol4** 与目录指纹 `3364e5122184fd72423bfddcded4ee344df2e1b1eb83340dcf3739324cdb17ea` 保持原样：本轮没有产品或传输机制变化。实际P8/P9归档Host/Client在相同protocol4下，双向混配仍只得到版本拒绝，prepare/download/manager mutation不可达。

在无安装操作的辅助浏览中，status、外部网络、模型、安装、启用RPC均为零。若从原有详情页离开未使用的安装/启用确认，继续使用原有leave清理和取消语义；已发送操作的未知结果保留串行锁，不因辅助导航解锁。安装默认禁用、另一次单包/唯一组件启用确认、receipt撤销、过期指纹、失败停止、只读核对均保留。

## 最终实际验证

证据根为 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/source-checks/`，各同名 `*-command.json` 保存实际命令、环境、cwd、时间和退出码。下表计数为测试执行次数，源与归档有重复覆盖，不冒充互不重复的用例数。

| 检查 | 最终通过/失败/未测 | 证据 |
| --- | --- | --- |
| 市场/纯函数/固定教学及外部Skill源回归 | **252通过，0失败，0跳过** | source-tests-reviewed.txt |
| 最终归档官方Cordis/Slot/Gateway/manager配对 | **21通过，0失败，0跳过** | archive-tests-reviewed.txt；含P8/P9双向混配 |
| 最终归档真实本机HTTP | **16通过，0失败，0跳过** | http-tests-reviewed.txt |
| 真实Chromium共享React旧+新流程 | **25通过，0失败，0跳过**（2父测试、23子场景） | browser-tests-reviewed.txt |
| 未改动Feishu官方源回归 | **26通过，0失败，0跳过** | feishu-source.txt；只用合成CLI/文档 |
| 固定Feishu1.1归档回归 | **26通过，0失败，0跳过** | feishu-archive.txt |
| Feishu确定性包装检查 | **3通过，0失败** | feishu-pack.txt |
| 官方市场运行时一致性 | **14项核对通过** | runtime-parity.json；app-boot使用精确ASAR抽取字节 |
| Feishu公开SDK核对 | **27包/86个JS核对通过** | feishu-sdk.txt及本worktree .work/feishu-refine/runtime-parity.json |
| 最终市场确定性TGZ | **通过**，14成员逐字节匹配源及重包 | verification.json、repack/ |
| 八个原产品归档及保护源码 | **通过**：8个大小/哈希、121个已捕获保护文件未变 | verification.json、preservation-before.json |
| 公开源码总扫描 | **失败（退出1）**：2处基线既有命中，非P9引入 | public-source-final.txt |
| diff空白检查 | **通过** | diff-check.txt |
| 实际DSH安装、启用、正常重启、设置/Skill发现、模型输出、教师审核 | **未测** | 用户原生验收表；本轮不接触真实环境 |
| Hub部署、新P9安装URL、Windows/其他架构、签名/正式发布 | **未执行/未测** | 本轮无授权；没有制造P9URL |

源码扫描的两个阻止项分别为 `tests/qcu-feishu-readonly.test.mjs:36` 的合成URL-userinfo拒绝输入，以及 `docs/QCU-MARKET-P2-UI.md:34` 的历史Library引用；两行与HEAD完全一致。12项资源哈希和13个canonical Skill摘要检查通过。不为让扫描变绿改写受保护历史或放宽规则。

首次fixture准备使用宽泛Feishu glob导致多归档参数错误，首次源运行252项中246通过、6失败，因此缺fixture/变量，并有一条旧P8文件名预期；已改用精确固定归档和P9断言。首次浏览器测试25项中20通过、5失败（含父测试），错误地在修改表单后期待旧输出继续存在，并假定重入最后一步的“上一步”禁用；已修正测试假设，产品未放宽清除或焦点行为。原失败日志保留为 `prepare-http.txt`、`source-tests.txt`、`browser-tests-approved.txt`。沙箱首次HTTP **0/16、16失败** 与浏览器 **0/2、2失败** 均因127.0.0.1 listen EPERM；随后通过正常审批运行相同隔离测试，没有绕过沙箱或下载依赖。早期结果不计入最终通过。

浏览器覆盖Next/Back/skip/reentry、全部表单边界和输出更新、实际授权剪贴板与不可用手选、反馈确认/脱敏/清空、内存生命周期、正确产品详情、review撤销与未知结果跨条目锁、键盘焦点、360px明暗主题、零辅助RPC/外部请求及React错误。生成45张实际Chromium PNG（旧界面21、新辅助界面24）；已查看新指引、三模板输出、反馈的明暗窄屏及反馈脱敏图，未见裁切重叠或横向溢出。全部是明显标注合成服务的共享React渲染，不是原生安装截图。

## 固定交付

最终市场路径：

`$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/final/market/reviewed/qcu-market-0.1.0-pilot.9.1-6252875ee429f198ac6d160311faa0de8f4b0cad24e1c367b22bfcd479c39afe.tgz`

- **43120字节**；SHA256 **6252875ee429f198ac6d160311faa0de8f4b0cad24e1c367b22bfcd479c39afe**。
- `reviewed/MANIFEST.json`、`SHA256SUMS` 与 `final/INSTALLATION-CANDIDATE.json` 为固定交付索引，默认row disabled，无安装scripts或新依赖。
- 14个archive member allowlist未增减；辅助模块只编译进client.js，不在市场包中放入完整Skill正文、其他产品归档或CLI。
- 八个固定产品仍是六个Skill卡片、coach/P2插件和Feishu1.1插件；provider、source、release输入及归档字节未改。官方upstream和补丁未改。
- `final/market/` 下早期 `418e4bb9…` 候选及manifest留原样，仅为未补Basic脱敏的阶段包，**最终以reviewed/及INSTALLATION-CANDIDATE为准**。历史P8及更早候选/manifest/archives没有改写。
- 预览静态产物为 `preview/index.html` 与 `app.js`；本次本机运行入口 `http://127.0.0.1:9109/`（仅本机，进程关闭后按下面命令启动）。该URL不是P9部署/下载URL。
- 截图为 `screenshots/`；外部教师指引和用户表见 [安装指引](qcu-market-p9-install-guide.md)、[原生验收](qcu-market-p9-user-acceptance.md)。真实截图为用户待补占位。

保护核对仅覆盖记录中可读的121个文件及8个实际产品归档，不扩大声称为所有设备或未知文件。未触及其他worktree、扩充计划、真实profile、凭据、真实文档、LAN服务或main。

## 使用已有依赖复现

从本worktree根目录执行；没有安装或下载步骤。完整精确参数同时保存在source-checks的command JSON中。P8历史复现命令保留在P8交接；P9额外需要传入 `--p8` 夹具，不能用P7代替同协议检查。

```sh
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" node hub/plugins/qcu-market/build.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" QCU_MARKET_PREVIEW_OUT="$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/preview" node hub/plugins/qcu-market/preview.mjs
rtk proxy "$HOME/.local/bin/python3.11" scripts/prepare-market-loop-tests.py --dependencies "$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" --coach "$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz"
rtk proxy "$HOME/.local/bin/python3.11" scripts/prepare-market-http-tests.py \
 --dependencies "$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" \
 --archive "$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/final/market/reviewed/qcu-market-0.1.0-pilot.9.1-6252875ee429f198ac6d160311faa0de8f4b0cad24e1c367b22bfcd479c39afe.tgz" \
 --p8 "$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/final/market/qcu-market-0.1.0-pilot.8.1-c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09.tgz" \
 --old "$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/market/qcu-market-0.1.0-pilot.2.tgz" \
 --previous "$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1/final/market/qcu-market-0.1.0-pilot.7.1-994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288.tgz" \
 --coach "$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz" \
 --skills "$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1/final/skills" --external "$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1/final/external" \
 --feishu "$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz"
```

设置同一审核依赖和Feishu变量的测试命令（HTTP/Chromium需要正常本机监听/启动权限）：

```sh
rtk proxy sh <<'SH'
export QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source"
export QCU_BROWSER_DEPENDENCIES="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node"
export QCU_MARKET_PREVIEW_OUT="$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/preview"
export QCU_FEISHU_ARCHIVE="$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz"
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market.test.mjs tests/qcu-market-catalog.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-market-activation.test.mjs tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs tests/qcu-market-tools.test.mjs tests/qcu-market-teacher.test.mjs tests/teaching-skill-products.test.mjs tests/external-skill-products.test.mjs
rtk proxy env QCU_MARKET_CLIENT_PATH="$PWD/.work/http-e2e/market/package/client.js" QCU_MARKET_HOST_PATH="$PWD/.work/http-e2e/market/package/index.js" node --experimental-transform-types --expose-internals --test tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs
rtk proxy node --expose-internals --test tests/qcu-market-http.test.mjs
rtk proxy node --test tests/qcu-market-browser.test.mjs tests/qcu-market-teacher-browser.test.mjs
SH
rtk proxy "$HOME/.local/bin/python3.11" hub/plugins/qcu-market/pack-pilot.py "$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/source-checks/new-repack"
rtk proxy "$HOME/.local/bin/python3.11" scripts/verify-public-source.py
rtk git diff --check
rtk proxy "$HOME/.local/bin/python3.11" -m http.server 9109 --bind 127.0.0.1 --directory "$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/preview"
```

不要对reviewed固定包/manifest重写。Feishu官方源/归档测试和SDK命令以本轮 `feishu-*-command.json` 为准，全部使用合成工具，不调用真实lark-cli；固定源本身未修改。下一步仅为父级审查与用户独立原生验收，P9部署须另行授权。
