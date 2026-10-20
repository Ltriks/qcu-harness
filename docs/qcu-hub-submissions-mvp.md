# Hub 投稿审核与发布候选：本机 MVP

2026-10-20。本轮实现独立 `hub/admin/`，仅完成**本机投稿、人工审核与不可变候选准备**。公开 Hub、固定市场目录、历史包和 DSH 均未修改。真实发布、快照切换／撤回、组织登录及部门开放仍为后续工作。启动与双角色操作见 [操作入口](../hub/admin/README.md)。

开发分支：`dev/qcu-hub-submissions`；固定 worktree：`$HOME/Repos/worktrees/qcu-harness/hub-submissions`。无构建步骤，按上述操作入口运行 Python 服务；现有 LAN Hub 与 DSH 未部署此管理端。

本页保留 `dbb7b8b` 双角色原型的历史验收口径；当前单管理员实现与启动方式见[单管理员说明](qcu-hub-single-admin.md)。旧 schema 1 库沿用旧分支读取，本轮不迁移或覆盖。

## 实现与边界

- 接收严格 JSON 信封 `{files:[{path,base64}]}`，拒绝重复 JSON 键、深嵌套、非规范路径、重复／大小写别名／文件目录冲突及非严格 Base64。每份最多64文件，单文件1 MiB、JSON 256 KiB、总解码10 MiB、请求15 MiB。私有库最多32条记录，状态文件最多15 MiB，满后拒绝新投稿，保留既有材料。
- 预检失败不登记投稿；预检通过后将原字节写入新的随机编号私有目录，保存排序的路径／长度／SHA256清单及其摘要，复用**未修改**的 P10 检查器。附加附件也做文件策略及模式扫描。静态失败留为 `needs-changes`；静态通过为 `in-review`，从不声称无密钥认证、安全认证、来源真实或原生／业务已通过。
- 两个独立、持久化能力令牌，仅支持 Bearer 请求头；浏览器密码输入框，令牌仅存在页面内存，不写本地存储。静态登录外壳不含私有数据，全部记录／报告／下载需要令牌；只有投稿角色可上传，只有维护角色可审核、预览和准备。所有投稿均属于这一共享本地投稿角色，**不是多人账号隔离或不同真实用户的证明**。审计 actor 也只表示本地角色。
- 精确 Host，写请求须精确同源 Origin、自定义 `application/vnd.qcu.submission+json`、唯一正整数 Content-Length；拒绝缺失／null／跨站 Origin、Transfer-Encoding、重复关键头及超限长度。连接空闲5秒，正文读取总计10秒。有 CSP、nosniff、no-store、no-referrer，无跨域放行、外部资源、URL令牌或请求正文日志。服务端诊断只用固定代码；JSON展示遮蔽已知密钥模式。**授权的原始附件下载保持字节不变，可能包含待审的不安全内容**，只作为附件，不内联执行。
- 私有存储通过目录描述符逐级 `O_NOFOLLOW`，拒绝软链、材料硬链、额外／缺失／变更字节。批准、候选预览、准备、报告／材料／候选导出都复核完整冻结清单。报告 JSON 展示及下载同样遮蔽已知密钥模式；原始材料下载不作字节改写。状态原子替换并 fsync，进程排他锁、线程锁串行决定。状态写入失败后该进程拒绝后续数据操作，需维护者重启核对。
- 完全相同材料摘要幂等返回原记录。相同产品／版本而实际 TGZ 字节不同拒绝覆盖；相同 TGZ而证据／材料改变产生新记录，不继承批准。退回与批准都绑定当前状态和材料摘要，理由最多2000字符；两种决定都只接受来源、许可、权限、证据边界四个精确布尔字段，拒绝未知或嵌套值。退回允许未勾选，批准必须四项全真。原生及业务“未测”仍保留。
- `approved` 与 `release-prepared` 是不同状态。候选确认绑定材料摘要及完整提案摘要；同一已批准快照的重复准备返回同一候选，无额外副作用。生成审计记录含维护者角色、时间、动作、理由、材料及提案摘要，区分 intent／completed／failed。成功候选包含准备意图与完成事件；重启或重试不追加新时间戳或改变提案摘要。读取列表／报告或导航不触发批准或准备。

## 状态与恢复

`checking → needs-changes / in-review → approved → preparing → release-prepared`。

`checking`／`preparing` 时进程中断，重启将其标为 `recoverable-failure`，记录恢复事件；不会重新检查、自动批准、自动继续准备或导出未知目录。维护者需核对私有库，修改材料后提交新修订。已有故障记录的精确重传会拒绝，避免假装恢复成功。已退回记录也不自动重新进入审核；应提交修订。

