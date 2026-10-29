# QCU 材料伴读 R1b

`qcu-reading@0.1.0-pilot.2`，协议 2、存储 schema 2，独立 DSH Host / Client 本地候选，默认停用。复用官方 Cordis 4.0.4 / DSH 0.2.0-rc.2；不读取或保存 Key，未加入 Hub、部署或安装到真实 DSH。目标为教师 Mac，当前验证为 Apple Silicon / Node 25.8.1，未宣称 Windows 或原生多平台验收。

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

PDF 最多 120 页、40000 个文本项/单页绘图操作、2000 个来源单元、512 KiB 提取文本；跳过图像解码，不加载网络 CMap、字体、Wasm 或外部对象。解码缓冲区上限 8 MiB，累计解码分配上限 64 MiB，同时覆盖同步与流式解压。复杂编码可能无法提取，须核对提示并重新导出。

DOCX ZIP 在解压前校验所有目录/本地头、路径、重复/重叠成员与大小：最多 256 项、单项 2 MiB、合计 8 MiB、压缩率 ≤100。只支持普通单卷 ZIP 的 stored/deflate；实际解压另用 maxOutputLength、实际长度、消耗的压缩字节和 CRC 校验，不解压到路径。XML 用 saxes 按命名空间解析，拒绝 DTD/处理指令，限制深度 64、每 XML 80000 节点和文本长度；不支持嵌套表格、ZIP64 等结构，需另存/拆分。表格合并和修订标记需要复核；修订保留插入/移入、略去删除/移出。

工作区 `.qcu-reading/state.json` 最多 24 份材料、200 条摘录、50 次问答、共 8 MB（包括 base64 原始字节）；任一先到即停止新增，本版无删除/自动清理。沿用链接/硬链接拒绝与独占临时文件、同步、原子替换。取消若与已经完成的落盘交错，以实际完成结果为准；未完成解析不保存材料。

## 首版兼容和回退

schema 1 读取后保留原有 TXT/MD 文档、ID、正文、摘录及问答，不重写旧位置。在第一次 schema 2 写入之前，将原文件逐字节同步保存为 `.qcu-reading/state.schema1.<原状态SHA256>.json`。损坏、链接、超限或不一致的状态/备份会拒绝写入，不重置记录；重复打开不重复迁移。遗留生成状态仍标为中断，不恢复模型请求。

pilot.1 不能读取 schema 2。需要回退时先停止插件，另存完整 schema 2 状态，再由维护者将对应的 schema 1 备份复制回 state.json；回退后的首版看不到升级后新增的材料和记录。勿直接启用首版覆盖新状态。本轮只用自编迁移夹具验证，未触碰真实教师记录。

## 构建、测试和打包

默认构建只用 Node 内置模块和已随源码保存的 vendor 文件，不下载依赖：

```sh
rtk node hub/plugins/qcu-reading/build.mjs
rtk node --test tests/qcu-reading-core.test.mjs
rtk node --test tests/qcu-reading-binary.test.mjs
rtk python3 hub/plugins/qcu-reading/pack.py .work/qcu-reading-r1b-package/candidate
```

二进制测试的自编 DOCX 夹具生成需要将 QCU_OFFICIAL_DEPENDENCIES 指向已审核 SDK（其中 JSZip 3.10.1 只用于测试）。官方运行时测试还使用已有 SDK，浏览器测试使用已有 Playwright/Chromium，无安装：

```sh
rtk node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
rtk node --test tests/qcu-reading-browser.test.mjs
QCU_READING_PACKAGE_DIR=.work/qcu-reading-r1b-package/candidate rtk node --test tests/qcu-reading-package.test.mjs
rtk node hub/plugins/qcu-reading/preview.mjs
```

先设置 QCU_OFFICIAL_DEPENDENCIES；浏览器另设 QCU_BROWSER_DEPENDENCIES 为已有测试运行库。预览只监听 127.0.0.1，共用真实组件、controller、dispatch 和磁盘 store，模型明确为合成模型。默认输出 `.work/qcu-reading-r1b-preview/`；Ctrl-C 关闭。测试自行关闭所建服务器/浏览器，证据在 `.work/qcu-reading-r1b-browser/run-*/`；不停止旧 pilot.1 预览。QCU_READING_PACKAGE_ROOT 可让核心、解析、官方和浏览器测试读取精确解包代码。

pack.py 使用白名单、固定元数据并双次比对，生成 ≤1 MiB 的 TGZ、逐成员 MANIFEST.json 和 SHA256SUMS；不会覆盖内容不同的旧清单。包内含已生成 lazy-CJS Client，仅共享宿主 React，解析器留在 Host。Python 只用于维护者打包，教师运行不需要 Python、Docker、native canvas、解析服务、npm 下载、网络字体或模型权重。

vendor 中固定 PDF.js 6.3.289（Apache-2.0）、saxes 6.0.0（ISC，含继承许可）、xmlchars 2.2.0 / @thednp/dommatrix 3.1.2（MIT），并保留 PDF.js 内嵌 core-js 3.50.0 的 MIT 许可。完整许可、输入和输出 SHA-256、来源及构建配方见 vendor/THIRD-PARTY-NOTICES.txt、vendor/MANIFEST.json 和 vendor.mjs。saxes 发布包缺 LICENSE，补充了上游 v6.0.0 完整许可文本。可用已有 esbuild 0.28.1，从显式 QCU_OFFICIAL_DEPENDENCIES、QCU_DOMMATRIX_INPUT 运行 `node vendor.mjs --stage` 重建；普通构建只验证已保存产物。PDF.js 的文本用途定点修改包括移除原生 canvas 加载、禁用 canvas 渲染、跳过图像并报告遗漏、限制解码分配；DOMMatrix 只在 worker 内安装。

[Mozilla 安全通告](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)的修复版本为 6.2.108。本版高于该版本，另设 isEvalSupported:false，未初始化 viewer/scripting；版本号本身不作为安全充分证明。

实施、验收证据和待原生/真实模型/教师核对项见 [R1b 报告](../../../docs/qcu-reading-r1b.md)。[R1a 报告](../../../docs/qcu-reading-r1a.md)及固定旧产物保持不变。
