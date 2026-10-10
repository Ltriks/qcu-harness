# QCU Market pilot.4.2：Host 就绪检查与真实 HTTP 验证

## 结论和现场边界

Mini 上的 P4.1 已显示启用、一个组件运行，官方状态查询成功，但 `qcuMarket/prepare` 返回 HTTP 404。本轮没有连接 Mini、修改其包或 Hub、重启 App、执行真正插件安装，也没有更改模型/密钥/聊天。

隔离实验重现了与现场一致的机制：P2 Host 是空 `apply()`；同一 Node 进程加载 P2 后，在同名包位置替换为新归档并重新挂载，磁盘元数据显示新版，Loader 仍返回原 P2 模块；Host 无 QCU 服务，真实 HTTP 返回 404。新进程加载相同最终归档则 prepare/校验/decline/cancel 成功。官方 profile resolver 拦截下，同路径归档替换及 metadata generation 更新亦重现。这证明了缓存机制，**并未直接证明 Mini 内存里的模块身份**；实验没有运行实际 pnpm 卸载/重装。

不应把 404 归咎于缺少 `@Remote` 或 `./typert`。P4.1 的显式 `ctx.typert.register()` 合法，冷启动即可工作。官方 loader 文档允许手写严格描述符；我们不新增硬编码路由、不改变注册方式、不绕过缓存或修改官方代码。普通退出并重新打开 DSH 才清除进程中的旧模块；切换组件开关不等于重启。

另一个确定错误已修复：官方 `installBundle` 成功收尾将 `stage` 改为 `enable`，即使请求 `enabled:false`。旧状态机只接受 `install`，因此会把真实成功误报未确认。P4.1 原归档经过真实 HTTP、官方 codecs 和精确成功回复后稳定红灯；新归档通过。

## 官方依据

固定源码基线 `639ed015397290b3745d163aafe02ffee4aa3f84`：

- `vendor/loader/src/config/tree.ts:112–127`：同一 specifier 和 parentURL 导入，不加版本；`config/entry.ts:224`：重新挂载仍走此导入。
- `packages/boot/app-boot/src/profile-resolution/service.ts:78–91`：metadata generation 更新不卸载模块、不清 Node caches。`resolver.ts:373–405`：改变解析目标/版本受重启约束；不是允许插件自行清缓存的接口。
- `packages/client/connection/src/rpc-host.ts:137–149`：未认领端点返回 404；`225–269`：POST/JSON、method 和 URL 一致性检查。
- `packages/api/gateway/src/index.ts:325–348`：严格 registry 或显式 SRC Remote 标记决定端点认领。
- `packages/typert/loader/src/index.ts:21–26`：允许手工严格注册。
- `packages/boot/plugin-manager/src/index.ts:555–562`：成功返回 `stage:'enable'`；已存在依赖升级返回 restart-required。`574–589`：活跃安装等待和取消语义。

测试不是只依赖源码相似性：12 个构建文件与签名官方 rc.2 ASAR 核对。Cordis、Loader、Host/Client Connection、Host/Client Gateway、Typert protocol/registry、manager 与生成 codecs 共 11 个文件逐字节一致。已有依赖的 app-boot 不一致，因此该实验改用从 ASAR 原样提取的 app-boot，而未将不同构建当官方。详见 `docs/evidence/qcu-market-pilot4.2-validation.json`。

## 实现

1. 新增无参数、只返回市场版本和协议号的 `qcuMarket.status()`。显式检查实例/准备时先核对 Host 与 Client；缺失、404 或不同版本时停止，提示正常重启。启动面板不自动调用业务 RPC。
2. 保留原 prepare/verify/cancel UUID 契约、固定来源、大小/hash/时限/并发预算。没有新增任意 URL、路径、管理、安装或权限参数。
3. 安装结果须同时满足 `stage:'enable'`、精确 `target/bundle`、`enabled:false`，随后再查实际版本和禁用状态；独立错误字段回归均保持未确认。
4. 安装、bundle 启用、组件启用仍独立确认。新增握手不授予安装权，不执行重启，不把组件 active 当聊天技能已发现。

## 测试链路和替身范围

`tests/qcu-market-http.test.mjs` 从实际 TGZ 提取 Host 和 Client，以官方 LIB 启动独立 Cordis Context。Client 的官方 Connection 序列化完整 `client-request`；TCP POST 到随机 `127.0.0.1` 端口；官方认证、HTTP bridge、路由认领、Gateway、Host 描述符、参数/结果 codecs 均实际运行。不是把 `connection.rpc.call` 换成 `Gateway.invoke()`。

