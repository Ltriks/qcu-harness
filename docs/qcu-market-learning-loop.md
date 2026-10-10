# QCU学习教练市场原型：实际边界与验收

## 结论

当前是**临时对话桥接**，还不是用户要求的“点击条目直接安装”。市场目录仅存结构化条目、固定版本、大小、SHA256；独立教练 TGZ 应由校内 Hub 托管，市场安装包不包含教练 TGZ。此次只完成隔离源码、包与测试，未部署 Hub 或 Mini。

公开 rc.2 `pluginNavigation` 只有 `openBundle(name)`，没有“带安装 spec 打开官方安装框”的跨插件 API。官方 `ApprovalService.request` 要求已打开的模型 turn，不能在模型外命令内直接借用该审批。因此本版流程是：检查本实例 → 点击准备（定源下载校验）→ 点击预填 → **用户发送请求、已配置模型执行官方工具、本机用户逐次批准** → 重新检查技能 → 预填学习任务 → 用户发送。发送可能消耗模型额度，模型配置所需凭据由官方应用管理，QCU不读取。QCU上架审核、本机用户安装确认分别负责内容准入和执行权限；不存在 DeepSeek 远程审核。

不导入私有安装控制器，不把通用管理 Remote 暴露给客户端，不以自动发送或直接 `installBundle` 绕过审批。真正无模型点击安装需要官方公开安装对话/用户动作契约或单独设计的原生审批扩展；本提交未实现，也不声称已接通。

## 本版源码与行为

- `hub/market/coach-release.json`：唯一固定发行条目；`scripts/pack-coach-v2.py` 同时生成 Host 编译信任常量，未新增远程HTML或任意URL解析。
- `hub/plugins/qcu-market/src/host-core.mjs`：固定私有IPv4 HTTP来源、无重定向、30秒上限、1MiB包上限、精确长度和SHA256、不可覆盖缓存；不以HTTP提供传输保密，固定哈希提供此包完整性。
- `index.js`：命令 `/qcu-market` 与工具 `qcu_market` 共用四操作 prepare/status/verify/cancel。无安装、启用、版本豁免、权限更改或一般管理RPC。prepare/verify在全权限模式拒绝，避免官方免确认路径。
- `src/flow.mjs`：专用会话创建、retain/release、公开命令桥接、保留既有草稿/附件/队列、输入预填。没有 submit。取消前尚未完成会话创建也不会迟到启动下载。
- `src/loop-plugin.mjs`：主面板与侧栏，单条教练；草案不出现于安装市场，Office仅帮助。未安装、准备完成、安装未启用、组件待启用/重启、技能不可见、冲突和加载失败分开。
- `skills/qcu-study-coach` 与 `hub/plugins/qcu-study-coach-v2`：新 skill 名称 `qcu-study-coach`；2–5分钟小任务估时、避免羞辱式绝对说法、限定可比样本复盘。旧目录/包未修改。插件默认禁用、显式启用、哈希验证、同名存在即拒绝注册。
- ready需要精确包版本、bundle enabled、唯一active enabled组件、目标会话实际赢出的provider与正文hash；不会把“下载”“安装”“组件加载”单独当技能可用。

## 固定交付

市场：`qcu-market@0.1.0-pilot.3.1`，SHA256见 `docs/evidence/qcu-market-loop-local.json`；其中仅源码/图标/许可/目录常量，11个成员，无依赖捆绑、生命周期脚本或教练TGZ。内部 pilot.3 构建不是交付版本；3.1增加显式临时桥接/模型前提提示。

教练：`qcu-study-coach@0.1.0-pilot.2`，3445字节，SHA256 `4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060`；7个成员，无生命周期脚本。目录 releaseStatus 为 local-candidate-not-published。完整本地路径和成员哈希记在交付 MANIFEST 中；TGZ不推入Git。

新增能力需要单独审核：Host代码执行、固定LAN下载、持久缓存写入、专用会话创建、命令/工具注册、包与技能正文状态检查、对话草稿写入。它不读取聊天、密钥或学生数据。原型不是无风险UI更新。

## 已测与未测

本地34项通过：14历史目录/样式回归；16固定源/下载/哈希/取消/重复点击/状态/草稿测试；真实官方 Cordis/SlotRegistry/Layout 导航和卸载1项；实际 rc.2 `plugin_manager` 拒绝/取消/允许一次后转发 disabled安装、市场真实defineTool导出/参数校验、真实SkillRegistry注册/重复拒绝/卸载后重新发现3项。

官方审批测试调用真实工具执行逻辑，但用假的管理服务，不写profile。技能重新发现测试是重新组合注册表，不是实际App重启。未测：真实Mini安装/启用/重启、Hub HTTP服务传输、真实模型对请求的执行、教学效果、人工屏幕视觉验收。不得从这些单元测试宣称完成现场闭环。

复现（在仓库根目录，用本地已审计rc.2依赖；不拉依赖、不启动应用）：

```sh
python3.11 scripts/pack-coach-v2.py --out /tmp/qcu-coach-check
node hub/plugins/qcu-market/build.mjs
python3.11 scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach /tmp/qcu-coach-check/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz
node --test tests/qcu-market.test.mjs tests/qcu-market-loop.test.mjs
node --experimental-transform-types --test tests/qcu-market-official.test.mjs tests/qcu-market-host-official.test.mjs
python3.11 hub/plugins/qcu-market/pack-pilot.py /tmp/qcu-market-check
```

源码基线官方 `639ed015397290b3745d163aafe02ffee4aa3f84`，参考公共契约：`packages/client/ui-plugin-manager/src/client/index.ts`、`packages/boot/plugin-manager/src/tools.ts`、`packages/interaction/user-approval/src/index.ts`、`packages/interaction/commands/src/index.ts`、`packages/api/session-controller/src/client/contract/sessions.ts`、`packages/client/ui-conversation/src/client/contract/input.ts`、`packages/client/ui-workspace/src/client/navigation.ts`。

## 下一次现场演示的精确授权范围（本次未执行）

1. 明确用户是否接受临时对话桥接及模型前提；若只接受无模型直接安装，停在源码交付，先做正式公开接口方案。
2. 校内Hub仅新增上述不可变教练文件和目录条目；读取回验hash/长度，不改旧包。市场更新为固定3.1包，用户以官方UI安装并启用，明确新增Host能力；不注册scheme，不换聊天审批布局。
3. 当前若有旧教练0.1.0-pilot.1，先只读确认。此版会报冲突；需单独授权用户通过官方UI卸载旧教练再演示，保留旧包和回退信息，不能暗中覆盖。
4. 先拒绝一次安装审批，核验未安装；再由用户主动重试并逐次批准。若要求重启，用户自行正常重启，再检查同名技能provider/hash。无需或不得读取用户凭据/聊天。
5. ready后只预填一个30分钟合成学习任务；用户发送，核验实际技能调用和时间建议。不使用真实学生信息。任一未知/失败停止，不宣称成功。
