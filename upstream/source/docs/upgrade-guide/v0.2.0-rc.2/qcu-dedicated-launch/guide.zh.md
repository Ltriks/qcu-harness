---
kind: upgrade-guide
description: "下游 QCU 候选要求使用固定 Office 入口、隔离数据根目录与启动器持有的限制，不再依赖可卸载组合包的策略。"
---
# QCU 必须使用专用 Office 入口

[English](guide.md) | 中文

## 变更

此下游候选基于根版本 `0.2.0-rc.2`，不代表 DeepSeek Harness 官方发布。此前，显式卸载业务插件会移除其工具／附件限制，即使原生销毁确认失败也不例外；移除组合包配置也会移除其禁用行。

固定的 `lib/qcu-main.js` 入口配置 QCU Office 独立的 `qcu-office` 应用／profile 目录。设置成功后，入口将 Electron App 身份记入进程内私有 WeakSet；共享 main 读取 `isQcuOfficeLaunch(app)`。单独传入 `--qcu-dedicated` 不具备模式选择权限。不使用持久化模式文件。

Desktop Host 通过可信的 `runProfile.prepareRoot`，在配置项之前安装进程生命周期策略。独立的 `launchPatches` 保留原有 28 个根配置行的禁用限制，并在每次组合时追加到所有可变 profile 层之后。无效 patch 或缺失目标会导致启动／重载被拒绝；重载被拒绝时保留运行中的配置树。不含启动器 patch 的普通 profile 保持原行为；已修改的普通 Desktop 会拒绝已选中／被记为跳过的正式 QCU 组合包。

独立的 Cordis 持有者保留策略，不受业务移除或缺失影响。策略仅允许两个 QCU 工具，并拒绝附件进入模型。工具服务尚未就绪时拒绝接纳请求；绑定失败时立即终止 Host。根上下文执行 dispose（资源释放）后永久停止接纳请求。QCU 禁用普通 Desktop 更新，并拒绝已配置的普通强制发布策略。

## 迁移

1. 重新构建独立候选，并由 [Desktop 元数据](../../../../apps/desktop/package.json)选择 `lib/qcu-main.js`。保留普通 DSH 和现有 profile。当前验收使用合成 profile，不批准真实 profile 部署。
2. 一起更新[入口配置](../../../../apps/desktop/src/qcu-office-entry.ts)、[运行时策略](../../../../apps/desktop-host/src/qcu-policy.ts)、[28 项限制](../../../../apps/desktop-host/src/qcu-profile-policy.ts)和 [profile 准备](../../../../apps/cli/src/profile-boot.ts)。仅替换业务组合包不足以完成迁移。启动器行要求唯一的字面根 ID、精确的 `disabled: true`、无额外字段，且目标必须存在；不要为适应已变化的上游 profile 而削弱校验。
3. 用户数据使用 `qcu-office/electron`，浏览器会话使用 `qcu-office/session-data`，`DSH_HOME` 使用 `qcu-office/home`。继承的覆盖设置会被替换。路径必须是真实目录；POSIX 要求当前用户所有权且仅所有者可访问。不修改已有权限、不复制 profile；设置失败时绝不回退到普通数据目录。Windows ACL 隔离仍未验证。
4. 只有终止整个 QCU 应用并选择独立普通入口后，才能切换到普通 DSH。业务重载、Host 重启、profile 编辑及原生重试均不能改变模式。私有设置 `DSH_QCU_DEDICATED=1` 传递子进程启动选择；`DSH_QCU_PRIVATE_IPC` 不选择策略。
5. 验证工具／附件拒绝、移除组合包和尝试用户覆盖后仍保留的禁用行、重载拒绝以及业务缺失时的重启。使用[策略测试](../../../../apps/desktop-host/tests/qcu-policy.spec.ts)、[标准 Web 测试](../../../../apps/cli/tests/profiles/web/tests/qcu-persistent-restrictions.expected.e2e.ts)及入口／生命周期检查。仅修改源码不能作为证据。
6. 通过纯官方 CLI（命令行界面）运行组合包不会安装此策略。任意可信 Node 代码未被沙箱隔离；Host 突然终止可能使 Python 成为孤儿进程。Mac GUI 验收、签名、自动迁移／更新兼容性及生产批准仍未确立。
