# 独立Home启动复核（只读）

2026-10-11。本轮未访问Mini、未创建Home、未启动第二实例、未改官方源码。默认P4.2/教练P2成功环境保持原状。

## 更正上轮阻塞判断

“默认19387被占用所以没有独立端口方式”不成立。官方固定源码基线 `639ed015397290b3745d163aafe02ffee4aa3f84`：

- `apps/desktop/README.zh.md:7` 明确允许 `webserver.config.port` patch覆盖Desktop默认19387。
- `packages/bundle/web-app/cordis.patch.yml:169–175` 把webStartup的端口作为webserver配置默认表达式；用户补丁可覆盖该配置，不需修改Host源码。
- `packages/host/webserver/src/index.ts:59–63,295–298` 支持port=0，使用OS分配的端口，并公开实际监听端口。
- `apps/desktop-host/src/index.ts:103` 通过 `ctx.webServer.port` 构造回传给Electron的地址；无需把端口硬写进Client。

因此可研究在**全新Home**根级或profile补丁中仅给webserver设置loopback及port=0，其他profile文件仍由官方初始化。具体补丁层级和实际归档组合要先在隔离fixture验证；本轮没有写入或运行。

## 单实例锁作用域

- DSH `apps/desktop/src/main.ts:1336` 在profile生命周期前调用锁；`single-instance.ts:20–24` 失败就退出，已有owner获焦。不能移除锁或调用release绕过。
- Electron官方v44.0.0 `shell/browser/api/electron_api_app.cc:979–1007` 从 `chrome::DIR_USER_DATA` 构建ProcessSingleton；macOS分支把user_dir传入。因此锁与Electron userData相关，并非只与DSH_HOME相关。
- DSH `apps/desktop/scripts/development-app.ts:63–75` 同时传DSH_HOME和 `--user-data-dir`；`scripts/dev.ts:67` 的 `DSH_DESKTOP_USER_DATA_DIR` 是开发启动器参数，不能直接声称安装版读取这个环境变量。
- Electron文档说明Finder的macOS单实例机制与命令行启动不同：https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
- 固定版本源码：https://raw.githubusercontent.com/electron/electron/v44.0.0/shell/browser/api/electron_api_app.cc

结论：存在有源码支持的候选隔离组合（DSH_HOME + 单独Electron userData + webserver端口patch），不能继续宣称“官方不支持独立端口”。但本轮未验证实际签名App的Electron精确版本、参数生效、全新Home初始化时机及副作用，**尚不能宣称打包应用并行启动已安全验收**。DSH macOS日志默认路径、登录shell环境读取、教练缓存位于OS homedir下，也不能因为换DSH_HOME就声称所有数据天然隔离。

后续须先在本地一次性fixture核验补丁组合及路径，不调用运行中默认实例；启动前固定唯一目录，独立workspace/agents/electron、避免读取默认模型凭据及共享缓存命中误当首次下载，检查OS_HOME派生路径与环境继承。不得为测试覆盖OS HOME或复制用户配置。若无法满足这些条件，保持现场暂停。

## 无安全并行路径时的最小停用计划（待用户批准，未执行）

1. 约定短暂停用窗口；只读记录默认实例版本/配置哈希/PID，并确认无活跃任务或未保存操作。
2. 用户允许后通过官方菜单正常退出默认实例；确认原Host与端口释放，不kill。
3. 启动同一官方App，使用唯一新DSH_HOME、独立Electron目录和空workspace/agents；官方初始化，不带默认密钥。市场及教练安装/启用风险确认仍由用户亲点。
4. 完成无需模型的下载取消首次安装检查；技能实际会话读取若缺模型前提则明确未测，不偷用默认配置。
5. 正常退出测试实例，从原入口恢复默认实例；只读核对原版本、启用状态和配置，保留测试目录/证据，不自动删除或恢复覆盖文件。

不承诺固定分钟数：用户确认和包管理耗时不可预测。停用默认实例是新增动作，不能从既有“默认环境不动”授权推导许可。

## 实际归档复核与本轮决定

2026-10-11 续查本地官方 App 的 `Contents/Resources/app.asar`：`lib/main.js` 确有无参数 `app.setAppLogsPath()`，且打包模式无条件调用 `app.setAsDefaultProtocolClient("dsh")`。固定源码的登录 shell 初始化还读取账号的 shell 启动环境；没有找到受支持的全隔离开关。市场缓存使用 OS homedir 下的 `.cache/qcu-market`，换 DSH_HOME 不会变为首次空缓存。

因此本轮在创建新 Home / 启动第二实例之前停止现场操作；未修改默认 profile、未停止默认进程、未执行协议注册、未读取密钥或聊天。单独 userData/DSH_HOME/loopback port=0 仍是可研究组合，不能据此宣称完整隔离已经保证。默认实例短暂停用也不能消除这些共享路径问题；上节备选须重新评估后另行授权，不能直接执行。全新 Home 下载/取消/首次安装/独立启用仍为 not tested。
