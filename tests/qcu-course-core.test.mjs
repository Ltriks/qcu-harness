import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,symlink,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CourseStore,newId} from '../hub/plugins/qcu-course-workbench/src/store.mjs'
import {parseInput,parseDraft,profile,FRAMEWORK,COMPONENTS} from '../hub/plugins/qcu-course-workbench/src/protocol.mjs'
import {material,filename,zipEntries} from '../hub/plugins/qcu-course-workbench/src/files.mjs'
import {zip,exportArtifact} from '../hub/plugins/qcu-course-workbench/src/export.mjs'
import {artifactHtml} from '../hub/plugins/qcu-course-workbench/src/artifact-html.mjs'
import {lessonInput,fixtureDraft} from './support/course-fixture.mjs'
const make=async options=>new CourseStore(await mkdtemp(join(tmpdir(),'qcu-course-test-')),{generate:async input=>fixtureDraft(input),...options}).init()
const course=(s,name='Same name')=>s.dispatch({action:'createCourse',requestId:newId('request'),name})
const reference=(s,c,name='anonymous.txt')=>s.dispatch({action:'addReference',courseId:c.id,requestId:newId('request'),name,base64:Buffer.from('Self-authored synthetic reference: y=x²−4x+3; completing the square gives (x−2)²−1.').toString('base64')})
const request=(c,r,patch={})=>({action:'generate',courseId:c.id,requestId:newId('request'),sessionId:newId('session'),input:lessonInput(),referenceIds:[r.id],consent:true,...patch})
async function completed(s,r){const t=await s.dispatch(r);await s.jobs.get(t.id)?.promise;return s.dispatch({action:'task',courseId:r.courseId,taskId:t.id})}

