# 后续接口边界（未接入生产）

## 生产信任清单

入口只有 catalogID/packageID/version/requestID。生产构建须排除 DemoFixtures，并通过签名应用或明确受管渠道预置 `CatalogTrust` 的 catalog → HTTPS origin → keyID/publicKey；当前外部 URL 入口一律拒绝，没有生产 trust。HTTP Hub 页面、URL 参数、下载清单本身均不能添加可信 key/origin。正式签名发布、key 轮换/撤销、有效期和发行审计策略尚待设计实施。

固定路由 `/manifests/<package>@<version>.json` 返回 schema 2 envelope。先验证原始 payload 字节签名，再显示身份/版本/权限/hash，下载仅使用绑定 origin 的不可变地址。旧 Hub catalog.json 和独立 SHA 不等于可信发布清单。包种类/权限变化、更新或降级需要新的清单与本机确认；不能复用旧审批。团队审核不授予本机权限。

UI 的一次确认只覆盖当前已显示清单的下载与合成处理。`InteractiveInstallSession` 提供 review/transfer/validate/apply/cleanup 分段；`InstallerViewModel` 区分下载失败、归档失败、取消等待与结果未知。生产处理器不能把“CLI 进程返回”直接当作技能可用，也不能复用模拟成功枚举。

## 官方 CLI 适配器

`OfficialCLIPlan` 目前只保留 executable/argv；`OfficialDesktopAdapter.execute` 固定拒绝。生产入口没有后台进程、shell 或本机控制端口；新增隔离伪CLI执行核心见文末。官方版本依据和源码链接见 README。

真实适配前需要：验证随官方 Desktop 应用的 CLI 与 runtime 0.2.0-rc.2；识别并限定用户明确选择的真实 Home/profile；按官方要求初始化并完整退出 Desktop；显示退出/变更范围由用户确认；只允许固定 executable 和白名单 argv，不接受网页路径/参数；将经验证的私有目录交给官方 `plugin --profile desktop add`；记录退出码和官方结果，失败或回执丢失保持未知，避免盲目重试。不得调用 npm CLI 冒充 Desktop CLI。

bundle 安装/启用与 row 启用独立，必须保留已有用户选择；安装完成不代表自动启用、重启后加载或实际调用成功。是否能一次退出期间合并安装和启用必须用官方接口证明并独立验收，当前未实现也不承诺。走模型 plugin_manager 时每次管理提升仍须官方审批；助手本机确认不豁免这些审批，不开启永久 FullAccess。

合成写入及取消现已收到用户手工 PASS，非代理视觉确认，退出状态未知。后续仅准备真实试点，目标、缺口与分阶段确认见 [PILOT-PLAN.md](PILOT-PLAN.md)。真实安装、CLI 执行、系统协议及生产分发均未获本轮执行授权。

## 隔离 CLI 执行核心增量（2026-10-10）

`CLIAdapter.swift` 已实现 internal `IsolatedCLIAdapter`：只能绑定本进程新建的 SimulationEnvironment；检查文件所有者/符号链接、随机 Home 标记、版本/身份校验接口返回及 executable/package hash，重查空闲状态和同名包，O_EXCL 私有锁，nonce/目标/hash/5分钟单次确认。固定 argv 为 plugin --profile desktop add 本机包；不接收网页路径、额外参数或环境。环境仅有合成 HOME/DSH_HOME/DSH_AGENTS_HOME、系统 PATH、LANG 和私有 TMPDIR，stdin 关闭。

已用 Foundation Process 执行临时 Python 伪 CLI；stdout/stderr 合流累计限制16KiB，内容全部丢弃，回执仅固定错误码。超时/取消只终止本次启动的直接子进程，绝不查杀 DSH 实例；不是完整后代进程树隔离，正式运行前仍须解决官方CLI可能派生的子进程生命周期。原子JSON记录 prepared/applying/verifiedInstallationOnly/unknown，丢失回执或中断恢复为未知，不自动重试或回滚。exit 0仍要状态校验器确认文件/禁用状态；verifiedInstallationOnly不是Skill可调用。

**仍为 stub／关闭：** `OfficialIdentityChecking` 的真实 macOS 签名/官方App检查实现、`TargetStateChecking` 的真实进程占用和官方metadata/精确文件核验、真实Home接纳、生产授权凭证发行及恢复UI。测试提供明确的fixture校验器，不能当官方身份或真实包元数据证明。`ProductionInstallGate.authorize()`无条件拒绝，原 `OfficialDesktopAdapter.execute`仍无条件拒绝；不存在环境变量/网页/fixture开关解锁。新核心未接到UI安装按钮，UI显示阻止原因。此次没有访问或执行真实App/CLI/Home，也没有重新打包、启动或替换正在使用的演示应用。

正式确认清单仍须包含：经审阅的助手源码commit与二进制hash/签名状态、目标机与确切独立Home/profile、官方App/CLI版本身份、唯一包版本/hash/大小、精确来源及是否下载、用户正常退出范围、仅安装且禁用的动作、失败停止/结果未知和另行卸载边界。上述真实校验器和后代进程收尾未通过隔离验收前，不请求真实执行授权。

## 后续三项实际实现更新

上一节中签名、进程/profile及后代收尾的stub说明已由本轮实际实现替代。`OfficialChecks.swift` 和 `NativeProcess` 提供真实Security.framework/libproc/profile文件检查及自有进程组管理；见 [READINESS.md](READINESS.md) 的实际证据、平台可见性阻塞和仍关闭的生产接线。不能将历史stub说明或本轮绿色单元测试当作真实试点已就绪。

本地选择工厂、一次性授权模型、原生准备视图与实际执行构造器已完成接线，但生产门保持关闭。详见 [LOCAL-PILOT-WIRING.md](LOCAL-PILOT-WIRING.md)；未知进程在三个复核节点均不可绕过。
