# Hub 对话安装：最小内部试验准备

第二台官方 rc.2 / CSV prototype.8 核心流程、普通文件审批拒绝/单次允许及恢复 workspace-write+ask、附带 Skill 真实加载已由用户人工反馈通过。这不证明管理器安装审批或 Hub 对话安装；本阶段仅准备后者。DSH 源码零修改，packageReady=false。

## 实际 Hub 现状

只读 GET 本机 loopback 19390/catalog.json 返回 200，目录仍是旧 qcu-table-audit 0.2.0-prototype.5 合成 fixture，不能作为当前 prototype.8 分发来源。源码 hub/data/catalog.json 的条目都是 draft，缺少可供本试验直接使用的固定 rc.2 包/哈希。界面读取 catalog.json，插件包位于 /plugins/<file>，Skill zip 位于 /skills/<file>；这不是 npm registry 协议接口。普通 Hub 首页或目录 URL 不能直接交给官方 install_bundle 当 package spec。

loopback 地址只属于所在机器；第二台 Mac 的 127.0.0.1 不指向本机。尚无授权的跨机器私有 Hub 地址/部署。当前服务、源目录和其他 App 都没改，未发布公网。旧城院 Skill 自定义安装器不是本试验的执行链。

## 官方能力和需要确认的范围

官方 rc.2 的 Standard 原本声明 @deepseek-ai/dsh-plugin-manager/tools，默认 disabled:true；可在新的独立内部试验 Home/profile 恢复该项，无需 Creator。提供的 profile-change proposal 是审阅材料，不是已应用或已验通的配置补丁。实际应用需要确认后按官方 composition 标识核验。

管理器所有动作（包括 list）在 workspace-write 模式请求该次 danger-full-access 审批；拒绝发生在管理 service 访问之前。允许一次不永久更改会话权限，但安装、启用或移除持久影响这个 profile 的所有会话；Host 插件代码在工作区沙箱之外运行。启用工具会暴露列表、安装、启停、移除及版本豁免等完整官方动作，并非代码层只允许这一个包；本试验只请求已列出的动作，其他动作不在授权范围内。

继续保持 workspace-write+ask、Creator/其他 preset 关闭、不自动批准、不使用版本豁免、不授予 approvedBuilds，不改当前已通过 CSV Home。普通合成文件的单次 workspace-write 审批不能当成这里的单次管理提升许可。

需要用户确认：允许创建独立试验 Home/profile 并启用 Standard 的官方管理工具，按次批准列表/固定包安装/精确 fixture row 启停移除，以及由用户正常退出重启这个试验 App。推荐第二台自己使用仅回环的私有合成目录 fixture；也可明确提供双方可达的授权私有 Hub 地址。都不需要 API Key 内容或私人 CSV。用户在自己的官方设置私下配置模型，脚本不复制现有凭据。

## 已备好可审阅的合成包

hub/pilot/dialogue-install-probe 是 0.0.1-test.1 包源码，固定 Cordis 4.0.4 和 DSH Skill rc.2 peers，无 runtime dependencies、无安装脚本。Bundle row 默认 disabled:true；只有经明确启用该 row 才注册一个内存 Skill。没有文件/网络/工具/子进程/环境变量操作。标记为 QCU_INSTALL_PROBE_TEST_1，不能替代 CSV 或正式学校规则。

scripts/stage-dialogue-install-probe.py 只在新目录生成确定性 TGZ、私有 fixture catalog 和来源哈希；拒绝已有输出目录/链接，不安装、不启动服务、不改 App/profile。生成包 1279 字节，SHA256：
8b8ad2afc154278eb835a48305ce54c01d4ccc733b8f1896f807aa06dd00632e

输出 catalog 的 published 仅表示私有合成 fixture 可下载，顶层 localOnly:true/publicRelease:false；没有改源码 draft 目录，也不能将该字段解释成公开上架。代码和测试不带打包二进制、认证 URL、模型凭据或用户目录。

## 确认后的实际流程和完成条件

1. 在独立试验 profile 准备官方管理工具；先 list 获取精确 entry ID。该查询也有官方逐次审批，不能认为只读自动通过。
2. 从确认的私有目录取得该精确版本 TGZ，下载前后核对受信任来源的固定 SHA256。官方工具 schema 没有 hash 参数；哈希检查是显式前置步骤，不能声称官方管理器强制校验目录 SHA256。供安装的本机 path 必须是绝对路径，不在反馈或 Git 保存用户真实目录。
3. 对同一已核验本机 TGZ 请求 install_bundle，第一次点拒绝。核对 package.json/pnpm-lock/安装 tree 及 bundle 选择未因拒绝改变。模型自述和文字里的“工具卡片”不算管理调用证据。
4. 重试相同 target，点允许一次，核对 exact version 和返回 application。默认禁用的 fixture row 应继续无 Skill；需要另一次明确启用精确 row 的审批，不绕过默认停用。
5. HMR 保持关闭；按官方返回 restart-required，由用户正常 Quit/restart 试验 App。先确认实际退出，不删锁、不全局 kill。展开官方 skill 工具的真实结果，看到 qcu-dialogue-install-probe 和精确标记。会话仍为 workspace-write+ask。
6. 按次批准精确 row 停用或包移除，正常重启后标记 Skill 消失。试验结束；不把包残留或热切换当成功卸载。

工程准备已完成，真正模型对话/原生管理审批/用户 App 重启生效仍未验证，需上述确认和实际操作者结果后关闭缺项。当前不得启动/停止用户 App、改第二台机器或公开部署。

## 本轮验证

新增 4 项 Node 检查：默认禁用、明确激活/禁用、真实 Cordis Skill 生命周期及新 context 重建、官方管理工具拒绝先于 manager 访问/单次批准后再次请求仍审批/会话模式不变。审批和 manager 使用显式测试桩，不是原生审批或真实 pnpm 安装。重建 context 不等于 App 进程重启。

新增 2 项 Python 检查：确定性 TGZ/精确 archive entries/目录 SHA256；已有目录和 symlink 输出保持不变。本轮没有重新运行 CSV 基线、安装依赖或调用模型。既有真实离线 pnpm 及 context 重建证据保留其历史意义，不能变成本轮 Hub 模型安装通过。

详见 evidence/hub-dialogue-install-preparation.json 和 hub/pilot/dialogue-install-profile-proposal.json。

