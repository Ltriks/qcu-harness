# QCU 教师产品完善契约

TASK-ID: QCU-TEACHER-PRODUCT-POLISH (P16)。本契约先于两端实现落盘。本文保留组件阶段契约与验证范围；后续完整 Mac 候选及最终产物以 [P16交付和验收](qcu-p16-delivery.md) 为准。

## 父审查恢复契约（QCU-P16-PARENT-REVIEW，先于两端修改）

本节替代初版中“仅内存回执”和仅 text 指纹的约定。新候选市场 `0.1.0-pilot.16.1`、主题 `0.2.6-pilot.2`；初版归档及回执原样保留，均未批准或部署。安装协议 6 的精确 status 结构、信任 pin 和固定 updatePolicy 不变。

确认指纹为以下七个顶层字段对象的规范 JSON UTF-8 SHA256：`category,title,steps,expected,actual,knownVersions,text`（knownVersions 是 market/runtime 两项）。对象键按 ASCII 键名排序，无额外空格；JSON 字符串不转义正常 Unicode，拒绝孤立代理码点，长度统一按 Unicode 码点计数。requestId、confirmed、previewSha256 不参与指纹；任何预览字段改变都撤销确认。所有字段严格验证后才计算/检查指纹，Host 在任何网络或私有写入前复核完整对象和指纹，Python 接收端采用相同规则；不再靠子串判断同意范围。

Host 新增专用只读 RPC `feedbackReceipts()`，submit/status RPC 接受公开 cancellation signal；不添加通用文件、网络或 URL 接口。profile 公开服务提供的目录下建立专属 `qcu-feedback-receipts` 私有目录，与更新水位/更新日志分离，不扩大 UpdateStorage 文件白名单。最多 32 条不可变 intent，每条仅含 schema、随机 requestId、派生 receiptId、pending 状态、UTC 创建时间与准确市场版本。原始反馈、标题、材料、输出、路径、账号、Key、公开处理说明均不落盘。公开 POST 前，必须先原子提交 intent；满额、损坏、不安全文件或锁等待超时则不发送。固定槽位采用独占临时文件预留、fsync 后 rename 发布，不使用持久硬链接；跨进程竞争有界等待，不覆盖已有槽位，不自动删除历史。未发布的中断预留由维护者停机核对，不能当成已发送或自动续发。

重新组成 Host/Client 只读取本地 intent 历史；网络状态需要用户主动点击查询。intent 仅证明保存了查询凭据，不证明 Hub 收到。每次查询/提交返回的 receiptId 都必须等于 `sha256("QCU-FEEDBACK/V1:"+requestId)`。重复的同一 requestId 不再发送 POST，而提示查询。未知结果（超时、中断、5xx、重定向/非法响应）保留旧凭据；编辑后须显式“另建一条反馈（保留原回执）”再生成并确认，新旧记录分别保留。明确且格式正确的 4xx 才可作为确定拒绝。取消/连接重置/销毁使未使用的确认和迟到回包失效；已被 Hub 接受的反馈不会因取消撤销。

接收器锁 acquisition（线程锁与 flock）总等待最多 1 秒，失败返回安全忙碌状态，无隐式重试。管理员 list/detail/update 在锁取得并读取后、披露或写入前重验同一会话；提交 body 的原有校验、同源、限流和容量约束不变。运行时拒绝当前仓库、任何 Git/公开快照/账号/签名/发布树及调用方 protected 目录，不含机器专属用户路径常量。重开校验完整 UTC 时间、每条审计事件字段/顺序/修订与最终状态的一致性。

维护审计严格绑定 `/updates.json` → `pilot`，`/updates-v2.json` → `pilot-experts`；404 回退仍是信息。使用既有签名验证后，对声明的 TGZ 做有界静态检查：真实 package.name/version、唯一成员清单、manifest files/exports、生命周期脚本、依赖与 peer、组件 patch，绝不执行包。更新包仍按既有 updatePolicy；主题候选另按其精确无依赖六文件契约。比较最新目录与两种更新源逐产品覆盖，缺口列为可操作提示，不把初装可用等同更新覆盖，不扩权。无签名续期草案须包含两个独立域的当前修订/指纹、各自更高修订和建议时间窗，明确不可直接发布。

