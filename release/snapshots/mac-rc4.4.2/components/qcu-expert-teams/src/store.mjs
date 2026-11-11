import {randomUUID,createHash} from 'node:crypto'
import {mkdir,lstat,readFile,open,rename,realpath} from 'node:fs/promises'
import {join} from 'node:path'
import {constants} from 'node:fs'
import {parseTeam,parseExpert,parseBundle,parseRoute,check,text,key,safeCode,OUTPUT_BUDGET} from './protocol.mjs'
import {EXPERT_PRESETS,TEAM_PRESETS} from './presets.mjs'
import {terminalRun,historyBackup} from './reports.mjs'
export const newId=()=>randomUUID()
const clone=v=>JSON.parse(JSON.stringify(v))
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const expertIdentity=e=>JSON.stringify([e.name,e.instructions,[...e.skillNames].sort()])
const MAX_RUNS=50,MAX_BYTES=8000000
export function convertLegacyTeam(raw,rows){
 const old=parseTeam(raw);check(old.schemaVersion===1,'unsupported-team');const experts=clone(rows),used=new Set()
 const members=old.members.map(m=>{
  const data={format:'qcu-expert',schemaVersion:1,id:'expert-'+digest([old.id,m.id]).slice(0,20),name:m.name,description:m.instructions.split(/[。！？\n]/)[0].slice(0,90),instructions:m.instructions,skillNames:m.skillNames}
  let found=experts.find(row=>!row.archived&&!used.has(row.expert.id)&&expertIdentity(row.expert)===expertIdentity(data))
  if(!found){let id=data.id,n=0;while(experts.some(row=>row.expert.id===id))id=data.id+'-'+(++n);found={expert:parseExpert({...data,id}),revision:1,archived:false};experts.push(found)}
  used.add(found.expert.id);return {id:m.id,expertId:found.expert.id,assignment:'',dependsOn:m.dependsOn}
 })
 return {team:parseTeam({...old,schemaVersion:2,members}),experts}
}
async function bounded(job,signal,ms=120000){
 signal.throwIfAborted();let listener,timer
 try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return job()}),new Promise((_,reject)=>{listener=()=>reject(Object.assign(Error('cancelled'),{code:'cancelled'}));signal.addEventListener('abort',listener,{once:true});timer=setTimeout(()=>reject(Object.assign(Error('step-timeout'),{code:'step-timeout'})),ms)})])}
 finally{clearTimeout(timer);signal.removeEventListener('abort',listener);signal.throwIfAborted()}
}
export class TeamStore{
 constructor(root,{model,skills,generate,now=()=>Date.now(),stepTimeout=120000}){Object.assign(this,{root,model,skills,generate,now,stepTimeout});this.state={schemaVersion:2,experts:EXPERT_PRESETS.map(expert=>({expert:parseExpert(expert),revision:1,archived:false})),teams:TEAM_PRESETS.map(team=>({team:parseTeam(team),revision:1,archived:false})),runs:[]};this.prepared=new Map();this.jobs=new Map();this.queue=Promise.resolve();this.mutations=Promise.resolve();this.closed=false}
 async location(){
  const base=await realpath(this.root),dir=join(base,'.qcu-expert-teams')
  await mkdir(dir,{recursive:true,mode:0o700});check(!(await lstat(dir)).isSymbolicLink(),'unsafe-store')
  const file=join(dir,'state.json');try{const s=await lstat(file);check(s.isFile()&&!s.isSymbolicLink()&&s.size<=8000000,'unsafe-store')}catch(e){if(e.code!=='ENOENT')throw e}
  return {dir,file}
 }
 async init(){
  const {file}=await this.location()
  let migrated=false,readFound=false
  try{
   const bytes=await readFile(file,'utf8');readFound=true;const s=JSON.parse(bytes);check([1,2].includes(s.schemaVersion)&&Array.isArray(s.teams)&&s.teams.length<=20&&Array.isArray(s.runs)&&s.runs.length<=50,'invalid-store')
   if(s.schemaVersion===1){
    let experts=[];const teams=s.teams.map(row=>{check(Number.isSafeInteger(row.revision)&&row.revision>0,'invalid-store');const converted=convertLegacyTeam(row.team,experts);experts=converted.experts;return {team:converted.team,revision:row.revision,archived:false}})
    s.schemaVersion=2;s.experts=experts;s.teams=teams
    const {dir}=await this.location(),backup=join(dir,'state-v1-'+createHash('sha256').update(bytes).digest('hex').slice(0,24)+'.json');let handle
    try{handle=await open(backup,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await handle.writeFile(bytes);await handle.sync()}catch(e){if(e.code!=='EEXIST')throw e;check(await readFile(backup,'utf8')===bytes,'invalid-store')}finally{await handle?.close()}
    migrated=true
   }
   check(Array.isArray(s.experts)&&s.experts.length<=120,'invalid-store')
   const ids=new Set();for(const row of s.experts){parseExpert(row.expert);check(!ids.has(row.expert.id)&&Number.isSafeInteger(row.revision)&&row.revision>0&&typeof row.archived==='boolean','invalid-store');ids.add(row.expert.id)}
   const teamIds=new Set();for(const row of s.teams){const team=parseTeam(row.team);check(team.schemaVersion===2&&!teamIds.has(team.id)&&team.members.every(m=>ids.has(m.expertId))&&Number.isSafeInteger(row.revision)&&row.revision>0&&typeof row.archived==='boolean','invalid-store');teamIds.add(team.id)}this.state=s
  }
  catch(e){if(e.code!=='ENOENT'||readFound)check(false,'invalid-store')}
  let changed=false;for(const r of this.state.runs)if(r.status==='running'){r.status='interrupted';r.error='应用或插件已退出，本次运行未自动恢复。';for(const s of r.steps)if(['running','queued'].includes(s.status))s.status='interrupted';changed=true}
  if(changed||migrated)await this.persist();return this
 }
 async persist(){
  const bytes=JSON.stringify(this.state);check(Buffer.byteLength(bytes)<=8000000,'store-limit')
  const work=this.queue.then(async()=>{const {dir,file}=await this.location(),temp=join(dir,'write-'+randomUUID()+'.tmp');let handle;try{handle=await open(temp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;await this.location();await rename(temp,file)}catch{check(false,'state-write-failed')}finally{await handle?.close()}})
  this.queue=work.catch(()=>{});return work
 }
 capacity(){const bytes=Buffer.byteLength(JSON.stringify(this.state)),count=this.state.runs.length;return {count,maxRuns:MAX_RUNS,bytes,maxBytes:MAX_BYTES,near:count>=45||bytes>=7200000,limit:count>=MAX_RUNS||bytes>=MAX_BYTES}}
 snapshot(){return clone({experts:this.state.experts,teams:this.state.teams,capacity:this.capacity(),runs:this.state.runs.map(r=>({id:r.id,requestId:r.requestId,teamName:r.team.name,task:r.input?.task?.slice(0,160)??'',status:r.status,createdAt:r.createdAt}))})}
 selectedRuns(runIds){
  check(Array.isArray(runIds)&&runIds.length>0&&runIds.length<=MAX_RUNS&&new Set(runIds).size===runIds.length,'cleanup-selection')
  return [...runIds].map(id=>{text(id,100,true);const r=this.state.runs.find(r=>r.id===id);check(r,'run-not-found');check(terminalRun(r)&&!this.jobs.has(id),'cleanup-running');return r}).sort((a,b)=>a.id.localeCompare(b.id))
 }
 exportHistory({workspaceId,runIds}){return this.mutate(()=>{check(!this.closed,'plugin-stopped');text(workspaceId,200,true);return historyBackup(this.selectedRuns(runIds),workspaceId,this.now())})}
 previewCleanup({workspaceId,runIds}){return this.mutate(()=>{
  check(!this.closed,'plugin-stopped');text(workspaceId,200,true);const runs=this.selectedRuns(runIds)
  this.cleanups??=new Map();for(const [id,p]of this.cleanups)if(this.now()-p.createdAt>600000)this.cleanups.delete(id);check(this.cleanups.size<10,'cleanup-limit')
  const preview={id:newId(),workspaceId,runIds:runs.map(r=>r.id),digest:digest(runs),createdAt:this.now(),count:runs.length,records:runs.map(r=>({id:r.id,task:r.input?.task??'',teamName:r.team.name,status:r.status,createdAt:r.createdAt})),capacity:this.capacity()};this.cleanups.set(preview.id,preview);return clone(preview)
 })}
 cancelCleanup({workspaceId,cleanupId}){return this.mutate(()=>{const p=this.cleanups?.get(cleanupId);if(p?.workspaceId===workspaceId)this.cleanups.delete(cleanupId);return null})}
 confirmCleanup({workspaceId,cleanupId,consent}){return this.mutate(async()=>{
  check(!this.closed,'plugin-stopped');check(consent===true,'cleanup-consent');const p=this.cleanups?.get(cleanupId);this.cleanups?.delete(cleanupId)
  check(p&&p.workspaceId===workspaceId&&this.now()-p.createdAt<=600000,'cleanup-expired')
  const selected=this.selectedRuns(p.runIds);check(digest(selected)===p.digest,'cleanup-expired')
  const previous=this.state.runs,ids=new Set(p.runIds);this.state.runs=previous.filter(r=>!ids.has(r.id))
  try{await this.persist()}catch(e){this.state.runs=previous;throw e}
  this.preparationEpoch=(this.preparationEpoch??0)+1;this.prepared.clear();this.cleanups.clear();return {...this.snapshot(),removed:p.runIds}
 })}
 mutate(fn){const result=this.mutations.then(fn);this.mutations=result.catch(()=>{});return result}
 saveTeam(raw,revision){return this.mutate(()=>this.saveTeamNow(raw,revision))}
 async saveTeamNow(raw,revision){
  check(!this.closed,'plugin-stopped');let team=parseTeam(raw),experts=this.state.experts
  if(team.schemaVersion===1){const converted=convertLegacyTeam(team,experts);team=converted.team;experts=converted.experts}
  check(experts.length<=120,'expert-limit');check(team.members.every(m=>experts.some(e=>e.expert.id===m.expertId&&!e.archived)),'expert-not-found')
  const old=this.state.teams.find(t=>t.team.id===team.id)
  check(old?old.revision===revision:revision===0,'stale-team');check(old||this.state.teams.length<20,'store-limit')
  const previousExperts=this.state.experts,value={team,revision:(old?.revision??0)+1,archived:old?.archived??false};this.state.experts=experts;if(old)this.state.teams[this.state.teams.indexOf(old)]=value;else this.state.teams.push(value)
  try{await this.persist()}catch(e){this.state.experts=previousExperts;if(old)this.state.teams[this.state.teams.indexOf(value)]=old;else this.state.teams.pop();throw e}
  for(const [id,p]of this.prepared)if(p.team.id===team.id)this.prepared.delete(id)
  return clone(value)
 }
 saveExpert(raw,revision){return this.mutate(async()=>{
  check(!this.closed,'plugin-stopped');const expert=parseExpert(raw),old=this.state.experts.find(e=>e.expert.id===expert.id)
  check(old?old.revision===revision:revision===0,'stale-expert');check(old||this.state.experts.length<120,'expert-limit')
  const value={expert,revision:(old?.revision??0)+1,archived:old?.archived??false};if(old)this.state.experts[this.state.experts.indexOf(old)]=value;else this.state.experts.push(value)
  try{await this.persist()}catch(e){if(old)this.state.experts[this.state.experts.indexOf(value)]=old;else this.state.experts.pop();throw e}
  this.prepared.clear();return clone(value)
 })}
 archive(entity,id,revision,archived){return this.mutate(async()=>{
  check(!this.closed,'plugin-stopped');check(['expert','team'].includes(entity)&&typeof archived==='boolean','invalid-fields');key(id)
  const list=entity==='expert'?this.state.experts:this.state.teams,row=list.find(r=>r[entity].id===id);check(row,entity==='expert'?'expert-not-found':'team-not-found');check(row.revision===revision,entity==='expert'?'stale-expert':'stale-team')
  if(entity==='expert'&&archived)check(!this.state.teams.some(t=>!t.archived&&t.team.members.some(m=>m.expertId===id)),'expert-in-use')
  if(entity==='team'&&!archived)check(row.team.members.every(m=>this.state.experts.some(e=>e.expert.id===m.expertId&&!e.archived)),'expert-archived')
  const next={...row,archived,revision:row.revision+1};list[list.indexOf(row)]=next;try{await this.persist()}catch(e){list[list.indexOf(next)]=row;throw e}this.prepared.clear();return this.snapshot()
 })}
 importBundle(raw){return this.mutate(async()=>{
  check(!this.closed,'plugin-stopped');check(this.state.teams.length<20,'store-limit')
  let data
  if(raw?.format==='qcu-expert-team'){const old=parseTeam(raw);check(old.schemaVersion===1,'unsupported-team');const converted=convertLegacyTeam(old,[]);data={team:converted.team,experts:converted.experts.map(r=>r.expert)}}else data=parseBundle(raw)
  check(this.state.experts.length+data.experts.length<=120,'expert-limit');const ids=new Map(data.experts.map(e=>[e.id,'expert-'+newId().slice(0,20)]))
  const experts=data.experts.map(e=>({expert:parseExpert({...e,id:ids.get(e.id)}),revision:1,archived:false})),team=parseTeam({...data.team,id:'team-'+newId().slice(0,20),members:data.team.members.map(m=>({...m,expertId:ids.get(m.expertId)}))}),row={team,revision:1,archived:false},previous=this.state
  this.state={...previous,experts:[...previous.experts,...experts],teams:[...previous.teams,row]};try{await this.persist()}catch(e){this.state=previous;throw e}return {...this.snapshot(),importedTeamId:team.id}
 })}
 resolvedTeam(row){
  check(!row.archived,'team-archived');const revisions={}
  const members=row.team.members.map(m=>{const e=this.state.experts.find(e=>e.expert.id===m.expertId);check(e,'expert-not-found');check(!e.archived,'expert-archived');revisions[e.expert.id]=e.revision;return {id:m.id,name:e.expert.name,instructions:e.expert.instructions+(m.assignment?'\n本团队补充分工：'+m.assignment:''),skillNames:[...e.expert.skillNames],dependsOn:[...m.dependsOn]}})
  return {team:{...clone(row.team),schemaVersion:1,members},expertRevisions:revisions}
 }
 checkExperts(revisions){check(Object.entries(revisions).every(([id,revision])=>this.state.experts.some(e=>e.expert.id===id&&e.revision===revision&&!e.archived)),'expert-changed')}
 async prepare({teamId,revision,task,materials},signal){
  const preparationEpoch=this.preparationEpoch??0
  check(!this.closed,'plugin-stopped');const row=this.state.teams.find(t=>t.team.id===key(teamId));check(row,'team-not-found');check(row.revision===revision,'stale-team')
  const resolved=this.resolvedTeam(row),input={task:text(task,8000,true),materials:text(materials,40000)},route=parseRoute(await bounded(()=>this.model(signal),signal,6000))
  const methods={};for(const name of new Set(resolved.team.members.flatMap(m=>m.skillNames))){const s=await bounded(()=>this.skills(name,signal),signal,6000);check(s&&s.invocation?.userInvocable!==false,'skill-unavailable');methods[name]={name,content:text(s.content,20000,true)}}
  signal.throwIfAborted();check(!this.closed,'plugin-stopped');check(preparationEpoch===(this.preparationEpoch??0),'prepare-expired');check(this.state.teams.find(t=>t.team.id===teamId)?.revision===revision,'stale-team')
  this.checkExperts(resolved.expertRevisions);const value={id:newId(),...resolved,revision,input,route,methods,createdAt:this.now()};check(JSON.stringify(value).length<=160000,'store-limit')
  for(const [id,p]of this.prepared)if(this.now()-p.createdAt>600000)this.prepared.delete(id)
  check(this.prepared.size<10,'store-limit');value.digest=digest(value);this.prepared.set(value.id,value);return clone(value)
 }
 start(request,signal){return this.mutate(()=>this.startNow(request,signal))}
 async startNow({intentId,requestId,consent},signal){
  check(!this.closed,'plugin-stopped');text(requestId,100,true);text(intentId,100,true)
  const existing=this.state.runs.find(r=>r.requestId===requestId)
  if(existing){check(existing.intentId===intentId,'idempotency-conflict');return clone(existing)}
  check(consent===true,'consent-required');const p=this.prepared.get(intentId);check(p&&this.now()-p.createdAt<=600000,'prepare-expired')
  check(this.state.teams.find(t=>t.team.id===p.team.id)?.revision===p.revision,'stale-team');check(!this.state.runs.some(r=>r.status==='running'),'run-busy');check(this.state.runs.length<50,'store-limit')
  this.checkExperts(p.expertRevisions);const r={id:newId(),intentId,requestId,team:clone(p.team),expertRevisions:clone(p.expertRevisions),input:clone(p.input),model:clone(p.route),methods:clone(p.methods),preparedDigest:p.digest,createdAt:this.now(),status:'running',steps:p.team.members.map(m=>({id:m.id,name:m.name,status:'queued',output:''}))}
  this.state.runs.unshift(r);try{await this.persist()}catch(e){this.state.runs.shift();throw e}this.prepared.delete(intentId)
  if(this.closed){r.status='interrupted';for(const s of r.steps)s.status='interrupted';await this.persist();check(false,'plugin-stopped')}
  const controller=new AbortController(),job={controller};this.jobs.set(r.id,job)
  job.promise=this.execute(r,controller).finally(()=>this.jobs.delete(r.id));job.promise.catch(()=>{})
  return clone(r)
 }
 async execute(r,controller){
  const signal=controller.signal
  try{
   while(r.steps.some(s=>s.status==='queued')){
    signal.throwIfAborted();const ready=r.team.members.filter(m=>r.steps.find(s=>s.id===m.id).status==='queued'&&m.dependsOn.every(id=>r.steps.find(s=>s.id===id).status==='completed')).slice(0,r.team.parallelism);check(ready.length,'missing-dependency')
    const settled=await Promise.allSettled(ready.map(async member=>{
     const step=r.steps.find(s=>s.id===member.id)
     try{step.status='running';step.startedAt=this.now();await this.persist();signal.throwIfAborted();const dependencies=member.dependsOn.map(id=>{const s=r.steps.find(s=>s.id===id);return {name:s.name,output:s.output}}),methods=member.skillNames.map(name=>r.methods[name]);const output=await bounded(()=>this.generate({member,input:r.input,dependencies,methods,model:r.model,isFinal:member.id===r.team.outputId},signal),signal,this.stepTimeout);check(typeof output==='string'&&output.trim(),'model-failed');check(output.length<=120000,'output-too-large');signal.throwIfAborted();step.output=output;step.status='completed'}
     catch(e){step.status=signal.aborted?'cancelled':'failed';step.error=signal.aborted?'cancelled':safeCode(e);controller.abort();throw e}
     finally{step.finishedAt=this.now();await this.persist()}
    }));const failed=settled.find(s=>s.status==='rejected');if(failed)throw failed.reason
   }
   r.status='completed'
  }catch(e){r.status=r.steps.some(s=>s.status==='failed')?'failed':signal.aborted?'cancelled':'failed';r.error=safeCode(e);controller.abort();for(const s of r.steps)if(['queued','running'].includes(s.status))s.status='cancelled'}
  finally{r.finishedAt=this.now();await this.persist()}
 }
 run(id){const r=this.state.runs.find(r=>r.id===id);check(r,'run-not-found');return clone(r)}
 async cancel(id){const r=this.state.runs.find(r=>r.id===id);check(r,'run-not-found');this.jobs.get(id)?.controller.abort();await this.jobs.get(id)?.promise;return this.run(id)}
 async dispose(){this.closed=true;this.prepared.clear();this.cleanups?.clear();await this.mutations;for(const job of this.jobs.values())job.controller.abort();await Promise.allSettled([...this.jobs.values()].map(j=>j.promise));await this.queue}
}
