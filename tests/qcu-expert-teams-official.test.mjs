import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {Script,createContext} from 'node:vm'
import {Context} from '@deepseek-ai/cordis'
import {TypertRegistry} from '@deepseek-ai/dsh-typert-registry'
import {TypertGatewayService} from '@deepseek-ai/dsh-api-gateway'
import {LlmRuntime,LlmAdapter} from '@deepseek-ai/dsh-llm'
import {SkillRegistry} from '@deepseek-ai/dsh-skill'
const plugin=await import(process.env.QCU_TEAMS_PACKAGE_ROOT?pathToFileURL(process.env.QCU_TEAMS_PACKAGE_ROOT+'/index.js'):new URL('../hub/plugins/qcu-expert-teams/index.js',import.meta.url))
const packageRoot=process.env.QCU_TEAMS_PACKAGE_ROOT?pathToFileURL(process.env.QCU_TEAMS_PACKAGE_ROOT+'/'):new URL('../hub/plugins/qcu-expert-teams/',import.meta.url)
const {remoteContribution}=await import(new URL('src/protocol.mjs',packageRoot))
const {renderReport}=await import(new URL('src/reports.mjs',packageRoot))
class FixtureAdapter extends LlmAdapter{
 calls=[];mode='ok'
 async resolveModel(provider,model){return {provider,id:model,name:model,reasoning:{efforts:[{id:'low',name:'low'},{id:'high',name:'high'}],defaultEffort:'high'}}}
 async *stream(options){this.calls.push(options);yield {type:'text-delta',index:0,text:this.mode==='long'?'证'.repeat(this.calls.length<4?181:601):'Synthetic review with explicit evidence gaps.'};yield {type:'finish',reason:{kind:['ok','long'].includes(this.mode)||this.mode==='editor-fail'&&this.calls.length<4?'stop':'max-tokens'}}}
}
async function setup(){const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{});new LlmRuntime(ctx);new SkillRegistry(ctx);const root=await mkdtemp(join(tmpdir(),'qcu-team-official-')),workspace={id:'synthetic-workspace',title:'Synthetic workspace',path:root};ctx.reflect.provide('workspaceRegistry',{get:id=>id===workspace.id?workspace:undefined,list:()=>[workspace]});const selection={provider:'fixture',model:'no-network'};ctx.reflect.provide('agentDefaultModel',{currentSelection:()=>({...selection})});ctx.skills.register({name:'review-method',description:'Synthetic review method',content:'METHOD_BODY_SYNTHETIC',source:'runtime'});const adapter=new FixtureAdapter();ctx.llm.registerAdapter(['fixture'],adapter);const fork=ctx.plugin(plugin,{enabled:true});await fork.await();const invoke=async p=>JSON.parse(await gateway.invoke({namespace:'qcuTeams',method:'dispatch',args:{payload:JSON.stringify(p)}}));return {ctx,gateway,root,workspace,adapter,fork,selection,invoke,call:async p=>{const r=await invoke({workspaceId:workspace.id,...p});assert.equal(r.ok,true,JSON.stringify(r));return r.value}}}
async function prepare(f){const data=await f.call({action:'catalog'}),row=data.teams[0],expert=data.experts.find(e=>e.expert.id===row.team.members[0].expertId);await f.call({action:'saveExpert',expert:{...expert.expert,skillNames:['review-method']},revision:expert.revision});return f.call({action:'prepare',teamId:row.team.id,revision:row.revision,task:'Review self-authored anonymous material',materials:'A synthetic quadratic equation lesson.'})}
test('official Cordis/Typert/Skill/LLM pipeline runs four roles with fixed policy and no tools/credentials',async()=>{
 const f=await setup();try{assert.equal((await f.invoke({action:'workspaces'})).value[0].id,f.workspace.id);const p=await prepare(f);assert.equal(f.adapter.calls.length,0);assert.equal(p.route.policy.effort,'low');const request={action:'start',intentId:p.id,requestId:'official-run',consent:true},r=await f.call(request),store=await f.ctx.get('qcuTeams').store(f.workspace.id);await store.jobs.get(r.id)?.promise;assert.equal((await f.call({action:'run',runId:r.id})).status,'completed');assert.equal(f.adapter.calls.length,4);assert.ok(f.adapter.calls.every(c=>c.maxTokens===6000&&c.reasoningEffort==='low'&&c.tools.length===0));assert.match(f.adapter.calls[0].system,/METHOD_BODY_SYNTHETIC/);assert.match(f.adapter.calls.at(-1).messages[0].content[0].text,/upstream/);assert.equal((await f.call(request)).id,r.id);assert.equal(f.adapter.calls.length,4);assert.equal((await f.invoke({action:'catalog',workspaceId:'arbitrary-path'})).ok,false);await assert.rejects(f.gateway.invoke({namespace:'qcuTeams',method:'dispatch',args:{payload:4}}),/boundary validation/);await f.fork.dispose();await assert.rejects(f.invoke({action:'workspaces'}),/withdrawn|unavailable/)}finally{await f.fork.dispose();await f.ctx.fiber.dispose()}
})
test('route changes after consent stop before any adapter call; truncated output never feeds the editor',async t=>{
 for(const mode of ['route','truncated'])await t.test(mode,async()=>{const f=await setup();try{const p=await prepare(f);if(mode==='route')f.selection.model='changed';else f.adapter.mode='length';const r=await f.call({action:'start',intentId:p.id,requestId:mode,consent:true}),store=await f.ctx.get('qcuTeams').store(f.workspace.id);await store.jobs.get(r.id)?.promise;const done=store.run(r.id);assert.equal(done.status,'failed');assert.equal(done.steps.find(s=>s.id==='editor').status,'cancelled');if(mode==='route')assert.equal(f.adapter.calls.length,0);else assert.ok(f.adapter.calls.length<=2)}finally{await f.fork.dispose();await f.ctx.fiber.dispose()}})
})
test('official Client remote mount and actual generated sidebar/main use supported DSH lifecycle',async()=>{
 const f=await setup(),ctx=new Context(),root=process.env.QCU_OFFICIAL_DEPENDENCIES;new TypertRegistry(ctx)
 try{
  const client=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-api-gateway/src/client/index.ts'));ctx.reflect.provide('connection',{isLoopback:true,registerGenerationSource:()=>()=>{},generation:{getSnapshot:()=>undefined,subscribe:()=>()=>{}},rpc:{open:()=>{throw Error('No streams')},call:async(prefix,endpoint,payload)=>{assert.equal(prefix,'/api');const [namespace,method]=endpoint.split('/');return {ok:true,value:await f.gateway.invoke({namespace,method,args:payload.args})}}},start:()=>({stop(){}})});const fork=ctx.plugin({inject:client.inject,apply:client.apply});await fork.await();const unmount=await ctx.remote.$mount(remoteContribution);const reply=await ctx.remote.qcuTeams.dispatch(JSON.stringify({action:'workspaces'}));assert.equal(JSON.parse(reply.value).value[0].id,f.workspace.id);await unmount();await fork.dispose();assert.equal(ctx.get('remote.qcuTeams'),undefined)
  const {SlotRegistry}=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-client-ui-renderer/src/client/registry.ts'));const {LayoutController}=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'));new SlotRegistry(ctx);ctx.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'}}},()=>null);let active=null;const layout=new LayoutController({selectPanel:id=>active=id},id=>ctx.slots.entriesOfSlot('main').some(e=>e.options.key===id),{getSnapshot:()=>({activePanelId:active}),subscribe:()=>()=>{}});ctx.reflect.provide('layout',layout);let entry;new Script(await readFile(process.env.QCU_TEAMS_PACKAGE_ROOT?process.env.QCU_TEAMS_PACKAGE_ROOT+'/client.js':'hub/plugins/qcu-expert-teams/client.js','utf8')).runInContext(createContext({window:{__ModuleLoader__:{load:m=>entry=m}},setTimeout,clearTimeout,crypto:globalThis.crypto}));const require=createRequire(pathToFileURL(root+'/package.json')),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const mounted=ctx.plugin(entry.factory(n=>{assert.equal(n,'react');return React}));await mounted.await();layout.selectPanel('qcu-expert-teams');assert.equal(active,'qcu-expert-teams');assert.match(renderToStaticMarkup(React.createElement(ctx.slots.entriesOfSlot('main')[0].component)),/专家团工作室/);layout.selectPanel(null);await mounted.dispose();assert.equal(ctx.slots.entriesOfSlot('main').length,0);assert.equal(ctx.slots.entriesOfSlot('sidebar.panellist').length,0);layout.dispose()
 }finally{await ctx.fiber.dispose();await f.fork.dispose();await f.ctx.fiber.dispose()}
})

