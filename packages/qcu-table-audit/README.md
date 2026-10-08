# qcu-table-audit Host 原型

实验性独立 Cordis function plugin，使用真实 tools 服务；程序化 Config 包含不可序列化的可信授权对象，因此没有 dsh.bundle manifest，也不能装入生产 profile。当前论文 Native v1 和启动白名单没有 CSV 能力。

可信 Host 创建 local-task scope（32 位十六进制）或 conversation scope（会话 ID 的 SHA256）。工具只接受 table_id、rules_id；本地任务拒绝模型 Agent，会话工具要求匹配会话身份。授权对象必须在每次 resolve 时检查撤销，提供明确 diagnose-csv 用途、CSV 类型、期限及不可变快照。该接口原型不实现生产文件选择或授权存储。

每次运行使用私有临时目录、独占输入文件、固定 canonical Python 引擎及输入/规则大小、报告读取大小、并发数和超时限制。maxReportBytes 在引擎生成后、读取前检查，不是生成磁盘配额；生产接入前仍需给 canonical 引擎增加生成预算。没有 --clean，原文件不改。仅重建的计数离开 Host；原始行、路径、规则、子进程 stdout/stderr 不返回。取消、卸载、超时等待自身子进程退出和清理，清理期间取消或授权到期拒绝结果。插件不是操作系统沙箱。

持续删除失败时保留自身目录记录并拒绝卸载；runner.dispose() 可在故障解除后重试。生产 Cordis 集成须保留、呈现并处理卸载拒绝与恢复，不能把任务结束当作清理成功，也不保证操作系统级残留自动回收。

构建和回归使用匹配官方 checkout 的现有依赖和 Python 3.10+，不重新安装：

```sh
node scripts/build-host.mjs
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
QCU_TEST_PYTHON=/absolute/path/to/python \
QCU_TEST_UPSTREAM=/absolute/path/to/matching/built/checkout \
node node_modules/vitest/vitest.mjs run --config vitest.config.mjs
```

测试针对生成后的 lib，策略测试使用匹配 checkout 的真实已构建策略模块。生成目录及本机依赖链接不提交。清理屏障仅在测试中拦截自身 run 目录的 rm，子进程和其余文件操作保持真实。

当前结果见 [验证证据](../../docs/evidence/table-audit-host-validation.json)，范围和后续工作见 [CSV 计划](../../docs/SECOND-FEATURE-TABLE-AUDIT.md)。无生产 Client、安装链、原生文件选择/报告保存验收；不支持清理、TSV/XLSX 或外部模型。packageReady=false。
