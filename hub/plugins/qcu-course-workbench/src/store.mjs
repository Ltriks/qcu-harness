import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {directory,workspaceRoot,readSafe,atomic,digest,material,filename} from './files.mjs'
import {check,exact,text,id,profile,parseInput,parseDraft,COMPONENTS,MODEL_FAILURES,safeDiagnostic} from './protocol.mjs'
import {exportArtifact} from './export.mjs'
export const newId=prefix=>prefix+'_'+randomUUID().replaceAll('-','')
const clone=v=>JSON.parse(JSON.stringify(v))
const hash=v=>digest(Buffer.from(JSON.stringify(v)))
export class CourseStore{
 constructor(root,{generate,framework={},now=()=>Date.now(),timeoutMs=120000}={}){
  this.root=root;this.generate=generate;this.profile=profile(framework);this.now=now;this.timeoutMs=timeoutMs;this.refs=new Map();this.jobs=new Map();this.tail=Promise.resolve();this.stopped=false
 }
 async init(){
  this.root=await workspaceRoot(this.root);this.home=await directory(join(this.root,'.qcu-course-workbench'));this.output=await directory(join(this.root,'Course Studio'))
  this.path=join(this.home,'state.json')
  try{this.state=JSON.parse((await readSafe(this.path,25000000)).toString('utf8'));check(this.state.version===1&&Array.isArray(this.state.courses)&&Array.isArray(this.state.tasks)&&Array.isArray(this.state.saves)&&this.state.courses.length<=100&&this.state.tasks.length<=100&&this.state.saves.length<=1000,'invalid-store')}
  catch(e){if(e.code!=='ENOENT')throw e;this.state={version:1,courses:[],tasks:[],saves:[]}}
  let changed=false
  for(const task of this.state.tasks){id(task.id,'task');id(task.courseId,'course');if(['running','cancelling'].includes(task.state)){task.state='restart-required';task.message='restart-required';changed=true}}
  for(const c of this.state.courses)id(c.id,'course')
  if(changed)await this.persist();return this
 }
 serial(fn){const p=this.tail.then(()=>{check(!this.stopped,'plugin-stopped');return fn()});this.tail=p.catch(()=>{});return p}
 taskResult(task){const {diagnostic,...rest}=task;const safe=task.state==='failed'&&diagnostic?.reason===task.message?safeDiagnostic(diagnostic):undefined;return {...clone(rest),...(safe?{diagnostic:safe}:{})}}
 async persist(){const bytes=Buffer.from(JSON.stringify({...this.state,tasks:this.state.tasks.map(t=>this.taskResult(t))}));check(bytes.length<=24000000,'store-limit');await atomic(this.path,bytes)}
 course(value){id(value,'course');const c=this.state.courses.find(c=>c.id===value);check(c,'course-not-found');return c}
 task(value){id(value,'task');const t=this.state.tasks.find(t=>t.id===value);check(t,'task-not-found');return t}
 prune(){for(const [k,r] of this.refs)if(r.expiresAt<=this.now())this.refs.delete(k)}
 snapshot(){this.prune();return {profile:this.profile,courses:clone(this.state.courses),tasks:this.state.tasks.map(({draft,input,...t})=>({...this.taskResult(t),topic:input.topic,components:input.components,hasDraft:!!draft})),references:[...this.refs.values()].map(({content,...r})=>r),outputDirectory:this.output}}
 async dispatch(raw){
  check(raw&&typeof raw.action==='string','invalid-action')
  return this.serial(async()=>{
   switch(raw.action){
    case 'snapshot':exact(raw,['action']);return this.snapshot()
    case 'createCourse':{
     exact(raw,['action','requestId','name']);id(raw.requestId,'request');const existing=this.state.courses.find(c=>c.requestId===raw.requestId);if(existing){check(existing.name===text(raw.name,120,true),'idempotency-conflict');return existing}
     check(this.state.courses.length<100,'course-limit');const c={id:newId('course'),requestId:raw.requestId,name:text(raw.name,120,true),createdAt:this.now()};this.state.courses.push(c);try{await this.persist()}catch(e){this.state.courses.pop();throw e}return clone(c)
    }
    case 'addReference':{
     exact(raw,['action','courseId','requestId','name','base64']);this.course(raw.courseId);id(raw.requestId,'request');this.prune()
     const m=material(raw.name,raw.base64),existing=[...this.refs.values()].find(r=>r.requestId===raw.requestId)
     if(existing){check(existing.courseId===raw.courseId&&existing.sha256===m.sha256&&existing.name===m.name,'idempotency-conflict');const {content,...r}=existing;return r}
     check(this.refs.size<32&&[...this.refs.values()].reduce((n,r)=>n+r.content.length,0)+m.content.length<=240000,'reference-limit')
     const r={...m,id:newId('ref'),requestId:raw.requestId,courseId:raw.courseId,expiresAt:this.now()+30*60000};this.refs.set(r.id,r);const {content,...result}=r;return result
    }
    case 'removeReference':exact(raw,['action','courseId','referenceId']);this.course(raw.courseId);id(raw.referenceId,'ref');check(this.refs.get(raw.referenceId)?.courseId===raw.courseId,'reference-not-found');this.refs.delete(raw.referenceId);return {removed:true}
    case 'generate':return this.start(raw)
    case 'task':{
     exact(raw,['action','courseId','taskId']);this.course(raw.courseId);const t=this.task(raw.taskId);check(t.courseId===raw.courseId,'course-mismatch');return {...this.taskResult(t),saves:clone(this.state.saves.filter(s=>s.taskId===t.id))}
    }
    case 'cancel':{
     exact(raw,['action','courseId','taskId']);const t=this.task(raw.taskId);check(t.courseId===raw.courseId,'course-mismatch')
     if(t.state==='running'){t.state='cancelling';await this.persist();this.jobs.get(t.id)?.abort.abort()}
     return this.taskResult(t)
    }
    case 'revise':{
     exact(raw,['action','courseId','taskId','draftHash','draft']);const t=this.task(raw.taskId);check(t.courseId===raw.courseId&&t.state==='succeeded'&&t.draftHash===raw.draftHash,'stale-preview');t.draft=parseDraft(raw.draft,t.input);t.draftHash=hash(t.draft);t.reviewedAt=this.now();await this.persist();return this.taskResult(t)
    }
    case 'prepareSave':return this.prepareSave(raw)
    case 'save':return this.save(raw)
    case 'saveStatus':{
     exact(raw,['action','courseId','saveId']);id(raw.saveId,'save');const saved=this.state.saves.find(s=>s.id===raw.saveId);check(saved&&saved.courseId===raw.courseId,'save-not-found')
     // Read-only artifact reconciliation: never creates or overwrites a file.
     if(saved.status==='pending'&&await this.existing(saved.path)===saved.sha256){saved.status='saved';saved.savedAt=this.now();await this.persist()}
     return clone(saved)
    }
    case 'abandonSave':{
     exact(raw,['action','courseId','saveId']);id(raw.saveId,'save');const saved=this.state.saves.find(s=>s.id===raw.saveId);check(!saved||saved.courseId===raw.courseId,'course-mismatch')
     if(!saved)return {status:'not-found'}
     if(await this.existing(saved.path)===saved.sha256){saved.status='saved';saved.savedAt??=this.now()}
     else if(saved.status==='pending')saved.status='abandoned'
     await this.persist();return clone(saved)
    }
    default:check(false,'unknown-action')
   }
  })
 }
 async start(raw){
  exact(raw,['action','courseId','requestId','sessionId','input','referenceIds','consent','route'])
  this.course(raw.courseId);id(raw.requestId,'request');id(raw.sessionId,'session');const input=parseInput(raw.input,this.profile)
  check(raw.consent===true,'model-consent-required');check(Array.isArray(raw.referenceIds)&&raw.referenceIds.length<=8&&new Set(raw.referenceIds).size===raw.referenceIds.length,'invalid-references')
  raw.referenceIds.forEach(r=>id(r,'ref'))
  // Check request replays before the one-use references have been consumed.
  if(raw.route){exact(raw.route,['provider','model']);text(raw.route.provider,200,true);text(raw.route.model,200,true)}
  const requestHash=hash({course:raw.courseId,session:raw.sessionId,input,refs:[...raw.referenceIds].sort(),route:raw.route??null})
  const replay=this.state.tasks.find(t=>t.requestId===raw.requestId)
  if(replay){check(replay.requestHash===requestHash,'idempotency-conflict');return this.taskResult(replay)}
  const repeated=this.state.tasks.find(t=>t.requestHash===requestHash);if(repeated)return this.taskResult(repeated)
  this.prune();const refs=raw.referenceIds.map(r=>{const value=this.refs.get(r);check(value&&value.courseId===raw.courseId,'reference-expired-or-course-mismatch');return value})
  check(refs.length>0,'reference-required');check(this.jobs.size<1,'task-busy');check(this.state.tasks.length<100,'task-limit')
  const t={id:newId('task'),courseId:raw.courseId,requestId:raw.requestId,requestHash,input,model:raw.route??null,referenceCount:refs.length,state:'running',createdAt:this.now(),message:'running'}
  this.state.tasks.push(t);try{await this.persist()}catch(e){this.state.tasks.pop();throw e}for(const r of refs)this.refs.delete(r.id)
  const abort=new AbortController(),job={abort,promise:null};this.jobs.set(t.id,job)
  // Launch only after the durable running checkpoint. Every late completion is fenced.
  job.promise=this.run(t,refs,abort).catch(()=>{t.state='unknown';t.message='state-write-failed';delete t.draft;delete t.draftHash}).finally(()=>this.jobs.delete(t.id));return this.taskResult(t)
 }
 async run(t,refs,abort){
  let timeout=false,timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timeout=true;abort.abort();reject(Error('generation-timeout'))},this.timeoutMs)})
  const cancelled=new Promise((_,reject)=>abort.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}))
  try{
   const draft=await Promise.race([Promise.resolve().then(()=>this.generate(t.input,refs,abort.signal,t.model)),deadline,cancelled]);abort.signal.throwIfAborted()
   const valid=parseDraft(draft,t.input)
   await this.serial(async()=>{if(t.state!=='running')return;t.draft=valid;t.draftHash=hash(valid);t.state='succeeded';t.message='teacher-review-required';t.finishedAt=this.now();await this.persist()})
  }catch(e){
   if(!this.stopped)await this.serial(async()=>{if(!['running','cancelling'].includes(t.state))return;t.state=timeout?'unknown':abort.signal.aborted?'cancelled':'failed';t.message=timeout?'generation-timeout':abort.signal.aborted?'cancelled':(['model-not-configured','model-incomplete',...MODEL_FAILURES].includes(e?.code)?e.code:'generation-failed');t.finishedAt=this.now();const diagnostic=t.state==='failed'&&e?.diagnostic?.reason===t.message?safeDiagnostic(e.diagnostic):undefined;if(diagnostic)t.diagnostic=diagnostic;await this.persist()})
  }finally{clearTimeout(timer);refs.length=0}
 }
 artifact(t,component){
  check(t.state==='succeeded'&&t.draft,'draft-not-ready');check(component==='lesson'||t.input.components.includes(component),'component-not-found')
  const item=COMPONENTS.find(c=>c.id===component),ext=item?.format??'docx'
  const name=filename(t.input.topic+'-'+(component==='lesson'?'Lesson':component),ext),bytes=exportArtifact(t,component)
  return {name,bytes,sha256:digest(bytes),ext}
 }
 async destination(t){return directory(join(this.output,t.courseId))}
 async existing(path){try{const b=await readSafe(path,4000000);return digest(b)}catch(e){if(e.code==='ENOENT')return null;throw e}}
 async prepareSave(raw){
  exact(raw,['action','courseId','taskId','component','draftHash']);const t=this.task(raw.taskId);check(t.courseId===raw.courseId&&t.draftHash===raw.draftHash,'stale-preview')
  const a=this.artifact(t,raw.component),dir=await this.destination(t),existing=await this.existing(join(dir,a.name))
  return {name:a.name,directory:dir,existingSha256:existing,artifactSha256:a.sha256,draftHash:t.draftHash,bytes:a.bytes.length}
 }
 async save(raw){
  exact(raw,['action','courseId','taskId','component','draftHash','saveId','mode','existingSha256','artifactSha256','confirmed'])
  id(raw.saveId,'save');check(raw.confirmed===true&&['new-version','overwrite'].includes(raw.mode),'save-confirmation-required')
  const reqHash=hash(raw),replay=this.state.saves.find(s=>s.id===raw.saveId);if(replay){check(replay.requestHash===reqHash,'idempotency-conflict');check(replay.status!=='abandoned','save-abandoned');if(replay.status==='saved')return clone(replay)}
  check(replay||this.state.saves.length<1000,'save-limit');const t=this.task(raw.taskId);check(t.courseId===raw.courseId&&t.draftHash===raw.draftHash,'stale-preview');const a=this.artifact(t,raw.component);check(a.sha256===raw.artifactSha256,'stale-preview')
  const dir=await this.destination(t);let name=a.name,path=join(dir,name)
  let r=replay
  if(!r){
   if(raw.mode==='overwrite')check(typeof raw.existingSha256==='string'&&await this.existing(path)===raw.existingSha256,'file-changed')
   else{
    let free=false
    for(let n=0;n<1000;n++){name=n?a.name.slice(0,-a.ext.length-1)+'-v'+(n+1)+'.'+a.ext:a.name;path=join(dir,name);if(await this.existing(path)===null){free=true;break}}
    check(free,'version-limit')
   }
   r={id:raw.saveId,requestHash:reqHash,courseId:t.courseId,taskId:t.id,component:raw.component,name,path,sha256:a.sha256,bytes:a.bytes.length,status:'pending'}
   // Journal the fixed intent before the first artifact write. Crash recovery
   // reconciles this exact destination and never allocates a duplicate version.
   this.state.saves.push(r);await this.persist()
  }
  path=r.path;const current=await this.existing(path)
  if(current!==a.sha256){
   if(raw.mode==='overwrite'){check(current===raw.existingSha256,'file-changed');await atomic(path,a.bytes)}
   else{check(current===null,'file-changed');await atomic(path,a.bytes,{replace:false})}
  }
  check(await this.existing(path)===a.sha256,'save-verification-failed');r.status='saved';r.savedAt=this.now();await this.persist();return clone(r)
 }
 async dispose(){
  await this.tail;this.stopped=true;this.refs.clear()
  for(const [id,j] of this.jobs){const t=this.task(id);if(['running','cancelling'].includes(t.state)){t.state='restart-required';t.message='restart-required'}j.abort.abort()}
  await Promise.allSettled([...this.jobs.values()].map(j=>j.promise));await this.persist()
 }
}
