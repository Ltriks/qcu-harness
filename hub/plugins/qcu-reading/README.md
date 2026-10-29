# QCU 材料伴读 R1a

`qcu-reading@0.1.0-pilot.1`，独立 DSH Host / Client 候选插件，默认不启用。只使用现有官方 Cordis 4.0.4 与 DSH 0.2.0-rc.2 服务；没有新增依赖，不访问或保存 API Key。尚未加入 Hub 目录，也未安装、部署或做真实模型验收。

支持 UTF-8 `.txt` / `.md`（Markdown 以纯文本显示），每份最多 256 KiB。PDF、DOCX、扫描件 OCR 尚不支持。通过文件选择器传入名称和内容；Host 不打开客户端文件路径，不修改原件。

## 使用

1. 选择 DSH 工作区，导入一份自编 TXT / Markdown。
2. 输入原文关键词，点击搜索结果或段落标记定位。中文以相邻双字、英文以单词作确定性匹配，不作语义检索；最多显示 20 处，可能漏掉同义词或命中共同字词。
3. 选择段落，将摘录文字保留为原段落中连续的一部分，添加笔记并保存。
4. 输入问题，点“准备问答”。找不到原文时不调用模型。命中后显示本次实际模型、提供方、推理策略、问题与完整片段。
5. 勾选本次发送并点“确认发送”。引用 `[S1]` 等只有属于本次来源快照才可点击；缺失或未知引用标为来源待核对。引用存在不证明推理正确。
6. 可取消问答，或导出标有“教师审阅草案”的 Markdown，含文档身份、版本、精确片段、问题、模型策略、状态与回答。不完整记录始终保留不完整标识。

## 存储与调用边界

仅用 `workspaceRegistry` 解析工作区，在 `.qcu-reading/state.json` 保存快照、摘录与问答。BOM 和换行规范化后计算完整 SHA-256；同内容不重复，同名不同内容保留独立版本，定位符是该版本中的稳定段落编号和字符区间。原件移动不影响已保存内容。

固定容量：24 份材料、每份 2000 段、200 条摘录、50 次问答、共 8 MB；任一上限先到即停止新增。本版不提供删除或自动清理，可另选工作区。IO 拒绝符号链接存储目录、符号/硬链接状态文件、被替换的存储目录和过大/损坏快照，以独占临时文件、同步、原子替换保存。

导入、浏览、搜索、摘录、导航和导出不调用模型。准备只读取默认模型及能力信息；生成请求只发送已确认的问题与最多 4 段、每段最多 1800 字符的实际来源节选。确认绑定文档、问题、片段和完整模型策略，10 分钟过期。调用前再核对默认模型，优先使用 low、其次 off，输出预算 2000 tokens；无工具、无自动重试、每工作区最多一个活动调用，60 秒超时并发出中止信号。能否即时停止提供方计费取决于官方适配器/提供方对取消的支持。

先持久化运行状态再生成，随后保存终态。重开将遗留运行状态标为中断，不恢复调用；保存失败阻止继续付费调用。源材料与模型输出均按纯文本渲染，任何材料指令、HTML、脚本均不执行。

## 本地构建与合成预览

不需要下载依赖。以下环境变量应指向已审核的现有目录：

```sh
export QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
export QCU_BROWSER_DEPENDENCIES=/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node
rtk node hub/plugins/qcu-reading/build.mjs
rtk node --test tests/qcu-reading-core.test.mjs
rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
rtk node --test tests/qcu-reading-browser.test.mjs
rtk node hub/plugins/qcu-reading/preview.mjs
```

最后一条输出本机 URL，停止用 Ctrl-C。仅监听 `127.0.0.1`；共用真实 UI、controller、dispatch 与磁盘 store，模型明确为合成模型，无外部请求。默认预览文件在 `.work/qcu-reading-preview/`，重启复用该预览工作区；可用 `QCU_READING_PREVIEW_OUT` 指定本工作树内其他位置。问题含 `[合成等待]` / `[合成失败]` / `[未知引用]` 可分别验证取消、输出上限失败与未知引用，仍需逐次确认。预览不代表原生 DSH 或真实模型验收。

浏览器测试自动创建独立预览和一次性无头 Chromium 配置，退出时关闭进程，在 `.work/qcu-reading-browser/run-*/` 保留截图、导出物及 EVIDENCE.json。需要本机环回监听与测试浏览器运行权限。`QCU_READING_CHROMIUM` 可指定现有无头浏览器；不使用个人浏览器配置。

## 可重建打包

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk python3 hub/plugins/qcu-reading/pack.py .work/qcu-reading-package/candidate
```

固定文件白名单、mtime、顺序与 gzip 元数据，双次构建比对字节，输出含 SHA-256 的 TGZ、MANIFEST.json 和 SHA256SUMS；不包含预览、测试、用户材料或依赖。输出路径已有不同清单时拒绝覆盖，应选新目录。包内含生成的 lazy-CJS `client.js`，仅 `require('react')` 使用宿主共享 React。

完整实施与验证说明见 [R1a 报告](../../../docs/qcu-reading-r1a.md)；后续阶段见 [单机教学工具计划](../../../docs/qcu-standalone-learning-plan.md)。