- 认证凭据只在测试内存生成，不读取用户凭据；Cookie 不输出。
- 下载仅使用独立随机 loopback 服务及 `mkdtemp` 缓存。归档 Host 的 `PackagePreparation.download` 由测试装配注入实际 `fetchPinned`：仍核对生产固定 URL，但只把网络目的地映射到本地 fixture；生产归档不接受此配置。固定教练 P2 字节、3445 bytes、SHA256 均保留。
- 管理服务业务层是替身，注册官方生成的 Host descriptors，Client 用官方 manager Remote codecs。返回值复制官方实际语义（包括 stage enable），记录参数及副作用；不会运行 pnpm、写真实 profile、安装或启用插件。
- UI slots 是带真实 Cordis 生命周期的测试服务，既有官方 SlotRegistry/Layout 回归另行通过。事件/流通道为静止替身；本轮 HTTP 用例不验证真实 WebSocket install-state 推送。
- 归档提取前清理受限测试目录，避免残留文件；输入 hash、归档成员 hash、官方运行库 hash 留证。

结果：源码 **66/66**；实际新归档 HTTP **13/13**；实际归档原有官方作用域/Host/Client 回归 **15/15**（15 是源码用例的归档重验，不是额外独立用例）。

13 个 HTTP 用例覆盖：启动零业务请求；状态；下载大小/hash和复核；拒绝不安装；错误 hash/503；真实在途下载取消；重复准备与取消后再准备；Host/Client 重挂、收据撤销；Host 在途卸载；新进程 prepare/decline/cancel 恢复；未知端点/错误 envelope/UUID/非POST拒绝；匿名401与foreign Origin403；八个官方管理方法及安装保持禁用；独立bundle/row启用；待决安装cancel/wait；旧Host或错误版本先停止。

红灯对照：原 P4.1 的三个精选测试中，两个缓存机制/404复现实验通过，精确官方安装结果用例失败；冷启动 P4.1 prepare/decline/cancel 正常。`statusHttp:404` 在旧归档是预期，因为它还没有 status 方法。新归档冷启动 status HTTP200、四个QCU端点，全部通过。新归档同进程接替旧P2仍不能清理官方缓存，但会明确报 Host 未就绪而不下载；不把这项变成虚假“热升级成功”。

## 复现命令

使用已有审计依赖，不下载 npm 包。`QCU_OFFICIAL_DEPENDENCIES` 指向本机已有 rc.2 依赖目录，`ASAR` 指向已签名官方 App 的 `Contents/Resources/app.asar`，`MARKET`/`OLD`/`COACH` 分别为固定新归档、P2市场归档、固定教练P2归档。

```sh
python3.11 scripts/prepare-market-http-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --archive "$MARKET" --old "$OLD" --coach "$COACH"
python3.11 scripts/verify-market-http-runtime.py --asar "$ASAR" --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --out /tmp/qcu-runtime-parity.json
node --expose-internals --test tests/qcu-market-http.test.mjs
```

同一脚本将 MARKET 换成不可变 P4.1，运行 `--test-name-pattern='official Loader|official profile resolver|real HTTP install'` 即取得红灯对照。测试需要沙箱允许绑定 loopback 临时端口；不需要访问 Mini。源码及原有归档测试命令见 `qcu-market-direct-install.md`。

## 未覆盖与下一步

未覆盖 Mini 当前进程内存身份、Electron dsh-app://转发、真实 pnpm/registry/依赖兼容安装、官方持久 profile 写入/回滚、真实 WebSocket 安装进度与断线恢复、实际 skill 注册/模型调用/教学效果。本轮不得宣称真机验收通过。

本次不要求用户操作。下一次获准真机验收时：保留当前P4.1与备份；通过官方UI审查精确新归档；更新后正常退出并重新打开DSH一次；只读核对新Host版本，再做市场下载/hash、取消及再次准备。停在教练真实风险确认页由用户决定最终安装，随后再分别确认bundle/组件启用。不要再用卸载重装但不重启来试探缓存，也不要自动安装/清缓存/扩权。

## 固定交付归档

- `qcu-market@0.1.0-pilot.4.2`，文件 `qcu-market-0.1.0-pilot.4.2.tgz`，17912 bytes。
- SHA256：`70340f21a2e49c086ce07a37f4f178ee696a1bf915f9b920b75b6d33fe175dfc`。
- 12 个常规 UTF-8 成员、0644，无安装脚本、无内嵌教练包；两次确定性打包逐字节一致。
- 原 P4.1 SHA256 保持 `8b4e637a4efedeefc95835602f65ad60ec1440b8b6ed9671327adc05a0d22801`。
