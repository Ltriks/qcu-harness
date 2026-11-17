import {randomUUID,createHash} from 'node:crypto'
import {mkdir,lstat,realpath,open,rename,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {constants} from 'node:fs'
import {check,text,parseRoute,errors} from './protocol.mjs'
import {parseUnifiedTeam,orderedSteps,parseReview} from './unified-model.mjs'
const clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>createHash('sha256').update(v).digest('hex')
const failure=message=>Object.assign(Error(message),{public:true})
const message=e=>e?.name==='TimeoutError'?'本步骤超时，未自动通过或重试。':e?.public?e.message:errors[e?.code]||'执行未完成，请查看步骤记录或原生会话；没有自动重试。'
export class UnifiedTeamStore{
 constructor(root,{generate,model,info,now=()=>Date.now()}){Object.assign(this,{root,generate,model,info,now});this.state={schemaVersion:1,teams:[],runs:[]};this.queue=Promise.resolve();this.prepared=new Map();this.jobs=new Map();this.executions=new Set();this.closed=false}
 async init(){
  let dir=await realpath(this.root)
  for(const segment of ['.qcu-expert-teams','unified']){dir=join(dir,segment);try{await mkdir(dir,{mode:0o700})}catch(e){if(e.code!=='EEXIST')throw e}const s=await lstat(dir);check(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(segment==='unified'?(s.mode&0o777)===0o700:(s.mode&0o022)===0),'unsafe-store')}
  this.dir=dir;this.file=join(dir,'state.json')
  let f
  try{
   f=await open(this.file,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await f.stat();check(stat.isFile()&&stat.nlink===1&&stat.size<=8000000,'unsafe-store')
   const saved=JSON.parse(await f.readFile('utf8'));check(saved.schemaVersion===1&&Array.isArray(saved.teams)&&saved.teams.length<=20&&Array.isArray(saved.runs)&&saved.runs.length<=30,'invalid-store')
   saved.teams=saved.teams.map(row=>{check(Number.isSafeInteger(row.revision)&&row.revision>0,'invalid-store');return {definition:parseUnifiedTeam(row.definition),revision:row.revision}})
   for(const r of saved.runs){r.definition=parseUnifiedTeam(r.definition);check(typeof r.id==='string'&&Array.isArray(r.steps)&&['demo','live'].includes(r.mode)&&Array.isArray(r.steps)&&['running','completed','failed','cancelled','interrupted','needs-review'].includes(r.status),'invalid-store');if(r.status==='running'){r.status='interrupted';r.error='应用已重启，任务未自动恢复。';r.finishedAt=this.now();for(const s of r.steps){if(s.status==='running')s.status='interrupted';else if(s.status==='queued')s.status='skipped';for(const a of s.attempts??[])if(a.status==='running'){a.status='interrupted';a.finishedAt=this.now()}}}}
   this.state=saved
  }catch(e){if(e.code!=='ENOENT')throw e}finally{await f?.close()}
  await this.persist();return this
 }
 async persist(){
  const bytes=JSON.stringify(this.state);check(Buffer.byteLength(bytes)<=8000000,'store-limit')
  const tmp=join(this.dir,'.state-'+randomUUID());let file
  try{file=await open(tmp,'wx',0o600);await file.writeFile(bytes);await file.sync();await file.close();file=null;await rename(tmp,this.file)}finally{await file?.close();await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e})}
 }
 change(fn){const job=this.queue.then(async()=>{check(!this.closed,'plugin-stopped');const before=clone(this.state);try{const result=fn();await this.persist();return result}catch(e){this.state=before;throw e}});this.queue=job.catch(()=>{});return job}
 snapshot(){return clone({unifiedTeams:this.state.teams,unifiedRuns:this.state.runs.map(r=>({id:r.id,teamId:r.definition.id,teamName:r.definition.name,task:r.input.task,status:r.status,mode:r.mode,createdAt:r.createdAt})),executionInfo:this.info()})}
 async create(definition){const parsed=parseUnifiedTeam(definition);return this.change(()=>{check(this.state.teams.length<20&&!this.state.teams.some(r=>r.definition.id===parsed.id),'store-limit');const row={definition:parsed,revision:1};this.state.teams.push(row);return clone(row)})}
 async save(definition,revision){const parsed=parseUnifiedTeam(definition);return this.change(()=>{const row=this.state.teams.find(r=>r.definition.id===parsed.id);check(row&&row.revision===revision,'stale-team');check(JSON.stringify(parsed.origin)===JSON.stringify(row.definition.origin),'invalid-input');row.definition=parsed;row.revision++;this.prepared.clear();return clone(row)})}
 async prepare({id,revision,task,materials,mode},signal){
  check(['demo','live'].includes(mode),'invalid-input');const row=this.state.teams.find(r=>r.definition.id===id);check(row&&row.revision===revision,'stale-team')
  const definition=clone(row.definition),input={task:text(task,8000,true),materials:text(materials,40000),cwd:this.root},info=this.info()
  let route={provider:'synthetic',model:'流程演示（无模型调用）'}
  if(mode==='live'){
   if(!info.ready)throw failure('原生代理、工具或模型尚未就绪，不能启动真实任务。')
   const required=[...new Set(definition.roles.flatMap(r=>r.tools))],missing=required.filter(n=>!info.tools.includes(n));if(missing.length)throw failure('缺少所选工具：'+missing.join('、')+'。请配置工具或明确调整方案，未自动降级。')
   route=parseRoute(await this.model(signal));const effort=definition.limits.reasoningEffort;if(effort&&effort!=='follow-model'&&!route.policy.supportedEfforts.includes(effort))throw failure('当前模型不支持所选思考模式。请调整后重新预览。')
  }
  signal.throwIfAborted();check(this.state.teams.find(r=>r.definition.id===id)?.revision===revision,'stale-team')
  const preview={id:randomUUID(),createdAt:this.now(),definition,revision,input,mode,model:route,outputTokenCap:definition.limits.maxOutputTokens,definitionSha256:hash(JSON.stringify(definition))}
  for(const [id,p] of this.prepared)if(this.now()-p.createdAt>600000)this.prepared.delete(id)
  check(this.prepared.size<10,'store-limit');this.prepared.set(preview.id,preview);return clone(preview)
 }
 async start({intentId,requestId,consent}){
  check(consent===true&&typeof requestId==='string'&&/^[a-f0-9-]{36}$/.test(requestId),'consent-required')
  let result=await this.change(()=>{
   const existing=this.state.runs.find(r=>r.requestId===requestId);if(existing){check(existing.intentId===intentId,'invalid-input');return clone(existing)}
   if(this.executions.size&&!this.state.runs.some(r=>r.status==='running'))throw failure('原生步骤仍在结束中，请稍后再启动。');check(!this.state.runs.some(r=>r.status==='running'),'store-limit');check(this.state.runs.length<30,'store-limit')
   const p=this.prepared.get(intentId);check(p&&this.now()-p.createdAt<=600000,'prepare-expired');check(this.state.teams.find(r=>r.definition.id===p.definition.id)?.revision===p.revision,'stale-team')
   const run={id:randomUUID(),intentId,requestId,createdAt:this.now(),definition:clone(p.definition),definitionSha256:p.definitionSha256,revision:p.revision,input:clone(p.input),mode:p.mode,model:clone(p.model),status:'running',budget:{modelSteps:0,toolCalls:0,actorCalls:0},steps:orderedSteps(p.definition).map(s=>({id:s.id,name:s.name,status:'queued',output:'',attempts:[]})),artifacts:[]}
   this.state.runs.unshift(run);return clone(run)
  })
  this.prepared.delete(intentId)
  if(result.status==='running'&&!this.jobs.has(result.id)){const controller=new AbortController(),job={controller};this.jobs.set(result.id,job);job.promise=this.execute(result.id,controller.signal).finally(()=>this.jobs.delete(result.id))}
  return result
 }
 run(id){const r=this.state.runs.find(r=>r.id===id);check(r,'run-not-found');return clone(r)}
 async actor(runId,step,role,input,upstream,reviewContext,signal){
  const live=this.state.runs.find(r=>r.id===runId),budget=live.budget,mode=live.mode,model=clone(live.model),limits=live.definition.limits
  const attempt={id:randomUUID(),roleId:role.id,roleName:role.name,startedAt:this.now(),status:'running',output:'',tools:[]}
  await this.change(()=>{const target=this.state.runs.find(r=>r.id===runId).steps.find(s=>s.id===step.id);target.status='running';target.attempts.push(attempt)})
  budget.actorCalls++;const timed=AbortSignal.any([signal,AbortSignal.timeout(limits.stepTimeoutMs)])
  try{
   let result
   if(mode==='demo'){
    timed.throwIfAborted()
    const review=step.review&&!reviewContext?.revising
    result={output:review?JSON.stringify(reviewContext?.revision?{decision:'pass',issues:[],summary:'演示复审通过；未核对真实证据。'}:{decision:'revise',issues:['演示问题：补齐一项证据说明。'],summary:'演示退回一次以展示修订路径。'}):`【流程演示 · 未调用模型或工具】\n${role.name}：${step.name}\n目标：${input.task}\n已接收${upstream.length}项上游结果。\n本段用于检查角色配置、依赖与审核流转，不是真实研究结论。`,tools:[],modelSteps:1}
   }else{
    const generation=this.generate({role,step,input,upstream,model,budget,limits,reviewContext,onSession:async (sessionId,sessionPersisted)=>this.change(()=>{this.state.runs.find(r=>r.id===runId).steps.find(s=>s.id===step.id).attempts.find(a=>a.id===attempt.id).sessionId=sessionId;this.state.runs.find(r=>r.id===runId).steps.find(s=>s.id===step.id).attempts.find(a=>a.id===attempt.id).sessionPersisted=sessionPersisted})},timed)
    this.executions.add(generation);generation.then(()=>this.executions.delete(generation),()=>this.executions.delete(generation))
    let abort
    try{result=await Promise.race([generation,new Promise((_,reject)=>{abort=()=>reject(failure(signal.aborted?'任务已停止。':'本步骤超时，未自动通过或重试。'));timed.addEventListener('abort',abort,{once:true});if(timed.aborted)abort()})])}finally{timed.removeEventListener('abort',abort)}
   }
   timed.throwIfAborted();check(typeof result.output==='string'&&result.output.length<=120000&&result.output.trim(),'output-too-large')
   await this.change(()=>{const run=this.state.runs.find(r=>r.id===runId);run.budget=budget;Object.assign(run.steps.find(s=>s.id===step.id).attempts.find(a=>a.id===attempt.id),result,{status:'completed',finishedAt:this.now()})})
   return result.output
  }catch(error){await this.change(()=>{const a=this.state.runs.find(r=>r.id===runId).steps.find(s=>s.id===step.id).attempts.find(a=>a.id===attempt.id);a.status=signal.aborted?'cancelled':'failed';a.error=message(error);if(error?.public&&typeof error.partialOutput==='string'){a.output=error.partialOutput.slice(0,120000);a.partial=true;a.tools=Array.isArray(error.tools)?error.tools:[]}a.finishedAt=this.now()});throw error}
 }
 async execute(id,signal){
  try{
   const initial=this.run(id),definition=initial.definition,input=initial.input
   for(const step of orderedSteps(definition)){
    signal.throwIfAborted();const r=this.run(id),upstream=step.dependsOn.map(dep=>({name:r.steps.find(s=>s.id===dep).name,output:r.steps.find(s=>s.id===dep).output}))
    const role=definition.roles.find(r=>r.id===step.roleId)
    let output=await this.actor(id,step,role,input,upstream,null,signal)
    if(step.review){
     let latestDraft=upstream.map(s=>s.output).join('\n\n'),review;try{review=parseReview(output)}catch{throw failure('审核结果不符合JSON约定，未自动判定通过。')}
     for(let revision=1;review.decision==='revise'&&revision<=step.review.maxRevisions;revision++){
      const revised=await this.actor(id,step,definition.roles.find(r=>r.id===step.review.reviseRoleId),input,[{name:'当前草稿',output:latestDraft}],{revising:true,revision,review},signal)
      latestDraft=revised;output=await this.actor(id,step,role,input,[{name:'修订稿',output:revised}],{revision},signal)
      try{review=parseReview(output)}catch{throw failure('复审结果不符合JSON约定，未自动判定通过。')}
      if(review.decision==='pass')output=`审核通过：${review.summary}\n\n通过稿：\n${revised}`
     }
     if(review.decision!=='pass'){await this.change(()=>{const r=this.state.runs.find(r=>r.id===id);r.status='needs-review';r.error='修订次数已用完，仍有审核问题，未强制通过。';const s=r.steps.find(s=>s.id===step.id);s.status='needs-review';s.output=JSON.stringify(review,null,2);for(const queued of r.steps)if(queued.status==='queued')queued.status='skipped';r.finishedAt=this.now()});return}
     if(!output.startsWith('审核通过：'))output=`审核通过：${review.summary}\n\n通过稿：\n${latestDraft}`
    }
    await this.change(()=>{const target=this.state.runs.find(r=>r.id===id).steps.find(s=>s.id===step.id);target.status='completed';target.output=output})
   }
   await this.change(()=>{const r=this.state.runs.find(r=>r.id===id);r.status='completed';r.finishedAt=this.now()})
   await this.writeArtifacts(id)
  }catch(error){await this.change(()=>{const r=this.state.runs.find(r=>r.id===id);r.status=signal.aborted?'cancelled':'failed';r.error=message(error);r.finishedAt=this.now();for(const s of r.steps){if(s.status==='running')s.status=r.status;if(s.status==='queued')s.status='skipped'}}).catch(()=>{})}
 }
 report(id){const r=this.run(id),final=r.steps.find(s=>s.id===r.definition.outputStepId);return `# ${r.definition.name}\n\n${r.mode==='demo'?'**流程演示：未调用模型或工具，不是真实研究成果。**':'AI研究草稿，仍需人工核验。'}\n\n状态：${r.status}\n任务：${r.input.task}\n模型：${r.model.provider} / ${r.model.model}\n配置SHA256：${r.definitionSha256}\n\n${final?.output||'最终稿尚未完成。'}\n\n## 步骤记录\n\n`+r.steps.map(s=>`### ${s.name} · ${s.status}\n\n${s.output||'未完成'}\n\n`+s.attempts.map(a=>`- ${a.roleName}：${a.status}${a.sessionId?'；原生会话 '+a.sessionId:''}；工具 ${a.tools?.map(t=>t.name+(t.success?'✓':'×')).join('、')||'无'}`).join('\n')).join('\n\n')}
 async writeArtifacts(id){
  const root=join(this.dir,'artifacts');try{await mkdir(root,{mode:0o700})}catch(e){if(e.code!=='EEXIST')throw e}check(!(await lstat(root)).isSymbolicLink(),'unsafe-store');const dir=join(root,id);await mkdir(dir,{mode:0o700});const report=this.report(id),file=await open(join(dir,'report.md'),'wx',0o600);try{await file.writeFile(report)}finally{await file.close()}
  await this.change(()=>{this.state.runs.find(r=>r.id===id).artifacts=[{name:'report.md',path:join(dir,'report.md'),sha256:hash(report)}]})
 }
 async cancel(id){const job=this.jobs.get(id);job?.controller.abort();await job?.promise;return this.run(id)}
 async dispose(){for(const job of this.jobs.values())job.controller.abort();await Promise.allSettled([...this.jobs.values()].map(j=>j.promise));await Promise.allSettled([...this.executions]);await this.queue;this.closed=true}
}
