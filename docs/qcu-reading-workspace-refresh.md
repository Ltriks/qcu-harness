# QCU 材料伴读工作区列表刷新

**2026-10-30当前状态：** pilot.3已通过用户授权的官方原生升级和同Home重开；新增工作区→返回伴读→刷新已实际通过，原材料/未保存笔记/已勾选发送确认均保留，显式新旧工作区切换隔离及真实问答/导出留存也通过。详见[原生验收](qcu-reading-native-acceptance.md)。以下执行器“未安装”描述保留为其交付阶段历史。投稿形态另由pilot.4候选修正，未覆盖本包。

任务：`QCU-READING-WORKSPACE-REFRESH`，父任务 `qcu-standalone-learning-tools-20261029`。基线 `78d8234ff2252b827a6ab89a3e6db8a5e12bbc98`。本次仅交付代码和新的本地候选 `qcu-reading@0.1.0-pilot.3`；协议 2、schema 2、默认停用保持不变。父级正在独立验收的已安装 pilot.2、旧包、预览服务和当前 R1b 文档均未改动。

工作区列表以前仅在 remote 挂载时读取，重新打开 Panel 会复用同一 controller。在官方 DSH 新增工作区后，界面现在可通过选择框旁的“刷新”更新列表，无需重启或重新连接。采用显式操作，不新增 SDK API、事件框架或 Panel 生命周期假设。

刷新按钮具有“刷新工作区列表”无障碍名称，支持键盘 Tab / Enter，等待期间显示“刷新中…”、`aria-busy` 并禁用重复点击；成功和错误有独立状态提示，失败后可重试。按钮在桌面及 360px 明暗主题下均可见且无横向溢出。

刷新使用独立的递增请求标识，只有最新请求可更新列表、错误和忙碌状态；旧成功、旧失败、连接重置前和 dispose 后的回复均被忽略。编辑问题或显式切换工作区不会把随后有效的列表回复丢掉，也不会由旧回复恢复旧选择。

当前选择仍有效时，只替换列表及其提示，保留打开材料、摘录、笔记草稿、问题、搜索、发送前确认及勾选状态、当前问答和运行观察。新出现的工作区不会被自动选择，也不会自动读取其材料或创建其 store。首次启动的原有单工作区选择保持；记住的工作区已消失时，不回退到另一个新出现的唯一工作区。

当前选择不再可用时，清空选择和本地发送确认，明确要求重新选择，同时使旧内容回复失效、停止客户端观察。保留内存中的原文、笔记和历史，不删除磁盘快照，不取消 Host 中已经开始的问答。列表操作本身只发送 `workspaces`，不导入、不准备发送、不调用模型、不启动或取消问答。旧工作区重新出现后仍需显式选择；原有隔离和确认失效规则继续生效。另补齐保存摘录后等待 catalog 的 epoch 检查，防止工作区移除后由迟到完成提示覆盖新状态。

## 精确候选

- 目录：[candidate/](../.work/qcu-reading-workspace-refresh/candidate/)
- TGZ：[qcu-reading-0.1.0-pilot.3-7ff0f9abe7e95775b7f290a60bc8bd9a42353d474a89208b0f8a63cd3a0940b7.tgz](../.work/qcu-reading-workspace-refresh/candidate/qcu-reading-0.1.0-pilot.3-7ff0f9abe7e95775b7f290a60bc8bd9a42353d474a89208b0f8a63cd3a0940b7.tgz)
- SHA-256：`7ff0f9abe7e95775b7f290a60bc8bd9a42353d474a89208b0f8a63cd3a0940b7`
- 大小：**628112 字节**，低于 1 MiB；**29 个成员**。生成 Client：**54991 字节**。
- 逐成员：[MANIFEST.json](../.work/qcu-reading-workspace-refresh/candidate/MANIFEST.json)；[SHA256SUMS](../.work/qcu-reading-workspace-refresh/candidate/SHA256SUMS)。打包器拒绝覆盖内容不同的旧产物。
- 独立重建：[rebuilt/](../.work/qcu-reading-workspace-refresh/rebuilt/)。TGZ、MANIFEST.json、SHA256SUMS 逐字节一致。
- 精确解包：[unpacked/package/](../.work/qcu-reading-workspace-refresh/unpacked/package/)。全部成员的大小、SHA-256、常规文件类型、白名单路径及固定 tar 元数据均核对，逐字节等于源文件。
- [重建及范围证明](../.work/qcu-reading-workspace-refresh/validation/REPRODUCIBLE.json)：相对基线，包内仅 README、client、pack、package、controller、protocol、view 七项改变。Host、store、parser、model、dispatch、source、reports、plugin wiring、构建脚本、默认停用补丁、所有 vendor 和第三方许可均字节不变。

