# QCU Harness

## Mac rc4.1 启动修复候选（本地验证，未部署）

本轮按任务指定分支 `dev/qcu-suite-startup-fix`、独立 worktree `$HOME/Repos/worktrees/qcu-harness/suite-startup-fix` 完成。rc4.1 使用独立 Home 和按 seed 区分的外层应用标识，严格保留旧回执及数据保护；启动失败输出固定安全中文诊断。清蓝主题0.2.3仅更新版本说明，11项产品、官方组件和复制安装策略保持冻结。

37项窄范围 Node 检查及16项迁移安全检查先通过，再完成一次完整构建；沙箱签名预检失败目录保留。当前交付选择是文档修正后的新同级包 `.work/startup-fix/rc4.1-docs-final/`，先前完整包和全部候选均保留。实际 ZIP 验证、官方 pnpm11 安装/升级/损坏归档拒绝及32项实际 Client 无头布局检查的精确结果见 `.work/startup-fix/RESULT.json`；修改、校验口径与父级交接见[启动修复审查](docs/qcu-suite-startup-fix.md)。

父级归档选择为 `$HOME/Artifacts/qcu-harness/0.1.0-rc.4.1/mac-arm64-final/`，含已解压APP、最终ZIP和当前指南；`verification/` 放分层证据，`diagnostics/` 保留原问题复现，`实际使用验收.md` 为后续步骤。较早中间包保留在 `mac-arm64/`，最终分发以 `mac-arm64-final/` 为准。本轮不部署Hub/mini，不重建Windows。源码审阅后只正常推送开发分支，不合并main。原生启动/CLI/GUI、真实模型及教师任务仍待继续确认。本版默认目录为 `~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4.1/`，不自动导入 rc3/rc4 数据。旧包、旧 Home 和历史证据保留。

## Mac rc4 历史集成候选（原阶段证据，未部署）

当前集成分支 `dev/qcu-suite-integration`，独立 worktree 为 `$HOME/Repos/worktrees/qcu-harness/suite-integration`。新线程仍从主仓库进入；先核对各 worktree、分支及远端，不修改其他线程的工作目录。

整包 `0.1.0-rc.4` 包含七项教学技能、飞书只读、课程工作台1.3、QCU市场15.2、专家团0.2.0-pilot.2和清蓝主题0.2.2，共11个产品、12项相对本地来源依赖。首次准备不下载依赖、不调用模型；安装、启用及任务发送仍保留对应确认。专家团从侧栏进入，为Host/Client协作插件，不提供独立Skill或DSH工具。

构建入口 `scripts/build-integrated-teacher-macos.py`，实际ZIP验证入口 `scripts/verify-integrated-teacher-macos.py`；固定输入、已有官方依赖、构建和分层测试命令见[最终集成与验证](docs/qcu-suite-integration-final.md)。已验证产物在 `$HOME/Artifacts/qcu-harness/0.1.0-rc.4/mac-arm64/`，含已解压APP、ZIP和当前离线指南；同版本目录的 `verification/` 放日志和匿名截图，`operator/` 放待审核的Hub发布材料，`实际使用验收.md` 为人工步骤。大产物、临时数据和私有回执不入Git。

本地检查通过不等于原生验收或上线：候选桌面启动、本人模型配置和一次真实教学任务仍待确认。本版默认数据目录 `~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4/`，不自动读取旧数据；迁移仅由维护人员对受支持、已退出的旧版预览并确认。Hub仍沿用 `192.168.1.68:8080`（管理员仅mini回环8975），本轮未部署，公开签名清单核对仍为市场15.1；Windows本轮不重建，原包保留。

[阶段A历史证据](docs/qcu-suite-integration-a.md)与[阶段B历史构建](docs/qcu-suite-integration-b.md)保留，最终版本和验收状态以以上最终集成说明及产物DELIVERY.md为准。

课程设计工作台：`dev/qcu-course-workbench`。[工作台 1.2 原生验收](docs/qcu-course1.2-native-acceptance.md)记录了一次真实生成成功、教学内容问题及尚待验收项；不能沿用早期“未安装真实 DSH”的结论。当前源码为 **1.3 本地候选（未部署）**，首用连接、完整修订和市场只读状态改进见[稳定性验证](docs/qcu-course-review-stability.md)。历史包、市场目录固定版本与旧失败任务保持原样。[Hub 单管理员本机登录与审核](docs/qcu-hub-single-admin.md)已实现，22项回归及真实 Chromium 合成流程通过，最新部署与真实账号状态见 [P15.1 部署验收](docs/qcu-hub-market-p15.1-deployment.md)；[历史双角色 MVP](docs/qcu-hub-submissions-mvp.md)保留原验收口径；完整后续边界见[发布计划](docs/qcu-hub-submission-workflow.md)。另见[交付包与验收](docs/qcu-course-workbench-delivery.md)和[数据/接口契约](docs/qcu-course-workbench-validation.md)。

