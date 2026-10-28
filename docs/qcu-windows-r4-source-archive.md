# Windows rc3-r4 原构建源码归档

2026-10-28经用户授权，将历史 `1012167` 工作树中57项未跟踪原打包源码、测试和文档只读复制到本独立分支，没有提交原工作树的其他修改。发布标签 `qcu-teacher-v0.1.0-rc.3-win-x64-r4`，安装包保留 SHA256 `6653d40071b70d9f22880a50b16b06bdc64ae2390720fd5930ef08293ca1c2bf` / 401560353字节，本次未重建。

`release/snapshots/windows-rc3-r4/` 保存实际ZIP中90项QCU组件源文件及原`support/Launcher.cs`。模板 `tools/teacher-suite/Launcher.cs` 的历史城院文案由 `build-branded-teacher.py` 在构建时替换为QCU；快照保留已替换的原字节。这是解释实际包的历史记录，不是新增业务实现。启动脚本、offline/smoke脚本及windows-taskbar补丁均已逐字节匹配。

构建链：`build-offline-suite.py`／`build-teacher-windows.py`构造干净预装seed和原生入口，`build-brand-assets.py`、`build-branded-teacher.py`加品牌，`add-teacher-guide.py`加指南，`fix-windows-teacher-migration.py --base <固定指南r2.zip> --out <新目录>`构造r3，再`brand-windows-taskbar.py --base <固定r3.zip> --out <新目录>`构造r4。脚本核对基础ZIP、官方客户端、TGZ和ASAR主脚本摘要，拒绝其他输入；不改安全fuse。需要Windows编译工具链、已核验客户端和基础二进制，不能仅凭Git源码生成全部输入。

原说明与各阶段验收见`docs/windows-startup-taskbar-fix.md`等。原说明中的“未提交／未推送／待回复”是历史状态；本次已补归档，当前用户确认的是r4本地磁盘可打开。Mac共享桌面失败保留，任务栏视觉／固定重开、原生x64硬件、新电脑和模型业务仍未验收。当前包不含QCU市场、专家团或Mac P16体验。

可重跑：`rtk proxy node --test tests/offline-suite.test.cjs tests/teacher-suite.test.cjs tests/teacher-theme.test.mjs`；2026-10-28结果23通过。逐文件与ZIP读取校验见Release附件`ARCHIVE-CHECK.json`，使用指南与许可见相同Release。没有读取或打包真实用户Home、配置、Key及会话。
