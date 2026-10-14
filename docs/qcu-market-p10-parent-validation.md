# P10 离线维护工具：父线程交付检查

2026-10-14，用户授权启动P10，在P9 mini验收期间继续独立推进。P10交付为Python3.9+标准库检查器、合成完整/拒绝交付示例、管理员维护说明与便携ZIP；**不是DSH插件或新的市场TGZ**。教师继续使用市场9.1，未更新Hub、官方应用、审核目录、Host/Client或任何已发布包。

## 实现与使用

检查器读取一份本地schema1 submission，核对qcu身份、版本、源码修订声明、最终TGZ大小/SHA256、有限USTAR结构、成员清单、package.json/exports/files/JSON形式patch、默认停用行、依赖与脚本声明、材料和证据状态。禁止包执行/提取、远程引用、路径逃逸、符号链接、超限与当前不支持的原生格式；高置信秘密模式检查包括正文、提交材料、USTAR各字段和gzip头/压缩字节。输出固定脱敏错误与复核项，不回显正文、命中值、脚本或绝对路径。

不带report参数仅输出JSON；显式report只创建输入树外的新文件，已有文件拒绝，发布为完整文件且创建/清理失败返回脱敏错误。静态通过仍保留 `approval: required`；未测/缺失原生证据列人审，failed证据阻止静态通过。不会从declared passed证明来源真实性或教学质量。

具体用法与限制见[检查器说明](qcu-market-p10-submission-check.md)、[维护指南](qcu-market-p10-maintainer-guide.md)和[交付模板](../templates/qcu-submission/README.md)。不要求安装rtk；它是开发机约定，不是工具依赖。便携ZIP解压后可由mini的Cursor运行标准库自测与合成示例，不需打开或安装DSH。

## 独立验证

| 检查 | 通过/失败/未测 |
| --- | --- |
| Python3.9.6完整新测试 | 51/51通过，0失败/跳过 |
| Python3.11.15完整新测试 | 同一51项全部通过，0失败/跳过；不把它们算成102个不同测试 |
| 两版编译 | 三个可信Python文件通过，不写工作树字节码 |
| 原八产品与P9市场：9个固定包 | 两版各9/9通过，大小/哈希与原归档不变；使用合成交付元数据，未执行或重新打包实际产品 |
| 独立边界探针 | 空README、空包LICENSE被拒绝；空权限说明明确复核；USTAR和gzip头合成token被拒绝，5/5符合预期 |
| 输出失败契约 | API/真实main/临时文件消失回归通过：不可创建报告临时文件、清理失败均不冒出原始traceback，不覆盖输入或已有报告 |
| 原tracked文件保护 | 除本轮README导航外，基线479个已跟踪文件内容逐个git原始hash一致；P9用户已填写验收表保持原样 |
| 文档 | 最终新增/更新链接核对；最终清单与父级操作证据留在版本产物目录 |
| 本轮mini运行P10工具、其他平台或格式 | 未测；3.9解释器本地通过不等于mini实测；普通YAML/PAX/GNU等仍不支持 |
| 本轮P9全套295+21回归 | 未重复；DSH业务源码与固定包不变，历史结果仅作背景 |

原始父级验证时间与命令见开发机 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/parent-final-checks/`：各解释器tests/command/compile日志、SUMMARY；九归档报告分别在 `parent-real-archive-checks-final-py39/` 与 `parent-real-archive-checks-final-py311/`。便携ZIP、文件SHA256、源码提交与独立解压自测以该版本 `DELIVERED.json` 为准。日志和原始材料不入Git。

## 失败与修正历史

初期fixture使用macOS符号链接临时目录导致被路径规则拒绝，改为真实 `/private/tmp`，没有放宽规则。父级九归档检查发现真实简报的WRAPPER-LICENSE被误拒，精确增加该文本basename并保留bounds/manifest/files检查。归档头合成token最初漏检，整块USTAR扫描又因相邻字段单词边界漏掉uname开头，改为逐字段扫描并补gzip元数据/压缩字节检查。报告临时文件创建失败时曾清理未创建路径，导致FileNotFoundError，已只清理实际创建的临时文件并确保错误脱敏与目录fd关闭。

上述缺陷都已修正并有实际回归。原40/45/48项中间记录、初交接、修正日志和首次9归档WRAPPER拒绝结果保留；当前交付以父级终检的51项和最终两版9归档为准，不覆写初期资料。CLI中途模型连接/模型清单刷新多次超时导致延迟，恢复后在同一CLI线程继续；未绕过沙箱、扩权或改模型/权限配置。私有回执一次自动审批超时，按允许的一次重试已持久化，不影响原验收材料。

## P9用户回执与仍未解决的问题

已收到用户mini验收归档并核对固定包，见[回执复核](qcu-market-p9-mini-acceptance-review.md)。用户报告核心流程、三项Skill模型响应和教师审核通过；父级直接看过指引/脱敏/简报响应截图。I01的旧file6.3→HTTP9.1官方安装报 `ERR_PNPM_MISSING_TARBALL_INTEGRITY` 仍未解决，根因未独立复现。同字节本地TGZ官方安装成功，不能因此抹掉URL失败，也不能把全部Hub URL或包本身判坏。网络、真实注入、精确窄宽、重载清除和部分截图证据仍待补。

未读凭据、改锁文件、卸载重装、重建Home、强退或重新操作mini。原始报告/ZIP/截图保存在P9私有产物目录，不在工具ZIP或Git中。P10不修复官方安装器，也不会自动撤回/升级已安装客户端。

## 交付与后续

源码独占worktree `$HOME/Repos/worktrees/qcu-harness/market-maintenance`，分支 `dev/qcu-market-p10`，基线 `37b2b8ebeed6ba4e5eb75db8e2c7fbce3e42673f`。经父审查后只提交推送相关工具、测试、模板和文档；main不合并/提交/推送，其他worktree用户填写内容不提交。

P10本地维护工具开发验收完成；mini便携工具自测由用户/Cursor选择执行。下一步同事按schema1准备真实候选交付，先静态检查再人工源码/许可/权限审阅，原生与业务分别验收后才讨论发布。Teacher小范围试用需用户安排，说明P9URL升级已知问题，保留本地固定文件方式；不自动邀请、发送反馈、扩大Hub或部署新候选。
