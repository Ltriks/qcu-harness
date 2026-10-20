# Course review stability — local candidate 1.3

2026-10-20，`dev/qcu-course-workbench`。Course `VERSION/package = 0.1.0-pilot.1.3`，wire `PROTOCOL = 3`；磁盘业务状态仍为 v1，无迁移。市场改动仅为当前源码/重建 Client 的本地补丁，保留 P13.2 包版本、Host 契约、发行目录、历史 SHA 与归档；**这些改动未部署，不能用既有发行哈希代表修改后的 Client**。父审查补修后已在新目录生成 1.3 本地候选 TGZ，见下方候选包核验；旧归档未改。

此前唯一一次真实模型成功及内容问题见 [1.2 原生验收](qcu-course1.2-native-acceptance.md)。本轮只有合成生成器/适配器，不重复真实模型调用，不操作 mini/Hub、官方源码或其他 worktree，实现阶段不提交、推送；父级交付审查后按既有授权提交并推送开发分支，提交记录以 Git 为准。本轮未部署，未实现上传/管理员网络服务；Hub 下一轮计划见[投稿、审核与发布计划](qcu-hub-submission-workflow.md)。

## 已证明的缺陷与边界

1. **首个连接通知被误当作业务失败。** 官方 rc.2 `dsh-api-gateway/src/client/index.ts` 的 `ClientRemoteService` 将 `connection.start({onConnected})` 回调转成 `connection/reset`，这不是“已经发送生成/安装”的证据。旧 `CourseController.invalidate()` 无条件进入 unknown，旧 `DirectMarketFlow.invalidate()` 无条件把无任务条目标为 error；因此不必发生任何自动检查/安装，就能出现旧 UI 的生成超时提示与市场“操作未完成”。新增官方 Client 回调测试经过真实 Cordis/ClientRemote，证明空闲连接通知不应制造业务失败。课程的实际重建 Client 还验证了通知后的只读恢复与可选服务重挂载。
2. **工作区列表等待模型能力。** 旧 Host 的 `workspaces` 先等待 `resolveRoute`，非合作/慢 MODEL 适配器可拖住课程入口。现在 `workspaces` 只读工作区；独立 `model` 请求最多等待 5 秒并取消，Client 每次只读 lookup 最多 6 秒。已用真实官方 LLM runtime 和不响应的合成 metadata adapter 证明：能力挂起/失败期间，工作区列表和已存课程仍可读，适配器生成次数为零；卸载会中止查询。
3. **并发只读检查误占操作锁。** 旧 `status()` 使用跨条目 `guard()` 和 `pending`，并发检查会产生“其他条目已有操作”拒绝；检查还会清除已有 review。现已独立、同条目去重并隔离迟到回复；不占安装/启用锁，不覆盖本条目的确认/变更操作。安装、验证、启用与审批串行 guard 均保留。真实 scoped Client/生成 wire codecs 验证了全目录并发检查与零变更调用；真实官方 PluginManager/Gateway 对隔离的合成 profile 执行并发 `listBundles` / `listPlugins`，初始化及检查前后文件逐字一致。
4. **现场归因仍有范围限制。** 上述是已复现的代码路径，不是当时原生会话的事件追踪。当前共享市场 UI 和官方 scoped 启动/导航 harness 不会自动执行全目录检查；没有证据声称现场“自动安装失败”。没有重放真实 DSH 首次网络时序，也不能排除其他连接/配置问题。缺服务或读失败显示状态检查不可用；官方加载失败、精确版本冲突继续按真实 inventory 显示，不伪装未安装或已加载。

## 实现

