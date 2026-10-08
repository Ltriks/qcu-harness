# QCU Harness

QCU Office、城院 Skill 目录站、插件及办公 Skills 的独立源码仓库。基于固定官方 DeepSeek Harness，保留官方 Bundle/Host/Client/Skill 机制。

这是开发候选，不是已签名或已发布的安装包。cd5f532 已在独立 Mac 候选中加载，工具入口与报告保存获用户人工复测通过；见 [人工验收范围](docs/MAC-USER-ACCEPTANCE.md)。后续源码增量不自动部署。自有材料采用 [MIT](LICENSE)，第三方版权及许可按 [NOTICE](NOTICE.md) 保留。

| 路径 | 用途 |
| --- | --- |
| packages/qcu-thesis-workbench | 完整外置业务包，Python 引擎仍在包内；Host/Client/原生协议及测试 |
| upstream | 固定官方 commit、累计补丁、改动源文件与锁文件；包含 CLI、Desktop Host、app-boot 和 Electron |
| desktop | 固定 QCU Office 入口与本机验收说明 |
| hub | 城院目录站、安装器插件和打包/部署脚本 |
| skills | 10 项城院及 3 项 QCU 通用 Skill 的唯一源码；论文 Skill 随业务包保存 |
| scripts、tests、docs | 重建、合成回归、来源映射和维护限制 |

先读 [维护说明](docs/MAINTENANCE.md)、[重建步骤](docs/REBUILD.md)、[已知限制](docs/KNOWN-LIMITS.md) 和 [第三方归属](NOTICE.md)。目录站中条目暂标为 draft；需要重建对应产物并审查后发布，不因迁入 Git 就声称安装链已通过。

当前开发增量的父进程退出清理与复现证据见 [生命周期说明](docs/HOST-LIFECYCLE.md) 和 [验证记录](docs/LIFECYCLE-VALIDATION.md)。

独立 Mac 合成候选的真实启动已验证；重建须包含官方 Web 静态页面。参见 [Mac 启动验收](docs/MAC-STARTUP-VALIDATION.md) 与 [重建步骤](docs/REBUILD.md)。原生文件选择、下载取消及重试、打印预览仍未验收。

2026-10-08 已重新核实进程并启动同一候选，当前证据与原生阻塞见 [本轮 Mac 验收](docs/MAC-CURRENT-ACCEPTANCE.md)。

新增功能遵循 [插件接入约定](docs/PLUGIN-INTEGRATION.md)。第二功能的 [CSV 任务原型](docs/SECOND-FEATURE-TABLE-AUDIT.md) 已实现默认关闭的 Host/Client、逐文件授权、计数导出及清理恢复，仅合成验证，不替换已验收候选或启用真实 CSV。
