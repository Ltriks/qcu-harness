# P10 离线交付检查器

P10 `0.1.0-pilot.10.1` 是独立 Python 3.9+ stdlib 维护工具，不是新的 DSH 市场版本。只读取一份本地 handoff，不安装、启用、执行包、运行构建命令、调用模型/服务、修改目录或上架。所有证据都是待核验的数据。静态通过始终返回 `approval:"required"`。本机 Python 3.9.6 与 3.11.15 均运行窄测试、生成器和 CLI 验证，不要求安装新解释器。

## 使用与退出码

从 `market-maintenance` / `dev/qcu-market-p10` 运行：

```sh
rtk proxy python3 -B scripts/qcu-check-submission.py --help
rtk proxy python3 -B scripts/qcu-check-submission.py --submission /absolute/handoff/submission.json --report /existing/output/report.json
rtk proxy python3 -B -m unittest discover -s tests -p test_qcu_submission_check.py -v
```

CLI 自身不依赖 shell，亦可由进程参数数组直接调用。`rtk` 是本仓库操作约定，不是检查器依赖。没有安装、绕过、远程目录或执行脚本开关。

| 退出码 | 含义 |
| --- | --- |
| 0 | 静态输入检查无错误/不支持项；仍需人审、原生与教师验收 |
| 1 | 拒绝静态输入：包括缺失/不安全的必要 handoff 引用、结构错误、不支持的归档/能力、失败证据 |
| 2 | CLI 用法错误、顶层输入不可读/祖先不安全或报告输出失败 |

必要引用缺失、符号链接、不是普通文件等属于提交缺陷，退出 1；顶层 handoff 无法打开属于调用/IO 失败，退出 2。引用读取异常统一脱敏为引用不可读，不泄露操作系统异常。`--help` 退出 0，输出普通帮助文本；其余情况 stdout 为 JSON，正常错误不向 stderr 打印接收值、路径或 traceback。

`--report` 必须显式提供；省略时没有任何文件写入。输出父目录必须存在且无符号链接祖先，输出必须是新文件并位于 handoff 树以外。先完整写临时文件再独占链接为最终路径；不覆盖现有文件/链接，不写输入树，失败清除临时文件。静态拒绝也可写完整的拒绝报告；用法或输出失败不会留下部分报告。正在变化或恶意并发修改的 handoff 不作一致性保证，交付后先冻结副本再检查。

## 常见报告代码与处理

报告 message 使用固定脱敏文字；管理员结合 code 和 field 按下表处理，不需要报告回显收到的路径、命中值、脚本或证据正文。复核项不能当作批准；修正输入后写新的报告，不覆盖历史固定包或原报告。

