# QCU Office 桌面入口

固定官方补丁把 apps/desktop/package.json 的 main 指向 lib/qcu-main.js。入口选择专用 qcu-office 数据目录后再加载共享 DSH 界面；启动器在业务插件前安装固定生命周期策略。实际改动还包括 CLI、Desktop Host 与 app-boot，不只是 Electron。

这不是普通 DSH 的可互换更新包，也不是在普通 DSH 安装外置 Bundle 就获得相同策略。按照 [重建说明](../docs/REBUILD.md) 使用官方完整构建入口，并在启动前检查 Web 静态产物。已在独立合成 Mac Home 验证真实 Electron/Renderer/Host/Python 启动和服务健康，见 [Mac 启动验收](../docs/MAC-STARTUP-VALIDATION.md)；没有迁移真实配置或覆盖原稳定版。原生文件选择、下载取消及重试、打印预览、卸载和存储验收仍未完成。