## 实际验证

使用任务给定的已有审核 SDK 和浏览器依赖，无安装或下载。给定 Node 路径实际报告 **v24.19.0 / arm64**；与任务稿中提到的父级已安装 Node24.18.1 区分。本次不把本地 Node 检查当作已安装 DSH 验收。

| 检查 | 源码 | 精确包 | 证据日志前缀 |
| --- | --- | --- | --- |
| 原核心 + 新工作区/异步行为 | 28/28 | 28/28 | `source-core-final`、`exact-core-binary` |
| 二进制解析、安全、迁移及取消回归 | 16/16 | 16/16 | `source-binary`、`exact-core-binary` |
| 官方 Cordis/Typert/合成 LLM 与生成 Client 生命周期 | 12/12 | 12/12 | `source-official`、`exact-official` |
| Chromium 原有上传/来源/确认/下载完整流程 | 1/1 | 1/1 | `source-browser`、`exact-browser` |
| Chromium 动态工作区刷新及隔离 | 1/1 | 1/1 | `source-refresh-browser-final`、`exact-refresh-browser` |
| 逐成员校验、独立构建及隔离离线 PDF/DOCX | — | 1/1 | `exact-offline` |
| 合计 | **58/58** | **59/59** | 全部退出 0 |

命令、作用域环境、起止时间和退出状态在各自 `.json`，完整输出在同名 `.log`：[validation/](../.work/qcu-reading-workspace-refresh/validation/)。汇总：[FINAL-EVIDENCE.json](../.work/qcu-reading-workspace-refresh/validation/FINAL-EVIDENCE.json)；[离线证明](../.work/qcu-reading-workspace-refresh/candidate/OFFLINE-EVIDENCE.json)。离线子进程不能读取 SDK/开发依赖、不能使用 addons 或网络，实际重建 Client、解析自编 PDF/DOCX 并持久化重开。

新行为测试使用可变 registry 和真实 ReadingStore：初始 A，boot 后添加 B，刷新保留 A 的全部草稿、笔记和已勾选的确认，刷新 RPC 只有列表且 B store 尚未打开；显式 B 选择后为空独立 store。另覆盖并发刷新乱序成功/错误、最新失败重试、问题编辑、选择变化、初始 boot 乱序、连接重置、dispose、A 消失时迟到 prepare/catalog、活动问答持续运行及完成历史重新读回。工作区刷新测试的模型调用为 0；专门运行状态测试及原回归只用合成适配器，无真实模型调用。

精确包 Chromium [证据和七张交互截图](../.work/qcu-reading-workspace-refresh/refresh-browser/exact-refresh-browser/run-EjH0BU/EVIDENCE.json)：真实渲染共享 Page/controller，通过 loopback 调用真实 dispatch/store；实际操作刷新、确认勾选、草稿、失败重试、移除 A、选择 B 并上传自编材料、重新选择 A 读回笔记。A 状态文件前后逐字节不变，刷新过程中未打开 B；无页面错误、外部页面请求或问答 start/cancel。实际查看了 [桌面](../.work/qcu-reading-workspace-refresh/refresh-browser/exact-refresh-browser/run-EjH0BU/refreshed-consent-1280.png)、360px [明色](../.work/qcu-reading-workspace-refresh/refresh-browser/exact-refresh-browser/run-EjH0BU/refreshed-consent-360-light.png) / [暗色](../.work/qcu-reading-workspace-refresh/refresh-browser/exact-refresh-browser/run-EjH0BU/refreshed-consent-360-dark.png) 和 [缺失工作区](../.work/qcu-reading-workspace-refresh/refresh-browser/exact-refresh-browser/run-EjH0BU/missing-reselection-360.png)截图。原完整流程另保留 [15 张截图和下载物](../.work/qcu-reading-workspace-refresh/browser/exact-browser/run-7U7sfL/EVIDENCE.json)。