test('official gateway backs up and cleans exact terminal runs without adapter calls or replay across workspaces',async()=>{
 const f=await setup();try{
  f.adapter.mode='editor-fail';const p=await prepare(f),request={action:'start',intentId:p.id,requestId:'cleanup-official',consent:true},r=await f.call(request),store=await f.ctx.get('qcuTeams').store(f.workspace.id);await store.jobs.get(r.id)?.promise
  const done=await f.call({action:'run',runId:r.id});assert.equal(done.status,'failed');assert.match(renderReport(done),/完成步骤：3\/4/);assert.match(renderReport(done),/未完成/)
  const calls=f.adapter.calls.length,backup=await f.call({action:'exportHistory',runIds:[r.id]});assert.equal(backup.runs.length,1);assert.equal(backup.dataOnly,true)
  const preview=await f.call({action:'previewCleanup',runIds:[r.id]});assert.equal(preview.workspaceId,f.workspace.id);assert.equal((await f.call({action:'history'})).capacity.count,1)
  assert.equal((await f.invoke({action:'confirmCleanup',workspaceId:'arbitrary-path',cleanupId:preview.id,consent:true})).ok,false)
  const result=await f.call({action:'confirmCleanup',cleanupId:preview.id,consent:true});assert.equal(result.capacity.count,0);assert.equal((await f.invoke({action:'confirmCleanup',workspaceId:f.workspace.id,cleanupId:preview.id,consent:true})).error,'cleanup-expired')
  assert.equal((await f.invoke({...request,workspaceId:f.workspace.id})).error,'prepare-expired');assert.equal(f.adapter.calls.length,calls)
 }finally{await f.fork.dispose();await f.ctx.fiber.dispose()}
})

