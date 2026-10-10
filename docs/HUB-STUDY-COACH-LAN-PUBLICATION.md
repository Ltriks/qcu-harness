# 学习方法教练固定包：局域网发布

用户 Sentinel_db20c57bad288191ada81242314f2ab9 明确允许将已测试固定包加入 .68 局域网 Hub，更新目录、校验清单及说明，不自动安装。2026-10-10 00:45:01 UTC 完成批准的切换。

用户入口：[城院 Hub 首页](http://192.168.1.68:8080/)，切换到 **插件 Plugin**，选择“学习方法教练（内部试点）”的“下载插件包”。默认 Skill 标签为零条，因为本次 Skill 随插件提供，不是单独 ZIP。

[固定 TGZ 下载](http://192.168.1.68:8080/plugins/qcu-study-coach-0.1.0-pilot.1-76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c.tgz)，`qcu-study-coach@0.1.0-pilot.1`，3331 字节，SHA256：

```text
76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c
```

目录 [catalog.json](http://192.168.1.68:8080/catalog.json) SHA256 为 `bee1c76a3dfa67355b9ddab977da3940d4c878845cbea17854fbf455d541bfbf`。请从这个独立说明核对固定哈希，不能仅信下载文件旁同源字段。新 manifest pin 为 `b32b40409bd2673b6cbf5a21e83333d661afc1c5577ff72d949c165892e42411`；manifest 是操作员文件，不提供 HTTP 路由。

## 安装入口与未验收边界

下载并核验固定哈希后，用户在自己的官方 DSH 0.2.0-rc.2 独立试验会话使用官方 plugin_manager：install_bundle 的 target 是已核验文件的实际本机绝对路径，enabled=true；显示并审阅真实逐次审批，只允许一次，拒绝立即停止。保持 workspace-write+ask，不 approvedBuilds、版本豁免或永久 Full Access。Hub 首页不是 package spec。本次没有执行该安装。

安装后正常 Quit/restart；用真实 list_plugins 获取 qcu-study-coach 的完整 row entryId，确认来源版本后，另一次真实逐次审批 set_plugin(enabled=true)，再正常重启。声明 row id/name 是 qcu-study-coach，但不能猜测完整运行时 entryId。真实 Skill 名为 chengyuan-study-coach，内容为通用任务拆解、一周节奏及错题复盘，不代写作业，不是学校正式标准。详细已准备的有限交接另见本机 STUDY-COACH-NATIVE-HANDOFF-20261009.md。

发布仅证明固定包可被同局域网下载，不证明任何 DSH 已安装或启用、不证明更新回退、模型质量或学习效果。已收到本机调用的用户报告单独保持其原范围；这不是从新 Hub 下载到安装的完整链路证据。主题预览 themes.html 原页面保留；其旧 CLI 示例不作为本包官方安装验收依据，页面也没有一键安装命令。

## 精确改动及备份

新增只有 plugins 下的上述固定 TGZ；替换只有 catalog.json、manifest.json、README.txt。index.html、themes.html、原 test.1 probe 以及已修复服务的字节均保持。服务 SHA256 仍为 `8153e989daa6422fa5eb99afa02744f248a6c535a1622099287307e698da206e`，保留 ThreadingHTTPServer 和实际 5 秒读写超时，未使用旧八文件候选的单线程服务。

备份相对目录 `backup-study-coach-20261010-l3orglrt` 保留原服务、catalog/manifest/README 及登记。再次核验 UID 501、启动时间、完整命令及目录后，正常停止自有旧 Hub，用原 Python、目录和 192.168.1.68:8080 重载内存快照；新 PID 19258，登记已更新。PID 为当次快照，后续操作必须重验身份。原文件 mode 保留，不改网络权限、自启、防火墙、DSH 或其他应用。原 test.1 包 hash 为 `8b8ad2afc154278eb835a48305ce54c01d4ccc733b8f1896f807aa06dd00632e`，仍可下载。

## 实际验收

MacBook 与 Mini 本机分别完成 29 项 HTTP/HEAD 检查（完成时间 00:45:39 与 00:46:27 UTC）：页面 200、目录固定 hash、新旧包 hash、新包归档内真实版本正确；未知/查询/遍历/未固定包名、管理文件、日志与备份 404，foreign Host 403，POST 405、PUT/DELETE 501。两端分别核验空闲和半截请求连接已接受，同时另一个主题页请求仍 200；约 5 秒后停滞连接关闭。

原首页确实 fetch catalog.json。用实际 HTTP 下载的页面和目录，在已有隔离 JSDOM 执行原 JavaScript：插件数量 2、Skill 数量 0，点击插件标签后确实出现学习教练 v0.1.0-pilot.1 卡片和正确 TGZ 下载链接。该 DOM 验证不是原生浏览器 GUI 验收，不声称整个网站交互全部通过。

源码快照在 `hub/release/study-coach-lan.catalog.json`，不带 TGZ 二进制、运行时或凭据。完整脱敏部署、白名单、双端 HTTP 和 DOM 证据见 [发布记录](evidence/study-coach-lan-publication.json)。
