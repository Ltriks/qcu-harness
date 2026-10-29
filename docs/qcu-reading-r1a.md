# QCU 材料伴读 R1a 实施报告

任务：`QCU-READING-R1A`；父任务：`qcu-standalone-learning-tools-20261029`。候选版本 `qcu-reading@0.1.0-pilot.1`，基于 [演进计划](qcu-standalone-learning-plan.md)。本报告供父任务审查与接续；无提交、推送、部署、原生安装或真实付费模型调用。

## 已实现

- 独立 Cordis / Typert Host 与官方 remote Client；sidebar / main / connection-reset / dispose 生命周期。生成的 lazy-CJS Client 共用宿主 React；精确固定 Cordis 4.0.4 / DSH 0.2.0-rc.2 peers。
- UTF-8 TXT / Markdown 文件字节导入，浏览器 fatal TextDecoder；Host 再验名称、扩展名、内容与字节上限。不接收文件路径，不改原件。PDF / DOCX / OCR 明确显示尚不支持。
- 工作区 `.qcu-reading/state.json` 本地快照，内容 SHA-256 身份、稳定段落与字符区间、同内容去重和同名不同版本区分。工作区只取自 `workspaceRegistry`；存储链接、损坏文件及容量异常拒绝继续。
- 原文三栏、窄屏原文 / 问答切换、可收起材料列表；中文相邻双字 / 英文单词的确定性检索，最多 20 处命中。点击结果、合法引用显示选中段落并滚动。连续原文摘录与笔记保存，重开保留。
- 问题准备最多取 4 个实际来源，每段最多 1800 字符，长段落显示“节选”。无命中不解析模型、不生成。逐次确认显示真实模型、提供方、完整策略、问题与所有完整待发片段；修改问题或切换文档 / 工作区即失效。
- 确认绑定不可变来源 / 问题 / 文档 / 模型策略并限时；启动重新核对模型、幂等重放不重复生成。每工作区最多一个调用，调用前保存运行记录；取消、60 秒超时或停用发出中止信号，未自动重试。重开遗留运行记录标为中断。
- 通过官方 `llm` / `agentDefaultModel` 使用默认模型，优先 low、其次 off、否则展示宿主默认，2000-token 输出上限且无工具。只发确认过的问题和来源；输出达到上限或异常结束不当作成功，保留已收到的部分文字并标为不完整。
- 仅本次快照中的 `[S1]` 等引用可点击；未知 / 缺失引用显示来源待核对。历史保留来源文本与映射；导出含版本、问题、精确来源、模型策略、状态、回答和教师复核标识，导出不调用模型。界面按纯文本渲染；Markdown 导出以动态长度代码围栏保存原样片段，材料中的 HTML、链接和嵌套围栏仍显示为文字。
- 24 份材料、每份 256 KiB / 2000 段、200 条摘录、50 次问答、合计 8 MB 的硬限制。不自动清理，写入失败阻止继续付费调用。
- 合成预览与产品共用 view、controller、dispatch 和真实磁盘 store；无预置成功页、外部模型或网络资源。明暗主题含显式 `data-theme`；字体沿用宿主 `--dsh-content-font-size` 与字体族。

## 修改范围

全部实现位于 `hub/plugins/qcu-reading/`：`index.js`、`src/{protocol,reports,store,model,dispatch,controller,view,plugin}.mjs`、生成的 `client.js`、`build.mjs`、`preview.mjs`、`package.json`、`cordis.patch.yml`、`pack.py`、`README.md`、`LICENSE`。

新增 `tests/qcu-reading-core.test.mjs`、`tests/qcu-reading-official.test.mjs`、`tests/qcu-reading-browser.test.mjs` 和唯一自编材料 `tests/fixtures/qcu-reading-material.md`，以及本报告。现有插件、upstream、Hub 目录及用户预先提供的任务稿和计划均未修改。没有新依赖。

## 验证结果

| 层级 | 结果 | 主要覆盖 |
| --- | --- | --- |
| 核心 Node | 17 / 17 通过 | 实际 IO、重开、内容版本、定位、精确节选、非法输入、UTF-8、符号 / 硬链接、隔离、容量、无命中 0 调用、确认绑定 / 过期、模型和策略变更、幂等、取消 / 超时 / 停用、前后写入失败、部分结果及导出 |
| 官方运行时 | 10 / 10 通过 | 真实 Cordis / Typert gateway、官方 LLM 合成 adapter、精确 messages 和策略、无工具、路由变更 0 调用、max-tokens / 异常结束失败、取消信号、规范化路径别名共用单调用限制、remote 挂载 / 撤销和实际生成的 Client slots |
| 真实无头浏览器 | 1 条完整验收流程通过 | 实际文件字节上传→搜索→定位→摘录→刷新→去重→无命中→逐次确认 / Escape / 键盘→问答→合法 / 未知引用→实际下载；1280 / 360px、显式明暗、18px 宿主字号、长文件名 / 文本、取消 / 失败、外部请求 0、页面错误 0 |
| Client 构建 | 通过 | `build.mjs` 生成且 VM 校验 lazy-CJS，包包含 `client.js` |
| 包 | 见下方产物记录 | 固定白名单、时间戳、顺序及 gzip 元数据；重建字节一致，不含材料、依赖或浏览器配置 |

