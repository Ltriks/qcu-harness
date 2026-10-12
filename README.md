# QCU Harness

## 本地开发入口与市场分支

新 Codex 线程从主仓库 `$HOME/Repos/cowork/qcu-harness` 进入。先读仓库规则、本文与任务对应文档，核对 `git status`、`git worktree list` 和最新远端；不要让两个线程同时修改同一 worktree。

| 位置 | 用途 |
| --- | --- |
| `$HOME/Repos/cowork/qcu-harness` | 主仓库，`main`；本轮不合并或推送 main |
| `$HOME/Repos/worktrees/qcu-harness/market-ui` | 市场已推送版本，`dev/qcu-market-prototype` |
| `$HOME/Repos/worktrees/qcu-harness/market-skills` | 独立 P6 开发，`dev/qcu-market-p6` |
| `$HOME/Repos/worktrees/qcu-harness/<功能名>` | 后续并行开发 worktree；每个 worktree 独占分支 |
| `$HOME/Artifacts/qcu-harness/<版本号>/` | 安装包、截图、测试日志与验收材料；不入 Git |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.5.1/final/` | 已部署到既有 mini 测试 Home 的市场版本 |
| `$HOME/Artifacts/qcu-harness/0.1.0-pilot.6.3/` | 当前 P6 候选、截图与验收；尚未部署 |

P6 已在独立 worktree 中实现五个教学 Skill 和单组件产品的一次启用确认，最终市场候选为 `0.1.0-pilot.6.3`；安装确认仍独立，多组件仍明确选择。P6 未部署；已部署 P5.1 与不可变旧包保持原样。接手时阅读 `docs/qcu-market-p6-source.md`、`docs/qcu-market-p6-parent-validation.md` 与 `docs/qcu-market-coach-live-20261012.md`，以开发 worktree 中的最新记录为准。

市场基线为官方 DSH `0.2.0-rc.2`，优先 Apple Silicon Mac，插件和 Skill 扩展尽量不改官方源码。新命名用 `qcu`，暂不做 JS→TS 迁移。用户自备模型 API Key；安装插件不需要调用模型。

在市场 worktree 中构建/验证（使用已有审核依赖，不自动下载）：

```sh
export QCU_OFFICIAL_DEPENDENCIES=/absolute/path/to/audited-official-source
export QCU_BROWSER_DEPENDENCIES=/absolute/path/to/local-playwright-dependencies
export QCU_MARKET_PREVIEW_OUT="$HOME/Artifacts/qcu-harness/0.1.0-pilot.5.1/preview"
node hub/plugins/qcu-market/build.mjs
node hub/plugins/qcu-market/preview.mjs
node --experimental-transform-types --expose-internals --test tests/qcu-market*.test.mjs tests/teaching-skill-products.test.mjs
```

首次测试须准备 `scripts/prepare-market-loop-tests.py`、`scripts/prepare-market-http-tests.py` 与 `scripts/verify-market-http-runtime.py` 所需的固定归档和官方依赖；详见市场 worktree 的 `docs/qcu-market-ui-refresh.md`。浏览器测试需已有 Chromium。预览共用真实 UI 与状态机，但后台为明确标注的模拟服务，不证明真机安装通过。`.work/` 仅放可重建夹具，不作为唯一交付位置。

Hub 当前仅局域网 `http://192.168.1.68:8080`；不可变包位于 `/plugins/`。mini 测试 Home 保持 `$HOME/qcu-p42-fresh-20261011-1300`，沿用 `Start-P42-Fresh.command`；不复制凭据、不新建 Home 来补造首次安装证据。默认 DSH 环境与测试环境的当前状态须现场重查。源码路径迁移不改变任何 mini 路径。

开发分支允许审查后提交推送。2026-10-12 用户另行授权后，P5.1 已通过官方安装部署至既有 mini 测试 Home，现场检查与默认环境恢复通过；详见 `docs/qcu-market-pilot5.1-live-validation.md`。Hub 未发布新版。覆盖历史包、正式发布、main 合并/推送仍不在授权内。真实测试结束后须正常退出测试实例，核实进程结束，再普通打开 `/Applications/DeepSeek Harness.app` 恢复默认环境；仅本地 UI 开发不擅自结束尚未完成的现场验收。

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
