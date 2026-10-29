# QCU 材料伴读 R1b 实施与本机验收

任务 `QCU-READING-R1B`，父任务 `qcu-standalone-learning-tools-20261029`。基线 `f9aebfceaf50559fc271f0d37176f9b1c31ab7d3`，分支 `dev/qcu-teacher-reading`。候选 `qcu-reading@0.1.0-pilot.2`，协议 2 / 存储 schema 2。基于首版增量实现，仍为默认停用的本地候选。

开发阶段完成实际代码、合成材料测试、生成 Client、可重建自包含 TGZ 与精确解包验收。源码由开发分支交付，实际提交及远端状态见固定产物中的 `evidence/SOURCE-COMMIT.json`。该开发阶段没有部署、访问 mini、安装到真实 DSH、调用真实模型或读取真实教师材料/Key；未改其他插件、Hub/市场容量、官方源码或 pilot.1 固定证据。原生 DSH 与教师真实使用验收仍未完成，不能将此报告当作原生通过。

## 原生安装进展（2026-10-29）

用户明确同意“安装，暂不启用”后，已通过本机现有 QCU 助手的官方“添加插件”安装 `qcu-reading@0.1.0-pilot.2`。目标为 `$HOME/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4.1`；官方 DSH **0.2.0-rc.2**，实际内置 Node **24.18.1 / arm64**。原先重复实例由用户正常退出，进程归零后才定向重开；未强退、替换 App、升级内核或复制 Key。

官方显示“已安装”，原生插件列表由 12 增至 13，伴读开关关闭，原有 12 个开关保持开启。安装后 **29/29 文件**与固定 TGZ 成员 SHA256、大小及正文完全一致；依赖清单仅新增 qcu-reading，原依赖引用均保留。原启用 bundle 清单完全不变、没有注册 qcu-reading，符合“安装但未启用”；默认 `.dsh` Home 未被安装。没有额外脚本授权、兼容性豁免或错误提示。安装前仅保存依赖清单与锁文件的私有基线，不含凭据或模型设置。

独立安装检查器起初错误地要求安装时也注册 bundle，修正为“仅新增依赖、启用清单不变”后通过；未为满足检查修改产品或用户配置。当前安装验证无失败项。**启用、组件加载、原生文件导入/导出、重开持久化、真实模型及教师效果仍未测**；用户要求暂不启用，本轮停在此状态。Hub/mini未发布，真实模型调用为0，R2未进入。

筛选证据：固定产物 `native-20261029/evidence/INSTALL-VERIFIED.json`、`RESTART-EXISTING-VERIFIED.json` 和 `NATIVE-STATUS.json`；该目录的《原生验收记录》保留工具故障与恢复过程。Home、Electron 数据、原始日志和模型设置是私有运行数据，不提交、打包或分享。以下“未安装/未测原生”的内容保留为开发阶段历史，以本节为最新安装状态；不能将单步安装通过写成原生全链路通过。

## 最终交付与独立验收

最终候选是 **ui-final**：`qcu-reading@0.1.0-pilot.2`，625,994 字节，SHA-256 `00b82faad5532f6a17a64d176620ae9ab0a6dc04d5d14662070575b93b9cf2a4`。固定产物根目录：`/Users/mcq/Artifacts/qcu-harness/0.1.0-reading.2/`，安装包在 `packages/`，报告与截图在该目录和 `screenshots/`；旧 release 仅是解析版快照，不作为本轮安装候选，未覆盖。

维护者用 **arm64 / Node v24.19.0** 对最终精确解包独立复跑：核心和二进制解析 **33/33**、官方 Host/Client 合成生命周期 **11/11**、实际 Chromium 完整流程 **1/1**、隔离离线包 **1/1**，共 **46/46**。逐成员与源码一致、重新打包字节一致。Node 25 执行器的历史证据继续保留，下面分节标明其实际范围，不代替本次最终包复跑。