核心测试命令：

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk node --test tests/qcu-reading-core.test.mjs
QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_BROWSER_DEPENDENCIES=/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node rtk node --test tests/qcu-reading-browser.test.mjs
```

浏览器测试首次因沙箱禁止环回监听返回 EPERM，获准在本机运行后通过；测试曾发现并修正文本域标签在输入后变化的问题。截图检查后修正搜索按钮换行，并复测。官方测试仅有 Node loader / transform-types 的实验性警告，最终无失败项。

浏览器证据保存于 `.work/qcu-reading-browser/run-*/EVIDENCE.json`，同目录包含明暗 / 窄屏截图、确认页截图与实际下载的 `answer.md`；每次测试均独立目录。测试使用一次性 Chromium 配置，结束后服务和浏览器均关闭。

最终浏览器证据：[EVIDENCE.json](../.work/qcu-reading-browser/run-g3wf7F/EVIDENCE.json)。已实际查看桌面、360px 明暗和窄屏确认页截图。生成的 `client.js` 为 40,392 字节。

### 本地包产物

- TGZ：`.work/qcu-reading-package/verified/qcu-reading-0.1.0-pilot.1-6252d985b40f7fc0e898aa95d0e4194063d282861881e7740f778fbf46265af2.tgz`
- SHA-256：`6252d985b40f7fc0e898aa95d0e4194063d282861881e7740f778fbf46265af2`
- 大小 36,257 字节，15 个固定成员；`verified/` 同目录有 `MANIFEST.json` 与 `SHA256SUMS`。
- 第二输出目录 `verified-rebuilt/` 的包及清单逐字节一致。成员类型 / 路径 / mtime / SHA-256 均核对，证据在 `.work/qcu-reading-package/VERIFIED-EVIDENCE.json`。
- 解包到 `.work/qcu-reading-package/verified-unpacked/package` 后，以 `QCU_READING_PACKAGE_ROOT` 指向该目录重跑：核心 17 / 17、官方运行时 10 / 10 通过，包含包内实际 `client.js`。
- 首次临时解包核验使用了系统 Python 不支持的 `tarfile.extractall(filter=...)`，因此依赖该次解包的测试未启动；核验改用逐项校验白名单后写入，最终两次构建及上述解包回归全部通过。插件与 `pack.py` 没有此 Python 版本问题。

重建命令为 `rtk python3 hub/plugins/qcu-reading/pack.py <新的输出目录>`，应先运行 Client 构建。产物仅在本工作树 `.work/`，未写入外部发布目录、Hub 或任何已安装环境。

## 父任务可执行的预览与短验收

```sh
QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source rtk node hub/plugins/qcu-reading/preview.mjs
```

控制台输出 `http://127.0.0.1:<port>`；预览固定使用合成模型与本地预览工作区。Ctrl-C 停止；换用新的 `QCU_READING_PREVIEW_OUT` 可从空工作区开始。父任务不必安装依赖。

1. 导入自编测试材料，搜索“有效反馈”，点 `p0003`；应高亮并滚动。
2. 保存该段的一部分和笔记，刷新；摘录应保留。同内容换名导入应仍只有一份。
3. 用“宇宙星系”准备问题；应提示无匹配来源，不生成。
4. 提问“有效反馈如何帮助学习”，核对所示模型、问题和完整片段；未勾选前不能发送，Escape 可取消，改问题后须重新确认。
5. 确认后点击回答中的 `[S1]`；应回到正确版本的段落。导出 Markdown，应含文档 SHA-256、实际片段、模型策略和草案标识。
6. 问题附加 `[合成等待]` 后确认并取消；附加 `[合成失败]` 后确认；两者须显示不完整。`[未知引用]` 产生 `[S99]`，只能显示待核对，不能成为可点击来源。
7. 切换主题 / 字号并在 360px 查看“原文 / 问答”与完整确认页；页面不应水平溢出。

## 限制与待验收

- 本轮交付为 TXT / Markdown 可用切片；没有 PDF、DOCX、OCR、多文档语义检索、删除清理或学生画像。
- 中文双字匹配可能漏掉同义表达或匹配公共词，不是语义理解，也不能自动证明材料支持某一论断。
- 来源存在只证明可定位，模型正确性和教学适用性须由教师复核。材料指令被作为不可信数据发送给模型，无法保证模型永不受提示注入影响；客户端不会执行任何材料或模型代码。
- 合成 adapter / 浏览器通过不等于真实模型、真实原生 DSH 安装或原生文件选择器通过。父任务后续单独审核候选、安装 / 启用及真实模型逐次发送；本轮没有这些外部动作。
- 取消和超时会中止本地等待并传递官方信号，不保证提供方立刻停止远端计算或计费。
- 保存采用现有 Node 文件 API 的有界读写、链接校验和原子替换，不提供跨进程协同编辑锁；应由单一 DSH 实例维护同一工作区的存储。容量满时保留现有数据并提示另选工作区。


## 父级复核与固定交付（2026-10-29）

父级独立复跑核心17/17、官方运行时10/10、完整真实浏览器流程1/1通过。额外以自编成本会计材料实际完成导入、检索、摘录、逐次确认与来源定位；默认14px、明暗和360px截图已复核，外部请求0、页面错误0。包全部15个成员与审阅源码逐字节一致，SHA256和36,257字节大小与上方候选相同。现有业务模块与官方源码未改。

交付根目录 `$HOME/Artifacts/qcu-harness/0.1.0-reading.1/`：`packages/`为固定TGZ与清单，`screenshots/`为默认字号实际流程截图，`evidence/`为父级测试与包核验，`cases/`为无个人数据的自编材料，`验收说明.md`为快速步骤。源码及任务在专属开发分支，目录位置与计划见README。

本轮仅本地候选；原生应用/安装器/文件选择、真实模型和教师效果均未测，不发布Hub或mini。不将CLI执行器曾出现的容量中断、早期检查器错误混作产品已通过或产品故障。