test('full 14-component lifecycle: names are independent, one-use references, reviewed edits, saved bytes and restart',async()=>{
 const s=await make(),c=await course(s),c2=await course(s);assert.notEqual(c.id,c2.id);const r=await reference(s,c),req=request(c,r)
 const t=await completed(s,req);assert.equal(t.state,'succeeded');assert.equal(t.draft.components.length,14);assert.equal(s.refs.size,0)
 assert.equal((await s.dispatch(req)).id,t.id);assert.equal((await s.dispatch({...req,requestId:newId('request')})).id,t.id)
 for(const component of ['lesson',...COMPONENTS.map(c=>c.id)]){
  const prepared=await s.dispatch({action:'prepareSave',courseId:c.id,taskId:t.id,component,draftHash:t.draftHash})
  const save={action:'save',courseId:c.id,taskId:t.id,component,draftHash:t.draftHash,artifactSha256:prepared.artifactSha256,existingSha256:prepared.existingSha256,saveId:newId('save'),mode:'new-version',confirmed:true}
  const saved=await s.dispatch(save);assert.equal((await readFile(saved.path)).length,saved.bytes);assert.equal((await s.dispatch(save)).path,saved.path)
 }
 const before=t.draftHash;t.draft.intentions[0]+=' Teacher revision.';const revised=await s.dispatch({action:'revise',courseId:c.id,taskId:t.id,draftHash:before,draft:t.draft});assert.notEqual(revised.draftHash,before)
 await assert.rejects(s.dispatch({action:'prepareSave',courseId:c.id,taskId:t.id,component:'lesson',draftHash:before}),/stale-preview/)
 await s.dispose();const restart=await new CourseStore(s.root,{generate:async input=>fixtureDraft(input)}).init();assert.equal(restart.state.tasks[0].state,'succeeded');assert.equal(restart.state.saves.length,15);assert.equal(restart.refs.size,0);await restart.dispose()
})
test('course isolation, consent, request conflicts and all target fields affect input identity',async()=>{
 const s=await make(),c=await course(s),other=await course(s),r=await reference(s,c),req=request(c,r)
 await assert.rejects(s.dispatch({...req,courseId:other.id}),/reference-expired-or-course-mismatch/)
 await assert.rejects(s.dispatch({...req,consent:false}),/model-consent-required/)
 const t=await completed(s,req);await assert.rejects(s.dispatch({...req,input:{...req.input,career_link:'Changed career goal'}}),/idempotency-conflict/)
 await assert.rejects(s.dispatch({action:'task',courseId:other.id,taskId:t.id}),/course-mismatch/)
 for(const key of [...Object.keys(FRAMEWORK),'big_idea','career_link','real_world_link']){
  const fresh=await reference(s,c),input=lessonInput();input[key]=Array.isArray(input[key])?[FRAMEWORK[key].find(v=>!input[key].includes(v))]:FRAMEWORK[key]?FRAMEWORK[key].find(v=>v!==input[key]&&!['ap','mcaa','portfolio'].includes(v)):'Updated '+key
  const next=await completed(s,request(c,fresh,{input}));assert.notEqual(next.id,t.id)
 }
 await s.dispose()
})
test('cancel, too-late cancellation, timeout unknown and Host restart never synthesize success',async()=>{
 let release;const s=await make({generate:()=>new Promise(resolve=>{release=resolve})}),c=await course(s),r=await reference(s,c),req=request(c,r),t=await s.dispatch(req)
 await s.dispatch({action:'cancel',courseId:c.id,taskId:t.id});await s.jobs.get(t.id)?.promise;assert.equal(s.task(t.id).state,'cancelled');release(fixtureDraft(req.input));await new Promise(r=>setImmediate(r));assert.equal(s.task(t.id).state,'cancelled');await s.dispose()
 const timed=await make({generate:()=>new Promise(()=>{}),timeoutMs:10}),tc=await course(timed),tr=await reference(timed,tc),unknown=await completed(timed,request(tc,tr));assert.equal(unknown.state,'unknown');await timed.dispose()
 const ended=await make(),ec=await course(ended),er=await reference(ended,ec),done=await completed(ended,request(ec,er));assert.equal((await ended.dispatch({action:'cancel',courseId:ec.id,taskId:done.id})).state,'succeeded');await ended.dispose()
 const interrupted=await make({generate:()=>new Promise(()=>{})}),ic=await course(interrupted),ir=await reference(interrupted,ic),running=await interrupted.dispatch(request(ic,ir));await interrupted.dispose();const recovered=await new CourseStore(interrupted.root,{}).init();assert.equal(recovered.task(running.id).state,'restart-required');await recovered.dispose()
})
test('save conflicts require exact reviewed bytes; versions and explicit overwrite preserve intent',async()=>{
 const s=await make(),c=await course(s),r=await reference(s,c),t=await completed(s,request(c,r));const base={courseId:c.id,taskId:t.id,component:'lesson',draftHash:t.draftHash}
 const prep=await s.dispatch({action:'prepareSave',...base});const makeSave=mode=>({action:'save',...base,artifactSha256:prep.artifactSha256,existingSha256:prep.existingSha256,saveId:newId('save'),mode,confirmed:true})
 const first=await s.dispatch(makeSave('new-version')),second=await s.dispatch(makeSave('new-version'));assert.match(second.name,/-v2\.docx$/);assert.notEqual(first.path,second.path)
 const conflict=await s.dispatch({action:'prepareSave',...base});await writeFile(first.path,'changed by user')
 await assert.rejects(s.dispatch({...makeSave('overwrite'),existingSha256:conflict.existingSha256}),/file-changed/)
 const reviewed=await s.dispatch({action:'prepareSave',...base});await s.dispatch({...makeSave('overwrite'),existingSha256:reviewed.existingSha256});assert.equal((await readFile(first.path)).length,prep.bytes)
 await assert.rejects(s.dispatch({...makeSave('new-version'),confirmed:false}),/save-confirmation-required/);await s.dispose()
})
test('save journal reconciles a crash after artifact write without a duplicate version',async()=>{
 const s=await make(),c=await course(s),r=await reference(s,c),t=await completed(s,request(c,r)),base={courseId:c.id,taskId:t.id,component:'lesson',draftHash:t.draftHash}
 const prep=await s.dispatch({action:'prepareSave',...base}),req={action:'save',...base,artifactSha256:prep.artifactSha256,existingSha256:null,saveId:newId('save'),mode:'new-version',confirmed:true}
 const persist=s.persist.bind(s);let writes=0;s.persist=async()=>{if(++writes===2)throw Error('injected persistence loss');return persist()}
 await assert.rejects(s.dispatch(req),/persistence loss/)
 const restarted=await new CourseStore(s.root,{}).init();const status=await restarted.dispatch({action:'saveStatus',courseId:c.id,saveId:req.saveId});assert.equal(status.status,'saved');assert.equal((await restarted.dispatch(req)).path,status.path)
 assert.equal((await readdir(join(restarted.output,c.id))).filter(v=>v.endsWith('.docx')).length,1);await restarted.dispose();s.persist=persist;await s.dispose()
})
test('failed running checkpoint keeps references and does not leave a phantom task',async()=>{
 const s=await make(),c=await course(s),r=await reference(s,c),persist=s.persist;s.persist=async()=>{throw Error('disk denied')}
 await assert.rejects(s.dispatch(request(c,r)),/disk denied/);assert.equal(s.state.tasks.length,0);assert.equal(s.refs.size,1);s.persist=persist;await s.dispose()
})
test('unsafe names, symlinks, encrypted/oversized ZIPs and unsupported formats fail closed',async()=>{
 for(const name of ['../evil','con','prn','..']){if(name.includes('/'))assert.doesNotThrow(()=>filename(name,'docx'));else assert.throws(()=>filename(name,'docx'))}
 assert.throws(()=>material('bad.pdf',Buffer.from('%PDF-1.7').toString('base64')),/unsupported-file-use-text/)
 assert.throws(()=>material('../secret.txt','YWJj'),/invalid-filename/)
 const word=zip({'word/document.xml':'<w:document><w:t>A self-authored reference &amp; sample text.</w:t></w:document>'});assert.match(material('sample.docx',word.toString('base64')).content,/reference & sample/)
 const bomb=Buffer.from(word);bomb.writeUInt32LE(4000001,bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]))+24);assert.throws(()=>zipEntries(bomb),/invalid-zip/)
 const s=await make(),outside=join(await mkdtemp(join(tmpdir(),'qcu-outside-')),'state');await writeFile(outside,'untouched');await symlink(outside,join(s.output,'evil'));await assert.rejects(s.existing(join(s.output,'evil')));assert.equal(await readFile(outside,'utf8'),'untouched');await s.dispose()
})
test('framework narrows enabled targets; draft validates alignment, exact selected components and duration',()=>{
 assert.throws(()=>profile({pathways:['invented']}),/invalid-enum/);assert.throws(()=>parseInput(lessonInput({pathway:'ap'})),/disabled-target/)
 assert.throws(()=>parseInput(lessonInput({career_link:''}),profile({careerLinkRequired:true})),/invalid-text/)
 assert.throws(()=>parseInput(lessonInput({competency_tags:['career']}),profile({competencies:['concept']})),/disabled-target/)
 const input=lessonInput(),draft=fixtureDraft(input);draft.sequence[0].minutes=8;assert.throws(()=>parseDraft(draft,input),/invalid-timing/)
 const missing=fixtureDraft(input);missing.components.pop();assert.throws(()=>parseDraft(missing,input),/missing-components/)
})
test('HTML templates escape model markup, stay offline and export every format deterministically',()=>{
 const input=lessonInput(),draft=fixtureDraft(input);draft.title='<script>parent.alert(1)</script>';draft.components[0].sections[0].body='</script><script>alert(1)</script>'
 const task={input,draft};for(const c of ['lesson',...input.components]){const a=exportArtifact(task,c),b=exportArtifact(task,c);assert.deepEqual(a,b);if(['lesson','ppt','guide','micro','hw','ticket','culture'].includes(c)){assert.ok(a.subarray(0,2).equals(Buffer.from('PK')))}else{const html=a.toString('utf8');assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(!/(?:src|href)=["']https?:\/\/|fetch\(/.test(html));assert.match(html,/connect-src 'none'/)}}
 assert.match(artifactHtml(task,'geo'),/circle.onkeydown/);assert.match(artifactHtml(task,'func'),/coefficient-/)
})

test('diagnostic persistence whitelists fields and values; legacy and unknown failures remain readable without invented causes',async()=>{
 const secret='SENSITIVE_DIAGNOSTIC_INJECTION'
 const safe={stage:'stream',reason:'model-provider-error',finishKind:'error',chunks:3,textChars:10,reasoningChars:20,streamChars:200,outputBudget:12000}
 const cases=[
  {diagnostic:{...safe,message:secret,stack:secret,url:secret,headers:{authorization:secret},failure:{code:secret},replayState:secret,refs:secret,prompt:secret,text:secret,reasoning:secret},expected:safe},
  {diagnostic:{...safe,failureCode:'AUTH'},expected:{...safe,failureCode:'AUTH'}},
  ...[secret,'auth',401,{code:'AUTH'}].map(failureCode=>({diagnostic:{...safe,failureCode},expected:safe})),
  {code:'output-too-large',diagnostic:{...safe,reason:'output-too-large',failureCode:'AUTH'},expected:{...safe,reason:'output-too-large'}},
  ...[{stage:secret},{reason:secret},{finishKind:secret},{chunks:NaN},{textChars:-1},{reasoningChars:1000000001},{streamChars:Infinity},{chunks:1.5},{outputBudget:24000}].map(patch=>({diagnostic:{...safe,...patch}})),
  {code:'model-incomplete'}, {code:'unrecognized-failure'},
 ]
 const s=await make({generate:async()=>{throw Object.assign(Error(secret),current)}});let current
 try{
  const c=await course(s)
  for(const item of cases){
   current={code:'model-provider-error',...item};const r=await reference(s,c),req=request(c,r),done=await completed(s,req)
   assert.equal(done.state,'failed');assert.equal(done.draft,undefined);assert.deepEqual(done.diagnostic,item.expected)
   assert.equal(done.message,item.code==='unrecognized-failure'?'generation-failed':item.code??'model-provider-error')
  }
  const persisted=await readFile(s.path,'utf8');assert.ok(!persisted.includes(secret))
  await s.dispose();const restarted=await new CourseStore(s.root,{generate:()=>assert.fail('reload must not generate')}).init()
  try{for(let i=0;i<cases.length;i++){const task=restarted.state.tasks[i];assert.deepEqual((await restarted.dispatch({action:'task',courseId:c.id,taskId:task.id})).diagnostic,cases[i].expected);assert.deepEqual(restarted.snapshot().tasks[i].diagnostic,cases[i].expected)}}finally{await restarted.dispose()}
 }finally{await s.dispose()}
})

test('local cancel, timeout and disposal win over late provider diagnostics and late success',async()=>{
 for(const mode of ['cancel','timeout','dispose']){
  let rejectLate,calls=0
  const s=await make({timeoutMs:mode==='timeout'?10:120000,generate:()=>{calls++;return new Promise((_,reject)=>{rejectLate=reject})}}),c=await course(s),r=await reference(s,c),req=request(c,r),task=await s.dispatch(req)
  if(mode==='cancel')await s.dispatch({action:'cancel',courseId:c.id,taskId:task.id})
  if(mode==='dispose')await s.dispose();else await s.jobs.get(task.id)?.promise
  rejectLate(Object.assign(Error('sensitive late error'),{code:'model-provider-aborted',diagnostic:{stage:'stream',reason:'model-provider-aborted',finishKind:'aborted',failureCode:'ABORTED',chunks:2,textChars:1,reasoningChars:1,streamChars:100,outputBudget:12000}}))
  await new Promise(resolve=>setImmediate(resolve))
  const done=s.task(task.id);assert.equal(done.state,{cancel:'cancelled',timeout:'unknown',dispose:'restart-required'}[mode]);assert.equal(done.diagnostic,undefined);assert.equal(done.draft,undefined);assert.equal(calls,1)
  await s.dispose()
 }
})
