# QCU Hub 单管理员本机迭代

2026-10-20，`dev/qcu-hub-admin-account`。当前实现固定 `qcu-admin` 密码登录，同一页面／会话导入同事 handoff、退回／批准、单独确认生成候选。仅本机合成验收；未部署、未真实发布、未创建真实账号。用户对旧体验的总体认可不代表本轮逐项人工验收通过。历史双角色令牌验收保留在 [MVP 说明](qcu-hub-submissions-mvp.md)。

## 本人交互式设置与启动

从本 worktree 根目录运行，Python 3.9+ 标准库，无需安装依赖。下列状态根须为**不存在的新目录**，父目录须已存在。真实密码由本人在本机终端输入，不发到聊天、不交给代理。`--init` 在创建状态目录前经 TTY 隐藏输入两次密码；无默认密码，不接受密码参数、环境变量或网页初始化。

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --init --port 8765
```

固定账号 `qcu-admin`；密码12–128个字符、UTF-8最多512字节、不能含 NUL。两次一致后建立私有状态并直接启动服务。打开 `http://127.0.0.1:8765/`，账号／密码登录。Ctrl-C停止；同库重启：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --port 8765
```

`/private/tmp` 适合可清理的本机试验，长期状态应换成仓库外、未同步／未公开托管的专用目录并私有备份。根目录0700，`admin-auth.json`0600；拒绝符号链接／硬链接、工作区、公开快照目录及不安全祖先。不要由其他服务器暴露状态根。

## 忘记密码的本机恢复

先 Ctrl-C 停止该状态库的服务，再在本人终端运行：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --reset-admin-password
```

先独占进程锁，才提示输入两次新密码；服务未停止时拒绝且不提示密码。恢复只原子替换认证文件、保留最近16条本机重置事件，事件仅含 action／actor／时间；投稿、审批、候选及其字节不变，连中断状态也不在恢复命令中改写。完成后退出，再用普通启动命令。没有网页恢复、自动重置或旧令牌兜底。密码文件损坏时失败关闭，不伪造新账号；另行人工核查／私有备份恢复。

## 单管理员流程与认证边界

1. 同事把完整 handoff 交给管理员；同事没有账号、自助注册或匿名上传入口。教师仍浏览既有已发布 Hub。
2. 管理员选择一个完整文件夹并“上传并检查”。原材料不变，服务冻结精确字节，检查失败保留报告但不可批准。
3. 同一会话下载并核验原始材料、报告，填写审核理由与核验范围；退回后变更材料重新导入形成新修订。批准需逐项人工勾选，不自动生成候选。
4. 另行查看精确候选预览、勾选并“生成发布候选”。候选不可变、未发布，现有市场不能自动安装；摘要绑定、重复请求幂等、版本归档冲突拒绝及崩溃恢复沿用既有规则。

应用操作记录 principal 为 `qcu-admin`；单账号不证明同事身份、真实操作人或不可抵赖性。恢复事件由系统记录。所有数据／上传／审核／预览／报告／附件／候选 API 均需临时会话，旧角色令牌无效。登录同样校验精确 Host、Origin、指定 JSON Content-Type；限制登录体4096字节、字段恰为 account／password、拒绝重复字段。

认证文件只存32字节随机盐、PBKDF2-HMAC-SHA256（600000次）结果及严格有界元数据，不保存明文。参数核对参考 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)（2026-10-20查阅）。选型依据是 Python 标准库兼容；不声称认证／FIPS 合规或优于 Argon2id。摘要用恒定时间比较。全局串行限流在昂贵 KDF 前检查，60秒最多5次失败；成功不清空窗口。限流只在当前进程内，重启会清空，属于本机原型约束。

每次登录产生新的随机会话，RAM最多16个、8小时过期；满额时淘汰最早保留的会话。网页只在页面内存持有会话，禁用密码自动补全、立即清空密码输入；不写 localStorage／sessionStorage／cookie／URL。浏览器自身的密码管理器行为不由应用保证。退出使服务端会话失效；刷新或服务重启须重新登录。401清空工作区并提示重新登录，不重发上传／审核等操作；请求期间锁定表单，避免异步详情替换已编辑的理由。

