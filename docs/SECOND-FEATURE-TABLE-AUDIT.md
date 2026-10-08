# 第二功能：CSV 诊断

选择现有 qcu-table-audit：单个合成 CSV、明确规则和标准库 Python 引擎，足以验证独立插件接入。没有学校正式规范时保留演示标记，不编造评分标准。

S0 引擎选择已完成：8 项现有表格测试、4 行合成数据产生 7 项问题，原始文件哈希不变、前导零保留、没有清理或另写清理副本，已有输出拒绝覆盖。证据见 [selection smoke](evidence/table-audit-selection-smoke.json)。该证据仅覆盖引擎。

S1 是独立的程序化 Host 原型。使用官方 Cordis/ToolRuntime 注册一个 qcu_table_audit 工具，绑定可信本地任务或会话 scope。输入只收表格和规则 ID，授权检查类型、用途、期限、scope 与快照，运行一个固定 Python 子进程。临时输入/报告权限受限，输出仅问题计数；取消、超时、卸载等待子进程结束和清理。清理期间取消或到期也不得返回计数。构建时复制 canonical 引擎，避免产生第二份可编辑引擎。

回归使用合成 CSV、真实工具运行时及实际现有启动策略；旧论文策略拒绝新工具，未扩大授权。直接 runner 的会话 scope 测试不是完整模型会话接入验收。结果见 [Host 验证证据](evidence/table-audit-host-validation.json)。

S2 源码及合成验证已实现：默认关闭的官方 Bundle patch、无需 Session 的 Client main/sidebar 入口、逐文件确认后的快照读取、Host 页面绑定及短期授权、个人/演示规则、检查、计数结果/导出、取消和卸载清理恢复。canonical 引擎补可选行/列/问题/报告总字节生成预算，未传预算的独立用法保持兼容。两组独立并行进程和 Controller→已认证 Host→Python 合成管线通过，见 [任务阶段证据](evidence/table-audit-task-validation.json)。

完整官方 Client 挂载、隔离 profile 安装、系统文件选择/保存取消和打印预览尚未通过；JSDOM/API 不能替代原生操作。没有启用真实 CSV 能力，也未将源码增量安装到已验收的 cd5f532 Mac 论文候选。

首个切片不支持清理、TSV/XLSX、批量目录、外部服务或模型、业务评分、生产 Native 能力及 Hub 安装。正式分发、签名、Windows 留到后续决定，packageReady=false。

后续独立复核及最小修复见 [复核记录](TABLE-AUDIT-REVIEW.md)；真实 CSV 授权/UI/安装的下一步与审批边界见 [下一阶段](TABLE-AUDIT-NEXT-STAGE.md)。

提交前复核发现并修正：异步 finally 清理期间取消仍会返回已选结果；授权也可能在清理期间到期或撤销。现在先清理，再重查授权与快照，最后决定结果。四个屏障回归在旧行为下全部失败、修复后通过。另一项并发测试暴露子进程启动预算过短，调整真实超时预算后两个独立进程各自 19 项通过，没有串行化测试。依赖符号链接明确忽略，不随源码提交；生成 lib 仍排除，canonical 引擎保留唯一源码。
