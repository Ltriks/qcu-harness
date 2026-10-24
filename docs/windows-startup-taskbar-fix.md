# Windows教师包启动与任务栏修复交接

2026-10-23更正：用户随后明确指出，任务栏图标本来正确，未变化的是“菜单栏”图标；系统及具体位置尚待确认。因此下文“任务栏故障/根因”仅是此前按当时表述开展的判断和候选实现，不再作为已确认故障。主脚本窗口图标设置缺失是代码观察，不能直接推出用户的实际菜单栏问题。r4仍未验收，不从这条更正推断其GUI或图标通过；r3启动验收保持有效。

日期：2026-10-22。用户首先报告临时准备目录`electron/Cache/Cache_Data`发生EACCES，随后确认启动修正版r3正常打开、课程工作台与技能可见，再指出任务栏仍为DeepSeek图标。本轮保留应用运行版本0.1.0-rc.3及相同seed和个人数据目录，以包装修订r3、r4分别留痕；不修改Mac包。

## 固定交付物

固定根目录：`/Users/mcq/Repos/cowork/qcu-harness/releases/`。

| 包装 | 相对固定根目录路径 | 字节 | SHA256 |
| --- | --- | --- | --- |
| 启动修正版r3，历史/对照 | `0.1.0-rc.3/QCU-Teacher-0.1.0-rc.3-win-x64-r3.zip` | 401558506 | `f41508533d5a3cbd87d61c20caf26c86d14b1b29d8641fd0433c9335cdcc1a11` |
| 启动与任务栏修正版r4，当前候选 | `0.1.0-rc.3/QCU-Teacher-0.1.0-rc.3-win-x64-r4.zip` | 401560353 | `6653d40071b70d9f22880a50b16b06bdc64ae2390720fd5930ef08293ca1c2bf` |

Windows虚拟机已解压r4：`%LOCALAPPDATA%\QCUStartupFixTests\cache-20261022\任务栏修正版 r4\QCU助手\`。先保存工作，从当前助手或托盘菜单正常退出，再双击新目录中的`QCU助手.exe`；关闭窗口可能只会隐藏到托盘。无需卸载、删除缓存、管理员身份或重配已可用的个人密钥。

## 缓存迁移根因及修复

原启动脚本把旧版个人目录整体复制到临时准备目录，包括Electron运行时缓存。检查时旧rc.2的五个Electron进程仍运行，真实rc.3尚无完成回执。用Windows FileStream以FileShare.None独占锁定合成缓存，原脚本精确复现截图相同的临时目录EACCES，旧个人目录未改。

`tools/teacher-suite/start.cjs`现在：

- 在扫描及复制之前过滤Electron的Cache、Code Cache、GPU/Shader/Dawn缓存、Crashpad/Crash Reports、Service Worker缓存及Singleton/lockfile等进程锁；持久浏览器设置、Local Storage、Cookies、模型配置与工作文件仍复制。工作区内同名Cache目录不受影响。
- 只在Windows首次升级复制前，用本机CIM确认目标旧`--user-data-dir`是否仍运行；只返回退出状态，不打印进程命令行。提示用户保存并正常退出旧版，不自动杀用户进程。
- 清理临时目录失败不会覆盖原始异常；旧版复制遇到EACCES/EPERM/EBUSY时给出保存退出及维护人员处理的提示，保留旧目录。

11项本地测试通过，新增缓存与锁过滤/持久数据保留，以及清理错误不遮蔽原始错误的回归。Windows原脚本独占锁样本失败、修正版同样本成功，配置与持久数据保留，重复准备通过；合成官方进程的运行检测与非目标数据目录放行通过。第一次按真实旧实例做断言时，用户已正常退出旧版，因此该次预期异常断言未满足，未计为通过，随后改用确定性的隔离合成进程验证。

旧程序退出后，最终r3的原生启动器成功把真实rc.2复制到rc.3；对95个旧版非Electron文件的前后摘要核对一致，配置值保留，其他个人文件复制一致，重复准备通过。校验只打印数量和布尔值，不导出个人配置。用户本线程明确确认r3“正常打开，工作台和技能可见”；仍未进行真实模型或飞书业务验收。

## 任务栏根因及修复

实际官方ASAR中，外部`icon.png`只传给关于页，`tray.ico`用于托盘；主窗口`createWindow()`没有设置图标。仅替换这些资源与原生入口EXE图标不能让主窗口完整使用QCU标识。

`tools/teacher-branding/windows-taskbar.js`在Windows的Electron主进程中注册`browser-window-created`，给应用自己的每个窗口设置QCU图标和任务栏属性：独立AppUserModelID `cn.qcu.assistant.teacher`、图标资源、重新启动命令与名称QCU助手。固定入口的命令指向本套件`QCU助手.exe`，保留初始化及数据目录逻辑。采用[Electron窗口图标及任务栏API](https://www.electronjs.org/docs/latest/api/browser-window)与[微软任务栏图标属性](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-relaunchiconresource)。

`scripts/brand-windows-taskbar.py`仅允许冻结r3摘要和原主脚本摘要；在应用准备与创建窗口之前插入补丁，更新ASAR头偏移及修改成员的完整性记录。源代码变动仅`lib/main.js`；其他11469个打包成员内容及解包/链接元数据完全一致。原生官方EXE、官方安全fuse、启动器和预装seed未改；确认原构建的外部ASAR完整性验证fuse原已关闭，**未关闭或改变任何fuse**。脚本遇到不支持外部定制的其他构建会拒绝操作。

Windows仍可验证官方EXE的Authenticode为Valid；必须同时说明外部ASAR已定制，不再声称Windows完整官方应用文件无修改。ASAR原始SHA256 `983ca71114e6dfd353fc79af5a1f9481a250ee64c2a3c757673029b811b23bc2`，定制后`65708db9d86edc45be1611b0ea5ede8771e02ab144e6032330edaf07b2848383`。补丁及`support/vendor-customization.json`随包提供。未来客户端升级要重新核对原脚本与补丁，不把该锚点盲套至其他版本；官方客户端替换也不会自动保留此定制。

## 验证与剩余验收

- r3：Windows摘要匹配、系统解压9878文件、原生首次与重复准备、官方EXE签名Valid、真实数据升级及用户GUI通过。
- r4：ASAR主脚本语法通过；成员逐项对比与最终ZIP完整文件清单通过；Windows摘要匹配、系统解压9880文件、原生首次及重复准备、官方EXE签名Valid。
- r4运行时主窗口及任务栏视觉已请用户在新目录退出重开核对，当前待回复；固定到任务栏后重开另待验收，不自动继承r3GUI结论。
- Windows11 ARM64虚拟机上的x64运行测试不等同原生Windows x64硬件、Windows10、学校下载终端策略的验收。模型、飞书和正式签名分发仍沿用待办。

固定记录：当前`delivery-win-x64.json`、历史`delivery-win-x64-r2.json`及`delivery-win-x64-r3.json`、`build-win-x64-r3.json`、`build-win-x64-r4.json`、`windows-release-fix-validation.json`。原Windowsrc.3与指南r2因为缓存复制缺陷撤下分发推荐，旧归档保留。主README用户已有改动保留；本轮未提交、推送或部署。

实现工作树下构建脚本顺序：`scripts/fix-windows-teacher-migration.py --base <固定Windows指南r2.zip> --out <新目录>`，再`scripts/brand-windows-taskbar.py --base <生成的r3.zip> --out <新目录>`。两步不使用个人数据作为打包输入。临时Parallels网卡文件服务51920已关闭。
