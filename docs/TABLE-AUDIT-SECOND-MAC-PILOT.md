# 第二台 Apple Silicon 内部试用

QCU Apple Silicon 内部合成 CSV 试用 — prototype.7

这是插件/样例/说明的小型内部试用包，不是官方 App 安装程序，也不是正式发布包。源码 ZIP 不能用来安装。固定官方基线为 DeepSeek Harness 0.2.0-rc.2 / Apple Silicon，插件版本 0.2.0-prototype.7。仅试用合成 CSV；不使用学生或教师私人材料，不把数据交给模型。

本机已完成：官方 CLI 安装及19个文件比对、真实 Desktop Host 的专用WebSocket、75项自动回归与独立复测。用户在原生官方窗口手测：检查显示4行/7问题，文件选择取消后重选、计数摘要保存取消后重试均反馈通过。用户手测不是自动GUI测试。第二台Mac、模型对话安装和正式发布尚未通过。


配置范围与已知聊天限制（交付前现场补充）
此包只建立受限的合成CSV验收profile，不是教师/团队日常对话环境。验收配置关闭聊天preset；当前现场点击New Session得到“agent-preset/not-found: Unknown agent preset: standard”。因此新建聊天不能记为通过，也不能将本包默认配置作为完整日常版。不要为消除提示自行启用模型、终端或文件工具，不复制任何现有APIKey或个人profile。完整日常对话profile的最小修复及权限影响仍在单独核查；本包保持CSV范围，聊天/对话安装未验收。

1. 从官方固定来源下载并正常安装 App
https://download.deepseek.com/dsh-desk/bin/mac-arm64/deepseek-harness-0.2.0-rc.2-mac-arm64.zip
zip应为374053565字节，SHA512（Base64）应为：
BIC7PMWuEEzM7OuK8tMXQR0AdtVlYrSP1usHGWSAOhbxeXOzq2s1i71jZphMQSoQ/8tUQr55a158JW8xScseuA==
在macOS终端对下载zip执行以下只读命令并比较结果：
  openssl dgst -sha512 -binary deepseek-harness-0.2.0-rc.2-mac-arm64.zip | openssl base64 -A
通过macOS正常安装/打开流程处理官方App。不要覆盖已有不同版本、不移除隔离属性、不跳过安全提示、不禁用签名检查。若需要替换已有版本或官方要求更新，先停止反馈，由试点负责人确定版本，不使用allow-version豁免。
固定zip来自官方更新元数据，来源/版本不是“当前最新版”承诺。App和完整runtime不在这个小包里。

2. 准备一个全新的独立试用Home
解压本包，以下假定目录为Downloads/QCU-AppleSilicon-Pilot-prototype7。若你选了其他目录，修改KIT。以下APP指向你通过官方流程安装的App；不要使用源码或未签名开发App。
  APP="/Applications/DeepSeek Harness.app"
  KIT="$HOME/Downloads/QCU-AppleSilicon-Pilot-prototype7"
  PILOT_HOME="$HOME/Library/Application Support/QCU CSV Pilot"
  PYTHON="$APP/Contents/Resources/runtime/primary-runtime/dependencies/python/bin/python3.12"
  "$PYTHON" "$KIT/pilot.py" prepare --app "$APP" --home "$PILOT_HOME"
小助手只校验Apple Silicon、固定版本、官方签名/Gatekeeper、包与配置哈希，准备你明确指定的新独立Home；不安装/改写App，不设置dsh默认程序，不启动App，不获取新权限，不读取原profile。已存在的非空、未标记目录会被拒绝。使用自带Python和CLI，无需安装系统Python或开发环境。

3. 官方 App 初始化该 Home，然后完全退出
官方 App 首次启动会自行注册dsh://默认打开程序。这是官方App行为。如果已有另一个默认程序且你不愿更改，先停在这里反馈，不直接启动。此小助手不做协议关联更改或恢复。你选择启动前，应记录原默认选择，按正常系统方式处理可能的提示；不要把本机曾批准的临时切换当作第二台机器的批准。
在上述同一终端执行：
  env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="/usr/bin:/bin" DSH_HOME="$PILOT_HOME" DSH_AGENTS_HOME="$PILOT_HOME/agents" ZDOTDIR="$PILOT_HOME/shell-empty" "$APP/Contents/MacOS/DeepSeek Harness" --user-data-dir="$PILOT_HOME/electron"
