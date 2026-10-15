# Hub 教师网页入口（本地候选）

任务契约：`QCU-HUB-TEACHER-ENTRY`。入口位于现有 `hub/web/index.html` 顶部，已完成本地源码、回归及父线程真实浏览器预览，**尚未部署**。现有 LAN 首页不能视为已含此增量；独立验证、截图及当前本机预览位置见[父线程交付检查](qcu-hub-teacher-entry-parent-validation.md)。网页只引导安装 QCU 市场，后续教学产品在 DSH 内的 QCU 市场安装。

## 教师三步

1. 使用团队确认的官方 **DeepSeek Harness 0.2.0-rc.2 / Apple Silicon Mac** 安装包，按窗口提示放入“应用程序”。网页链接指向[固定官方发行记录](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)，不是已实测的“最新下载”承诺。无需独立准备器、Python、Node、终端、测试脚本或新建 Home。
2. 连接校园局域网，点击“复制市场安装地址”。页面始终保留可选中的只读地址；LAN HTTP 下 Clipboard API 可能缺失或被拒绝。失败时选中地址并提示“自动复制不可用，请按 ⌘C / Ctrl+C 手动复制已选中的地址”。只有 `writeText` Promise 成功才显示已复制；等待中不会显示成功，不自动写剪贴板、不保存或上传。
3. 点击“打开 DSH”或自行从“应用程序”打开。进入 **插件（Plugins） → 添加插件（Add plugin） → 包名或地址**，粘贴地址，核对 **QCU市场 / 0.1.0-pilot.9.1** 与来源后审阅安装。再按官方界面另行启用；如提示下次启动生效，正常退出并重启。模型配置、后续教学任务与人工验收见 [P9 安装指引](qcu-market-p9-install-guide.md)。