| code | 含义 | 管理员动作 |
| --- | --- | --- |
| `archive.byte_mismatch` / `archive.hash_mismatch` | 归档实算长度/哈希与声明不一致 | 停止，核对精确审核版本和原字节，要求开发者重新交付一致的声明；不要改旧包来凑声明 |
| `manifest.mismatch` | 独立成员清单有缺失、多余、长度或哈希差异 | 逐项核对清单与最终构建成员；重新交付完整一致的 handoff |
| `archive.filename` | 固定名称与身份/版本/全哈希不符 | 核对交付来源及固定文件命名，不能把未知包冒充已审核版本 |
| `reference.missing_or_unsafe` / `reference.unreadable_or_unsafe` / `reference.regular_file_required` | 材料/证据不存在、不可读、含链接祖先或不是普通文件 | 要求同一 handoff 内有界普通文件及安全相对引用；不要跟随链接或外部 URL |
| `reference.unsafe` / `archive.path` / `io.directory` | 引用、成员或顶层目录路径不安全 | 拒绝穿越/非规范路径和链接；使用真实目录路径的冻结副本 |
| `permissions.summary_missing` | 权限摘要为空，明确待复核 | 开发者补充实际文件/网络/账号/副作用权限声明，再由管理员审阅；不能推断无权限 |
| `permissions.review` / `scripts.execution_review` | 权限或脚本仍需人工决策 | 阅读真实代码/契约；声明匹配不授予执行或安装权限 |
| `evidence.failed` | 某阶段声明失败，阻止静态通过 | 保留失败及上下文，解决后提交新证据，不能直接改为 passed |
| `evidence.missing` / `evidence.untested` | 缺失或未测证据，明确待复核 | 安排相应授权验证；未做保持未测，存在文件不证明结果真实 |
| `evidence.native_review` / `evidence.teacher_review` | 原生/教师验收始终独立 | 核对精确包、环境及实际结果；即使 declared passed 也不能自动批准 |
| `patch.default_enabled` | 组件行默认启用，违反交付约定 | 开发者把行 disabled 设 true 后重新构建新候选；config.enabled 不替代此字段 |
| `package.empty_metadata` | 包内 README 或 LICENSE 等必要元数据为空 | 补充实际说明和许可，重新交付；不接受空文件占位 |
| `secret.pattern` | 正文、引用、USTAR 头或 gzip 元数据/压缩字节命中高置信模式 | 停止交付，在受控本地核查来源；报告中不加入命中值，修正后重新检查；误报也须审阅 |
| `archive.gzip_invalid` / `archive.header_invalid` / `archive.truncated` | 压缩/成员头/终止结构无效或截断 | 从可信构建重新取得完整候选，不能忽略归档错误或尝试运行内容 |
| `file.limit` / `archive.payload_limit` / `archive.member_limit` | 压缩、文件、解压或成员上限超出 | 缩小候选或进入独立未来审核流程；没有绕过上限开关 |
| `package.files_coverage` / `package.files_pattern_unsupported` / `archive.file_type_unsupported` | 成员覆盖、包含模式或文件类型不在静态政策内 | 核对明确白名单和受支持类型；不扩大无扩展名/原生文件权限。精确 `WRAPPER-LICENSE` 是已知文本例外 |
| `report.input_tree` / `report.write_refused` | 输出位于输入树、已存在或无法独占写入 | 指向输入树外已存在真实目录中的新文件；保留原输入及输出 |

## schema 1

根对象仅接受[空白模板](../templates/qcu-submission/submission.template.json)中的字段，全部必需；未知字段拒绝，防止拼写错误静默丢失。没有任意扩展字段或隐式默认授权。

| 字段 | 规则 |
| --- | --- |
| schemaVersion/templateOnly/published | 精确整数 1、精确布尔 false、精确布尔 false；模板不能成为完成态提交 |
| id/title/version | qcu 小写 ID（字母数字与单连字符、最长80）；非空明确标题；固定 semver，可带 prerelease，不接受范围、build metadata 或前导零数字 prerelease |
| sourceRevision/productType/runtime | 小写40hex、不接受全同字符占位；plugin 或 skill；精确 `0.2.0-rc.2` |
| license | 非空许可声明，与 package.json 一致；MIT/Apache-2.0/BSD-2-Clause/BSD-3-Clause/ISC 以外增加 unknown 人审项，不能声称支持 |
| components/skills | 无重复 qcu ID 数组，components 非空；skill 产品 skills 非空；插件可声明 skills；每项最长80 |
| peerDependencies/runtimeDependencies | 包名→固定版本对象，分别与包的 peerDependencies/dependencies 完全一致；缺省包字段按空对象；DSH API 精确 rc2、Cordis 精确4.0.4 |
| installScripts | 数组，每项精确 `{name,command}`；覆盖 package.json 的全部 scripts（不仅 install）；空数组保留旧模板含义。相同声明仍增加脚本人审项，绝不执行 |
| permissionSummary/knownLimits | 无重复非空字符串数组；permissionSummary 为空时明确增加 `permissions.summary_missing` 复核项，不推断无权限；knownLimits 可为空，仍需人工审阅 |
| archive | 精确 `{file,bytes,sha256}`；根目录固定文件名 `qcu-ID-version-fullSHA256.tgz`，正整数长度与小写64hex全哈希独立复算 |
| materials | 精确 `{spec,build,license,source,memberManifest,lock}`；前五项为必要本地路径；lock 可 null，存在 runtimeDependencies 时必须有锁定/构建证据路径 |
| testEvidence | 精确四项 source/preview/liveInstall/businessAcceptance；每项可 null（缺失复核），或精确 `{status,file}`。status 为 passed/failed/untested；file 为本地路径，只有 untested 可用 null |