另用可阅读的自编两页 PDF 和中文 DOCX 实际上传：PDF 第 2 页定位、Word 表 1 / 第 2 行 / 第 2 格 `250件` 出现在发送确认和实际模型输入、摘要默认收起、完整说明可展开、引用定位、摘录和 Markdown 下载均通过；实际查看明暗主题、桌面和 360px 截图。另独立验证原始字节 SHA、相同字节去重、移出修订排除/移入保留、schema 1 逐字节备份、旧摘录/问答/导出保留及重开；解析 worker 归零。所有调用均为合成适配器，付费云调用为 0，不将来源链路测试当作答案质量验收。

最终功能回归无失败项。Git 格式检查在两处保留的第三方内容报告空白：DOMMatrix 完整许可证的原始 CRLF/末尾空行，以及 saxes 生成包中 XML 字符集合的模板字符串制表符。已核对为上游内容，保持字节和 vendor 清单不变；精确排除这两个文件后，其他新增及修改文件的格式检查通过，不修改 Git 配置。维护者首次离线命令漏设自编夹具所需的 `QCU_OFFICIAL_DEPENDENCIES`，在夹具创建阶段失败；补齐已审核输入后同一用例通过，离线子进程仍明确禁止 SDK、开发目录、addons 和网络。该失败原始日志保留在固定证据中，不是产品解析失败。

详细证据见固定产物 `evidence/PARENT-FINAL-EXACT-CHECK.json`、`PARENT-BROWSER-CHECK.json`、`PARENT-FINAL-VALIDATION.json`、`PACKAGE-PARITY.json` 和 `parent-final-node24-*.log`。短步骤见 [本地验收清单](qcu-reading-r1b-checklist.md)。本机合成预览地址见 `preview/runtime.json`（本次 `http://127.0.0.1:55360`）；浏览器关闭后预览服务仍保留。原生 DSH 安装/启用/重开、系统文件选择器、真实教师迁移和真实模型均未测，Hub/mini 未部署。

以下保留实现与执行器分阶段证据。

## 实现与行为

- TXT/MD 沿用原有规范化文本 SHA-256、正文、段落位置与摘录/问答记录。
- PDF/DOCX 从选择文件的原始字节导入；Client 传普通文件名和有界规范 base64，Host 自行校验、计算原始字节 SHA-256 并解析，不接受 Client 的提取文本或位置。原始字节和提取文本的独立 SHA-256 都保存在工作区快照；列表/阅读/问答响应不夹带原始二进制。相同原始字节去重，同名变化产生新版本。
- PDF 按物理页和页内段落定位，无文字页仍占原页号并可见。自编夹具第 1 页英文、第 2 页中文/表格/公式、第 3 页图片、第 4 页空白、第 5 页文字，定位未前移。显示提取文本，不实现 PDF 视觉渲染；全篇无文字报告先做 OCR，编码资源不足有单独说明；图片、布局、公式、缺字和不完整页面带复核提示。
- DOCX 用命名空间 XML 事件解析正文和标题样式，保留章节路径、源段落以及表/行/格/格内段落；不创建 Word 固定页码。表格按真实单元格展开。外部超链接仅保留正文标签，未读取目标；图片、公式、批注、脚注、页眉/页脚、对象等遗漏明确提示。
- 上游复核的表格上下文缺口已修复：命中单元格时，优先补入同一行最近的另一格，各自保留准确 locator/文字并在发送前全部展示。每行只补一个相邻格、多命中去重，总计仍最多 4 段，每段 1800 字符。自编会计表问“盈亏平衡销量是多少？”实际确认包含标签与 `250件`，数值位于表 1 / 第 2 行 / 第 2 格。TXT/MD/PDF 的检索规则不变；这是确定性字词与邻格上下文，不能保证所有复杂表的语义完整。
- 修订按接受变更后的正文提取：保留 ins/moveTo，排除 del/moveFrom，并提示教师核对。DOCX 章节标题和正文在 Markdown 中均以不可逃出的文本围栏保留，避免原文 HTML 或反引号变成导出指令/格式。
- 格式与位置贯穿搜索、阅读、准备确认、模型片段、运行历史、引用点击和实际 Markdown 导出。确认继续绑定问题、文件版本、全部片段与模型策略，修改后失效；无命中、导入、导航、搜索、摘录和导出均不调用模型。只向模型发送确认的问题和片段，不默认发送原始字节或全文。未知引用继续标为待核对。

