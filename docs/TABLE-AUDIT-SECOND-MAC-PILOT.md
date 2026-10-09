# 第二台 Apple Silicon 内部试用

QCU Apple Silicon 内部合成 CSV 试用 — prototype.8

这是插件/样例/说明的小型内部试用包，不是官方 App 安装程序，也不是正式发布包。源码 ZIP 不能用来安装。固定官方基线为 DeepSeek Harness 0.2.0-rc.2 / Apple Silicon，插件版本 0.2.0-prototype.8。仅试用合成 CSV；CSV流程不使用学生或教师私人材料，不把CSV数据交给模型。Standard最小文字测试只用无私人数据的句子。

本机已完成：官方 CLI 安装及20个文件比对、真实 Desktop Host 的专用WebSocket、78项自动回归与独立复测。prototype.7历史用户原生手测：检查显示4行/7问题，文件选择取消后重选、计数摘要保存取消后重试均反馈通过。用户手测不是自动GUI测试。第二台 Mac 的原生核心流程及审批分支已有用户人工通过反馈，详见文末最新记录；附带 Skill 真实加载也已补证；全部默认目录发现、模型对话安装和正式发布仍未验证。


配置范围与历史问题
本版只恢复官方Standard及其常规文件/终端/网页工具与配套UI。Creator、其他preset和Standard的Plugin Manager工具继续关闭；不修改官方DSH源码。运行权限固定workspace-write+ask，需审批的动作仍走官方逐次审批；不新增目录许可，不启用FullAccess/自动批准。标准工具目录本身不等于已批准每次执行。
prototype.7旧包是受限CSV验收配置，New Session曾报standard preset缺失，不能当日常版；它保留为历史证据。本版prototype.8收窄插件guard，不再拦普通工具，但表格Agent直接、嵌套和别名调用仍拒绝；逐文件页面授权不能由聊天替代。
恢复默认Skill发现意味着官方Standard可发现项目.dsh/skills、.agents/skills，以及专用DSH_HOME/skills、DSH_AGENTS_HOME/skills和官方内置Skill。小助手不复制其他profile、Skill目录或APIKey；每台Mac只在自己的官方设置中私下配置模型。
本机prototype.8已通过78项回归、独立78项复测、官方CLI安装20文件比对，正常退出重启后实际Desktop Host Standard会话创建与最小纯文字对话通过。浏览器/API证据不是原生GUI操控；prototype.7的三个原生用户手测不能泛化为prototype.8全验收。第二台原生核心及审批分支现已用户人工通过；附带 Skill 真实加载已补证，全部默认目录发现及自然语言安装仍待验证，详见文末记录。

1. 从官方固定来源下载并正常安装 App
https://download.deepseek.com/dsh-desk/bin/mac-arm64/deepseek-harness-0.2.0-rc.2-mac-arm64.zip
zip应为374053565字节，SHA512（Base64）应为：
BIC7PMWuEEzM7OuK8tMXQR0AdtVlYrSP1usHGWSAOhbxeXOzq2s1i71jZphMQSoQ/8tUQr55a158JW8xScseuA==
在macOS终端对下载zip执行以下只读命令并比较结果：
  openssl dgst -sha512 -binary deepseek-harness-0.2.0-rc.2-mac-arm64.zip | openssl base64 -A
通过macOS正常安装/打开流程处理官方App。不要覆盖已有不同版本、不移除隔离属性、不跳过安全提示、不禁用签名检查。若需要替换已有版本或官方要求更新，先停止反馈，由试点负责人确定版本，不使用allow-version豁免。
固定zip来自官方更新元数据，来源/版本不是“当前最新版”承诺。App和完整runtime不在这个小包里。

2. 准备一个全新的独立试用Home
解压本包，以下假定目录为Downloads/QCU-AppleSilicon-Pilot-prototype8。若你选了其他目录，修改KIT。以下APP指向你通过官方流程安装的App；不要使用源码或未签名开发App。
  APP="/Applications/DeepSeek Harness.app"
  KIT="$HOME/Downloads/QCU-AppleSilicon-Pilot-prototype8"
  PILOT_HOME="$HOME/Library/Application Support/QCU Standard CSV Pilot"
  PYTHON="$APP/Contents/Resources/runtime/primary-runtime/dependencies/python/bin/python3.12"
  "$PYTHON" "$KIT/pilot.py" prepare --app "$APP" --home "$PILOT_HOME"
小助手只校验Apple Silicon、固定版本、官方签名/Gatekeeper、包与配置哈希，准备你明确指定的新独立Home；不安装/改写App，不设置dsh默认程序，不启动App，不获取新权限，不读取原profile。已存在的非空、未标记目录会被拒绝。使用自带Python和CLI，无需安装系统Python或开发环境。

