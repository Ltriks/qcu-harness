# QCU目录驱动市场：分阶段设计

状态：2026-10-11，第1阶段已获授权实施，见 qcu-market-catalog-phase1.md；不改变已验收P4.2/教练P2，不部署、不发布、不创建签名密钥、不迁移TS。

## 先固定信任，再增加条目

第一阶段把当前单个 `trusted-release.mjs` 转成随市场包交付的、经过源码评审的不可变目录快照与信任清单。仅教练P2作为真实可安装条目；备课/材料整理暂为草案，不虚构包或安装能力。

第二阶段才接固定Hub JSON地址：市场包内固定 `origin + catalogRevision + catalogSha256 + maximumBytes`。下载原始字节先验固定目录SHA，再解析严格schema。远端不得提供、替换其自身的可信SHA。目录更新须经过独立源码审阅、重新固定SHA、用户批准的市场包更新；不自动跟随 latest。这与当前随包固定单包URL/SHA的信任方式等价，尚不是动态发布者认证系统。

SHA256只证明字节与预先信任的承诺一致，不能单独证明发布者身份。HTTP服务器自报的hash、review=approved、source=QCU都不是身份证明。发行者可信度继承人工审核和用户取得/安装市场包的受信渠道；若该渠道不可信，固定hash也无法补救。HTTPS可保护传输到端点，仍不能替代内容审核。未来签名目录、密钥保管/轮换/撤销属于另行设计与批准，当前不创建密钥或证书。

## 清单与schema

复用 `hub/release/catalog.mjs` 的发布条目语义（id/version/file/sha256/bytes/dshVersions/defaultDisabled），不直接改旧schema v1。新增市场视图schema v2、严格适配器；一份审核输入生成Client展示快照及Host信任清单，避免手工双维护。浏览草案与可执行发行记录分别校验，不能把draft转换成approved。

- 根：schemaVersion、revision、条目上限、兼容市场协议；固定源和目录SHA保存在包内信任锚，不从JSON覆盖。
- 展示字段：id、名称、场景、用途、sourceLabel、许可/来源、前提、风险、示例、测试状态、kind（bundle / builtin-guidance / draft）。均按纯文本呈现，不解释HTML/JS。
- 可安装发行字段：精确packageId、version、不可变文件名、sha256、bytes、dshVersions、defaultDisabled=true、组件ID和预期skill标识。只接受审核的TGZ流程；旧Skill ZIP不自动进入插件安装通道。
- 身份键为 packageId@version+sha256；同版本不同hash拒绝。拒绝未知字段、重复身份、越界大小、宽泛兼容版本、路径穿越、任意URL、重定向、额外源及脚本命令。
- 第一阶段继续沿用当前1 MiB包上限、固定局域网origin和缓存所有权检查，不因通用catalog工具上限较大而扩大权限。目录上限256 KiB/100项作为独立解析上限。

## Client/Host与操作

Client负责多条目卡片及状态机；Host用本地信任清单按releaseKey查包，RPC不接受URL、路径、hash或安装命令。prepare/verify/cancel凭据绑定 catalogSha + releaseKey + UUID + 到期时间；Host与Client握手包含协议/目录指纹。官方manager仍是唯一安装/启用执行者。

每条卡片独立映射：草案、官方内置未核验、未安装、已安装未启用、组件未启用、组件运行、待重启、版本冲突、加载失败、结果未确认、已撤回。实际installed/enabled只能来自官方清单，发布状态不能冒充实例状态。已有其他版本仅显示差异；首版不提供自动升级或降级。

安装流程保持：显式准备→验包→官方inspect→展示来源/版本/hash/权限→用户确认→复验目录及凭据/实例/inspect→官方installBundle(enabled=false)→核对结果及最新清单。包启用与组件启用另行确认，重启仅提示。跨卡片初期全局串行一个修改任务；其他卡片可浏览，防止同profile并发写。取消/断线沿用P4.2的不重装、待核对状态。

## 失败、过期与撤回

任何目录SHA/schema失败：拒绝新目录，不加载其中任何可执行信息。仅展示已验证的随包快照，并明确“离线/旧快照，无法确认最新撤回状态”；远程模式失联默认禁用新安装，已有插件仍可在官方管理器查看，不自动停用/卸载。

撤回必须出现在新受信目录快照内。删除条目不等同于已卸载；已安装项保留历史身份及官方管理入口。已认证撤回阻止新的prepare/confirm，作废未执行确认；已交官方安装的任务只能请求取消并核对结果，不能承诺已停止。固定旧目录无法即时发现服务器撤回，这是明确限制，不以HTTP未认证撤回消息执行管理动作。

目录变更、选中版本变更、Host重连均使确认失效。目录中unknown/withdrawn项不能发安装RPC；错误路径不得回退任意URL、远程HTML或旧安装器。无缓存静默信任、后台安装、model key复制或权限豁免。

## 测试与渐进交付

1. 先只将教练P2装入新目录结构，保持TGZ/hash/安装接口不变；旧P4.2测试继续通过。
2. schema/信任：远端自报hash、篡改、同版异hash、回滚revision、未知字段、重复项、超限、URL跳转、路径穿越全拒绝；官方Office及草案从不进入安装。
3. 多条目：两份本地合成fixture验证卡片状态隔离、全局写锁、双击、切页、卸载释放、确认作废、撤回/离线、已安装未知版本与失败状态。
4. 使用实际打包产物经过官方ClientConnection/HTTP/Gateway/Host/manager契约；覆盖P4.2 status握手及stage=enable结果，避免再次只测内存mock。
5. 真机在独立环境验证下载→取消→再准备→用户亲点安装→独立启用→技能发现；不能以旧默认实例或模拟测试替代鲜安装结果。没有模型配置的新Home，技能实际读取/模型验收须另有用户配置，不能复制默认密钥。

第1阶段按用户后续授权实施；远程目录、撤回协议、签名基础设施仍是设计，不是已实现功能。本轮不部署或发布。