## 生命周期、边界与旧数据

解析在 worker thread 内运行：每工作区 1 个导入、每进程最多 2 个 worker，无无限队列；15 秒超时，128 MiB old heap / 16 MiB young heap / 4 MiB stack。取消、错误、超时和插件 dispose 都等待 worker 终止并释放名额，解析取消不保存材料。对先到的取消请求保留有界短期标记，拒绝晚到的同 ID 导入；原子替换前再次核对取消。已完成的原子提交与取消竞争时，以实际完成结果为准。

worker 是生命周期隔离，不是 OS 沙箱。Node heap 限制不能等同整个进程 RSS 上限；另有输入、提取输出、页/结构、解压实际输出和 PDF 解码分配上限。PDF 最多 2 MiB / 120 页 / 2000 单元 / 512 KiB 提取文本 / 40000 文本项，绘图操作单页最多 40000；图片全部跳过解码。PDF.js 的同步及 DecompressionStream 解压缓冲区均限制 8 MiB，累计解码分配 64 MiB。无 viewer/scripting，isEvalSupported:false；无网络 CMap、字体、Wasm 或外部资源加载。

DOCX 普通单卷 ZIP，最多 256 项、单项 2 MiB、总计 8 MiB、压缩率 100；在 inflate 前核对目录与本地头、重复/遍历/重叠/加密/尺寸。解压再受 maxOutputLength、实际长度、压缩输入消耗与 CRC 约束，不向路径解压。XML 拒绝 DTD/处理指令，限制深度 64、每 XML 80000 节点、文本/属性大小；表/行/格索引也有界。拒绝 DOC/DOCM、宏包、ZIP64、嵌套表格、损坏及不支持的结构，提示另存或拆分。

工作区总容量仍为 24 份材料、200 条摘录、50 次问答、8 MB，现包含 base64 原始字节。不增加删除/清理功能。协议 2 新增 importId、importStatus、cancelImport，扩大有界导入请求到 3000000 字符；Host/Client 必须同版本，混用拒绝。

schema 1 在内存校验后兼容为 schema 2；第一次写入前，先将原状态逐字节同步到 `.qcu-reading/state.schema1.<原状态SHA256>.json`，再原子写新状态。测试验证旧文档/ID/正文/notes/runs 原样保留、空闲重开不写文件、再次重开不重复备份、损坏/不一致/链接备份拒绝写入且不清空原状态。遗留 running 仍标为 interrupted，绝不恢复模型调用。测试为自编状态，未验证真实教师迁移。

回退：pilot.1 不识别 schema 2。必须先停用并另存完整 schema 2 状态，再由维护者把对应 schema 1 备份复制回 state.json；回退后首版看不到升级后新增的数据。不能直接启用 pilot.1 覆盖新状态。

## 依赖、构建与许可

运行时纯 JS 固定输入：PDF.js 6.3.289（Apache-2.0），saxes 6.0.0（ISC，含继承许可），xmlchars 2.2.0、@thednp/dommatrix 3.1.2（MIT），以及 PDF.js legacy 内嵌 core-js 3.50.0（MIT）。构建用已审核 esbuild 0.28.1；JSZip 3.10.1 只为测试生成自编 DOCX，不进入产品运行依赖。自编 PDF 的 CID/ToUnicode 字体仅测试文字映射，不包含商用/个人字体或视觉字形。

[Mozilla 安全通告](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)列出的补丁版本为 6.2.108。本版使用更高固定版本，同时关闭 eval、不初始化脚本/视图并限制本地资源；版本号本身不作为安全充分证明。

`vendor.mjs --stage` 只读取显式已有输入，无 npm 安装；记录全部输入版本/来源/文件 SHA-256、输出 SHA-256 和配方。默认 build 直接验证随源码保存的 vendor，完全不需要 SDK 路径。PDF.js 定点改动明确记录：移除可选原生 canvas 初始化，canvas 渲染抛错，图像大小门禁只报告遗漏并跳过解码，给同步/流式 DecodeStream 分配加限。真实 DOMMatrix 仅装在解析 worker，未修改 Host 全局。

