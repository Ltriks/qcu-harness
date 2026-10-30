# QCU 材料伴读 · 本地资料架 R2

`qcu-reading@0.2.0-pilot.1`，协议 3、存储 schema 3，独立 DSH Host / Client 本地候选，默认停用。复用官方 Cordis 4.0.4 / DSH 0.2.0-rc.2 和原有精确十项 peers，无新运行依赖。该升级必须 **manual-review**：R1 不能读取 schema 3。尚未安装、部署或发布 R2，原生 R2、教师业务和 Windows 均未测。源码基线为 `6ee4127d5f44e5d82defc86afed5c67cac529e0e`，它不是本候选的最终提交；父任务审阅并提交后需重新绑定。

## 资料架

每份材料可另设显示标题（180 字符）、一项课程 / 分类（80 字符）、最多 8 个去重标签（每项 24 字符）及收藏状态。仅接受无控制 / 双向覆盖字符的普通文字。原文件名、ID、原始字节、正文、创建时间、段落和位置保持原样；历史问题、回答及其来源快照不随别名改写。原文件名和版本在阅读区可见，完整 SHA-256 在详情中。

侧栏按课程、标签和收藏筛选；“资料架关键词”检索文件名、标题、课程、标签及已导入的快照原文。原文沿用确定性 searchDocument，每份最多 5 处、工作区最多 40 处；可直接打开对应的文档 ID + locator。它不是语义 / 向量搜索。空筛选可清除，空资料库仍提供导入。已保存摘录的收藏单独按原 note ID 保存，侧栏“收藏摘录”打开其原版本；不复制或改写摘录。

“整理与管理此版本”可编辑资料信息并预览删除。预览显示原文件、版本 SHA-256、连带删除的摘录 / 问答数量。取消或 Escape 不写盘，并返回删除入口焦点。确认只删除该版本及其依赖记录 / 元数据，其他版本保留。预览与工作区、当前内存及磁盘状态绑定，2 分钟过期，失配、重复、其他写入或活动导入 / 问答均拒绝。每次写入和删除确认前复核文件摘要、inode、owner、链接数和目录身份；这不是与任意外部编辑器之间的跨进程原子锁，维护时须停止插件并避免并发改盘。

## 完整本地备份（仅导出）

“本地备份 → 下载完整备份 JSON”是一次显式操作，包含该工作区全部文档快照（含原始 PDF / DOCX base64）、摘录、问答与资料架元数据，不读取原始外部路径、Home、设置或 Key。备份格式 `qcu-reading-backup` / version 1 / stateSchema 3，`checksum.algorithm=SHA-256`，`checksum.state` 校验 `JSON.stringify(state)` 的 UTF-8 字节。外层整个文件的摘要和长度在导出协议中独立验证。

原 RPC 上限保持请求 3M 字符、回复 10M 字符；完整备份以 256 KiB 字节块 base64 传输，每次重算最多 8 MB 状态并绑定稳定摘要，最多 31 块，无导出会话缓存。Client 检查块序号、长度、完整长度、外层 SHA-256 与 state 校验，下载前再次确认摘要；取消、停用、切换工作区或记录变化均不产生部分下载。备份只作为数据，不执行其内容。本版 **没有导入 / 恢复 UI**，Markdown 问答导出也不是完整备份。

维护者验证备份时，先在隔离副本核对格式 / 版本、文件摘要、state 校验和 schema 3 的记录 / 引用边界；不要直接把未知 JSON 写回真实工作区。需要实际恢复时，停止插件、保留当前 state 和所有历史备份，由维护者另行审阅恢复流程，并在一次性副本验证重开。该流程未实现为产品恢复功能，也未授权对真实资料操作。

在 DSH 添加工作区后，点击工作区选择框旁的“刷新”，即可更新列表，无需重启或重新连接。按钮支持键盘操作，刷新期间显示忙碌状态；失败后可重试。仍有效的当前工作区、打开材料、摘录、问题草稿、发送确认及勾选状态和运行状态均保留；新工作区出现时不会自动选择或读取其材料。只有显式切换工作区才沿用原有的隔离和确认失效规则。

