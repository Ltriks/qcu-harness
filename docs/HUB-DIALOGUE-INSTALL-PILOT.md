# Hub 对话安装：内部试验与验收

第二台官方 rc.2 / CSV prototype.8 核心流程及 test.1 对话安装清单已由用户人工反馈全部通过。test.1 覆盖本机回环合成目录的固定包下载核验、真实管理审批拒绝/单次允许、安装、精确 row 激活、正常重启、标记 Skill、停用和可选移除；不是代理自动 GUI 验收，也不是实际城院 Hub 上线。DSH 源码零修改，packageReady=false。结构化结果见 [第二台 test.1 人工验收](evidence/hub-dialogue-second-mac-user-acceptance.json)。

## 实际 Hub 现状

只读 GET 本机 loopback 19390/catalog.json 返回 200，目录仍是旧 qcu-table-audit 0.2.0-prototype.5 合成 fixture，不能作为当前 prototype.8 分发来源。源码 hub/data/catalog.json 的条目都是 draft，缺少可供本试验直接使用的固定 rc.2 包/哈希。界面读取 catalog.json，插件包位于 /plugins/<file>，Skill zip 位于 /skills/<file>；这不是 npm registry 协议接口。普通 Hub 首页或目录 URL 不能直接交给官方 install_bundle 当 package spec。

loopback 地址只属于所在机器；第二台 Mac 的 127.0.0.1 不指向本机。尚无授权的跨机器私有 Hub 地址/部署。当前服务、源目录和其他 App 都没改，未发布公网。旧城院 Skill 自定义安装器不是本试验的执行链。

## 官方能力和已批准的范围

官方 rc.2 的 Standard 原本声明 @deepseek-ai/dsh-plugin-manager/tools，默认 disabled:true；可在新的独立内部试验 Home/profile 恢复该项，无需 Creator。早期 profile-change proposal 仅为审阅材料；后续已批准的小包使用官方完整 Standard 配置生成器，真实 selector 与用户验收见下文。

管理器所有动作（包括 list）在 workspace-write 模式请求该次 danger-full-access 审批；拒绝发生在管理 service 访问之前。允许一次不永久更改会话权限，但安装、启用或移除持久影响这个 profile 的所有会话；Host 插件代码在工作区沙箱之外运行。启用工具会暴露列表、安装、启停、移除及版本豁免等完整官方动作，并非代码层只允许这一个包；本试验只请求已列出的动作，其他动作不在授权范围内。

继续保持 workspace-write+ask、Creator/其他 preset 关闭、不自动批准、不使用版本豁免、不授予 approvedBuilds，不改当前已通过 CSV Home。普通合成文件的单次 workspace-write 审批不能当成这里的单次管理提升许可。

上述独立试验范围已由用户 Sentinel_39d91b10056c8191a969d4f2296536c8 批准，并在第二台使用仅回环的私有合成目录完成。实际每次管理提升由用户审阅；无需重复询问同一试验许可。实际远程 Hub 部署与访问范围仍需独立确定。用户在自己的官方设置私下配置模型，脚本不复制现有凭据。

## 已备好可审阅的合成包

hub/pilot/dialogue-install-probe 是 0.0.1-test.1 包源码，固定 Cordis 4.0.4 和 DSH Skill rc.2 peers，无 runtime dependencies、无安装脚本。Bundle row 默认 disabled:true；只有经明确启用该 row 才注册一个内存 Skill。没有文件/网络/工具/子进程/环境变量操作。标记为 QCU_INSTALL_PROBE_TEST_1，不能替代 CSV 或正式学校规则。

scripts/stage-dialogue-install-probe.py 只在新目录生成确定性 TGZ、私有 fixture catalog 和来源哈希；拒绝已有输出目录/链接，不安装、不启动服务、不改 App/profile。生成包 1279 字节，SHA256：
8b8ad2afc154278eb835a48305ce54c01d4ccc733b8f1896f807aa06dd00632e

输出 catalog 的 published 仅表示私有合成 fixture 可下载，顶层 localOnly:true/publicRelease:false；没有改源码 draft 目录，也不能将该字段解释成公开上架。代码和测试不带打包二进制、认证 URL、模型凭据或用户目录。

## 已执行的实际流程和完成条件

