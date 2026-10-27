# 教师界面字号统一与窄屏排版修复

本候选已实现并通过本地渲染验证，尚未安装到真实 DSH 或部署到 Hub／mini。开发分支为 `dev/qcu-teacher-font-settings`，独占 worktree 为 `$HOME/Repos/worktrees/qcu-harness/teacher-font-settings`；基于 `f48b9f6cd91b34ea140baffaf1a3abe35e6ec740`。既有主仓库、其他 worktree、安装包及用户 Home 保留原样。

## 页面行为

首页、侧栏菜单、教学工具、帮助、课程工作台、市场及专家团共同读取官方 `--dsh-content-font-size`，缺省为 14px。标题和次级文字按同一根字号计算，避免嵌套 em 累积；普通正文和主菜单为设置值，默认首页标题由 30px 收紧到 24px，课程标题桌面为 22px、窄面板为 20px。图标保持几何尺寸，字体族沿用宿主。

设置里的 14、16、20、22 等值实时生效，切换主题或重新挂载不改回固定值。首页“大字模式”快捷按钮根据实际设置显示状态，只在点击后调用同一官方设置接口，分别选择 18／14；不再保存独立字号偏好。旧 `qcu.teacher.readability.v1` 不再控制字号，也不删除它。原有一次性中文初始化及其标记仍保留，仅移除首次加载时强行写入 18px 的行为。

课程工作台输入框按正文大小显示，标签和说明保持次级层级。窄面板为标题保留宽度，操作按钮换行。390px 面板、20px 设置下，标题宽度从约 29px 恢复为 279px，高度从约 260px 恢复为 37px，解决单字一列的问题。正常单行输入框的长文字仍可内部滚动。

课程、市场及专家团在未启用品牌插件时也能读取官方字号。补齐官方暗色属性适配，并保留启用 QCU 品牌时的蓝色配色；没有修改官方源码、全局 rem 或导出材料的排版。

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| 目标 Node 回归 | 39 项通过；明确排除缺少历史归档夹具的 3 项，未记为通过 |
| 生成客户端 DOM 模拟 | 9 项通过；模拟持久化与服务，不证明真实浏览器几何或原生 DSH |
| 字号浏览器回归 | 13 项通过；实际生成客户端、官方 ThemeRuntime／ThemePresenter，Host、目录、持久化及业务服务为显式合成 |
| 侧栏可达性 | 48 项通过；明暗、14／18／22、展开／折叠及 900／700／600／480 高度 |
| 视觉复核 | 首页前后对比、课程 14／20 及暗色、市场列表和详情、短窗口截图已检查；字号、换行、配色及标题宽度有计算值 |
| 副作用 | 浏览器无外部请求、React 错误或安装／发送／模型调用；独立测试 profile、浏览器沙箱及服务器清理已核对 |
| 构建对应 | 品牌客户端与既有构建逐字节相同；课程／专家团 factory 与既有构建相同；市场对应既有组装规则，未重建目录 |

官方设置原本描述为会话字号。本次由 QCU 自有页面显式读取其公开变量，扩展自有界面的跟随行为。官方 `boot-theme.ts` 写入变量，`ThemePresenter` 随设置更新；不修改官方设置实现或其他插件。

初次受限执行环境拒绝 loopback／Chromium，父级在获准的本机环境保持浏览器沙箱后完成上述验证。初次输入框误判和测试状态串用已修正；实际课程标题挤压及本次引入的暗色优先级问题已复现、修复并重测。历史失败和环境限制另存证据，不能用 DOM 模拟替代浏览器通过。

## 复现与预览

使用已有受信依赖，不安装或下载新依赖：

```sh
rtk proxy node scripts/build-font-settings-preview.mjs
rtk proxy node --test tests/font-settings-host-dom.test.mjs
rtk proxy node --test tests/font-settings-browser.test.mjs
rtk proxy env QCU_THEME_PACKAGE=.work/font-settings/clients/qcu-branding QCU_THEME_BROWSER_OUT=.work/font-settings/viewport-browser node --test tests/teacher-theme-viewport-browser.test.mjs
rtk proxy node scripts/serve-font-settings-preview.mjs
```

最后一条输出仅本机可访问的预览地址。工具条可选择字号、明暗、页面和侧栏；`?baseline=1` 展示固定基线。预览界面由真实客户端生成，合成后台不能操作 DSH、安装或生成任务。

目标回归需官方依赖的既有 TypeScript 支持参数：

```sh
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_COURSE_CLIENT=.work/font-settings/clients/qcu-course-workbench/client.js node --experimental-transform-types --expose-internals --test --test-skip-pattern='real archived|compiled Client4' tests/teacher-theme.test.mjs tests/qcu-course-client.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-expert-teams-review.test.mjs
```

详细计算值、生成客户端哈希和父级复核见 `.work/font-settings/PARENT-VERIFICATION.json`，截图与预览另归档到 `$HOME/Artifacts/qcu-harness/0.1.0-rc.4.1/font-settings-20261027/`。实现阶段报告保留原环境边界，以父级最终复核补充，不能从旧报告推断本次真实渲染仍被阻断。

## 安装与发布边界

本轮只交付源码与预览，没有改动 package 版本、固定归档、目录 pin、集成种子、信任根或原生应用。当前已安装版本不会自动改变。发布时须为受影响产品选择新的不可变版本，并在获准的既有环境按官方安装流程复核；不得覆盖同版本旧包或改种子凑回执。

原生 DSH 中现有用户设置的实际持久化、教师使用验收及新包安装仍未验证。本地验证不授予发布或安装权限，也不关闭此前独立的 rc4.1 原生启动排查任务。
