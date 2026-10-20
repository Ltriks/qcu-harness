import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CourseController} from '../hub/plugins/qcu-course-workbench/src/controller.mjs'
import {CourseStore,newId} from '../hub/plugins/qcu-course-workbench/src/store.mjs'
import {PROTOCOL,VERSION,profile,policyFor} from '../hub/plugins/qcu-course-workbench/src/protocol.mjs'
import {lessonInput,fixtureDraft} from './support/course-fixture.mjs'
const tick=()=>new Promise(r=>setImmediate(r)),ok=value=>({ok:true,value:JSON.stringify({ok:true,value})})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const route={provider:'synthetic',model:'offline',policy:policyFor({})}
const runtime={version:VERSION,protocol:PROTOCOL,workspaces:[{id:'ws',title:'Synthetic'}]}
const snapshot={profile:profile(),courses:[{id:'course_fixture',name:'Synthetic'}],tasks:[],references:[]}
const task={id:'task_fixture',courseId:'course_fixture',state:'succeeded',input:lessonInput({components:['guide','inter']}),draftHash:'original'};task.draft=fixtureDraft(task.input)
function controller(handler,options){const calls=[];const c=new CourseController({dispatch:(payload,signal)=>{const raw=JSON.parse(payload),action=raw.request?.action??raw.action;calls.push({raw,action,signal});return handler(action,raw,signal)}},options);return {c,calls}}

