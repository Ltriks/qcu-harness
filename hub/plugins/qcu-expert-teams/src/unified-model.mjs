import {check,exact,text,key} from './protocol.mjs'
const unique=(values,max,parse)=>{check(Array.isArray(values)&&values.length<=max,'invalid-list');const result=values.map(parse);check(new Set(result).size===result.length,'duplicate-id');return result}
const integer=(n,min,max)=>{check(Number.isSafeInteger(n)&&n>=min&&n<=max,'invalid-input');return n}
export function parseUnifiedTeam(raw){
 exact(raw,['schemaVersion','id','name','description','origin','roles','workflow','outputStepId','limits'])
 check(raw.schemaVersion===1,'unsupported-team')
 const origin=exact(raw.origin,['kind','id','version']);check(['template','legacy','custom'].includes(origin.kind),'invalid-input')
 check(Array.isArray(raw.roles)&&raw.roles.length>=1&&raw.roles.length<=12,'member-limit')
 const roles=raw.roles.map(r=>{exact(r,['id','name','identity','responsibility','output','tools','advanced']);return {id:key(r.id),name:text(r.name,100,true),identity:text(r.identity,1000),responsibility:text(r.responsibility,4000,true),output:text(r.output,2000,true),tools:unique(r.tools,30,n=>{check(typeof n==='string'&&/^[a-zA-Z][\w:./-]{0,149}$/.test(n)&&n!=='run_code','invalid-input');return n}),advanced:text(r.advanced,12000)}})
 const roleIds=new Set(roles.map(r=>r.id));check(roleIds.size===roles.length,'duplicate-id')
 check(Array.isArray(raw.workflow)&&raw.workflow.length>=1&&raw.workflow.length<=20,'invalid-list')
 const workflow=raw.workflow.map(s=>{
  exact(s,['id','name','roleId','dependsOn','review','requireEvidence','maxModelSteps'])
  check(roleIds.has(s.roleId)&&typeof s.requireEvidence==='boolean','expert-not-found')
  const review=s.review===null?null:exact(s.review,['reviseRoleId','maxRevisions'])
  if(review)check(roleIds.has(review.reviseRoleId)&&review.reviseRoleId!==s.roleId,'expert-not-found')
  return {id:key(s.id),name:text(s.name,100,true),roleId:s.roleId,dependsOn:unique(s.dependsOn,20,key),review:review?{reviseRoleId:key(review.reviseRoleId),maxRevisions:integer(review.maxRevisions,0,2)}:null,requireEvidence:s.requireEvidence,maxModelSteps:integer(s.maxModelSteps,1,20)}
 })
 for(const s of workflow)if(s.requireEvidence)check(roles.find(r=>r.id===s.roleId).tools.length>0,'invalid-input')
 const ids=new Set(workflow.map(s=>s.id));check(ids.size===workflow.length,'duplicate-id');check(ids.has(raw.outputStepId),'missing-output')
 const visited=new Set(),visiting=new Set();function visit(id){check(ids.has(id),'missing-dependency');check(!visiting.has(id),'cyclic-dependency');if(visited.has(id))return;visiting.add(id);for(const dep of workflow.find(s=>s.id===id).dependsOn)visit(dep);visiting.delete(id);visited.add(id)}
 visit(raw.outputStepId);check(visited.size===workflow.length,'disconnected-member')
 exact(raw.limits,['maxModelSteps','maxToolCalls','stepTimeoutMs','maxOutputTokens','reasoningEffort'])
 check(['follow-model','off','low'].includes(raw.limits.reasoningEffort??'follow-model'),'invalid-input')
 return {schemaVersion:1,id:key(raw.id),name:text(raw.name,100,true),description:text(raw.description,1000),origin:{kind:origin.kind,id:text(origin.id,150),version:text(origin.version,150)},roles,workflow,outputStepId:key(raw.outputStepId),limits:{reasoningEffort:raw.limits.reasoningEffort??'follow-model',maxOutputTokens:integer(raw.limits.maxOutputTokens??2000,1024,16384),maxModelSteps:integer(raw.limits.maxModelSteps,1,120),maxToolCalls:integer(raw.limits.maxToolCalls,0,100),stepTimeoutMs:integer(raw.limits.stepTimeoutMs,10000,300000)}}
}
export function orderedSteps(team){const result=[],seen=new Set();function visit(s){if(seen.has(s.id))return;for(const id of s.dependsOn)visit(team.workflow.find(x=>x.id===id));seen.add(s.id);result.push(s)}visit(team.workflow.find(s=>s.id===team.outputStepId));return result}
export function deepResearchTemplate(installed,id){
 check(installed?.id==='qcu-deep-research'&&!installed.unavailable,'team-not-found')
 const roles=[
  ['lead','研究主理人','研究任务协调者','梳理目标、边界、受众与资料限制；将未知项明确列出。','简明研究任务卡',[]],
  ['planner','研究策划','研究结构设计者','基于任务卡规划研究问题与大纲，不在此阶段编造研究结论。','大纲、研究问题及验证要求',[]],
  ['researcher','资料研究员','证据收集与分析者','围绕大纲实际检索公开资料，记录来源URL、时间、支持的主张和不足；不编造引用。','带可追溯来源的研究草稿',['web_search','web_fetch']],
  ['reviewer','独立审稿人','证据与论证审核者','独立核对草稿是否回答目标、引用能否支撑主张，以及缺失证据和不确定性。','审核决定、具体问题和修改要求',[]],
  ['reviser','内容修订员','定点修改者','逐条响应审核问题，只修改需要修订的内容；证据不足时明确说明，不编造来源。','修订草稿与逐条修改说明',['web_search','web_fetch']],
  ['writer','报告撰写人','研究成果整合者','根据通过审核的草稿整理完整报告，保留来源和未核实事项。','结构清晰的Markdown报告',[]],
  ['publisher','交付编辑','最终稿整理者','统一格式与引用，保留研究内容及限制；只交付正文，不部署或对外发送。','完整最终报告正文',[]],
 ].map(([id,name,identity,responsibility,output,tools])=>({id,name,identity,responsibility,output,tools,advanced:''}))
 const workflow=[['scope','明确研究范围','lead',[],null,false,2],['outline','规划研究大纲','planner',['scope'],null,false,2],['research','收集证据与研究','researcher',['outline'],null,true,10],['review','独立审核与修订','reviewer',['research'],{reviseRoleId:'reviser',maxRevisions:2},false,5],['write','撰写研究报告','writer',['review'],null,false,3],['deliver','整理交付','publisher',['write'],null,false,3]].map(([id,name,roleId,dependsOn,review,requireEvidence,maxModelSteps])=>({id,name,roleId,dependsOn,review,requireEvidence,maxModelSteps}))
 return parseUnifiedTeam({schemaVersion:1,id,name:installed.name+' · 我的团队',description:'从安装模板创建的可编辑工作副本，按明确步骤执行研究与审核。',origin:{kind:'template',id:installed.id,version:installed.revision||''},roles,workflow,outputStepId:'deliver',limits:{maxModelSteps:40,maxToolCalls:30,stepTimeoutMs:180000}})
}
export function legacyToUnified(resolved,id){
 return parseUnifiedTeam({schemaVersion:1,id,name:resolved.name+' · 工作副本',description:resolved.description||'',origin:{kind:'legacy',id:resolved.id,version:'legacy-snapshot'},roles:resolved.members.map(m=>({id:m.id,name:m.name,identity:'评审专家',responsibility:'按本角色的高级职责要求完成评审，不代写其他角色结果。',output:'本职意见，最终角色整合所有上游结果。',tools:[],advanced:m.instructions})),workflow:resolved.members.map(m=>({id:m.id,name:m.name,roleId:m.id,dependsOn:m.dependsOn,review:null,requireEvidence:false,maxModelSteps:2})),outputStepId:resolved.outputId,limits:{maxModelSteps:40,maxToolCalls:0,stepTimeoutMs:120000}})
}
export function blankUnifiedTeam(id){return parseUnifiedTeam({schemaVersion:1,id,name:'我的新团队',description:'',origin:{kind:'custom',id:'',version:''},roles:[{id:'main',name:'任务负责人',identity:'任务执行者',responsibility:'完成用户指定任务，区分事实、建议与未核验项。',output:'可审阅的任务结果。',tools:[],advanced:''}],workflow:[{id:'deliver',name:'完成任务',roleId:'main',dependsOn:[],review:null,requireEvidence:false,maxModelSteps:4}],outputStepId:'deliver',limits:{maxModelSteps:12,maxToolCalls:10,stepTimeoutMs:120000}})}
export function parseReview(output){
 const value=JSON.parse(output.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))
 exact(value,['decision','issues','summary']);check(value.decision==='pass'?value.issues?.length===0:value.issues?.length>0,'invalid-input');check(['pass','revise'].includes(value.decision)&&Array.isArray(value.issues)&&value.issues.length<=30,'invalid-input')
 return {decision:value.decision,issues:value.issues.map(s=>text(s,2000,true)),summary:text(value.summary,5000,true)}
}
