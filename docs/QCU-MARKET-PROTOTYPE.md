# QCU教学市场源码原型

本轮边界：隔离开发分支 `dev/qcu-market-prototype`，基线 `ab362184c917554354486cd13d300f4c934be138`。不合并main、不改助手分支、不发布包、不操作Mini、用户Home、App、scheme、密钥或聊天。

## 最小内容清单

| 场景 | 标识 | 来源及状态 |
| --- | --- | --- |
| 备课与课堂活动 | qcu-lesson-planning、qcu-tiered-practice | QCU新纯Skill草案，覆盖教案、课堂活动、分层练习 |
| 课件制作 | office-pptx | DSH官方内置能力，本实例未验证 |
| 教学文档 | office-docx | DSH官方内置能力，本实例未验证 |
| 匿名教学数据 | office-xlsx | DSH官方内置能力，本实例未验证 |
| 阅读笔记与复习 | qcu-note-organizer、qcu-reading-outline | 三项既有canonical内容中的两项QCU适配稿 |
| 学术诚信与引用 | qcu-integrity-guard | 既有诚信提示适配稿，非查重/AI检测或处分决策 |

`hub/market/catalog.json` 是唯一人工维护目录；`client.js`是构建快照。每项均提供用途、来源、标识、适用版本、前提、测试状态、权限风险、示例与许可。适配稿的 `SOURCE.json` 保存原始路径、基线与正文哈希，独立目录附原MIT许可证；历史来源路径保留原名称，不是新产品命名。未选入课程QA，避免继承缺失的三份样例；不使用任何旧ZIP/TGZ，故历史归档修复仍属后续独立工作。

## 已实现与未接通

已实现：官方Client工厂与Host空导出、默认关闭Bundle row、主面板/侧栏注册、六场景筛选、八卡片、返回对话、示例复制实际结果反馈与手动降级、重复复制合并、组件卸载后不写状态、目录严格验证及离线失败状态。

未接通：远程传输/信任发布、安装/启用/升级、实例能力探测、聊天预填、多语言、技能自动装载。所有操作按钮明确禁用。没有安装包或已安装声明。Office只作官方使用指导，不要求从市场再下载安装。

## 验证记录（2026-10-10）

执行环境Node 25.8.1；插件交付为普通ESM/浏览器JS，不依赖Node类型转换。只有官方TS源码集成测试使用Node实验转换器。

```sh
node hub/plugins/qcu-market/build.mjs
node --test tests/qcu-market.test.mjs
QCU_OFFICIAL_DEPENDENCIES=<审计过的rc.2依赖根> node --experimental-transform-types --test tests/qcu-market-official.test.mjs
QCU_OFFICIAL_DEPENDENCIES=<同一依赖根> node hub/plugins/qcu-market/preview.mjs
```

目录/打包/组件9项测试及真实Cordis/SlotRegistry/LayoutController集成1项测试通过。覆盖六场景状态、重复ID、未知字段/安装声明/版本/来源拒绝、远程和损坏目录失败、复制成功/拒绝/缺失、重复复制与卸载、UTF-8与许可证、来源哈希、官方Client工厂/导出、默认禁用、必要依赖、重复导航/返回、官方注册释放与卸载后拒绝导航、React静态渲染八条卡片。无模型调用或网络安装。

官方固定源码 `639ed015397290b3745d163aafe02ffee4aa3f84` 的三个源码文件与测试依赖中的对应文件逐字节相同：

| 文件 | SHA256 |
| --- | --- |
| ui-renderer/src/client/registry.ts | 6b8b6b969d8bcf0314ea20438a223f3a90e1bd516571faecae5c3c01008ecf21 |
| ui-layout/src/client/service.ts | 2b70b115e7cc04eb29cb8d95cec706b4e3fd39af96418bdfe1cc03359b4c81c4 |
| ui-slots/src/index.ts | 27a453937cdcc28923c37ad90cd01489e458e205dc03032629183087b5b585d0 |

官方契约参考：`packages/client/ui-schedule/src/client/index.ts` 的main/sidebar注册；`packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration` 的模块工厂；`apps/desktop-host/src/office.ts` 的Office挂载。只读审阅这些源码，没有改官方checkout。

视觉与真实点击：**not tested**。已生成隔离预览（合成shell、剪贴板禁用），但工具报告IAB不可用；Chrome禁止file协议且禁止绕过，因此未改用服务器或其他浏览器通道。没有启动DSH。静态React渲染与组件测试不冒充原生UI证据。

## 下一步真实安装的精确范围（尚未授权/执行）

先完成受支持的隔离预览视觉复核，再为审核后的 `qcu-market@0.1.0-draft.1` 构建固定哈希包并列出最终成员；当前没有发布包。取得用户对指定目标官方rc.2版本、全新合成Home/profile、包哈希及单个 `qcu-market` row 的明确批准，再通过官方CLI安装为禁用状态。单独批准启用与正常重启，验证一条侧栏、打开/重复点击/返回、目录失败、剪贴板拒绝/允许、官方聊天及审批布局保留、卸载释放。只卸载本包/本row并清理该合成Home作为回滚，不动任何既有Home、用户数据或Mini线上Hub；不复制model key。Office仅验证当前实例技能发现与无个人数据的合成任务，模型调用另需可用且授权的模型配置。纯Skill安装不包含在此UI插件试点中。