1. 在独立试验 profile 准备官方管理工具；先 list 获取精确 entry ID。该查询也有官方逐次审批，不能认为只读自动通过。
2. 从确认的私有目录取得该精确版本 TGZ，下载前后核对受信任来源的固定 SHA256。官方工具 schema 没有 hash 参数；哈希检查是显式前置步骤，不能声称官方管理器强制校验目录 SHA256。供安装的本机 path 必须是绝对路径，不在反馈或 Git 保存用户真实目录。
3. 对同一已核验本机 TGZ 请求 install_bundle，第一次点拒绝。核对 package.json/pnpm-lock/安装 tree 及 bundle 选择未因拒绝改变。模型自述和文字里的“工具卡片”不算管理调用证据。
4. 重试相同 target，点允许一次，核对 exact version 和返回 application。默认禁用的 fixture row 应继续无 Skill；需要另一次明确启用精确 row 的审批，不绕过默认停用。
5. HMR 保持关闭；按官方返回 restart-required，由用户正常 Quit/restart 试验 App。先确认实际退出，不删锁、不全局 kill。展开官方 skill 工具的真实结果，看到 qcu-dialogue-install-probe 和精确标记。会话仍为 workspace-write+ask。
6. 按次批准精确 row 停用或包移除，正常重启后标记 Skill 消失。试验结束；不把包残留或热切换当成功卸载。

用户于 2026-10-09 15:19（Asia/Shanghai，07:19 UTC）反馈“我做完了测试。”并确认 CHECKLIST 全部 PASS。上述固定合成链路的真实模型管理调用、原生逐次审批及正常重启生效现记为用户人工通过；代理未远程控制第二台 App。实际城院 Hub、跨机器分发和升级回退仍未验证。

## 前期工程验证（历史记录）

新增 4 项 Node 检查：默认禁用、明确激活/禁用、真实 Cordis Skill 生命周期及新 context 重建、官方管理工具拒绝先于 manager 访问/单次批准后再次请求仍审批/会话模式不变。审批和 manager 使用显式测试桩，不是原生审批或真实 pnpm 安装。重建 context 不等于 App 进程重启。

新增 2 项 Python 检查：确定性 TGZ/精确 archive entries/目录 SHA256；已有目录和 symlink 输出保持不变。本轮没有重新运行 CSV 基线、安装依赖或调用模型。既有真实离线 pnpm 及 context 重建证据保留其历史意义，不能变成本轮 Hub 模型安装通过。

详见 evidence/hub-dialogue-install-preparation.json 和 hub/pilot/dialogue-install-profile-proposal.json。



## 已获批准后的可执行小包（2026-10-09）

用户 Sentinel_39d91b10056c8191a969d4f2296536c8 明确“同意”新独立第二台配置、Standard 官方管理工具、本机回环合成目录和固定包试验；实际每次管理提升仍由本人审阅。无需再重复询问该范围。说明与操作见 [第二台执行步骤](HUB-DIALOGUE-INSTALL-SECOND-MAC.md)。

实际官方 App 标识为 preset-standard.config.plugins，配置替换不深度合并；先前纯提案的 selector 已修正。新生成器从签名 rc.2 App 读取完整配置、只启用 tool-plugin-manager、保留19个顶层条目和所有平台表达式，通过官方 composeEntries 及 YAML 序列化回读比对。没有修改 DSH 源码或预制 reserved desktop profile；用户通过官方 App 初始化新 Home。

新增助手在临时新 Home 通过签名/Gatekeeper及真实 Node-only配置生成、只回环随机端口目录、固定下载和SHA256、未知路径/查询/Host拒绝检查。8项Python用例通过，覆盖旧CSV Home/链接拒绝、配置不覆盖、拒绝安装状态比对、已安装包禁止作拒绝基线、安装字节核验和篡改拒绝。没有打开GUI、实际安装插件、调用模型或修改已验收profile。测试snapshot只证明安装元数据/合成包状态无变更，不宣称聊天记录等整个Home不变。

HMR关闭时，新安装后先正常重启才能得到真实插件entryId；启用精确row后再次正常重启才验证标记。移除前必须先set_bundle(false)并正常重启，解除startedBundles；否则官方管理器可能拒绝stop-profile。不能用shell强删或放宽门槛。当前包只验证回环下载核验加模型官方管理动作，不声称真实城院Hub上线或模型自主检索下载通过。

## 第二台人工收尾与下一阶段

用户消息 Sentinel_4d1e96e3bcd88191a2ca045f4d176a19 确认安装拒绝不变、单次允许后固定版本、重启后默认 row 停用、精确 row 启用后重启实际 Skill 标记、取消 Bundle 选择后重启标记消失、可选移除状态检查和再次重启均 PASS；会话始终 workspace-write+ask，没有 approvedBuilds、版本豁免或永久 Full Access。原已验收 CSV Home 未改。

此前工程记录中的 modelCalled/packageActuallyInstalled=false 只描述原开发 Mac 的准备阶段；保留原事实，并链接本次独立用户证据。pnpm 的 peer 汇总警告不再作为激活失败判断，具体警告原因未经诊断，不因全链路通过而断言所有 peer 警告无害。

下一步先在开发目录准备受审目录 schema、精确版本/兼容信息、不可变包名/固定哈希、明确受信任来源，以及按次批准的手动固定版本更新/回退说明和测试。真实主机位置、局域网或校外访问、首个受审包和访问人群确定后，才能迁移或发布；不自动开启访问、不自动升级、不绕过官方签名/版本/停机门槛。