test('existing expert configurations receive distinct review and final contracts; long output is preserved without paid retries',async()=>{
 const f=await setup();try{
  f.adapter.mode='long';const p=await prepare(f),r=await f.call({action:'start',intentId:p.id,requestId:'role-and-length',consent:true}),store=await f.ctx.get('qcuTeams').store(f.workspace.id);await store.jobs.get(r.id)?.promise
  const done=store.run(r.id);assert.equal(done.status,'completed');assert.equal(f.adapter.calls.length,4)
  for(const call of f.adapter.calls.slice(0,3)){
   assert.match(call.system,/不是最终汇总成员/);assert.match(call.system,/不超过180个非空白字符/);assert.match(call.system,/不要另写总体汇总或整套教案/)
  }
  const editor=f.adapter.calls.at(-1);assert.match(editor.system,/唯一的最终汇总成员/);assert.match(editor.system,/不超过600个非空白字符/)
  const upstream=JSON.parse(editor.messages[0].content[0].text).upstream;assert.equal(upstream.length,3);assert.deepEqual(upstream.map(s=>s.output.length),[181,181,181])
  const report=renderReport(done);assert.match(report,/181个非空白字符/);assert.match(report,/601个非空白字符/);assert.match(report,/不会自动重试/)
  assert.equal(done.steps.at(-1).output,'证'.repeat(601));assert.equal(f.adapter.calls.length,4)
 }finally{await f.fork.dispose();await f.ctx.fiber.dispose()}
})
