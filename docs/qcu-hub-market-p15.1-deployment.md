# QCU 市场 P15.1 部署与验收记录

2026-10-23。开发分支 `dev/qcu-hub-market-publication`，worktree `$HOME/Repos/worktrees/qcu-harness/hub-market-publication`。已按用户授权部署既有局域网 Hub，并在 mini 默认 DSH 完成市场 **14.1 → 15.1** 自升级与正常重启核对。官方 DSH 仍为 **0.2.0-rc.2**，源码未修改。

## 当前入口

- 教师 Hub：<http://192.168.1.68:8080/>。
- 管理员：在 **mini 本机浏览器**打开 <http://127.0.0.1:8975/>，账号 `qcu-admin`。用户已自行设置密码并确认登录成功、可见审核和发布页面；密码不进入聊天、源码或产物。
- MacBook 如需管理，通过既有 SSH 建立仅回环隧道：`ssh -N -L 127.0.0.1:8975:127.0.0.1:8975 macmini`，然后访问上述回环地址。不要把管理员改绑到局域网。该地址中的 `127.0.0.1` 指运行浏览器的本机；其他教师电脑不能直接借此访问 mini。
- DSH：进入 QCU市场，版本管理显示 `0.1.0-pilot.15.1`；主动刷新后显示 **9 款真实教师工具（7 项 Skill、2 项业务插件）**。浏览和刷新不安装，初次安装保持未启用，启用仍单独确认。

## 固定安装包

[QCU 市场 P15.1 TGZ](http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.15.1-6b17dc4a16718ffd39f1c7381f6bde52d78599874f0e06249bad444090705c49.tgz)，**72,976 字节**。

SHA256：`6b17dc4a16718ffd39f1c7381f6bde52d78599874f0e06249bad444090705c49`。

包内 21 个成员与审核源码、安装后文件逐一相同。固定公钥 ID 为 `2bda63cbcde1bd5bfc978b89cd3530602e7ebc2f357de739957e744a16053f5f`；私钥仅在 mini 独立私有管理员目录生成，不导出。P14 更新清单继续使用原有独立公钥及固定十产品策略，两套信任不混用。新增动态产品可按签名目录首次安装；未纳入固定更新策略的产品升级仍在官方页面单独处理。

P15.0 与本次早期未固定公钥的 P15.1 均为本地候选，不能作为当前安装地址。打包 MANIFEST 是离线构建记录，其 `productionReady:false` 不等同现场验收结论；在线状态以部署、下载和原生核验回执为准。不改写旧归档或历史候选来补造证据。

## 部署位置与保留范围

下列 `$HOME` 均指 mini 的登录用户目录：

| 位置 | 用途 |
| --- | --- |
| `$HOME/Services/qcu-hub-p15/releases/p15.1-7f45b376375c/` | 固定最小管理/公开服务代码、公钥、受信任 Node 启动器与已审阅迁移种子 |
| `$HOME/qcu-hub-pilot-20261023-publication-15.1-6b17dc4a1671/` | 新静态 Hub 快照，29 项 manifest 文件、23 个不可变 TGZ |
| `$HOME/qcu-hub-market-publication/` | 独立签名快照、归档和原子公开指针 |
| `$HOME/Library/Application Support/qcu-hub-admin/` | 私有账号、投稿/审核状态、审计和签名目录；不公开托管或提交 Git |
| `$HOME/Services/qcu-hub-p15/run-20261023/` | 本次服务启动记录与本机日志 |
| `$HOME/qcu-hub-pilot-20261019-updates-14.1-afd2ada38d70/` | 原快照完整保留，未覆盖；旧服务已正常退出 |

新静态 manifest SHA256：`3c750c7b84e18f06904663d83a6266171e4d186d4a1f7fe9e2146d537fa4d906`。旧 22 包和首页字节全部保留；23 个 TGZ 包含历史版本和旧探针，并不代表 23 个教师产品。迁移独立对照原 manifest、实际发布包、原 P14.1 审核元数据，预览摘要 `43e633c9cd18cfa5e9d6824de46786b3305f2083839bfeef8f09e7c72c53b9ca`，确认后才发布 9 项教师目录。

公开服务现场 PID32124（10:43:32 启动），管理员 PID32192（10:44:03 启动）；PID 是历史证据，维护前须重查。管理员仅绑定 `127.0.0.1:8975`，未增加自启动或权限。服务器重启后的手动恢复命令见下节；不要重新运行初始化器来恢复已有账号。

## 启动与维护

本轮沿用既有 Python 和官方 DSH 内置 Node 24.18.1，没有安装新运行时。在 mini 使用以下既有代码与目录恢复服务；只在确认对应服务已退出后运行。命令以前台方式运行，不要求强退应用或重置状态：

```sh
QCU_CODE_ROOT="$HOME/Services/qcu-hub-p15/releases/p15.1-7f45b376375c"
/usr/bin/python3 -B "$QCU_CODE_ROOT/hub/admin/server.py" --state-root "$HOME/Library/Application Support/qcu-hub-admin" --publication-root "$HOME/qcu-hub-market-publication" --public-trust "$QCU_CODE_ROOT/public-trust.json" --node "$QCU_CODE_ROOT/node-official" --port 8975
```

公开服务独立运行：

