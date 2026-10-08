# 表格体检官方安装及浏览器验收

2026-10-08，在独立 Apple Silicon Mac 测试 Home 完成树外表格 Bundle 安装。论文 cd5f532 实例、原仓库及已暂停项目不改。仅合成 CSV；未取得私人表格许可。packageReady=false。

## 来源与零 DSH 源码改动

干净官方 checkout 固定在 `639ed015397290b3745d163aafe02ffee4aa3f84`。执行的运行时来自官方 npm registry 的 `@deepseek-ai/dsh@0.2.0-rc.2` 与 `@deepseek-ai/dsh-web-app@0.2.0-rc.2`，Cordis 4.0.4。未修改这些运行时文件或官方 checkout。npm 元数据没有 gitHead，因此只能分别证明固定源码 commit 与官方发布包版本/完整性，不能声称 tarball gitHead 已验证。独立 runtime 首次安装约 493 MiB；业务 tgz 约 22 KiB，不带 node_modules。

官方 CLI 的 `dsh plugin --profile csv-pilot add <tgz> --ignore-scripts` 成功。用户层明确启用有限 CSV task 和只读说明 Skill；默认包自身仍 disabled:true/enabled:false。关闭通用文件/聊天附件/terminal、模型 presets 和遥测，使用专用 UID owned 0700 工作目录、有限生成预算；没有模型凭据、系统权限扩展或 OS 沙箱承诺。依赖版本固定，未使用版本豁免。

## 安装时发现并修复的三项兼容问题

1. 官方 Client manifest 只为精确包名注册 Client。Bundle 主 Host row 改为 qcu-table-audit，根导出 task Host，程序化 adapter 保留为 /adapter。
2. 官方浏览器 loader 要求 ModuleLoader CJS factory，直接 ESM export 会报 SyntaxError。Client 构建采用官方 factory 形式，仅 React 外置；DOM 测试执行实际构建 factory。
3. 官方 HTTP bridge 将 Request.url 设为 http://dsh.internal。原代码将它误作浏览器地址拒绝。现在依实际 Host 与精确 Origin 绑定 loopback，再调用官方认证 fence；不信任 forwarded headers。回归覆盖 internal URL 及异源、缺少认证、非本机请求拒绝。

修复均在表格包，DSH 默认零补丁。附带只读 Skill 只扫描包内说明目录，撤销/卸载 provider 生命周期有真实 Cordis 回归。

## 真实浏览器流程

使用隔离 headless Chrome 和未修改的官方 Web 页面，正常处理首次预览通知及 Configure later；不提供 API key、不新建 Session。逐文件选择与空选择取消、确认前禁止授权、演示 4 行/7 问题、发出取消下载请求（最终包结果 null，文件已完成，不能证明本次取消成功）、再次导出仅计数 JSON、取消并重选同文件、个人规则和重复检查、离开页面撤销及 owned 目录清空均通过。源 CSV SHA256 不变；页面错误为空，12 次业务请求全为 HTTP 200。

这是浏览器真实 UI，不是仅 API/DOM 测试；Playwright 的 filechooser.setFiles 与 download.cancel 不是 macOS 原生文件/保存对话框验收。没有把这一结果标为论文原生验收或打印预览通过。测试路由的 loopback 网络拦截是测试约束，不是产品的 OS 隔离保证。

浏览器验收脚本保存在 scripts/validate-table-browser.mjs：使用已有 Playwright 模块的绝对路径 QCU_TEST_PLAYWRIGHT、独立证据目录 QCU_CSV_TEST_DIR；目录包含自身官方 CLI 私有启动日志 official-web.private.log、owned work 目录，测试端口 19389。认证入口只在内存使用，结果仅记录操作名/HTTP 状态/计数，不能打印或提交私有日志。测试输出和截图不加入源码。

插件回归 53 项通过；Host/Client 严格类型检查通过。历史 49 项证据保留其当时含义，不当作本次安装证据。

## 停用、移除及恢复

这个隔离 profile 明确关闭 HMR。官方 PluginManager 源码在无 HMR 时把应用结果标记为 restart-required，管理页单个 Bundle 开关只持久化选择，当前页面和任务 route 仍保持 200；因此热停用 probe 是未通过，不能用它证明卸载成功。正常退出专属测试服务，使用官方 CLI remove qcu-table-audit（remove 不接受 --ignore-scripts，进程环境以 npm_config_ignore_scripts=true 禁止生命周期脚本），移除专用用户层的两项 qcu 组件配置后，官方重启的真实 Chrome 页面无 CSV 入口，任务接口404，owned工作目录为空。随后从真实 Hub 下载的最终 tgz 通过官方 CLI 恢复安装及专用配置。这是“移除+正常重启”验收，非“热停用”通过。论文实例从未退出。

不改官方 HMR 门槛，不把 Bundle 选择切换当作 runtime unload。未来若需要无需重启的组件切换，应在独立 profile 用官方 HMR 做单独受控验收；本次不因此修改 DSH 源码。

## 本机 Hub 边界

使用既有 Hub HTML，在 127.0.0.1:19390 的隔离 fixture catalog 中点击下载插件；核验 SHA256 后由官方 CLI 装入第二个 csv-hub profile，默认关闭。只读说明 zip 通过既有城院安装器装入隔离 Skill Home。standalone alias chengyuan-csv-readonly-task 满足现有前缀要求，包内说明名 qcu-csv-readonly-task；正文相同，不含清洗脚本。fixture 的 published 仅用于本机下载路径，实际源码公共目录仍 draft，没有公开发布或群发。

## 尚未覆盖

原生系统文件/保存对话框、另一台 Apple Silicon Mac 的人工体验、私人 CSV、签名/正式安装包、Windows/Intel、行级导出和整个 Host 进程退出后的残留恢复均未验收。本轮不推进这些范围。精确包哈希与停用结果见 evidence/table-audit-install-validation.json。
