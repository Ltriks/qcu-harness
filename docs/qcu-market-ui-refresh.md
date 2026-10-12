# QCU 市场 UI · pilot.5.1

2026-10-12。开发基于已推送的 `517242b`，分支 `dev/qcu-market-prototype`。不修改官方 DSH，不部署到 mini 或 Hub。

## 行为

- 首页提供全部/技能/插件分类、名称或用途搜索、图标卡片。卡片仅呈现名称、简短用途、类型和状态。仅审核目录中的教练 P2 是真实插件；独立技能分类为空，不展示草案或官方帮助占位产品。
- 详情呈现用途、示例、版本、兼容性、来源、许可、权限及安装/启用操作。返回保留搜索与分类，并恢复卡片焦点。技术检查/日志默认折叠；安装风险确认不会折叠隐藏。
- 初始状态如实显示“状态待检查”，不自动读取官方库存。打开卡片、搜索、切换分类和返回不安装。离开待确认/准备阶段撤销原收据；已提交安装的取消与未知结果规则保持原样。
- 复用 `DirectMarketFlow`；其源码与 Host 下载/校验逻辑未改变。用户确认安装保持禁用，包与组件启用各需确认。组件加载不冒充技能发现或调用通过。
- `market-view.mjs` 供插件和本地预览共用。构建仍只依赖运行时提供的 React。`preview-fixture.mjs` 仅供隔离浏览器测试，不进入交付归档，无实际网络、凭据或 profile 操作。
- 使用官方主题变量，兼顾暗亮主题与 360px 窄面板。预览 shell 提供模拟主题变量；原生 DSH 主题表现仍待现场验证。

## 目录与重建

固定开发 worktree：`$HOME/Repos/worktrees/qcu-harness/market-ui`；产物根：`$HOME/Artifacts/qcu-harness/0.1.0-pilot.5.1`。最终交付使用 `final/`，根目录的首轮构建保留作历史调试证据，不用于安装。P5 原归档不变。

环境变量：`QCU_OFFICIAL_DEPENDENCIES` 指向既有审核 rc.2 源码依赖；`QCU_BROWSER_DEPENDENCIES` 指向已安装 Playwright 的依赖根（不设时复用官方依赖根）；`QCU_MARKET_PREVIEW_OUT` 指向固定产物目录的 `preview/`。

```sh
node hub/plugins/qcu-market/build.mjs
node hub/plugins/qcu-market/preview.mjs
# 给新候选分配空输出目录，不覆盖任何不同字节的既有包
python3.11 hub/plugins/qcu-market/pack-pilot.py "$QCU_ARTIFACT_OUT"
python3.11 scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach "$QCU_COACH_ARCHIVE"
python3.11 scripts/prepare-market-http-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --archive "$QCU_MARKET_ARCHIVE" --old "$QCU_OLD_MARKET_ARCHIVE" --coach "$QCU_COACH_ARCHIVE"
python3.11 scripts/verify-market-http-runtime.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --asar "$QCU_OFFICIAL_ASAR" --out "$QCU_RUNTIME_REPORT"
node --experimental-transform-types --expose-internals --test tests/qcu-market*.test.mjs
```

其中 coach 固定 P2，old market 固定 P2，market 指本次最终归档。归档复验设 `QCU_MARKET_CLIENT_PATH` 为 `.work/http-e2e/market/package/client.js`、`QCU_MARKET_HOST_PATH` 为同目录 `index.js`，运行 client-scope、official、host-official 三个测试文件。首次准备需要允许测试绑定随机 loopback 端口；不访问实际 DSH profile。

## 验证结果

- 源码、实际归档 HTTP 与 Chromium 总套件 **115/115 通过**：既有 104 项，加浏览器父测试及 10 个子场景。无跳过。
- 最终归档的官方 Cordis/Slots/Client/Host 回归 **15/15 通过**（重验，不另算独立用例）。
- 12 个官方运行库比对通过；app-boot 使用官方 ASAR 中的精确字节。首次误用了本机不存在的 `/Applications` 路径，改为既有官方归档位置后通过，没有下载或修改官方 App。
- 浏览器覆盖：启动零请求、真实单卡片、空分类、搜索、导航保留与焦点、确认风险信息、返回撤销、拒绝不安装、三阶段独立确认、未知结果保持阻塞、明暗主题与窄面板。无外部请求、无 React/浏览器异常。
- 首轮主题约束测试失败已修复：移除自定义备用颜色；内联 CSS 注释触发既有简易选择器检查，移除后通过。最终所有测试通过。
- 截图：`screenshots/01-list-light.png`、`02-skills-empty.png`、`03-detail-light.png`、`04-confirmation.png`、`05-list-dark.png`、`06-detail-dark-narrow.png`、`07-list-dark-narrow.png`。已人工查看亮色列表/详情/确认页与暗色窄屏列表/详情。

浏览器中的安装结果来自模拟后台，不能代表真机安装。最终归档哈希见同版本产物 `final/SHA256SUMS`；完整测试日志留在产物目录，不提交本机路径日志。

## 现场状态与未测项

2026-10-12 08:53 北京时间只读复查 mini：测试 Home 仍在原位，主进程 36812、Host 36829，127.0.0.1:57652；默认 19387 无监听。默认 P4.2/P2 包版本与三配置摘要保留。本轮未启动、停止或安装任何现场实例；进程/端口是历史观察，下次先重新核对。

09:15 北京时间追加只读检查：测试 Home 中市场 P4.2 包已选择、profile 组件覆盖为 disabled:false；教练 P2 依赖已安装，包未选择，包内组件 disabled:true，profile 无启用覆盖。

测试 Home 的 P4.2 市场可用、同 Home 重启无需重新登录、市场安装教练显示成功，沿用用户确认；新 Home 中教练的独立 Host 握手、取消分支、技能发现与调用不升级为通过。新版 UI 原生挂载/安装/启用、真实主题、mini/Hub 部署均 **未测/未执行**。现场测试仍未结束，未执行默认环境恢复。

## 后续真机部署记录

2026-10-12 用户另行授权后，P5.1 已在原 mini 测试 Home 安装并完成正常重启、真实 UI 与 Host 状态检查，随后恢复默认 DSH。详见 [部署与收尾记录](qcu-market-pilot5.1-live-validation.md)。前述未部署状态描述的是本文件最初开发检查点；原生暗色/窄面板及教练首次取消/技能调用仍未补测。
