# P9锁完整性问题：缓存机制复现（2026-10-15）

本记录接续[原日志诊断](qcu-market-p9-url-diagnosis-20261015.md)。**已用mini未改动的官方随附pnpm11.7.0，复现“目标HTTP包已在缓存中，切换来源升级后生成缺integrity锁，后续安装失败”的完整合成链路。未在真实Home重放原事务，不能把它写成原现场因果链已全部独立证明；也没有修复或替换官方包管理器。**

## 已解决的实验前置

先前的40秒/20秒超时来自隔离脚本参数传法，不应归到Hub、Electron或QCU包损坏。脚本把已知选项写作`--config.fetch-timeout=10000`/`--config.fetch-retries=0`，下载器收到字符串值；跟踪显示HEAD已完成、store读取已返回，随后进入GET下载器前停顿。代码中`AbortSignal.timeout(timeout)`要求数值，位于异步重试回调的try之外。改用正式类型化选项`--fetch-timeout=10000 --fetch-retries=0`，未改任何pnpm代码，随后的矩阵全部跑完。两项选项一并改正，未另做逐个参数的独立A/B。

曾用相同pnpm文件在开发机标准Node25.8.1对照，仍有相同超时，排除“只有Electron worker坏了”的猜测；普通worker通信、本地tarball安装均通过。诊断副本只在开发机产物中增加日志，最终机制复现使用mini原始未修改文件。mini Electron明确禁用NODE_OPTIONS，该诊断预加载未生效；没有改fuse、替换应用或尝试绕过限制。早期失败、断言错误和诊断副本均留作历史证据。

## 精确环境与最终结果

官方DSH版本0.2.0-rc.2，随附Node模式v24.18.1，pnpm11.7.0；pnpm分发文件SHA256 `d3a7f4bde2f32c5acc5f012d1edc24c24ea247c2f6c8823146f8cd69ed70b22f`。包只含虚构`qcu-url-probe`的package.json，无依赖、脚本或DSH patch。HTTP服务仅127.0.0.1，最终使用与现Hub同类的HTTP/1.0、固定Content-Length、octet-stream和immutable缓存头。空npm用户/全局配置、独立store/cache，不读取真实配置。

最终12条实验断言满足：10次退出0、2次预期退出1。**断言满足是复现成立，绝不是pnpm缺陷或P9升级已经修好。**其中退出0但写出坏锁是实际发现的缺陷行为。

| 条件/动作 | 退出码 | 生成锁/后续结果 |
| --- | --- | --- |
| 新项目下载目标HTTP v2，预热共享store | 0 | GET发生；锁带integrity，638字节 |
| 另一项目安装本地v1 | 0 | 有效旧file锁，带integrity |
| 从本地v1切换到已缓存HTTP v2 | 0 | 仅HEAD，无GET；新锁缺integrity，530字节 |
| 在上述原node_modules中再做冻结安装 | 0 | 坏锁仍不变，不能仅凭退出0判锁健康 |
| 复制自动生成的坏清单/坏锁到新合成项目，冻结安装 | 1 | `ERR_PNPM_MISSING_TARBALL_INTEGRITY`，锁不变 |
| 复制首次生成的好清单/好锁到新合成项目，冻结安装 | 0 | 成功，锁不变 |
| 独立冷store安装本地v1 | 0 | 有效旧file锁 |
| 同一冷store切换到HTTP v2 | 0 | HEAD+GET发生；锁带integrity |
| 将冷store产生的清单/锁复制到新合成项目，冻结安装 | 0 | 成功，锁不变 |
| 已有坏锁时再改填本地v2 TGZ | 1 | 同一完整性错误；本地文件不是损坏锁修复器 |
| 从有效旧file清单/锁的新副本安装本地v2 | 0 | 本地新锁带integrity，无HTTP动作 |
| 将该本地升级清单/锁复制到新合成项目，冻结安装 | 0 | 成功，锁不变 |

清单/锁均由pnpm自动生成并原样复制至新目录，没有手动补integrity、删除node_modules或清空store。冷/热组用不同store目录；暖目标与冷目标是同一份生成的TGZ字节。较早HTTP/1.1矩阵也观察到同类丢失；初次“本地文件应能修好坏锁”的断言失败已保留，并在最终实验中作为明确拒绝分支验证。

## 代码机制与现场证据的边界

mini分发文件及[官方v11.7.0 packageRequester源码](https://github.com/pnpm/pnpm/blob/v11.7.0/installing/package-requester/src/packageRequester.ts)显示：URL解析初始没有integrity；仅当包标识未变时保留旧resolution的integrity。更新为另一来源/版本、从store直接返回目标包时，该返回路径没有向上层提供新的integrity，于是新resolution可能保持缺字段。[官方worker源码](https://github.com/pnpm/pnpm/blob/v11.7.0/worker/src/start.ts)对应store返回路径；[锁读取拒绝条件](https://github.com/pnpm/pnpm/blob/v11.7.0/lockfile/utils/src/pkgSnapshotToResolution.ts)随后拒绝普通HTTP缺integrity条目。本次冷/热对照直接验证了这条机制。

相关[上游问题14351](https://github.com/pnpm/pnpm/issues/14351)讨论过另一版本和触发方式的URL完整性丢失；不能以该讨论替代本机11.7.0证据，也不能照搬删锁/放宽校验建议。上游草稿要点是“跨来源/版本且目标store命中”，应保留安全校验，不能把旧包SHA当新包SHA。可向上游提供合成最小复现；本轮没有发帖、发消息或发布补丁。

只读核对mini官方ASAR中的实际插件管理器：模块85615字节，SHA256 `f46a48b3422927eea5605a70b78502e06ef9ceaa29d7a73f4a7f742361ff51c8`；`installBundle`调用`pnpm add spec`，该模块的`--frozen-lockfile`位于兼容性拒绝后的恢复分支。**原错误提示包含frozen字样，不足以证明原失败命令本身是冻结安装。**原安装日志已证实P9 HTTP条目缺字段；当时缓存历史、完整命令链与失败阶段仍未逐步重放，因此现场保持“失败保留、机制已复现、未修复”。

## 当前使用与后续

市场已实现的固定包下载、大小/SHA256校验后交官方本地路径安装策略保持不变。尚未开始URL升级的有效环境，可优先选择已有成功证据的同字节本地TGZ官方安装；原安装器已经恢复有效旧状态时也可使用。若真实锁已经缺字段，停止并保留错误，由维护者检查；不要反复改填地址/路径、删除锁、清缓存、取消冻结或降低完整性要求。本轮未修复任何真实锁，也不要求用户重装来补证据。

业务源码、维护工具、Hub和不可变包没有改动；未启动桌面DSH、未创建或复制DSH Home、未读Key。每个临时服务均正常关闭，最终实验目录命令残留为0。证据在开发机`$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/url-diagnosis-20261015/followup/`，`IMPORT.json`指向最终mini目录，含12项结果、每步请求、自动锁快照和日志；诊断copy、早期实验与原证据索引保留。下一步是维护者评审安全分发路径与上游修复方案，原Home升级修复验收、其他P9未测项仍独立保留。
