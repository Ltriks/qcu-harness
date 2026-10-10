# QCU市场 · Client浏览原型

为固定 DSH `0.2.0-rc.2` 增加侧栏“QCU市场”和独立主面板。沿用官方聊天、审批布局与品牌，不替换 `root`。试用包版本 `0.1.0-pilot.1`，未安装到用户实例。包内无npm生命周期或构建脚本，Client已预构建。

- 唯一目录源：`hub/market/catalog.json`；沿用 Hub `skills/plugins`、`id/name/category/version/summary` 字段，补充来源、使用前提和实例验证状态。
- 该浏览schema与 `hub/release/catalog.mjs` 的已审核不可变发布schema有意分开。草案不能冒充已有哈希与发布批准的安装包；后续正式发布应复用现有Hub版本、哈希与审核机制。
- 构建：仓库根目录执行 `node hub/plugins/qcu-market/build.mjs`。生成 `client.js`，使用官方 `window.__ModuleLoader__.load` 懒工厂格式，仅从Host模块表取得React。生成文件提交以确保导出完整，内容只在目录源维护。
- 测试：`node --test tests/qcu-market.test.mjs`。官方依赖集成检查见 `docs/QCU-MARKET-PROTOTYPE.md`。
- Bundle只有一个默认禁用的 `qcu-market` row。Host `apply` 为空，不注册工具、RPC、Skill提供方或安装服务。Client依赖官方 layout/sidebar（继承其renderer依赖），通过 `main` keyed slot 和 `sidebar.panellist` list slot挂载。槽位注册由官方 `slots.inject` 生命周期管理。返回通过 `ctx.layout.selectPanel(null)`。
- 八个条目：五项QCU纯Skill草案和三项官方Office使用指导。纯Skill源码在仓库 `skills/qcu-*`，没有复制到UI包。不会因浏览卡片而变成已安装。

## 权限和数据

Client是可执行代码，运行在DSH Client环境，不能宣称零风险。当前源码只渲染随包静态目录；点击“复制示例”才写剪贴板。剪贴板缺失或拒绝时显示失败并保留可选文本。Host不执行任务；模型/文件/代码操作只可能在用户将示例用于现有能力后发生，继续遵守原审批。无学生材料、聊天、模型密钥、管理RPC或自动网络请求。

所有远程source都拒绝，呈现离线状态。未来远程入口必须固定审核过的Hub来源、版本和独立可信哈希，受限体积、JSON schema及失败状态；本版未实现此传输，也不接受任意URL、远程HTML或脚本。安装/启用/升级统一禁用；没有聊天预填路由。

## Known Limitations and Deferred Work

本实例技能发现、模型效果、真实DSH安装/重启/回滚和原生UI尚未验收。中文界面尚未接官方locale服务；本版不承诺多语言。官方Office仅核验固定源码提供方存在，运行时依赖和当前实例状态未知。纯Skill为教师审核草案。旧课程QA缺样例和旧ZIP许可证/编码问题未在本版修复：对应条目与归档完全不选入、不构建、不发布。历史安装器同版不一致问题不复用。

## Model Experience

浏览不向模型添加消息、工具、提示词或上下文，因此不主动消耗模型token或改变KV缓存。用户手工复制示例到对话后的模型行为由当前会话与所选Skill决定，未经效果评测。