教师界面保留已认可紧凑布局，首页只有一条指引入口，完成后显示“已完成首次任务，可回看步骤”。可持久化的引导数据严格限定 schema、step、真实 task ID、viewed、用户明确确认完成的布尔值；没有草稿、文件夹、输出或 Key。重开不恢复“本次打开了草稿”的推断，不采用旧初始化/教程标志推断完成。错误正文采用可行动中文，安全代码折叠显示；回执用短编号、明确复制和本地历史。恢复 reduced-motion guard。

本轮所有新输出使用 `.work/product-polish-review/`（可由 `QCU_PRODUCT_POLISH_OUT` 指定）；初版 `.work/product-polish/` 不重建、不覆盖。浏览器必须从新最终 TGZ 提取的精确 client.js 构建，使用原预览骨架和临时合成私有状态，最后完整运行受影响套件并关闭进程。真实公开输入只离线读取父审查提供的 public-only 快照。

## 范围与版本

仅改教师主题、工具市场、独立反馈收件箱和既有单管理员维护入口。课程模块及其归档、专家模块和官方 DSH 源码冻结。当前父审查候选主题 `0.2.6-pilot.2`、市场 `0.1.0-pilot.16.1`；运行时支持基线仍为 `0.2.0-rc.2`。关于页不推断所在应用版本。实际套件版本以随包收据为准，候选不属于已发布记录。公钥、信任域、更新策略和源代码已知检查保持原样。反馈是可选的协议 6 附加能力；旧 Host 缺方法时保留本地复制，不能调用其他操作代偿。安装协议及串行确认状态机不变。

## 初版反馈传输（历史，恢复部分以父审查契约为准）

固定生产来源 `http://192.168.1.68:8080`。只有 Host 的专用方法访问 `POST /feedback/submit` 和 `POST /feedback/status`。不提供 URL、文件或任意 HTTP RPC。5 秒总超时、禁止重定向、请求/响应各最多 16 KiB、JSON、无 Cookie/授权头、无自动重试。仅测试构造器可注入 loopback 地址。

JSON 顶层对象必须严格匹配字段；重复键、非有限数字、超过 8 层、非法 UTF-8、额外字段拒绝。submit 对象：

```
{requestId, category, title, steps, expected, actual, knownVersions, text, previewSha256, confirmed}
```

`requestId` 为客户端随机 32 字节小写十六进制（256 bit）。category 为 `ui|install|model|other`；title 1..160 字，steps 1..1200，expected/actual 各 1..600，text 1..6000。文本不得含控制字符（允许换行/tab），服务端拒绝明显凭据、账号路径和联系方式。knownVersions 严格为 `{market,runtime}`，market 为准确自身版本，runtime 为 Host 公开 API 观察值或 `unobserved`，最大 80 字。其他环境信息不自动采集。

`previewSha256` 是 text 的 UTF-8 SHA256；确认必须为 true，且客户端提交的 title/steps/expected/actual 必须来自同一次已脱敏预览。服务端校验指纹与一致性。用户先生成、审阅预览，勾选删除敏感资料，再独立点击提交。编辑、页面导航、连接重置立即撤销确认。自动脱敏不保证识别任意隐私。

同一 requestId + 相同规范化对象返回同一回执；变更内容返回 409 `feedback.conflict`。回执 ID 为 `sha256("QCU-FEEDBACK/V1:" + requestId)`。status 仅接收 `{requestId}`，返回 `{receiptId,state,updatedAt,revision,message}`；不存在或格式错误统一 404 `feedback.missing`，不返回原文、内部备注、路径或其他标识。随机 requestId 是查询能力凭据，不枚举。网络结果未知时保留同一 ID，只主动查询，不重发；修改后须显式创建新提交。Host 按前述父审查契约持久化最小查询 intent；客户端重开通过窄 RPC 恢复本地回执，原文仍只在当前表单内存中。