## 专家团自主收尾候选

专家团收尾原独立分支 `dev/qcu-expert-teams-hardening`，worktree `$HOME/Repos/worktrees/qcu-harness/expert-teams-hardening`。从原专家库 `0.2.0-pilot.1` 的固定公开源码快照继续，原专家团工作树不改。本轮专家团 `0.2.0-pilot.2`、协议3、存储schema2：新增容量显示、所选历史数据备份、绑定预览及明确确认的清理、失败/停止/中断报告，并修复异步刷新和窄屏列表问题。源码和精确解包候选各通过35项核心/复核、6项官方运行时与1项浏览器综合验收；合成模型、实际下载、明暗窄屏截图分别留证，不作为原生或教学质量通过。

固定包57,940字节，SHA256 `4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581`。验收说明和构建命令见[专家团收尾](docs/qcu-expert-teams-hardening.md)。最终交付及分阶段证据归档到 `$HOME/Artifacts/qcu-harness/0.2.0-expert-library.2/`；早期候选保留为stage-a，不能混作最终包。本轮候选尚未安装到真实DSH、发布Hub或调用真实模型；已使用教师Home迁移、原生文件选择和教师效果单列待验收。

## Web 发布与 DSH 动态市场（P15.1，已部署内部 Hub）

开发分支 `dev/qcu-hub-market-publication`，固定 worktree 为 `$HOME/Repos/worktrees/qcu-harness/hub-market-publication`。已实现独立发布确认、签名目录、DSH 刷新、撤回和新修订恢复；浏览与刷新不安装，安装默认未启用，启用仍单独确认。P15.1 已固定生产公钥并发布现有 Hub；已确认保留 9 项教师产品，mini 默认 DSH 完成14.1→15.1自升级、重启和签名目录刷新，管理员本人登录通过。真实新投稿的上传/批准/发布仍待单独验收，之后新增产品无需每次重建市场。详见[部署记录与下一次验收步骤](docs/qcu-hub-market-p15.1-deployment.md)。

- [中文人工验收单](docs/qcu-hub-market-publication-acceptance.md)
- [构建、测试、初始化、迁移与部署契约](docs/qcu-hub-market-publication.md)
- 本次夹具在 `.work/p15-rollout/`，固定包、截图和验收证据在 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.15.1/`；早期 P15 本地证据保留原目录，不入 Git。
- 公开服务沿用 `192.168.1.68:8080`，管理服务仅 mini 回环 `127.0.0.1:8975`。已按冻结并核验的 P14.1 源码保留检查更新能力，原工作树未改动；代码、产物、部署位置和恢复命令见上述部署记录。

## 本地开发入口与市场分支

教师首选入口：[Hub 网页三步安装指南（本地候选，未部署）](docs/qcu-hub-teacher-install.md)。现有首页新增“安装官方 DSH → 复制固定市场地址 → 在官方插件界面添加”的入口；HTTP 复制失败可手动复制，`dsh://open` 仅唤起窗口。43 项回归、27 项本地 HTTP 检查及桌面/390px 深浅主题渲染通过；系统剪贴板与首次新机器官方安装仍待验收，既有缓存完整性问题未修复。见[父线程交付检查](docs/qcu-hub-teacher-entry-parent-validation.md)。

独立 macOS [市场安装包准备器（可选维护候选）](docs/qcu-market-preparation-guide.md)保留，不再作为教师前置，也不把 Apple 签名/公证列为教师入口待办。历史工具 `0.1.0-bootstrap.1` 自动准备固定 P9 本地 TGZ；36 项自动测试及 mini 下载/缓存复用已通过，原生界面已截图，按钮交互与官方安装仍未验收，详见[历史交付检查](docs/qcu-market-preparation-parent-validation.md)。源码、应用说明及归档保持原样。

