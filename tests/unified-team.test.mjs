import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {TeamsController} from '../hub/plugins/qcu-expert-teams/src/controller.mjs'
import {VERSION,PROTOCOL} from '../hub/plugins/qcu-expert-teams/src/protocol.mjs'
import {UnifiedTeamStore} from '../hub/plugins/qcu-expert-teams/src/unified-store.mjs'
import {deepResearchTemplate,parseUnifiedTeam,parseReview,legacyToUnified} from '../hub/plugins/qcu-expert-teams/src/unified-model.mjs'
const source={id:'qcu-deep-research',name:'深度研究团队',revision:'pinned-test'}
const route={provider:'scripted',model:'no-paid-model',policy:{effort:'default',supportedEfforts:[],defaultEffort:null,outputBudget:6000}}
const signal=()=>new AbortController().signal
async function fixture(generate=async()=>({output:'scripted result',tools:[]})){
 const root=await mkdtemp(join(tmpdir(),'qcu-unified-')),store=await new UnifiedTeamStore(root,{generate,model:async()=>route,info:()=>({ready:true,tools:['web_search','web_fetch'],model:route})}).init()
 const row=await store.create(deepResearchTemplate(source,'team-test'));return {root,store,row}
}
const prep=(s,mode='demo')=>s.prepare({id:'team-test',revision:1,task:'合成研究任务',materials:'示例资料',mode},signal())
async function start(s,preview){return s.start({intentId:preview.id,requestId:randomUUID(),consent:true})}
async function done(s,id){await s.jobs.get(id)?.promise;return s.run(id)}

test('common model preserves seven editable roles and rejects cyclic or dishonest review definitions',()=>{
 const d=deepResearchTemplate(source,'team-test');assert.equal(d.roles.length,7)
 const custom=structuredClone(d);custom.roles[2].name='我的资料研究员';custom.roles[2].identity='学校教研助理';assert.equal(parseUnifiedTeam(custom).roles[2].identity,'学校教研助理')
 const cyclic=structuredClone(d);cyclic.workflow[0].dependsOn=['deliver'];assert.throws(()=>parseUnifiedTeam(cyclic))
 assert.throws(()=>parseReview('{"decision":"pass","issues":["有问题"],"summary":"ok"}'))
 const legacy=legacyToUnified({id:'old',name:'旧团队',description:'',outputId:'a',members:[{id:'a',name:'专家',instructions:'原职责',dependsOn:[]}]},'team-old');assert.equal(legacy.roles[0].advanced,'原职责')
})
test('demo uses zero model/tools, executes revision and persists an immutable snapshot and report',async()=>{
 let calls=0;const {store,root}=await fixture(async()=>{calls++;throw Error('Demo must not call generator')})
 try{
  const p=await prep(store),first=await start(store,p),r=await done(store,first.id)
  assert.equal(calls,0);assert.equal(r.status,'completed');assert.equal(r.budget.modelSteps,0);assert.equal(r.budget.toolCalls,0)
  assert.equal(r.steps.find(s=>s.id==='review').attempts.length,3);assert.equal(new Set(r.steps.flatMap(s=>s.attempts.map(a=>a.roleId))).size,7)
  assert.equal(r.artifacts.length,1);assert.match(await readFile(r.artifacts[0].path,'utf8'),/流程演示：未调用模型或工具/)
  const edited=structuredClone(store.state.teams[0].definition);edited.roles[0].name='修改后的主理人';await store.save(edited,1);assert.notEqual(store.run(r.id).definition.roles[0].name,'修改后的主理人')
  await store.dispose();const reloaded=await new UnifiedTeamStore(root,{generate:()=>{},model:()=>{},info:()=>({})}).init();try{assert.equal(reloaded.state.teams[0].definition.roles[0].name,'修改后的主理人');assert.equal(reloaded.run(r.id).status,'completed')}finally{await reloaded.dispose()}
 }finally{await store.dispose()}
})
test('programmatic review retries use the latest draft, stop at configured limit, and never publish rejected work',async()=>{
 const seen=[];const {store}=await fixture(async({role,step,upstream,reviewContext})=>{
  seen.push({role:role.id,upstream,reviewContext})
  if(step.review&&!reviewContext?.revising)return {output:JSON.stringify({decision:'revise',issues:['缺失证据'],summary:'需要修订'}),tools:[]}
  return {output:role.id==='reviser'?'revised-'+reviewContext.revision:'draft',tools:[]}
 })
 try{const r=await done(store,(await start(store,await prep(store,'live'))).id);assert.equal(r.status,'needs-review');assert.equal(r.steps.find(s=>s.id==='review').attempts.length,5);assert.equal(r.steps.find(s=>s.id==='write').status,'skipped');assert.equal(r.artifacts.length,0);const revisions=seen.filter(x=>x.role==='reviser');assert.match(revisions[1].upstream[0].output,/revised-1/)}finally{await store.dispose()}
})
test('invalid review JSON fails safely instead of silently passing',async()=>{
 const {store}=await fixture(async()=>({output:'not valid review JSON',tools:[]}))
 try{const r=await done(store,(await start(store,await prep(store,'live'))).id);assert.equal(r.status,'failed');assert.match(r.error,/JSON/);assert.equal(r.steps.find(s=>s.id==='write').status,'skipped')}finally{await store.dispose()}
})
test('previews are revision-bound and start requests are idempotent',async()=>{
 const {store}=await fixture()
 try{
  const p=await prep(store);const edited=structuredClone(store.state.teams[0].definition);edited.name='改名';await store.save(edited,1)
  await assert.rejects(start(store,p))
  const preview=await store.prepare({id:'team-test',revision:2,task:'合成任务',materials:'',mode:'demo'},signal()),request={intentId:preview.id,requestId:randomUUID(),consent:true}
  const [a,b]=await Promise.all([store.start(request),store.start(request)]);assert.equal(a.id,b.id);await done(store,a.id);assert.equal(store.state.runs.length,1)
 }finally{await store.dispose()}
})
test('cancel reaches active native adapter and skips downstream; restart does not rerun',async()=>{
 let aborted=false;const {store,root}=await fixture(async(_request,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))},{once:true})))
 try{
  const run=await start(store,await prep(store,'live'));while(!store.executions.size)await new Promise(r=>setImmediate(r))
  await store.cancel(run.id);assert.equal(aborted,true);assert.equal(store.run(run.id).status,'cancelled');assert.ok(store.run(run.id).steps.some(s=>s.status==='skipped'))
  await store.dispose();const state=JSON.parse(await readFile(store.file,'utf8'));state.runs[0].status='running';await writeFile(store.file,JSON.stringify(state))
  let generated=0;const restored=await new UnifiedTeamStore(root,{generate:()=>generated++,model:()=>{},info:()=>({})}).init();try{assert.equal(restored.state.runs[0].status,'interrupted');assert.equal(generated,0)}finally{await restored.dispose()}
 }finally{await store.dispose()}
})
test('starting an original review run replaces a previously selected unified run',async()=>{
 const r={id:'old-run',team:{name:'原有评审'},input:{task:'评审'},status:'running',createdAt:1}
 const c=new TeamsController({dispatch:async payload=>JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value:JSON.parse(payload).action==='start'?r:{runs:[],capacity:null}})})
 try{c.set({workspaceId:'w',unifiedRun:{id:'new-run'},prepared:{id:'preview'},consent:true});await c.start();assert.equal(c.state.run.id,'old-run');assert.equal(c.state.unifiedRun,null)}finally{c.dispose()}
})