冻结文件写完前发生磁盘错误可能留下尚未登记的目录；候选写入中断可能留下未关联的候选目录。这些都不通过 HTTP 开放，保留给维护者人工核对。不要手工把它们挂接到记录、改审批状态或覆盖旧文件。状态库不为同一操作系统用户的恶意改写提供密码学防护，不是生产服务或组织鉴权系统。

## 私有产物与下载

```text
STATE_ROOT/                       # 0700，仓库外
  credentials.json                # 0600，两种本地能力令牌
  process.lock                    # 活跃进程独占
  state.json                      # 原子持久化记录／报告／审批／审计
  submissions/sub-<random>/       # 冻结原始文件，原文件不变
  candidates/candidate-<random>/  # 新建，不覆盖
    <exact-name>.tgz
    submission.json
    materials.json               # 冻结材料的完整清单
    checker-report.json
    approval-audit.json
    proposal.json
```

候选文件只读模式0400；HTTP没有修改候选接口。候选提案为 `status=local-candidate-not-published`、`marketAvailable=false`、`catalogIntegrationRequired=true`，记录原始身份／版本／许可／权限／证据／限制和审批；不编造分类、兼容性、风险评级或独立来源认证。`proposalDigest` 是不含其自身字段的排序标准 JSON（`checker.encoded`）的 SHA256，绑定审批、原始材料清单、TGZ及检查报告摘要。生成操作事件另存于 `approval-audit.json` 和状态审计，不改变已确认提案，允许安全重试。

维护者只能通过当前记录的数字索引下载完整 allowlist 中的附件或候选文件，响应固定附件名（`.bin`／`.tgz`）。无任意磁盘路径、目录遍历或开口下载路由；每次下载前复核清单。旧市场 Host 仍只接受其原有精确目录，候选不会自动出现或变为可安装。下一阶段需独立确认不可变公开快照、固定市场目录关联发行、实际下载校验、失败回退与撤回规则。

## 验证与人工接续

从仓库根运行，不安装依赖：

```sh
rtk proxy python3 -m unittest discover -s tests -p 'test_qcu_hub_admin.py' -v
rtk proxy python3 -m unittest discover -s tests -p 'test_qcu_submission_check.py' -v
rtk proxy env QCU_BROWSER_DEPENDENCIES=/absolute/path/to/existing/node_modules node --test tests/qcu-hub-admin-browser.test.mjs
rtk git diff --check
```

`QCU_BROWSER_DEPENDENCIES` 指包含 `playwright/` 的已有 node_modules；`QCU_BROWSER_EXECUTABLE` 可指已有 Chromium，默认使用本机已缓存 `chromium_headless_shell-1234`。浏览器脚本生成合成材料、使用 `/private/tmp/qcu-hub-browser-*/state` 独立状态根，自动关闭 Chromium 和测试服务器；不下载、不安装、不调用模型。不要把该脚本的状态路径当作长期服务。私有测试状态含新生成的本地令牌，不纳入 Git 或分享。

人工接续可用模板生成器创建新合成目录：

```sh
rtk proxy python3 templates/qcu-submission/generate-example.py --output /private/tmp/qcu-hub-example-new
```

1. 以投稿角色登录，确认空队列；选择 `reject`，检查失败留存且无批准入口。
2. 上传 `static-pass`，确认“待人工审核”、原生及业务未测；重复上传应是同一编号。
3. 换维护角色，下载并核对报告／材料，退回并说明理由；更改材料后重新投稿，不能继承旧审批。
4. 确认来源／许可／权限／证据边界四项并填写理由，批准后应仍无候选。
5. 查看候选确认，核对版本／TGZ／SHA／来源声明／许可／权限／证据／限制／摘要／审核决定／市场边界，勾选后生成；重复请求不生成第二份。
6. 下载候选逐字节复核；退出、刷新、重启后重新登录查询。用投稿角色尝试审核应拒绝。

所有以上测试只验证合成材料与本机流程。尚未测试真实同事投稿、组织身份接入、原生 DSH 安装启用、教师业务验收、真实 Hub 发布／撤回／市场关联发行；本轮均不执行。

实际验收：管理端单元／真实 HTTP **16/16**、原 P10 检查器 **51/51**、现有只读 Hub 父级独立回归 **8/8**、真实 Chromium 闭环 **1/1**（19项验收记录）通过，当前无未解决测试失败。截图已人工复核。

日志、6张截图、浏览器结果及验收交接已归档至 `$HOME/Artifacts/qcu-harness/0.1.0-hub-submissions.1/validation-20261020/`。源码清单和推送提交另存于产物根目录；候选与测试状态中的访问令牌不纳入交付。worktree 的 `.work/hub-submissions/` 仅为忽略的复现工作目录。
