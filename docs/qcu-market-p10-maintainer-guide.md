# P10 开发与管理员维护指南

> 2026-10-15补充：[P10 mini工具51项实测通过](qcu-market-p10-mini-selftest.md)；[P9 pnpm热缓存升级丢失完整性字段机制已复现](qcu-market-p9-cache-integrity-reproduction.md)。真实Home升级仍未修复，已有坏锁不能靠改填本地TGZ自动修复。以下版本矩阵与历史边界保留。

P10 是 Python 3.9+ stdlib 离线提交检查工具，教师继续使用已发布的 P9 市场。当前状态取自仓库内 2026-10-14 [P9 Hub 发布证据](qcu-market-p9-hub-deployment.md)和父级已写的[P9 mini 用户回执复核](qcu-market-p9-mini-acceptance-review.md)，本轮没有重新联网观测、部署或原生验证。新工具不更改市场、Hub、审核目录、协议、八个产品或历史包。

## 固定版本与证据

支持基线是官方 DSH `0.2.0-rc.2`、Apple Silicon Mac，Cordis `4.0.4`。Windows/其他架构、其他 DSH 版本不因 P10 静态检查而成为受支持组合。表中 published 是既有 Hub 发布记录，不是 testEvidence 或历史 release JSON 中 candidate 状态自动提升。

| 名称 | 固定版本 | bytes | 完整 SHA256 |
| --- | --- | --- | --- |
| qcu-market | 0.1.0-pilot.9.1 | 43446 | `ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12` |
| qcu-study-coach | 0.1.0-pilot.2 | 3445 | `4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060` |
| qcu-lesson-planning | 0.1.0-pilot.1.1 | 4429 | `6f8930d4f12f8f52c93422b41cadd050db374c0fe4ce5c06e8b824e69d672bd4` |
| qcu-tiered-practice | 0.1.0-pilot.1.1 | 4434 | `183e63eab27bb13dc98f4bec437028126284459c0eeef294e1ee87e819711052` |
| qcu-note-organizer | 0.1.0-pilot.1.1 | 4660 | `9c8f1e50ac4f3aff613678c8c094b4e8f53c0393ca011e7a41ceaa5ab96f67e7` |
| qcu-reading-outline | 0.1.0-pilot.1.1 | 4748 | `a0ab4dd00ce1a2b259126a1b11fb1c7f4e7599e13a2318ae3009e03b2cab7a79` |
| qcu-integrity-guard | 0.1.0-pilot.1.1 | 5153 | `3136b795de94ffd38d522c3ba5e8ac630fca4759386288aad09dfa15baea62bf` |
| qcu-team-briefing | 0.1.0-pilot.1 | 18882 | `11a6a616c488afbebc0b1781f3e40039c2e49c697cadee0fc095f2e151d6c2bf` |
| qcu-feishu-readonly | 0.1.0-pilot.1.1 | 11263 | `37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17` |

固定文件名均为 `ID-version-fullSHA256.tgz`。产品记录来源：[coach](../hub/market/coach-release.json)、[五项教学 Skill](../hub/market/skill-releases.json)、[教研简报](../hub/market/external-skill-release.json)、[飞书只读](../hub/market/feishu-release.json)；固定发布关联以 P9 发布记录为准。P9 源修订 `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3`。该发布记录的 LAN 25项、旧12包保留、先前源/HTTP/浏览器295项与归档21项是历史结果，本轮未重复运行。

教练和备课的历史合成原生调用分别见[教练现场记录](qcu-market-coach-live-20261012.md)与[P6.3现场记录](qcu-market-pilot6.3-live-validation.md)。它们不证明 P9 的全部八产品或教师教学效果。P9 当前验收以[P9 mini 回执复核](qcu-market-p9-mini-acceptance-review.md)区分用户报告、父级直接看过的证据和未测项，后续仍按[实机任务书](qcu-market-p9-cursor-acceptance.md)及[用户验收表](qcu-market-p9-user-acceptance.md)记录，不把共享 React 合成预览当作实机证明。

## P9 mini 回执与尚未解决的 URL 升级失败

父级已复核的用户回执报告：同字节 P9 本地 TGZ 在官方流程安装成功，随后完成核心新手指引、三个任务模板和反馈测试；三项真实 Skill 有模型响应、教师审核通过。这些业务结果的证据强度是用户报告通过，父级未独立复评完整教学正文，也未独立观察真实注入。默认 Home 在本次报告开始时已经是市场9.1，不能把结束后的相同版本描述为恢复到旧市场。

原测试 Home 从旧本地 file 来源 market6.3 切到固定 HTTP market9.1 时，官方 pnpm 流程报告 `ERR_PNPM_MISSING_TARBALL_INTEGRITY`，URL 升级仍失败。同包的43,446字节及完整SHA256已确认，随后同字节本地文件官方安装成功并继续核心测试。它不证明所有 Hub URL 都不可安装，也不支持包损坏的结论；没有原错误窗口截图/原始pnpm日志，父级尚未复现根因。P10 静态通过不能解决或覆盖该失败。

精确360px/实际最窄宽度、可信网络断言、真实注入观察、正常退出重载后的草稿清除及部分安装/状态截图证据仍缺失或未测；亮暗/键盘和复制/清空等用户声明按父级复核保留限定，不能提升为完整独立验证。模型网络超时也不由离线检查器诊断或自动重试。

排查须保留精确URL、本地固定包及原请求信息，未知结果先核对请求；本地文件流程是本次已有成功证据的方式，不是锁完整性错误的根因修复。不删除/修改锁、profile，不取消冻结锁、不覆盖旧包、不绕过官方流程。本轮没有新增 mini 操作，未读取原私有ZIP或截图；事实来源只链接父级复核文档。

