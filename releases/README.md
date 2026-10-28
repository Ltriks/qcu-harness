# QCU 助手下载与源码索引

本索引在 `dev/qcu-release-archive-20261028` 维护。两个平台独立预发布，版本和功能不同；二进制放 GitHub Release 附件，不提交到 Git。`main` 暂未集成这些开发分支。

| 平台 | 当前固定预发布 | 包含内容与边界 |
| --- | --- | --- |
| Apple Silicon Mac / macOS 13+ | [rc4.3](https://github.com/Ltriks/qcu-harness/releases/tag/qcu-teacher-v0.1.0-rc.4.3-mac-arm64) | 市场16.1、清蓝0.2.6-pilot.2、专家团3.font.1、课程1.3.font.1、七项技能及飞书只读；完整新机 GUI、系统信任及教学效果待验收 |
| Windows x64 | [rc3-r4](https://github.com/Ltriks/qcu-harness/releases/tag/qcu-teacher-v0.1.0-rc.3-win-x64-r4) | 早期主题、七项技能、课程1.2、飞书只读；不含新版市场或专家团；Windows 本地磁盘启动获用户确认 |

下载 Release 附件中 `QCU-Teacher-…zip`，不要下载自动生成的 Source code 充当安装包。每个预发布附中文说明、离线 HTML 指南、`PROVENANCE.json`、`ARCHIVE-CHECK.json`、`LICENSES.zip` 和 `SHA256SUMS`。先核对 SHA256，再完整解压。GitHub 附件和原固定包字节一致；ZIP 内历史构建状态标签不因本次发布改写。

两者均内置 DSH `0.2.0-rc.2`。当前不要使用官方内核升级按钮升级到0.2.1-rc.3；QCU组件更新与官方应用升级是两条不同通道。用户自备API Key，飞书另行授权。Mac 只有 ad-hoc 签名、未经 Apple 公证；Windows 自有启动器未经商业代码签名。不要通过关闭系统保护处理拦截，保留提示交给维护人员。

Windows 必须解压到本地磁盘后运行 `QCU助手/QCU助手.exe`，不能从 Mac 共享桌面、网络共享或压缩包内部运行。Mac 旧安装保留旧 Home，本版不自动迁移。所有真实模型及资料发送仍需本人确认，下载或浏览不会发送任务。

## 源码和构建

- Mac 源码基于已推送 P16 `ef88ee71552ed84dc7b9d116de8374ee5afdd881`；发布标签在独立归档分支，`release/snapshots/mac-rc4.3/` 保存实际随包组件源码与逐文件摘要。构建命令和输入 pin 见 [Mac准备与构建](../docs/qcu-p16-mac-preparation.md)、[P16交付](../docs/qcu-p16-delivery.md)及 `release/integrated-teacher-macos-rc43.json`。
- Windows 标签位于独立 `dev/qcu-windows-r4-source-archive`，基于历史 `1012167`。已归档57项原打包脚本、测试、模板及实际随包组件、Launcher快照。见[Windows源码归档说明](https://github.com/Ltriks/qcu-harness/blob/qcu-teacher-v0.1.0-rc.3-win-x64-r4/docs/qcu-windows-r4-source-archive.md)。不要用Mac当前源码冒充r4原构建来源。
- 原构建需要配置中固定的官方客户端、旧基础ZIP、审核TGZ、工具链及其精确摘要；Git源码下载并不包含所有二进制输入，也不承诺仅凭clone即可逐字节重建原ZIP。本次只归档，未重建既有安装包。
- 历史rc4.2及rc4.1修正源码分别保留在 `dev/mac-rc42-package`、`dev/rc41-acceptance-fixes`；不改写历史、不合并main。其他线程尚未提交的Hub主题、课程流水线等草稿保留原位，不作为已发布版本。

## 开发、产物和部署位置

主仓库 `$HOME/Repos/cowork/qcu-harness`；并行工作树 `$HOME/Repos/worktrees/qcu-harness/<功能名>`；安装包与验收材料 `$HOME/Artifacts/qcu-harness/<版本号>/`。历史 `releases/` 大文件归档仍保留，逐步按固定产物目录放新包，不直接移动带worktree关联的目录。

Mac原包在 `$HOME/Artifacts/qcu-harness/0.1.0-rc.4.3/mac-arm64/`；Windows原包仍在主仓库的 `releases/0.1.0-rc.3/`，本次未移动。发布附件与上传核验放各版本 `github-release-20261028/`。开发回归命令和精确验收分类见[发布记录](../docs/qcu-github-release-publication-20261028.md)。

现有在线Hub仍仅办公室局域网 `192.168.1.68:8080`，管理员在mini回环8975；GitHub附件提供离线包下载，不替代市场的签名目录、审核发布与反馈服务。本次不修改Hub、mini、已安装App或Home。

[2026-10-28发布结果](publication-20261028.json)：19个附件服务器摘要及两个公开整包下载校验均通过。