当前工作区若已不在列表中，界面要求重新选择并使本地发送确认失效；旧异步回复不能恢复确认。已保存的快照、摘录、问答历史不会删除，Host 中已开始的问答不会因列表刷新被取消。刷新仅请求工作区列表，不导入文件、不调用模型、不启动或取消问答。解析、存储、来源、模型路由和逐次发送确认语义保持原样。

## 导入与来源

- UTF-8 TXT / MD：每份 ≤256 KiB，保持首版的规范化文本 SHA-256、段落编号与原有摘录/记录。Markdown 以纯文本显示。
- 文字型 PDF / DOCX：每份 ≤2 MiB。Client 只传文件名和规范 base64；Host 计算原始字节 SHA-256、解析并保留原始字节，不接受 Client 自造的文本或位置。同字节去重，同名新字节保留新版本。
- PDF：按物理页号定位，包括无文字的页。界面是提取文本，不是原件视觉复现。图片不转写；扫描/空白页逐页标记，全篇无文字提示先做 OCR；分栏、表格、公式、编码及不完整提取显示复核提示。加密/密码、损坏或需修复 xref 的文件拒绝。
- DOCX：正文、标题样式与章节路径，普通段落及表格行/格/段落位置；不编造 Word 固定页码。链接只保留标签，图片、公式、批注、脚注、页眉/页脚及不支持的对象有遗漏提示。拒绝 DOC/DOCM、宏包、加密 ZIP、坏 XML、DTD/自定义实体；不运行 HTML、PDF 脚本、宏或嵌入包。

使用：导入 → 搜索材料中的字词 → 点击页/段落/表格位置 → 保存连续摘录，或输入问题并准备问答 → 核对完整片段和实际模型 → 勾选本次发送并确认。无命中不调用模型。确认随问题/材料/工作区变化失效，10 分钟过期。引用只链接本次合法来源；未知/缺失引用标为待核对。旧回答始终打开旧文件版本。

导入、搜索、阅读、导航、摘录和导出不调用模型。实际请求仅发送已确认的问题和最多 4 段、每段 ≤1800 字符的片段及其格式/位置（DOCX 命中表格时优先补入同一行最近的另一格，并逐格展示确认），不发送原始二进制。生成仍使用默认模型的 low、其次 off、否则宿主默认档位，2000 token 预算，无工具、重试或隐式调用。每工作区一个活动问答，60 秒超时；结果和 Markdown 均标为教师审阅草案。

提取提示默认只显示一条简短摘要：已知未提取的图片/公式等内容及 PDF 无文字页数量保持可见；完整的类型与具体页说明可用“完整提取说明”展开，也支持键盘操作。阅读和发送前确认均采用该形式，来源片段和实际模型仍直接显示。PDF 正文中的无文字页标记、历史详情及 Markdown 导出的完整说明均保留。

## 解析与容量

Host worker thread 执行解析：每工作区最多一个导入、每进程最多两个 worker，不排无限队列；15 秒超时，取消/停用均等待 worker 终止。worker 限制 128 MiB old heap、16 MiB young heap、4 MiB stack，原始输入和返回文本有界。它提供生命周期隔离，不是 OS 沙箱或整个进程 RSS 的硬限制。

Host 显式启用 Node permissions 时，worker 保留该模式、显式文件读写范围及禁用 native addon / 全局搜索路径标志，继续排除 Host loader/preload，也不授予嵌套 worker。Node24 本身没有网络 permission scope；离线测试另在主线程和 worker 使用测试专用网络 API 拒绝引导，并实际探测拒绝。产品仍通过本地输入、禁用 fetch 和外部资源工厂限制解析资源，不将测试引导描述为产品 OS 沙箱。

