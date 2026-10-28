# Hub 在线目录 503 修复记录

2026年10月28日，在线目录`/market/catalog.signed.json`已恢复200，保留原修订4及10款工具，更新源仍为修订3。公开服务和管理员登录页正常，固定包下载正常。仅变更服务启动参数的Node路径，未修改业务代码、发布指针、公钥、安装包、账号或DSH个人环境。

## 原因

旧`node-official`只有138字节，设置`ELECTRON_RUN_AS_NODE=1`并调用`/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness`。现场该路径已不存在，应用目录中有`QCU助手.app`，不能据此确定原路径何时或由谁移除。旧运行器退出126并报告No such file or directory。

每次读取动态目录，`PublicationReader`都会调用该运行器验签。进程不能启动，读取器抛出`publication.signature`，公开HTTP处理器按原设计返回503。目录文件27995字节及SHA256与原指针一致；用独立Node验证原签名和时效通过。因此本次不是目录损坏、过期或模型额度问题，也不能从通用503错误页推断为服务器高负载。

## 实施修复

从mini已有QCU助手内找到独立Node，121418800字节，SHA256`1e1fdfc3001a87bc602f66c94d126a4b5ee4569d420643a0580250d9b629b9e7`，与已发布Mac rc4.3 ZIP内同名成员完全一致。严格代码签名验证通过，版本24.21.0/arm64，动态依赖均为系统库。未下载新版本，不把Node版本当DSH兼容版本。

将原字节及许可证复制至独立固定路径：

```text
/Users/lqtriks/Services/qcu-hub-p16/runtimes/node-v24.21.0-darwin-arm64-1e1fdfc3001a/node
```

该目录不在桌面App内部；以后移动或替换桌面App不再改变这项服务依赖。原`node-official`和原服务代码保留。先用固定Node直接核对原签名、拒绝篡改签名，再在临时回环HTTP服务核对目录和10项包，随后关闭影子服务。

核对旧监听PID及命令归属后，以SIGTERM正常停止原公开19149和管理19145，分别用原参数与新`--node`路径启动。新公开11715、管理11733仅为本次证据，维护时必须重查。监听仍为192.168.1.68:8080与127.0.0.1:8975，没有新服务端口、自启动或权限扩大。管理员旧会话可能需重登，原账号与密码保持；本轮没有登录或创建账号。

## 当前运维位置

- 服务代码仍为`/Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/`。
- 当前启动参数、PID及日志在`/Users/lqtriks/Services/qcu-hub-p16/run-20261028-runtime-repair/`；`START.json`记录完整参数，`CUTOVER.json`记录切换核验。
- Node目录内`MANIFEST.json`记录版本、来源、字节与SHA256，`PREFLIGHT.json`记录影子验证。
- 原静态目录、动态发布根、分发根、反馈根和管理员数据根均保留原位。正常恢复命令见[P16部署记录](qcu-p16-deployment.md)，其中Node参数已更新，不再使用失效桌面App路径。
- 无自动重启或自动续签。清单较早期限仍为北京时间2026年11月3日13:51:42，应在此之前另行复核续期；本次不重签或改变修订水位。

## 验证与边界

已通过：目录、首页和更新源从MacBook访问均200；实际下载25项去重固定包并核对字节/SHA256，随后使用源码固定生产公钥验证实际下载的目录及更新源。原目录修订4/10产品，更新修订3/23条记录；签名和时效有效。Mac390492068字节固定整包HEAD200、Range206；5条私有路径404；管理员未登录API401。原目录和公钥摘要不变，原包没有重建或覆盖。

MacBook缓存Node直连LAN返回EHOSTUNREACH，所以第一次HTTP审计未完成；改由已可达的Python下载原HTTP字节，再运行原公钥审计器，本地审计的`http:not-checked`表示其输入为下载快照，不能单独用它代表网络验收，网络证据由PUBLIC-DOWNLOADS和HTTP-CHECK提供。一次辅助脚本误将更新JSON payload按Base64处理后失败；按原协议修正后25包及签名均通过，失败记录保留。

整体公钥审计仍退出2，唯一失败项为原有`coverage.gaps`：专家团目录版本未纳入更新源，课程目录版本高于更新源。与P16原记录一致，本次未替同事发布新模块或放宽检查。`updates-v2.json`缺失按既有旧源回退处理。不能将本次结果概括为所有审计项全绿。

未测：DSH原生页面重新刷新、管理员本人重新登录及业务发布、真实模型与教师任务。本轮没有新反馈、账号操作、模型调用、桌面安装或Home改动。

安全证据在Book`$HOME/Artifacts/qcu-harness/0.1.0-pilot.16.1/runtime-repair-20261028/`，包括RESULT、RUNTIME-MANIFEST、PREFLIGHT、CUTOVER、HTTP-CHECK和公开快照审计/下载记录。修复只针对本次503；如果后续独立运行时损坏，应保留现有指针与原包，按manifest核对同版本字节后恢复，不绕过签名、不回退发布修订、不重置账号。
