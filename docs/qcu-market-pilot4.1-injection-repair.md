# QCU Market pilot.4.1：真实 Client 注入修复

固定 `pilot.4` 真机已安装、启用且显示市场面板，但报 `cannot get property "remote.pluginManager" without inject`，教练安装流程未开始。此次仅隔离源码、测试和新归档，不连接或修改 Mini、Hub、现有包或用户 profile。

## 根因与修复

`package.json` 的 `dsh.client.inject` 声明包加载前提，不授予 Cordis 插件作用域服务访问。旧 Client 只声明 `slots/layout`，用 `ctx.get('remote')` 取得对象后访问受保护的 `remote.pluginManager`，因此在真实作用域失败。同样未完整声明的还有自有 `remote.qcuMarket` 与 `pluginNavigation`。

新版本使用最小分层依赖：

| 作用域 | 明确注入 | 使用及释放 |
|---|---|---|
| 面板外壳 | `slots`, `layout` | main/sidebar 注册、返回；缺服务时仍显示不可用状态，卸载移除注册 |
| QCU Remote 挂载者 | `remote` | `$mount` 自有三个方法；拥有命名空间生命周期 |
| 流程消费者 | `remote.pluginManager`, `remote.qcuMarket`，继承父级 `remote` | QCU 准备/复核/撤销，官方状态/安装/启用；释放取消在途任务和事件订阅 |
| 官方详情 | `pluginNavigation` | `openBundle`；缺失时真实报错，恢复后可用，撤销后移除回调 |
| Host | `typert`（不变） | TypertRemoteService 与描述符注册；卸载取消下载、清空收据、撤销端点 |

自有命名空间在 `$mount` 后才可用，不能作为挂载者的前置依赖，否则无法启动。官方 manager 仅为流程消费者的依赖；其撤销不能在自身串行 namespace teardown 内等待另一个 `$mount` disposer，否则会形成等待环。回归覆盖撤销、重挂及整条 Client transport 更换。React 卸载不重复取消已释放 flow。

此外，官方 `BundleInfo.error` 是结构化 `ManagementError`，现转为错误码文本，避免 React 对象子元素错误。归档合入此前已修正的“按需下载，以本次校验为准”文案，不再声称教练尚未发布。

## 原 52 项为什么没有捕获

- 状态机与组件使用普通 JavaScript remote/ctx 对象，不执行 Cordis 的作用域访问检查。
- 原官方 SlotRegistry/Layout 用例没有 Remote，只验证缺依赖降级与导航。
- 原真实 Client Gateway 用例从根 context 挂载和调用单个 QCU cancel 方法，没有启动完整市场插件 fiber。
- 因而虽然各部件测试通过，完整 Client 组合与声明之间仍有缺口。新测试没有关闭、模拟或绕过 Cordis 的注入检查。

## 可复现验证

`tests/qcu-market-client-scope.test.mjs` 使用官方真实 Cordis 4.0.4、ClientRemote、SlotRegistry、React，以及官方生成的 plugin-manager Remote 描述符与参数/结果 codecs。管理动作只由内存 carrier 返回合成结果，不运行真正安装器。关键依赖源码与固定官方基线 `639ed015397290b3745d163aafe02ffee4aa3f84` 的七个文件逐字节相同。

- 红灯：从原始不可变 P4 TGZ 提取 `client.js`，同一“Client starts in a real plugin fiber”测试失败，错误与真机完全一致。
- 绿灯：源码适用测试 **62/62**；实际 P4.1 TGZ 解包后的 Client/Host 官方回归 **15/15**（是源码测试的归档重验，不是额外独立覆盖）。
- 新增九项真实 Client 作用域回归：启动零业务 RPC；状态、准备/拒绝；八个公开 manager 方法；缺依赖/晚到/撤销/恢复；详情服务；连接重置；Host 失败；结构化错误；transport 释放重建；在途安装取消和晚到结果。一个用例可含多个场景。
- 新增 Host Gateway 生命周期用例：真实 Host fiber 卸载终止合成在途下载并清空收据。其余原测试保留，覆盖取消/重复确认/返回/固定来源和完整性等。
- 八个官方管理方法仅为 `listBundles`, `listPlugins`, `inspect`, `installBundle`, `waitForInstall`, `cancelInstall`, `setBundleEnabled`, `setPluginEnabled`；测试通过官方生成 codecs 核对参数。无私有控制器、万能管理 RPC 或通配注入。
- 12 个普通 UTF-8 归档文件、0644、固定路径、导出闭包和逐文件哈希已核对；无 install scripts、内嵌教练包、新增依赖；确定性重打包一致。

执行时设 `QCU_OFFICIAL_DEPENDENCIES` 为已有审计 rc.2 依赖目录，禁止下载新依赖。构建与源码命令见 `qcu-market-direct-install.md`。归档重验额外设置 `QCU_MARKET_CLIENT_PATH` 与 `QCU_MARKET_HOST_PATH` 指向解包的两个入口，再执行三个官方测试文件。红灯只对不可变 P4 的 Client 运行该启动用例；预期非零退出。

## 新固定包和权限

- 版本：`qcu-market@0.1.0-pilot.4.1`
- 文件：`qcu-market-0.1.0-pilot.4.1.tgz`
- 大小：**17063 字节**
- SHA256：`8b4e637a4efedeefc95835602f65ad60ec1440b8b6ed9671327adc05a0d22801`
- 原 P4 SHA256 保持 `5e482830baaf6ebfb64f48901b32e09c161ab90b28a205ff4a6ead1c7d2f5b88`。

Host 代码、描述符、固定教练发行条目、peerDependencies、bundle 默认禁用 patch 均逐字节/字段不变。只将既有 Client 调用声明为正确的最小依赖；不新增管理方法、来源、路径、模型、会话、密钥、OS 或脚本权限。修复使此前阻塞的管理流程有机会生效，仍必须经过明确安装/独立启用确认，不能将 UI 插件视为无风险。

本轮没有真机安装/重启、Hub 修改或真实教学效果验证。下一步由用户通过官方 UI 审核此新版本的精确包与哈希后试装；先确认新版加载，再验证下载/hash、取消未安装、重复点击和确认页。不可覆盖原 P4 归档，不提前替用户确认教练安装。