PDF 最多 120 页、40000 个文本项/单页绘图操作、2000 个来源单元、512 KiB 提取文本；跳过图像解码，不加载网络 CMap、字体、Wasm 或外部对象。解码缓冲区上限 8 MiB，累计解码分配上限 64 MiB，同时覆盖同步与流式解压。复杂编码可能无法提取，须核对提示并重新导出。

DOCX ZIP 在解压前校验所有目录/本地头、路径、重复/重叠成员与大小：最多 256 项、单项 2 MiB、合计 8 MiB、压缩率 ≤100。只支持普通单卷 ZIP 的 stored/deflate；实际解压另用 maxOutputLength、实际长度、消耗的压缩字节和 CRC 校验，不解压到路径。XML 用 saxes 按命名空间解析，拒绝 DTD/处理指令，限制深度 64、每 XML 80000 节点和文本长度；不支持嵌套表格、ZIP64 等结构，需另存/拆分。表格合并和修订标记需要复核；修订保留插入/移入、略去删除/移出。

工作区 `.qcu-reading/state.json` 最多 24 份材料、200 条摘录、50 次问答、共 8 MB（包括 base64 原始字节及资料架元数据）；任一先到即停止新增，无自动清理。仅支持显式预览确认后的单版本删除。沿用链接/硬链接拒绝与独占临时文件、同步、原子替换；所有变更使用原串行队列。取消若与已经完成的落盘交错，以实际完成结果为准；未完成解析不保存材料。

## 首版兼容和回退

schema 1 / 2 读取后在内存添加 schema 3 空资料架，不改写原文档、ID、正文、摘录及问答。空闲读取 / 浏览 / 导出不写盘。第一次新写入前，将原文件逐字节同步保存为 `.qcu-reading/state.schema<旧版本>.<原状态SHA256>.json`。损坏、链接、超限、不一致或失败的备份 / 写入拒绝继续变更，不重置记录；重复打开不重复迁移。遗留 running 仍按既有规则持久化为 interrupted，此次写入同样先保留旧字节，绝不恢复模型请求。

旧 R1 不能读取 schema 3。需要回退时先停止插件，另存完整当前状态，再由维护者核对对应的 schema 1 / 2 备份；回退会丢失备份之后新增的记录 / 元数据，不自动降级或覆盖真实工作区。本轮只用自编一次性迁移 / 删除夹具验证。

## 构建、测试和打包