## 开发者交付

1. 从[模板](../templates/qcu-submission/README.md)填写产品身份、固定源码修订和 PLUGIN-SPEC，明确 Host/Client/组件/Skill/provider、权限、依赖、数据和副作用。P10 不创造一个不存在的服务 SDK 或兼容承诺。
2. 独立准备构建说明、来源/许可、锁定证据和精确成员清单；保存最终 TGZ 原字节、bytes、全 SHA256。所有材料在同一 handoff 树，使用本地引用，无真实凭据/教师/学生/邮件材料。
3. 分别登记 source/preview/liveInstall/businessAcceptance；没有做的填 untested/null，失败保留 failed。材料中的命令只供人工阅读，检查器不会执行。
4. 用[离线 CLI](qcu-market-p10-submission-check.md)生成新报告；修复错误后用新的输出文件，保持旧证据。不要在报告上改成 approved。

## 管理员审核与推广

1. 冻结收到的 handoff 副本，独立计算最终包哈希和字节数，再检查 manifest 与来源/锁文件；不跟随提交者指定的 URL 或执行其命令。检查器报告不是真实性证明，也不保证代码安全。
2. 阅读报告的 errors/unsupported/reviewRequirements。错误和 unsupported 都阻止静态通过；对未知依赖、原生能力、许可、脚本和权限单独决策，不提供跳过开关。空 permissionSummary 会明确列出 `permissions.summary_missing`，须开发者补充/管理员复核，不能解释为无权限。匹配的 installScripts 仍须专门审核，不能据此执行。
3. 人工审阅源码、接口契约、数据隔离、配置/授权/撤销、组件默认禁用、网络和副作用边界。校验身份而非相信标题；Skill.provider、工具发现、Client/Host/slot 与实际功能必须验证。
4. 只有另获原生操作授权后，才在既有合适环境按正常官方流程 inspect/安装/单独启用/提示时正常重启，记录精确版本、哈希、组件、配置来源和结果。不能重建 Home、复制凭据、强退进程或把静态检查当安装授权。
5. 教师独立检查真实任务结果及限制；未测保持未测，失败先处理，不以声明 passed 代替证据。
6. 只有另获发布授权后，由父级维护者选择固定审核包并更新审核记录/Hub；保留旧 TGZ 与发布证据，不就地重打/改名/重写旧 bytes。发布后另做下载/大小/哈希与边界检查；当前 P10 无此动作。

P10 源 worktree 为 `$HOME/Repos/worktrees/qcu-harness/market-maintenance`（`dev/qcu-market-p10`），artifact 根为 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/`。它容纳合成例子、报告、日志和父级后续可能制作的便携工具 ZIP，不是教师安装 TGZ。不要把唯一交付留在可重建 `.work/`。提交/推送、ZIP 定稿及原 P9 精确 bytes 的独立复核由父级审阅后完成。

## 错配、未知结果与网络诊断

长度/哈希/成员清单/固定文件名不一致时停止，不尝试“修正”老包哈希或自动重打。先确认是哪一份来源、版本和审核记录；输入错误提交开发者重新交付。Host/Client 版本或协议不匹配沿用现有拒绝结果，不把未知状态视为安装成功，不靠强退或删除包解决。

静态 CLI 不联网；它不能诊断实时 Hub/模型/飞书服务状态。教师报告连接失败时，先让维护者核对已授权的网络环境、LAN 可达性、精确 TGZ URL、HTTP 状态/长度/哈希，区分下载失败、官方 inspect/安装拒绝、启用/重启、Skill/工具未发现、模型配置和业务授权失败。远程目录始终不自动信任，普通 catalog 首页不是 TGZ 安装地址。收集错误代码/版本/步骤，勿索取 API Key、凭据、完整 Home 或真实邮件。

## 升级、停用和撤回概念

P10 没有一键升级/远程自动信任能力。本段是维护原则，未新增原生验证：升级须保留旧固定包、审核新精确版本、确认组件/配置/数据兼容和人工回退方案，再用官方支持流程操作；Hub 更新不保证已安装客户端升级或回滚。停用是官方组件/插件生命周期动作，须核对订阅/子进程释放和成果保留。撤回是管理员停止推荐/提供候选的审核/目录决策，不删除教师已安装包或成果。不能擅自清空 Home、删除教师包、强退进程，亦不能宣称所有状态都有已验证的逆操作。

## AgentMail 候选检查单

目前没有完成的 `qcu-agentmail` 产品，也没有基于 P10 新证实的 AgentMail SDK/DSH 兼容性。若未来立项，先定义首版“阅读 → 摘要 → 回复草稿”，使用合成邮件评估，不从示例推导真实账号授权。

- 明确现有邮件能力的真实接口、版本、许可和调用方式，确认每项依赖/服务来源；未知项保留待验证，不编造 SDK。
- 用户选择读取范围与账号授权入口；展示将访问的字段、附件和保存范围，支持撤销，不把来信内容当工具指令。
- 摘要注明依据与不确定项；草稿可编辑，区分原文与生成内容，不自动转发附件或扩大收件人。
- 发送前必须由用户确认发件身份/发件人、收件人、主题、正文、附件及副作用；读取或生成草稿不授予发送权限。
- 分别验收认证失效、断连/取消/重试、防重复发送、停用清理、隐私脱敏和业务结果；真实邮件/联系人不放公开证据。

先提供契约、候选代码、固定包和离线 handoff，再独立申请真实业务验证。P10 不发送邮件，不把候选当已上架产品。
