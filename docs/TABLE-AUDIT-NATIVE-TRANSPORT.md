# CSV 原生传输：隔离开发约束

本阶段仅在树外插件源码及隔离合成测试中开发专用 WebSocket；不启动官方 Desktop、不改变协议关联、不启用到现有 profile、不修改官方 DSH。

旧 HTTP 入口要求精确的 loopback Origin 与线上的 Host 相等，再通过官方 Connection 的认证及跨站检查。CSV 仅以明确上传的字节和规则对象进入 Host；任意路径不是输入接口。page/task ID、revision、期限及撤销约束绑定快照，所有任务共享 Python 子进程并发预算。模型 Agent 的直接工具调用由既有 guard 拒绝。

官方固定 rc.2 的 HTTP 转发移除 Origin，因此原插件拒绝原生请求。签名包另有所属窗口的 loopback WebSocket Origin/Cookie 重写，专用插件可使用公开的 `webServer.registerUpgrade`。候选握手必须额外要求非缺失、非 null、精确的 Origin/Host；官方 Cookie 和 Fetch-Metadata 检查仍执行。通用 Operator/Gateway、无 Origin 放行及自报 Desktop 标记不作为替代。

新增的区别是连接寿命：专用 socket 的页面/任务额外绑定服务端连接对象，原 HTTP 入口和其他连接即使得到 page/task ID 也不能使用该绑定。连接关闭立即撤销，正在运行的 Python 必须终止并清理；消息/帧、未完成请求及连接寿命均有有限预算。缺少握手证明时拒绝，不退回不安全的 HTTP 原生通道。

两种入口都信任已认证同源客户端提供的逐文件确认。服务端不能证明确认来自人手，也不能区分能操作该页面的已授权自动化脚本。旧 HTTP 本来就没有这种证明；新增 socket 不得声称取得 Desktop 独占身份或绝对阻止这种间接操作。可保证的是：无认证/跨站拒绝、服务端连接能力隔离、没有文件路径读取、撤销及资源预算、既有模型工具 guard 保留。

验收必须使用真实 canonical Python worker及合成资料，覆盖旧 HTTP 拒绝、跨连接/跨入口借用、快照替换、用途/规则校验、过期/撤销、并发/超时、socket 退出和 feature 卸载清理。仅握手 PoC不等于业务通过，隔离集成也不等于原生 GUI通过；实际 Desktop测试另行安排。

## prototype.7 候选实现

专用路径 `/api/qcu-csv-task-ws` 和子协议 `qcu.csv.v1` 只有显式开启 `websocketEnabled` 后注册，绑定官方 WebServer 的实际端口，要求仅回环监听。`ws` 固定为 8.21.0，关闭压缩，单帧字节预算与 HTTP 请求预算一致。每连接最多 2 个未完成请求、256 帧，连接绝对寿命不超过 `grantMs`；消息不会延长授权期限。输入消息及输出响应都重新调用当前官方 `connection.requestRejection`，空闲/运行中连接每秒复核一次；Cookie 到期或当前认证 owner 拒绝旧 Cookie 时撤销页面和 worker。这与 task/grant TTL 分开，不用任务期限替代 Cookie 时效。输出积压上限 8192 字节。关闭握手最多保留 250ms 后强制关闭，连接总数受 `maxPages` 约束。客户端握手预算 5 秒、请求预算 15 秒，因此候选示例采用 10 秒 worker 超时和 1 秒终止预算。

HTTP 和 socket 共用一个 owner、相同逐字段操作校验及工具运行链路，不创建额外子进程额度。socket 的 server-owned binding 不来自消息字段。断连使用可信内部撤销接口，不依赖客户端 revision，MAX_SAFE_INTEGER 也不能阻止撤销。wire abort 中断本连接的未完成检查；文件授权仍需要显式 cancel、替换、期限或断连撤销。客户恢复会关闭旧连接并创建新的空页面，不能迁移旧 task ID。清理恢复只处理已撤销/closing 记录，不处理其他 live 授权。