当前只允许精确 IPv4 `127.0.0.1`，不支持 LAN／通配／IPv6绑定。密码传输保密在任何未来 LAN 开放前都要求可信 HTTPS／隧道及单独的入口审查；当前本机 HTTP 不是内网部署方案。

## 旧状态库

新状态为 schemaVersion 2。schema 1 在创建锁文件或恢复业务状态前，以固定 `store.legacy_state` 拒绝，不读取／采纳旧 `credentials.json`，不迁移、不删除、不改原字节。旧库须继续由旧分支运行；有真实数据时另行设计迁移。本轮没有读取或更改旧验收状态／令牌，也没有操作旧浏览器页面。

## 验证与证据

运行命令（浏览器依赖目录使用已存在的 Playwright，不安装）：

```sh
rtk proxy python3 -m unittest discover -s tests -p test_qcu_hub_admin.py -v
rtk proxy env QCU_BROWSER_DEPENDENCIES=/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node --test tests/qcu-hub-admin-browser.test.mjs
```

- Python 3.9：22项通过。保留冻结清单、恶意输入、归档冲突、审核／候选并发、下载、HTTP头、真实崩溃与恢复回归；新增哈希／无默认密码、畸形认证、全局并发限流、整秒重置时间戳重开／登录且业务字节保留、会话容量／过期／退出／重启、全部数据端点匿名拒绝、旧库逐字节保留、真实 PTY 初始化／恢复／拒绝回显降级、锁冲突及恢复不改业务材料。
- 真实 Chromium：1个端到端测试、24个检查点通过；同会话导入、退回修订、清单批准、单独确认候选、精确附件下载、过期上传拒绝且重新登录不重发、退出／刷新／真实服务重启与重新登录、429显示等待重试提示且密码清空、浏览器无存储／cookie，外部请求和意外页面错误均为0。
- 登录与有数据工作区各390／1120px浅深主题，共8张布局截图；另有空队列和候选确认截图。四种工作区布局无横向溢出，技术信息默认折叠；已目视复核截图。
- 原 P10 检查器、公开 Hub、市场目录／包、工作台和其他 worktree 均未修改；以 Git 范围检查确认，本轮不重复运行未改源码的51+8项旧测试。

交付证据已归档至 `$HOME/Artifacts/qcu-harness/0.1.0-hub-submissions.2/validation-20261020/`；源码清单和最终推送提交位于产物根目录。忽略目录 `.work/hub-single-admin/` 仅为复现工作目录。证据包含：`python-tests.log`、`browser-tests.log`、`browser/results.json`、`browser/server.log`、布局PNG及 `verification.json`。测试状态是独立 `/private/tmp/qcu-hub-single-admin-browser-*/state`，仅含合成密码哈希，不纳入交付。浏览器专用时钟夹具仅在 `tests/support/hub-admin-fixture.py`，生产服务没有相应网络／环境变量入口。

初轮沙箱阻止本机绑定，获准隔离测试权限后解决。浏览器曾发现空认证头造成保密断言误报，以及详情异步返回清空提前填写理由的竞态；另在末轮发现测试过早停服截断尚未完成的队列请求，已让登录助手等待请求收尾并增加请求失败记录；未屏蔽网络错误。以上均已修正并通过最终回归。最终无未解决测试失败。测试服务退出、浏览器关闭及旧62598验收服务仍监听的证据见 `verification.json`；没有留下新预览服务。

未测：本人真实密码设置／实际使用验收、真实同事投稿、组织身份、HTTPS／内网运行、真实 Hub 发布／目录关联发行／撤回／教师安装。这些仍属后续阶段；父级已独立复核精确秒时间戳的密码恢复、旧会话失效、仅新密码可用、认证文件不存明文及业务状态不变。实现阶段由 CLI 不提交／推送；父级按既有授权交付开发分支，实际提交以 Git 和 `SOURCE-COMMIT.json` 为准。本轮仍未部署，真实首次设置与本人使用尚待完成。

登录页布局截图捕获了合成登录限流提示的测试状态；不是实际账号被锁定或已经创建真实管理员的证据。