该命令只使用独立Home/userData和空的shell配置目录，不导入个人环境中的模型凭据，不新增调试端口。正常处理官方提示；CSV检查无需APIKey，若有“Configure later”可先稍后配置。不能跳过的账号/安全提示应按官方流程处理或停止反馈；脚本不会伪造完成状态。认证地址不贴入反馈或聊天。
App将自行初始化profiles/desktop。之后从应用菜单正常Quit（Cmd+Q），不是只关窗口；不要删除lock。若终端命令仍在运行，先等App真正退出。脚本不会替你关闭应用。

4. 官方CLI安装并启用独立Bundle
回到同一终端执行：
  "$PYTHON" "$KIT/pilot.py" install --app "$APP" --home "$PILOT_HOME"
助手要求官方已初始化该Home且App完全退出，使用自带CLI和官方npm registry安装已验证tgz；现有安装文件若一致则不重复安装。随后只在这个专用profile选择Bundle并启用Task/Guidance，自动按你的实际App/Home生成runtime路径和0700工作目录。包内默认Bundle仍关闭。没有手工覆盖App或官方源码，不关闭认证/OriginHost/签名门槛。
首次安装需要网络访问官方npm registry；ws固定8.21.0，官方peers固定rc.2。安装失败时保留官方诊断和状态，先核查，不手动删锁、改全局pnpm或添加版本豁免。源码包/历史ZIP不能代替该tgz。

5. 再执行步骤3中的相同启动命令，做真正第二台原生验收
点击侧栏“CSV只读诊断”，不要新建聊天。只选择本包synthetic-user.csv；先取消文件选择，再重选。选择演示规则（本包个人规则与演示相同，可另切换验证），勾选本文件只读授权，点击“授权本次文件”和“检查/再次检查”。应显示记录4、问题7，重复检查相同。
点击“导出仅计数摘要”，先取消系统保存，再重试保存。若直接下载没有保存对话框，报告“直接下载”，不能计为保存取消通过。JSON只能包含status/rows/issues/counts，不能有原始行、文件名或路径。取消并撤销后重选需要重新授权。
Task/Guidance与包内只读Skill provider一同交付；Skill正文只是操作指引，不替代逐文件确认。不要用旧Hub自定义Skill复制/安装器，不通过聊天工具绕过任务页面。官方Plugin Manager可作为正常管理入口；自然语言对话安装尚未验通，Creator/Standard默认能力不同，不能声称已支持。Hub catalog/上线可达性也未由本包证明。
CSV试用不需要模型APIKey。若今后试验模型功能，每人只在自己的官方App私下配置；不要发给试点负责人、填入包或反馈记录。

第二台通过标准与反馈
请填写SECOND-MAC-CHECKLIST.txt：App/插件版本、是否原生4/7、文件选择取消重选、保存取消重试、仅计数JSON、撤销重选、正常退出重启后旧授权失效。记录通过/失败/未测，错误只描述固定提示，不含认证URL、APIKey、私人文件内容或运行日志。签名/权限/版本提示出现时保留原检查，不绕过。第二台结果由实际操作者提供后才能记通过。

结束试用
在任务页取消并撤销，再从菜单正常Quit独立App。保留此独立Home便于回收；如要删除，先确认其中没有你后来创建的新工作。不要删除官方App或其他profile，也不要全局关闭同名进程。需要恢复原dsh默认程序时按你记录的原选择正常恢复；若这需要新权限/额外操作，先反馈。

内附文件说明
pilot.py：受控的验证/新Home准备/官方CLI安装与配置小助手；不会启动App或改协议。
qcu-table-audit-0.2.0-prototype.7.tgz：可由官方管理器/内置CLI安装的插件，含默认关闭Bundle和只读Skill。
csv-native-candidate.patch.json：固定隔离配置模板；绝对路径占位符由助手在你自己的Home解析生成。
synthetic-user.csv、synthetic-personal-rules.json：人工合成示例；演示不是学校正式规范。
qcu-csv-readonly-task.SKILL.md、bundle-default-disabled.json：包内只读说明/默认Bundle的参考副本，不是额外自定义安装器。
VERSION-AND-SOURCES.json、LOCAL-MAC-ACCEPTANCE.json：固定来源和已完成/未完成证据边界。
SHA256SUMS：本包内文件完整性清单（不含清单自身）；只在受信任来源取得包后进行比较。

补充工程证据：NO-MODEL-INTEGRATION-EVIDENCE.json记录官方工具在临时合成context中的拒绝/单次允许测试桩、真实离线pnpm安装和重建context后的Skill读取；不是用户真实审批、真实Hub上线或模型自然语言安装。LOCAL-PORTABLE-SELF-CHECK.json记录本机临时目录的配置生成、停机/锁/哈希保护及真实引擎4/7，未启动第二个Desktop实例、未再次安装或修改当前环境。