仅使用已审核本地 Node 24、SDK、Playwright / Chromium，无下载、安装或新运行依赖。先设置 QCU_OFFICIAL_DEPENDENCIES、QCU_BROWSER_DEPENDENCIES、QCU_READING_CHROMIUM 为任务稿中已有位置，并把 TMPDIR、QCU_READING_BROWSER_OUT、QCU_READING_WORKSPACES_BROWSER_OUT、QCU_READING_SHELF_BROWSER_OUT、QCU_READING_PREVIEW_OUT 设在本次新建的 `.work/qcu-reading-r2-shelf/` 子目录。

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk node --test tests/qcu-reading-shelf.test.mjs tests/qcu-reading-core.test.mjs tests/qcu-reading-binary.test.mjs tests/qcu-reading-workspaces.test.mjs tests/qcu-reading-hub-parser.test.mjs
rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
rtk node --test tests/qcu-reading-shelf-browser.test.mjs tests/qcu-reading-browser.test.mjs tests/qcu-reading-workspaces-browser.test.mjs
rtk python3 -B hub/plugins/qcu-reading/pack.py .work/qcu-reading-r2-shelf/candidate
```

精确包复跑时，QCU_READING_PACKAGE_ROOT 指向验证过成员清单的解包 package 目录，QCU_READING_PACKAGE_DIR 指向本次候选目录。`qcu-reading-package.test.mjs` 验证精确 TGZ 和离线 parser / worker；`qcu-reading-shelf-package.test.mjs` 验证 R2 同源成员、原 parser/vendor、unchanged market archive inspection 与真实 checker。后者还需 QCU_READING_R2_HANDOFF 和 QCU_READING_R2_CHECKER_OUT 指向本次实际交接与新报告。历史 `qcu-reading-hub-package.test.mjs` 必须使用固定 pilot.3 / pilot.4 原输入，不能将其旧版断言改成 R2。

浏览器只使用共用真实组件 / controller / dispatch / 临时磁盘 Store，模型为合成适配器，禁止外部请求；只关闭自身所建服务器与 profile。独立视觉 reviewer / detector、Git、原生和真实业务由父任务处理。

源码中的 pack.py 不随包分发，仅供维护者使用。它使用白名单、固定元数据并双次比对，生成 TGZ、逐成员 MANIFEST.json 和 SHA256SUMS。约束为 TGZ 和每成员各 ≤1 MiB、最多 80 成员、payload ≤5 MiB、文件内容合计 ≤4 MiB；不会覆盖内容不同的旧清单。包内含已生成 lazy-CJS Client，仅共享宿主 React，解析器留在 Host。Python 只用于维护者打包，教师运行不需要 Python、Docker、native canvas、解析服务、npm 下载、网络字体或模型权重。

vendor 中固定 PDF.js 6.3.289（Apache-2.0）、saxes 6.0.0（ISC，含继承许可）、xmlchars 2.2.0 / @thednp/dommatrix 3.1.2（MIT），并保留 PDF.js 内嵌 core-js 3.50.0 的 MIT 许可。完整许可、输入和输出 SHA-256、来源及构建配方见 vendor/THIRD-PARTY-NOTICES.txt、vendor/MANIFEST.json 和 vendor.mjs。saxes 发布包缺 LICENSE，补充了上游 v6.0.0 完整许可文本。可用已有 esbuild 0.28.1，从显式 QCU_OFFICIAL_DEPENDENCIES、QCU_DOMMATRIX_INPUT 运行 `node vendor.mjs --stage` 重建；普通构建只验证已保存产物。保留同版 legacy 输入及 core-js；现代 build 在本次 Node 24.19.0 实测缺少 Uint8Array.toHex，未采用。固定上游模块边界处将未改动的编码、字符集、字形、度量及字体因子表与 lookup helper 提取为本地静态 pdf.font-tables.mjs（Node24 ESM），不在运行时拼接或解码可执行代码。PDF.js 的文本用途定点修改包括移除原生 canvas 加载、禁用 canvas 渲染、跳过图像并报告遗漏、限制解码分配；DOMMatrix 只在 worker 内安装。

[Mozilla 安全通告](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)的修复版本为 6.2.108。本版高于该版本，另设 isEvalSupported:false，未初始化 viewer/scripting；版本号本身不作为安全充分证明。

R1 归档修复历史见 [Hub 归档候选报告](../../../docs/qcu-reading-hub-package.md)。本 R2 为协议 3 / schema 3；官方 DSH 0.2.0-rc.2 不变。Node24.18.1 是目标，实际本地测试为 24.19.0。同一 tools 产品已获现有精确十 peers 准入，无须新增产品；静态 checker 和 archive inspection 通过仍需人工批准及后续单独授权的发布；没有安装、发布或借用 pilot.3 原生验收。sourceRevision 暂绑定实际基线，并明确等待父任务候选精确 commit 重绑；[工作区刷新报告](../../../docs/qcu-reading-workspace-refresh.md) 保留；原生 DSH 的新候选安装/交互和真实教师使用仍由维护者验收。[R1b 报告](../../../docs/qcu-reading-r1b.md)、[R1a 报告](../../../docs/qcu-reading-r1a.md)及固定旧产物保持不变。

R2 精确候选、分层验证、保留的失败与未测边界见 [R2 资料架报告](../../../docs/qcu-reading-r2-shelf.md) 和 [教师短清单](../../../docs/qcu-reading-r2-shelf-checklist.md)。R2 输出只在 `.work/qcu-reading-r2-shelf/`，不复用旧归档输出目录。旧历史包拒绝测试应固定原 pilot.3 / pilot.4 输入；R2 使用 `tests/qcu-reading-shelf-package.test.mjs`。
