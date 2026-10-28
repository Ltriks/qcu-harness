# QCU 两平台源码归档与 GitHub 预发布

用户2026-10-28明确授权发布现有Mac rc4.3、Windows rc3-r4原包，补已检查源码和发布索引。仅普通推送独立开发分支及新增标签；不合并／直接推送main、不强推、不覆盖包、不部署Hub或mini。

## 固定版本与来源

以[发布索引](../releases/README.md)和机器可读`releases/catalog.json`为准。Mac源于P16 ef88ee7；Windows由1012167基础独立归档57项原构建文件。标签中的`release/snapshots/`保留从实际不可变ZIP提取的组件源文件，`FILES.json`逐文件绑定整包哈希，发布来源JSON和官方客户端pin同存。标签指向对应源码归档提交，不能把最新main当旧包来源。

已检查并补推历史本地分支 `dev/mac-rc42-package`（67768251）、`dev/rc41-acceptance-fixes`（f0d726fb）；P16辅助Mac交付1339e873的两项补丁已在P16中，可同时保留原分支来源。其他线程活动／旧草稿保留，不批量提交，也不声称全部草稿已发布。

## 本次验证

- MacZIP390492068字节，SHA256 `7fb9278133fa62499765dfbc4f8d62578e05bdcf6d5549eb12d789cdd513421c`；9,774成员含目录、8,421非目录项读取及CRC通过，14符号链接为相对目标；146种子文件摘要通过。
- WindowsZIP401560353字节，SHA256 `6653d40071b70d9f22880a50b16b06bdc64ae2390720fd5930ef08293ca1c2bf`；9,880文件读取及CRC通过，完整文件清单与94项种子摘要通过。
- 非供应商成员及嵌套TGZ的密钥模式、指定私有测试文档标记扫描无命中；只发布现有干净种子，无真实Home、Key、会话、私有反馈或日志。Mac147、Windows138项实际许可文件保留并单列附件，加上QCU与上游MIT原文。
- Windows原源码23项回归通过；Mac基本种子及指南14项、Python准备链路12项、固定参考解释器启动安全诊断5项通过。诊断组最初未提供必需夹具环境而未启动，按原测试约定补齐后5项通过；未修改代码。参考Electron发出既有沙箱task_name_for_pid警告，检查退出0，不作为GUI证据。
- 既有Mac完整构建／原生prepare-only／ASAR冷加载证据沿用P16交付，不能等同新机完整GUI。Windows r4本地磁盘启动为用户确认，任务栏与新机边界仍保留。

可重跑的定向命令：

```sh
rtk proxy node --test tests/teacher-final-contract.test.cjs tests/teacher-suite.test.cjs
rtk proxy python3 -B -m unittest discover -s tests -p test_integrated_macos_prep.py -v
```

诊断测试必须按`docs/qcu-p16-mac-preparation.md`生成标记夹具，设置`QCU_INTEGRATED_TEST_KIT`、`QCU_INTEGRATED_INPUTS=release/integrated-teacher-macos-rc43.json`，并用该配置固定`trustedRuntime.path`、`ELECTRON_RUN_AS_NODE=1`执行`--expose-internals --test tests/teacher-startup-diagnostics.test.cjs`。不能用空环境的失败判断App回归。

## 发布和下载核验

先以独立标签建立draft prerelease，上传白名单附件；核对GitHub返回的文件名、字节及SHA256 digest，再公开为prerelease，不标记latest。原400MB级ZIP不重压缩，正文明确未公证／代码签名和未完成验收。额外自动源码包不是桌面安装包。

本地发布结果、公开URL及服务器附件核验记录归档到各版本`github-release-20261028/`。完整新机GUI、系统信任、真实模型与教师验收仍待执行；本轮无新模型调用、无安装、无环境迁移。正式稳定版另需相应验收和授权。
