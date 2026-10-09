# 第二台 Mac：独立对话安装试验 test.1

这是内部合成试验包，不是 App 安装程序、CSV 升级或正式 Hub 发布。固定官方 DeepSeek Harness 0.2.0-rc.2 / Apple Silicon。原已验收 CSV Home 不采用、不复制、不改写；新 Home 专用于本次管理器安装试验。用户已同意此范围，但每次管理审批仍要本人审阅。

准备助手只检查签名/固定版本、生成新独立配置、提供本机回环目录、下载校验合成包和核对安装状态。不会启动/停止 App、安装包、调用模型、代点审批、读模型设置或配置协议/开机自启。无需系统 Python；使用官方 App 自带 Python。模型只在新试验 App 的官方设置中由你私下配置，不复制原 profile，不把 API Key 发给任何人。

当前验收：用户于 2026-10-09 15:19（Asia/Shanghai）反馈 CHECKLIST 全部 PASS，包含真实管理审批及安装、启用、停用、可选移除和正常重启链路。见 [人工验收证据](evidence/hub-dialogue-second-mac-user-acceptance.json)。以下保留已交付 test.1 的执行说明；无需为记录更新重新运行已通过的试验。

## 1. 解压后，在终端 A 准备并开私有目录

假定下载包解压到 Downloads/QCU-Dialogue-Install-Pilot-test1。若你选择其他位置，只调整 KIT；不要把 TRIAL_HOME 改为已验收的 CSV Home。

```sh
APP="/Applications/DeepSeek Harness.app"
KIT="$HOME/Downloads/QCU-Dialogue-Install-Pilot-test1"
TRIAL_HOME="$HOME/Library/Application Support/QCU Dialogue Install Pilot"
PYTHON="$APP/Contents/Resources/runtime/primary-runtime/dependencies/python/bin/python3.12"
"$PYTHON" "$KIT/dialogue-pilot.py" prepare --app "$APP" --home "$TRIAL_HOME"
"$PYTHON" "$KIT/dialogue-pilot.py" serve
```

prepare 成功才继续。serve 会打印 http://127.0.0.1:实际端口/catalog.json；它没有会话 token，仅在本机随机空闲端口服务两个合成文件。保持终端 A 打开。不会使用/停止原19390或其他服务。出现签名、版本或已有 Home 拒绝，停止反馈固定错误，不改门槛/删锁/覆盖目录。

生成器从你的签名 App 读取完整官方 Standard 配置，仅把 tool-plugin-manager 的 disabled 从 true 改 false，保留全部其他条目和 !!js 平台表达式。真正标识是 preset-standard.config.plugins；配置替换不深度合并。Creator/其他 preset、HMR 关闭；workspace-write+ask 保持。未设置永久 Full Access、自动批准、版本豁免或 build-script 授权。

## 2. 终端 B 打开新试验 App

在另一个终端标签页重新定义这四个变量，再执行启动命令。这里只启动新独立 Home/userData，原配置仍保留；不要全局结束同名 App。

```sh
APP="/Applications/DeepSeek Harness.app"
KIT="$HOME/Downloads/QCU-Dialogue-Install-Pilot-test1"
TRIAL_HOME="$HOME/Library/Application Support/QCU Dialogue Install Pilot"
PYTHON="$APP/Contents/Resources/runtime/primary-runtime/dependencies/python/bin/python3.12"
cd "$TRIAL_HOME/workspace" && env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="/usr/bin:/bin" DSH_HOME="$TRIAL_HOME" DSH_AGENTS_HOME="$TRIAL_HOME/agents" ZDOTDIR="$TRIAL_HOME/shell-empty" "$APP/Contents/MacOS/DeepSeek Harness" --user-data-dir="$TRIAL_HOME/electron" >/dev/null 2>&1 &
```

保持终端 B 打开；App 日志不保存或贴入反馈。新窗口打开后按官方流程完成初始化，在新 App 官方设置私下配置可用模型。不能跳过的账号/安全提示正常处理或停止反馈。新建 Standard 会话，保持 workspace-write+ask。若窗口没打开，不重复启动或删锁，先反馈“窗口未打开”。

在新会话发送：只调用官方 plugin_manager 的 list_bundles，不安装或修改任何项目。
它即便列表查询也请求本次 danger-full-access：核对动作是 list_bundles 后只允许一次。应看到真实 Manage profile plugins/管理插件工具结果。没看到真正工具调用、工具不可用或没审批，先停止反馈，不用 shell 安装代替。

## 3. 下载核验并保存拒绝前基线

在终端 B，把 CATALOG_URL 改为终端 A 打印的回环目录 URL。这是合成目录地址，不要使用 App 的认证地址。

```sh
CATALOG_URL="http://127.0.0.1:实际端口/catalog.json"
"$PYTHON" "$KIT/dialogue-pilot.py" fetch --home "$TRIAL_HOME" --url "$CATALOG_URL"
"$PYTHON" "$KIT/dialogue-pilot.py" snapshot --home "$TRIAL_HOME"
```