本任务创建的全部测试服务器和浏览器均已关闭；[SERVERS-STOPPED.json](../.work/qcu-reading-workspace-refresh/validation/SERVERS-STOPPED.json) 逐个检查已知的五个服务进程均不存在。没有枚举或终止父级服务。`git diff --check` 通过；新增测试文件单独核对无尾随空白。

保留的历史失败：

1. `baseline-workspaces.log`：修复前 8 项预期失败，缺少 `refreshWorkspaces` 方法，作为回归起点，不计入最终通过数。
2. `source-refresh-browser.log`：沙箱以 `EPERM` 拒绝监听 127.0.0.1。经执行权限审查后，以同样的合成数据和独立 loopback 服务继续运行。
3. `source-refresh-browser-permitted.log`：360px 选择 B 后仍停留在问答 pane，测试错误地等待隐藏的原文标题。只修正测试，显式点击“原文”后继续；`source-refresh-browser-final` 和精确包均通过，无产品行为改动。

## 修改范围与后续验收

修改 `hub/plugins/qcu-reading/` 中的 `src/controller.mjs`、`src/view.mjs`、`src/protocol.mjs` VERSION、`package.json` 版本、`pack.py` 版本、生成 `client.js` 和插件 README；修改 `tests/qcu-reading-official.test.mjs`；新增 `tests/qcu-reading-workspaces.test.mjs`、`tests/qcu-reading-workspaces-browser.test.mjs` 及本报告。任务稿原样保留。其余输出全部在新的 `.work/qcu-reading-workspace-refresh/`，未覆盖 `.work/qcu-reading-r1b-package`。

复现时使用任务稿给定的 `QCU_OFFICIAL_DEPENDENCIES`、`QCU_BROWSER_DEPENDENCIES` 和 Node 路径。构建及测试命令见各验证 JSON；测试可通过 `QCU_READING_PACKAGE_ROOT` 指向精确解包目录。打包到新的空目录，然后重建到另一个空目录核对，避免覆盖当前候选。

本执行器没有安装/启用插件、操作原生应用、读取真实 Home/settings/凭据、连接 mini/Hub/真实 API、调用真实模型、部署、提交或推送。工作回执按任务稿由父级负责。剩余验收由父级在获准后使用此 pilot.3 候选完成：官方 Add workspace → 返回材料伴读 → 点击刷新 → 核对新工作区可选、旧草稿与发送确认保持 → 显式选择新工作区检查隔离；原生文件选择器、PDF/DOCX 和真实教师使用的当前事实仍以父级独立验收为准。本报告中的合成和浏览器检查不宣称原生通过。

## 父级独立复核与交付状态

父级另以Node24.19.0 / arm64在精确解包上复跑新异步行为11项、官方可变工作区及生成Client2项、隔离离线包1项、真实Chromium刷新流程1项，共15/15通过；独立核对29个成员与源码、相对基线仅七项包内变化及再次打包逐字节一致。实际查看桌面、360px明暗与工作区失效截图。复核不调用真实模型，不等同官方原生刷新已通过。

固定交付目录：`/Users/mcq/Artifacts/qcu-harness/0.1.0-reading.3/`，含精确安装包、筛选验证证据、截图及验收说明；不含真实Home、浏览器配置、模型设置或Key。源码正常提交推送开发分支，最终提交身份以该目录 `evidence/SOURCE-COMMIT.json` 为准。原生更新已于10月30日将官方DSH中的pilot.2升级为pilot.3，验收见顶部更新；Hub/mini未发布。不要热改已安装文件或覆盖旧不可变包。