3. 官方 App 初始化该 Home，然后完全退出
官方 App 首次启动会自行注册dsh://默认打开程序。这是官方App行为。如果已有另一个默认程序且你不愿更改，先停在这里反馈，不直接启动。此小助手不做协议关联更改或恢复。你选择启动前，应记录原默认选择，按正常系统方式处理可能的提示；不要把本机曾批准的临时切换当作第二台机器的批准。
在上述同一终端执行：
  cd "$PILOT_HOME/workspace" && \
  env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="/usr/bin:/bin" DSH_HOME="$PILOT_HOME" DSH_AGENTS_HOME="$PILOT_HOME/agents" ZDOTDIR="$PILOT_HOME/shell-empty" "$APP/Contents/MacOS/DeepSeek Harness" --user-data-dir="$PILOT_HOME/electron"
这组命令先切换到专用workspace；cd失败不会启动App，避免从Downloads启动使常规工具的工作区错位。只使用独立Home/userData和空的shell配置目录，不导入个人环境中的模型凭据，不新增调试端口。正常处理官方提示；CSV检查无需APIKey，若有“Configure later”可先稍后配置。不能跳过的账号/安全提示应按官方流程处理或停止反馈；脚本不会伪造完成状态。认证地址不贴入反馈或聊天。
App将自行初始化profiles/desktop。之后从应用菜单正常Quit（Cmd+Q），不是只关窗口；不要删除lock。若终端命令仍在运行，先等App真正退出。脚本不会替你关闭应用。

4. 官方CLI安装并启用独立Bundle
回到同一终端执行：
  "$PYTHON" "$KIT/pilot.py" install --app "$APP" --home "$PILOT_HOME"
助手要求官方已初始化该Home且App完全退出，使用自带CLI和官方npm registry安装已验证tgz；现有安装文件若一致则不重复安装。随后只在这个专用profile选择Bundle并启用Task/Guidance，自动按你的实际App/Home生成runtime路径和0700工作目录。包内默认Bundle仍关闭。没有手工覆盖App或官方源码，不关闭认证/OriginHost/签名门槛。
首次安装需要网络访问官方npm registry；ws固定8.21.0，官方peers固定rc.2。安装失败时保留官方诊断和状态，先核查，不手动删锁、改全局pnpm或添加版本豁免。源码包/历史ZIP不能代替该tgz。

5. 再执行步骤3中的相同启动命令，做真正第二台原生验收
先点击New Session，确认官方Standard会话可创建。若已在官方设置私下配置可用模型，可发送“只回复：QCU 对话测试通过，不要调用工具”；没配置则记未测，不向任何人提供APIKey。然后点击侧栏“CSV只读诊断”。只选择本包synthetic-user.csv；先取消文件选择，再重选。选择演示规则（本包个人规则与演示相同，可另切换验证），勾选本文件只读授权，点击“授权本次文件”和“检查/再次检查”。应显示记录4、问题7，重复检查相同。
点击“导出仅计数摘要”，先取消系统保存，再重试保存。若直接下载没有保存对话框，报告“直接下载”，不能计为保存取消通过。JSON只能包含status/rows/issues/counts，不能有原始行、文件名或路径。取消并撤销后重选需要重新授权。
Task/Guidance与包内只读Skill provider一同交付；Skill正文只是操作指引，不替代逐文件确认。不要用旧Hub自定义Skill复制/安装器，不通过聊天工具绕过任务页面。官方Plugin Manager可作为正常管理入口；自然语言对话安装尚未验通，Creator/Standard默认能力不同，不能声称已支持。Hub catalog/上线可达性也未由本包证明。
CSV试用不需要模型APIKey。若今后试验模型功能，每人只在自己的官方App私下配置；不要发给试点负责人、填入包或反馈记录。

第二台通过标准与反馈
请填写SECOND-MAC-CHECKLIST.txt：App/插件版本、是否原生4/7、文件选择取消重选、保存取消重试、仅计数JSON、撤销重选、正常退出重启后旧授权失效。记录通过/失败/未测，错误只描述固定提示，不含认证URL、APIKey、私人文件内容或运行日志。签名/权限/版本提示出现时保留原检查，不绕过。第二台结果由实际操作者提供后才能记通过。真实工具审批只在操作者愿意且明确授权的合成workspace中测试，不把模拟审批桩算作真实界面通过。

