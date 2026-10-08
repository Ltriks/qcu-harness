# CSV Host 原型独立复核

## S2 任务页面与授权所有者（2026-10-08）

两位既有 reviewer 继续只读复核任务页、授权与回归。修正：跨页面并发改为 Host 统一预算；遗失空页面和授权页面以 lease 回收；旧 close revision 在改变 closing 前拒绝；卸载失败恢复捕获 root Connection，避免访问已 dispose 的 feature Context；清理重试清空文件选择器并重新打开新页面。reviewer 的内存模拟仅核查状态机，主回归另使用实际 Cordis、Connection、BrowserAuth 及 canonical Python。

最终 49 项 Vitest、16 项 Python 通过，两个独立 Vitest 进程各 49 项通过。新增 Controller→认证 Host→Python→计数导出合成管线，transport 为内存调用，不是浏览器 TCP。React StrictMode 验证确认前不读取及失败后的清理重试；非空 picker.value synthetic sentinel 消除空值断言假阳性。slots 使用 test double，页面使用 JSDOM，不等同原生验收。结果见 [任务阶段证据](evidence/table-audit-task-validation.json)。

新增 canonical 生成预算在输出前拒绝超限。旧论文策略、已验收 Mac 候选及生产 Native 协议未改。完整官方 Client、真实文件启用、跨进程残留恢复及原生对话框未验收；packageReady=false。

## S1 程序化 adapter 历史记录

两位独立 reviewer 对 b4e0f51828aa8575d2864cf2e92a33a33d53cdc3 做只读复核，分别检查权限/生命周期与测试/证据。没有运行用户应用或更改论文功能。19 项通过及两组独立并行进程记录、旧行为下四项清理屏障失败均经核对。

确认一个 P2 缺陷：删除连续失败后，旧 finally 丢弃 active 所有权并完成 done；dispose 成功但私有目录残留。主代理用真实合成引擎、只在其 owned rm 注入失败复现，旧行为下回归失败。现在目录记录保留到清理成功，dispose 重试并在持续失败时拒绝，故障解除后再次 dispose 清理成功。reviewer 对修复再次只读复核，并用内存模拟核对两次并发 dispose 失败与恢复；无新增阻塞问题。

补齐五项定向测试：删除失败/恢复；授权异常和实际子进程 stderr 的完整错误输出限制；忽略 SIGTERM 后强制退出；同一 owner 两任务的不同输入快照、目录和实际子进程隔离与第三请求限流；两份不同授权 CSV 通过真实引擎同时完成并分别返回 4 行/7 问题与 3 行/6 问题。stderr 有执行标记，子进程退出检查 ESRCH；暂停夹具负责限流/退出，独立成功用例负责结果隔离。最终结果见 [验证证据](evidence/table-audit-host-validation.json)。

权限 scope、用途/类型/期限及结果发布前撤销/快照复核没有发现新缺陷。返回重新构造为固定计数；论文策略及 canonical 引擎未改，新工具仍被论文策略拒绝。

限制：maxReportBytes 是生成后的读取上限，非磁盘生成配额；后续真实文件接入须补生成预算。直接 runner 的清理重试不等于生产 Cordis 卸载失败恢复已集成。完整 Agent 会话正向接入、生产文件授权/UI/安装及原生 GUI 仍未验收；下一阶段见 [最小可体验计划](TABLE-AUDIT-NEXT-STAGE.md)。本轮仅开发源码，未部署，packageReady=false。