- Course Controller 分开 connection、modelStatus 与任务 phase；初始连接、选择工作区、模型缺失/能力缺失、真实 transport 错误、已发送生成的 unknown 各自表达。课程插件只在官方连接通知后重新做有界 `workspaces/model` 查询；不自动生成、重发生成或保存。重叠 boot、reset、工作区/课程切换、task/cancel/reconcile 和 dispose 的迟到回复被隔离。已知历史失败/成功不会被只读连接失败改写成生成超时。
- 重连先清除模型确认。精确 provider/model、能力策略、12000 预算、官方一次性 prepared call 和最后一次策略复核全部保留；low → off → 诚实展示默认策略的规则不变。未改全局模型设置。
- 完整字段编辑：课堂标题；目标/标准/词汇逐项；环节标题/分钟/教师/学生/证据；组件标题、小节标题/正文；每题题干、四选项、正确答案 A–D、解析。沿用 details、标签、原有配色与响应式布局，无新依赖或教师用 JSON 输入。
- 双语条目内部换行保留。组件 tab 共用一份未应用草案；不提供新增/删除组件、环节或题目的操作。空分钟值保持可编辑，不强制转为 0。按原 `parseDraft` 校验，正整数分钟须合计本课时长（合成示例为 45 分钟），答案须在 0–3；错误编辑不能应用、准备保存或触发模型。
- 本地预览随编辑更新；课堂预览补上原本遗漏的词汇。显式 Apply 校验并持久化修订，改变 draft hash；Discard 恢复已提交草案。DOCX/PPTX 使用编辑后的组件标题。已有导出保持原字节，除非用户走正常保存动作。
- 本地编辑、组件/task/course/workspace 切换立即清除旧保存预览/成功确认，迟到 prepareSave 不会恢复确认。未知保存保留**原 workspace、course、saveId 和完整请求**；核对只调用原 `saveStatus`。只有读到 pending 后，用户才可明确继续同一请求；不会自动分配新版本。服务 facade 撤回/重挂载时，当前插件生命周期内继续保留未知保存意图；完整退出/重新启动应用的 Client 自动恢复不在本次验收范围，Host 原 journal 保留且不会自动重发。
- Prompt 只增加通用数学与双语约束：定义准确、符号变化与正幅度区分、分母语境、组件与流程题号一致、每项独立导出含完整简洁答案。未加入百分比罐头答案或“语义认证”。现有选中组件篇幅规则、资料不裁剪、不重试均保留。新合成预览使用普通二次函数主题，含 3 道题，不改旧真实证据。

## 最终验证

| 检查 | 结果 |
| --- | --- |
| 17 个相关 Node 源码/实际重建 Client/官方 Host/Client/PluginManager/导出回归文件 | 249 tests，249 pass，0 fail，0 skipped |
| 实际共享 React 页面 + Controller + CourseStore + 合成生成器的浏览器闭环 | 1 test，1 pass；3 环节、3 题、4 组件数目保留；修改第一环节和完整第一题，逐项双语、跨 tab、错误分钟、Apply/Discard、hash/保存确认失效均通过 |
| 浏览器布局与日志 | 360 / 1120px × light / dark，均无页面横向溢出；console errors = []，outside requests = []；浏览与编辑时 generate = 0、revise = 1、save = 1 |
| Python ZIP/XML/relationship + python-docx/python-pptx 互操作 | 2 tests，OK；7 个 OOXML、8 个离线 HTML |
| Course 和 Market tracked Client 重建 | 成功；仅外部 React，未改归档、目录 pins 或官方依赖 |
| `rtk git diff --check` | 通过 |

交付证据已归档至 `/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.3/validation-20261020/`，worktree 的 `.work/review-stability/` 仅作复现工作目录。归档包含：`regressions.log`、`browser.log`、`browser/results.json`、4 张 `browser/editor-*.png`、`ooxml.log` 与合成 exports/workspace。图像已人工查看窄屏 light/dark，未声称是原生 DSH 截图。

早期执行问题已解决：历史固定包变量未设置导致 2 项失败，改为读取既有 1.2 归档后 3/3 通过；一次误用 strip-only Node 启动官方 TS 测试，按现有 transform/loader 命令重跑通过；默认 Playwright 修订未安装，改用**已存在**的 Chromium 1234，不下载浏览器；本机端口受沙箱限制后走正常审批启动。浏览器测试最初两个文本 locator 已修正；工作区选择器增加显式可访问名称。最终无未解决的测试失败。

仍待验收：真实 DSH 首次网络/重连时序、1.3 安装、真实模型的新内容质量、真实课堂、目标 Microsoft Office/Keynote 的打开/排版与修复提示。结构及合成测试不证明语义正确或真实教师使用通过，不能声称 mini 1.3 或 Office 已验证。

## 父审查补修：候选包版本与确定性

