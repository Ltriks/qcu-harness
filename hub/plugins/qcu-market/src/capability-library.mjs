import {departmentSuites} from './department-suites.mjs'
// Curated presentation metadata, independent of signed release/install identities.
export const expertTeams = Object.freeze({
 'qcu-deep-research': {members:7,labels:['联网研究','独立审稿'],source:'市场包归档适配',result:'研究报告、来源清单与审稿意见'},
 'qcu-document-team': {members:4,labels:['资料整理','文档编写'],source:'市场包归档适配',result:'文档大纲、正文草案与核对记录'},
 'qcu-data-copilot': {members:6,labels:['代码分析','数据可视化'],source:'社区改编',result:'分析脚本、图表与分析报告'},
 'qcu-ket-prep': {members:6,labels:['学情诊断','备考练习'],source:'社区改编',result:'学习计划、专项练习与复习材料'},
 'qcu-ncre-prep': {members:5,labels:['备考规划','代码练习'],source:'社区改编',result:'备考方案、练习与错题辅导'},
 'qcu-expert-teams': {labels:['文字评审'],source:'QCU 自有',result:'多角度评审意见',legacy:true},
})
export function capabilityKind(item){return expertTeams[item.id]?'teams':item.kind==='skill'||item.capabilities?.includes('skill')?'skills':'plugins'}
export function matchesCapability(item,category){return category==='all'||capabilityKind(item)===category}
export const workGroups=[['all','全部'],['writing','材料写作'],['meetings','会议纪要'],['tables','表格分析'],['reports','汇报准备'],['teaching','教学准备'],['departments','科系专区'],['other','其他能力']]
// Built-in conversation tasks prepare user-editable drafts, not installed Skills or file exporters.
export const officeTasks=[
 {id:'qcu-office-polish',title:'润色和整理材料',purpose:'保留原意，得到一份可继续修改的文字稿和改动说明。',workGroup:'writing',placeholder:'粘贴原稿，补充读者、用途、字数和希望保留的表达。',instructions:'保留原意和已提供的事实，先简要说明修改重点，再给出修订稿。缺少的事实、数字、政策和出处标为待补充，不编造。'},
 {id:'qcu-office-notice',title:'起草通知与说明',purpose:'把事项、时间和行动要求整理成清楚的通知草稿。',workGroup:'writing',placeholder:'说明通知对象、事项、时间地点和需要对方完成的行动。',instructions:'根据已提供事实组织通知：适用对象、事项、时间地点、所需行动和联系方式。未知项目标为待补充；不要替用户确认未决定的安排。'},
 {id:'qcu-office-minutes',title:'整理会议纪要和待办',purpose:'从文字记录提取议题、已确认决定、待办及待确认事项。',workGroup:'meetings',placeholder:'粘贴会议文字记录，补充日期、参会角色和纪要用途。',instructions:'区分讨论观点、已确认决定和建议。待办分别列事项、负责人、期限和依据；未提供负责人或期限写待确认。不要把沉默、设想或未决事项写成已通过。'},
 {id:'qcu-office-tables',title:'核对表格和分析口径',purpose:'从表格文字识别数据问题，整理统计口径与初步分析。',workGroup:'tables',placeholder:'粘贴列名和少量示例行，说明单位、统计口径和想解决的问题。',instructions:'先确认列含义、单位、缺失和重复及统计口径，再根据实际提供的数据分析。需要计算时使用实际可用工具，未运行不能标已验证；未读取文件不能称已分析文件。明确数据不足与结论范围。'},
 {id:'qcu-office-reports',title:'准备汇报提纲',purpose:'把目标和素材组织成汇报结构、逐页要点与待补材料。',workGroup:'reports',placeholder:'说明汇报对象、目标、时长和现有素材，粘贴需要纳入的事实。',instructions:'先明确汇报目标，输出结构、逐页要点、关键证据和待补材料。区分已有结果和计划，不编造成效数字。这里交付提纲，不把文字要点称为已生成PPT文件。'}
].map(task=>({...task,conversationTask:true}))
const workLabels={
 'qcu-hallmark-design':['teaching','制作互动教学网页'],
 'qcu-lesson-planning':['teaching','设计教案与课堂活动'],
 'qcu-tiered-practice':['teaching','制作分层练习'],
 'qcu-note-organizer':['teaching','整理课堂笔记'],
 'qcu-reading-outline':['teaching','梳理教材知识结构'],
 'qcu-study-coach':['teaching','制定复习计划'],
 'qcu-integrity-guard':['writing','核对引文与资料出处'],
 'qcu-team-briefing':['meetings','整理教研会议简报'],
 'qcu-accounting-suite':['departments','选择会计教学任务'],
 'qcu-accounting-journals':['departments','设计会计分录练习'],
 'qcu-accounting-vouchers':['departments','检查模拟记账凭证'],
 'qcu-accounting-statements':['departments','核对教学报表勾稽'],
 'qcu-accounting-lessons':['departments','设计会计课堂案例']
}
export function taskPresentation(item){const label=workLabels[item.id];return {workGroup:item.workGroup??label?.[0]??(item.packageId?'departments':'other'),workTitle:label?.[1]??item.title}}
export function projectInstalledSkills(entries,bundles,plugins){
 const known=[...entries,...Object.values(departmentSuites).filter(s=>!entries.some(e=>e.id===s.id)).map(s=>({id:s.id,title:s.title,purpose:s.description,kind:'bundle',capabilities:['skill'],release:{id:s.id,skill:s.id,version:s.version}}))];
 const seen=new Set();return known.filter(item=>capabilityKind(item)==='skills'&&!seen.has(item.id)&&seen.add(item.id)).flatMap(item=>{
  const matches=bundles.filter(b=>b.name===item.id&&b.installed===true);if(!matches.length)return [];
  const bundle=matches[0],rows=plugins.filter(p=>p.moduleName===item.id);
  const state=matches.length!==1?'conflict':bundle.error?'failed':!bundle.enabled?'installed-disabled':rows.length!==1?'conflict':rows[0].fiberPhase==='failed'?'failed':!rows[0].enabled?'row-disabled':rows[0].fiberPhase==='active'?'component-active':'restart-or-pending';
  const root={...item,installedVersion:bundle.version??null,localStatus:{state,installedVersion:bundle.version??null}},suite=departmentSuites[item.id];
  if(!suite||suite.version!==bundle.version)return [root];
  return suite.skills.map(skill=>({...root,id:skill.id,skillName:skill.id,packageId:item.id,packageTitle:suite.title,title:skill.title,purpose:skill.description,kind:'skill',capabilities:['skill']}))
 }).map(item=>({...item,...taskPresentation(item)}))
}
export class InstalledSkillInventory{
 constructor(manager,entries,publish){this.manager=manager;this.entries=entries;this.publish=publish;this.flows=new Map();this.closed=false;this.generation=0;this.pending=null;this.items=[]}
 flow(id){if(!this.flows.has(id)){let snapshot={status:null};const listeners=new Set();this.flows.set(id,{snapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},status:async()=>{await this.refresh();return this.flows.get(id)?.snapshot().status},set:status=>{snapshot={status};for(const fn of listeners)fn()}})}return this.flows.get(id)}
 async refresh(){
  if(this.closed)return;if(this.pending)return this.pending;const generation=this.generation;
  this.publish({localSkills:{phase:'loading',items:this.items}});
  const decode=r=>{if(!r?.ok||!Array.isArray(r.value))throw Error('无法读取本机安装状态');return r.value};
  const pending=(async()=>{try{const [bundles,plugins]=await Promise.all([this.manager.listBundles(),this.manager.listPlugins()]);if(this.closed||generation!==this.generation)return;const items=projectInstalledSkills(this.entries(),decode(bundles),decode(plugins));this.items=items;
   for(const [id,flow] of this.flows)if(!items.some(i=>i.id===id))flow.set({state:'not-installed'});
   for(const item of items)this.flow(item.id).set(item.localStatus);
   this.publish({localSkills:{phase:'ready',items},localSkillFlows:Object.fromEntries(this.flows)})
  }catch{if(this.closed||generation!==this.generation)return;for(const flow of this.flows.values())flow.set(null);this.publish({localSkills:{phase:'error',items:[],error:'暂时无法读取已安装技能，请重新检查本机连接。'}})}})();this.pending=pending;try{await pending}finally{if(this.pending===pending)this.pending=null}
 }
 dispose(){this.closed=true;this.generation++;for(const flow of this.flows.values())flow.set(null)}
}
export async function launchSkillDraft(runtime,{item,workspaceId,task}){
 const skillName=item.skillName??item.release?.skill;
 if(capabilityKind(item)!=='skills'||!/^qcu-[a-z0-9-]+$/.test(skillName??'')||skillName!==item.id)throw Error('该项目不是可直接使用的技能。');
 if(typeof task!=='string'||!task.trim()||task.length>12000)throw Error('请填写任务要求，最多12000字。');
 const workspaceReady=()=>runtime.workspaces.list.getSnapshot().items.some(w=>w.workspaceId===workspaceId);
 if(!workspaceReady())throw Error('请先选择可用工作文件夹。');
 if(await runtime.isSkillActive(item.id)!==true)throw Error('技能尚未启用或状态已变化，请在管理安装中核对。');
 if(!workspaceReady())throw Error('工作文件夹已变化，请重新选择。');
 return openWorkDraft(runtime,workspaceId,`/${skillName}\n${task.trim()}`)
}
export async function launchOfficeDraft(runtime,{id,workspaceId,task,allowEmpty=false}){
 const entry=officeTasks.find(t=>t.id===id);if(!entry)throw Error('该对话任务不可用。');
 if(typeof task!=='string'||(!allowEmpty&&!task.trim())||task.length>12000)throw Error('请填写材料和要求，最多12000字。');
 if(!runtime.workspaces.list.getSnapshot().items.some(w=>w.workspaceId===workspaceId))throw Error('请先选择可用工作文件夹。');
 return openWorkDraft(runtime,workspaceId,`${entry.title}\n${entry.instructions}\n\n我的材料与要求：\n${task.trim()}`)
}
async function openWorkDraft(runtime,workspaceId,prompt){
 const sessionId=await runtime.sessions.create({workspaceId});let reference;
 try{reference=runtime.sessions.retain(sessionId,{source:'qcuWorkDraft'});const input=runtime.conversation.input.for(reference.binding.ctx);if(input.snapshot.draft||input.snapshot.attachmentIds?.length)throw Error('已有草稿，未覆盖');input.setDraft(prompt);runtime.uiWorkspace.openSession(sessionId);runtime.layout.selectPanel(null);return {sessionId,sent:false}}
 catch{throw Error('会话已建立但任务未发送，请在最近对话中检查；已有草稿不会覆盖。')}finally{reference?.release()}
}
export function createCapabilityLibrary(React,{marketStyles,releaseKeyOf}){
 const h=React.createElement,emptySubscribe=()=>()=>{},empty={favorites:[],pinned:[]},emptySnapshot=()=>empty,emptyWorkspaces={phase:'idle',items:[]},emptyWorkspaceSnapshot=()=>emptyWorkspaces;
 function Library({availability,onMarket,onBack,initialTask=null,onInitialTaskHandled=()=>{}}){
  const ready=React.useSyncExternalStore(availability.subscribe,availability.snapshot,availability.snapshot),personal=React.useSyncExternalStore(ready.personalization?.subscribe??emptySubscribe,ready.personalization?.snapshot??emptySnapshot,ready.personalization?.snapshot??emptySnapshot);
  const launchSection=React.useRef(null);
  const [query,setQuery]=React.useState(''),[group,setGroup]=React.useState('writing'),[favoritesOnly,setFavoritesOnly]=React.useState(false),[selected,setSelected]=React.useState(initialTask),[drafts,setDrafts]=React.useState({}),[workspaceId,setWorkspace]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  React.useEffect(()=>{const entry=officeTasks.find(t=>t.id===initialTask);if(entry){setSelected(entry.id);setGroup(entry.workGroup);onInitialTaskHandled()}},[initialTask]);
  React.useEffect(()=>{if(selected){launchSection.current?.scrollIntoView({block:'nearest'});launchSection.current?.focus()}},[selected]);
  const workspaceSource=ready.skillRuntime?.workspaces.list;const workspaces=React.useSyncExternalStore(fn=>workspaceSource?.subscribe(fn)??emptySubscribe(),()=>workspaceSource?.getSnapshot()??emptyWorkspaces,()=>workspaceSource?.getSnapshot()??emptyWorkspaces);
  React.useEffect(()=>{void ready.refreshInstalled?.()},[ready.refreshInstalled]);
  const local=ready.localSkills,allItems=[...officeTasks,...(local?.items??[])].map(item=>({...item,...taskPresentation(item)})),items=allItems.filter(e=>(group==='all'||e.workGroup===group)&&(!favoritesOnly||personal.favorites.includes(e.id))&&[e.workTitle,e.title,e.purpose].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),current=allItems.find(i=>i.id===selected),task=drafts[selected]??'',effectiveWorkspace=workspaces.items.some(w=>w.workspaceId===workspaceId)?workspaceId:(workspaces.items[0]?.workspaceId??'');
  const usable=item=>!!ready.skillRuntime&&(item.conversationTask||item.localStatus?.state==='component-active');
  const start=async()=>{setError('');setBusy(true);try{if(!current||!ready.skillRuntime)throw Error('任务或对话服务未就绪，请刷新后重试。');if(current.conversationTask)await launchOfficeDraft(ready.skillRuntime,{id:current.id,workspaceId:effectiveWorkspace,task});else await launchSkillDraft(ready.skillRuntime,{item:current,workspaceId:effectiveWorkspace,task})}catch(e){setError(e.message)}finally{setBusy(false)}};
  const manage=async id=>{setError('');try{await ready.onDetails(id)}catch{setError('暂时无法打开安装管理，请从“更多 → 维护与高级选项 → 插件管理”查看。')}};
  return h('section',{className:'qcu-market','aria-label':'工作助手'},h('style',null,marketStyles+libraryStyles),h('div',{className:'qcu-content'},
   h('header',{className:'qcu-app-header'},h('h1',null,'工作助手'),h('div',{className:'qcu-capability-actions'},h('button',{type:'button',className:'qcu-control',onClick:()=>onMarket()},'添加更多能力'),h('button',{type:'button',className:'qcu-control',disabled:!ready.refreshInstalled||local?.phase==='loading',onClick:()=>ready.refreshInstalled()},'刷新已安装'),h('button',{type:'button',className:'qcu-control',onClick:onBack},'返回对话'))),
   h('p',{className:'qcu-work-intro'},'选择要完成的工作，补充材料，再到对话中确认发送。常用任务可以收藏或固定到首页。'),
   h('nav',{className:'qcu-work-groups','aria-label':'工作分类'},workGroups.filter(([key])=>key!=='other'||allItems.some(i=>i.workGroup==='other')).map(([key,label])=>h('button',{key,type:'button',className:'qcu-control','aria-label':label,'aria-pressed':group===key,onClick:()=>setGroup(key)},label))),
   h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-control','aria-pressed':favoritesOnly,onClick:()=>{setFavoritesOnly(!favoritesOnly);if(!favoritesOnly)setGroup('all')}},favoritesOnly?'显示全部任务':'只看收藏'),h('label',{className:'qcu-search'},'搜索',h('input',{type:'search',value:query,onChange:e=>{setQuery(e.target.value);setGroup('all')},placeholder:'搜索要完成的工作'}))),
   (error||personal.error)&&h('p',{role:'alert'},error||personal.error),local?.phase==='error'&&h('p',{role:'status'},'已安装功能暂时无法读取；内置对话任务仍可使用。可刷新本机连接。'),local?.phase==='loading'&&h('p',{role:'status'},'正在读取已安装功能…'),
   items.length?h('div',{className:'qcu-capability-list'},items.map(item=>h('article',{key:item.id,className:'qcu-capability','data-capability':item.id},h('div',null,h('h2',null,item.workTitle),h('p',null,item.purpose),
    h('p',{className:'qcu-hint'},item.conversationTask?'对话任务 · 使用当前对话模型':item.localStatus.state==='component-active'?'已就绪':item.localStatus.state==='installed-disabled'||item.localStatus.state==='row-disabled'?'需先启用':item.localStatus.state==='restart-or-pending'?'待重开或加载':'需检查加载状态'),
    !item.conversationTask&&h('details',{className:'qcu-work-details'},h('summary',null,'能力说明'),h('p',{className:'qcu-hint'},'技能：'+item.title),item.packageTitle&&h('p',{className:'qcu-hint'},'来自'+item.packageTitle+' · 与包统一启停和升级'),h('button',{type:'button',className:'qcu-control',onClick:()=>manage(item.packageId??item.id)},'管理安装'))),
    h('div',{className:'qcu-capability-actions'},h('button',{type:'button',className:'qcu-control qcu-primary',disabled:busy||!usable(item),'aria-expanded':selected===item.id,onClick:()=>{setSelected(item.id);setError('')}},'开始处理'),ready.personalization&&h(React.Fragment,null,h('button',{type:'button',className:'qcu-control','aria-pressed':personal.favorites.includes(item.id),onClick:()=>ready.personalization.favorite(item.id)},personal.favorites.includes(item.id)?'取消收藏':'收藏'),h('button',{type:'button',className:'qcu-control','aria-pressed':personal.pinned.includes(item.id),onClick:()=>ready.personalization.pin(item.id)},personal.pinned.includes(item.id)?'取消首页固定':'固定到首页')))))):h('p',{role:'status'},favoritesOnly?'还没有符合条件的收藏。':query?'没有匹配的工作任务。':'此分类暂未安装对应能力，可从“添加更多能力”查看。'),
   current&&(group==='all'||current.workGroup===group)&&h('section',{className:'qcu-launch','aria-label':'工作任务',ref:launchSection,tabIndex:-1},h('h2',null,current.workTitle),h('p',{className:'qcu-hint'},current.conversationTask?'先粘贴文字和要求；进入对话后可再添加文件。文件读取、计算和导出以实际可用能力为准。':'填写具体目标和材料，使用所选能力准备对话草稿。'),h('label',null,'工作文件夹',h('select',{'aria-label':'任务工作文件夹',value:effectiveWorkspace,disabled:busy||!workspaces.items.length,onChange:e=>setWorkspace(e.target.value)},!workspaces.items.length&&h('option',{value:''},'请先添加工作文件夹'),workspaces.items.map(w=>h('option',{key:w.workspaceId,value:w.workspaceId},w.title??w.label??w.path)))),h('label',null,'材料与要求',h('textarea',{'aria-label':'工作任务要求',value:task,maxLength:12000,disabled:busy,onChange:e=>setDrafts({...drafts,[selected]:e.target.value}),placeholder:current.placeholder??'说明你的目标、对象和材料，写清希望得到的结果。'})),h('p',{className:'qcu-hint'},'下一步会打开草稿，由你检查后手动发送。'),h('button',{type:'button',className:'qcu-control qcu-primary',disabled:busy||!effectiveWorkspace||!task.trim()||!usable(current),onClick:start},busy?'正在打开…':'打开对话草稿'),h('button',{type:'button',className:'qcu-control',disabled:busy,onClick:()=>setSelected(null)},'稍后处理'))))
 }
 function Entry(){return h('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},h('rect',{x:3,y:3,width:18,height:18,rx:2}),h('path',{d:'M7 8h10M7 12h10M7 16h6'}))}
 return {Library,Entry}
}
const libraryStyles=`
.qcu-market .qcu-app-header{flex-wrap:wrap;align-items:flex-start}.qcu-market .qcu-capability>div:first-child{min-width:0}
.qcu-market .qcu-work-intro{margin:16px 0 20px;max-width:70ch}.qcu-market .qcu-work-groups{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.qcu-market .qcu-capability-list{margin-top:20px}.qcu-market .qcu-work-details{margin-top:8px}.qcu-market .qcu-work-details summary{font-size:13px;color:var(--dsw-alias-label-secondary)}
.qcu-market .qcu-capability{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 0;border-bottom:1px solid var(--dsw-alias-border-l3)}
.qcu-market .qcu-capability h2{margin:0 0 8px;font-size:18px}.qcu-market .qcu-capability p{margin:6px 0;max-width:70ch}
.qcu-market .qcu-capability-actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}
.qcu-market .qcu-launch{max-width:700px;margin-top:28px}.qcu-market .qcu-launch label{display:flex;flex-direction:column;gap:8px;margin:20px 0}
.qcu-market .qcu-launch textarea,.qcu-market .qcu-launch select{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:6px;padding:10px;min-height:44px;resize:vertical}
.qcu-market button:focus-visible,.qcu-market textarea:focus-visible,.qcu-market select:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.qcu-market button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:700px){.qcu-market .qcu-capability{align-items:flex-start;flex-direction:column;gap:12px}.qcu-market .qcu-capability-actions{width:100%}}
`