结束试用
在任务页取消并撤销，再从菜单正常Quit独立App。保留此独立Home便于回收；如要删除，先确认其中没有你后来创建的新工作。不要删除官方App或其他profile，也不要全局关闭同名进程。需要恢复原dsh默认程序时按你记录的原选择正常恢复；若这需要新权限/额外操作，先反馈。

内附文件说明
pilot.py：受控的验证/新Home准备/官方CLI安装与配置小助手；不会启动App或改协议。
qcu-table-audit-0.2.0-prototype.8.tgz：可由官方管理器/内置CLI安装的插件，含默认关闭Bundle和只读Skill。
csv-standard-pilot.patch.json：Standard与有界CSV配置模板；绝对路径占位符由助手在你自己的Home解析生成。
synthetic-user.csv、synthetic-personal-rules.json：人工合成示例；演示不是学校正式规范。
qcu-csv-readonly-task.SKILL.md、bundle-default-disabled.json：包内只读说明/默认Bundle的参考副本，不是额外自定义安装器。
VERSION-AND-SOURCES.json、LOCAL-MAC-ACCEPTANCE.json：固定来源和已完成/未完成证据边界。
SHA256SUMS：本包内文件完整性清单（不含清单自身）；只在受信任来源取得包后进行比较。

补充工程证据：NO-MODEL-INTEGRATION-EVIDENCE.json记录官方工具在临时合成context中的拒绝/单次允许测试桩、真实离线pnpm安装和重建context后的Skill读取；不是用户真实审批、真实Hub上线或模型自然语言安装。LOCAL-PORTABLE-SELF-CHECK.json记录本机临时目录的配置生成、停机/锁/哈希保护及真实引擎4/7，未启动第二个Desktop实例、未再次安装或修改当前环境。


## 第二台 Mac 最新人工验收（2026-10-09 记录）

用户在固定官方 rc.2 / prototype.8 上报告：独立 Home 初始化、正常 Quit 后官方 CLI 安装、独立 workspace 的 Standard 会话、workspace-write+ask、自己配置模型后的最小文字对话均通过。原生 CSV 连续两次均显示 4 行/7 问题；系统文件选择取消重选、计数摘要保存取消重试、摘要只有 status/rows/issues/counts、撤销后重新授权、正常退出重启旧授权失效均由用户人工确认通过。没有把此反馈转换为代理自动 GUI 验收。

用户消息 Sentinel_4c03299e714481919c81f11cf6ea0fdc 明确反馈“已经完成3步验证，123步都预期完成”，对应先拒绝确认文件未创建、重试仅允许一次确认成功、恢复 workspace-write+ask。这三项记为第二台真实审批的用户人工通过；未启用 Full Access 或自动批准。本机早先的审批模拟桩及本机未控原生记录保持独立。

主对话查看型号截图确认：Mac mini 2024、Apple M4 Pro、48 GB、macOS Tahoe 26.7.1。仅记录这四项通用环境信息，不提交截图原件、序列号、个人目录、模型凭据或认证地址。

Skill 截图可见的是助手回复正文，含“工具卡片：Load skill qcu-csv-readonly-task”文字及完整只读指引；没有展示真实工具调用区域。该早期截图不能用作真实加载证据。用户随后提供展开的真实工具调用截图（Sentinel_38c1abf96edc8191823d78f534519d5a），主对话查看像素确认“加载技能 · qcu-csv-readonly-task”卡片、返回 skill_content 的确切名称及完整指引正文，资源位于独立 Home 内的相对路径 profiles/desktop/node_modules/qcu-table-audit/skills/qcu-csv-readonly-task。附带 Skill 真实加载现记为用户人工通过；不提交截图、个人绝对目录或思考正文。CSV 侧栏注册的是任务页，附带 Skill 本身不注册另一个侧栏入口。默认 Skill 发现开关开启，也不意味着新独立 Home 会复制其他 profile 的 Skill，或凭空出现新条目；附带指引可读也不能单独证明所有项目/用户默认目录的发现均已通过。

成功 prepare/install 的源码路径执行 App 严格签名验证、官方 Team ID、Gatekeeper、插件与配置 SHA256 和安装文件逐字节比较等检查；此为安装助手定义及用户成功反馈的结合，不是代理收集到第二台原始命令输出。Safari 自动解压不取消 App 签名检查，但原始官方下载 ZIP 的 SHA512 比较仍未证明。

第二台原生核心、审批分支及附带 Skill 真实加载已人工通过；全部默认 Skill 根目录发现、模型对话安装、Hub 可达性与正式分发仍未验证，packageReady=false。机器可用性反馈不扩大为这些事项通过。结构化证据见 [第二台人工验收](evidence/table-audit-second-mac-user-acceptance.json)。
