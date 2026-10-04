# 提取结果约定

顶层字段必须恰好包含 `items`（数组）及 `uncertainties`（字符串数组）。

每条 item 必须包含：

| 字段 | 类型与含义 |
| --- | --- |
| kind | decision / action / proposal / open_question |
| task | 非空字符串；对原文事项的忠实概括 |
| owner | 原文负责人名称，未知为 null；不得将建议中的人名视为已分配 |
| deadline | 原文时间表达，未知为 null；不得自行计算相对日期 |
| evidence | 对象，包含 start_line、end_line（从1起、包含端点）和 quote |

quote 必须等于所引用连续行的全文（多行用 `\n` 连接），不加行号、不删首尾空格。owner/deadline 非 null 时，必须是该 quote 的子串；这只是机械约束，Agent 仍需判断原文是否支持该关联。

允许 items 为空；此时说明“没有明确事项”或说明输入内容不足。不得为了填满模板创造任务。报告生成后统一为 draft，证据校验与业务确认分开。