公开路由只在显式 `--feedback-root` 配置后启用；未配置时所有旧写请求仍为 405。Host 必须精确匹配；Origin 存在则精确匹配本服务 origin，无 CORS 头。Content-Type 必须 `application/json`，不得转移编码/查询参数/编码路径，读 body 有整体期限与 socket 超时。每 peer 每分钟 20 次（内存且有上限，不持久化 IP），全收件箱最多 500 条/8 MiB，无自动删除。

## 私有存储与管理端

`hub/feedback.py` 独立共享模块，公开服务不得为反馈导入管理员初始化。root 显式指定、独立于仓库/快照/账号/签名/发布树；祖先逐级 O_NOFOLLOW，目录 0700、文件 0600、单链接、本人拥有。单状态文件在跨进程 flock 下读取、修改和原子替换/fsync；审计每条最多 50 项。启动校验所有记录，破损拒绝。初始化为显式 CLI 操作；服务启动不偷偷建目录。

管理员沿用 qcu-admin 内存 Bearer 会话、同源 POST 防护和现有 JSON MIME：GET `/api/feedback`（有界摘要）、GET `/api/feedback/<receiptId>`（仅授权详情）、POST `/api/feedback/<receiptId>/status` 接收 `{revision,state,message}`。state 为 `received|in-progress|resolved`，message 为 0..300 字无敏感资料的公开说明；revision 乐观锁，陈旧 409。每次读取 body 和等待锁后重验登录。resolved 表示维护者标记处理完成，不代表教师确认有效。

## 维护契约

GET `/api/maintenance` 仅返回安全摘要和最后一次显式刷新；POST `/api/maintenance/refresh` + `{}` 才允许只读 HTTP。固定 origin 和精确 catalog/updates 路径，10 秒、512 KiB、无代理/重定向；没有配置显示未配置。catalog 使用现有 verifyCatalog 和固定公钥；updates 使用现有签名校验和原 updatePolicy。公钥独立，不相互替代。签名有效、归档完整、HTTP 复核、仅解析、不可用分开。供应时钟决定 `fresh|near-expiry(<72h)|expired|future`。updates-v2 404 是支持的 updates.json 回退；目录和更新源独立呈现。

本地 `scripts/audit-product-polish.mjs` 只读检查 staged 输入、公钥固定、描述符及精确归档哈希；输出机器报告，过期/不一致非零。只生成无签名续期草案，不签名、不发布、不访问生产密钥。描述符区分 app、插件、归档字节、状态及支持运行时。

## 紧凑布局方案（frontend-design）

沿用已接受的清蓝教师工具风格：画布 #f7fafd、表面 #ffffff、文本 #17324d、次文本 #48617a、强调 #174f91、边线 #d9e5ee；暗色仍由既有配对 tokens 提供。字体仅用宿主系统字体及 `--dsh-content-font-size`，不写初始设置。间距 8/12/16/24；标题仍使用现有比例。左对齐，以一份可编辑任务为主内容；最近任务放在同一工作区侧边，窄屏紧邻任务下方。教学工具用紧凑分行清单，说明/准备资料/操作自然换行。市场统一“工具市场”，与教学工具启动任务区别明确。

```
教学首页               使用指南
首次任务入口
任务要求 / 文件夹 / 打开草稿 | 最近任务
```

指引放在主题已有工作区服务上，实际复用七个任务、现有文件夹、create/retain/input.setDraft/openSession/release。模型设置通过现有 sidebar.settings 插槽的官方 launcher；无公开直接模型跳转时给出“设置 → 模型”准确路径。分四步：查看模型设置说明；选择任务/匿名示例和真实工作区；打开对话草稿（用户核对模型并手动发送）；用户自述审阅完成。浏览、用户自述、运行时检查互不冒充。进度和文本仅驻内存，支持返回/跳过/重入/重置进度，重置不改字号或配置。

## 验证与交付边界

所有浏览器使用真实新 client.js、官方主题运行时和隔离合成服务；反馈走真实 loopback HTTP 接收器与管理员。清晰标记“合成预览”。覆盖 14/18/22、浅深、390/桌面/短视口，检查截图、主要按钮几何、键盘/焦点/返回，零发送/模型/安装副作用。生产端点零请求，不读取正在使用的 Home。候选归档不覆盖旧包，文件清单及截图 SHA256 写入 `.work/product-polish/RESULT.json`。完整 Mac/Windows、签名、生产部署、真实 Key 与教师效果留待单独验收。

