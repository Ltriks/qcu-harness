# 表格体检隔离试用

2026-10-08 用户已批准合成 CSV 的独立官方 DSH 安装验收。实现与真实浏览器结果见 [安装验收](TABLE-AUDIT-INSTALL-VALIDATION.md)，此前“未安装”的任务证据是历史状态。DSH 源码不改，论文候选及其配置不改；这次授权不包含私人 CSV、正式发布、Windows 或系统权限扩展。

Apple Silicon Mac 使用官方 DSH/Web 0.2.0-rc.2、Cordis 4.0.4、Node ^22.19.0 或 >=24、Python 3.10+。本次实际 Python 3.12.14、Node 24.21.0、pnpm 11.7。不要对正在运行的 profile 执行包管理；专用 profile 正常退出后再安装。本例关闭 HMR，管理页停用只保存配置，须正常退出并重启才应用；卸载先用官方 CLI remove qcu-table-audit，再移除用户层 qcu 的两项配置，重启验证入口消失。

```sh
# 先核对下载包 SHA256 与随包的验收记录；不得启用不明包。
DSH_HOME=/absolute/path/to/isolated-home dsh plugin --profile csv-pilot add ./qcu-table-audit-0.2.0-prototype.5.tgz --ignore-scripts
```

安装只加入依赖和 Bundle，默认两个组件都关闭。专用 profile 的 `package.json` 的 `dsh.profile.bundles` 应包含已安装的 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `qcu-table-audit`。在该 profile 的 `cordis.patch.yml` 用户层显式启用 `qcu-table-audit-task` 和 `qcu-table-audit-guidance`，并为任务配置受信任的绝对 Python 路径、专用 owned 目录（当前 UID、0700、非符号链接）、有限输入/规则/报告/生成及并发预算。配置范例见包内 `examples/csv-pilot.patch.json`，替换两个路径占位符后才能使用。不可追加到旧论文 profile，不能把本例当作永久或私人数据授权。

该专用合成测试 profile 关闭模型 presets、遥测/反馈、聊天附件、本地文件引用、workspace files/terminal 及不需要的 inspector Host/Client 对；说明 Skill 只读包内目录且 includeDefaultRoots=false/watch=false。配置只是官方可变 profile 用户层，不是改 DSH 或绕过 launch policy。没有提供模型凭据、广泛磁盘权限、开机启动或新增系统安全设置。

使用官方入口 `DSH_HOME=... DSH_AGENTS_HOME=... dsh --profile csv-pilot --host 127.0.0.1 --port <独立空闲端口>`。启动器在本机浏览器中打开认证入口，不复制带凭据 URL 到说明或聊天。侧栏 CSV 只读诊断无需新建 Session；只选择仓库合成 input.csv，选择演示或明确个人 rules.json，勾选逐文件确认，授权并检查。仅计数摘要不含路径或原始行。取消后可重选同文件，退出页撤销授权。演示/个人规则不是学校正式规范。

本机 Hub 保留原站页面，在 loopback 隔离目录提供包下载和只读说明 Skill 的安装链；它不是公开目录发布。现有城院 installer 的 id 前缀要求使 standalone 说明 Skill 使用 chengyuan-csv-readonly-task 别名，包内名称仍是 qcu-csv-readonly-task，正文相同，均不包含清洗脚本或新授权。

下一边界：原生系统文件对话框、人手打开浏览器后的操作体验和另一台 Apple Silicon Mac 尚未验收；真实私人 CSV 仍需要明确授权。当前不推进签名、正式安装包、Intel/Windows、行级输出或跨进程崩溃残留恢复。
