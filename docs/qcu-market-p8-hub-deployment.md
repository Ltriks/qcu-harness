# QCU 市场 P8.1 Hub 发布记录

2026-10-13，用户明确授权“发布到现有 Hub，DSH 我来安装验收”。三个已审核的固定包已发布到既有局域网 `http://192.168.1.68:8080`。本轮只切换 Hub 服务；没有操作 DSH 安装、启用、配置、Home、重启或凭据。DSH 实机验收按[用户步骤](qcu-market-p8-user-acceptance.md)执行。

## 安装链接与固定内容

| 包 | 版本与下载 | 字节 | SHA256 |
| --- | --- | ---: | --- |
| QCU市场 | [0.1.0-pilot.8.1](http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.8.1-c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09.tgz) | 36722 | `c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09` |
| 教研简报与工作总结 Skill | [0.1.0-pilot.1](http://192.168.1.68:8080/plugins/qcu-team-briefing-0.1.0-pilot.1-11a6a616c488afbebc0b1781f3e40039c2e49c697cadee0fc095f2e151d6c2bf.tgz) | 18882 | `11a6a616c488afbebc0b1781f3e40039c2e49c697cadee0fc095f2e151d6c2bf` |
| 飞书文档只读插件 | [0.1.0-pilot.1.1](http://192.168.1.68:8080/plugins/qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz) | 11263 | `37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17` |

先在正常默认 DSH 的官方“添加插件”中填写市场固定 TGZ 链接，阅读安装提示并确认；也可先下载 TGZ，再选本地文件。若市场显示未启用，按官方界面启用。正常退出再打开同一 DSH 后，市场应显示6项技能、2项插件。然后在市场详情按需安装教研简报和飞书，安装保持未启用，另一次单组件启用确认明确包含包和组件。不需要运行 `Start-P42-Fresh.command`。精确兼容基线仍为官方 DSH `0.2.0-rc.2`。

飞书提供 `qcu_feishu_outline`、`qcu_feishu_section` 两个工具，没有斜杠技能。各机器须已有可信原生 lark-cli 与本人正常读取授权；启用后在官方插件设置填写本机 CLI 绝对路径和一份授权 Wiki/Docx 基础链接，不含导航参数或锚点。开发机授权不随安装包转移。先列目录，用户选定后再读一个章节；正文进入正常模型会话。未具备本机前提时该项记未测。

## 发布与保留

- 源码交付基线：开发分支 `dev/qcu-market-p8`，`f9a51b4b702f4b2fca55eea62091aa93abebcf6a`。本轮文档更新不重打包或改写既有候选/打包清单。
- Hub 新目录：Hub 用户的 `$HOME/qcu-hub-pilot-20261013-p8.1-c646b4f3f392`。
- 上一目录：`$HOME/qcu-hub-pilot-20261012-p6.3-10babbce683f`，完整保留；更早目录及历史下载也保留。
- 新目录复制13个既有文件的原字节，独立生成 Hub schema1 清单/目录，追加3个包；旧9个包与旧9条记录逐项不变。Hub目录保留12个历史/当前 TGZ；DSH市场自身审核目录为schema4，8个当前真实产品，两者用途不同。
- 服务代码 SHA256 保持 `8153e989daa6422fa5eb99afa02744f248a6c535a1622099287307e698da206e`；Python、端口、绑定和访问边界不变，不添加自动启动或新依赖。
- 切换前核对旧监听PID39355、属主、完整命令、启动时间和清单指纹；仅给该Hub正常SIGTERM并确认退出。启动时准备了旧服务恢复分支，本次未触发回退，没有强退或触及DSH进程。
- 现场观测新Hub PID50273，启动时间`Tue Oct 13 16:17:11 2026`；仅作证据，后续操作前须重新查进程，不能直接复用历史PID。

| 指纹 | SHA256 |
| --- | --- |
| 新 Hub catalog.json | `33b48e419a98a3ffb6b17a70129432d20c246dc914e548167ccbb8668708db14` |
| 新 manifest.json | `4dbea2154ed67a6a96dab88c96e62f9082f9c514a5ef73fc53b0451e7750a9aa` |
| 上一 manifest.json | `75e47e9da7af2b5f8bf24e4a1d0d64388f59471e439e0ab74ab4d6e89defdb00` |
| 上一 catalog.json | `d27894f3b3bd55aa6e9fae95a9d936027efbb466516d1d1ef8aa62127e8e017d` |

## 已通过、失败、未测

| 检查 | 结果 |
| --- | --- |
| 原目录、服务源码、所有新旧包的离线大小/哈希 | 通过；服务校验16条可服务路由，含首页别名 |
| 新服务启动时实际资源下载 | 15/15通过 |
| 独立局域网下载及访问边界 | 20/20通过，0失败：15资源下载/字节/哈希，加5项边界 |
| 边界 | manifest、服务源码、runtime均404；POST405；外部Host403 |
| 旧9包与历史目录 | 保留；新服务中的旧包下载大小/SHA256逐项不变 |
| P8本地源码/HTTP/浏览器及归档回归 | 先前273项与20项通过，详见[父线程检查](qcu-market-p8-parent-validation.md) |
| 本轮DSH安装/启用/官方设置/工具发现/模型与教师质量 | 未测，由用户验收；Hub可下载不代表原生DSH已通过 |

发布阶段没有未解决的失败。发布前两次GitHub只读远端检查遇临时SSL失败，HTTP/1.1重试后确认远端仍为上述源码提交；没有覆盖其他分支。历史本地测试失败及修正保留在父线程检查中。

现场证据位于本机 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/deployment/`：`plan.json`、新旧manifest/catalog、`runtime-p8.json`、`hub-lan-verification.json`和本次操作辅助脚本。所有安装包/截图/测试日志保持原固定位置，不入Git；工作回执保持私有。

## 回退与后续

如需回退Hub，先重新核对当前监听属主、完整命令和新清单指纹，再离线校验保留的P6.3目录及上一manifest固定SHA。经用户指示正常结束已核对的Hub进程，再按原 `--root`、上一manifest pin、`--serve --host 192.168.1.68 --port 8080 --lan-approved` 启动旧服务，并复核旧catalog及下载链接。不要照搬上面的历史PID，不强退、不删除新旧目录。该回退不自动更改已安装的DSH包或profile，也不证明profile数据回退。

等待用户填写[验收清单](qcu-market-p8-user-acceptance.md)，把界面/发现/读取/输出质量分别记为通过、失败、未测，再安排教师小范围试用及反馈驱动的第二批技能。完整新Home首次、真实取消等历史未测项继续保留，不能用本轮Hub发布补造通过。不合并或推送main，不扩大LAN可见范围，不正式公开发布。
