export const VERSION='0.2.0-pilot.3.font.1', PROTOCOL=3, OUTPUT_BUDGET=6000
export const REVIEW_CHAR_LIMIT=180, FINAL_CHAR_LIMIT=600
export function check(ok,code='invalid-input'){if(!ok)throw Object.assign(Error(code),{code})}
export function exact(v,keys){check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k)),'invalid-fields');return v}
export function text(v,max=1000,required=false){check(typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)&&(!required||v.trim()),'invalid-text');return v.trim()}
export function key(v){check(typeof v==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(v),'invalid-id');return v}
const list=(v,max,parse)=>{check(Array.isArray(v)&&v.length<=max,'invalid-list');const out=v.map(parse);check(new Set(out).size===out.length,'duplicate-id');return out}
export function parseTeam(raw){
 exact(raw,['format','schemaVersion','id','name','description','members','outputId','parallelism'])
 check(raw.format==='qcu-expert-team'&&[1,2].includes(raw.schemaVersion),'unsupported-team')
 check(Array.isArray(raw.members)&&raw.members.length>=1&&raw.members.length<=6,'member-limit')
 const members=raw.members.map(m=>{
  if(raw.schemaVersion===2){exact(m,['id','expertId','assignment','dependsOn']);return {id:key(m.id),expertId:key(m.expertId),assignment:text(m.assignment,2000),dependsOn:list(m.dependsOn,6,key)}}
  exact(m,['id','name','instructions','skillNames','dependsOn']);return {id:key(m.id),name:text(m.name,80,true),instructions:text(m.instructions,4000,true),skillNames:list(m.skillNames,4,key),dependsOn:list(m.dependsOn,6,key)}
 })
 if(raw.schemaVersion===2)check(new Set(members.map(m=>m.expertId)).size===members.length,'duplicate-expert')
 const ids=new Set(members.map(m=>m.id));check(ids.size===members.length,'duplicate-id')
 const outputId=key(raw.outputId);check(ids.has(outputId),'missing-output')
 const visiting=new Set(),done=new Set()
 function visit(id){check(ids.has(id),'missing-dependency');check(!visiting.has(id),'cyclic-dependency');if(done.has(id))return;visiting.add(id);for(const dep of members.find(m=>m.id===id).dependsOn)visit(dep);visiting.delete(id);done.add(id)}
 visit(outputId);check(done.size===members.length,'disconnected-member')
 check(Number.isInteger(raw.parallelism)&&raw.parallelism>=1&&raw.parallelism<=3,'invalid-parallelism')
 return {format:'qcu-expert-team',schemaVersion:raw.schemaVersion,id:key(raw.id),name:text(raw.name,100,true),description:text(raw.description,500),members,outputId,parallelism:raw.parallelism}
}
export function parseExpert(raw){
 exact(raw,['format','schemaVersion','id','name','description','instructions','skillNames'])
 check(raw.format==='qcu-expert'&&raw.schemaVersion===1,'unsupported-expert')
 return {format:'qcu-expert',schemaVersion:1,id:key(raw.id),name:text(raw.name,80,true),description:text(raw.description,300),instructions:text(raw.instructions,4000,true),skillNames:list(raw.skillNames,4,key)}
}
export function parseBundle(raw){
 exact(raw,['format','schemaVersion','team','experts'])
 check(raw.format==='qcu-expert-team-bundle'&&raw.schemaVersion===1,'unsupported-team')
 const team=parseTeam(raw.team);check(team.schemaVersion===2,'unsupported-team');check(Array.isArray(raw.experts)&&raw.experts.length<=6,'member-limit')
 const experts=raw.experts.map(parseExpert),ids=new Set(experts.map(e=>e.id));check(ids.size===experts.length,'duplicate-id');check(team.members.every(m=>ids.has(m.expertId)),'expert-not-found')
 check(experts.length===new Set(team.members.map(m=>m.expertId)).size,'invalid-fields');return {team,experts}
}
export function parseRoute(raw,withPolicy=true){
 exact(raw,['provider','model','policy']);const result={provider:text(raw.provider,200,true),model:text(raw.model,200,true)}
 if(!withPolicy)return result
 const p=exact(raw.policy,['effort','supportedEfforts','defaultEffort','outputBudget'])
 const efforts=list(p.supportedEfforts,32,v=>{check(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v),'invalid-model-policy');return v}).sort()
 check(p.defaultEffort===null||efforts.includes(p.defaultEffort),'invalid-model-policy')
 const effort=efforts.includes('low')?'low':efforts.includes('off')?'off':'default'
 check(p.effort===effort&&p.outputBudget===OUTPUT_BUDGET,'invalid-model-policy')
 return {...result,policy:{effort,supportedEfforts:efforts,defaultEffort:p.defaultEffort,outputBudget:OUTPUT_BUDGET}}
}
export function policyFor(info){const efforts=info.reasoning?.efforts?.map(e=>e.id)??[];return parseRoute({provider:'policy',model:'policy',policy:{effort:efforts.includes('low')?'low':efforts.includes('off')?'off':'default',supportedEfforts:efforts,defaultEffort:info.reasoning?.defaultEffort??null,outputBudget:OUTPUT_BUDGET}}).policy}
export const sameRoute=(a,b)=>JSON.stringify(parseRoute(a))===JSON.stringify(parseRoute(b))
export const errors={
 'cleanup-selection':'请先选择要备份或清理的已结束记录。','cleanup-running':'所选记录仍在运行或保存，不能清理或备份；请等待结束。','cleanup-limit':'清理预览过多，请取消旧预览后重试。','cleanup-expired':'清理预览已失效或内容已变化，请重新选择并预览。','cleanup-consent':'请核对工作区和所选记录，再明确确认清理。',
 'unsupported-expert':'请选择QCU专家配置。','duplicate-expert':'同一专家在团队中只需添加一次。','expert-not-found':'专家已不存在，请重新选择成员。','expert-archived':'专家已归档，请先恢复或更换成员。','expert-limit':'专家库最多保存120位专家，请先整理已有资料。','stale-expert':'专家资料已更新，请重新读取后保存。','expert-in-use':'这位专家仍被专家团使用，请先调整团队成员。','expert-changed':'专家资料已变化，请重新预览并确认本次任务。','team-archived':'专家团已归档，请先恢复。','unsaved':'请先保存当前更改。',
 'invalid-fields':'配置包含不支持的字段，请使用本插件导出的团队文件。','invalid-text':'文字为空、过长或包含无效字符。','invalid-id':'成员或团队标识无效。','invalid-list':'技能或依赖列表无效。','duplicate-id':'标识重复，请为每个成员使用不同标识。','unsupported-team':'请选择 QCU 专家团配置文件。','member-limit':'专家团需有 1–6 位成员。','missing-output':'请选择最终汇总成员。','missing-dependency':'依赖的成员不存在。','cyclic-dependency':'成员依赖形成了循环，请调整先后关系。','disconnected-member':'所有成员都必须直接或间接参与最终汇总。','invalid-parallelism':'同时执行人数必须为 1–3。','stale-team':'配置已有变化，请重新读取后保存。','team-not-found':'团队不存在，请刷新列表。','skill-unavailable':'所选技能已不可用，请重新选择。','model-not-configured':'请先在 DSH 设置中配置默认模型。','model-policy-unavailable':'模型能力读取失败，请检查模型设置后重新准备。','model-policy-changed':'模型或推理设置已变化，请重新准备并确认。','model-selection-changed':'默认模型已变化，请重新准备。','invalid-model-policy':'模型能力信息无效，请重新准备。','model-failed':'本步骤未正常完成，未继续后续依赖步骤。','model-max-tokens':'模型输出达到上限，本步骤未完成。','model-unexpected-blocks':'模型返回了本版不支持的工具请求。','output-too-large':'返回内容过长，本步骤已停止。','prepare-expired':'运行预览已过期或失效，请重新准备。','run-busy':'当前工作区已有运行任务。','run-not-found':'运行记录不存在。','consent-required':'请核对预览并确认本次模型调用。','idempotency-conflict':'请求标识已被其他任务使用，请重新准备。','plugin-stopped':'专家团插件已停用。','workspace-not-found':'工作区不存在，请重新选择。','workspace-changed':'工作区位置已变化，请重新连接。','workspace-limit':'打开的工作区过多，请重启插件。','unsafe-store':'工作区存储位置无效或含符号链接。','state-write-failed':'本地记录保存失败，已停止继续调用模型。','invalid-store':'本地记录无法读取，请保留文件并联系维护者。','store-limit':'本地存储已达上限（最多50次运行、8MB，含配置与结果）。请先备份，再选择已结束的记录清理；不会自动删除。','cancelled':'已停止本次运行。','step-timeout':'本步骤超时，未自动重试。','operation-failed':'操作未完成，请刷新核对原记录。'
}
export const safeCode=e=>Object.hasOwn(errors,e?.code)?e.code:'operation-failed'
const codec=(symbol,max)=>({mode:'strict',typeSymbol:'qcu-expert-teams#'+symbol,create:()=>({parse(value){check(typeof value==='string'&&value.length<=max,'invalid-fields');JSON.parse(value);return value}})})
export const remoteContribution={package:'qcu-expert-teams',descriptors:[{id:'qcu-expert-teams#qcuTeams/dispatch',service:'qcuTeams',namespace:'qcuTeams',method:'dispatch',invocation:{kind:'direct'},parameters:[{name:'payload',wire:'payload',source:'json',codec:codec('request',500000)}],cancellation:{parameter:'signal'},result:codec('reply',10000000)}]}