feature 退出会先停止 socket、撤销 owner 再释放路由。私有文件删除失败保留原认证 HTTP recovery 和 guard，停止后的 owner 不接收新任务；该失败状态的原生 socket 不提供新的业务入口。若实际原生卸载发生此类故障，需通过现有已认证本机 Web 恢复入口完成清理，不能将 missing-Origin HTTP 放行作为补救。

两份候选入口共享 `CsvTaskOwner`/canonical worker；保持仅上传 CSV 字节、短期 snapshot/rules/purpose 绑定、count-only 输出与原 model Agent guard。`examples/csv-native-candidate.patch.json` 只是独立候选配置，未写入现有 profile。版本 .6 的已安装包与历史 ZIP 不含此次改动。

## 本轮证据和边界

新增 22 项专用 socket 回归，全套 75 项通过，涉及实际 Cordis、官方 BrowserAuth/HostConnection、公开 WebServer upgrade 和真实 canonical Python。覆盖重复 4 行/7 问题结果、跨连接/跨 HTTP 拒绝、Origin/Host/认证/子协议拒绝、默认关闭、快照替换/用途/规则/期限/取消、模型 Agent guard、帧字节预算、连接过期、MAX_SAFE_INTEGER revision 下断连、忽略 SIGTERM 的 owned child 强制终止、全局并发、wire abort、卸载、清理失败重试，以及控制器到真实 worker 的端到端流程和新连接恢复。另验证 Cookie 在授权前/运行中到期、当前认证 owner 的新密钥拒绝旧 Cookie、重复/倒序消息编号、第三个并行请求拒绝及第 257 帧断连撤销。

测试运行器使用本机已有开发 Node 25.8.1；真实引擎使用官方 rc.2 包的 Python 3.12.14。官方签名 Node 24.21.0 可完成 Host 构建，但其 Library Validation 拒绝加载现有 rolldown 测试原生模块，因此没有修改签名或重装依赖。TypeScript Host/Client 检查和两侧构建通过。本机完整原始测试结果另存于独立验收区，源码证据只保留脱敏结果。

独立只读复核指出初版握手认证缺少持续时效检查，现已修复并补测；修复后已在独立临时副本重跑 75 项并通过，无新阻断发现；证据见 `evidence/table-audit-native-independent-review.json`。真实原生 Desktop 交互另行验收。官方 BrowserAuth 在激活时加载签名密钥，并没有宣称凭据文件的直接编辑会即时撤销；新密钥用例只在测试 harness 模拟认证 owner 重新激活，并使用真实官方签名验证。未启动 App、未修改 dsh:// 默认处理器、未变更任何现有 profile，未调用模型或用户私人文档。`packageReady=false`，没有宣布正式分发或 native GUI 通过。

## 下次实际 Desktop 的最小验收

1. 独立复核候选 source/tests/docs 后，通过官方 Plugin Manager/CLI 在独立合成 Home 安装 .7；核对 manifest 中的 `ws` runtime 依赖和官方 peer 版本，默认 Bundle 仍关闭。
2. 使用既有官方启动入口和独立 Home，只启用 Task/Guidance 及候选配置 `websocketEnabled: true`；核对主 Host 的 webServer 为 127.0.0.1 和 active fiber，没有模型 Session/私人文件。
3. 在实际 App 中从系统文件选择框选取合成 CSV，确认前不读取字节。用演示规则确认 diagnose-csv，检查和重复检查应返回 4 行/7 问题，再验证个人规则、取消及重选。
4. 查看纯计数报告并导出 JSON，实际取消保存对话框，再重新导出；这些必须是原生用户交互，API 或 headless Chrome 不替代该结果。
5. 验证关闭 CSV 页面、App 正常退出/重启后旧授权失效、自有 worker/临时目录清空；重新选择并明确确认后才能检查。工具不可控制原生对话框时，仅记录此具体阻塞，不宣称通过。

插件实现本身不要求协议关联变化；它使用 App 已有的 stream endpoint 和公开 upgrade API。若某一具体官方启动入口依赖 dsh:// 且当前默认处理器指向另一 App，这是另一个启动现场问题，须独立核实，不在本轮更改。
