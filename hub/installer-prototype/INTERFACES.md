# 后续接口边界（未接入生产）

## 生产信任清单

入口只有 catalogID/packageID/version/requestID。生产构建须排除 DemoFixtures，并通过签名应用或明确受管渠道预置 `CatalogTrust` 的 catalog → HTTPS origin → keyID/publicKey；当前外部 URL 入口一律拒绝，没有生产 trust。HTTP Hub 页面、URL 参数、下载清单本身均不能添加可信 key/origin。正式签名发布、key 轮换/撤销、有效期和发行审计策略尚待设计实施。

固定路由 `/manifests/<package>@<version>.json` 返回 schema 2 envelope。先验证原始 payload 字节签名，再显示身份/版本/权限/hash，下载仅使用绑定 origin 的不可变地址。旧 Hub catalog.json 和独立 SHA 不等于可信发布清单。包种类/权限变化、更新或降级需要新的清单与本机确认；不能复用旧审批。团队审核不授予本机权限。

UI 的一次确认只覆盖当前已显示清单的下载与合成处理。`InteractiveInstallSession` 提供 review/transfer/validate/apply/cleanup 分段；`InstallerViewModel` 区分下载失败、归档失败、取消等待与结果未知。生产处理器不能把“CLI 进程返回”直接当作技能可用，也不能复用模拟成功枚举。

## 官方 CLI 适配器

`OfficialCLIPlan` 目前只保留 executable/argv；`OfficialDesktopAdapter.execute` 固定拒绝。没有后台进程、shell 或本机控制端口。官方版本依据和源码链接见 README。

真实适配前需要：验证随官方 Desktop 应用的 CLI 与 runtime 0.2.0-rc.2；识别并限定用户明确选择的真实 Home/profile；按官方要求初始化并完整退出 Desktop；显示退出/变更范围由用户确认；只允许固定 executable 和白名单 argv，不接受网页路径/参数；将经验证的私有目录交给官方 `plugin --profile desktop add`；记录退出码和官方结果，失败或回执丢失保持未知，避免盲目重试。不得调用 npm CLI 冒充 Desktop CLI。

bundle 安装/启用与 row 启用独立，必须保留已有用户选择；安装完成不代表自动启用、重启后加载或实际调用成功。是否能一次退出期间合并安装和启用必须用官方接口证明并独立验收，当前未实现也不承诺。走模型 plugin_manager 时每次管理提升仍须官方审批；助手本机确认不豁免这些审批，不开启永久 FullAccess。

合成写入及取消现已收到用户手工 PASS，非代理视觉确认，退出状态未知。后续仅准备真实试点，目标、缺口与分阶段确认见 [PILOT-PLAN.md](PILOT-PLAN.md)。真实安装、CLI 执行、系统协议及生产分发均未获本轮执行授权。