test('response caps preserve old budgets, freeze confirmed increase, and retain truncated failure evidence',async()=>{
 const legacy=deepResearchTemplate(source,'team-test');assert.equal(legacy.limits.maxOutputTokens,2000)
 const invalid=structuredClone(legacy);invalid.limits.maxOutputTokens=999999;assert.throws(()=>parseUnifiedTeam(invalid))
 const {store}=await fixture(async()=>{throw Object.assign(Error('response cap reached'),{public:true,partialOutput:'Truncated fixture text',tools:[{name:'web_fetch',success:true}]})})
 try{const row=store.state.teams[0];row.definition.limits.maxOutputTokens=8192;await store.save(row.definition,1);const preview=await store.prepare({id:'team-test',revision:2,task:'Synthetic bounded task',materials:'',mode:'live'},signal());assert.equal(preview.outputTokenCap,8192);const run=await start(store,preview),end=await done(store,run.id);assert.equal(end.status,'failed');assert.equal(end.steps[0].attempts[0].partial,true);assert.equal(end.steps[0].attempts[0].output,'Truncated fixture text');assert.equal(end.steps[0].attempts[0].tools[0].success,true);assert.equal(end.steps[1].status,'skipped')}finally{await store.dispose()}
})

test('explicit reasoning policy is confirmed and unsupported modes cannot start',async()=>{
 const {store}=await fixture();try{const row=store.state.teams[0];assert.equal(row.definition.limits.reasoningEffort,'follow-model');row.definition.limits.reasoningEffort='off';await store.save(row.definition,1);const input={id:'team-test',revision:2,task:'Synthetic task',materials:'',mode:'live'};await assert.rejects(store.prepare(input,signal()),/不支持/);assert.equal(store.state.runs.length,0);store.model=async()=>({...route,policy:{...route.policy,effort:'off',supportedEfforts:['off']}});const preview=await store.prepare(input,signal());assert.equal(preview.definition.limits.reasoningEffort,'off')}finally{await store.dispose()}
})
