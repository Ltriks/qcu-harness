# P9 URL升级错误后续诊断（2026-10-15）

> 后续更新：已解决实验参数导致的超时，并用未修改的mini随附pnpm复现冷/热缓存升级的完整合成链路；见[缓存机制复现](qcu-market-p9-cache-integrity-reproduction.md)。以下保留较早诊断时点，真实Home原事务仍未重放、未修复。

承接[P9用户验收回执复核](qcu-market-p9-mini-acceptance-review.md)。本次取得原安装日志的直接脱敏证据，并在相同随附pnpm版本复现缺少integrity的拒绝条件。**尚未复现完整file→HTTP升级路径，未修复根因，也未更改真实安装状态。**

## 新的直接证据

只读检查原测试Home指定安装日志，未读取凭据或复制整个profile，未复制原始日志进仓库/产物。错误日志661字节，SHA256 `5fc97bc136a93e0ce83e545f0c8ce9d542c411eae62fe880d082d271e411e58a`，原修改时间2026-10-14 15:36:26北京时间。脱敏摘要确认：

- 错误码确为 `ERR_PNPM_MISSING_TARBALL_INTEGRITY`。
- 受影响包为 `qcu-market` 的HTTP引用；错误中包含已发布P9完整固定URL与SHA256文件名。
- 信息明确指出锁条目没有 `integrity` 字段。日志包含`--frozen-lockfile`提示文字，但仅凭该提示不能证明当次实际命令使用了此参数。

这补充此前“原始pnpm日志未提供”的证据缺口；原用户ZIP和回执文档作为历史记录保留。没有据此声称所有URL安装均失败或包损坏，既有同字节本地TGZ安装成功的用户证据仍有效。

## 官方运行时与隔离实验

只读核对mini官方应用随附pnpm为11.7.0；以`ELECTRON_RUN_AS_NODE=1`调用应用可执行文件的Node模式，版本v24.18.1，没有启动桌面DSH。pnpm实际`dist/pnpm.mjs` SHA256为 `d3a7f4bde2f32c5acc5f012d1edc24c24ea247c2f6c8823146f8cd69ed70b22f`。其`pkgSnapshotToResolution`拒绝没有integrity的普通HTTP tarball锁条目；`file:`等另有处理。对应[官方pnpm v11.7.0源码](https://github.com/pnpm/pnpm/blob/v11.7.0/lockfile/utils/src/pkgSnapshotToResolution.ts)，不把其他版本或非官方镜像当作本机运行时证明。

| 实验 | 结果与边界 |
| --- | --- |
| 依赖为空的合成包，临时loopback服务，新目录尝试fresh HTTP add | 服务返回200，之后40秒超时；未得到成功前置，不能作为来源切换复现 |
| 补齐官方Node包装器环境后，在另一新目录重试fresh HTTP add | 服务返回200，20秒超时，退出124；停止矩阵，未继续file→URL/URL→URL，也未改现有真实包 |
| 手写合成HTTP锁条目，无integrity，`install --frozen-lockfile --offline --ignore-scripts` | 退出1，准确触发同一错误；合成锁哈希不变。只证明拒绝条件，不证明真实锁生成原因 |

合成包只含虚构身份的package.json，无依赖和脚本；pnpm使用独立store、空user/global npm配置和独立缓存目录。两个临时HTTP服务只绑定127.0.0.1并已在finally正常关闭；只读检查未发现带三个实验目录的残留命令。未启动DSH、未修改默认或原测试Home、未重建DSH Home、未动Hub，不把超时实验计为通过。

## 证据与下一步

开发机 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/url-diagnosis-20261015/` 保留三个实验结果、脱敏原错误摘要、三份runner及`IMPORT.json`；mini对应三个`url-diagnosis-20261015-*`独立目录保留。原始日志留在mini原位，没有上传、公开或读取真实配置。

待查的是哪一阶段生成或沿用了缺integrity条目；完整来源切换实验还受合成安装超时影响。后续先解决隔离实验的前置，再调查准确的官方安装器与锁生成路径，不直接在真实环境重试，不删除/编辑真实锁、不取消冻结锁或完整性策略，不覆盖不可变包。同字节本地TGZ仍是已有成功证据的选择，使用时走官方安装与独立启用确认。

本次无需用户操作。此前精确窄宽、重载草稿清除、网络断言、真实注入等P9未测项仍保留，不由本次诊断自动提升。