P9新手体验已于2026-10-14发布现有LAN Hub：五步tips、三个常用任务模板、本地反馈。25项独立LAN下载/边界检查通过，旧12包保留；见[发布记录与固定包](docs/qcu-market-p9-hub-deployment.md)、[Cursor实机验收任务书](docs/qcu-market-p9-cursor-acceptance.md)、[安装指引](docs/qcu-market-p9-install-guide.md)和[用户验收表](docs/qcu-market-p9-user-acceptance.md)。先前295项源/HTTP/浏览器与21项归档通过；[mini用户回执复核](docs/qcu-market-p9-mini-acceptance-review.md)记录同字节本地TGZ官方安装和核心流程、三项Skill响应与教师审核用户报告通过，旧file6.3→HTTP9.1升级仍报 `ERR_PNPM_MISSING_TARBALL_INTEGRITY`，根因未复现；部分精确宽度/网络/注入/重载与截图证据仍缺，不记全项通过。

历史市场P8.1、教研简报和飞书只读1.1已按用户授权发布现有LAN Hub，20项下载/边界检查通过；见[发布记录与固定安装链接](docs/qcu-market-p8-hub-deployment.md)、[交付检查](docs/qcu-market-p8-parent-validation.md)和[用户验收](docs/qcu-market-p8-user-acceptance.md)。DSH安装/启用与实机验收由用户完成，生产/测试原环境状态以现场检查为准。

P9构建与复现见[源码交接](docs/qcu-market-p9-source.md)。P8工具插件目录集成见[历史源码交接](docs/qcu-market-p8-source.md)，真实桌面安装与工具发现仍待验收。本轮扩充见[执行计划](docs/qcu-market-expansion-plan.md)；P8原产品验收见[P8逐项步骤](docs/qcu-market-p8-user-acceptance.md)，P9新增体验按上述P9表执行。P7首项外部技能已纳入本次Hub发布，[父线程验收](docs/qcu-market-p7-parent-validation.md)保留当时本地测试与预览记录；市场P7中间包未发布。

2026-10-15补充：[P10 mini本机自测51项通过](docs/qcu-market-p10-mini-selftest.md)，已由本线程直接传包、执行并取回报告；[P9缓存机制复现](docs/qcu-market-p9-cache-integrity-reproduction.md)已定位随附pnpm在热缓存升级时丢失完整性字段的合成链路；原Home事务仍未重放、未修复。

P10离线维护工具已完成本地父审查：两版Python各51项通过、9个固定包静态核对通过；见[最终交付检查](docs/qcu-market-p10-parent-validation.md)。P10 为 Python 3.9+ stdlib 独立离线维护工具：见[提交检查器与 schema](docs/qcu-market-p10-submission-check.md)、[管理员维护指南](docs/qcu-market-p10-maintainer-guide.md)和[合成提交模板](templates/qcu-submission/README.md)。静态通过仍需人工/原生/教师复核，不改变教师 P9 流程或固定包。

新 Codex 线程从主仓库 `$HOME/Repos/cowork/qcu-harness` 进入。先读仓库规则、本文与任务对应文档，核对 `git status`、`git worktree list` 和最新远端；不要让两个线程同时修改同一 worktree。

