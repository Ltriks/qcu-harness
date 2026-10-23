# 专家团本机安装与验收

2026-10-23，按用户“安装到我本机看看”的授权完成。当前安装版本 `qcu-expert-teams@0.1.0-pilot.2`，应用保持打开在“专家团工作室”。

- 本机入口：`$HOME/Applications/QCU助手.app`。使用已验收的 Mac rc.3/r3 教师包，内核 DSH `0.2.0-rc.2`；应用程序原有官方 ASAR 未修改。
- 配置目录：`$HOME/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.3/profiles/desktop`。专家团已注册并通过官方组件开关启用；之前10个依赖声明和 bundle 顺序均保留。
- 固定 TGZ SHA256：`12ee30fdca066a198edd8b36900c9ec050ab2088e2f73026c06c100096045288`，19616字节，10个普通文件。安装后逐文件哈希匹配。
- 教学评审团配置保存在默认工作区 `.qcu-expert-teams/state.json`；四个角色为学科专家、评价设计专家、课堂实施专家及教研主编。主编等待三个评审角色，默认最多同时运行2人。

## 安装失败的原因与处理

官方插件界面的 `pnpm add` 会重新解析教师离线包原有的 QCU 依赖。它们未发布到 npm，国内镜像和官方源分别对 `qcu-team-briefing`、`qcu-reading-outline` 返回404。该失败未修改原有 profile；重复换源不能解决离线组件未发布的问题。

沿用教师 seed 的离线组件布局，校验并复制固定专家团包；使用宿主官方 `readProfileManifest`、`writeProfileBundles`、`withFileLock` 和原子写入接口注册。没有重装或重新解析已有组件，没有新增依赖、安装脚本或凭证读取。此方式是本机离线安装，并不表示在线市场已经支持安装它。

pilot.1 重启后曾因 `connection/reset` 只清除旧预览、不重读工作区而留下空列表。pilot.2 在连接重置后重新读取工作区，废除旧确认，不自动启动或恢复模型调用；同时补充工作区读取失败时的手动重试入口。源码已同步到独立 worktree，未提交、推送或发布。

## 已验证与待验收

核心13项及官方运行时5项测试通过，包含新增的初始查询与连接重置竞争回归。实际安装目录又通过5项官方运行时检查。测试中的模型为合成适配器。

原生界面已验证：官方插件组件运行、左侧专家团入口、已安装技能列表、四角色编辑、保存配置，以及更新后正常退出/重启、重新选择默认工作区并读取保存的修订2。最终运行历史为0，没有点击模型预览或启动，没有真实模型调用。证据见本交付目录 `acceptance.json`、`installed-official.log`、`native-expert-teams.png`。

真实模型输出、教学质量及教师实际使用仍待验收。当前市场白名单、其他机器与远程服务未改变。

## 备份

初始配置备份：`$HOME/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.3/local-plugin-backups/expert-teams-20261023`。

升级前的插件和配置备份：同父目录 `expert-teams-20261023-revision2`。需要暂时停用时可在插件详情关闭专家团组件；离线教师 profile 的在线卸载同样可能重新解析未发布依赖，不应把换源重试视作通用修复。
