# QCU 专家团本地候选

> 后续状态（2026-10-23）：本机已安装并启用 pilot.2，重启及保存配置验收通过；真实模型质量仍待验收。见 [本机安装记录](qcu-expert-teams-local-install.md)。以下保留 pilot.1 原始交付时的状态。

2026-10-23。分支 `dev/qcu-expert-teams`，基于与远端一致的课程工作台 `7e647436f0849be617b360add1cd771d47fa8339`。本次新增独立插件与相关验证，不修改既有课程业务源码、官方内核、市场白名单或默认用户 profile。未提交、推送、安装或部署。

## 实现

源码入口：`hub/plugins/qcu-expert-teams/`。版本 `0.1.0-pilot.1`，协议1；DSH `0.2.0-rc.2` / Cordis `4.0.4`，无新增运行依赖。Host贡献 `qcuTeams` Typert服务；Client使用官方lazy-CJS、宿主React、sidebar图标和keyed main slot，停用时撤销服务及界面。

内置“教学评审团”：学科专家、评价设计专家、课堂实施专家分别审阅，教研主编等待三方完成后汇总。支持1–6位成员、最多3路并发，编辑角色指令、每人最多4项当前可用技能、依赖关系与最终汇总成员；循环依赖或未参与最终汇总的成员不能保存。支持JSON导入为新草案、导出和复制团队；不导入凭据、模型地址或执行权限。

选择官方已登记工作区后保存团队和运行历史。材料限用户本次粘贴文字；不读取用户任意路径。点击准备加载所选技能说明和当前模型能力，页面展示任务、材料、岗位指令、技能正文快照、精确provider/model、推理策略及最大请求次数。明确确认后，每个成员最多一次官方LLM请求，6000输出令牌；优先low，其次off，否则如实使用适配器默认策略。准备与执行时检查模型/能力一致；不修改全局模型设置，不读取API Key。技能只注入说明，不执行脚本、MCP或联网；相关缺口要求模型保留。

同一启动请求绑定一次预览意图并幂等；保存操作串行。运行前先持久化，失败、截断、超时、取消或停用后不继续依赖步骤；并行任务收束后再确定最终状态。停用与首次写入交错也不触发迟到模型工作。重启将未结束记录标为中断，不自动恢复。完整结果允许下载为待教师复核Markdown，包含原任务、模型与时间；各步结果和历史仍可读。

状态存储：所选工作区 `.qcu-expert-teams/state.json`，权限0600，原子替换、拒绝符号链接；上限20个团队、50次运行和8MB，无自动删档。材料、技能正文及结果保存在该工作区。此处是插件级约束，不认证同权限任意代码的系统隔离。

## 验证证据

- 核心测试12项通过：非法配置、依赖图、有界并发、技能冻结、预览失效/过期、并发重复启动、失败/取消/超时、工作区隔离、符号链接、重启及卸载交错。
- 真实固定官方Cordis/Typert/Skill/LLM合成适配器测试5项通过：四步调用、技能正文注入、6000预算与low策略、零工具/凭据、模型变化/输出截断、Client远程服务和真实Slot生命周期。
- 最终TGZ独立解包：10个普通文件逐个与manifest及源码核对SHA256，无额外成员；包内Host和生成Client再次通过上述5项官方测试。打包器两次生成逐字节一致。
- Chrome共享UI完成：工作区→改成员和技能→保存→输入匿名自编材料→准备→改变任务撤销确认→重新准备/明确确认→三方评审和主编汇总→实际下载Markdown。启动前合成调用计数0，完整运行后4，控制台error/warn为空。下载事件观察工具超时，但实际下载文件已存在并独立读取，未将工具超时误记为产品下载失败。
- 360×900浅色实看：文档宽度360，工作室内容clientWidth/scrollWidth均345，无横向溢出。保存desktop-result.jpg、narrow-light.jpg。后续浏览器调试连接被撤回，深色与独立视口恢复检查未完成；不声明通过。结果增加原任务/模型标签后的最终Client已通过包内渲染与运行时复测，未再次取得浏览器截图。

## 固定候选

- 包：`qcu-expert-teams-0.1.0-pilot.1-6f9edaaeb2ca5d32b5373f46b72f708c140fad09ab852defe3f617fe9a824963.tgz`
- 19588字节；SHA256 `6f9edaaeb2ca5d32b5373f46b72f708c140fad09ab852defe3f617fe9a824963`。
- 本机归档：`$HOME/Artifacts/qcu-harness/0.1.0-expert-teams.1/`，含固定包、成员manifest、日志、浏览器记录与截图。最终落盘以归档manifest和本线程回执为准。

## 接续与验收

本轮只交付本地候选，未调用真实付费模型，未安装/启用真实DSH，未改Hub或市场目录。当前市场固定Host白名单尚不包含此产品。经明确授权后，使用官方插件界面审查上述固定TGZ并安装、单独启用、正常重启；检查“专家团”入口、真实已安装技能选择和现有模型。先用自编匿名材料确认一次调用；分别检查概念/答案正确性、分歧保留、取消与历史回看，再扩到真实教师材料。不要把合成调度通过视为教学质量已通过。

复现：

```sh
rtk proxy node hub/plugins/qcu-expert-teams/build.mjs
rtk proxy node --test tests/qcu-expert-teams-core.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-expert-teams-official.test.mjs
rtk proxy python3 hub/plugins/qcu-expert-teams/pack.py /path/to/new-output
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node hub/plugins/qcu-expert-teams/preview.mjs
```

预览只监听127.0.0.1，使用共享真实UI、真实状态存储与明确合成生成器。预览进程本轮已正常停止。
