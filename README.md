# QCU Harness

QCU Office、城院 Skill 目录站、插件及办公 Skills 的独立源码仓库。基于固定官方 DeepSeek Harness，保留官方 Bundle/Host/Client/Skill 机制。

这是开发候选，不是已签名或已发布的安装包。尚未部署到用户 Mac；原稳定开发版保持独立。自有材料采用 [MIT](LICENSE)，第三方版权及许可按 [NOTICE](NOTICE.md) 保留；公开推送另行确认。

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
