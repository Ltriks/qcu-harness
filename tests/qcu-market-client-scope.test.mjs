// Real Cordis fibers + official ClientRemote and generated manager codecs.
// Only the carrier's Host answers are fake. No App/profile/network/installer.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {createLoopPlugin} from '../hub/plugins/qcu-market/src/loop-plugin.mjs'
import {release} from '../hub/plugins/qcu-market/src/trusted-release.mjs'
const root=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!root)throw Error('QCU_OFFICIAL_DEPENDENCIES required')
const require=createRequire(pathToFileURL(root+'/package.json'))
const {Context}=require('@deepseek-ai/cordis'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const load=async name=>import(pathToFileURL(require.resolve(name)))
const {TypertRegistry}=await load('@deepseek-ai/dsh-typert-registry')
const {SlotRegistry}=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-client-ui-renderer/src/client/registry.ts'))
const client=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-api-gateway/src/client/index.ts'))
const {default:managerContribution}=await load('@deepseek-ai/dsh-plugin-manager/remote')
const tick=()=>new Promise(r=>setImmediate(r))
async function fixture(t,{manager=true,navigation=true,plugin,answer}={}){
 const ctx=new Context();t.after(()=>ctx.fiber.dispose());new TypertRegistry(ctx);new SlotRegistry(ctx)
 ctx.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'}}},()=>null)
 const calls=[],details=[];let panel=null,bundles=[],rows=[]
 ctx.reflect.provide('layout',{selectPanel:id=>{panel=id}})
 let nav
 if(navigation)nav=ctx.reflect.provide('pluginNavigation',{openBundle:id=>details.push(id)})
 const receipt={id:'',entry:release,path:'/cache/'+release.file,expiresAt:Date.now()+100000}
 ctx.reflect.provide('connection',{isLoopback:true,registerGenerationSource:()=>()=>{},generation:{getSnapshot:()=>undefined,subscribe:()=>()=>{}},rpc:{open:()=>{throw Error('No stream opened')},call:async(prefix,endpoint,payload)=>{
  calls.push({endpoint,args:payload.args});const a=payload.args;let value
  if(answer){const reply=await answer(endpoint,a);if(reply)return reply}
  switch(endpoint){
   case 'pluginManager/listBundles':value=bundles;break
   case 'pluginManager/listPlugins':value=rows;break
   case 'pluginManager/installBundle':assert.equal(a.options.enabled,false);assert.deepEqual(Object.keys(a.options).sort(),['enabled','registry','requestId']);bundles=[{name:release.id,version:release.version,installed:true,enabled:false,optional:false,removable:true,rows:[],overrides:[]}];rows=[{moduleName:release.id,entryId:'coach:row',patchId:'qcu-study-coach',enabled:false,fiberPhase:null}];value={changed:true,application:'applied',stage:'enable',target:release.id,enabled:false,bundle:release.id};break
   case 'pluginManager/setBundleEnabled':assert.equal(a.name,release.id);assert.equal(a.enabled,true);bundles[0].enabled=true;value={changed:true,application:'applied',stage:'enable',target:a.name};break
   case 'pluginManager/setPluginEnabled':assert.equal(a.id,'coach:row');assert.equal(a.enabled,true);rows[0].enabled=true;rows[0].fiberPhase='active';value={changed:true,application:'applied',stage:'enable',target:a.id};break
   case 'pluginManager/cancelInstall':value={status:'cancelled'};break
   case 'pluginManager/waitForInstall':value=null;break
   case 'pluginManager/inspect':value={status:'accepted',kind:'tarball',bundle:null,registry:null};break
   case 'qcuMarket/status':value=JSON.stringify({version:'0.1.0-pilot.4.2',protocol:1});break
   case 'qcuMarket/prepare':receipt.id=a.id;value=JSON.stringify(receipt);break
   case 'qcuMarket/verify':value=JSON.stringify(receipt);break
   case 'qcuMarket/cancel':value=JSON.stringify({state:'cancelled'});break
   default:throw Error('Unexpected method '+endpoint)
  }
  return {ok:true,value}
 }},start:()=>({stop(){}})})
 const gateway=ctx.plugin({inject:client.inject,apply:client.apply});await gateway.await()
 const mountManager=async()=>{const owner=ctx.plugin({inject:['remote'],async apply(ownerCtx){await ownerCtx.remote.$mount(managerContribution)}});await owner.await();return ()=>owner.dispose()}
 let unmountManager
 if(manager)unmountManager=await mountManager()
 if(!plugin){plugin=createLoopPlugin(React);if(process.env.QCU_MARKET_CLIENT_PATH){let mod;vm.runInNewContext(await readFile(process.env.QCU_MARKET_CLIENT_PATH,'utf8'),{window:{__ModuleLoader__:{load:v=>{mod=v}}},AbortController,crypto,setTimeout,clearTimeout});plugin=mod.factory(()=>React)}}
 const fork=ctx.plugin(plugin);await fork.await();await tick();await tick()
 const main=()=>ctx.slots.entriesOfSlot('main')[0]
 const props=()=>{const p=main().inject();return p.availability?p.availability.snapshot():p}
 return {ctx,fork,calls,details,main,props,gateway,nav,unmountManager,mountManager,setBundles:value=>{bundles=value},panel:()=>panel,render:()=>renderToStaticMarkup(React.createElement(main().component,main().inject()))}
}
test('Client starts in a real plugin fiber, checks inventory and prepares/declines through both guarded namespaces',async t=>{
 const f=await fixture(t);const p=f.props();assert.ok(p.flow,p.unavailable)
 assert.deepEqual(f.calls,[],'startup must not read inventory or download')
 await p.flow.status();assert.equal(p.flow.state.status?.state,'not-installed',p.flow.state.message)
 await p.flow.prepare();assert.equal(p.flow.state.phase,'review',p.flow.state.message)
 assert.match(f.render(),/确认安装（保持未启用）/)
 p.onDetails();assert.deepEqual(f.details,[release.id])
 await p.flow.decline();assert.equal(p.flow.state.phase,'declined')
 assert.deepEqual(f.calls.map(c=>c.endpoint),['qcuMarket/status','pluginManager/listBundles','qcuMarket/status','pluginManager/listBundles','qcuMarket/prepare','pluginManager/inspect','qcuMarket/cancel'])
 await f.fork.dispose();assert.equal(f.ctx.slots.entriesOfSlot('main').length,0);assert.equal(f.ctx.get('remote.qcuMarket'),undefined)
})

test('all eight used public manager methods pass official generated wire codecs inside the scoped Client',async t=>{
 const f=await fixture(t),flow=f.props().flow
 await flow.prepare();assert.equal(flow.state.phase,'review',flow.state.message)
 await flow.confirmInstall();assert.equal(flow.state.status?.state,'installed-disabled',flow.state.message)
 await flow.reviewEnable('bundle');await flow.confirmEnable();assert.equal(flow.state.status?.state,'row-disabled',flow.state.message)
 await flow.reviewEnable('row');await flow.confirmEnable();assert.equal(flow.state.status?.state,'component-active',flow.state.message)
 // Synthetic unresolved task exercises the same public reconciliation/cancellation calls, no install process exists.
 flow.request={id:crypto.randomUUID()};await flow.reconcile();assert.equal(flow.state.phase,'unconfirmed')
 await flow.cancel();assert.equal(flow.state.phase,'cancelled')
 assert.deepEqual([...new Set(f.calls.filter(c=>c.endpoint.startsWith('pluginManager/')).map(c=>c.endpoint.split('/')[1]))].sort(),['cancelInstall','inspect','installBundle','listBundles','listPlugins','setBundleEnabled','setPluginEnabled','waitForInstall'])
})
test('missing manager stays visibly unavailable; late arrival, withdrawal and remount use scoped lifetimes',async t=>{
 const f=await fixture(t,{manager:false});assert.equal(f.props().flow,null);assert.match(f.render(),/缺少官方/);assert.deepEqual(f.calls,[])
 const withdraw=await f.mountManager();await tick();await tick()
 const first=f.props().flow;assert.ok(first);await first.prepare();assert.equal(first.state.phase,'review')
 await withdraw();await tick();assert.equal(first.disposed,true);assert.equal(f.props().flow,null);assert.ok(f.ctx.get('remote.qcuMarket'))
 const withdraw2=await f.mountManager();await tick();await tick();assert.ok(f.props().flow);assert.notEqual(f.props().flow,first)
 await f.fork.dispose();await withdraw2();assert.equal(f.ctx.slots.entriesOfSlot('sidebar.panellist').length,0)
})
test('missing navigation gives a real error without disabling the installer; removing it withdraws the callback',async t=>{
 const f=await fixture(t,{navigation:false});assert.ok(f.props().flow);assert.throws(()=>f.props().onDetails(),/详情服务不可用/)
 const remove=f.ctx.reflect.provide('pluginNavigation',{openBundle:id=>f.details.push(id)});await tick()
 f.props().onDetails();assert.deepEqual(f.details,[release.id]);await remove();await tick();assert.throws(()=>f.props().onDetails(),/详情服务不可用/)
})
test('connection reset revokes review; disposal during a review cancels receipt and withdraws namespaces',async t=>{
 const f=await fixture(t),flow=f.props().flow;await flow.prepare();assert.equal(flow.state.phase,'review')
 f.ctx.emit('connection/reset');assert.equal(flow.state.review,null)
 await flow.prepare();await f.fork.dispose();assert.equal(flow.disposed,true);assert.equal(f.ctx.get('remote.qcuMarket'),undefined)
 assert.ok(f.calls.some(c=>c.endpoint==='qcuMarket/cancel'));assert.equal(f.calls.filter(c=>c.endpoint==='pluginManager/installBundle').length,0)
})
test('Host preparation failure is visible and never reaches review or installation',async t=>{
 const f=await fixture(t,{answer:(endpoint)=>endpoint==='qcuMarket/prepare'?{ok:false,error:{code:'unavailable',message:'Host service unavailable'}}:undefined})
 await f.props().flow.prepare();assert.equal(f.props().flow.state.phase,'error');assert.match(f.render(),/Host service unavailable/)
 assert.ok(!f.calls.some(c=>c.endpoint==='pluginManager/installBundle'))
})
test('official structured bundle error renders as text, never as a React object child',async t=>{
 const f=await fixture(t);f.setBundles([{name:release.id,version:release.version,installed:true,enabled:true,optional:false,removable:true,rows:[],overrides:[],error:{code:'operation-error'}}])
 await f.props().flow.status();assert.equal(f.props().flow.state.status?.state,'failed');assert.match(f.render(),/operation-error/)
})
test('Client transport withdrawal clears flow, listeners and contributions; transport remount restores one panel',async t=>{
 const f=await fixture(t),old=f.props().flow;await old.prepare()
 await f.gateway.dispose();await tick();assert.equal(old.disposed,true);assert.equal(f.props().flow,null);assert.equal(f.ctx.get('remote.qcuMarket'),undefined)
 const generation=old.generation;f.ctx.emit('connection/reset');assert.equal(old.generation,generation)
 const gateway=f.ctx.plugin({inject:client.inject,apply:client.apply});await gateway.await()
 await tick();await tick()
 assert.ok(f.props().flow);assert.notEqual(f.props().flow,old);assert.equal(f.ctx.slots.entriesOfSlot('main').length,1)
})
test('dispose during an outstanding official install requests cancellation once and ignores its late result',async t=>{
 let finish
 const f=await fixture(t,{answer:endpoint=>endpoint==='pluginManager/installBundle'?new Promise(resolve=>{finish=resolve}):undefined}),flow=f.props().flow
 await flow.prepare();const running=flow.confirmInstall();await tick();assert.ok(finish)
 await f.fork.dispose();assert.equal(f.calls.filter(c=>c.endpoint==='pluginManager/cancelInstall').length,1)
 const state=flow.state;finish({ok:true,value:{changed:false,application:'cancelled',stage:'install',target:'/cache/'+release.file}});await running;assert.equal(flow.state,state)
 assert.equal(f.ctx.get('remote.qcuMarket'),undefined)
})