## 维护者操作与恢复

以下是待评审的部署输入；本轮不启动真实服务。反馈目录必须是独立私有目录，与账号、签名、发布快照及仓库互不包含。已有公开服务不增加 `--feedback-root` 时，仍保持原有只读写请求响应。先停服务再备份，不能边写边复制。

1. 用 `rtk proxy python3 hub/feedback.py --feedback-root /绝对路径/独立反馈目录 --init` 显式初始化新目录。父目录须已存在且无符号链接。不要选择正在使用的 Home。已有目录去掉 `--init` 只做校验。
2. 公开服务保留原快照、清单 pin 和发布配置，只附加相同的 `--feedback-root`。管理端也附加此参数；管理端仍只绑定 `127.0.0.1`，沿用既有 qcu-admin。反馈不新增账号、不对外开放管理员路由。
3. 维护页可独立增加 `--maintenance-root /绝对路径/已暂存公开输入 --node /可信Node绝对路径`；不需要配置签名密钥来做只读维护检查。登录后点击“只读刷新公开状态”才访问固定 Hub；不配置则显示未配置。
4. 重启前记录最后已确认发布修订、签名目录有效期和公开下载复核状态；正常停止公开/管理员进程。只对独立账号、签名、发布及反馈目录分别做私有备份，保持 0700/0600 和来源权限。不得把备份放入公开快照、仓库或分发包，不复制教师 Home。此步骤本轮仅在临时合成账号与反馈上演练。
5. 恢复到全新的隔离私有位置，验证目录祖先无链接、文件单链接及模式。先验证签名和归档 pin，再启动 loopback 管理端；重新登录，核对记录数量和状态。登录令牌只在内存，重启后失效。反馈损坏时保持失败关闭，核对停止时备份；不自动删除或修复原件。公共重启后的未知提交先查询同一请求，不能凭网络失败重复发布或提交。
6. 生产服务可用性需维护者在后续授权时实测：HTTP catalog/固定 TGZ、旧更新源有效期、专家回退、未配置服务的旧写响应、管理员仅 loopback、公开路径不能访问收件箱。不要使用跳过签名、Gatekeeper 或源版本检查来完成验收。

只读命令（不会续期）：

```sh
rtk proxy node scripts/audit-product-polish.mjs --root /绝对路径/暂存公开快照 --now 2026-10-27T02:00:00Z
rtk proxy node scripts/audit-product-polish.mjs --root .work/product-polish --release-only
```

第一条检查 `market/catalog.signed.json`、`updates.json`、可选 `updates-v2.json` 和所列精确 TGZ；支持已有两个固定公钥，过期或不一致退出 2。缺 `updates-v2.json` 单独显示支持的旧源回退。第二条只检查本轮 `release.json` 与两个候选包；公共源显示未检查，不表示已上线。`--http` 仅供后续授权后显式检查固定生产 origin，不允许同 `--release-only` 合用。

续期先将只读报告保存为 JSON，再执行 `rtk proxy python3 scripts/draft-product-polish-renewal.py --audit 报告.json --output 新的无签名续期草案.json`。要求先有已验证签名和完整性；草案只列更高修订下限及保留原公钥/归档的检查项，不生成签名、不读密钥、不发布。真正续发通过既有独立预览/确认发布机制；旧更新源仍须使用其独立签名流程。

## 本地预览与候选输入

版本依据为 `releases/qcu-teacher-product-polish.json`，schema 同目录。staging 核对插件 manifest、包指纹、冻结源码，生成 `.work/product-polish/release.json` 与 `MAC-STAGING-INPUTS.json`。`appRelease: null` 表示尚未决定完整 app 版本，不能据此改“关于”或声称 rc4.2 原归档已更新。任务稿提供的已安装状态是 rc4.1 + font.1；本轮没有读取使用中的应用来重新核验。Hub 公开修订和有效期仅作为任务稿历史背景，本轮没有访问线上。市场候选保持“来源不在已发布记录”保护，不修改公钥和 updatePolicy。