| 位置 | 用途 |
| --- | --- |
| `$HOME/Repos/cowork/qcu-harness` | 主仓库，`main`；本轮不合并或推送 main |
| `$HOME/Repos/worktrees/qcu-harness/market-ui` | 市场已推送版本，`dev/qcu-market-prototype` |
| `$HOME/Repos/worktrees/qcu-harness/market-skills` | 独立 P6 开发，`dev/qcu-market-p6` |
| `$HOME/Repos/worktrees/qcu-harness/market-expansion` | 外部技能与后续市场扩充，`dev/qcu-market-expansion` |
| `$HOME/Repos/worktrees/qcu-harness/market-integration` | P8工具插件目录集成，`dev/qcu-market-p8` |
| `$HOME/Repos/worktrees/qcu-harness/market-onboarding` | P9新手体验，`dev/qcu-market-p9`；独立构建、预览与实机验收文档 |
| `$HOME/Repos/worktrees/qcu-harness/market-maintenance` | P10离线检查器，`dev/qcu-market-p10`；只维护工具、示例与文档 |
| `$HOME/Repos/worktrees/qcu-harness/expert-teams-hardening` | 专家团0.2.0-pilot.2自主收尾，`dev/qcu-expert-teams-hardening`；原线程保留，候选与验收见[收尾说明](docs/qcu-expert-teams-hardening.md) |
| `$HOME/Repos/worktrees/qcu-harness/hub-market-publication` | P15.1 发布与动态目录，`dev/qcu-hub-market-publication`；已部署 Hub 与 mini 默认 DSH |
| `$HOME/Repos/worktrees/qcu-harness/hub-admin-account` | 当前单管理员本机迭代，`dev/qcu-hub-admin-account`；[交互式设置／恢复与合成证据](docs/qcu-hub-single-admin.md)；旧库不迁移、未部署 |
| `$HOME/Repos/worktrees/qcu-harness/hub-submissions` | 本机投稿审核，`dev/qcu-hub-submissions`；无构建依赖，运行和验收见 [MVP说明](docs/qcu-hub-submissions-mvp.md)；未部署 |
| `$HOME/Repos/worktrees/qcu-harness/hub-onboarding` | 当前教师网页入口，`dev/qcu-hub-onboarding`；首页静态源码，无构建依赖；测试/预览见[教师指南](docs/qcu-hub-teacher-install.md) |
| `$HOME/Repos/worktrees/qcu-harness/market-bootstrap` | 独立准备器历史维护候选，`dev/qcu-market-bootstrap`；不作为教师安装前置 |
| `$HOME/Repos/worktrees/qcu-harness/<功能名>` | 后续并行开发 worktree；每个 worktree 独占分支 |
| `$HOME/Artifacts/qcu-harness/0.1.0-hub-submissions.2/` | 单管理员登录的回归日志、10张合成截图与设置／恢复说明；未创建真实账号，未部署 |
| `$HOME/Artifacts/qcu-harness/0.1.0-hub-submissions.1/` | 本机投稿审核的截图、回归日志和验收说明；无真实发布包或私有访问令牌 |
| `$HOME/Artifacts/qcu-harness/<版本号>/` | 安装包、截图、测试日志与验收材料；不入 Git |
| `$HOME/Artifacts/qcu-harness/0.1.0-hub-onboarding.1/` | 本轮网页真实预览截图、43项回归日志、两文件Hub更新候选；未部署 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.5.1/final/` | 历史已部署市场版本，保持不可变 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.6.3/` | 历史P6.3市场、五个 Skill 包、预览截图及 deployment 现场证据 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/` | 历史已发布Hub的P8市场、飞书固定包、预览截图及 deployment 发布证据；教研简报保留在P7.1原位置 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/` | 当前P9固定市场包、46张合成预览截图、deployment发布证据与Cursor验收任务书 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/` | P10合成 handoff、检查报告与验证日志；便携工具ZIP与父级终检；非DSH安装包 |

市场 `0.1.0-pilot.6.3` 已部署到既有 mini 测试 Home，五个教学 Skill `0.1.0-pilot.1.1` 已分发至局域网 Hub。备课技能的安装保持禁用、一次启用、发现、注入与合成调用通过；其余四项未做真机调用。测试实例已正常退出，默认DSH环境恢复且关键配置摘要不变。安装确认仍独立，多组件仍明确选择。历史 P5.1 与不可变旧包保留。接手先读 [P6.3现场记录](docs/qcu-market-pilot6.3-live-validation.md)、[本地验收](docs/qcu-market-p6-parent-validation.md)、[源码交接](docs/qcu-market-p6-source.md) 与 [教练现场记录](docs/qcu-market-coach-live-20261012.md)。

市场基线为官方 DSH `0.2.0-rc.2`，优先 Apple Silicon Mac，插件和 Skill 扩展尽量不改官方源码。新命名用 `qcu`，暂不做 JS→TS 迁移。用户自备模型 API Key；安装插件不需要调用模型。

在市场 worktree 中构建/验证（使用已有审核依赖，不自动下载）：

```sh
export QCU_OFFICIAL_DEPENDENCIES=/absolute/path/to/audited-official-source
export QCU_BROWSER_DEPENDENCIES=/absolute/path/to/local-playwright-dependencies
export QCU_MARKET_PREVIEW_OUT="$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/refined/preview"
node hub/plugins/qcu-market/build.mjs
node hub/plugins/qcu-market/preview.mjs
node --experimental-transform-types --expose-internals --test tests/qcu-market*.test.mjs tests/teaching-skill-products.test.mjs
```

首次测试须准备 `scripts/prepare-market-loop-tests.py`、`scripts/prepare-market-http-tests.py` 与 `scripts/verify-market-http-runtime.py` 所需的固定归档和官方依赖；P9完整归档变量、固定P8错配输入、飞书输入及回归命令见[P9源码交接](docs/qcu-market-p9-source.md)，历史UI构建说明见 `docs/qcu-market-ui-refresh.md`。浏览器测试需已有 Chromium。预览共用真实 UI 与状态机，但后台为明确标注的模拟服务，不证明真机安装通过。`.work/` 仅放可重建夹具，不作为唯一交付位置。

Hub 当前仅局域网 `http://192.168.1.68:8080`；不可变包位于 `/plugins/`。mini 测试 Home 保持 `$HOME/qcu-p42-fresh-20261011-1300`，沿用 `Start-P42-Fresh.command`；不复制凭据、不新建 Home 来补造首次安装证据。默认 DSH 环境与测试环境的当前状态须现场重查。源码路径迁移不改变任何 mini 路径。

