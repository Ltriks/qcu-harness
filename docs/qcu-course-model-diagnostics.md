# Course Studio 模型失败诊断修复

任务 `QCU-COURSE-MODEL-DIAGNOSTICS`，2026-10-19。工作台候选为 `0.1.0-pilot.1.1`；仅本地实现和离线验证，未发布、安装、部署或调用真实模型。

## 已知缺陷与未知原因

[现场记录](qcu-market-p12-deployment.md)中的单次合成百分比课真实模型验收失败，没有预览或保存成功。原 `createGenerator` 将所有非 stop、缺少 finish 和异常内容块合并为 `model-incomplete`，持久化也只保留少量提示码。这是确定的诊断缺陷，现有证据无法还原当次结束原因；不能认定令牌上限、组件过多、Key、网络或模型兼容性问题。历史失败不回填诊断、不改写原因码，界面明确说“具体原因未记录”。

本次读取本机已审计官方依赖 `packages/llm/llm/src/{types.ts,index.ts,assembler.ts,adapter-failure.ts,error.ts}` 与 `packages/llm/llm-deepseek/src/transport.ts`：finish 区分 stop、tool-calls、max-tokens、aborted、error；适配器抛错会被官方 `LlmRuntime` 转为 error/aborted finish，流中间件或消费异常仍可能抛出。`BlockAssembler.finish` 缺省值是 stop，因此插件必须自己确认实际收到 finish，不能用该缺省值证明完整结束。

## 实现与安全契约

`index.js` 仍绑定教师确认的模型路由、只发一次请求、`tools:[]`、`maxTokens:12000`，保留序列化流 1,500,000 字符与组装文本 180,000 字符上限。仍要求 stop、支持的内容块、有效 JSON，以及 store 中完整的 `parseDraft` 校验；失败不接受部分草案，也不能预览或保存。未调整预算、参考内容、路由或重试策略。取消、超时、停用与晚到结果的既有优先级、请求幂等和独立确认不变。收到 terminal stop 后的任何后续块（含第二个 finish）在处理前按 `model-stream-failed` 拒绝，不能把终止后拼出的有效 JSON 接受为草案。

| 固定原因码 | 含义 |
| --- | --- |
| model-max-tokens | 模型报告输出令牌上限 |
| model-provider-error | 模型服务报告错误；底层原因未知 |
| model-provider-aborted | 模型服务报告中止，本地未取消 |
| model-missing-finish | 流正常遍历结束但未收到 finish |
| model-unknown-finish | finish 原因不在已知集合，不保留原值 |
| model-unexpected-blocks | 工具结束或不支持的内容块 |
| invalid-model-json | 响应无法解析为 JSON |
| output-too-large | 超过既有本地输出上限 |
| model-stream-failed | 流读取、处理或清理抛错，或 stop 后仍有块；底层原因未知 |

失败任务可选的 `diagnostic` 只包含以下字段：

- `stage`：stream / assembly / json，表示检测到失败的本地处理阶段。
- `reason`：上表固定原因码，须与任务 message 一致。
- `finishKind`：stop / tool-calls / max-tokens / aborted / error / missing / unknown。missing 表示检测失败时尚未收到 finish，不等于预测提供方之后会不会发送。
- `chunks`、`textChars`、`reasoningChars`、`streamChars`：0 至 1,000,000,000 的安全整数，采集时饱和，边界拒绝无效值。
- `outputBudget`：固定 12000。
- 可选 `failureCode`：仅接受精确白名单 AUTH / QUOTA / RATE_LIMIT / INVALID_REQUEST / SERVER / CONTEXT_WINDOW_EXCEEDED / ABORTED / UNKNOWN；未知、恶意、非字符串或大小写不同的值丢弃，旧记录没有此字段仍可读取。只从 error/aborted finish 的 failure.code 或抛出流错误的自有数据属性 code 读取，不解析 message/status/detail，不执行 code getter。

文字和推理计数是接收到的 delta 及 block-end 文字字段长度之和；若协议同时发送两者，会重复计数。`streamChars` 沿用原 JSON 序列化长度口径，均为 JS 字符串 UTF-16 单元计数，不是字节、token、计费或最终草案长度。

`protocol.mjs` 的 `safeDiagnostic` 在持久化、task/snapshot/幂等响应与界面边界重建白名单字段，额外字段丢弃，非法枚举、负数、非整数、非有限值、越界值或错误预算拒绝。仅 failed 任务携带有效诊断，重载后沿用已记录值；旧记录缺失时保持缺失，不合成诊断。可选标准码在 store/transport/render 边界再次逐值白名单筛选，仅用于 provider-error/error、provider-aborted/aborted 或 stream-failed 诊断；不适用的场景丢弃该字段。只保留该码，整个 failure/replay payload 都不进入诊断。标准码是观测到的分类，不能证明外部根因；例如 AUTH 不等于已确认某个 Key 失效，错误的底层原因仍未知。原始错误 message、stack、URL、headers、凭据、引用、提示词、响应正文和推理正文均不会随失败诊断保存或传输。

`view.mjs` 提供逐原因中英提示；未知旧码也诚实显示未记录原因，不渲染任意原始码。技术枚举与计数放在默认关闭的 `<details>` 内，以有标签的字段展示，无原始 JSON 或 failure dump。标准失败码也只在折叠详情显示，并注明“仅分类”；字符计数明确提醒 delta 和 block-end 可能重复，不是实际 token 用量。controller 未新增生成入口；浏览失败、导航、重连与原任务核对只读取状态。已重建 lazy-CJS `client.js`。

## 修改范围与不可变发布

业务修改限工作台 `index.js`、`src/{protocol,store,view}.mjs` 及构建产物；候选版本同步到 package、protocol、packer、官方测试期望与工作台 README。四个 course 测试文件补充回归。

