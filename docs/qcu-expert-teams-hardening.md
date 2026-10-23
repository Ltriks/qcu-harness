# 专家团 pilot.2 本地候选验收

本轮版本 `0.2.0-pilot.2`、线协议 3，存储仍是 schema 2；官方 DSH `0.2.0-rc.2`、默认禁用声明和模型调用策略不变。仅生成隔离 worktree 内的候选，父任务负责审阅、归档及后续发布。本轮没有安装、部署、真实模型调用、提交或推送。

## 操作清单

- 实现：运行记录页显示条数及当前 JSON 存储字节（包含配置）。最多 50 次、8,000,000 字节，45 条或 7,200,000 字节开始提示接近上限；新任务和结果仍需可用空间，提示不保证下一次完整结果一定放得下。不会自动删除历史。
- 教师：选择已结束记录，先点“备份所选记录”，妥善保管下载的 JSON；其中含所选任务、材料和意见。它是数据备份，不能导入为团队或再次执行。再点“预览清理”，核对工作区、数量、记录 ID 和任务；取消或 Escape 不删除。勾选确认后才移除所选本地记录，不能撤销；专家和团队保留。内容变化、运行中、过期、重复确认均拒绝。清理后任何旧任务预览失效，需重新预览并确认。
- 教师：已完成任务仍可下载 Markdown；失败、停止、中断可下载部分报告，保留实际步骤状态和已有意见。看到“待教师复核 / 未完成”时不能把它作为完整汇总结论。报告包含任务、精确模型、已知时间与步骤名；缺失时间显示未记录。插件不报告推测的 token 消耗或费用。
- 合成自动验收：运行下述核心、官方及浏览器用例，查看 `.work/expert-hardening/RESULT.json` 中每项结果与日志。这只证明边界与流程，合成固定输出不证明模型发现教学错误的能力。
- 真实原生 UI：本轮未安装候选，未验证 DSH 原生文件选择器、真实宿主下载权限、重启及真实工作区。父任务另行授权后，用匿名资料验证文件选择、导入预览、取消、键盘、保存与重启。通过 JSON 解析测试不能勾选“原生文件选择器通过”。
- 真实模型：本轮禁止调用。父任务另行授权后核对真实 provider/model、低或默认推理、每成员一次且最多 6000 输出令牌、有界并发；观察失败、停止与不重试。真实服务费用和限流也需单独观察。
- 教学质量：由教师按下述材料与量表复核。模型流程通过不等于教学意见正确，更不等于真实课堂有效。

## 匿名自编材料与人工质量量表

`tests/fixtures/qcu-lesson-review-two.json` 和 `qcu-lesson-review-four.json` 是自编匿名材料，分别安排两人接力和四人独立评审后汇总。故意植入百分比基数错误，不含真实个人或课程文件，不能作为市场产品导入。人工测试时手动采用其中的任务、材料与分工。

两人材料：80 元涨至 100 元，错误答案把 100 作分母并称涨幅 20%；应以原价 80 作基数，涨幅 25%。四人材料：1000 元先降 20% 再涨 20%，错误答案称抵消；第二次基数是 800，最终 960，较原价下降 4%。退出票 200×1.1×0.9=198，下降 1%。这些期望是人工核对依据，不是对真实模型的已测评价。

每维 0–2 分（0=缺失/错误，1=部分满足，2=具体且可核对）。总分至少 8/10，且前两维均为 2 才可进入匿名教学试用；未完成报告不得以总分冒充完整汇总。

| 维度 | 得 2 分的条件 |
| --- | --- |
| 知识准确性 | 定位原句错误，算式与基数解释均正确，不只改答案。 |
| 证据与边界 | 引用所给材料，明确班情与效果未知，不虚构资料或验证结论。 |
| 教学可操作性 | 至少一个可实施活动或优先修改项，有时间/资源条件。 |
| 评价设计 | 解释评分能区分基数理解与猜测，退出票与目标对应。 |
| 汇总质量 | 保留具名专家依据与分歧，区分必须修正、可尝试、待核实，不覆盖失败或缺失步骤。 |

## 可复现命令

仅使用已安装的可信依赖，禁止 install。所有测试使用临时合成工作区。核心和官方测试可通过 `QCU_TEAMS_PACKAGE_ROOT` 指向解包后的 `package`，同一套测试验收候选源码。

```sh
rtk proxy node hub/plugins/qcu-expert-teams/build.mjs
rtk proxy node --test tests/qcu-expert-teams-core.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-expert-teams-official.test.mjs
rtk proxy python3 hub/plugins/qcu-expert-teams/pack.py /path/to/new-local-candidate
```

浏览器验收需允许回环监听与启动已安装 Chrome。preview 仅绑定 `127.0.0.1`，每次新建独立工作区；不访问用户 profile、模型、缓存或账号。浏览器测试使用已安装 Playwright，显式清空默认 Chrome 参数，仅保留独立数据目录、自动化管道及关闭后台同步等参数，不关闭 sandbox 或 web security。浏览器可见，测试完成关闭；会截图实际 React 界面的 1280/360px 明暗视口，并保存真实下载字节。

```sh
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_TEAMS_ACCEPTANCE=1 QCU_TEAMS_PREVIEW_OUT=.work/expert-hardening/fresh-preview node hub/plugins/qcu-expert-teams/preview.mjs
# 另一个终端：使用上条命令输出的回环 URL；每次测试必须使用新的 preview 合成状态。
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_TEAMS_BROWSER_URL=http://127.0.0.1:PORT QCU_TEAMS_BROWSER_OUT=.work/expert-hardening/fresh-browser node --test tests/qcu-expert-teams-browser.test.mjs
```

`/harness` 的尺寸控制仅属于验收服务器，不进入插件包。候选包含生成的官方 lazy-CJS Client 及其共享源码，保持无脚本、无新增运行依赖、默认禁用。打包器按路径排序，固定 tar/gzip 元数据，重复构建必须逐字节相同；候选文件名包含 SHA-256，不覆盖旧版本。
