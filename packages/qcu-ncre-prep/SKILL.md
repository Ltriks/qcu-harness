---
name: qcu-ncre-prep
description: 计算机等级考试的选科、学习安排、代码练习和错题辅导。用于用户要求的研究或文档团队任务，按 DSH 实际工具执行，不是旧版纯文字专家评审。
---

# NCRE备考团队（社区改编） · DSH 迁移试用版

来源类型：MIT 社区对话重建版，不是 WorkBuddy 官方原版，角色与功能可能不同。

先读取 [DSH 适配契约](references/dsh-adapter.md)，再读取 [团队清单](manifest.json) 和
[主理人职责](references/agents/ncre-expert-team-lead.md)。派发成员前按清单读取其角色文件。
当前技能目录由 DSH resourceBase 提供，不假设用户工作区包含本包。

支持原始团队的完整角色分工，以当前 DSH 工具替换 WorkBuddy 平台操作。
研究任务需要真实搜索与来源；文档任务优先使用用户提供资料。工具缺失时标明限制。
默认输出 Markdown；其他格式按用户需要和已具备的实际工具生成。
试用版尚未经真实模型端到端验收，不能宣称与 WorkBuddy 原版等效。
