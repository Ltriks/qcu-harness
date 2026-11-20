# Windows rc.4.5.4 诊断面板根因与最小修复（2026-11-19）

## 结论与实际范围

问题已在官方 Host / Client / Gateway 的实际 HTTP 调用中复现，不是根据几种假回包猜测。已修源码并给本机托管 branding 打可回滚补丁，12项回归通过，设置开关在空诊断测试目录经同一真实RPC开/关回环通过。**完整Electron界面尚未自动验收**：CUA两次报 `Sky Computer Use native pipe startup failed`，未绕过控制通道或改系统保护。没有重打包、覆盖既有ZIP或发布新版本；Cursor原有未提交工作保留。

实际工作树：`/Users/mcq/Repos/cowork/qcu-harness/.work/release-rc45`，分支 `fix/qcu-windows-rc451`。本轮新增文件与修改保持未提交，避免把Cursor其他草稿混入提交。

## 复现证据

1. 初查本机回执仍为rc45.4（4.5.3），没有运行中的QCU实例。用户给定4.5.4 ZIP在Mac与Windows本地核对SHA256 `fcfcc6c38a2065ab6a8556e117b412df51c4c8f8052e4d22271632256a35f8e1` 通过。已解压到 `C:\QCU454`，受管准备后回执为rc45.5，cordis.patch.yml前后字节一致。
2. 原托管index.js与client.js均与4.5.4 seed摘要相同：host `a562f2562960f58fd09ba43ec1c0114b9df9c60e89e43c4fb297758228e6762d`，client `dc73a2adfe548c6983aaa6bfa178a06369960d27d13049acb290c1b6f8c7049d`。所以本轮不能归咎于branding没刷新，且rc45版本门禁已修。
3. 原始官方回包是 `{ok:true,value: JSON字符串}`，字符串内部又是 `{ok:true,value:诊断状态}`。旧4.5.4客户端直接返回外层value，实际得到string、没有records/build；即使RPC成功也不能作为React状态显示。
4. 本机直接API status耗时17171ms、records=0；真实旧RPC16814ms。UI原超时6000ms，且ACL检查同步阻塞Host事件循环。增加启动重试或只修版本门禁都不能解决。

## 修复（只涉及branding诊断）

- `src/view.mjs`：独立requestDiagnostics，分别解开官方传输层与Host层，兼容已观察的封装，拒绝失败/畸形结果；有界60秒等待，完成后清理计时器。
- 只在remote未挂载时进行短重试；超时或Host失败不盲目连发请求。UI展示固定阶段码：CONNECTION、TRANSPORT、HOST、REPLY、TIMEOUT，均为 `QCU-DIAG-*`，不展示原始异常或私有路径。
- `index.js`与新增`diagnostics-worker.js`：保留现有suite/build门禁及所有SID/ACL检查；把status/preference/exportRecord放到固定操作白名单的Worker执行，避免PowerShell权限检查卡住Host主线程。Host任务45秒上限，status请求合并在途调用。没有增加通用命令执行接口。
- `package.json`把worker纳入包文件；`client.js`已从源码重建。没有改模型、目录、上报接收地址或同意策略。
- `tests/diagnostics-remote.test.mjs`：双层真实协议形态、Host/transport失败、延迟/超时、不重提变更请求、Worker父线程心跳及异常脱敏共12项通过。

## 本机热修及测试边界

修改的源码为index.js、src/view.mjs、client.js、package.json和新增worker；本机只更新这5个静态文件。原静态插件备份位于 `%LOCALAPPDATA%\QCU-Diagnostic-Probes\20261119\branding-before-codex`。原profile设置与真实上报偏好文件摘要不变。

探针使用随包原厂Typert/Connection/Gateway、真实托管插件及真实诊断存储；认证cookie为内存夹具，不读取账户凭据。连接事件流为闲置夹具，不能代替生产Electron完整连接生命周期；结果是方法调用/序列化/权限检查/解包的验收。未调用模型。

修复后实际请求返回object、hasRecords=true、build=rc45.5；读取仍约20–26秒，但父线程持续响应，不能声称已优化ACL总耗时。设置回环只使用全新的空诊断目录，records=0，真实上报同意文件摘要未变；未发送生产故障到云端，不能据此声称云端收件验收通过。

## 可复制验收

开发机：

```sh
cd /Users/mcq/Repos/cowork/qcu-harness/.work/release-rc45
rtk proxy node --test tests/diagnostics-remote.test.mjs
```

Windows人工步骤（本轮已启动正确程序）：

1. 从 `C:\QCU454\QCU助手\QCU助手.exe` 打开，不要使用旧C:\QCU453或旧开始菜单入口。
2. 更多 → 使用指南 → 问题与维护 → 诊断与上报，首次耐心等待约20–30秒（前端上限60秒）。
3. 应显示套件0.1.0-rc.4.5、构建rc45.5、内核版本和自动上报状态。真实用户开关本轮保持关闭。无记录时显示暂无故障记录，而不是不可用。
4. 点击刷新状态，应继续得到状态；读取期间其他界面应可响应。此次不要求启用生产自动上报来验收显示。
5. 如失败，只记录显示的QCU-DIAG阶段码、正确构建号与等待时长，不发送配置、密钥或教学资料。

## 接续与禁止误判

- 确认完整GUI前不要继续重打同名4.5.4；已有ZIP仍含旧代码，本机是独立静态热修。
- 后续正式发新版本时，须将新worker和重建client一起打入归档/seed/manifest，增加4.5.4 seed到受管升级允许集合并验证；不能只替换源码或覆盖同名旧ZIP。Mac尚未现场验证。
- 云端新构建号接收白名单/真实故障投递另验；状态页面修复不代表上报云端完成。市场投稿反馈(.68)与诊断接收(腾讯云)是不同链路。
- 私有证据与脚本在主工作区 `.local/diag-20261119/`，含原始形态级报告、设置回环、最小patch、源码修改前备份；不上传公开发布附件。

最终回归：诊断12项、首页/市场官方Cordis接线1项、收藏/固定2项，总计15项通过。Windows修复后最近一次真实方法链请求25667ms，父线程767次心跳、最大间隔161ms；返回rc45.5状态对象。空隔离诊断目录经官方RPC preference(true)→preference(false)通过，真实偏好文件摘要不变。C:\QCU454 正确程序已启动，已请用户人工确认完整面板；尚未收到视觉验收反馈。

## 用户人工验收补充（2026-11-19）

用户按本轮步骤在真实Windows界面确认：诊断面板已能打开，并且成功开启自动上报；仍感觉响应较慢。来源为本线程用户直接反馈。由此确认面板读取和开关操作的人工验收通过；原有待视觉确认状态以本节为准。不能据“已开启”推断云端已收到故障或幂等回执验证完成。剩余性能问题为本地权限检查总耗时，Worker只解决Host阻塞，并未缩短ACL检查；后续优化须保留所有权/ACL/链接保护。本轮尚未重打包或发布。
