window.__ModuleLoader__.load({id:'qcu-branding',factory:require=>{
  const React=require('react');
  const icon='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxNzRGOTEiLz4KICA8cGF0aCBkPSJNMjAgMzFWMjBDMjAgMTAgNDQgMTAgNDQgMjBWMzFIMzhWMjFDMzggMTcgMjYgMTcgMjYgMjFWMzFIMjBaIiBmaWxsPSIjRkZGIi8+CiAgPHBhdGggZD0iTTEyIDM3QzIwIDM0IDI2IDM2IDMyIDQxQzM4IDM2IDQ0IDM0IDUyIDM3VjQ5QzQ0IDQ2IDM4IDQ4IDMyIDUzQzI2IDQ4IDIwIDQ2IDEyIDQ5VjM3WiIgZmlsbD0iI0ZGRiIvPgogIDxwYXRoIGQ9Ik0zMiA0MVY1MyIgc3Ryb2tlPSIjMTc0RjkxIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE2IDQyQzIxIDQxIDI1IDQyIDI4IDQ0TTM2IDQ0QzM5IDQyIDQzIDQxIDQ4IDQyIiBzdHJva2U9IiM5QUQ1RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo=';
  const teachingTasks = [
 {id:'qcu-lesson-planning',title:'备课教案',brief:'从教学目标到课堂活动，准备一份可修改的教案。',materials:'课程名称、学生情况、课时和教学目标',prompt:'请使用 qcu-lesson-planning（备课教案）技能，帮我准备一份教案。\n课程与主题：\n学生情况：\n课时：\n教学目标：\n可参考的资料：\n请先核对缺失的信息，再给出供我审阅的草稿。'},
 {id:'qcu-tiered-practice',title:'分层练习',brief:'围绕同一知识点，照顾不同学习基础。',materials:'知识点、学生水平、题量和讲评要求',prompt:'请使用 qcu-tiered-practice（分层练习）技能。\n学科与知识点：\n学生情况：\n题量：\n请设计基础、提高、拓展三个层次的练习，并分别提供答案、解析与适用建议。先核对必要信息，结果供教师审核。'},
 {id:'qcu-note-organizer',title:'整理课堂笔记',brief:'把零散记录整理成重点、疑问与复习线索。',materials:'去除个人信息后的课堂笔记或文字摘录',prompt:'请使用 qcu-note-organizer（课堂笔记整理）技能。\n学科与主题：\n以下是我核对过的课堂记录：\n\n请整理概念、重点、待核对内容与复习问题。不要补造原笔记没有的事实。'},
 {id:'qcu-reading-outline',title:'教材精读',brief:'梳理教材结构，找出核心概念与阅读问题。',materials:'教材章节及经核对的文字摘录',prompt:'请使用 qcu-reading-outline（教材精读）技能。\n学科、章节与学习目标：\n以下是经核对的教材摘录：\n\n请梳理结构、核心概念和阅读问题，区分材料原意与你的解释。'},
 {id:'qcu-study-coach',title:'学习方法教练',brief:'围绕具体困难，制定能执行的学习安排。',materials:'学习目标、目前困难、可用时间',prompt:'请使用 qcu-study-coach（学习方法教练）技能。\n学习目标：\n目前遇到的困难：\n可投入的时间：\n请先了解情况，再给出可执行的学习安排和自我检查方法。'},
 {id:'qcu-integrity-guard',title:'引用自查',brief:'检查引文、出处与待补证据，辅助规范表达。',materials:'拟核对的段落及现有来源',prompt:'请使用 qcu-integrity-guard（学术诚信与引用自查）技能。\n需要核对的文字：\n已知来源：\n请标出需补来源、需核实或表述不清的地方。不虚构文献，也不把自查结果当作查重或正式认定。'},
 {id:'qcu-team-briefing',title:'教研简报',brief:'把教研记录整理成要点、决定与后续行动。',materials:'去除个人信息后的教研记录和简报用途',prompt:'请使用 qcu-team-briefing（教研简报）技能。\n简报用途与读者：\n以下是教研记录：\n\n请整理议题、主要观点、已确认决定与后续行动；未确定的事项单独列出，不补造结论。'}
];

function recentTasks(sessions, workspaces, limit=5) {
 const archived=new Set(workspaces.archivedSessionIds??[]);
 return (sessions.ids??[]).flatMap(id=>sessions.byId[id]?[{...sessions.byId[id],sessionId:id}]:[]).filter(s=>!s.blank&&!archived.has(s.sessionId)&&!s.parentSessionId)
  .sort((a,b)=>Number(b.updatedAt??b.createdAt??0)-Number(a.updatedAt??a.createdAt??0)).slice(0,limit);
}

// Only populate a new, retained session. Never send a prompt or replace a draft.
async function openTeachingDraft(ctx, workspaceId, text) {
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

const themeTokens = {
 '--dsw-alias-bg-base':['#FFFFFF','#17212E'],
 '--dsw-alias-bg-layer-1':['#FFFFFF','#1D2A3A'],
 '--dsw-alias-bg-layer-2':['#FFFFFF','#233247'],
 '--dsw-alias-bg-layer-3':['#F7FAFD','#293B50'],
 '--dsw-alias-bg-module-platform':['#F7FAFD','#1D2A3A'],
 '--dsw-specific-sidebar-fill':['#F0F5FA','#14202D'],
 '--dsw-specific-input-major':['#FFFFFF','#1D2A3A'],
 '--dsw-alias-label-primary':['#17324D','#E5EFF9'],
 '--dsw-alias-label-primary-dimmed':['#304E6A','#D0DFED'],
 '--dsw-alias-label-secondary':['#48617A','#B8CBDE'],
 '--dsw-alias-label-tertiary':['#566C82','#A8BED2'],
 '--dsw-alias-label-caption':['#617589','#9FB5CA'],
 '--dsw-alias-border-l1':['#E5EDF5','#2B4055'],
 '--dsw-alias-border-l2':['#D9E5EE','#354C63'],
 '--dsw-alias-border-l3':['#CBDCE9','#405A73'],
 '--dsw-alias-border-l4':['#A6BED3','#68839D'],
 '--dsw-alias-state-business-primary':['#174F91','#93C4FF'],
 '--dsw-alias-brand-primary':['#174F91','#93C4FF'],
 '--dsw-alias-brand-text':['#174F91','#B6D8FF'],
 '--dsw-alias-button-primary-fill':['#174F91','#285E9C'],
 '--dsw-alias-button-primary-hover':['#103F78','#3473B8'],
 '--dsw-alias-button-info-fill':['#174F91','#285E9C'],
 '--dsw-alias-button-info-hover':['#103F78','#3473B8'],
 '--dsw-alias-interactive-bg-hover':['#E9F2F9','#293F57'],
 '--dsw-alias-interactive-bg-hover-solid':['#E1ECF6','#314D68'],
 '--qcu-canvas':['#F7FAFD','#111B27'],
 '--qcu-paper':['#FFFFFF','#1D2A3A'],
 '--qcu-selected':['#E9F2F9','#263F5B'],
 '--qcu-blue':['#174F91','#ABD1FF'],
 '--qcu-button':['#174F91','#285E9C'],
 '--qcu-line':['#D9E5EE','#354C63'],
 '--qcu-ink':['#17324D','#E5EFF9'],
 '--qcu-muted':['#48617A','#B8CBDE'],
 '--qcu-error-bg':['#FFF0EE','#462B2D'],
 '--qcu-error-ink':['#962E24','#FFC0B8']
};
const pairedTokens=Object.fromEntries(Object.entries(themeTokens).map(([name,[light,dark]])=>[name,{light,dark}]));

const teacherStyles = `
body[data-qcu-teacher]{--qcu-font:var(--dsh-content-font-size,14px);--qcu-small:calc(var(--qcu-font) * 13 / 14)}
.qcu-teacher{box-sizing:border-box;color:var(--qcu-ink);font:var(--qcu-font)/1.7 var(--dsw-font-family,system-ui,sans-serif)}
.qcu-teacher *{box-sizing:border-box}.qcu-teacher button,.qcu-teacher select,.qcu-teacher textarea{font:inherit}
.qcu-teacher button{cursor:pointer}.qcu-teacher button:disabled{cursor:default;opacity:.55}
.qcu-teacher :focus-visible{outline:3px solid var(--qcu-blue);outline-offset:3px}
.qcu-home{height:100%;width:100%;min-height:0;min-width:0;flex:1;overflow:auto;background:var(--qcu-canvas);container-type:inline-size}
.qcu-home-inner{max-width:1060px;margin:auto;padding:46px 52px 48px}
html[data-platform=darwin] .qcu-home-inner{padding-top:58px}
.qcu-home-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:28px}
.qcu-home h1{font-size:calc(var(--qcu-font) * 24 / 14);line-height:1.4;letter-spacing:.02em;margin:0;font-weight:650}
.qcu-home h2{font-size:calc(var(--qcu-font) * 21 / 14);line-height:1.5;margin:0 0 12px;font-weight:600}
.qcu-home :is(h1,h2,p){overflow-wrap:anywhere}.qcu-home section,.qcu-home header,.qcu-home aside{min-width:0}
.qcu-home p{margin:8px 0 16px;max-width:42em}.qcu-muted{color:var(--qcu-muted);font-size:var(--qcu-small)}
.qcu-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.qcu-button{min-height:44px;border:1px solid var(--qcu-line);border-radius:8px;padding:8px 16px;background:var(--qcu-paper);color:var(--qcu-ink)}
.qcu-button:hover:not(:disabled){background:var(--qcu-selected);border-color:var(--qcu-blue)}
.qcu-button.primary{background:var(--qcu-button);border-color:var(--qcu-button);color:white}
.qcu-button.primary:is(:hover,:active):not(:disabled){background:var(--qcu-button);border-color:var(--qcu-button)}
body[data-qcu-teacher] .qcu-market{--qcu-market-primary-ink:#fff}
.qcu-button.quiet{border-color:transparent;background:transparent;color:var(--qcu-blue)}
.qcu-task-sheet{background:var(--qcu-paper);border:1px solid var(--qcu-line);border-top:4px solid var(--qcu-blue);border-radius:4px 4px 12px 12px;padding:28px 30px}
.qcu-task-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 24px}
.qcu-task-tabs button{min-height:48px;padding:8px 17px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--qcu-muted)}
.qcu-task-tabs button[aria-pressed=true]{background:var(--qcu-selected);color:var(--qcu-blue);border-color:var(--qcu-line);font-weight:600}
.qcu-task-tabs button:hover{background:var(--qcu-selected)}
.qcu-field{display:flex;flex-direction:column;gap:8px;margin:20px 0}.qcu-field>span{font-size:var(--qcu-small);font-weight:600}
.qcu-field textarea,.qcu-field select{width:100%;border:1px solid var(--qcu-line);border-radius:7px;background:var(--qcu-canvas);color:var(--qcu-ink);padding:12px 14px;min-height:48px}
.qcu-field textarea{resize:vertical;min-height:220px;line-height:1.7}.qcu-field select{max-width:100%}
.qcu-task-bottom{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.qcu-task-bottom p{margin:0;flex:1;min-width:200px}
.qcu-lower{display:grid;grid-template-columns:minmax(0,1fr) 265px;gap:34px;margin-top:32px}.qcu-recent{padding:0;list-style:none;margin:0}
.qcu-recent li{border-bottom:1px solid var(--qcu-line)}.qcu-recent button{display:block;text-align:left;width:100%;padding:12px 0;min-height:54px;background:transparent;border:0;color:var(--qcu-ink);overflow-wrap:anywhere}
.qcu-recent button:hover{color:var(--qcu-blue)}.qcu-empty{border:1px dashed var(--qcu-line);padding:20px;border-radius:8px}
.qcu-course-link{padding:0 0 22px;border-bottom:1px solid var(--qcu-line);margin-bottom:22px}.qcu-home details{margin-top:22px}.qcu-home summary{cursor:pointer;color:var(--qcu-blue);min-height:44px}
.qcu-tool-list{list-style:none;padding:0;margin:0}.qcu-tool-list li{padding:18px 0;border-bottom:1px solid var(--qcu-line)}.qcu-tool-list strong{font-size:calc(var(--qcu-font) * 20 / 14)}.qcu-tool-list p{margin:4px 0 12px}
.qcu-notice{padding:12px 16px;background:var(--qcu-selected);border-left:3px solid var(--qcu-blue);margin:16px 0;border-radius:0 7px 7px 0}
.qcu-notice[role=alert]{color:var(--qcu-error-ink);background:var(--qcu-error-bg);border-color:currentColor}
.qcu-side{height:100%;min-width:0;display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--qcu-line);padding:46px 16px 14px;font-size:var(--qcu-font)}
html:not([data-platform=darwin]) .qcu-side{padding-top:16px}.qcu-side-brand{display:flex;gap:10px;align-items:center;padding:7px 8px 22px;flex-wrap:wrap}.qcu-side-brand strong{font-size:calc(var(--qcu-font) * 18 / 14);font-weight:650;letter-spacing:.03em}.qcu-side-brand small{display:block;color:var(--qcu-muted);font-size:calc(var(--qcu-font) * 12 / 14);letter-spacing:.12em}
html[data-windows-titlebar] .qcu-side{padding-top:calc(var(--dsh-windows-titlebar-height,40px) + 12px)}
.qcu-side-nav svg{flex:none}.qcu-side-nav{display:flex;flex-direction:column;flex:none;gap:7px}.qcu-side-nav button{display:flex;align-items:center;gap:12px;text-align:left;min-height:48px;border:0;border-radius:7px;padding:10px 12px;color:var(--qcu-ink);background:transparent;white-space:normal;overflow-wrap:anywhere}.qcu-side-nav button[aria-current=page]{background:var(--qcu-paper);box-shadow:inset 3px 0 var(--qcu-blue);color:var(--qcu-blue);font-weight:600}.qcu-side-nav button:hover{background:var(--qcu-selected)}
/* Short windows scroll the sidebar; native workspace controls keep a usable viewport. */
.qcu-side-work{flex:1 0 144px;min-height:144px;overflow:auto;margin-top:24px}.qcu-side-work h2{font-size:calc(var(--qcu-font) * 13 / 14);color:var(--qcu-muted);font-weight:500;padding:0 10px;margin:0 0 8px}.qcu-side-foot{padding-top:12px;border-top:1px solid var(--qcu-line)}.qcu-side-foot details>summary{min-height:44px;cursor:pointer;color:var(--qcu-muted);font-size:var(--qcu-font)}.qcu-side-foot .qcu-button{font-size:var(--qcu-font);width:100%;text-align:left}
.qcu-side-foot,.qcu-side-brand,.qcu-side>.qcu-button{flex:none}.qcu-side-foot details .qcu-button{white-space:normal}
.qcu-footer-row{box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;margin:0;padding:8px 12px;border:0;border-radius:6px;background:transparent;color:var(--qcu-ink);font:var(--qcu-font)/1.6 var(--dsw-font-family);text-align:left;cursor:pointer}
.qcu-footer-row>svg{flex:none}.qcu-footer-row:hover{background:var(--qcu-selected)}
.qcu-side-foot .qcu-maintenance>summary{font:var(--qcu-font)/1.6 var(--dsw-font-family);color:var(--qcu-ink);list-style:none}
.qcu-maintenance>summary::-webkit-details-marker{display:none}.qcu-maintenance>summary>svg{transform:rotate(180deg)}.qcu-maintenance[open]>summary>svg{transform:rotate(-90deg)}
.qcu-maintenance-items .qcu-footer-row{padding-left:44px;font-size:var(--qcu-small)}
.qcu-footer-settings [data-slot="sidebar.settings"]>div:first-child{display:flex;flex-direction:column;align-items:stretch;gap:4px;width:100%;margin:0}
.qcu-footer-settings [data-slot="sidebar.settings"]>div:first-child>button:not(.qcu-footer-row){align-self:flex-start;margin:0 12px 4px;min-height:32px;font-size:var(--qcu-font)}
/* Keep native workspace actions, picker, search and menus; only label and reflow
   their semantic controls in the frozen UI. No generated class names. */
.qcu-native-workspaces{--dsh-sidebar-inline-padding:0px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child{display:flex;flex-wrap:wrap;height:auto;min-height:44px;padding:0;margin:0 0 10px;overflow:visible;gap:6px;justify-content:flex-start}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>span{flex-basis:100%;max-width:100%;font-size:var(--qcu-font);padding:4px 12px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div{max-width:100%;min-width:0;margin:0;padding:0}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(button[aria-expanded]){flex-basis:100%;width:100%}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(button[aria-expanded])>div{min-height:44px;height:auto;width:100%;margin:0}
.qcu-native-workspaces button:is([aria-label="搜索会话"],[aria-label="Search sessions"]):not([aria-expanded=true]){width:100%;min-height:44px;height:auto;justify-content:flex-start;gap:12px;padding:8px 12px;font:var(--qcu-font)/1.6 var(--dsw-font-family)}
.qcu-native-workspaces button:is([aria-label="搜索会话"],[aria-label="Search sessions"]):not([aria-expanded=true])::after{content:attr(aria-label)}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(>button[aria-label="添加工作区"]),.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child>div:has(>button[aria-label="Add workspace"]){flex-basis:100%;max-width:100%;width:100%;min-height:44px;height:auto}
.qcu-native-workspaces button:is([aria-label="添加工作区"],[aria-label="Add workspace"]){order:-1;flex:1;width:auto;min-height:44px;height:auto;justify-content:flex-start;gap:12px;padding:8px 12px;font:var(--qcu-font)/1.6 var(--dsw-font-family)}
.qcu-native-workspaces button:is([aria-label="添加工作区"],[aria-label="Add workspace"])::after{content:attr(aria-label)}
.qcu-native-workspaces button:is([aria-label="视图选项"],[aria-label="View options"]){width:36px;height:44px}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>div:has(>button[aria-label="添加工作区"]),.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>div:has(>button[aria-label="Add workspace"]){display:none}
.qcu-native-workspaces [data-slot="sidebar.workspaces"]>div>div:first-child:has(button:is([aria-label="搜索会话"],[aria-label="Search sessions"])[aria-expanded=true])>span{display:none}
.qcu-header-nav{display:flex;align-items:center;gap:6px;font-size:var(--qcu-font);-webkit-app-region:no-drag}.qcu-header-nav .qcu-button{min-height:36px;padding:4px 10px}.qcu-windows-recovery{display:none}
html[data-platform=darwin] body[data-qcu-teacher] [data-sidebar-collapsed]{--dsh-frame-leading-clearance:240px}
html[data-windows-titlebar] .qcu-windows-recovery{display:block;position:fixed;top:2px;left:8px;z-index:30;-webkit-app-region:no-drag}
html[data-windows-titlebar]:has(body[data-qcu-teacher] [data-sidebar-collapsed]){--dsh-windows-menu-start:160px}
.qcu-side.collapsed{padding:44px 5px 12px;align-items:center}.qcu-side.collapsed .qcu-side-brand{padding:0 0 12px}.qcu-side.collapsed .qcu-side-nav{align-self:stretch;min-width:0}.qcu-side.collapsed .qcu-side-nav button{padding:10px 0;justify-content:center}.qcu-side.collapsed .qcu-side-work{display:none}.qcu-side.collapsed .qcu-side-foot{margin-top:auto;width:100%}
.qcu-side.collapsed>.qcu-button{width:100%;padding-inline:0}.qcu-side.collapsed .qcu-footer-row{padding:8px 0;justify-content:center;gap:0}
/* Keep the settings name accessible in the icon rail, including with a scrollbar. */
.qcu-side.collapsed .qcu-footer-row>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
/* Semantic host anchors only; never target generated/minified class names. */
body[data-qcu-teacher] [data-composer-card]{border:1px solid var(--qcu-line);box-shadow:none;border-radius:12px}
body[data-qcu-teacher] [data-composer-input]{min-height:70px;padding:12px 18px}
body[data-qcu-teacher] [data-composer-card] button{min-width:44px;min-height:44px}
html body[data-qcu-teacher] .qcu-course{--bg:var(--qcu-canvas);--card:var(--qcu-paper);--soft:var(--qcu-canvas);--line:var(--qcu-line);--ink:var(--qcu-ink);--body:var(--qcu-muted);--accent:var(--qcu-blue);--mint:var(--qcu-selected)}
body[data-qcu-teacher] .qcu-course .logo{background:var(--qcu-button)}
body[data-qcu-teacher] .qcu-course .primary{background:var(--qcu-button);border-color:var(--qcu-button)}
body[data-qcu-teacher] .qcu-course .btn{min-height:44px}
body[data-qcu-teacher] .qcu-course input[type=checkbox]{accent-color:var(--qcu-blue);width:20px;height:20px}
body[data-qcu-teacher] .qcu-course :focus-visible{outline-color:var(--qcu-blue)}
body[data-qcu-teacher] .qcu-course .card{box-shadow:none}

/* P16 compact teacher workspace; host font size and paired palette stay authoritative. */
.qcu-home-inner{padding:24px 28px 28px;max-width:1120px}
html[data-platform=darwin] .qcu-home-inner{padding-top:26px}
.qcu-home-top{padding-bottom:16px}.qcu-home h2{font-size:calc(var(--qcu-font) * 18 / 14);margin-bottom:8px}
.qcu-first-task{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;font-size:var(--qcu-small)}
.qcu-compose-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,230px);gap:20px;align-items:start}
.qcu-task-sheet{padding:16px 20px}.qcu-task-tabs{margin:8px 0 12px}.qcu-task-tabs button{min-height:40px;padding:6px 10px}
.qcu-field{margin:12px 0;gap:6px}.qcu-field textarea{min-height:170px;padding:10px 12px}.qcu-field select{padding:8px 10px;min-height:40px}
.qcu-button{min-height:40px;padding:6px 12px}.qcu-lower{display:block;margin-top:18px}.qcu-lower>aside{display:flex;gap:20px;flex-wrap:wrap}.qcu-lower>aside>section{flex:1;min-width:180px}
.qcu-recent-section{padding-top:4px}.qcu-recent button{min-height:44px;padding:8px 0}.qcu-empty{padding:12px}
.qcu-tool-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px;padding:12px 0}.qcu-tool-list strong{font-size:calc(var(--qcu-font) * 16 / 14)}.qcu-tool-list p{grid-column:1;margin:2px 0 4px}.qcu-tool-list button{grid-column:2;grid-row:1 / 4;align-self:center}
.qcu-first-guide{border:1px solid var(--qcu-line);border-left:3px solid var(--qcu-blue);padding:16px;border-radius:6px}.qcu-first-guide .qcu-home-inner{padding:8px 0}.qcu-first-guide .qcu-compose-grid{grid-template-columns:minmax(0,1fr)}.qcu-first-guide .qcu-recent-section,.qcu-first-guide .qcu-lower{display:none}.qcu-first-guide .qcu-home{height:auto;overflow:visible}.qcu-first-guide>.qcu-toolbar{margin-top:16px}
@container(max-width:800px){.qcu-compose-grid{grid-template-columns:1fr}.qcu-home-inner{padding:20px}.qcu-home-top{align-items:flex-start;flex-wrap:wrap}}
@container(max-width:480px){.qcu-home-inner{padding:16px}.qcu-task-sheet{padding:12px}.qcu-task-bottom>.qcu-button{width:100%}.qcu-tool-list li{display:block}.qcu-tool-list button{margin-top:6px}.qcu-first-guide{padding:12px}}
@media(prefers-reduced-motion:reduce){.qcu-teacher *,.qcu-market *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
`;

const problemHelp = [
 {id:'network',title:'网络或校内 Hub 无法连接',text:'先确认设备网络和校内连接可用；校内 Hub 暂时离线时，稍后再由你尝试。反馈提交结果不确定时，先查询已有回执，不要重复提交。'},
 {id:'key',title:'提示缺少或无效的 API Key',text:'打开左下角“设置 → 模型”，在对应服务商的官方设置中核对并保存 Key。不要把 Key 贴到对话、截图或反馈里。'},
 {id:'busy',title:'服务繁忙或请求限流',text:'等待一段时间后，再由你决定是否重试。繁忙、容量不足或限流不代表余额耗尽；若持续出现，请查看服务商公告或联系维护者。'},
 {id:'quota',title:'服务明确提示额度或余额不足',text:'仅在服务商明确返回额度或余额不足时，到自己的服务商账户核对用量、配额和账单；不确定的提示可先联系维护者。'},
 {id:'workspace',title:'无法访问工作文件夹',text:'先保留当前草稿，再选择自己有权限访问且仍存在的文件夹。不要反复生成或更改系统权限；仍不可用时请联系维护者。'},
 {id:'install',title:'安装结果不确定',text:'先查看安装回执和当前状态，再正常关闭并重新打开客户端核对。不要反复安装或先卸载；仍不确定时保留回执并联系维护者。'}
];

function createTeacherViews(React, icon) {
 const h=React.createElement;
 const useSource=source=>React.useSyncExternalStore(fn=>source.subscribe(fn),()=>source.getSnapshot(),()=>source.getSnapshot());
 function Glyph({kind='home',size=22}) {
  const paths={home:'M3 10l9-7 9 7v10H7V10m5 4v6',book:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15',tools:'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',folder:'M3 6h7l2 3h9v11H3z',chat:'M3 4h18v14H9l-6 4z',menu:'M4 6h16M4 12h16M4 18h16',help:'M9 9a3 3 0 116 0c0 2-3 2-3 5m0 3h.01',chevron:'M14 6l-6 6 6 6'};
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[kind]??paths.tools}));
 }
 function Mark({size=28,className}) {return h('img',{src:icon,width:size,height:size,className,alt:'',draggable:false});}
 function Name(){return h('strong',null,'QCU助手');}
 function HeaderNavigation({ctx}) {
  return h('nav',{className:'qcu-teacher qcu-header-nav','aria-label':'窗口导航'},
   h('button',{type:'button',className:'qcu-button','aria-label':'展开导航',title:'展开导航',onClick:()=>ctx.layout.toggleSidebar()},h(Glyph,{kind:'menu',size:18})),
   h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-home')},'教学首页'));
 }
 function SettingsLauncher({openSettings}) {
  return h('button',{type:'button',className:'qcu-footer-row','aria-haspopup':'dialog',onClick:openSettings},h(Glyph,{kind:'tools',size:20}),h('span',null,'设置'));
 }
 function Sidebar({ctx,collapsed,toggleSidebar,renderSlot}) {
  const info=useSource(ctx.layout.panelInfo);
  React.useSyncExternalStore(fn=>ctx.slots.subscribe('sidebar.panellist',fn),()=>ctx.slots.getVersion('sidebar.panellist'),()=>ctx.slots.getVersion('sidebar.panellist'));
  const extraPanels=ctx.slots.entriesOfSlot('sidebar.panellist').map(row=>row.options).filter(o=>o.id!=='plugins'&&o.id!=='qcu-course-workbench');
  const promoted=extraPanels.filter(o=>['qcu-market','qcu-expert-teams'].includes(o.id));
  const maintenance=extraPanels.filter(o=>!['qcu-market','qcu-expert-teams'].includes(o.id));
  const active=info.activePanelId;
  const nav=(id,label,kind)=>h('button',{key:id,type:'button','aria-label':label,title:collapsed?label:undefined,'aria-current':active===id?'page':undefined,onClick:()=>ctx.layout.selectPanel(id)},h(Glyph,{kind}),!collapsed&&h('span',null,label));
  return h('aside',{className:'qcu-teacher qcu-side'+(collapsed?' collapsed':''),'aria-label':'QCU导航'},
   collapsed&&h('div',{className:'qcu-windows-recovery'},h(HeaderNavigation,{ctx})),
   h('div',{className:'qcu-side-brand'},h(Mark,{}),!collapsed&&h('div',null,h(Name),h('small',null,'教学与教研助手'))),
   h('nav',{className:'qcu-side-nav','aria-label':'主要功能'},nav('qcu-teacher-home','教学首页','home'),nav('qcu-course-workbench','课程工作台','book'),nav('qcu-teacher-tools','教学工具','tools'),...promoted.map(o=>nav(o.id,o.id==='qcu-market'?'工具市场':'专家团','tools')),
    h('button',{type:'button','aria-label':'自由对话',title:collapsed?'自由对话':undefined,onClick:()=>ctx.uiWorkspace.startSession()},h(Glyph,{kind:'chat'}),!collapsed&&'自由对话')),
   h('div',{className:'qcu-side-work qcu-native-workspaces'},!collapsed&&renderSlot('sidebar.workspaces',{wide:true})),
   h('div',{className:'qcu-side-foot'},!collapsed&&h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},h(Glyph,{kind:'help',size:20}),h('span',null,'使用指南')),
    h('div',{className:'qcu-footer-settings'},renderSlot('sidebar.settings',{wide:!collapsed})),
    !collapsed&&h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('qcu-teacher-about')},h(Glyph,{kind:'book',size:20}),h('span',null,'套件版本说明')),
    !collapsed&&h('details',{className:'qcu-maintenance'},h('summary',{className:'qcu-footer-row'},h(Glyph,{kind:'chevron',size:20}),h('span',null,'维护与高级选项')),h('div',{className:'qcu-maintenance-items'},h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('plugins')},'插件管理'),maintenance.map(o=>h('button',{key:o.id,type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel(o.id)},typeof o.label==='function'?o.label():o.label??o.id)),renderSlot('sidebar.footer.action',{})))),
   h('button',{className:'qcu-button quiet',type:'button','aria-label':collapsed?'展开导航':'收起导航',onClick:toggleSidebar},h(Glyph,{kind:collapsed?'menu':'chevron',size:18})));
 }
 function Home({ctx,preferences,homeState,guide=false}) {
  const workspaces=useSource(ctx.workspaces.list),sessions=useSource(ctx.sessions.list),prefs=useSource(preferences);
  const {selected,drafts,workspaceId,firstTaskDone}=useSource(homeState);
  const setSelected=value=>homeState.update({selected:value});
  const setDrafts=value=>homeState.update({drafts:value});
  const setWorkspace=value=>homeState.update({workspaceId:value});
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const task=teachingTasks.find(t=>t.id===selected)??teachingTasks[0];
  const draft=drafts[selected]??task.prompt;
  const effectiveWorkspace=workspaces.items.some(w=>w.workspaceId===workspaceId)?workspaceId:(workspaces.items[0]?.workspaceId??'');
  const recent=recentTasks(sessions,workspaces);
  const start=async()=>{setError('');setBusy(true);try{await openTeachingDraft(ctx,effectiveWorkspace,draft);if(guide)homeState.update({guideStep:2,draftOpened:true});}catch{setError('暂时无法打开任务，填写的要求已保留。请确认工作文件夹可用后重试；如已创建空白任务，可在左侧打开检查。');}finally{setBusy(false);}};
  return h('div',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},
   !guide&&h('header',{className:'qcu-home-top'},h('div',null,h('h1',null,'从一堂好课开始'),h('p',{className:'qcu-muted'},'准备教学材料，继续课程，让想法落到课堂。')),
    h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-button quiet','aria-pressed':prefs.large,onClick:()=>preferences.setLarge(!prefs.large)},prefs.large?'使用普通字号':'使用大字模式'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},'使用指南'))),
   !guide&&h('section',{className:'qcu-first-task'},h('span',null,firstTaskDone?'首次任务已完成，可随时回看步骤。':'第一次使用：从模型设置到打开一份匿名任务草稿。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},firstTaskDone?'回看首次任务步骤':'开始首次任务指引')),
   h('div',{className:'qcu-compose-grid'},h('section',{className:'qcu-task-sheet','aria-label':'开始教学任务'},h('h2',null,'今天想准备什么？'),
    h('div',{className:'qcu-task-tabs','aria-label':'选择教学任务'},(guide?teachingTasks:teachingTasks.slice(0,3)).map(t=>h('button',{type:'button',key:t.id,'aria-pressed':selected===t.id,onClick:()=>{setSelected(t.id);setError('');}},t.title)),!guide&&h('button',{type:'button','aria-pressed':!teachingTasks.slice(0,3).some(t=>t.id===selected),onClick:()=>ctx.layout.selectPanel('qcu-teacher-tools')},'更多教学工具')),
    h('p',{className:'qcu-muted'},task.brief),guide&&h('button',{type:'button',className:'qcu-button',onClick:()=>setDrafts({...drafts,[selected]:task.prompt+'\n匿名练习示例：虚构通识课堂，45分钟，主题为区分论点与证据。请先询问缺失信息。'})},'填入匿名示例（替换当前任务要求）'),h('label',{className:'qcu-field'},h('span',null,'任务要求 · 可以直接修改'),h('textarea',{'aria-label':'任务要求',value:draft,maxLength:12000,disabled:busy,onChange:e=>setDrafts({...drafts,[selected]:e.target.value})})),
    h('label',{className:'qcu-field'},h('span',null,'工作文件夹'),h('select',{'aria-label':'工作文件夹',value:effectiveWorkspace,disabled:busy||!workspaces.items.length,onChange:e=>setWorkspace(e.target.value)},!workspaces.items.length&&h('option',{value:''},workspaces.phase==='ready'?'请先在左侧创建工作文件夹':'正在读取工作文件夹…'),workspaces.items.map(w=>h('option',{value:w.workspaceId,key:w.workspaceId},w.label??w.title??w.name??w.path)))),
    error&&h('p',{role:'alert',className:'qcu-notice'},error),
    h('div',{className:'qcu-task-bottom'},h('p',{className:'qcu-muted'},'打开后可继续修改、添加资料；由你确认发送。'),h('button',{type:'button',className:'qcu-button primary',disabled:busy||!effectiveWorkspace||!draft.trim(),onClick:start},busy?'正在打开…':'在对话中继续'))),
   h('section',{className:'qcu-recent-section'},h('h2',null,'继续最近的任务'),sessions.phase!=='ready'?h('p',{className:'qcu-muted'},'正在读取最近任务…'):recent.length?h('ul',{className:'qcu-recent'},recent.map(s=>h('li',{key:s.sessionId},h('button',{type:'button',onClick:()=>ctx.uiWorkspace.openSession(s.sessionId)},s.title||'未命名任务')))):h('div',{className:'qcu-empty'},h('p',null,'还没有教学任务。'),h('p',{className:'qcu-muted'},'从上面的备课开始，发送后的任务会出现在这里。')))),
    h('div',{className:'qcu-lower'},h('aside',null,h('section',{className:'qcu-course-link'},h('h2',null,'课程工作台'),h('p',{className:'qcu-muted'},'围绕课程组织资料、生成草案，审阅后再保存。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-course-workbench')},'进入课程工作台')),
     null)),
   h('details',null,h('summary',null,'外观设置'),h('div',{className:'qcu-toolbar'},['light','dark','system'].map((mode,i)=>h('button',{type:'button',className:'qcu-button',key:mode,'aria-pressed':prefs.preference===mode,onClick:()=>ctx.theme.setTheme(mode)},['浅色','深色','跟随系统'][i]))))));
 }
 function Tools({ctx,onChoose}) {
  return h('div',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},h('header',{className:'qcu-home-top'},h('div',null,h('h1',null,'教学工具'),h('p',{className:'qcu-muted'},'选择一项任务，补充背景和资料后，在对话中开始。'))),h('ul',{className:'qcu-tool-list'},teachingTasks.map(t=>h('li',{key:t.id},h('strong',null,t.title),h('p',null,t.brief),h('p',{className:'qcu-muted'},'准备：'+t.materials),h('button',{type:'button',className:'qcu-button',onClick:()=>onChoose(t.id)},'使用'+t.title)))),h('section',{className:'qcu-notice'},h('h2',null,'飞书文档只读'),h('p',null,'需本人授权及一个明确的文档链接。先读取目录，再选择要读的一节；不会批量扫描或修改文档。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('plugins')},'查看插件与配置'))));
 }
 function Help({ctx,preferences,homeState}){return h('div',{className:'qcu-teacher qcu-home'},h('article',{className:'qcu-home-inner'},h('h1',null,'开始使用 QCU助手'),h(FirstTaskGuide,{ctx,preferences,homeState}),
  h('section',{'aria-label':'按问题查看帮助'},h('h2',null,'遇到问题'),h('p',{className:'qcu-muted'},'选择符合眼前提示的一项，展开查看处理办法。'),problemHelp.map(topic=>h('details',{key:topic.id},h('summary',null,topic.title),h('p',null,topic.text)))),
  h('details',null,h('summary',null,'配置与使用参考'),
  h('section',{className:'qcu-notice'},h('h2',null,'先配置自己的模型'),h('ol',null,h('li',null,'点击左下角“设置”，选择“模型”。'),h('li',null,'在对应服务商中填写你自己的 API Key 并保存。使用内置 DeepSeek 时保留默认服务地址。'),h('li',null,'回到教学首页，填写任务要求，点击“在对话中继续”。确认资料和模型后再发送。')),h('p',null,'API Key 是个人密钥，只在模型设置中填写，不要贴进对话、截图或分享给他人。预装技能可以离线加载，调用在线模型仍需联网和服务额度。')),
  h('h2',null,'用一次备课熟悉流程'),h('p',null,'选择“备课教案”，补充课程主题、学生情况、课时与目标。进入对话后，可添加已核对的资料，确认后发送。要求不完整时，先补充信息再生成。'),
  h('h2',null,'课程成果怎样保存'),h('p',null,'在课程工作台选择工作文件夹与课程，添加参考资料，选择教学组件。确认模型使用的资料后生成草稿，审阅、修改、应用，再选择位置并保存。预览或应用不代表文件已保存；以保存成功提示和实际文件位置为准。'),
  h('p',{className:'qcu-muted'},'套件目录内另附“QCU助手使用指南.html”，可离线查阅七项技能的示例。'))));}
 function FirstTaskGuide({ctx,preferences,homeState}){
  const state=useSource(homeState),step=state.guideStep??0,heading=React.useRef(null);
  React.useEffect(()=>{heading.current?.focus()},[step]);
  const titles=['查看模型设置','准备匿名任务','手动发送并审阅','确认自己的完成情况'];
  const move=n=>homeState.update({guideStep:n,viewed:true});
  return h('section',{className:'qcu-first-guide','aria-label':'首次任务指引'},h('h2',{tabIndex:-1,ref:heading},titles[step]),h('p',{role:'status'},`第 ${step+1} / 4 步；${state.firstTaskDone?'你已确认完成首次任务':'按步骤准备你的首次任务'}。`),
   step===0&&h('div',null,h('p',null,'打开左下角“设置 → 模型”，只在官方模型设置中填写自己的 Key 并保存。这里不会读取或验证 Key。'),state.openSettings&&h('button',{type:'button',className:'qcu-button',onClick:state.openSettings},'打开官方设置'),h('p',{className:'qcu-muted'},'设置内选择“模型”；回到本页后继续。')),
   step===1&&h(Home,{ctx,preferences,homeState,guide:true}),
   step===2&&h('div',null,h('p',null,state.draftOpened?'已打开一份对话草稿，请检查后自行发送。':'请回到对话检查草稿，或返回上一步重新准备。'),h('p',null,'在对话中检查实际模型与匿名材料，由你点击发送。得到结果后核对知识、数字和来源，再回本页继续。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel(null)},'回到对话检查草稿')),
   step===3&&h('div',null,h('p',null,'请在你已发送任务并检查结果后，点击下方按钮确认完成。'),h('button',{type:'button',className:'qcu-button primary',onClick:()=>homeState.update({firstTaskDone:true,viewed:true})},'我已发送并审阅首次任务')),
   h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-button',disabled:step===0,onClick:()=>move(step-1)},'上一步'),step<3&&h('button',{type:'button',className:'qcu-button',onClick:()=>move(step+1)},step===0?'已查看说明，继续':'下一步'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-home')},'稍后继续'),h('button',{type:'button',className:'qcu-button quiet',onClick:()=>homeState.update({guideStep:0,firstTaskDone:false,draftOpened:false,viewed:false})},'重置指引进度')),
   h('p',{className:'qcu-muted'},'只保存步骤、任务选择和你的完成确认；草稿仍只留本次内存。重置指引不修改设置或草稿。'),h('details',null,h('summary',null,'完成记录说明'),h('p',null,'完成来自你的确认；这里不读取或验证 Key、模型结果或教学效果。旧教程标记不代表任务完成。系统不允许保存进度时，重开后会清除步骤。')));
 }
 function About(){return h('div',{className:'qcu-teacher qcu-home'},h('article',{className:'qcu-home-inner'},h('h1',null,'套件版本说明'),h('p',null,'QCU清蓝主题测试版'),h('dl',null,h('dt',null,'教师主题'),h('dd',null,'QCU清蓝 0.2.6-pilot.2'),h('dt',null,'支持的客户端基线'),h('dd',null,'DeepSeek Harness 0.2.0-rc.2（非本机检测）'),h('dt',null,'实际应用与套件版本'),h('dd',null,'请查看当前应用随包收据；单独更新主题不会更新客户端。')),h('section',{className:'qcu-notice'},h('h2',null,'由维护者统一更新'),h('p',null,'维护者会核对客户端、技能、插件和配置保留情况，再交付完整QCU套件。拿到新版后按随包说明更新即可。'),h('p',null,'模型服务要求更高版本时，请联系维护人员获取新版套件。'))));}

 return {Sidebar,Home,Tools,Help,About,Mark,Name,Glyph,HeaderNavigation,SettingsLauncher};
}

