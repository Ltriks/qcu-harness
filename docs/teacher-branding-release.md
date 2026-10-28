# QCU助手品牌更新交付（2026-10-22）

用户最终选择原创图标、名称“QCU助手”。本轮统一应用入口图标、界面左上角图标/名称和空白会话图标，不修改九项教学能力的产品版本，不发布Hub，不提交或推送Git。

固定取包、用法及图标文件见主仓库[releases/README.md](../../../releases/README.md)和[branding](../../../releases/branding/README.md)。

## 推荐产物

| 平台 | 归档 | 字节 | SHA256 |
| --- | --- | --- | --- |
| Mac Apple Silicon、macOS13+ | QCU-Teacher-0.1.0-rc.3-mac-arm64-r2.zip | 397473940 | 8b51324c84b5d166f38e55b1e52096f0b2f28aecaeb4865e294fc0e4e9d7fbf1 |
| Windows x64 | QCU-Teacher-0.1.0-rc.3-win-x64.zip | 401343555 | e26caff128df28ea0b59a2dbfe105c1d187d9772e558f322a644ea6e06111246 |

Mac解压双击 `QCU助手.app`，Windows解压进入短目录 `QCU助手` 后双击 `QCU助手.exe`。Mac固定目录已额外解压r2供本机打开。用户无须运行安装脚本、手工装插件或启用组件。

## 实现和构建

- 矢量源 `branding/qcu-assistant/icon.svg`，设计说明同目录README；`scripts/render-qcu-icon.swift` 和 `scripts/build-brand-assets.py` 生成PNG、ICNS、ICO及无外部依赖的品牌组件。
- `tools/teacher-branding/` 使用官方三个品牌插槽。禁用 `ui-brand-official`，加载 `qcu-branding@0.1.0`；九项功能包维持rc.2冻结版本，新增组件仅负责界面标识。
- `scripts/build-branded-teacher.py` 只接受摘要固定的rc.2干净包。Mac更改显示名、图标后重新本地签名；Windows更换外部图片并使用带ICO的自有启动器；两端ASAR摘要不变。
- Mac内部CFBundleName保留为DeepSeek Harness，与既有Helper目录保持一致；外层应用名、显示名和侧栏名称为QCU助手。嵌套框架与Helper不改，定制主APP签名为ad-hoc，尚无Developer ID/公证，不声称保留原厂APP签名。
- WindowsC#启动器在Windows11 ARM64虚拟机以x64目标和 `/win32icon:QCU.ico` 编译，原厂EXE Authenticode仍Valid。Windows原生x64物理机与新版GUI未验收。
- rc.3有独立个人目录。`start.cjs` 识别对应rc.2固定seed回执，复制旧数据到新目录再加入品牌组件；旧目录不改。保留模型设置和工作文件，更新套件自身飞书CLI路径。未知回执、符号链接或不支持的配置拒绝自动复制。原始DSH个人目录不在自动迁移范围。

构建使用 `scripts/build-brand-assets.py` 和 `scripts/build-branded-teacher.py`；Mac最终源目录 `.work/branded-fixed/0.1.0-rc.3/`，Windows最终源目录 `.work/branded-final/0.1.0-rc.3/`。早期 `.work/branded-release/` 为构建试样，取包以固定releases目录和上表摘要为准。

## 验收证据

- 九项保护测试通过：`node --test tests/teacher-suite.test.cjs`，包含旧版配置复制保留及未知回执拒绝。
- `tools/teacher-branding/verify.cjs` 使用实际SDK的SlotRegistry和React18服务端渲染，验证三个插槽有唯一标识、名称QCU助手及内嵌SVG；日志 `.work/brand-mac-sdk.log`。React测试依赖只在 `.work/brand-test-runtime/`，未打入教师包。
- Mac最终r2ZIP：`.work/branded-mac-r2-verification/result.json`及同目录日志。解压库存一致、定制签名、Helper匹配、中文空格路径、原生准备、移动后重复准备保留配置、阻断网络/子进程下九模块和七技能读取通过。ASAR不变，定制文件限制为Info.plist、图标及签名相关文件。
- 真实rc.2测试profile的YAML复制检查：`.work/brand-mac-migration.log`，源码 `tools/teacher-branding/verify-migration.cjs`；合成模型设置、工作文件、CLI绑定和旧目录不变通过，未读取真实凭据内容。
- Windows最终ZIP：`.work/brand-win-{download,extract,prepare,smoke,migration}.log`。系统自带Expand-Archive解压9875文件、ZIP摘要匹配、原生准备/重复准备、官方EXE签名、离线九模块/七技能及真实YAML升级复制通过。测试目录在 `%LOCALAPPDATA%\QCUBrandTests\rc3\final 中文 空格\QCU助手`，未通过脚本启动GUI。
- 用户手动确认Macr2：“正常打开，图标和名称正确”。这项是用户GUI验收，不能写成自动化GUI测试，也不能据此认定模型调用、飞书授权或WindowsGUI已通过。

## 本轮修复和失败记录

1. Windows早期ZIP外层版本目录过长，连同内置办公引擎目录超过传统Windows解压路径限制；PowerShell回滚掩盖原始错误，标准.NET解压显示深层文件路径失败。缩短ZIP内部根目录为“QCU助手”后，系统解压通过；不要求教师修改系统设置。
2. Mac首份rc.3用户GUI意外退出。三份本机崩溃摘要为SIGTRAP，原生准备模式此前成功，不能代表GUI启动成功。核对[Electron44辅助进程定位源码](https://github.com/electron/electron/blob/v44.0.0/shell/app/electron_main_delegate_mac.mm)及[应用名读取源码](https://github.com/electron/electron/blob/v44.0.0/shell/common/application_info_mac.mm)：CFBundleName参与Helper路径定位。修复为保留内部名称、仅改显示名与图标，构建器和验收脚本均加入Helper匹配检查；r2由用户实际确认恢复正常。
3. 无r2的Macrc.3 ZIP及解压目录保留为失败记录，不作为可用交付。r2与原rc.3使用相同seed及数据目录，不覆写已复制的个人配置。
4. Windows来宾诊断一度错误比较GUI子系统程序的PowerShell LASTEXITCODE，改为Start-Process等待并读取进程退出码后通过；长来宾指令拆短，避免Parallels静默退出5。这些是验证工具修正，未改教师产品流程。

本轮临时传输仅服务指定发布文件，已结束并关闭51919端口。尚待正式分发签名/公证、第二台Mac、Windows新版GUI/原生x64硬件、模型与飞书业务验收。原rc.1/rc.2包和用户原有主仓库README修改保留。