```sh
QCU_CODE_ROOT="$HOME/Services/qcu-hub-p15/releases/p15.1-7f45b376375c"
/usr/bin/python3 -B "$QCU_CODE_ROOT/hub/release/serve-hub.py" --root "$HOME/qcu-hub-pilot-20261023-publication-15.1-6b17dc4a1671" --manifest-sha256 3c750c7b84e18f06904663d83a6266171e4d186d4a1f7fe9e2146d537fa4d906 --serve --host 192.168.1.68 --port 8080 --lan-approved --publication-root "$HOME/qcu-hub-market-publication" --public-trust "$QCU_CODE_ROOT/public-trust.json" --node "$QCU_CODE_ROOT/node-official"
```

签名教师目录当前修订 **1**，指纹 `a48c860fb3e4dabad9d39aecafe2644bd5302c51181483dd5bb108edc82472a5`，有效至 **2026-10-30T10:44:03.071000+08:00**。独立 `/updates.json` 当前修订 **2**、十产品共 22 项发行记录，有效至 **2026-10-30 10:05:46 +08:00**。续期必须使用更高修订并单独复核，不删除客户端水位、不覆盖旧包；当前没有自动续签。原更新发布私钥仍只在原发布机，不传到 mini。维护工具 `scripts/publish-market-updates.mjs` 仅离线签名，不部署或安装。

## 已通过

- P14/P15 集成的 315 项本地检查，真实共享 React + 官方 rc2 Gateway 的浅/深色、390/1120 宽度渲染；21 张截图。安装业务效果为明确标注的隔离模拟，不冒充真机。
- 密码输入提示和启动回执未就绪保护的 20 项相关复核；另在 mini 隔离终端验证不合规则/两次不一致可安全重输、合成输入不回显。用户随后实际完成账号初始化。
- 最终固定包 21 成员一致；最终包启动保护和两条官方通信接口的 2 项针对性复核。
- 固定公钥后的 127 项针对性回归通过：离线单元 98、官方 Host 7、隔离签名目录 6、固定安装包 HTTP 16。使用合成临时状态与回环服务，未访问真实 Home 缓存、profile、凭据或局域网；与前述检查有重叠，不累计为独立总数。测试夹具修复未改变业务源码、信任公钥、版本或固定包。
- MacBook 真实局域网获取 27 项公开资源，23 包大小/SHA256 全部匹配；两套固定公钥签名均通过，旧首页相同。mini 官方内置 Node 读取两份清单均返回200。
- 正常停止旧 Hub、切换新服务、9 项目录迁移及公开下载复核。管理员未认证 API401，私有资源404，公开写请求405。
- 用户通过原 P14.1 版本管理确认自升级，21 个已安装文件与固定包一致。用户正常退出/普通重开，旧 PID66207/66218 已结束；新主进程33268、Host33276，沿用默认 profile。升级回执为 `14.1 → 15.1 / verified`，包/组件仍启用，回执核验原配置和启用状态；实际签名目录水位为修订1及上述指纹。
- 用户确认界面版本15.1、刷新后可见9款工具；确认管理员登录及审核/发布页面可见。默认 DSH 保持打开，P4.2 测试 Home 未使用或移动。本轮没有模型调用。

## 失败、恢复与未测

- 首次真实密码输入两次只显示 `startup.refused`，未创建状态；具体输入内容与原因未读取。已修复为固定规则说明和重输，用户重新设置成功。
- Node 在 MacBook 直接 LAN 请求曾返回 `EHOSTUNREACH`；同机系统 curl/Python 均200，已用 Python 完成全部下载校验，mini 官方 Node 直连通过。不据此认定 Hub 不通。
- 电脑界面工具连接失败，重置后仍不可用；本次原生界面与登录来自用户回报，结合进程、安装文件、升级回执和签名水位核验，**没有新原生截图**。
- 本次未上传真实同事 handoff、在真实管理员页面批准/发布新产品，也未做真实撤回/恢复；这些仍须按下面验收步骤执行。已有真实迁移不是 Web 新投稿发布的替代证据。
- 新机器首次安装、P4.2 独立 Home 的剩余项目、教师效果、模型生成、Office 导出等不在本轮通过范围。

## 下一次真实投稿验收

1. 在 mini 登录管理员，导入同事交付的真实完整 handoff（含 `submission.json`、固定 TGZ、独立成员清单、来源、许可、规格、构建与真实分阶段证据）。不要将合成模板上架为教师产品。
2. 核对静态报告与权限/来源/版本；填写准确用途、场景、前置条件、示例与证据边界。材料或市场说明变化必须重新审核。
3. 人工批准后，分别预览并确认“生成候选”和“发布”。上传、批准、生成候选均不等于发布；“公开下载复核通过”才记为线上通过。
4. 在 DSH 市场点“刷新市场”，确认新增真实条目。只浏览/刷新不得开始安装，固定包大小和SHA256应对应已批版本。
5. 详情页先取消一次安装确认，确认没有安装；再确认安装，保持未启用；随后独立确认启用，检查唯一组件加载和实际技能/工具发现。
6. 需要时另行确认撤回，刷新后停止新安装；恢复应产生更高目录修订，不改旧包、不自动卸载。实际调用或模型费用另行确认。

完整验收勾选表见 [P15 人工验收单](qcu-hub-market-publication-acceptance.md)。相关源码/契约见 [P15 实现与维护说明](qcu-hub-market-publication.md)、[P15.1 集成记录](qcu-market-p15.1-integration.md)。产物固定在 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.15.1/`；关键 JSON 为 `deployment-20261023/HUB-DEPLOYMENT.json`、`MACBOOK-LAN-VERIFICATION.json`、`NATIVE-MARKET-VERIFICATION.json`，不含账号/签名私钥状态。
