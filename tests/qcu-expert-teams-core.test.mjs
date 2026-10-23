import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,readdir,stat,symlink,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const source=process.env.QCU_TEAMS_PACKAGE_ROOT?new URL('file://'+process.env.QCU_TEAMS_PACKAGE_ROOT+'/'):new URL('../hub/plugins/qcu-expert-teams/',import.meta.url)
const {TeamStore,newId}=await import(new URL('src/store.mjs',source))
const {PRESETS}=await import(new URL('src/presets.mjs',source))
const {parseTeam,parseExpert,parseBundle,OUTPUT_BUDGET,VERSION,PROTOCOL}=await import(new URL('src/protocol.mjs',source))
const {TeamsController}=await import(new URL('src/controller.mjs',source))
const {renderReport,historyBackup,runProgress}=await import(new URL('src/reports.mjs',source))
const clone=v=>JSON.parse(JSON.stringify(v)),signal=()=>new AbortController().signal
const route={provider:'synthetic',model:'no-network',policy:{effort:'default',supportedEfforts:[],defaultEffort:null,outputBudget:OUTPUT_BUDGET}}
async function setup(overrides={}){const calls=[],root=await mkdtemp(join(tmpdir(),'qcu-team-test-'));const deps={model:async()=>route,skills:async name=>({name,content:'Synthetic method '+name,invocation:{userInvocable:true}}),generate:async input=>{calls.push(input);return input.member.name+' review'},...overrides};const store=await new TeamStore(root,deps).init();return {store,calls,root,deps}}
async function prepare(store){return store.prepare({teamId:'teaching-review',revision:1,task:'Review a self-authored synthetic lesson.',materials:'Anonymous quadratic equation lesson.'},signal())}
const start=(store,p,id=newId())=>store.start({intentId:p.id,requestId:id,consent:true},signal())
async function wait(store,id){await store.jobs.get(id)?.promise;return store.run(id)}
test('team validation rejects credential fields, loops, missing dependencies and disconnected members',()=>{
 assert.equal(parseTeam(PRESETS[0]).members.length,4)
 for(const change of [t=>t.apiKey='secret',t=>t.members[0].dependsOn=['editor'],t=>t.members[0].dependsOn=['absent'],t=>t.members[3].dependsOn=['subject'],t=>t.members[1].id='subject',t=>t.members[0].skillNames=['same','same'],t=>t.parallelism=4]){const t=clone(PRESETS[0]);change(t);assert.throws(()=>parseTeam(t))}
})
test('browse/save/prepare do not generate; skill body freezes and team revision invalidates previews',async()=>{
 const f=await setup();try{
  f.store.snapshot();const team=clone(PRESETS[0]);team.members[0].skillNames=['method'];await f.store.saveTeam(team,1)
  const p=await f.store.prepare({teamId:team.id,revision:2,task:'A task',materials:''},signal());assert.match(p.methods.method.content,/Synthetic method/);assert.equal(f.calls.length,0)
  f.store.skills=async()=>({content:'Changed later'});assert.match(p.methods.method.content,/Synthetic method/)
  await f.store.saveTeam({...team,name:'Changed team'},2);await assert.rejects(start(f.store,p),/prepare-expired/);assert.equal(f.calls.length,0)
 }finally{await f.store.dispose()}
})
test('real scheduler respects dependencies, parallel limit and duplicate-start identity',async()=>{
 let active=0,peak=0;const order=[]
 const f=await setup({generate:async({member,dependencies})=>{active++;peak=Math.max(peak,active);if(member.id==='editor')assert.equal(dependencies.length,3);await new Promise(r=>setTimeout(r,5));order.push(member.id);active--;return member.id+' output'}})
 try{const p=await prepare(f.store),id=newId(),r=await start(f.store,p,id);assert.equal((await start(f.store,p,id)).id,r.id);const done=await wait(f.store,r.id);assert.equal(done.status,'completed');assert.equal(order.length,4);assert.equal(order.at(-1),'editor');assert.ok(peak<=2);assert.equal((await start(f.store,p,id)).id,r.id);assert.equal(order.length,4);assert.equal(done.model.model,'no-network')}
 finally{await f.store.dispose()}
})
test('failed parallel worker drains peers, skips synthesis and cannot later become success',async()=>{
 const calls=[];let peerAborted=false
 const f=await setup({generate:async({member},s)=>{calls.push(member.id);if(member.id==='subject')throw Object.assign(Error('PRIVATE_PROVIDER_MESSAGE'),{code:'model-failed'});await new Promise(resolve=>{if(s.aborted){peerAborted=true;resolve()}else s.addEventListener('abort',()=>{peerAborted=true;resolve()},{once:true})});return 'late result'}})
 try{const p=await prepare(f.store),r=await start(f.store,p),done=await wait(f.store,r.id);assert.equal(done.status,'failed');assert.ok(!calls.includes('editor'));assert.ok(done.steps.every(s=>!['queued','running'].includes(s.status)));assert.ok(!JSON.stringify(done).includes('PRIVATE_PROVIDER_MESSAGE'));await new Promise(r=>setTimeout(r,5));assert.equal(f.store.run(r.id).status,'failed');assert.ok(peerAborted||calls.length===1)}finally{await f.store.dispose()}
})
test('cancel and timeout abort active calls and do not auto-retry',async t=>{
 for(const timeout of [false,true])await t.test(timeout?'timeout':'cancel',async()=>{
  let calls=0,observed=false,entered;const begun=new Promise(r=>entered=r)
  const f=await setup({stepTimeout:timeout?15:1000,generate:async(_i,s)=>{calls++;entered();s.addEventListener('abort',()=>observed=true,{once:true});return new Promise(()=>{})}})
  try{const p=await prepare(f.store),r=await start(f.store,p);await begun;if(!timeout)await f.store.cancel(r.id);const done=await wait(f.store,r.id);assert.equal(done.status,timeout?'failed':'cancelled');assert.ok(observed);assert.ok(calls<=2);assert.ok(done.steps.every(s=>s.id!=='editor'||s.status!=='completed'))}finally{await f.store.dispose()}
 })
})
test('preview expiry and missing skill prevent any start; restart never resumes recorded running tasks',async()=>{
 let now=0;const f=await setup({now:()=>now})
 try{const p=await prepare(f.store);now=600001;await assert.rejects(start(f.store,p),/prepare-expired/);const team=clone(PRESETS[0]);team.members[0].skillNames=['missing'];await f.store.saveTeam(team,1);f.store.skills=async()=>undefined;await assert.rejects(f.store.prepare({teamId:team.id,revision:2,task:'task',materials:''},signal()),/skill-unavailable/);assert.equal(f.calls.length,0)
  const r={id:'interrupted-run',requestId:'old',team:clone(PRESETS[0]),status:'running',steps:PRESETS[0].members.map(m=>({id:m.id,name:m.name,status:'queued',output:''}))};f.store.state.runs.push(r);await f.store.persist();const restored=await new TeamStore(f.root,f.deps).init();assert.equal(restored.run(r.id).status,'interrupted');assert.equal(f.calls.length,0);await restored.dispose()
 }finally{await f.store.dispose()}
})
test('workspace state is separate; symlinked storage is rejected',async()=>{
 const a=await setup(),b=await setup();try{await a.store.saveTeam({...clone(PRESETS[0]),name:'Only workspace A'},1);assert.equal(b.store.snapshot().teams[0].team.name,'教学评审团');assert.ok(!(await readFile(join(a.root,'.qcu-expert-teams/state.json'),'utf8')).includes('API_KEY'))}
 finally{await a.store.dispose();await b.store.dispose()}
 const root=await mkdtemp(join(tmpdir(),'qcu-team-link-')),other=await mkdtemp(join(tmpdir(),'qcu-team-target-'));await symlink(other,join(root,'.qcu-expert-teams'));await assert.rejects(new TeamStore(root,{}).init(),/unsafe-store/)
})
test('client discards stale workspace responses and invalidates consent on edits/reset without resending',async()=>{
 const calls=[];let finish
 const remote={dispatch:async payload=>{const r=JSON.parse(payload);calls.push(r.action);if(r.workspaceId==='old')return new Promise(resolve=>finish=()=>resolve(JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value:{teams:[{team:{...PRESETS[0],name:'Old'},revision:1}],runs:[],skills:[]}})));return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value:{teams:[{team:clone(PRESETS[0]),revision:1}],runs:[],skills:[]}})}}
 const c=new TeamsController(remote),old=c.selectWorkspace('old');await c.selectWorkspace('new');finish();await old;assert.equal(c.state.row.team.name,'教学评审团');c.set({prepared:{id:'preview'},consent:true});c.input('task','changed');assert.equal(c.state.prepared,null);assert.equal(c.state.consent,false);c.invalidate();assert.ok(!calls.includes('start'));c.dispose()
})
test('simultaneous duplicate starts share one durable run and one model call per role',async()=>{
 const f=await setup();try{const p=await prepare(f.store),id=newId();const [a,b]=await Promise.all([start(f.store,p,id),start(f.store,p,id)]);assert.equal(a.id,b.id);await wait(f.store,a.id);assert.equal(f.calls.length,4);assert.equal(f.store.state.runs.length,1)}finally{await f.store.dispose()}
})
test('unload during initial run persistence prevents late model work',async()=>{
 const f=await setup();const p=await prepare(f.store);let release,entered;const waiting=new Promise(r=>entered=r),gate=new Promise(r=>release=r),persist=f.store.persist.bind(f.store);let first=true
 f.store.persist=async()=>{if(first){first=false;entered();await gate}return persist()}
 const starting=start(f.store,p);await waiting;const stopping=f.store.dispose();release();await assert.rejects(starting,/plugin-stopped/);await stopping;assert.equal(f.calls.length,0);assert.equal(f.store.state.runs[0].status,'interrupted')
})
test('connection reset during initial workspace lookup recovers the catalog without restoring consent or starting work',async()=>{
 const calls=[];let release
 const reply=value=>JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value})
 const c=new TeamsController({dispatch:async payload=>{
  const request=JSON.parse(payload);calls.push(request.action)
  assert.equal(request.action,'workspaces')
  if(calls.length===1)return new Promise(resolve=>release=()=>resolve(reply([{id:'stale',title:'Old connection'}])))
  return reply([{id:'current',title:'Current workspace'}])
 }},{autoSelect:false})
 const initial=c.boot();c.set({prepared:{id:'old-preview'},consent:true,task:'Keep the draft task'})
 await c.reconnect();release();await initial
 assert.deepEqual(c.state.workspaces,[{id:'current',title:'Current workspace'}])
 assert.equal(c.state.prepared,null);assert.equal(c.state.consent,false);assert.equal(c.state.task,'Keep the draft task');assert.equal(c.state.error,'')
 assert.deepEqual(calls,['workspaces','workspaces'])
 c.dispose();await c.reconnect();assert.equal(calls.length,2)
})
test('legacy state migrates without losing edited roles, skills, dependency order or historical snapshots',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qcu-team-migration-')),dir=join(root,'.qcu-expert-teams');await mkdir(dir)
 const legacy=clone(PRESETS[0]);legacy.members[0].name='原有学科专家';legacy.members[0].skillNames=['old-method']
 const historical={id:'historical',team:clone(legacy),input:{task:'Historical task'},status:'completed',steps:legacy.members.map(m=>({id:m.id,name:m.name,status:'completed',output:'Preserved output'}))}
 const bytes=JSON.stringify({schemaVersion:1,teams:[{team:legacy,revision:7}],runs:[historical]});await writeFile(join(dir,'state.json'),bytes)
 const store=await new TeamStore(root,{}).init();try{
  assert.equal(store.state.schemaVersion,2);assert.equal(store.state.teams[0].revision,7);assert.deepEqual(store.state.runs[0],historical)
  const resolved=store.resolvedTeam(store.state.teams[0]).team;assert.deepEqual(resolved,legacy)
  const backup=(await readdir(dir)).find(n=>n.startsWith('state-v1-'));assert.ok(backup);assert.equal(await readFile(join(dir,backup),'utf8'),bytes);assert.equal((await stat(join(dir,backup))).mode&0o777,0o600)
  const reopened=await new TeamStore(root,{}).init();assert.equal(reopened.state.experts.length,4);assert.deepEqual(reopened.state.runs[0],historical);await reopened.dispose()
 }finally{await store.dispose()}
})
test('one expert is reusable by teams; updates invalidate previews while running/history retain the exact expert snapshot',async()=>{
 const f=await setup();try{
  const first=f.store.snapshot().teams[0],subjectId=first.team.members[0].expertId,second={...clone(first.team),id:'second-team',name:'第二个团队'}
  second.members[0].assignment='仅第二个团队的补充要求';await f.store.saveTeam(second,0)
  const p=await prepare(f.store),expert=f.store.state.experts.find(r=>r.expert.id===subjectId),updated=await f.store.saveExpert({...expert.expert,instructions:'新职责：检查依据并保留分歧。'},expert.revision)
  await assert.rejects(start(f.store,p),/prepare-expired|expert-changed/);assert.equal(f.calls.length,0)
  const a=f.store.resolvedTeam(f.store.state.teams[0]).team,b=f.store.resolvedTeam(f.store.state.teams[1]).team;assert.match(a.members[0].instructions,/新职责/);assert.ok(!a.members[0].instructions.includes('补充要求'));assert.match(b.members[0].instructions,/仅第二个团队/)
  const ready=await prepare(f.store),r=await start(f.store,ready);await wait(f.store,r.id);await f.store.saveExpert({...updated.expert,instructions:'再次更新职责。'},updated.revision)
  assert.match(f.store.run(r.id).team.members[0].instructions,/新职责/);assert.equal(f.store.run(r.id).expertRevisions[subjectId],updated.revision)
 }finally{await f.store.dispose()}
})
test('archive guards referenced experts, restores safely and bundle import remaps IDs without replacing originals',async()=>{
 const f=await setup(),other=await setup();try{
  const snapshot=f.store.snapshot(),team=snapshot.teams[0],expert=snapshot.experts[0]
  await assert.rejects(f.store.archive('expert',expert.expert.id,expert.revision,true),/expert-in-use/)
  const bundle={format:'qcu-expert-team-bundle',schemaVersion:1,team:team.team,experts:snapshot.experts.map(r=>r.expert)};assert.equal(parseBundle(bundle).experts.length,4)
  const imported=await other.store.importBundle(bundle),saved=imported.teams.find(r=>r.team.id===imported.importedTeamId);assert.notEqual(saved.team.id,team.team.id);assert.ok(saved.team.members.every(m=>!team.team.members.some(old=>old.expertId===m.expertId)));assert.equal(other.store.state.teams[0].team.name,'教学评审团')
  await f.store.archive('team',team.team.id,team.revision,true);const archived=await f.store.archive('expert',expert.expert.id,expert.revision,true);assert.equal(archived.experts[0].archived,true)
  await assert.rejects(f.store.archive('team',team.team.id,2,false),/expert-archived/);await f.store.archive('expert',expert.expert.id,2,false);await f.store.archive('team',team.team.id,2,false)
  assert.equal(f.store.state.teams[0].archived,false);assert.throws(()=>parseExpert({...expert.expert,apiKey:'not-allowed'}));assert.throws(()=>parseTeam({...team.team,members:[team.team.members[0],{...team.team.members[1],expertId:team.team.members[0].expertId}]}),/duplicate-expert/)
 }finally{await f.store.dispose();await other.store.dispose()}
})
test('expert save detects stale revisions and rolls back the library on persistence failure',async()=>{
 const f=await setup();try{const row=f.store.snapshot().experts[0];await assert.rejects(f.store.saveExpert({...row.expert,name:'Stale'},0),/stale-expert/);const persist=f.store.persist;f.store.persist=async()=>{throw Error('write rejected')};await assert.rejects(f.store.saveExpert({...row.expert,name:'Unsaved'},row.revision));assert.deepEqual(f.store.snapshot().experts[0],row);f.store.persist=persist}finally{await f.store.dispose()}
})
test('client automatically selects a legal workspace and protects unsaved expert edits during navigation',async()=>{
 const f=await setup(),calls=[],storage=new Map();const remote={dispatch:async wire=>{const r=JSON.parse(wire);calls.push(r.action);const value=r.action==='workspaces'?[{id:'workspace',title:'Fixture'}]:r.action==='catalog'?{...f.store.snapshot(),skills:[]}:null;return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value})}}
 const c=new TeamsController(remote,{storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});try{
  await c.boot();assert.equal(c.state.workspaceId,'workspace');assert.equal(c.state.row.team.name,'教学评审团');assert.deepEqual(calls,['workspaces','catalog'])
  c.navigate({type:'tab',id:'experts'});c.set({editing:true});c.editExpert({...c.state.expertRow.expert,name:'未保存专家'});c.navigate({type:'tab',id:'teams'});assert.equal(c.state.tab,'experts');assert.equal(c.state.pendingNavigation.type,'tab');await c.resolveNavigation('cancel');assert.equal(c.state.expertRow.expert.name,'未保存专家');c.navigate({type:'tab',id:'teams'});await c.resolveNavigation('discard');assert.equal(c.state.tab,'teams');assert.equal(c.state.dirty,false);assert.ok(!calls.includes('start'))
 }finally{c.dispose();await f.store.dispose()}
})
const cleanupRequest=(runIds,workspaceId='fixture-a')=>({runIds,workspaceId})
const confirm=(store,p,extra={})=>store.confirmCleanup({workspaceId:p.workspaceId,cleanupId:p.id,consent:true,...extra})
async function finished(f){const p=await prepare(f.store),r=await start(f.store,p);return wait(f.store,r.id)}
test('cleanup has separate preview and cancel, rejects running/duplicate/empty selections and never calls models',async()=>{
 const f=await setup();try{
  const r=await finished(f),before=JSON.stringify(f.store.state),calls=f.calls.length
  for(const ids of [[],[r.id,r.id]])await assert.rejects(f.store.previewCleanup(cleanupRequest(ids)),/cleanup-selection/)
  const p=await f.store.previewCleanup(cleanupRequest([r.id]));assert.equal(p.count,1);assert.equal(p.workspaceId,'fixture-a');assert.deepEqual(p.runIds,[r.id]);assert.equal(JSON.stringify(f.store.state),before)
  await assert.rejects(confirm(f.store,p,{consent:false}),/cleanup-consent/)
  await f.store.cancelCleanup({workspaceId:p.workspaceId,cleanupId:p.id});await assert.rejects(confirm(f.store,p),/cleanup-expired/)
  f.store.state.runs[0].status='running';await assert.rejects(f.store.previewCleanup(cleanupRequest([r.id])),/cleanup-running/);await assert.rejects(f.store.exportHistory(cleanupRequest([r.id])),/cleanup-running/)
  assert.equal(f.calls.length,calls)
 }finally{await f.store.dispose()}
})
test('cleanup binds exact contents and workspace, expires and is single-use, including stale confirmations',async()=>{
 let now=1000;const f=await setup({now:()=>now}),other=await setup();try{
  const r=await finished(f),before=JSON.stringify(other.store.state),p=await f.store.previewCleanup(cleanupRequest([r.id]))
  await assert.rejects(confirm(other.store,p),/cleanup-expired/);assert.equal(JSON.stringify(other.store.state),before)
  await assert.rejects(confirm(f.store,p,{workspaceId:'fixture-b'}),/cleanup-expired/);await assert.rejects(confirm(f.store,p),/cleanup-expired/)
  const stale=await f.store.previewCleanup(cleanupRequest([r.id]));f.store.state.runs[0].steps[0].output+=' changed';await assert.rejects(confirm(f.store,stale),/cleanup-expired/);await assert.rejects(confirm(f.store,stale),/cleanup-expired/)
  const expired=await f.store.previewCleanup(cleanupRequest([r.id]));now+=600001;await assert.rejects(confirm(f.store,expired),/cleanup-expired/);assert.equal(f.store.state.runs.length,1)
  const valid=await f.store.previewCleanup(cleanupRequest([r.id]));await confirm(f.store,valid);await assert.rejects(confirm(f.store,valid),/cleanup-expired/);assert.equal(f.store.state.schemaVersion,2)
 }finally{await f.store.dispose();await other.store.dispose()}
})
test('cleanup rechecks running state and refuses a still-saving terminal job',async()=>{
 const f=await setup();try{const r=await finished(f),p=await f.store.previewCleanup(cleanupRequest([r.id]));f.store.state.runs[0].status='running';await assert.rejects(confirm(f.store,p),/cleanup-running/);f.store.state.runs[0].status='completed';f.store.jobs.set(r.id,{});await assert.rejects(f.store.previewCleanup(cleanupRequest([r.id])),/cleanup-running/);f.store.jobs.delete(r.id)}finally{await f.store.dispose()}
})
test('cleanup persistence failure rolls back memory and disk, retains start previews but consumes cleanup confirmation',async()=>{
 const f=await setup();try{
  const r=await finished(f),ready=await prepare(f.store),p=await f.store.previewCleanup(cleanupRequest([r.id])),before=JSON.stringify(f.store.state),disk=await readFile(join(f.root,'.qcu-expert-teams/state.json'),'utf8'),persist=f.store.persist
  f.store.persist=async()=>{throw Object.assign(Error('PRIVATE_DISK_ERROR'),{code:'state-write-failed'})};await assert.rejects(confirm(f.store,p),/PRIVATE_DISK_ERROR/);f.store.persist=persist
  assert.equal(JSON.stringify(f.store.state),before);assert.equal(await readFile(join(f.root,'.qcu-expert-teams/state.json'),'utf8'),disk);assert.ok(f.store.prepared.has(ready.id));await assert.rejects(confirm(f.store,p),/cleanup-expired/)
 }finally{await f.store.dispose()}
})
test('capacity count and exact UTF8 bytes, explicit cleanup frees 50-run cap and prevents any old start replay',async()=>{
 const f=await setup();try{
  const old=await prepare(f.store),requestId=newId(),r=await start(f.store,old,requestId);await wait(f.store,r.id)
  const original=f.store.state.runs[0];for(let i=1;i<50;i++)f.store.state.runs.push({...clone(original),id:'history-'+i,requestId:'past-'+i});await f.store.persist()
  const ready=await prepare(f.store),p=await f.store.previewCleanup(cleanupRequest([r.id])),cap=f.store.snapshot().capacity;assert.equal(cap.count,50);assert.equal(cap.bytes,Buffer.byteLength(JSON.stringify(f.store.state)));assert.equal(cap.limit,true);assert.equal(cap.near,true)
  await assert.rejects(start(f.store,ready),/store-limit/);const calls=f.calls.length;await confirm(f.store,p)
  assert.equal(f.store.capacity().count,49);assert.equal(f.store.capacity().limit,false);assert.equal(f.calls.length,calls)
  await assert.rejects(start(f.store,old,requestId),/prepare-expired/);await assert.rejects(start(f.store,ready),/prepare-expired/)
  const next=await prepare(f.store),newRun=await start(f.store,next);assert.equal((await wait(f.store,newRun.id)).status,'completed');assert.equal(f.store.state.runs.length,50);assert.equal(f.calls.length,calls+4)
 }finally{await f.store.dispose()}
})
test('byte cap reports truthful storage use and blocks persist; selected cleanup frees byte capacity',async()=>{
 const f=await setup();try{
  await finished(f);const original=clone(f.store.state.runs[0]);for(let i=1;i<13;i++)f.store.state.runs.push({...clone(original),id:'bytes-'+i,requestId:'bytes-'+i})
  for(const r of f.store.state.runs)for(const s of r.steps)s.output='文'.repeat(49000)
  assert.ok(f.store.capacity().bytes>7200000);assert.ok(f.store.capacity().bytes<8000000);await f.store.persist();const disk=await readFile(join(f.root,'.qcu-expert-teams/state.json'),'utf8')
  f.store.state.runs.push({...clone(f.store.state.runs[0]),id:'overflow'});await assert.rejects(f.store.persist(),/store-limit/);assert.equal(f.store.capacity().limit,true);assert.equal(await readFile(join(f.root,'.qcu-expert-teams/state.json'),'utf8'),disk)
  const p=await f.store.previewCleanup(cleanupRequest(['overflow','bytes-1']));await confirm(f.store,p);assert.equal(f.store.capacity().limit,false);assert.ok(f.store.capacity().bytes<Buffer.byteLength(disk))
 }finally{await f.store.dispose()}
})
test('cleanup is serialized with library mutations and invalidates a prepare already awaiting model lookup',async()=>{
 const f=await setup();try{
  const r=await finished(f),p=await f.store.previewCleanup(cleanupRequest([r.id]));let release,entered;const gate=new Promise(r=>release=r),begun=new Promise(r=>entered=r),persist=f.store.persist.bind(f.store);let once=true
  f.store.persist=async()=>{if(once){once=false;entered();await gate}return persist()};const row=f.store.state.experts[0],saving=f.store.saveExpert({...row.expert,name:'Serialized'},1);await begun
  const deleting=confirm(f.store,p);assert.equal(f.store.state.runs.length,1);release();await saving;await deleting;assert.equal(f.store.state.experts[0].expert.name,'Serialized');assert.equal(f.store.state.runs.length,0)
  const second=await finished(f),preview=await f.store.previewCleanup(cleanupRequest([second.id]));let resolveModel;f.store.model=()=>new Promise(r=>resolveModel=r);const preparing=prepare(f.store);await confirm(f.store,preview);resolveModel(route);await assert.rejects(preparing,/prepare-expired/)
 }finally{await f.store.dispose()}
})
test('data-only backup includes selected terminal history only, sanitizes errors and cannot import or execute',async()=>{
 const f=await setup();try{
  const a=await finished(f);await finished(f);const stored=f.store.state.runs.find(r=>r.id===a.id);stored.error='PRIVATE_ADAPTER_FAILURE';stored.steps[0].error='PRIVATE_STEP_ERROR';stored.credentials={apiKey:'PRIVATE_SECRET'}
  const calls=f.calls.length,backup=await f.store.exportHistory(cleanupRequest([a.id]));assert.equal(backup.dataOnly,true);assert.equal(backup.format,'qcu-expert-history-backup');assert.equal(backup.runs.length,1);assert.equal(backup.runs[0].id,a.id);assert.match(JSON.stringify(backup),/review/);assert.doesNotMatch(JSON.stringify(backup),/PRIVATE_|intentId|requestId|methods|instructions/);assert.throws(()=>parseBundle(backup));await assert.rejects(f.store.importBundle(backup));assert.equal(f.calls.length,calls);assert.equal(f.store.state.runs.length,2)
 }finally{await f.store.dispose()}
})
test('completed and failed reports use real outputs, exact model, safe states, timings and named steps',async()=>{
 for(const mode of ['completed','failed']){
  const f=await setup({generate:async({member})=>{if(mode==='failed'&&member.id==='editor')throw Object.assign(Error('PRIVATE_ADAPTER_ERROR'),{code:'model-max-tokens'});return member.name+'：80元涨至100元，基数应为80，涨幅25%，不是20%。'}})
  try{const done=await finished(f),report=renderReport(done);assert.equal(done.status,mode);assert.match(report,/待教师复核/);assert.match(report,/synthetic\/no-network/);assert.match(report,/完成步骤：[34]\/4/);assert.match(report,/25%/);assert.match(report,/开始时间：\d{4}-/);assert.doesNotMatch(report,/PRIVATE_|apiKey|价格|tokenUsage/);for(const m of done.team.members)assert.ok(report.includes('## '+m.name));if(mode==='failed'){assert.match(report,/未完成/);assert.match(report,/model-max-tokens/);assert.match(report,/最终汇总缺失/)}else assert.match(report,/最终汇总已完成/)}finally{await f.store.dispose()}
 }
})
test('cancelled and restart-interrupted reports preserve finished opinions without claiming synthesis complete',async()=>{
 let begun;const editor=new Promise(r=>begun=r),f=await setup({generate:async({member})=>{if(member.id==='editor'){begun();return new Promise(()=>{})}return member.name+' completed evidence'}})
 try{
  const r=await start(f.store,await prepare(f.store));await editor;await f.store.cancel(r.id);const cancelled=f.store.run(r.id),report=renderReport(cancelled);assert.equal(cancelled.status,'cancelled');assert.match(report,/已停止 \(cancelled\)/);assert.match(report,/完成步骤：3\/4/);assert.match(report,/completed evidence/);assert.match(report,/待教师复核 \/ 未完成/)
  const stored=f.store.state.runs[0];stored.status='running';stored.steps.at(-1).status='running';delete stored.finishedAt;await f.store.persist();const reopened=await new TeamStore(f.root,f.deps).init();try{const interrupted=renderReport(reopened.run(r.id));assert.match(interrupted,/已中断 \(interrupted\)/);assert.match(interrupted,/耗时未记录/);assert.match(interrupted,/completed evidence/);assert.match(interrupted,/未完成/)}finally{await reopened.dispose()}
 }finally{await f.store.dispose()}
})
test('legacy/missing/reversed timings and partial final output remain honest and never expose raw errors',()=>{
 const legacy={id:'legacy',team:clone(PRESETS[0]),input:{task:'Legacy'},status:'failed',error:'PRIVATE_RAW_ERROR',steps:PRESETS[0].members.map((m,i)=>({id:m.id,name:m.name,status:i===3?'failed':'completed',output:i===3?'partial synthesis':'opinion',error:i===3?'PRIVATE_STEP':undefined}))}
 assert.equal(runProgress(legacy).elapsedMs,null);assert.match(renderReport(legacy),/时间：未记录/);assert.match(renderReport(legacy),/部分输出/);assert.doesNotMatch(renderReport(legacy),/PRIVATE_|Invalid Date|NaN/)
 legacy.createdAt=200;legacy.finishedAt=100;assert.equal(runProgress(legacy).elapsedMs,null);legacy.createdAt=0;legacy.finishedAt=100;assert.equal(runProgress(legacy).elapsedMs,100);legacy.createdAt=Number.MAX_VALUE;assert.doesNotThrow(()=>renderReport(legacy))
 legacy.status='completed';assert.match(renderReport(legacy),/待教师复核 \/ 未完成/)
})
test('client cleanup updates selection, report pane and capacity, clears consent and ignores old-workspace response',async()=>{
 const a=await setup(),b=await setup();let release;const calls=[]
 const c=new TeamsController({dispatch:async wire=>{const r=JSON.parse(wire);calls.push(r.action);const store=r.workspaceId==='a'?a.store:b.store;let value;if(r.action==='catalog')value={...store.snapshot(),skills:[]};else if(r.action==='confirmCleanup'){value=await store.confirmCleanup(r);if(release===null)await new Promise(r=>release=r)}else value=await store[r.action](r);return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value})}})
 try{
  const run=await finished(a);await c.loadWorkspace('a');c.set({run,tab:'runs',prepared:{id:'old'},consent:true});c.toggleRun(run.id);await c.exportHistory(data=>assert.equal(data.runs[0].id,run.id));await c.previewCleanup();c.set({cleanupConsent:true});await c.confirmCleanup();assert.equal(c.state.run,null);assert.equal(c.state.capacity.count,0);assert.deepEqual(c.state.selectedRuns,[]);assert.equal(c.state.prepared,null);assert.equal(c.state.consent,false);assert.match(c.state.notice,/1 条/)
  const again=await finished(a);await c.loadWorkspace('a');c.toggleRun(again.id);await c.previewCleanup();c.set({cleanupConsent:true});release=null;const deleting=c.confirmCleanup();while(release===null)await new Promise(r=>setTimeout(r,1));await c.loadWorkspace('b');release();await deleting;assert.equal(c.state.workspaceId,'b');assert.equal(c.state.capacity.count,0);assert.equal(b.store.state.runs.length,0);assert.equal(calls.filter(x=>x==='start').length,0)
 }finally{c.dispose();await a.store.dispose();await b.store.dispose()}
})
test('self-authored anonymous two/four-person materials exercise actual dependency flow, not model quality',async()=>{
 for(const size of ['two','four']){
  const fixture=JSON.parse(await readFile(new URL('./fixtures/qcu-lesson-review-'+size+'.json',import.meta.url),'utf8')),f=await setup()
  try{
   assert.equal(fixture.testMaterialOnly,true);assert.throws(()=>parseTeam(fixture));const team={format:'qcu-expert-team',schemaVersion:1,id:'fixture-'+size,name:fixture.title,description:'Synthetic test only',members:fixture.participants.map(m=>({...m,skillNames:[]})),outputId:fixture.outputId,parallelism:2}
   await f.store.saveTeam(team,0);const p=await f.store.prepare({teamId:team.id,revision:1,task:fixture.task,materials:fixture.materials},signal()),r=await start(f.store,p),done=await wait(f.store,r.id)
   assert.equal(done.status,'completed');assert.equal(done.steps.length,size==='two'?2:4);assert.equal(f.calls.length,done.steps.length);assert.equal(f.calls.at(-1).dependencies.length,done.steps.length-1);assert.equal(done.input.materials,fixture.materials);assert.match(fixture.expectedHumanFinding,size==='two'?/25%/:/960/)
  }finally{await f.store.dispose()}
 }
})
test('entering empty history refreshes current storage bytes after config edits, reconnect drops removed detail',async()=>{
 const f=await setup(),calls=[],c=new TeamsController({dispatch:async wire=>{const r=JSON.parse(wire);calls.push(r.action);const data=f.store.snapshot();return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value:r.action==='history'?{runs:data.runs,capacity:data.capacity}:{...data,skills:[]}})}})
 try{
  await c.loadWorkspace('fixture-a');const before=c.state.capacity.bytes,row=f.store.snapshot().experts[0];await f.store.saveExpert({...row.expert,instructions:row.expert.instructions+' 新增用量'},row.revision)
  c.navigate({type:'tab',id:'runs'});while(c.state.busy)await new Promise(r=>setTimeout(r,1));assert.ok(c.state.capacity.bytes>before);assert.equal(c.state.capacity.bytes,f.store.capacity().bytes);assert.equal(calls.at(-1),'history')
  c.set({run:{id:'removed-elsewhere'}});await c.loadWorkspace('fixture-a',true);assert.equal(c.state.run,null)
 }finally{c.dispose();await f.store.dispose()}
})