市场归档测试改为将已发布 1.0 的每个归档成员与目录中固定 Git revision 比较，而非与正在开发的工作树比较；保留完整成员集合、禁止重复/路径穿越/链接、manifest 身份/版本、disabled 配置、Skill 摘要、整包大小与 SHA256 校验。市场 catalog、发行 pins、已发布 manifest、旧 TGZ 和部署记录均未修改。

## 离线验证结果

全部使用现有依赖和合成适配器，无网络、凭据、依赖下载或真实 LLM 请求。以下命令均退出 0：

```sh
rtk proxy node hub/plugins/qcu-course-workbench/build.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --test tests/qcu-course-core.test.mjs tests/qcu-course-client.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-course-official.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_COURSE_ARCHIVE=/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1/qcu-course-workbench-0.1.0-pilot.1.0-0992fe07e1699545d4e94682e9d6f8b424a27199348e3a3e7e9f0a6600e84f4a.tgz node --test tests/qcu-course-market.test.mjs
rtk git diff --check
```

- core/client：17 项通过，包含可选标准失败码的精确值/适用场景筛选、缺少字段的旧记录兼容、注入字段清除、非法计数/枚举拒绝、历史失败读取、重载、取消/超时/停用与晚到结果，以及构建产物的双语原因提示、折叠诊断、敏感内容不泄漏、只读重连/核对。
- 官方服务：21 项通过（含 16 种失败场景子测试）。真实官方 Cordis/Typert/LlmRuntime/BlockAssembler 配合合成适配器：stop 成功；max-tokens；适配器抛错；error/aborted finish；缺失/未知 finish；工具块/工具结束；坏 JSON；两个输出上限；流包装层抛错（含抛出 undefined 的边界）；stop 后追加文字（空格仍可组成有效 JSON）和重复 finish。失败携带恶意敏感 payload，验证无草案、无法保存、原因持久化、Host 重载及 snapshot 传输、一适配器调用和幂等重放不重试。复用上述案例验证官方 LlmError 的 AUTH、error finish 的 RATE_LIMIT、abort finish 的 ABORTED、流抛错的 INVALID_REQUEST，以及恶意未知码被清除，全部跨 Host 重载保留准确的可选字段。
- 已发布归档与市场契约：3 项通过，1.0 的 43866 字节与 `0992fe07…e84f4a` 摘要保持一致，所有成员匹配固定 Git 源。
- 构建成功，`client.js` 为 61627 字节。另以内存调用现有 `pack.py.build` 两次，验证 1.1 的 13 个成员和确定性字节，不写新 TGZ 或 MANIFEST。
- 官方测试只有 Node experimental loader/type-transform 提示，无测试失败。

## 待父线程与现场验收

本轮已落实父线程审阅的可选标准失败码与严格 terminal finish 两项修正。父线程反馈已完成 1120/360、明暗主题及三类错误的 Chromium 截图且无外部请求，此为父线程提供的证据，本实现线程未重复执行。父线程仍需审阅最终差异、重跑修改后的浏览器/原生面板诊断显示检查、在全新产物目录打包候选并核对摘要。安装、启用和真实生成仍分别按既有确认执行；获新的真实调用授权后才能验证真实模型、预览、修订与保存链路，再由教师核对内容并在目标 Office 检查成果。此次不能据合成测试声称原失败原因已查明、真实模型成功、原生验收通过或已部署。

## 本轮最终独立复核

父线程完成源码差异审阅后，直接从新 TGZ 提取 Host/Client 运行官方服务测试，连同 core/client 和已发布 1.0 市场契约，共 **41 项通过、0 失败、0 跳过**。官方运行时为 21 项（含 16 个失败场景子测试），core/client 为 17 项，旧发行与市场契约为 3 项。候选 13 个普通文件逐成员与最终源码一致，未改动官方依赖。

新候选包 `qcu-course-workbench-0.1.0-pilot.1.1-1efbcbc855a3f49cf79598f261fcb0efb52eea10ed31ce4070e89f1d87d7af04.tgz`：**47357 字节**，SHA256 `1efbcbc855a3f49cf79598f261fcb0efb52eea10ed31ce4070e89f1d87d7af04`。新包保持默认禁用，未增加依赖或安装脚本；市场目录仍指向原 1.0，不代表已对教师发布本候选。

本地已安装 Chromium 1234 实际渲染三类状态：输出上限、服务错误、旧版原因未记录。中英文切换、默认折叠/展开、标准码仅折叠详情内显示、1120/360 CSS 像素和暗亮主题检查通过；12 张合成截图已保存，目视检查宽屏和窄屏页面。没有横向溢出、页面异常、外部请求或生成操作。此检查针对共享源视图，构建 Client 另经官方 keyed slot 与真实 React 测试；不能代替原生 DSH 和真实模型验收。测试脚本先后修正了本机缓存浏览器版本定位和中文切换后的英文状态定位，最终成功结果见 RESULT.json。

候选包、MANIFEST、成员校验、测试日志、浏览器结果与截图位置：`/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.1/`。原 1.0 和市场 P12.1 的固定包、Hub 快照及 mini Home 均未修改。本轮未触发真实模型调用，无新增模型费用验收。

下一步现场复核：发布一个新的审核目录/市场发行引用此固定候选；经官方安装确认安装并按需正常重开。先打开旧失败任务，应显示“具体原因未记录”，不能补造原因；再用同一自编百分比资料，经用户重新确认后只生成一次。失败时保留任务并展开技术诊断，根据实际标准分类继续排查；成功才继续预览、修订、保存及目标 Office 检查。安装、启用、资料发送与保存的既有确认分别保留。
