import {PROTOCOL,VERSION,check,parseDraft,parseRoute,sameRoute} from './protocol.mjs'
export const clientId=prefix=>prefix+'_'+globalThis.crypto.randomUUID().replaceAll('-','')
export class CourseController{
 constructor(remote,{sessionId=clientId('session'),lookupMs=6000}={}){this.remote=remote;this.sessionId=sessionId;this.lookupMs=lookupMs;this.listeners=new Set();this.state={phase:'idle',connection:'connecting',connectionError:'',modelStatus:'loading',workspaceId:'',courseId:'',snapshot:null,task:null,error:'',runtime:null,saveReview:null,saved:null,localEdits:false,originalSave:null};this.generation=0;this.bootGeneration=0;this.saveGeneration=0;this.pending=false;this.timer=null;this.disposed=false;this.request=null;this.saveRequest=null;this.saveResolved=false;this.confirmedModel=null}
 snapshot=()=>this.state
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 set(patch){if(this.disposed)return;if(patch.runtime&&!sameRoute(this.state.runtime?.model,patch.runtime.model))this.confirmedModel=null;this.state={...this.state,...patch};for(const fn of this.listeners)fn()}
 async call(request,workspaceId=this.state.workspaceId,signal){
  const raw=await this.remote.dispatch(JSON.stringify(workspaceId?{workspaceId,request,...(request.action==='generate'?{expectedModel:this.confirmedModel}:{})}:request),signal)
  if(!raw?.ok)throw Error('connection-unavailable')
  const result=JSON.parse(raw.value);if(!result.ok){const e=Error(result.error);e.definite=true;throw e}return Object.hasOwn(result,'value')?result.value:result
 }
 async lookup(action,signal){
  let timer,listener
  try{return await Promise.race([this.call({action},'',signal),new Promise((_,reject)=>{listener=()=>reject(Error('connection-unavailable'));signal.addEventListener('abort',listener,{once:true});timer=setTimeout(()=>reject(Error('connection-unavailable')),this.lookupMs);if(signal.aborted)listener()})])}
  finally{clearTimeout(timer);signal.removeEventListener('abort',listener)}
 }
 async boot(){
  if(this.disposed)return;this.bootAbort?.abort();const abort=new AbortController(),n=++this.bootGeneration;this.bootAbort=abort;this.confirmedModel=null
  this.set({connection:'connecting',connectionError:'',modelStatus:'loading',runtime:this.state.runtime?{...this.state.runtime,model:null,policyError:undefined}:null})
  try{
   const runtime=await this.lookup('workspaces',abort.signal);check(runtime.protocol===PROTOCOL&&runtime.version===VERSION,'runtime-mismatch')
   if(this.disposed||n!==this.bootGeneration)return
   this.set({runtime:{...runtime,model:null},connection:'ready'})
   // Independent, bounded, read-only capability lookup. Browsing is ready now.
   void this.loadModel(n,abort)
  }catch(e){abort.abort();if(n===this.bootGeneration&&!this.disposed)this.set({connection:'unavailable',connectionError:e.message,modelStatus:'unavailable'})}
 }
 async loadModel(n,abort){
  try{const result=await this.lookup('model',abort.signal);if(n!==this.bootGeneration||this.disposed)return;const model=result.model?parseRoute(result.model,true):null;this.set({runtime:{...this.state.runtime,model,policyError:result.policyError},modelStatus:model?'ready':'unavailable'})}
  catch{if(n===this.bootGeneration&&!this.disposed)this.set({runtime:{...this.state.runtime,model:null,policyError:'model-policy-unavailable'},modelStatus:'unavailable'})}
  finally{if(n===this.bootGeneration)abort.abort()}
 }
 clearSave(){++this.saveGeneration;this.set({saveReview:null,saved:null})}
 localEdit(pending=true){this.clearSave();this.set({localEdits:pending})}
 component(){this.clearSave()}
 unresolvedSave(){return !!this.saveRequest&&!this.saveResolved}
 async workspace(workspaceId){
  if(this.pending)return;this.stopPoll();const n=++this.generation;this.confirmedModel=null;this.clearSave();this.set({workspaceId,courseId:'',snapshot:null,task:null,error:'',localEdits:false,phase:workspaceId?'loading':'idle'});this.request=null
  if(!workspaceId)return
  try{const snapshot=await this.call({action:'snapshot'},workspaceId);if(n===this.generation)this.set({snapshot,courseId:snapshot.courses[0]?.id??'',phase:'idle'})}catch(e){if(n===this.generation)this.set({phase:'unavailable',error:e.message})}
 }
 async refresh(){const n=this.generation,snapshot=await this.call({action:'snapshot'});if(n===this.generation)this.set({snapshot});return snapshot}
 course(courseId){if(this.pending)return;this.stopPoll();++this.generation;this.request=null;this.confirmedModel=null;this.clearSave();this.set({courseId,task:null,localEdits:false,error:'',phase:'idle'})}
 async perform(fn){if(this.pending||this.disposed)return;this.pending=true;const n=this.generation;this.set({error:''});try{return await fn()}catch(e){if(n===this.generation)this.set({error:e.message});throw e}finally{this.pending=false}}
 async createCourse(name){return this.perform(async()=>{const n=this.generation,c=await this.call({action:'createCourse',requestId:clientId('request'),name});if(n!==this.generation)return;await this.refresh();if(n!==this.generation)return;this.stopPoll();++this.generation;this.request=null;this.confirmedModel=null;this.clearSave();this.set({courseId:c.id,task:null,localEdits:false,phase:'idle'});return c})}
 async addReference(file){return this.perform(async()=>{check(file.size<=8*1024*1024,'file-too-large');const bytes=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));const r=await this.call({action:'addReference',courseId:this.state.courseId,requestId:clientId('request'),name:file.name,base64:btoa(str)});await this.refresh();return r})}
 async removeReference(referenceId){return this.perform(async()=>{await this.call({action:'removeReference',courseId:this.state.courseId,referenceId});await this.refresh()})}
 confirmModel(consent){this.confirmedModel=consent?parseRoute(this.state.runtime?.model,true):null}
 async generate(input,referenceIds,consent){
  return this.perform(async()=>{
   check(consent===true&&sameRoute(this.confirmedModel,this.state.runtime?.model),'model-consent-required')
   this.stopPoll();const n=++this.generation
   const body={courseId:this.state.courseId,sessionId:this.sessionId,input,referenceIds,consent},fingerprint=JSON.stringify({...body,model:this.confirmedModel})
   if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,body:{action:'generate',...body,requestId:clientId('request')}}
   this.clearSave();this.set({phase:'running',task:null,localEdits:false})
   try{const task=await this.call(this.request.body);if(n!==this.generation)return;this.set({task,phase:task.state});await this.refresh();if(n===this.generation&&['running','cancelling'].includes(task.state))this.poll()}
   catch(e){if(n===this.generation)this.set({phase:e.definite?'failed':'unknown',error:e.message});throw e}
  })
 }
 async openTask(taskId){return this.perform(async()=>{this.stopPoll();const n=++this.generation;this.confirmedModel=null;this.clearSave();this.set({task:null,localEdits:false,phase:'loading'});try{const task=await this.call({action:'task',courseId:this.state.courseId,taskId});if(n!==this.generation)return;this.set({task,phase:task.state});if(['running','cancelling'].includes(task.state))this.poll()}catch(e){if(n===this.generation)this.set({phase:'unavailable',error:e.message});throw e}})}
 stopPoll(){clearTimeout(this.timer);this.timer=null}
 poll(){this.stopPoll();if(!this.disposed)this.timer=setTimeout(()=>void this.reconcile().catch(()=>{}),700)}
 async reconcile(){
  let task=this.state.task;const n=this.generation
  try{if(!task&&this.request){const snapshot=await this.refresh();if(n!==this.generation)return;task=snapshot.tasks.find(t=>t.requestId===this.request.body.requestId);check(task,'original-task-not-found')}if(!task)return;const next=await this.call({action:'task',courseId:task.courseId,taskId:task.id});if(n!==this.generation)return;this.set({task:next,phase:next.state,error:''});if(['running','cancelling'].includes(next.state))this.poll();else await this.refresh()}
  catch(e){if(n===this.generation){this.set({phase:task&&['succeeded','failed','cancelled','restart-required'].includes(task.state)?task.state:'unknown',error:e.message});this.stopPoll()}}
 }
 async cancel(){this.stopPoll();const t=this.state.task,n=this.generation;if(!t)return;try{const task=await this.call({action:'cancel',courseId:t.courseId,taskId:t.id});if(n!==this.generation)return;this.set({task,phase:task.state});if(task.state==='cancelling')this.poll()}catch(e){if(n===this.generation)this.set({phase:'unknown',error:e.message})}}
 async revise(draft){return this.perform(async()=>{check(!this.unresolvedSave(),'reconcile-save-first');const t=this.state.task,n=this.generation,valid=parseDraft(draft,t.input);const task=await this.call({action:'revise',courseId:t.courseId,taskId:t.id,draftHash:t.draftHash,draft:valid});if(n!==this.generation)return;this.clearSave();this.set({task,localEdits:false})})}
 async prepareSave(component){return this.perform(async()=>{check(!this.state.localEdits,'unapplied-edits');check(!this.unresolvedSave(),'reconcile-save-first');const t=this.state.task,n=this.generation,s=this.saveGeneration;const review=await this.call({action:'prepareSave',courseId:t.courseId,taskId:t.id,component,draftHash:t.draftHash});if(n!==this.generation||s!==this.saveGeneration)return;this.saveRequest=null;this.saveResolved=false;this.set({saveReview:{...review,component},saved:null})})}
 async save(mode){return this.perform(async()=>{check(!this.state.localEdits,'unapplied-edits');const t=this.state.task,r=this.state.saveReview,n=this.generation,s=this.saveGeneration;check(r&&r.draftHash===t.draftHash,'stale-preview');check(!this.unresolvedSave(),'reconcile-save-first');this.saveRequest={action:'save',courseId:t.courseId,taskId:t.id,component:r.component,draftHash:r.draftHash,artifactSha256:r.artifactSha256,existingSha256:r.existingSha256,mode,confirmed:true,saveId:clientId('save')};this.saveWorkspace=this.state.workspaceId;this.saveResolved=false;const saved=await this.call(this.saveRequest,this.saveWorkspace);this.saveResolved=true;if(n===this.generation&&s===this.saveGeneration)this.set({saved,saveReview:null});return saved})}
 async reconcileSave(){return this.perform(async()=>{check(this.saveRequest,'save-not-found');const request=this.saveRequest;const saved=await this.call({action:'saveStatus',courseId:request.courseId,saveId:request.saveId},this.saveWorkspace);if(this.saveRequest!==request)return saved;if(saved.status==='saved'||saved.status==='abandoned'){this.saveResolved=true;this.set({originalSave:saved,saveReview:null})}else this.set({originalSave:saved,error:'save-pending'});return saved})}
 async continueSave(){return this.perform(async()=>{const r=this.saveRequest;check(this.unresolvedSave()&&this.state.originalSave?.id===r.saveId&&this.state.originalSave.status==='pending','reconcile-save-first');check(!this.state.localEdits&&this.saveWorkspace===this.state.workspaceId&&r.taskId===this.state.task?.id&&r.draftHash===this.state.task?.draftHash,'stale-preview');const s=this.saveGeneration,n=this.generation,saved=await this.call(r,this.saveWorkspace);this.saveResolved=true;if(s===this.saveGeneration&&n===this.generation)this.set({saved,saveReview:null,originalSave:saved});return saved})}
 async cancelSave(){return this.perform(async()=>{if(this.unresolvedSave()){const result=await this.call({action:'abandonSave',courseId:this.saveRequest.courseId,saveId:this.saveRequest.saveId},this.saveWorkspace);this.set({originalSave:result});this.saveRequest=null;this.saveResolved=true}this.clearSave()})}
 invalidate(){this.confirmedModel=null;++this.bootGeneration;this.bootAbort?.abort();++this.generation;this.stopPoll();this.clearSave();this.set({connection:'unavailable',connectionError:'connection-reset',modelStatus:'unavailable',runtime:this.state.runtime?{...this.state.runtime,model:null}:null,phase:(!this.state.task&&this.request)||['running','cancelling'].includes(this.state.phase)?'unknown':this.state.task?.state??'idle'})}
 dispose(){this.disposed=true;this.bootAbort?.abort();this.stopPoll();this.listeners.clear();++this.generation;++this.bootGeneration}
}
