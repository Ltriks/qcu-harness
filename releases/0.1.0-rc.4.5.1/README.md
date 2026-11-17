# 城院助手 rc.4.5.1 · 平台热修试用版

版本 `0.1.0-rc.4.5.1`，构建 `rc45.2`，固定官方 DSH `0.2.0-rc.2`。数据目录沿用 `teacher/0.1.0-rc.4.5`。

| 平台 | 标签 | 安装包 |
|---|---|---|
| Windows x64 | [`qcu-teacher-v0.1.0-rc.4.5.1`](https://github.com/Ltriks/qcu-harness/releases/tag/qcu-teacher-v0.1.0-rc.4.5.1) | [win-x64 ZIP](win-x64/QCU-Teacher-0.1.0-rc.4.5.1-win-x64.zip) |
| Mac Apple Silicon | [`qcu-teacher-v0.1.0-rc.4.5.1-mac-arm64`](https://github.com/Ltriks/qcu-harness/releases/tag/qcu-teacher-v0.1.0-rc.4.5.1-mac-arm64) | [mac-arm64 ZIP](mac-arm64/QCU-Teacher-0.1.0-rc.4.5.1-mac-arm64.zip) |

## 本次对齐

- 工具市场 16.15；目录与固定归档使用腾讯云 `https://111.229.103.201` 签名目录。
- 官方 Harness 内核升级入口禁用（后端阻断）；保留官方最低版本政策。Mac 校验既有 managed ASAR，不套用 Windows ASAR 补丁。
- 已用正式 rc.4.5 的用户沿用原数据目录；仅热修受管市场组件，保留模型配置、收藏、团队与工作文件。

## 平台说明

- Windows：自有启动器未商业签名；须本地短路径解压。详见 [Windows 验收](../../docs/windows-rc451-validation.md)。
- Mac：临时 ad-hoc 签名，**未经 Apple 公证**；Gatekeeper 可能拦截，须本人在系统提示中允许。不要关闭系统保护。详见 [Mac 验收](../../docs/mac-rc451-validation.md)。

公开附件仅安装包、SHA256 与通用安装说明。旧 rc.4.5 ZIP/tag 与各平台已发布附件保持不变；本分支不合并或推送 main。
