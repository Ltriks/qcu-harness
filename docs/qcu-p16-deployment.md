# QCU P16 部署与验证（2026-10-27）

后续状态：mini官方应用曾升级为0.2.1-rc.3，导致固定0.2.0-rc.2的QCU包被拒绝加载；经用户明确同意，已仅恢复原官方App并验证市场10款工具、7个QCU包无异常，详见[2026-10-27恢复记录](qcu-p16-official-update-recovery.md)。下文保留此前部署检查点。

已按用户确认部署现有局域网 Hub：新版公开接收器、管理员反馈收件箱与维护检查、固定市场16.1和主题2，以及新机 Mac rc4.3候选下载。源码分支 `dev/qcu-teacher-product-polish`，固定 worktree `$HOME/Repos/worktrees/qcu-harness/teacher-product-polish`；服务代码为 `b9263f01d802e2338951d52a32c664870a888890`，组件仍为先前审阅的固定归档，未重新构建。

mini 默认 DSH 已由用户确认升级市场15.1→16.1，24个安装文件与固定归档逐一匹配；正常退出后普通重开，界面16.1、升级回执verified、包及组件启用状态保留，并成功验签刷新10款工具。主题0.2.6-pilot.2已由用户确认安装，6个文件与固定归档匹配，用户随后确认启用，侧栏和教学首页即时加载，基础真实界面检查及启用后正常重启持久性通过。**原生DSH反馈提交和教师真实任务仍未验收**。已有电脑保持原App、默认Home、Key和资料，走官方组件更新；不安装新机整包覆盖旧环境。课程工作台与专家团的源码、业务测试和固定归档本轮保持原样，不做新业务验收。

## 访问与安装