开发分支允许审查后提交推送。2026-10-12 用户另行授权后，P5.1 已通过官方安装部署至既有 mini 测试 Home，现场检查与默认环境恢复通过；详见 `docs/qcu-market-pilot5.1-live-validation.md`。此后用户再次确认部署，Hub新增P6.3和五项Skill固定归档，既有测试Home完成上述备课功能链路；详见P6.3现场记录。覆盖历史包、正式发布、main 合并/推送仍不在授权内。真实测试结束后须正常退出测试实例，核实进程结束，再普通打开 `/Applications/DeepSeek Harness.app` 恢复默认环境；仅本地 UI 开发不擅自结束尚未完成的现场验收。

旧临时 worktree 已转为 detached 历史归档，位置映射和逐文件校验清单保存在 `$HOME/Artifacts/qcu-harness/legacy-20261010/`。历史证据内的旧路径不批量改写，按迁移清单解析。旧线程回执仍私有，不随源码提交。


QCU Office、城院 Skill 目录站、插件及办公 Skills 的独立源码仓库。基于固定官方 DeepSeek Harness，保留官方 Bundle/Host/Client/Skill 机制。

这是开发候选，不是已签名或已发布的安装包。cd5f532 已在独立 Mac 候选中加载，工具入口与报告保存获用户人工复测通过；见 [人工验收范围](docs/MAC-USER-ACCEPTANCE.md)。后续源码增量不自动部署。自有材料采用 [MIT](LICENSE)，第三方版权及许可按 [NOTICE](NOTICE.md) 保留。

| 路径 | 用途 |
| --- | --- |
| packages/qcu-thesis-workbench | 完整外置业务包，Python 引擎仍在包内；Host/Client/原生协议及测试 |
| upstream | 固定官方 commit、累计补丁、改动源文件与锁文件；包含 CLI、Desktop Host、app-boot 和 Electron |
| desktop | 固定 QCU Office 入口与本机验收说明 |
| hub | 城院目录站、安装器插件和打包/部署脚本 |
| skills | 10 项城院及 3 项 QCU 通用 Skill 的唯一源码；论文 Skill 随业务包保存 |
| scripts、tests、docs | 重建、合成回归、来源映射和维护限制 |

先读 [维护说明](docs/MAINTENANCE.md)、[重建步骤](docs/REBUILD.md)、[已知限制](docs/KNOWN-LIMITS.md) 和 [第三方归属](NOTICE.md)。目录站中条目暂标为 draft；需要重建对应产物并审查后发布，不因迁入 Git 就声称安装链已通过。

当前开发增量的父进程退出清理与复现证据见 [生命周期说明](docs/HOST-LIFECYCLE.md) 和 [验证记录](docs/LIFECYCLE-VALIDATION.md)。

独立 Mac 合成候选的真实启动已验证；重建须包含官方 Web 静态页面。参见 [Mac 启动验收](docs/MAC-STARTUP-VALIDATION.md) 与 [重建步骤](docs/REBUILD.md)。原生文件选择、下载取消及重试、打印预览仍未验收。

2026-10-08 已重新核实进程并启动同一候选，当前证据与原生阻塞见 [本轮 Mac 验收](docs/MAC-CURRENT-ACCEPTANCE.md)。

新增功能遵循 [插件接入约定](docs/PLUGIN-INTEGRATION.md)。第二功能的 [CSV 任务原型](docs/SECOND-FEATURE-TABLE-AUDIT.md) 已在未修改的官方 DSH/Web 独立 profile 中安装并通过合成 CSV 的真实 Chrome 流程，含逐文件授权、计数导出及清理恢复；见 [安装验收](docs/TABLE-AUDIT-INSTALL-VALIDATION.md)。不替换论文候选，不启用私人 CSV；当前 Hub 仅本机安装链测试。

表格试用的 [开关重启与版本升级/回退验收](docs/TABLE-AUDIT-PILOT-LIFECYCLE.md) 已完成，最终版本 prototype.6。关闭 HMR 时先撤销当前任务，开关保存后正常退出重启；没有把热停用或原生保存取消标为通过。

专家团本轮自主交付及剩余验收见 [pilot.2 交付说明](docs/qcu-expert-teams-delivery.md)。