test('delayed model policy does not block inventory, history, revision or export preparation; no generation sent',async()=>{
 const model=deferred(),f=controller((action)=>action==='model'?model.promise:Promise.resolve(ok(action==='workspaces'?runtime:action==='snapshot'?snapshot:action==='task'?task:action==='revise'?{...task,draftHash:'revised'}:{draftHash:'revised'})))
 const {c,calls}=f;try{
  await c.boot();assert.equal(c.state.connection,'ready');assert.equal(c.state.modelStatus,'loading');assert.equal(c.state.phase,'idle')
  await c.workspace('ws');await c.openTask(task.id);await c.revise(task.draft);await c.prepareSave('guide');assert.ok(c.state.saveReview)
  assert.equal(c.state.task.draftHash,'revised');assert.equal(c.state.phase,'succeeded');assert.equal(c.state.error,'')
  model.resolve(ok({model:null,policyError:'model-not-configured'}));await tick();assert.equal(c.state.modelStatus,'unavailable');assert.equal(c.state.phase,'succeeded');assert.equal(c.state.task.id,task.id)
  await assert.rejects(c.generate({},[],true),/model-consent-required/);assert.equal(calls.filter(c=>c.action==='generate').length,0)
 }finally{c.dispose()}
})
test('overlapping reconnect replies cannot restore an old route or consent or replace a selected task',async()=>{
 const first=deferred(),second=deferred(),models=deferred();let boots=0
 const {c}=controller(action=>action==='workspaces'?(++boots===1?first.promise:second.promise):action==='model'?models.promise:Promise.resolve(ok(action==='snapshot'?snapshot:task)))
 try{
  c.set({runtime:{...runtime,model:route}});c.confirmModel(true)
  const a=c.boot(),b=c.boot();assert.equal(c.confirmedModel,null)
  second.resolve(ok(runtime));await b;await c.workspace('ws');await c.openTask(task.id)
  first.reject(Error('late transport failure'));await a
  assert.equal(c.state.phase,'succeeded');assert.equal(c.state.connection,'ready');assert.equal(c.state.connectionError,'')
  models.resolve(ok({model:route}));await tick();assert.equal(c.confirmedModel,null);assert.equal(c.state.task.id,task.id)
 }finally{c.dispose()}
})
for(const lifecycle of ['invalidate','dispose'])test(`${lifecycle} fences late boot/model replies and aborts read lookups`,async()=>{
 for(const phase of ['inventory','model']){
  const wait=deferred(),{c,calls}=controller(action=>action===(phase==='inventory'?'workspaces':'model')?wait.promise:Promise.resolve(ok(runtime)))
  const boot=c.boot();if(phase==='model')await boot
  c[lifecycle]();const before=c.snapshot();wait.resolve(ok(phase==='inventory'?runtime:{model:route}));await boot;await tick()
  assert.equal(c.snapshot(),before);assert.equal(c.confirmedModel,null);assert.ok(calls.every(call=>call.signal.aborted));assert.equal(c.timer,null);c.dispose()
 }
})
test('failed or bounded boot has a connection state, never a fictitious generation timeout',async()=>{
 for(const handler of [()=>Promise.reject(Error('offline')),()=>new Promise(()=>{})]){
  const {c,calls}=controller(handler,{lookupMs:10});try{await c.boot();assert.equal(c.state.connection,'unavailable');assert.equal(c.state.phase,'idle');assert.equal(c.state.error,'');assert.equal(calls[0].signal.aborted,true);assert.equal(c.request,null);c.invalidate();assert.equal(c.state.phase,'idle')}finally{c.dispose()}
 }
})
test('late failed workspace selection, task lookup, cancellation and reconciliation cannot overwrite current selection',async()=>{
 const a=deferred(),b=deferred(),{c}=controller((action,raw)=>action==='snapshot'?(raw.workspaceId==='a'?a.promise:b.promise):Promise.resolve(ok(task)))
 const first=c.workspace('a'),second=c.workspace('b');b.resolve(ok(snapshot));await second;c.course('course_fixture');await c.openTask(task.id);a.reject(Error('late'));await first;assert.equal(c.state.workspaceId,'b');assert.equal(c.state.phase,'succeeded');assert.equal(c.state.error,'');c.dispose()
 for(const action of ['task','cancel']){
  const wait=deferred(),{c}=controller(()=>wait.promise);c.set({workspaceId:'ws',courseId:task.courseId,task,phase:'succeeded'})
  const pending=action==='task'?c.openTask(task.id):c.cancel();c.invalidate();const before=c.snapshot();wait.resolve(ok({...task,state:'running'}));await pending;assert.equal(c.snapshot(),before);assert.equal(c.timer,null);c.dispose()
 }
 const wait=deferred(),f=controller(()=>wait.promise);f.c.set({workspaceId:'a',courseId:task.courseId,task,phase:'unknown'});const pending=f.c.reconcile();f.c.course('other');wait.reject(Error('late'));await pending;assert.equal(f.c.state.phase,'idle');assert.equal(f.c.state.courseId,'other');f.c.dispose()
})
test('local edits and component changes invalidate confirmations immediately and fence late save previews',async()=>{
 const wait=deferred(),{c,calls}=controller(()=>wait.promise);c.set({workspaceId:'ws',courseId:task.courseId,task,phase:'succeeded',saved:{path:'previous'}})
 const pending=c.prepareSave('guide');c.localEdit();assert.equal(c.state.saved,null);assert.equal(c.state.saveReview,null);wait.resolve(ok({draftHash:task.draftHash}));await pending;assert.equal(c.state.saveReview,null)
 await assert.rejects(c.prepareSave('guide'),/unapplied-edits/);assert.equal(calls.length,1)
 c.localEdit(false);c.set({saveReview:{draftHash:task.draftHash},saved:{path:'old'}});c.component();assert.equal(c.state.saveReview,null);assert.equal(c.state.saved,null);c.dispose()
})
test('invalid drafts never reach Host; valid complete edits persist a new hash without altering old artifacts or failures',async()=>{
 const root=await mkdtemp(join(tmpdir(),'course-review-')),store=await new CourseStore(root,{generate:async input=>fixtureDraft(input)}).init()
 const course=await store.dispatch({action:'createCourse',requestId:newId('request'),name:'Synthetic quadratics'}),ref=await store.dispatch({action:'addReference',courseId:course.id,requestId:newId('request'),name:'synthetic.txt',base64:Buffer.from('Self-authored quadratics.').toString('base64')})
 const running=await store.dispatch({action:'generate',courseId:course.id,requestId:newId('request'),sessionId:newId('session'),input:task.input,referenceIds:[ref.id],consent:true});await store.jobs.get(running.id)?.promise
 const done=await store.dispatch({action:'task',courseId:course.id,taskId:running.id}),calls=[]
 const c=new CourseController({dispatch:async payload=>{const raw=JSON.parse(payload);calls.push(raw.request.action);return ok(await store.dispatch(raw.request))}});c.set({workspaceId:'ws',courseId:course.id,task:done,phase:'succeeded'})
 try{
  await c.prepareSave('guide');const saved=await c.save('new-version'),oldBytes=await readFile(saved.path)
  for(const mutate of [d=>d.sequence[0].minutes='',d=>d.sequence[0].minutes=0,d=>d.sequence[0].minutes=1.5,d=>d.sequence[0].minutes=6,d=>d.quiz[0].answer=4,d=>d.quiz[0].options.pop(),d=>d.title='',d=>d.components[0].id='other']){
   const draft=structuredClone(done.draft);mutate(draft);const count=calls.length;await assert.rejects(c.revise(draft));assert.equal(calls.length,count);assert.equal(store.task(done.id).draftHash,done.draftHash)
  }
  const draft=structuredClone(done.draft);draft.title='Revised bilingual lesson · 修订课堂';draft.intentions[0]='One item, English\n中文仍在同一项';draft.sequence[0].title='Revised starter';draft.sequence[0].teacher='Q1: substitute zero; answer 3.\n代入零，答案3。';draft.quiz[0].answer=1;draft.quiz[0].options[1]='(2,−1)';draft.quiz[0].explanation='The square is zero at x=2.\nx=2 时平方为零。';draft.components[0].title='Revised worksheet'
  c.localEdit();await c.revise(draft);assert.notEqual(c.state.task.draftHash,done.draftHash);assert.equal(c.state.saved,null);assert.equal(c.state.localEdits,false);assert.equal(c.state.task.draft.intentions.length,done.draft.intentions.length);assert.equal(c.state.task.draft.intentions[0],draft.intentions[0]);assert.deepEqual(await readFile(saved.path),oldBytes)
  const persisted=JSON.parse(await readFile(store.path,'utf8'));assert.equal(persisted.version,1);assert.equal(persisted.tasks[0].draftHash,c.state.task.draftHash);assert.ok(!calls.includes('generate'))
 }finally{c.dispose();await store.dispose()}
})
test('lost save reply survives local edits, task/workspace changes and reset; reconcile original workspace/id without repeat',async()=>{
 const calls=[],{c}=controller((action,raw)=>{calls.push(raw);if(action==='save')throw Error('reply lost');return Promise.resolve(ok(action==='saveStatus'?{id:raw.request.saveId,status:'saved',path:'original'}:snapshot))})
 c.set({workspaceId:'original-ws',courseId:task.courseId,task,saveReview:{component:'guide',draftHash:task.draftHash,artifactSha256:'sha',existingSha256:null}})
 try{
  await assert.rejects(c.save('new-version'),/reply lost/);const request=structuredClone(c.saveRequest)
  c.localEdit();await assert.rejects(c.revise(task.draft),/reconcile-save-first/);c.component();c.course('other');await c.workspace('new-ws');c.invalidate()
  assert.deepEqual(c.saveRequest,request);assert.equal(c.unresolvedSave(),true);await assert.rejects(c.prepareSave('guide'),/reconcile-save-first/)
  await c.reconcileSave();const last=calls.at(-1);assert.equal(last.workspaceId,'original-ws');assert.equal(last.request.saveId,request.saveId);assert.equal(last.request.courseId,request.courseId);assert.equal(c.state.saved,null);assert.equal(c.state.originalSave.path,'original');assert.equal(c.unresolvedSave(),false);assert.equal(calls.filter(v=>v.request.action==='save').length,1)
 }finally{c.dispose()}
})
test('a pending original save can only continue explicitly after read-only reconciliation, with the identical request',async()=>{
 let sends=0;const {c,calls}=controller((action,raw)=>{if(action==='save'&&++sends===1)throw Error('lost');return Promise.resolve(ok(action==='saveStatus'?{id:raw.request.saveId,status:'pending'}:{status:'saved'}))})
 c.set({workspaceId:'ws',courseId:task.courseId,task,saveReview:{component:'guide',draftHash:task.draftHash,artifactSha256:'sha',existingSha256:null}})
 try{await assert.rejects(c.save('new-version'));await assert.rejects(c.continueSave(),/reconcile-save-first/);await c.reconcileSave();assert.equal(sends,1);await c.continueSave();assert.equal(sends,2);const saves=calls.filter(c=>c.action==='save');assert.deepEqual(saves[0].raw,saves[1].raw)}finally{c.dispose()}
})

test('task read failures surface as transport errors and retain known historical outcomes during reconciliation',async()=>{
 const {c}=controller(()=>Promise.reject(Error('connection-unavailable')))
 try{
  c.set({workspaceId:'ws',courseId:task.courseId});await assert.rejects(c.openTask(task.id),/connection-unavailable/);assert.equal(c.state.phase,'unavailable');assert.equal(c.state.error,'connection-unavailable')
  for(const state of ['succeeded','failed','cancelled','restart-required']){c.set({task:{...task,state},phase:state});await c.reconcile();assert.equal(c.state.phase,state);assert.equal(c.state.error,'connection-unavailable')}
 }finally{c.dispose()}
})