本次只将 `hub/plugins/qcu-course-workbench/pack.py` 的精确版本断言从 `0.1.0-pilot.1.2` 改为 `0.1.0-pilot.1.3`，与当前 package/VERSION 一致。未改运行源码、市场包版本、旧包或 release/catalog pins；不新增广泛测试、不重构，保留此前 **249 / 1 / 2** 验证结果，本次没有重跑这些测试。

在此前不存在的新目录 `.work/review-stability/candidate-package/`，以两个独立 CLI 进程执行现有 `pack.py`。TGZ、`MANIFEST.json` 与 `SHA256SUMS` 两次均逐字节一致；独立遍历归档验证全部 **13** 个普通文件与当前明确允许打包的源码逐字节一致、无额外成员或链接，tar 路径/权限/时间/所有者已核对。包内 metadata 为 `0.1.0-pilot.1.3`、协议 **3**、DSH `0.2.0-rc.2`；默认禁用 patch 与现有精确配置一致。

- 文件：`qcu-course-workbench-0.1.0-pilot.1.3-b2ef1c96f62622ffe102e8611bfc5c931522c2f8438fc52df9c9c027711887ca.tgz`
- 大小：**54364 bytes**
- SHA256：`b2ef1c96f62622ffe102e8611bfc5c931522c2f8438fc52df9c9c027711887ca`
- 状态：**`local-candidate-not-published`**；已归档至 `/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.3/`，未发布、安装或部署，无真实模型/远程调用。
- 配套证据：同目录 `MANIFEST.json`（逐成员大小/SHA）、`SHA256SUMS` 与 `VERIFICATION.json`。

复现打包命令（输出只在新的本地候选目录，历史 artifact 目录不写入）：

```sh
rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 hub/plugins/qcu-course-workbench/pack.py .work/review-stability/candidate-package
```

## 复现命令

从本 worktree 根目录运行，复用已有 rc.2 依赖与只读历史归档：

```sh
rtk proxy mkdir -p .work/review-stability/tmp
rtk proxy node hub/plugins/qcu-course-workbench/build.mjs
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy env \
  TMPDIR="$PWD/.work/review-stability/tmp" \
  QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source \
  QCU_COURSE_ARCHIVE=/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.2/qcu-course-workbench-0.1.0-pilot.1.2-88a55b22561a5f6cf1e7af8d27ad28d074df13db4feb4c9340fddd208f5ad0ec.tgz \
  QCU_MARKET_CLIENT_PATH="$PWD/hub/plugins/qcu-market/client.js" \
  QCU_MARKET_HOST_PATH="$PWD/hub/plugins/qcu-market/index.js" \
  node --experimental-transform-types --expose-internals \
  --experimental-loader ./tests/support/feishu-official-loader.mjs --test \
  tests/qcu-course-{core,client,market,stability,official}.test.mjs \
  tests/qcu-market-{status-stability,status-official,activation,unified,loop,direct-ui,refresh,teacher,catalog,client-scope,official,host-official}.test.mjs
```

启动真实共享 UI 的合成预览（不涉及模型或真实工作区；不要同时启动两个复用同一临时工作区的预览）：

```sh
rtk proxy env \
  TMPDIR="$PWD/.work/review-stability/tmp" \
  QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source \
  QCU_COURSE_PREVIEW_OUT="$PWD/.work/review-stability/preview" \
  node hub/plugins/qcu-course-workbench/preview.mjs --reuse-synthetic
```

首次不复用时去掉 `--reuse-synthetic`；程序输出 URL/PID。浏览器检查用该 URL 替换下例端口：

```sh
rtk proxy env \
  TMPDIR="$PWD/.work/review-stability/tmp" \
  QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source \
  QCU_BROWSER_EXECUTABLE=/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell \
  QCU_COURSE_PREVIEW_URL=http://127.0.0.1:53710 \
  node --test tests/qcu-course-editor-browser.test.mjs
rtk proxy node scripts/course-export-fixtures.mjs .work/review-stability/exports
rtk proxy env PYTHONDONTWRITEBYTECODE=1 \
  TMPDIR="$PWD/.work/review-stability/tmp" \
  QCU_COURSE_EXPORTS="$PWD/.work/review-stability/exports" \
  /Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python tests/test_course_exports.py
```
