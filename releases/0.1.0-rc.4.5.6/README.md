# QCU Buddy 0.1.0-rc.4.5.6

构建 rc45.7；沿用 0.1.0-rc.4.5 数据套件。QCU助手/城院助手对外名称统一为 QCU Buddy，采用官方深蓝图形标，不带学校文字。图形来自用户提供的 LOGO QCU.ai 矢量路径，未生成或重绘校徽。

## 安装包

- Mac Apple Silicon：mac-arm64/QCU-Buddy-0.1.0-rc.4.5.6-mac-arm64.zip
- Windows x64：win-x64/QCU-Buddy-0.1.0-rc.4.5.6-win-x64.zip

安装前正常退出旧版（包括托盘）。Mac 完整解压后打开 QCU Buddy.app；Windows 完整解压到本地短路径，例如 C:\QCUBuddy，再打开 QCU Buddy\QCU Buddy.exe。不要在 ZIP 内或 \\Mac\Home 共享目录直接运行。详见平台安装说明。

欢迎页、窗口标题、导航、关于及应用图标同步改名。内部身份、模型配置与数据目录沿用旧版；新包不自动删除或重置数据。不要手动改旧数据文件。已知正式4.5.1—4.5.5可保留配置升级，其他测试构建可能被安全拒绝。

首页告知后基础故障上报默认开启，可直接关闭；旧版明确关闭保持。工具市场和基础故障上报继续使用现有云端。云端已接受本次rc45.7构建。

Mac 使用 ad-hoc 签名，未经 Apple 公证；Windows 自制启动器未商业签名，供应商主程序有效签名保持。Windows 在 Windows11 ARM 虚拟机运行 x64 包验证，实体 Intel/AMD 机器仍待试用；本轮没有调用真实模型或验收教师业务效果。

校验见 SHA256SUMS，验收摘要见各平台 final-validation.json。