function createTeacherPlugin(React,icon) {
 const {Sidebar,Home,Tools,Help,About,Mark,Name,HeaderNavigation,SettingsLauncher}=createTeacherViews(React,icon),h=React.createElement;
 return {inject:['slots','layout','theme','locale','uiWorkspace','sessions','workspaces','conversation'],apply(ctx){
  ctx.effect(()=>ctx.theme.overrideTokens('qcu-branding',pairedTokens));
  ctx.effect(()=>{
   const tag=document.createElement('style');tag.dataset.plugin='qcu-branding';tag.textContent=teacherStyles;document.head.append(tag);document.body.setAttribute('data-qcu-teacher','');
   return()=>{tag.remove();document.body.removeAttribute('data-qcu-teacher');};
  });
  const preferences=createTeacherPreferences(ctx);
  ctx.effect(()=>()=>preferences.dispose());
  const homeState=createTeacherHomeState();
  ctx.effect(()=>()=>homeState.dispose());
  function HomePanel(){return h(Home,{ctx,preferences,homeState});}
  const chooseTask=id=>{homeState.update({selected:id});ctx.layout.selectPanel('qcu-teacher-home');};
  ctx.slots.inject('main',function*(){
   yield ctx.slots.register({name:'main',key:'qcu-teacher-home'},HomePanel);
   yield ctx.slots.register({name:'main',key:'qcu-teacher-tools'},()=>h(Tools,{ctx,onChoose:chooseTask}));
   yield ctx.slots.register({name:'main',key:'qcu-teacher-help'},()=>h(Help,{ctx,preferences,homeState}));
   yield ctx.slots.register({name:'main',key:'qcu-teacher-about'},About);
  });
  // Preserve the host-owned workspace browser, settings/onboarding and footer actions.
  const children=Object.fromEntries(['sidebar.brand.mark','sidebar.brand.name','sidebar.toggle.badge','sidebar.workspaces','sidebar.settings'].map(n=>[n,{kind:'single',scope:'root'}]));
  children['sidebar.panellist']={kind:'list',scope:'root'};children['sidebar.footer.action']={kind:'list',scope:'root'};
  ctx.slots.inject('sidebar',()=>ctx.slots.register({name:'sidebar',priority:-10,children},props=>h(Sidebar,{...props,ctx,toggleSidebar:()=>ctx.layout.toggleSidebar()})));
  ctx.slots.inject('shell.leading',()=>ctx.slots.register({name:'shell.leading'},()=>h(HeaderNavigation,{ctx})));
  function PublicSettingsLauncher(props){React.useEffect(()=>{homeState.update({openSettings:props.openSettings});return()=>homeState.update({openSettings:null})},[props.openSettings]);return h(SettingsLauncher,props);}
  ctx.slots.inject('settings.launcher',()=>ctx.slots.register({name:'settings.launcher',priority:-10},PublicSettingsLauncher));
  ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.register({name:'sidebar.brand.mark'},Mark));
  ctx.slots.inject('sidebar.brand.name',()=>ctx.slots.register({name:'sidebar.brand.name'},Name));
  ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark'},Mark));
  // A new/blank workspace opens the teacher home. Existing substantive sessions stay open.
  let initial=true,queued=false,active=true;
  ctx.effect(()=>()=>{active=false;});
  const showInitialHome=()=>{
   if(!initial||queued)return;
   queued=true;
   // Workspace publishes selection before revealing the conversation in the same
   // stack. Wait until that navigation settles, rather than being overwritten.
   queueMicrotask(()=>{
    queued=false;if(!initial||!active)return;
    const ws=ctx.workspaces.list.getSnapshot(),ss=ctx.sessions.list.getSnapshot(),id=ctx.uiWorkspace.selection.getSnapshot().sessionId;
    if(ws.phase!=='ready'||ss.phase!=='ready')return;
    if(!ctx.slots.entries('main').some(row=>row.options.key==='qcu-teacher-home'))return;
    if(!id&&ws.items.length)return;
    if(id&&!ss.byId[id])return;
    initial=false;
    if(!id||ss.byId[id].blank)ctx.layout.selectPanel('qcu-teacher-home');
   });
  };
  ctx.effect(()=>{const stops=[ctx.workspaces.list.subscribe(showInitialHome),ctx.sessions.list.subscribe(showInitialHome),ctx.uiWorkspace.selection.subscribe(showInitialHome),ctx.slots.subscribe('main',showInitialHome)];showInitialHome();return()=>stops.forEach(stop=>stop());});
 }};
}