fetch 应打印固定 SHA256 与本机安装 target。包是 qcu-dialogue-install-probe 0.0.1-test.1，1279 字节；SHA256：
8b8ad2afc154278eb835a48305ce54c01d4ccc733b8f1896f807aa06dd00632e

只把 target 用在你自己的 App，不发给负责人或写入反馈。snapshot 要求合成包当前不存在；不会采用已安装包来伪造拒绝无变更。基线仅哈希安装元数据/合成包状态，不比较会话记录或读取模型设置。下载/哈希失败不写入包，不安装。

## 4. 模型请求安装：先拒绝，再允许一次

在 Standard 会话发送以下内容，用 fetch 打印的实际 target 替换占位符：

> 只调用官方 plugin_manager：action=install_bundle，target=我已核验的本机绝对路径〈target〉，enabled=true。不调用其他工具；不请求 approvedBuilds，不设置版本豁免，不启用任何插件 row。显示真实审批。若我拒绝，立即停止，不换方法安装。

第一次在真实审批中核对动作和精确包，然后点拒绝。终端 B 执行：

```sh
"$PYTHON" "$KIT/dialogue-pilot.py" check-rejected --home "$TRIAL_HOME"
```

应 PASS：安装元数据和合成包状态未变。若失败停下，不自动修复。

重新发送相同安装请求，这次核对后点允许一次。安装结果应为固定包/版本；application 可能是 restart-required。若 failed、stop-profile、pendingBuilds、版本不兼容或要求豁免，停止反馈；不要批准构建脚本或自行修补官方代码。然后：

```sh
"$PYTHON" "$KIT/dialogue-pilot.py" check-installed --home "$TRIAL_HOME"
```

应 PASS：安装文件与受信任包逐字节相同。官方 plugin_manager 没有 hash 参数；显式下载核验是前置步骤，不声称其强制验证 Hub 哈希。安装后的 Host 代码持久留在这个测试 profile，运行在工作区沙箱之外；单次审批不会永久改变会话权限。

## 5. 按官方生命周期激活合成标记

HMR 关闭时安装新 Bundle 后先在此试验 App 菜单正常 Quit，再执行步骤2相同启动命令。不要只关窗口、删锁或结束其他 profile。安装本身不会激活默认 disabled 的合成 row。

重启后让模型只调用 plugin_manager list_plugins。核对后只允许一次，从真实结果取得 moduleName=qcu-dialogue-install-probe 的精确 entryId；不得猜测 ID。随后请求 plugin_manager set_plugin，target=该 entryId，enabled=true，审阅并允许一次。正常 Quit/restart 此试验 App。

重启后只调用官方 skill 工具，name=qcu-dialogue-install-probe。展开真实工具结果，应含精确标记 QCU_INSTALL_PROBE_TEST_1；助手正文里说“已加载”不算。会话保持 workspace-write+ask。标记 Skill 只有固定合成文字，不读文件、联网、执行工具或子进程。

## 6. 收尾与可选移除

让模型只调用 plugin_manager set_bundle，target=qcu-dialogue-install-probe，enabled=false；本人审阅后允许一次。正常 Quit/restart，此时标记 Skill 应不再可用，安装文件仍可保留。

如需移除，在这次已取消 Bundle 选择的重启之后，再请求 plugin_manager remove_bundle，target=qcu-dialogue-install-probe，审阅并允许一次。随后按返回要求正常重启并执行：

```sh
"$PYTHON" "$KIT/dialogue-pilot.py" check-removed --home "$TRIAL_HOME"
```

应 PASS，并核实 Skill 仍不可用。不要在 Bundle 仍被当前启动加载时直接移除：官方无 HMR 的管理器会拒绝 stop-profile，这是生命周期门槛，不能绕过。不要删锁或 shell 强删插件。

终端 A 按 Ctrl+C，只停止新回环目录。从菜单 Quit 此试验 App。原 CSV Home 与安装保持；不自动删除试验 Home，因为其中可能已有你后来新建的工作。

## 反馈与验收边界

按 CHECKLIST.txt 填 PASS/FAIL/未测即可。只反馈版本、动作结果和固定错误代码；不要贴认证 URL、API Key、原日志、个人目录、完整思考内容或截图原件。需要真实工具证据时只保留包名/动作/返回状态或合成标记，隐藏路径等信息。

本包已通过配置生成、签名检查、临时回环下载、路径/Host/哈希拒绝和安装状态核验代码检查。代理没有在第二台启动 App 或安装插件；早期管理审批测试桩不是原生证据。后续第二台用户人工完成真实模型/审批及安装生命周期，结果单独记在上述验收证据。此次是“回环目录下载核验 + 模型调用官方管理器”的本机链路；实际城院 Hub 可达性、模型自动检索/下载、默认 Skill 全目录发现和正式分发仍未验证；packageReady=false。