构建与预览：

```sh
rtk proxy node scripts/build-teacher-theme.mjs .work/product-polish/clients/qcu-branding
rtk proxy node hub/plugins/qcu-market/build.mjs --client-only
rtk proxy node scripts/build-product-polish-preview.mjs
rtk proxy node scripts/serve-product-polish-preview.mjs
```

最后一条打印临时教师预览和管理员地址；账号 qcu-admin，密码 `synthetic-preview-password` 仅适用于此合成 fixture。Ctrl-C 停止并清理临时私有状态。该服务仅 loopback，使用真实候选客户端；没有可用的发送/模型/安装动作。页面中“首次任务已完成”只能作为合成自述演示。

同事后续体验验收：打开教学首页，确认最近任务可达；在 14/18/22 字号和浅深色检查七项教学工具；进入首次任务指引，选择本人可用的文件夹、编辑匿名样例、打开草稿；自行选择模型并发送，审阅后确认完成。不要在反馈内贴学生资料或 Key。问题反馈先预览、撤销再重试，明确提交后核对本地回执；重开与维护者处理后主动查询，实际复核问题是否解决。课程模块本轮不验收。

## 父审查后补：问题帮助与有界校验

使用指南提供六项由教师主动展开的纯文本帮助：网络或 Hub 不可达；缺少/无效 Key；服务繁忙/限流；服务明确拒绝额度/余额；工作文件夹不可访问；安装结果不确定。Key 仅指向公开的“设置 → 模型”路径；繁忙不能推断余额耗尽。安装不确定先核对已有回执并正常重开，避免重复安装或卸载。展开帮助不读取聊天、Key、工作文件，不自动探测、重试、安装或调用模型，不新增 RPC。

接收器隐私拒绝规则保持原有凭据、邮箱、私人路径和授权链接语义；只优化扫描策略。以每种 6000 字中文/ASCII/尾部 @/重复普通 URL 各 20 次的合成批量校验验证有界耗时，所有输入均非生产资料。

完整 Mac 候选只准备输入清单：本轮两个候选包、冻结的 expert/font.1 和现有固定技能归档引用。需先评审已有 rc4.2/source `67768251d96aa189a2819c0da18a63d0f0d9bdec`，再另行决定全量 app 构建/签名/交付。未构建 Windows，未安装或迁移 Home，未向同事发送邀请或消息。

## 初版实际交付（保留历史，不作为父审查最终候选）

最终机器证据：`.work/product-polish/RESULT.json`。237 个独立自动化用例最终通过；其中浏览器 4 组，包含 108 个字号/主题/视口/页面组合、28 张带哈希截图、实际滚动可达及主按钮普通/悬停对比度检查。反馈提交、管理员状态更新、教师主动查询通过真实 loopback HTTP；SDK/Gateway 回归及最终归档提取后的 Host 测试通过。临时服务已停止。

最终分发输入只使用 `packages/final/`。两个 TGZ 复包字节一致，所有成员哈希及浏览器使用的 client.js 已核对。早先本地候选保留为被替代的历史字节，不分发；staging-history 保留原描述符，未覆盖旧归档。

| 候选 | 字节 | SHA256 |
| --- | ---: | --- |
| qcu-branding 0.2.6-pilot.1 | 15550 | `faea05c2b92d8ba0fc5f5eb2e7911cf048c1b280925719fef6af326be1d1b45e` |
| qcu-market 0.1.0-pilot.16.0 | 79923 | `8bbe7c905c8bcb1cbba5271ff0541fde60fe6afee88fd8b36325eb1134356572` |

这些是未发布候选，不是已安装更新。课程、专家与官方源码及两套信任 pin 未变。未测原生完整 Mac 应用、Windows、生产 Hub/管理员登录/实际有效期与续期、真实 Key/模型、教师业务效果；旧归档协议配对矩阵未复跑，已测当前版本不一致与旧 Host 缺反馈能力的安全失败。本轮没有读取使用中的 DSH Home、调用真实模型、部署生产或递归代理。