空字符串、典型 TODO/TBD/待填写/null/unknown、三个连续下划线、`${...}`/尖括号占位文本均拒绝。模板无法通过，亦不能仅凭校验断言其他合法文字一定真实。

成员 manifest 为 `{"schemaVersion":1,"members":[{"path":"package.json","bytes":123,"sha256":"完整64hex"}]}`。路径相对于归档内 `package/`，不含 `package/` 前缀；不重复，必须精确覆盖全部成员，逐个核对长度与哈希。它是开发者独立提交的清单，检查器不会自行生成一份清单再当验证依据。

## 本地引用与归档策略

所有引用均相对 submission.json 所在目录，必须留在其中；不接受 URL、绝对/drive/backslash 路径、空段、`.`/`..` 或符号链接文件/祖先。路径总长240，限定 ASCII 字母数字及 `_@+.-`。CLI 顶层绝对路径也逐级拒绝符号链接祖先。macOS 的 `/tmp`、`/var` 常为链接，请显式使用真实的 `/private/tmp` 或真实 artifact 路径。使用 dirfd / O_NOFOLLOW / O_NONBLOCK，先 fstat 确认普通文件再有界读取。不会递归遍历 handoff，也不会读取未声明的文件。

| 上限 | 值 |
| --- | --- |
| 压缩归档 | 1,048,576 bytes（现有目录大小上限） |
| gzip 解压 tar payload / 成员数 | 8 MiB / 256 |
| 单成员、普通引用 | 1 MiB |
| JSON 文件/单字符串/每层容器 | 256 KiB / 8192字符 / 512项 |
| JSON 深度/数值 | 20层；有符号64位整数，拒绝浮点/NaN/Infinity |
| 材料/证据引用合计（不同路径） | 8 MiB；schema另限制固定引用数 |
| 声明数组、依赖映射 | 通常最多128项；成员/files最多256 |

gzip 一次最多读取8MiB+1，检查 CRC/截断；逐个512字节头解析 canonical USTAR。只支持普通 UTF-8 文本文件，不支持目录项、链接、设备、FIFO、PAX/GNU 扩展头、base256数值、非零 padding 或缺失双零终止块。路径必须以 `package/` 开头、规范且无重复；模式不得有执行/setuid/setgid/sticky位。没有 extractall/getmembers/解包/导入/运行操作。

解压前还会在1MiB压缩输入上限内扫描原始压缩字节，并独立扫描首个 gzip 头的 extra、filename、comment 字段，避免相邻二进制字节影响模式边界；可变字段的长度/终止符查找同样受压缩上限约束。命中统一为 `secret.pattern` / `archive.gzipHeaders`，不回显字段值。gzip 字段缺失、越界或未终止则拒绝，不影响后续既有解压/CRC/USTAR 限制。

拒绝 node_modules、.git、.env、常见凭据名、Home/logs/private/state 等状态目录，以及原生二进制/扩展与未知文件类型。允许 `.js/.mjs/.cjs/.json/.yml/.yaml/.md/.txt/.svg/.css/.html` 和 LICENSE/NOTICE；额外只精确允许已知文本成员 basename `WRAPPER-LICENSE`（区分大小写），不泛化允许无扩展名文件。它仍受 UTF-8、大小、secret 扫描、独立 manifest 和 package.files 精确覆盖约束。`.mjs` 是 P9 合法 Host 源码，不误判为未编译产物。UTF-8 文本不等于安全代码。扫描文件正文、声明引用和每个有界512字节成员头中的高置信私钥头和部分 token 格式，包括 name/uname/gname；不打印命中值，只给 `secret.pattern` 和稳定字段（头为 `archive.headers`）。这无法保证无全部秘密、个人数据或危险代码。