完整许可在 [THIRD-PARTY-NOTICES.txt](../hub/plugins/qcu-reading/vendor/THIRD-PARTY-NOTICES.txt)，包括原 Mozilla 版权声明。saxes npm 输入缺失 LICENSE，已补充 [上游 v6.0.0 原文](https://raw.githubusercontent.com/lddubeau/saxes/v6.0.0/LICENSE)；内嵌 core-js 保留 [v3.50.0 许可](https://raw.githubusercontent.com/zloirock/core-js/v3.50.0/LICENSE)。这些仅是许可证文本补充，不引入新的运行依赖。

## 解析版交付（release，保留不覆盖）

- 包：`../.work/qcu-reading-r1b-package/release/qcu-reading-0.1.0-pilot.2-41890d03b0c2217ba414a7e9e559746c0474860bea910e0ee6a0f77beff2a44b.tgz`
- 大小 **624694 字节（约 610 KiB）**，低于 1 MiB；SHA-256 `41890d03b0c2217ba414a7e9e559746c0474860bea910e0ee6a0f77beff2a44b`。
- 共 29 个成员，逐一与当前源码、成员 SHA-256、类型、路径和固定元数据比对；`release-rebuilt/` 的 TGZ、MANIFEST.json、SHA256SUMS 逐字节一致。
- 生成的 lazy-CJS Client 为 **50215 字节**，仅共享宿主 React；PDF/XML 解析代码留在 Host。
- 精确解包：`../.work/qcu-reading-r1b-package/release-unpacked/package/`。Python 仅用于维护者打包；教师运行不需要 Python、Docker、native canvas、解析服务器、运行时 npm 下载或网络字体。

源码修改范围：`hub/plugins/qcu-reading/`（Host/Client/store/协议/导出/解析 worker/ZIP/XML、vendor 及配方/许可/构建打包/README）、新增 binary/package 测试和自编夹具、扩展原 official/browser 测试、根 README 候选入口、本报告及 roadmap 当前状态。model.mjs、plugin.mjs、其他插件、官方源码和既有 R1a 报告均未改。任务稿及上游复核文件保留原样；工作回执由上游负责，本执行器交付本报告和验证证据。

具体改动文件：

- 新增 `src/parser.mjs`、`src/parser-worker.mjs`、`src/zip.mjs`、`src/source.mjs`：worker 生命周期、实际 PDF/XML 解析、ZIP 预检与源身份/位置校验。
- 修改 `index.js`、`src/{protocol,store,dispatch,controller,view,reports}.mjs` 和生成的 `client.js`：协议、schema 兼容、导入取消、位置展示、确认/引用和导出。
- 新增 `vendor.mjs`、`vendor-inputs/{saxes,core-js}-LICENSE.txt`、`vendor/{pdf,pdf.worker,xml,dommatrix}.mjs`、vendor 清单和完整许可；修改 `build.mjs`、`pack.py`、`preview.mjs`、`package.json` 及插件 README。
- 新增 `tests/qcu-reading-binary.test.mjs`、`tests/qcu-reading-package.test.mjs`、`tests/fixtures/qcu-reading-binary.mjs`；修改 `tests/qcu-reading-{official,browser}.test.mjs`。原 core 测试与材料保持不变。
- 修改根 README 的候选入口与 `docs/qcu-standalone-learning-plan.md` 当前进度；新增本报告。

## 验证结果与复现

本机 Apple Silicon / Node v25.8.1。最终精确 TGZ 解包后：

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原核心回归 | 17/17 | release-core.log |
| 新增解析/安全/迁移/取消/表格/修订/导出 | 16/16 | release-binary.log |
| 官方 Cordis/Typert/合成 LLM 与生成 Client 生命周期 | 11/11 | release-official.log |
| 实际浏览器完整流程、明暗/360px、上传/引用/确认/下载 | 1/1 | release-browser.log、对应 EVIDENCE.json |
| 精确包成员 + 无开发依赖/原生扩展/网络的离线子进程 | 1/1 | release-offline.log、OFFLINE-EVIDENCE.json |

最终汇总证据：[RELEASE-EVIDENCE.json](../.work/qcu-reading-r1b-validation/RELEASE-EVIDENCE.json)。本轮精确包共 46 项通过。实际浏览器证据：[EVIDENCE.json](../.work/qcu-reading-r1b-browser-release/run-yTcIhq/EVIDENCE.json)，包含 13 张截图及实际 MD/PDF/DOCX/会计表 Markdown 下载物；已实际查看最终桌面/360px 会计表确认页、DOCX 暗色与 PDF 页位截图。任务创建的 8 个测试服务 PID 均已确认退出，未停止 pilot.1 父级预览。

日志、命令、退出状态、Node/架构和 packageRoot 保存在 `../.work/qcu-reading-r1b-validation/release-*.{json,log}`；逐字节重建证据为 RELEASE-REPRODUCIBLE.json。离线测试不是“开发环境碰巧缺包”：子进程用 Node permissions 只允许读取/写入隔离解包目录，明确断言 SDK/浏览器依赖不可读，addons/net 禁止，并清空依赖相关环境、关闭 global module 搜索；实际执行默认 build、PDF/DOCX 原始字节导入和持久化重开。

复现前，设置 QCU_OFFICIAL_DEPENDENCIES 和 QCU_BROWSER_DEPENDENCIES 为已有审核目录（完整环境说明见插件 README），不用下载：

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk python3 hub/plugins/qcu-reading/pack.py <新的输出目录>
rtk node --test tests/qcu-reading-core.test.mjs
rtk node --test tests/qcu-reading-binary.test.mjs
rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
rtk node --test tests/qcu-reading-browser.test.mjs
QCU_READING_PACKAGE_DIR=.work/qcu-reading-r1b-package/release rtk node --test tests/qcu-reading-package.test.mjs
```

精确解包回归时再设置 QCU_READING_PACKAGE_ROOT 为上述 release-unpacked/package 的绝对路径。浏览器测试使用一次性 Chromium 配置，仅监听 127.0.0.1，并拒绝外部请求；已按环境要求申请本机监听/测试浏览器权限后完成，不依赖个人浏览器配置。历史失败测试目录仅为调试证据，最终认可本报告所列 release 结果。

## 限制与待后续验收

- PDF 复杂编码、多栏、图表和公式无法保证完整；本版是提取文本，不提供 PDF 视觉渲染或 OCR。图像均跳过，局部遗漏需对照原件核对。
- DOCX 不导入图片、公式、脚注、批注、页眉/页脚或嵌入对象；不支持 DOC/DOCM、加密、ZIP64、嵌套表格和任意复杂排版。邻格检索在 4 段预算内优先提供同一行上下文，不等于表格语义理解。
- 容量、压缩率和结构门禁可能拒绝正常但过于复杂的材料，应拆分或重新导出；不会默默扩大 Hub 包容量。
- 未做真实教师数据迁移、真实文件选择器、原生 DSH 安装/启用/重开、真实模型调用或教师教学效果验收；合成模型结果仅验证流程与来源一致性。原生支持下限也须在目标 DSH 自带 Node 版本上复核，最终候选已另测 arm64 / Node24，执行器阶段为 Node25；仍不将开发机 Node 测试等同目标 DSH 原生通过。
- 用户后续短验收：用自编 PDF 核对空白/图片页后的物理页号，用自编 DOCX 问表中数值并检查确认片段，发送后点击引用、重开并下载 Markdown。安装、真实模型和实际材料发送仍需后续授权。

## 紧凑提取提示复核（ui-final）

本轮只完成 `.ai/tasks/QCU-READING-R1B-PARENT-REVIEW.md` 第 3 项。父级独立源码检查见 `/private/tmp/qcu-reading-r1b/PARENT-FINAL-SOURCE-CHECK.json`：PDF 物理页、中文同一行 250件、移出修订排除、原件 hash、首版逐字节备份和旧记录重开已通过。本轮没有扩展或修改解析、检索、schema、模型确认或导出实现。

阅读区和发送前确认区的提取提示改为一条可见摘要：图片/公式等已知未提取内容按类别简短显示，PDF 无文字页数量保留，缺字风险仍显式提示。“完整提取说明”默认收起，原有每项类型/页位说明完整保留，可用键盘展开/收起。PDF 正文每个无文字页标记仍然可见，实际片段、模型和逐次发送确认仍直接显示；历史与 Markdown 不减少说明。

只修改 `src/view.mjs`、生成的 `client.js`、插件 README、相关 browser 断言及本报告。逐成员对照 release，包内仅 view、client 和 README 三项变化，其余 26 个成员字节相同。旧 release TGZ 的 SHA-256 仍为 `41890d03b0c2217ba414a7e9e559746c0474860bea910e0ee6a0f77beff2a44b`，未覆盖。

新包：`.work/qcu-reading-r1b-package/ui-final/qcu-reading-0.1.0-pilot.2-00b82faad5532f6a17a64d176620ae9ab0a6dc04d5d14662070575b93b9cf2a4.tgz`，**625994 字节**，29 个成员；SHA-256 `00b82faad5532f6a17a64d176620ae9ab0a6dc04d5d14662070575b93b9cf2a4`。同级有逐成员 MANIFEST.json 与 SHA256SUMS；`ui-final-rebuilt/` 逐字节一致。生成 Client **51937 字节**；版本、协议与 schema 仍为 pilot.2 / 2 / 2。

精确包验证目录 `ui-final-unpacked/package/`；本轮仅按 UI 影响运行相关验证，不把旧解析用例声称为本轮重新全跑：

- 源码浏览器完整流程 1/1；官方生成 Client 远程挂载/main/sidebar/卸载生命周期 1/1。
- 精确包官方 Client 生命周期 1/1；精确包浏览器完整流程 1/1；逐成员及隔离离线包测试 1/1。
- 浏览器新增断言：360px 多种遗漏的收起区高度不超过 110px，正文出现在初始阅读视区；键盘展开后完整 7 项说明可读，确认区保持同一组说明；PDF 实际无文字页标记保留；每项说明仍在实际下载的 PDF/DOCX Markdown 中；展开/收起不新增模型调用。原有格式、来源、250件、模型确认、引用、持久化、取消、主题和字号检查保持。

构建与本轮检查命令（依赖目录沿用前文已有审核环境）：

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk python3 hub/plugins/qcu-reading/pack.py .work/qcu-reading-r1b-package/ui-final
rtk python3 hub/plugins/qcu-reading/pack.py .work/qcu-reading-r1b-package/ui-final-rebuilt
rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test --test-name-pattern='official Client remote mounts' tests/qcu-reading-official.test.mjs
rtk node --test tests/qcu-reading-browser.test.mjs
QCU_READING_PACKAGE_DIR=.work/qcu-reading-r1b-package/ui-final rtk node --test tests/qcu-reading-package.test.mjs
```

精确包的 Client 与浏览器检查设置 `QCU_READING_PACKAGE_ROOT` 指向上述 ui-final-unpacked/package 绝对目录。命令、退出状态及日志为 `.work/qcu-reading-r1b-validation/ui-{source,final}-*.{json,log}`；成员与范围核验见 UI-FINAL-PACKAGE.json。原生 DSH、真实模型和教师使用验收仍待后续；该次 UI 执行器不提交或推送；上游最终交付状态见开头，仍未部署或读取真实材料。

最终 UI 证据：[UI-FINAL-EVIDENCE.json](../.work/qcu-reading-r1b-validation/UI-FINAL-EVIDENCE.json)；[实际浏览器记录](../.work/qcu-reading-r1b-browser-ui-final/run-26GrvJ/EVIDENCE.json)。已实际查看精确包的 360px [收起](../.work/qcu-reading-r1b-browser-ui-final/run-26GrvJ/docx-notices-collapsed-360.png)与[展开](../.work/qcu-reading-r1b-browser-ui-final/run-26GrvJ/docx-notices-expanded-360.png)截图。源码与精确包两次测试所建服务均已退出；父级原预览未停止。
