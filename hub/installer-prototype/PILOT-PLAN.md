# 最小真实试点方案（仅准备，未执行）

2026-10-10。当前助手源码 `01845695b49d1e27f62b9446886195d64eb1c4a0`，本地演示二进制 SHA256 `6b902ebc870be07f199b639c74ceb1220b8e1587bb5105d9815d8cdb57fafbf7`。它只能操作合成 Home，不能用于真实安装；后续执行构建必须重新给出 commit、二进制 hash、分发来源及是否签名，不能沿用此次演示授权。

## 新增验收事实

用户回传“已写入合成 DSH Home；真实 DSH 未安装、未发现或调用验证。”随后用户按清理重置、慢速下载确认后立即取消的指导，回复“都满足预期”。记录为合成写入、清理重置及取消的**用户手工 PASS**，不是代理视觉验收。没有收到已退出的确认；本轮未操作演示进程。重复点击、关闭行为不因该反馈自动计为通过。

## 目标选择：优先 mini，但先只读核实

既有[第二台说明](../../docs/HUB-DIALOGUE-INSTALL-SECOND-MAC.md)及[人工证据](../../docs/evidence/hub-dialogue-second-mac-user-acceptance.json)记录 Apple Silicon mini 使用官方 0.2.0-rc.2、独立试验 Home，且不改原 CSV Home。上游任务另转述此机已完成学习教练安装/精确 row 启用和真实 Skill 调用。故该 Home 是已用试验环境，不能假定为空或可覆盖；当前占用、完整路径、所有者、App 实际版本须下一轮本机只读确认，本轮没有 SSH 或实时探查。

MacBook 只证明隔离 SwiftUI 演示运行；本轮没有证据证明其当前 `/Applications` 下存在官方 rc.2 或可用独立真实 Home。不得把归档 App、npm runtime 或历史改造候选当成可直接使用的官方 Desktop。优先 mini 可省去安装官方 App，但若既有 Home 有同名包，应停止；用户可另选全新专用 Home，创建和初始化须单独说明批准。不能为制造一次“成功安装”先卸载用户已用包。

## 执行 adapter 缺口

[Installer.swift](Sources/InstallerCore/Installer.swift) 的 `OfficialDesktopAdapter.execute` 固定抛错；`SimulationEnvironment` 仅生成临时目录。真实实现至少缺：

- 官方 App/内置 CLI 的签名身份、版本、路径验证；明确 Home/profile 绑定及防符号链接/误选默认 Home；干净的受限环境变量构造。
- 已初始化、无任务、完整退出的验证。首轮让用户正常 Quit 指定试验实例；助手检查后才继续，不全局 kill、不删锁、不自动停其他实例。状态不确定就停止。
- 无 shell 的固定 executable/argv 执行器、超时/取消/子进程收尾、脱敏结果和日志、并发互斥与重复提交保护；安装启动后不能把取消说成已回滚。
- 安装前后官方元数据和包文件核验、默认 row 状态保留、官方错误/stop-profile/build approval 门槛处理、丢失回执的未知状态恢复。当前 CLI 参数计划不是这些能力的证明。
- 真实状态模型与本机确认 UI；不能把 synthetic success 映射为真实可用。安装、bundle 选择、row 启用、加载、实际 Skill 调用分别验收。

官方依据：[Desktop CLI 使用要求](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/README.md#L89)、[管理工具逐次审批](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/boot/plugin-manager/src/tools.ts#L21)。不能承诺一次重启合并全部步骤。执行实现仍需隔离测试/评审；本轮未新增实现。

## 不造生产 key 的固定包试点

包仅选已审核 `qcu-study-coach@0.1.0-pilot.1`，3331 字节，SHA256 `76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c`，类型是带 Host JS 的插件，非纯文本 Skill。固定下载来源见[发布记录](../../docs/HUB-STUDY-COACH-LAN-PUBLICATION.md)，下载路径为 `/plugins/qcu-study-coach-0.1.0-pilot.1-76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c.tgz`。

最小办法是**一次性离线导入试点**：通过独立受审渠道给出包身份/hash/大小，在用户选定的本机 TGZ 上重新验字节与文件集。HTTP 只作运输，不能证明来源；若批准下载，先在本机确认单填入确切的受审 origin，并限定该 origin 下上述唯一下载路径、无重定向、不读取网页公钥。内容 hash 的可信性来自独立核对，而非同源 catalog。该方法不需要生成生产 key，也不使用公开 test key 签名作为真实授权。

这是尚需实现的单包本机授权路径，不是降低现有生产 CatalogTrust 门槛：生产 URL/catalog 入口继续关闭；不能把 fixtureOnly 开关用到真实 Home，也不能把 HTTP 改为生产可信来源。独立导入模块只接受受审固定身份、hash 和本机一次授权，无目录扩展/自动更新/自动启用。若坚持直接使用现有签名下载核心，则必须先完成正式可信清单分发，不能用测试 key 临时代替。此试点验证执行 adapter，不声称完成 Hub 点击安装。

## 分阶段确认与回滚边界

1. **下一步只读预检**：具体确认 mini、官方 App 和拟用独立 Home；检查版本/所有者/是否运行/是否已有同名包，不读模型配置、API Key 或聊天。产物为脱敏目标基线与冲突结论，不退出、不创建 Home、不安装。该阶段不需要运行未完成的执行助手。
2. **实现与审阅后，单独确认安装试点**：明确新的助手构建身份、目标机/App版本/Home/profile、上述唯一包/hash、包已本地存在还是允许单次 HTTP 下载；动作限核验、在用户正常 Quit 指定实例后执行一次官方安装、核验结果，保持 row 未启用。若 CLI 安装是否会选择 bundle 尚不清楚，先核实行为再给确认单，不能许诺不会变更。拒绝/失败/占用停止，不自动重试或申请构建豁免。第一次不自动重开、不调用模型。
3. **安装证据通过后才提下一张确认单**：指定实例重开、读取官方精确 entryId、逐次审批启用和必要重启、仅合成问题的 Skill 调用。此步涉及 Host JS 实际加载和用户模型额度，须明确。模型 plugin_manager 每次仍需用户允许一次，不得永久 FullAccess。

回滚先以不覆盖既有同名包为前提。安装前记录必要插件元数据/已有状态（不复制整 Home 或凭据）；确认官方 remove 的适用条件后，失败只报告状态，不 shell 强删。若需要卸载或恢复，另给针对本次包的确认单；已加载 bundle 按官方要求停用、正常退出/重启后再移除。首次安装不承诺自动数据回退；用户手动退出只限专用试验实例。不得拿旧 PID 杀进程、停原 CSV/其他 App 或改现有 Hub 服务。

预计后续产物：可审阅的真实 adapter 差异与隔离测试、带身份/hash 的单包导入开发构建、目标只读基线、一次安装确认卡、脱敏安装回执及单独卸载方案。未完成前不申请执行一个内容不明确的长串操作。本轮到方案为止，不安装、不生成生产 key、不注册 scheme。
