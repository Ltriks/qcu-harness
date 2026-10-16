import {PROTOCOL,VERSION,check} from './protocol.mjs'
export const clientId=prefix=>prefix+'_'+globalThis.crypto.randomUUID().replaceAll('-','')
export class CourseController{
 constructor(remote,{sessionId=clientId('session')}={}){this.remote=remote;this.sessionId=sessionId;this.listeners=new Set();this.state={phase:'loading',workspaceId:'',courseId:'',snapshot:null,task:null,error:'',runtime:null,saveReview:null,saved:null};this.generation=0;this.pending=false;this.timer=null;this.disposed=false;this.request=null;this.saveRequest=null}
 snapshot=()=>this.state
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 set(patch){if(this.disposed)return;this.state={...this.state,...patch};for(const fn of this.listeners)fn()}
 async call(request,workspaceId=this.state.workspaceId){
  const raw=await this.remote.dispatch(JSON.stringify(workspaceId?{workspaceId,request,...(request.action==='generate'?{expectedModel:this.state.runtime?.model}:{})}:request))
  if(!raw?.ok)throw Error('connection-unavailable')
  const result=JSON.parse(raw.value);if(!result.ok){const e=Error(result.error);e.definite=true;throw e}return Object.hasOwn(result,'value')?result.value:result
 }
 async boot(){try{const runtime=await this.call({action:'workspaces'},'');check(runtime.protocol===PROTOCOL&&runtime.version===VERSION,'runtime-mismatch');this.set({runtime,phase:['loading','unavailable'].includes(this.state.phase)?'idle':this.state.phase,error:''})}catch(e){this.set({phase:'unavailable',error:e.message})}}
 async workspace(workspaceId){
  if(this.pending)return;this.stopPoll();const n=++this.generation;this.set({workspaceId,courseId:'',snapshot:null,task:null,error:'',saveReview:null,saved:null,phase:'loading'});this.request=null
  try{const snapshot=await this.call({action:'snapshot'},workspaceId);if(n===this.generation)this.set({snapshot,courseId:snapshot.courses[0]?.id??'',phase:'idle'})}catch(e){if(n===this.generation)this.set({phase:'unavailable',error:e.message})}
 }
 async refresh(){const n=this.generation,snapshot=await this.call({action:'snapshot'});if(n===this.generation)this.set({snapshot});return snapshot}
 course(courseId){if(this.pending)return;this.stopPoll();++this.generation;this.request=null;this.set({courseId,task:null,saveReview:null,saved:null,error:'',phase:'idle'})}
 async perform(fn){if(this.pending)return;this.pending=true;this.set({error:''});try{return await fn()}catch(e){this.set({error:e.message});throw e}finally{this.pending=false}}
 async createCourse(name){return this.perform(async()=>{const c=await this.call({action:'createCourse',requestId:clientId('request'),name});await this.refresh();this.stopPoll();++this.generation;this.request=null;this.saveRequest=null;this.set({courseId:c.id,task:null,saveReview:null,saved:null,phase:'idle'});return c})}
 async addReference(file){return this.perform(async()=>{check(file.size<=8*1024*1024,'file-too-large');const bytes=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));const r=await this.call({action:'addReference',courseId:this.state.courseId,requestId:clientId('request'),name:file.name,base64:btoa(str)});await this.refresh();return r})}
 async removeReference(referenceId){return this.perform(async()=>{await this.call({action:'removeReference',courseId:this.state.courseId,referenceId});await this.refresh()})}
 async generate(input,referenceIds,consent){
  return this.perform(async()=>{
   this.stopPoll();const n=++this.generation
   const body={courseId:this.state.courseId,sessionId:this.sessionId,input,referenceIds,consent},fingerprint=JSON.stringify(body)
   if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,body:{action:'generate',...body,requestId:clientId('request')}}
   this.set({phase:'running',task:null,saveReview:null,saved:null})
   try{const task=await this.call(this.request.body);if(n!==this.generation)return;this.set({task,phase:task.state});await this.refresh();if(['running','cancelling'].includes(task.state))this.poll()}
   catch(e){if(n===this.generation)this.set({phase:e.definite?'failed':'unknown'});throw e}
  })
 }
 async openTask(taskId){return this.perform(async()=>{this.stopPoll();++this.generation;this.saveRequest=null;const task=await this.call({action:'task',courseId:this.state.courseId,taskId});this.set({task,phase:task.state,saveReview:null,saved:task.saves?.filter(s=>s.status==='saved').at(-1)??null});if(['running','cancelling'].includes(task.state))this.poll()})}
 stopPoll(){clearTimeout(this.timer);this.timer=null}
 poll(){this.stopPoll();this.timer=setTimeout(()=>void this.reconcile().catch(()=>{}),700)}
 async reconcile(){
  let task=this.state.task;const n=this.generation
  try{if(!task&&this.request){const snapshot=await this.refresh();task=snapshot.tasks.find(t=>t.requestId===this.request.body.requestId);check(task,'original-task-not-found')}if(!task)return;const next=await this.call({action:'task',courseId:task.courseId,taskId:task.id});if(n!==this.generation)return;this.set({task:next,phase:next.state,error:''});if(['running','cancelling'].includes(next.state))this.poll();else await this.refresh()}
  catch(e){if(n===this.generation)this.set({phase:'unknown',error:e.message});this.stopPoll()}
 }
 async cancel(){this.stopPoll();const t=this.state.task;if(!t)return;try{const task=await this.call({action:'cancel',courseId:t.courseId,taskId:t.id});this.set({task,phase:task.state});if(task.state==='cancelling')this.poll()}catch(e){this.set({phase:'unknown',error:e.message})}}
 async revise(draft){return this.perform(async()=>{const t=this.state.task;const task=await this.call({action:'revise',courseId:t.courseId,taskId:t.id,draftHash:t.draftHash,draft});this.set({task,saveReview:null,saved:null});this.saveRequest=null})}
 async prepareSave(component){return this.perform(async()=>{check(!this.saveRequest||this.state.saved,'reconcile-save-first');const t=this.state.task;const review=await this.call({action:'prepareSave',courseId:t.courseId,taskId:t.id,component,draftHash:t.draftHash});this.saveRequest=null;this.set({saveReview:{...review,component},saved:null})})}
 async save(mode){return this.perform(async()=>{const t=this.state.task,r=this.state.saveReview;check(r&&r.draftHash===t.draftHash,'stale-preview');if(!this.saveRequest)this.saveRequest={action:'save',courseId:t.courseId,taskId:t.id,component:r.component,draftHash:r.draftHash,artifactSha256:r.artifactSha256,existingSha256:r.existingSha256,mode,confirmed:true,saveId:clientId('save')};check(this.saveRequest.mode===mode,'reconcile-save-first');const saved=await this.call(this.saveRequest);this.set({saved,saveReview:null});return saved})}
 async reconcileSave(){return this.perform(async()=>{check(this.saveRequest,'save-not-found');const saved=await this.call({action:'saveStatus',courseId:this.saveRequest.courseId,saveId:this.saveRequest.saveId});if(saved.status==='saved')this.set({saved,saveReview:null});else this.set({error:'save-pending'});return saved})}
 async cancelSave(){return this.perform(async()=>{if(this.saveRequest){const result=await this.call({action:'abandonSave',courseId:this.saveRequest.courseId,saveId:this.saveRequest.saveId});if(result.status==='saved')this.set({saved:result});this.saveRequest=null}this.set({saveReview:null})})}
 invalidate(){++this.generation;this.stopPoll();this.set({phase:'unknown',saveReview:null,error:'connection-reset'})}
 dispose(){this.disposed=true;this.stopPoll();this.listeners.clear();++this.generation}
}
