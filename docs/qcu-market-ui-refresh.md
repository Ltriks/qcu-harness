# QCU 市场界面刷新候选

本次在 `dev/qcu-market-ui-refresh` worktree 修改 DSH 内市场的共享 React 界面。源码实现和可运行的构建已完成；最终三项微调后，父线程独立运行三个 Chromium 套件，37 项全部通过，并完成桌面及窄屏截图复核。未合并、部署或生成安装 TGZ，不代表原生 DSH 已验收或教师确认可用。

## 设计确认

2026-10-16，用户实际浏览本机新版预览后确认“好多了，就这么设计实现吧”。本版导航分层、紧凑卡片、首页指引入口、五步指引及明暗主题方向据此定稿。当前预览使用真实市场共享 React 源码，这些界面已经实现并完成上述回归；无需另做一套演示稿。

此确认是设计及实现方向确认，不能记为原生DSH安装、真实模型或教师任务验收通过。Hub及mini部署、可安装的新版本和既有P9部门验收包更新尚未执行；发布时继续遵守本文末尾的版本与不可变归档要求。

## 需求与设计取舍

用户要求减少首页、指引、任务、反馈与返回对话之间的拥挤，改善首次使用入口，并压缩卡片。参考 [RawBlock](https://designmd.ai/chef/rawblock) 的结构感、边界和层级；该参考提供设计系统，没有提供本应用的页面布局。

这里保留 QCU 自己的信息架构、现有图标、系统字体及官方 `--dsw-alias-*` 主题令牌。使用细边界、小圆角和规律间距，适配日常教学工具；没有照搬参考的大标题、粗黑框、零圆角、无图标规则或不规则排版。没有外部字体、图片、CDN、依赖下载或 designmd 安装。

- 所有页面共用身份顶栏，右侧独立返回对话；第二行放四个原有导航按钮。保留 `data-aux`、原有角色、焦点恢复和任务详情返回逻辑。360/390px 窄屏四个导航排为紧凑的一行，独占自己的区域。
- 首页使用短介绍和顶部指引区。开始按钮只导航，不检查或安装；未点击时不会自动打开指引。完成后的“已浏览引导（不代表已验收）；可随时从‘新手指引’再看。”原文保留在界面中。
- 卡片按可用宽度自然排为三、二、一列，36px 图标与标题并排，最多两行用途描述。完整用途仍在详情中；状态文本不截断。整卡只导航，仍为真实的 6 个 Skill 与 2 个 Plugin。
- 指引列出全部五步，当前步骤使用 `aria-current="step"`，编号、正文和上一步／下一步／稍后再看分区展示，下一步与完成引导使用现有主色按钮。保留步骤记忆和浏览完成含义，不检测模型、配置或安装状态。
- 任务与反馈沿用相同的 760px 内容宽度、表单与分区样式。字段限制、生成、编辑、剪贴板降级、手动发送、脱敏确认和临时数据生命周期逻辑未改。
- 重复样式收敛为 `.qcu-market` 内的规则，保留 `src/plugin.mjs` 所需旧选择器。键盘交互控件与折叠入口有焦点样式，程序聚焦的非交互标题保留焦点、去掉装饰边框，窄屏使用较大的触摸目标，包含 reduced-motion 规则。旧版页面只通过源码/组件回归，未做浏览器视觉验收。
- 预览壳改为随工具栏高度伸缩的布局，继续显示“隔离预览 · 安装状态为模拟数据”。预览和生产 client 使用同一套 React 页面。

## 文件范围

| 文件 | 改动 |
| --- | --- |
| `hub/plugins/qcu-market/src/market-view.mjs` | 共享顶栏、第二行导航、首页指引区、紧凑卡片结构 |
| `hub/plugins/qcu-market/src/teacher-view.mjs` | 五步进度列表、指引正文与控制区 |
| `hub/plugins/qcu-market/src/styles.mjs` | 合并作用域样式，统一各页面与响应布局，保留旧版选择器 |
| `hub/plugins/qcu-market/preview.html` | 自适应预览壳高度、按钮触摸目标 |
| `hub/plugins/qcu-market/client.js` | 从上述共享源码重建 |
| `tests/qcu-market-teacher-browser.test.mjs` | 两处“准备自己的模型账号”定位改用 heading，避免新增进度列表中的同名文字造成歧义；行为断言保留 |
| `tests/qcu-market-layout-browser.test.mjs` | 真实 Chromium 布局、状态与导航回归，最终经父线程独立执行通过 |
| `tests/qcu-market-refresh.test.mjs` | 实际 React 服务端渲染、五步可访问进度及前后/跳过/完成语义回归 |
| 本文 | 范围、验证证据和待验收边界 |

任务输入 `.ai/tasks/QCU-MARKET-UI-REFRESH.md` 原本为未跟踪文件，未修改。期间父线程新增 `.ai/tasks/QCU-MARKET-UI-REFRESH-POLISH.md`，已落实其三项 UI 微调，未修改该任务文件。`direct-flow.mjs`、Host、目录、指纹、发行元数据、协议、准备/校验 API、权限确认文字、`teacher-tools.mjs`、Skill/provider、官方源码及包身份/版本未改。构建目录生成器执行后 `bundled-catalog.mjs` 没有 diff。保护范围检查见 `scope-audit.json`。

## 实际验证

日志根目录：`$HOME/Artifacts/qcu-harness/0.1.0-market-ui-refresh.1/logs/`。下表为最终代码结果，共 200 次通过的测试执行，含源码与编译 client 的重复覆盖；不能按 200 个互不重复的测试计算。

| 验证 | 实际结果 | 日志 |
| --- | --- | --- |
| client 构建 | 通过，版本维持 `0.1.0-pilot.9.1` | `build-client-final.log` |
| 共享 React 预览构建 | 通过 | `build-preview-final.log` |
| 市场纯逻辑/源码/确认/生命周期/教师 helper | 145 通过，0 失败 | `pure-source-final.log` |
| 新增实际 React 渲染与指引语义 | 3 通过，0 失败 | `refresh-react-final.log` |
| tools 契约及合成流程（排除两个归档依赖用例） | 26 通过，0 失败 | `tools-source-final.log` |
| 官方 Cordis/SlotRegistry/LayoutController（源码） | 1 通过 | `official-source-final.log` |
| 官方 ClientRemote/manager codecs/生命周期（源码选定用例） | 12 通过 | `official-scoped-source-final.log` |
| 官方组件与生命周期（重建 client） | 1 + 12 通过 | `official-compiled-final.log`、`official-scoped-compiled-final.log` |
| 实现线程受限的 Chromium 尝试（历史失败保留） | **启动失败，0 通过、3 个顶层失败**：`listen EPERM 127.0.0.1`，没有进入页面断言 | `browser-final.log` |
| 父线程提供的微调前 Chromium 三套件（历史） | 37 通过、0 失败；有四种宽度/两种主题的真实共享 React 截图及几何数据，不能算作最终三项微调的验收 | `parent-browser-initial.log` |
| 父线程最终 Chromium 三套件 | **37 通过、0 失败、0 跳过**，最终截图及几何已更新 | `parent-browser-final.log` |
| `git diff --check` 与保护文件比对 | 通过 | `diff-check-final.log`、`scope-audit.json` |

初次纯测试为 144 通过、1 失败：原有选择器检查将模板内 CSS 注释误当选择器，已移除该注释，最终 145 全通过。原始结果保留在 `pure-source-tests.log`。初次官方 scoped 运行包含历史用例，结果 12 通过、3 失败，原因是本 worktree 没有 `.work/http-e2e/{previous,p8,market}/package` 归档 fixture，见 `official-scoped-source.log`。最终明确排除这三个归档依赖用例，并分别验证源码和重建 client；没有删除或弱化原有用例。

浏览器基线在修改前也同样无法监听本地端口，见 `baseline-browser.log`。另试已有文件预览模式时，Chromium 在系统 MachPort 注册阶段被拒绝，见 `baseline-file-browser.log`。没有绕过沙箱或申请不可用的权限。

### 父线程最终浏览器和视觉复核

实现线程沙箱不能监听回环端口或启动 Chromium；父线程通过正常工具审批运行同一套件，没有更改权限策略。初版37项通过后，额外收紧360/390px导航为一行、去掉程序聚焦标题的装饰边框、突出下一步与完成引导；最终重新构建后再次独立运行37项检查，全部通过。日志为 `logs/parent-browser-final.log`。

最终覆盖360/390/768/1120px、深浅主题、卡片密度、导航物理间距、五步进度、键盘焦点及重入、详情与任务草稿返回、安装和启用确认、取消及未知结果锁、反馈脱敏与剪贴板降级。未出现外部请求、React错误或浏览时的后台RPC。`layout-metrics.json` 和 `screenshots/refresh/` 已更新为最终版，不再是初版截图；初版副本仍保留在 `screenshots/before-polish/` 与 `layout-metrics-before-polish.json`。

父线程还在可见 Chrome 中对比实际共享React：原卡片高246px、改后150px；原标签栏与返回对话间距0，改后33px（同一宽屏条件）。在390px核对四个标签同一行、无横向溢出、标题焦点框消失、下一步主色可见，并复核桌面浅色首页、390px暗色首页及浅色指引、桌面暗色详情截图。预览状态均为模拟数据，不是原生DSH截图。当前本机入口为 `http://127.0.0.1:53003/`；仅绑定回环，进程停止后失效。该服务只提供预览HTML/JS白名单，既有Hub和DSH均未启动或修改。

仍未测：原生DSH安装、真实模型与教师使用；旧版 `src/plugin.mjs` 的浏览器视觉；两个tools归档用例、三个官方scoped归档依赖用例及HTTP/Host归档端到端。本次是UI源码与共享预览候选，未创建替代归档来补造这些结果。

## 构建与复跑

只使用已有本地依赖。实际固定环境：

```text
QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
QCU_BROWSER_DEPENDENCIES=$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node
QCU_MARKET_PREVIEW_OUT=$HOME/Artifacts/qcu-harness/0.1.0-market-ui-refresh.1/preview
```

在当前 worktree，以下为执行器运行的确切 argv（每项通过 `rtk proxy`）。执行器设置上述环境，并为编译产物验证额外设置 `QCU_MARKET_CLIENT_PATH=$HOME/Repos/worktrees/qcu-harness/market-refresh/hub/plugins/qcu-market/client.js`：

```sh
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy node hub/plugins/qcu-market/preview.mjs
rtk proxy node --test tests/qcu-market.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-activation.test.mjs tests/qcu-market-catalog.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-market-teacher.test.mjs
rtk proxy node --test tests/qcu-market-refresh.test.mjs
rtk proxy node --test '--test-skip-pattern=archive' tests/qcu-market-tools.test.mjs
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market-official.test.mjs
rtk proxy node --experimental-transform-types --expose-internals --test '--test-skip-pattern=archived|compiled' tests/qcu-market-client-scope.test.mjs
# 上面两条官方测试分别对源码、QCU_MARKET_CLIENT_PATH 指定的 client 各运行一次。
rtk proxy node --test tests/qcu-market-browser.test.mjs tests/qcu-market-teacher-browser.test.mjs tests/qcu-market-layout-browser.test.mjs
rtk proxy git diff --check
```

完整实际命令、固定环境、执行时间、退出码和日志路径保存在 `verification-results.json`。完整复跑入口：

```sh
rtk proxy $HOME/.local/bin/python3.11 $HOME/Artifacts/qcu-harness/0.1.0-market-ui-refresh.1/verify.py
```

预览静态入口为 `$HOME/Artifacts/qcu-harness/0.1.0-market-ui-refresh.1/preview/index.html`。最终布局套件产出 `screenshots/refresh/{home,guide,detail}-{light,dark}-{360,390,768,1120}.png` 和 `layout-metrics.json`；既有套件另含任务、反馈与确认页面截图。父线程最终证据清单为 `parent-final-validation.json`。

## 发布边界

此候选只包含源码、共享预览和本地重建 client。**不能将重建 client 当作同版本可安装发行包分发。** 如父线程决定发行，必须先完成浏览器与视觉验收，再按项目流程变更 package/runtime 版本、建立对应指纹和新的不可变发行元数据，并做匹配的 Host/Client 验证；本次严格保护这些文件，没有进行上述发布步骤。
