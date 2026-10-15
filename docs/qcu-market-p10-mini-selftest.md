# P10 mini 本机自测（2026-10-15）

用户明确要求避免手动传包、解压和转交 Cursor。本线程直接通过 SSH 完成传包、校验、解压、执行和报告取回；本次无需用户手动操作或模型代理中转。

| 项目 | 实际结果 |
| --- | --- |
| 运行环境 | mini / macOS 26.7.1 arm64 / Python 3.9.6 |
| 执行时间 | 2026-10-15 08:10:55—08:10:56，北京时间 |
| 工具固定源码 | `54889cd633345dfe0c9eb7498c720164900af4ac` |
| 便携 ZIP | 53454 字节，SHA256 `a2124cb8644f699e723d6cd6928561822fb2986ad5a1f7fa3eb3d3168f301f24` |
| 包传输校验 | 大小/SHA256/CRC、14个普通文件及安全成员路径核对通过，解压到新目录 |
| unittest | 51项通过，0失败，0跳过，退出0 |
| 合成示例生成 | 退出0 |
| static-pass | 退出0，`staticChecksPassed:true`，`approval:required` |
| reject | 预期退出1，`archive.byte_mismatch` 与 `evidence.failed`；拒绝分支通过 |
| 报告取回与父级复核 | 11个总结/报告/日志文件已取回，独立解析51个ok结果，两份报告与远端总结相同 |

mini 产物在 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/native-20261015-y4nbawyq/`；开发机证据在 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/native-mini-20261015-y4nbawyq/`，包括 `SUMMARY.json`、两份报告、日志、runner与`IMPORT.json`哈希清单。原有产物与便携 ZIP 未改写。

本次只验证维护工具与合成数据，没有操作DSH、Hub、账号、凭据或真实业务提交，不替代真实插件安装和教师验收。教师继续使用P9。此前交付文档和 ZIP README 的“mini未测”描述是2026-10-14时点状态；本记录补充实际mini工具验证结果，不回写旧不可变包。P10仍是离线维护工具，静态通过仍须人工审核。