function createTeacherPreferences(ctx) {
 const listeners=new Set();
 // Preserve the existing one-time locale default; the host owns font persistence.
 try{if(localStorage.getItem('qcu.teacher.initialized.v1')!=='yes'){ctx.locale.setLocale('zh');localStorage.setItem('qcu.teacher.initialized.v1','yes');}}catch{}
 // Legacy QCU readability flags do not control the host font setting.
 let snapshot;
 function refresh(){const theme=ctx.theme.getTheme();snapshot={fontSize:theme.fontSize,large:theme.fontSize>=18,preference:theme.preference};for(const fn of listeners)fn();}
 refresh();
 const off=ctx.on('theme/change',refresh);
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setLarge(value){ctx.theme.setFontSize(value?18:14);},dispose(){off();listeners.clear();}};
}

function createTeacherHomeState({storage,tasks=teachingTasks}={}) {
 const key='qcu.teacher.first-task.v2';let saved=null;
 try{storage??=globalThis.localStorage;const raw=storage?.getItem(key);if(raw&&raw.length<=512){const v=JSON.parse(raw);if(v&&Object.keys(v).sort().join()==='completed,schema,step,taskId,viewed'&&v.schema===2&&Number.isInteger(v.step)&&v.step>=0&&v.step<=3&&tasks.some(t=>t.id===v.taskId)&&typeof v.completed==='boolean'&&typeof v.viewed==='boolean')saved=v;}}catch{}
 let snapshot={selected:saved?.taskId??tasks[0].id,drafts:{},workspaceId:'',guideStep:saved?.step??0,firstTaskDone:saved?.completed??false,viewed:saved?.viewed??false,draftOpened:false,openSettings:null};
 const listeners=new Set();
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},update(patch){snapshot={...snapshot,...patch};
  if(['selected','guideStep','firstTaskDone','viewed'].some(k=>Object.hasOwn(patch,k)))try{storage?.setItem(key,JSON.stringify({schema:2,step:snapshot.guideStep,taskId:snapshot.selected,viewed:snapshot.viewed,completed:snapshot.firstTaskDone}));}catch{}
  for(const fn of listeners)fn();},dispose(){listeners.clear();}};
}

  return createTeacherPlugin(React,icon);
}});