## 包结构与人工复核

必要文件为非空 package.json、README.md、LICENSE。name/version/license 与提交一致，type 为 module；exports、files、dsh.bundle.patch 必需。files 只支持精确路径和目录（可带一个尾 `/`），不支持 npm 的 glob、排除或完整自动包含语义；必须精确覆盖归档，package.json 自动计入，其余必需文件需列在 files。exports 可递归条件对象或字符串，不支持数组/null；目标必须 `./` 开头并存在。仅支持目录后 basename 中单个 `*` 的导出目标，匹配一个非空 basename 段，至少一处命中；例如 P9 的 `./locale/*.json`。这不声称完整模拟 Node/npm exports 解析。

patch 必须为 JSON（即使扩展名 .yml），只支持非空操作数组和 `{insert:[...]}`。每行只支持 id/name/disabled/config，id=name 必须精确覆盖 components，无重复，disabled 必须 true；config 必须对象，`config.enabled:true` 不等于启用组件行。一般 YAML 被拒绝为 `json.invalid`，须开发者提供 JSON 形式或走另行审核，不能用正则猜 YAML。Skill 产品需 SKILL.md，实际 provider 内容/发现仍须原生证据。Client 限 web，注入依赖必须已声明；Host、RPC、工具、slot、配置及权限语义不能从这些声明证明，报告明确要求审阅。

optional/bundled dependencies、peerDependenciesMeta、bin/gypfile/os/cpu/libc 声明目前明确不支持；已知 native 依赖拒绝。未知依赖增加人审项，不称为支持。运行依赖须有 lock 材料，但检查器不下载/解析依赖闭包，也不证明未知包无 native 内容。package.permissionSummary 若存在需一致；不认识的 package.permissions 明确拒绝。通常的 DSH 权限/服务来源于代码，必须人审。匹配的脚本声明、未知许可、来源文档、锁文件存在，都不授权执行。

报告包含 checker/schema version、经过语法校验的 id/version/type、复算包大小/哈希/payload大小、按路径排序的成员索引/路径SHA256/内容长度/内容SHA256、结构化错误/unsupported/reviewRequirements 和计数。成员不回显收到的名称，审阅者按独立 manifest 的路径排序对应索引。报告不回显标题、源码修订、绝对路径、文档/代码/脚本或证据正文。固定输入的实质报告确定，不带时钟/随机值。严重结构错误后相依检查会停止，因此一个错误列表不代表穷尽其他缺陷。

证据 failed 阻止静态通过。null/untested 是明确复核要求，仍可静态通过；即使四项都 declared passed，liveInstall 和 businessAcceptance 仍有独立必需复核项，`approval` 永远 required。没有 ready-to-publish、approved、safe 或 installed 状态。

## devkit1 迁移与交接

原 `templates/submission.example.json` 的字段都保留；把 sourceRevision/license/archive 等 null 和占位文字填实，增加 schemaVersion、materials 和独立 member manifest，把四类 testEvidence 改成结构化状态/本地引用。保持 published:false，填完后才改 templateOnly:false。旧模板中的 `installScripts:[]` 仍适用于无脚本包；有脚本时转为 name/command 行。components/skills 明确为 qcu ID 数组。不要修改或重打原 devkit1、P9 或旧产品字节。

完整合成示例由[生成器](../templates/qcu-submission/README.md)产生，只落 artifacts/temp。父级可在审核后制作便携工具 ZIP；本轮不制作安装 TGZ，不更改教师 P9 流程。维护、原生验收与发布边界见[维护指南](qcu-market-p10-maintainer-guide.md)。
