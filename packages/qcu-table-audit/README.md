# qcu-table-audit 开发原型

版本 0.2.0-prototype.0 包含程序化 Host adapter（默认导出）、可序列化隔离任务 Host（./task-host）和 React Client（./client）。使用固定官方 Cordis、ToolRuntime、Connection 及 Client slots；Bundle patch 同时设置 disabled:true 与 enabled:false。源码、构建及合成测试已完成，不代表已安装或启用真实 CSV。已验收论文候选未替换，旧论文策略仍拒绝 CSV 工具。

Client 使用 main 与 sidebar.panellist 提供无需 Session 的独立页面。逐次选择单个 CSV、演示或个人规则并确认只读 diagnose-csv 用途后，页面才读取文件快照；不提交原文件名或路径。可信 Host 创建短期 page capability、local-task scope 和不透明 task ID，绑定页面与 revision，拒绝跨页面、过期、撤销和旧 revision。重新选择、取消、关闭及授权到期撤销任务。失联页面 lease 回收包括空页面；活动不延长文件授权期限。演示规则不是学校正式规范。

快照通过官方已认证同源本地 Connection 传输，不进入聊天或模型。Host tool 只接受 task ID，拒绝模型 Agent。所有页面共享子进程并发上限。运行使用 owned 私有目录、固定 canonical Python 引擎、输入/规则字节上限、行/列/问题上限、报告总字节生成预算、读取上限及超时。生成预算在创建输出目录及写报告前拒绝超限；无 --clean，不改源文件。这不是 OS 磁盘配额或同权限进程沙箱。

页面只显示固定计数并导出仅计数 JSON，原始行、路径、规则及 stdout/stderr 不返回。取消/卸载撤销授权，终止自身子进程并等待清理。删除失败保留 owned 记录；root-owned recovery route 和 admission guard 在 feature 卸载后保留到清理成功再释放。恢复只处理 closing 或 cleanup-failed 记录，不复活授权或清理其他 live page。Host 整个进程退出后的跨进程残留恢复尚未实现。

构建和回归使用匹配官方 checkout 的现有依赖和 Python 3.10+，不重新安装：

```sh
node scripts/build-host.mjs
node scripts/build-client.mjs
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.client.json --noEmit
QCU_TEST_PYTHON=/absolute/path/to/python \
QCU_TEST_UPSTREAM=/absolute/path/to/matching/built/checkout \
node node_modules/vitest/vitest.mjs run --config vitest.config.mjs
```

canonical 引擎仅在 skills/qcu-table-audit/scripts/audit.py 编辑，构建复制到 lib。测试针对生成后的 lib，使用真实工具运行时、实际 Connection/BrowserAuth、Python 子进程和合成文件。React DOM/StrictMode 使用 JSDOM，slots contribution 使用 test double，不等同完整官方 Client 挂载或系统对话框验收。生成目录及本机依赖链接不提交。清理屏障仅拦截自身 run 目录的 rm，其余文件操作及子进程保持真实。

当前结果见 [任务阶段证据](../../docs/evidence/table-audit-task-validation.json)，历史证据见 [Host 阶段](../../docs/evidence/table-audit-host-validation.json)。安装、新隔离 profile 能力审批及原生流程待完成，见 [下一阶段](../../docs/TABLE-AUDIT-NEXT-STAGE.md)。不支持清理、TSV/XLSX、批量、行级导出、外部模型或永久授权；packageReady=false。
