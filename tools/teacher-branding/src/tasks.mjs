export const teachingTasks = [
 {id:'qcu-lesson-planning',title:'备课教案',brief:'从教学目标到课堂活动，准备一份可修改的教案。',materials:'课程名称、学生情况、课时和教学目标',prompt:'请使用 qcu-lesson-planning（备课教案）技能，帮我准备一份教案。\n课程与主题：\n学生情况：\n课时：\n教学目标：\n可参考的资料：\n请先核对缺失的信息，再给出供我审阅的草稿。'},
 {id:'qcu-tiered-practice',title:'分层练习',brief:'围绕同一知识点，照顾不同学习基础。',materials:'知识点、学生水平、题量和讲评要求',prompt:'请使用 qcu-tiered-practice（分层练习）技能。\n学科与知识点：\n学生情况：\n题量：\n请设计基础、提高、拓展三个层次的练习，并分别提供答案、解析与适用建议。先核对必要信息，结果供教师审核。'},
 {id:'qcu-note-organizer',title:'整理课堂笔记',brief:'把零散记录整理成重点、疑问与复习线索。',materials:'去除个人信息后的课堂笔记或文字摘录',prompt:'请使用 qcu-note-organizer（课堂笔记整理）技能。\n学科与主题：\n以下是我核对过的课堂记录：\n\n请整理概念、重点、待核对内容与复习问题。不要补造原笔记没有的事实。'},
 {id:'qcu-reading-outline',title:'教材精读',brief:'梳理教材结构，找出核心概念与阅读问题。',materials:'教材章节及经核对的文字摘录',prompt:'请使用 qcu-reading-outline（教材精读）技能。\n学科、章节与学习目标：\n以下是经核对的教材摘录：\n\n请梳理结构、核心概念和阅读问题，区分材料原意与你的解释。'},
 {id:'qcu-study-coach',title:'学习方法教练',brief:'围绕具体困难，制定能执行的学习安排。',materials:'学习目标、目前困难、可用时间',prompt:'请使用 qcu-study-coach（学习方法教练）技能。\n学习目标：\n目前遇到的困难：\n可投入的时间：\n请先了解情况，再给出可执行的学习安排和自我检查方法。'},
 {id:'qcu-integrity-guard',title:'引用自查',brief:'检查引文、出处与待补证据，辅助规范表达。',materials:'拟核对的段落及现有来源',prompt:'请使用 qcu-integrity-guard（学术诚信与引用自查）技能。\n需要核对的文字：\n已知来源：\n请标出需补来源、需核实或表述不清的地方。不虚构文献，也不把自查结果当作查重或正式认定。'},
 {id:'qcu-team-briefing',title:'教研简报',brief:'把教研记录整理成要点、决定与后续行动。',materials:'去除个人信息后的教研记录和简报用途',prompt:'请使用 qcu-team-briefing（教研简报）技能。\n简报用途与读者：\n以下是教研记录：\n\n请整理议题、主要观点、已确认决定与后续行动；未确定的事项单独列出，不补造结论。'}
];

export function recentTasks(sessions, workspaces, limit=5) {
 const archived=new Set(workspaces.archivedSessionIds??[]);
 return (sessions.ids??[]).flatMap(id=>sessions.byId[id]?[{...sessions.byId[id],sessionId:id}]:[]).filter(s=>!s.blank&&!archived.has(s.sessionId)&&!s.parentSessionId)
  .sort((a,b)=>Number(b.updatedAt??b.createdAt??0)-Number(a.updatedAt??a.createdAt??0)).slice(0,limit);
}

// Only populate a new, retained session. Never send a prompt or replace a draft.
export async function openTeachingDraft(ctx, workspaceId, text) {
 if(!workspaceId||!text.trim())throw Error('请先选择工作文件夹并填写任务要求。');
 if(!ctx.workspaces.list.getSnapshot().items.some(w=>w.workspaceId===workspaceId))throw Error('工作文件夹已变化，请重新选择。');
 const id=await ctx.sessions.create({workspaceId});
 const reference=ctx.sessions.retain(id,{source:'qcuTeacherDraft'});
 try {
  const input=ctx.conversation.input.for(reference.binding.ctx);
  if(input.snapshot.draft||input.snapshot.attachmentIds?.length)throw Error('新任务中已有草稿，已保留；请在最近任务中检查。');
  input.setDraft(text);
  ctx.uiWorkspace.openSession(id);
 } finally {reference.release();}
 return id;
}