- 教师 Hub：[局域网首页](http://192.168.1.68:8080/)。现有首页和主题原始47,422字节完全保留，不覆盖其他线程的网页工作；新机候选目前使用下列直达下载链接。
- 管理员：[mini 本机管理页](http://127.0.0.1:8975/)，原账号 `qcu-admin` 和原密码不变。管理员仍只绑定mini回环；该地址不能从其他老师电脑直接访问mini。服务重启使旧会话结束，用户已自行重新登录，画面可见“维护检查”和下方“反馈收件箱”；它对应客户端“问题反馈”，不是同名标签。不要重新运行初始化器。
- 已装市场的mini：版本管理→检查全部更新→核对市场16.1→下载并查看确认→用户确认升级→按提示正常退出并普通重开原DSH→再检查上次升级结果。保留启用状态，遇来源待核对、兼容性豁免或额外脚本授权即停，不卸载重装。
- [新机使用指南](http://192.168.1.68:8080/downloads/qcu-assistant-guide-0.1.0-rc.4.3.html)。Mac候选采用临时签名，未经Developer ID签名或公证，其他新电脑的系统信任与首次GUI仍未测。Windows本轮不重建。

| 资源 | 字节 | SHA256 |
| --- | ---: | --- |
| [市场0.1.0-pilot.16.1](http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.16.1-edcacdc3f9de83f08f2dca21f3f1f54e60161e314a58529ced819bc2ee4a3c69.tgz) | 86,390 | `edcacdc3f9de83f08f2dca21f3f1f54e60161e314a58529ced819bc2ee4a3c69` |
| [主题0.2.6-pilot.2](http://192.168.1.68:8080/downloads/qcu-branding-0.2.6-pilot.2-b57d69aeb6516a5650962a4afd5e1b28320c0b9c8dabc5c0e5b02dfe9fa40f2e.tgz) | 16,657 | `b57d69aeb6516a5650962a4afd5e1b28320c0b9c8dabc5c0e5b02dfe9fa40f2e` |
| [Mac新机rc4.3 ZIP](http://192.168.1.68:8080/downloads/qcu-teacher-0.1.0-rc.4.3-mac-arm64-7fb9278133fa.zip) | 390,492,068 | `7fb9278133fa62499765dfbc4f8d62578e05bdcf6d5549eb12d789cdd513421c` |
| [静态指南](http://192.168.1.68:8080/downloads/qcu-assistant-guide-0.1.0-rc.4.3.html) | 39,200 | `e0bee5a1b8aae3c10c77e1e0c1bb813a7f865eaab13bd88ce8b5733fa4bde0f5` |

市场升级包含紧凑工具列表、手动新手指引、反馈预览确认与回执查询；主题包含紧凑首页、首次任务与帮助入口。模型设置和任务发送仍需用户自己确认，安装不调用模型。

## 已验证与未测

已通过：下载适配13项、原公开只读10项和反馈8项定向回归，共31项；含34,668,544字节真实HTTP响应及不超过64KiB流式读取验证。组件先前193项与浏览器7组／108布局／35截图证据沿用其原口径，不与31项累计为独立总数。

mini预检核对51个最小服务文件及三份分发资源，影子回环服务的HEAD／Range和私有路径拒绝通过后已关闭。真实LAN完整下载指南、主题和390,492,068字节MacZIP并逐一SHA256匹配；ZIP传输11.645秒。旧首页字节一致，原23个静态TGZ保留，新市场增加后为24个。五条私有路径404、空反馈400、其他写请求405。公开与管理服务分别只绑定原LAN8080及回环8975，未加自启动或新权限。

实际HTTP固定公钥审计通过目录revision4和更新revision3的签名、时效、归档完整性；`/updates-v2.json` 404为支持的旧源回退。审计整体仍为 `ok:false / coverage.gaps`：专家团目录3未纳入更新源、课程目录1.3高于更新源1.2，两项为原有覆盖发现，本次不修改同事模块或自动放行。

原生市场升级通过：默认profile安装24个文件、正常退出后新主进程和Host、升级结果verified及启用状态保留、更新修订3／目录修订4水位和真实界面10款工具均核对。主题安装6个文件匹配并已启用；普通／大字模式在首页、侧栏、教学工具和市场可见同步变化，深色主题渲染通过，随后恢复普通字号与跟随系统。官方数字字号输入的远程键盘操作未可靠生效，不记为该控件验收通过；改用首页普通／大字按钮完成可观察验证。首次任务第1→2→1步、稍后继续返回首页和服务繁忙帮助展开通过；没有打开对话草稿、发送任务或标记首次任务完成。反馈表单已只读打开。主题启用后再次经应用菜单正常退出，确认进程结束，再从应用程序入口普通重开；新主进程24495，主题、教学首页、14px普通字号及跟随系统保持，默认DSH留在教学首页。指引完整流程与重启恢复仍待测。

经用户明确同意，仅在生产反馈箱新增一条“QCU P16 部署连通性测试（合成，无需教师处理）”。代理从公开HTTP提交，实际mini Safari管理员收件箱标记已处理，再从公开状态接口核对resolved；未新增第二条、未删除记录。该结果只证明生产后台通路，**不代表原生DSH预览确认或教师反馈已通过**。远程粘贴曾留下单字母说明，后经真实管理员界面更正并核对公开回执resolved／revision3及完整说明匹配；查询凭据仅留私有本地文件，不进入交付。原先自动审批拒绝已由上述明确单条授权解决。

待测：官方数字字号输入控件、精确窄面板原生矩阵、原生首次任务完整流程／重启恢复、原生反馈确认提交与重开查询、其他新机器GUI／系统信任、真实模型及教师效果。本轮没有模型调用或读取Key。

## 签名续期与数据保护

目录以既有审核发布机制对同一已批准记录作绑定预览／确认续期，10项产品元数据逐项一致；不改课程版本、用途或归档。目录revision4指纹 `623aa920b312bd09f7bdbe7a3cdbb92f0ef4d2a87ed859ac022991517f32c7f8`，有效至北京时间 **2026-11-03 14:03:39**。更新revision3保留原22条发行记录并仅增加市场16.1，指纹 `fe8b47fb2ea8fa97cf791e72aee6b3661c91f491302fd16c81c57757e3e3a1b7`，有效至 **2026-11-03 13:51:42**。应在较早期限前单独复核更高修订续期；没有自动续签。两域保留原公钥，不复制或导出私钥。

停旧管理员后，账号与发布目录在mini私有0700目录完整备份并逐字节核对；账号没有重建。独立反馈根目录0700、文件0600，不与账号、签名、公开包或教师Home混用。原P4.2测试Home保持原位，本次不使用或迁移它。私有发布意图、账号、密钥和反馈查询凭据不进入交付产物或Git。

## 服务位置与恢复

以下均为mini路径。PID19149（公开）和19145（管理）只是本次部署证据，维护前重查，不能按历史PID盲目停止。

| 路径 | 用途 |
| --- | --- |
| `/Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/` | 固定服务代码、公钥与既有可信Node启动器 |
| `/Users/lqtriks/Services/qcu-hub-p16/snapshots/static-p16.1-edcacdc3f9de/` | 原主页／旧包与新增市场16.1；manifest `08dbf1b0ae11a1c2f769aff7a5f23203524b7a71ff47f0a646a2813f7dd12584` |
| `/Users/lqtriks/Services/qcu-hub-p16/distribution/rc4.3-7fb9278133fa/` | MacZIP／主题／指南；manifest `30f1661b0fb8f8c2f69f73d44a315809b5c6e87797481cf04df541379f6bd05d` |
| `/Users/lqtriks/Library/Application Support/qcu-hub-feedback/` | 独立私有反馈数据 |
| `/Users/lqtriks/Library/Application Support/qcu-hub-admin/` | 原有账号、审核与签名状态，原位保留 |
| `/Users/lqtriks/qcu-hub-market-publication/` | 原动态公开指针、签名目录及归档，原位保留 |
| `/Users/lqtriks/Library/Application Support/qcu-hub-backups/p16-20261027-938ccef/` | mini私有账号／发布备份，不下载或公开 |
| `/Users/lqtriks/Services/qcu-hub-p16/run-20261027/` | 当前服务PID、启动记录、日志与部署预检 |

没有增加LaunchAgent或定时任务。机器重启后由维护者先核对8080和8975没有现有服务，再分别以前台方式恢复（长路径已正确引用）：

```sh
/usr/bin/python3 -B /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/hub/admin/server.py --state-root '/Users/lqtriks/Library/Application Support/qcu-hub-admin' --publication-root /Users/lqtriks/qcu-hub-market-publication --public-trust /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/public-trust.json --node /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/node-official --port 8975 --feedback-root '/Users/lqtriks/Library/Application Support/qcu-hub-feedback' --maintenance-root /Users/lqtriks/Services/qcu-hub-p16/snapshots/static-p16.1-edcacdc3f9de
```

```sh
/usr/bin/python3 -B /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/hub/release/serve-hub.py --root /Users/lqtriks/Services/qcu-hub-p16/snapshots/static-p16.1-edcacdc3f9de --manifest-sha256 08dbf1b0ae11a1c2f769aff7a5f23203524b7a71ff47f0a646a2813f7dd12584 --serve --host 192.168.1.68 --port 8080 --lan-approved --publication-root /Users/lqtriks/qcu-hub-market-publication --public-trust /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/public-trust.json --node /Users/lqtriks/Services/qcu-hub-p16/releases/p16.1-b9263f0-34a48e474a03/node-official --feedback-root '/Users/lqtriks/Library/Application Support/qcu-hub-feedback' --distribution-root /Users/lqtriks/Services/qcu-hub-p16/distribution/rc4.3-7fb9278133fa --distribution-manifest-sha256 30f1661b0fb8f8c2f69f73d44a315809b5c6e87797481cf04df541379f6bd05d
```

运行期间保持清单文件静止，不原地写入。大包使用单独的固定manifest流式白名单下载，原快照32MiB／64MiB限制不变，见[适配边界](qcu-p16-distribution.md)。

恢复旧服务时先核验PID、监听及代码路径，正常停止本轮服务；原公开代码为 `qcu-hub-p15/releases/p15.1-7f45b376375c`，原管理代码为 `qcu-hub-p15/releases/p15.1-quality-20261026-845a908`，原静态根为 `/Users/lqtriks/qcu-hub-pilot-20261023-publication-15.1-6b17dc4a1671`，原manifest `3c750c7b84e18f06904663d83a6266171e4d186d4a1f7fe9e2146d537fa4d906`。用原代码和静态根、现有账号及发布根恢复8080／8975；停用新反馈／大包适配则这些新功能暂不可用。**保留已发目录revision4及客户端水位**，不把指针回退revision3，不覆盖包、不重置账号或Home。需要更改目录应走新的更高修订审批。

安全JSON证据、11张裁去无关桌面的真实界面截图与本说明归档在Book `$HOME/Artifacts/qcu-harness/0.1.0-pilot.16.1/deployment-20261027/`；原组件和MacZIP保持不可变。[组件交付](qcu-p16-delivery.md)、[父级审查](qcu-p16-parent-review.md)、[Mac固定输入](qcu-p16-mac-preparation.md)保留分阶段证据。
