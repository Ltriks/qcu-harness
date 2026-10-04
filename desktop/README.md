# QCU Office 桌面入口

固定官方补丁把 apps/desktop/package.json 的 main 指向 lib/qcu-main.js。入口选择专用 qcu-office 数据目录后再加载共享 DSH 界面；启动器在业务插件前安装固定生命周期策略。实际改动还包括 CLI、Desktop Host 与 app-boot，不只是 Electron。

这不是普通 DSH 的可互换更新包，也不是在普通 DSH 安装外置 Bundle 就获得相同策略。按照 ../docs/REBUILD.md 在全新固定 checkout 重建，随后单独进行原生 GUI、卸载、存储及平台验收。未迁移真实配置、未启动或安装本候选。