浏览器可能请求确认外部应用；唯一唤起链接是字面量 `dsh://open`，仅在用户点击时使用。官方固定版本处理器只聚焦/显示主窗口，不能携带 TGZ、自动安装或打开添加插件面板。已核对的来源参考为官方 [`apps/desktop/src/main.ts`，tag `dsh-v0.2.0-rc.2`，1192–1196 行](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/src/main.ts#L1192-L1196)。本轮未启动 DSH；页面无法可靠判断协议处理器缺失，不显示“已打开成功”或检测安装状态，始终保留手动打开说明。

## 下载文件安装（备选）

展开同名区域，下载下列固定 TGZ，无需解压。保存到自己选定的长期位置，在 Finder 选中文件后按 **⌥⌘C**，取得实际本机绝对路径，再粘贴到官方“添加插件”的“包名或地址”。网页不能读取下载的绝对路径，不猜用户名或 Downloads。请长期保留 TGZ，因为官方包管理器后续可能仍引用文件。

此备选适用于有效旧环境选择同字节本地包，不能保证修复安装错误。已有损坏缓存、缺失 integrity 或 `ERR_PNPM_MISSING_TARBALL_INTEGRITY` 时，**停止并联系维护者，保留失败证据**。不要删除锁、清缓存、降低验证或反复尝试地址/路径；网页没有解决官方 HTTP 来源切换的缓存完整性问题。见[合成机制复现与真实现场边界](qcu-market-p9-cache-integrity-reproduction.md)。新机器首次官方 UI 安装尚未实测。

## 固定包与源码边界

```text
http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz
```

| 项目 | 固定值 |
| --- | --- |
| 包 | qcu-market / 0.1.0-pilot.9.1 |
| 字节数 | 43446 |
| SHA256 | `ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12` |
| 市场源码提交 | `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3` |
| 官方基线 | DSH 0.2.0-rc.2 / Apple Silicon Mac |

这些元数据在网页折叠区域展示，仅供来源对照；不是独立来源认证，网页没有对浏览器实际下载文件做字节数/SHA256 校验，也不能自动检测支持状态。地址在 HTML 与独立复制处理器中固定，不由当前 origin、查询参数、hash、localStorage、referrer、目录或远端 manifest 生成。页面只保留既有 `./catalog.json` 请求，不自动健康检查、安装、唤起应用或调用模型。目录失败、未返回、非法数据均不能阻止教师入口复制操作。

保留原目录和旧插件分步指令；服务器、暂存器、路由、验证器及白名单均未修改。不增加脚本资源或依赖；教师区域使用系统字体与现有主题变量，390px 单列，标签、键盘焦点、状态播报与既有减少动效规则保留。自动 DOM 测试不证明实际渲染。独立准备器仅保留为[可选维护候选](qcu-market-preparation-guide.md)，其源码、应用 README、归档不变，也不以 Apple 签名/公证作为此网页入口的交付前置。

## 当前验收与交接

| 检查 | 状态 | 边界 |
| --- | --- | --- |
| 真实首页 JS：复制成功、缺失/拒绝、延迟、重试不沿用旧成功 | 通过 | 合成 Clipboard，非系统剪贴板 |
| 固定 URL、字面量唤起链接、无自动安装/唤起 | 通过 | 静态与 DOM 行为断言，未点击唤起链接 |
| 目录失败/恶意数据/上下文覆盖、旧目录操作 | 通过 | 合成目录与 jsdom |
| 原网页、发布目录、Python 服务回归与真实 loopback HTTP | 通过 | Node 35 项（新增 15 / 原网页 9 / 发布目录 11），Python 8 项；仅 127.0.0.1 临时端口，不访问 LAN Hub |
| 桌面/390px、深浅主题与折叠说明 | 通过 | 父线程 Chrome 实际渲染与截图；窄屏展开技术信息后仍无横向溢出 |
| 禁用 Google 字体、键盘与读屏 | 未测试 | 系统字体样式存在，尚无阻断字体或辅助技术实测 |
| 原生复制按钮反馈 | 部分验证 | 点击后 writeText 返回成功且提示正确；控制工具剪贴板读到空字符串，实际系统内容未确认 |
| 外部协议提示、浏览器点击下载 | 未测试 | 未点击唤起或下载，不启动 DSH；维护者另行只读 GET 校验现有 Hub 的 16 个固定资源通过 |
| 新机器官方界面安装、独立启用与重启 | 未测试 | 用户实测；不等同历史同字节本地包报告 |
| 已损坏环境的缓存/锁修复 | 未解决 | 停止联系维护者，不以网页代替修复 |

已有 `tests/hub-web-install.test.mjs` 将插件数量写死为 2，而当前夹具实际含 3 项；本轮已用 HEAD 首页与 HEAD 测试在独立临时树复现同一失败，再将断言改为当前夹具的实际条目数。初次沙箱运行还拒绝 loopback 绑定，Python 报 `PermissionError`，Node 在服务测试中断言中止；原日志均保留，不能记作测试通过。精确命令、最终计数与日志见本次产物交接说明。

开发者复现（使用现有受信 jsdom，禁止安装依赖；教师无需执行）：

```sh
rtk proxy env QCU_HUB_TEST_RUNTIME=/absolute/path/to/audited-web/package.json \
  node --test tests/qcu-hub-teacher-entry.test.mjs tests/hub-web-install.test.mjs tests/hub-release-catalog.test.mjs
rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 tests/test_hub_python_server.py -v
rtk git diff --check
```

测试服务只绑定 `127.0.0.1` 的系统分配临时端口并在测试后关闭；沙箱若拒绝绑定，需正常审批后重跑，不能跳过后宣称通过。本轮成功运行复用的 jsdom 为 29.1.1，Node 25.8.1、Python 3.9.6。完整命令、未改首页的复现副本与逐次日志位于本机 `$HOME/Artifacts/qcu-harness/0.1.0-hub-onboarding.1/implementation-nwkuih7i/`，先前失败与后续成功分文件保留。

本地预览交给父线程：可先查看 `hub/web/index.html` 的静态教师入口（目录不可读时仍可用）。需要 HTTP 预览时，使用既有验证过的 release snapshot 与原 `hub/release/serve.mjs`，只绑定 loopback；不使用仓库根目录的通用文件服务，不请求真实 Hub 或把本地页面当作线上页面。浏览器检查桌面与 390px、三个主题、字体被阻断与键盘焦点；**不要点击“打开 DSH”**，也不要把 DOM 合成剪贴板结果当作系统复制验收。此线程没有启动浏览器预览服务器或操作原生 UI。

## 父线程预览补充

2026-10-15 父线程独立复跑 35 项 Node 与 8 项 Python 测试全通过，并以原 Python 快照服务在 loopback 提供真实 P9 资源和新首页，完成 27 项 HTTP 字节/边界检查。Chrome 中验证三主题、390px 单列和说明折叠，截图与系统剪贴板未确认项见[独立交付检查](qcu-hub-teacher-entry-parent-validation.md)。上述实现线程的历史失败/成功日志保持原样，未部署 Hub，也没有通过本页面执行安装或启用。
