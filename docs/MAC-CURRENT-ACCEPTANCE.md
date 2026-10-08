# Mac 当前验收状态（2026-10-08）

本轮先通过真实终端及只读进程列表确认无 QCU/Harness/Electron/desktop-host 存活，再执行既有 cd5f532 候选入口。没有发送结束信号、重复安装或替换候选源码。当前加载仍为 cd5f5320b409888c43ea2c5797c44f5f638c67ac，开发分支的 CSV 代码没有安装到该候选。

本轮新诊断确认 Host spawned/ready/alive；首个认证页面 HTTP 200，认证交换 303，认证 cookie 存在；QCU hello/ready/granted、业务 bridge 和 lock 存在；Host/Renderer 静态页面均存在且可读并位于候选目录。未认证首页 HTTP 401。已核验的 12 项候选业务资源哈希一致。此记录没有 token、cookie 值、私有文档或日志正文，没有调用模型。

用户在 2026-10-06 对工具入口与报告保存的人工复测通过，详见 [人工验收](MAC-USER-ACCEPTANCE.md)。本轮仍缺原生窗口及受支持浏览器控制工具，不能自动操作系统文件选择器、保存取消或打印预览；这些项目保持待验收。启动、API、JSDOM 和合成报告结果不替代原生操作。

既有启动入口继续可用，不新增开机自启、不更改系统权限。原仓库及暂停项目未修改。签名、正式分发、Windows 和新 CSV 实际启用不属于本轮；packageReady=false。
