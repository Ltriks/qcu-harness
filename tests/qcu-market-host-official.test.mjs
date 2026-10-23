import {releaseKeyOf} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {release} from '../hub/plugins/qcu-market/src/trusted-release.mjs'
// Real official registries, Gateway/Client transport and Skills; no application/profile or real installer.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {remoteContribution,marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
import {CatalogRuntime} from '../hub/plugins/qcu-market/src/catalog-runtime.mjs'
import {DirectMarketFlow} from '../hub/plugins/qcu-market/src/direct-flow.mjs'
import {bundledCatalog,catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
const root=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!root)throw new Error('QCU_OFFICIAL_DEPENDENCIES required')
const require=createRequire(pathToFileURL(root+'/package.json'))
const {Context}=require('@deepseek-ai/cordis')
const load=async name=>import(pathToFileURL(require.resolve(name)))
const {SkillRegistry}=await load('@deepseek-ai/dsh-skill')
const {TypertRegistry}=await load('@deepseek-ai/dsh-typert-registry')
const {TypertGatewayService}=await load('@deepseek-ai/dsh-api-gateway')
const client=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-api-gateway/src/client/index.ts'))
const {parseInstallSpec}=await load('@deepseek-ai/dsh-plugin-manager')
const coach=await import('../.work/host-check/coach/package/index.js')
const market=await import(process.env.QCU_MARKET_HOST_PATH?pathToFileURL(process.env.QCU_MARKET_HOST_PATH):new URL('../.work/host-check/market/index.js',import.meta.url))
test('official startup refuses shared refresh and ordinary preparation until profile journal recovery is ready',async t=>{
 const home=await mkdtemp(join(tmpdir(),'qcu-market-startup-'));t.after(()=>rm(home,{recursive:true,force:true}))
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 const fork=ctx.plugin(market);await fork.await();t.after(()=>ctx.fiber.dispose())
 const invoke=(method,args={})=>gateway.invoke({namespace:'qcuMarket',method,args}),service=ctx.get('qcuMarket'),calls=[]
 const ok=value=>({ok:true,value}),remote={qcuMarket:{
  status:async()=>ok(await invoke('status')),updatesRecovery:async()=>ok(await invoke('updatesRecovery')),
  refresh:async()=>ok(await invoke('refresh')),prepare:async(id,releaseKey)=>ok(await invoke('prepare',{id,releaseKey}))
 },pluginManager:{listBundles:async()=>ok([]),listPlugins:async()=>ok([]),installBundle:async()=>{calls.push('install');throw Error('Unexpected mutation')}}}
 service.packages.refresh=async()=>{calls.push('refresh');return JSON.stringify({mode:'legacy',catalog:bundledCatalog,fingerprint:catalogSha256})}
 service.packages.prepare=async()=>{calls.push('prepare');throw Error('Unexpected preparation')}
 let state={};const runtime=new CatalogRuntime(remote,patch=>state={...state,...patch})
 const ordinary=new DirectMarketFlow(remote,{gate:runtime.gate,blocker:()=>runtime.updates.locked(),beforeOperation:()=>runtime.updates.guardJournal()})
 t.after(()=>{runtime.dispose();ordinary.dispose()})
 await assert.rejects(invoke('updatesRecovery'),/更新服务尚未就绪/)
 assert.equal(await runtime.refresh(),false);assert.match(state.refreshMessage,/更新服务尚未就绪/)
 await ordinary.prepare();assert.equal(ordinary.state.phase,'error');assert.match(ordinary.state.message,/更新服务尚未就绪/)
 assert.equal(ordinary.state.review,null);await assert.rejects(ordinary.confirmInstall(),/请先查看并确认/)
 assert.deepEqual(calls,[])
 const profile=ctx.plugin({apply(scope){scope.provide('profileContext',{dir:home});scope.provide('pluginManager',{listBundles:async()=>[],listPlugins:async()=>[]})}})
 await profile.await();assert.ok(service.updates)
 service.updates.storage.root=join(home,'updates')
 assert.equal(await invoke('updatesRecovery'),'null');assert.equal(await runtime.refresh(),true)
 const journal={product:'qcu-market',fromVersion:'0.1.0-pilot.15',version:marketRuntime.version,sha256:'a'.repeat(64),requestId:crypto.randomUUID(),state:'pending',createdAt:Date.now(),bootId:'synthetic-previous-process',configurationDigest:'b'.repeat(64),bundleEnabled:false,rowEnabled:null}
 await service.updates.storage.write('journal.json',journal)
 assert.deepEqual(JSON.parse(await invoke('updatesRecovery')),journal)
 assert.equal(await runtime.refresh(),false);assert.match(state.refreshMessage,/上次升级尚待核对/)
 await assert.rejects(ordinary.prepare(),/更新正在进行或尚待核对/)
 assert.deepEqual(calls,['refresh'])
})
test('actual public Host gateway exposes protocol6 refresh and update inventory with both channel identities and bounded replies',async()=>{
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 const fork=ctx.plugin(market);await fork.await()
 try{
  const invoke=(method,args={})=>gateway.invoke({namespace:'qcuMarket',method,args}),service=ctx.get('qcuMarket')
  const status=JSON.parse(await invoke('status'));assert.deepEqual(status,marketRuntime);assert.equal(status.protocol,6)
  assert.match(status.catalogSha256,/^[a-f0-9]{64}$/);assert.match(status.updatePolicySha256,/^[a-f0-9]{64}$/)
  service.packages.refresh=async()=>JSON.stringify({catalog:{entries:[]},padding:'x'.repeat(30000)})
  let checks=0;service.updates={check:async()=>{checks++;return JSON.stringify({items:Array.from({length:10},(_,i)=>({id:'synthetic-'+i})),padding:'核'.repeat(8000)})},recovery:async()=>'null'}
  assert.equal(JSON.parse(await invoke('refresh')).padding.length,30000)
  assert.equal(JSON.parse(await invoke('updatesCheck')).items.length,10);assert.equal(checks,1)
  assert.equal(await invoke('updatesRecovery'),'null')
  for(const [method,cap] of [['refresh',524288],['updatesCheck',65536]]){
   const codec=remoteContribution.descriptors.find(d=>d.method===method).result.create()
   assert.throws(()=>codec.parse(JSON.stringify('核'.repeat(cap/3+1))))
  }
 }finally{await fork.dispose();await ctx.fiber.dispose()}
})
test('official Host Gateway validates bounded endpoints without sessions/tools/manager and unload withdraws them',async()=>{
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 const fork=ctx.plugin(market);await fork.await();assert.deepEqual(market.inject,['typert'])
 const request={namespace:'qcuMarket',method:'cancel',args:{id:'12345678-1234-1234-1234-123456789012'}}
 assert.equal(JSON.parse(await gateway.invoke(request)).state,'cancelled')
 await assert.rejects(gateway.invoke({...request,method:'prepare',args:{id:'http://arbitrary',releaseKey:releaseKeyOf(release)}}),/boundary validation/)
 await assert.rejects(gateway.invoke({...request,method:'install'}),/no active Remote/)
 await fork.dispose();await assert.rejects(gateway.invoke(request),/withdrawn|unavailable/);await ctx.fiber.dispose()
})
test('official Client $mount and Host Gateway exchange a receipt cancellation over an in-memory carrier only',async()=>{
 const host=new Context();new TypertRegistry(host);const gateway=new TypertGatewayService(host,{});const h=host.plugin(market);await h.await()
 const ctx=new Context();new TypertRegistry(ctx);let calls=0
 ctx.reflect.provide('connection',{isLoopback:true,registerGenerationSource:()=>()=>{},generation:{getSnapshot:()=>undefined,subscribe:()=>()=>{}},rpc:{open:()=>{throw Error('No streams permitted')},call:async(prefix,endpoint,payload)=>{calls++;assert.equal(prefix,'/api');const [namespace,method]=endpoint.split('/');return {ok:true,value:await gateway.invoke({namespace,method,args:payload.args})}}},start:()=>({stop(){}})})
 const c=ctx.plugin({inject:client.inject,apply:client.apply});await c.await()
 const unmount=await ctx.remote.$mount(remoteContribution)
 const value=await ctx.remote.qcuMarket.cancel('12345678-1234-1234-1234-123456789012');assert.equal(value.ok,true);assert.equal(JSON.parse(value.value).state,'cancelled');assert.equal(calls,1)
 const invalid=await ctx.remote.qcuMarket.prepare('/not-a-uuid',releaseKeyOf(release));assert.equal(invalid.ok,false);assert.equal(calls,2)
 await unmount();assert.equal(ctx.get('remote.qcuMarket'),undefined)
 await c.dispose();await ctx.fiber.dispose();await h.dispose();await host.fiber.dispose()
})
test('official install parser accepts pinned absolute tgz as tarball without resolving a package directory',()=>{
 assert.deepEqual(parseInstallSpec('/cache/pinned.tgz'),{kind:'tarball',spec:'/cache/pinned.tgz',path:'/cache/pinned.tgz'})
})
test('real Skills registry loads exact immutable coach, refuses duplicate and discovers after fresh composition',async()=>{
 const ctx=new Context();new SkillRegistry(ctx)
 const fork=ctx.plugin(coach,{enabled:true});await fork.await()
 const skill=await ctx.skills.get('qcu-study-coach');assert.equal(skill.provider,'qcu-study-coach@0.1.0-pilot.2');assert.match(skill.content,/2.?5/)
 await assert.rejects(coach.apply(ctx,{enabled:true}),/Existing/);await assert.rejects(coach.apply(ctx,{enabled:false}),/Explicit/)
 await fork.dispose();assert.equal(await ctx.skills.get('qcu-study-coach'),undefined)
 const next=ctx.plugin(coach,{enabled:true});await next.await();assert.equal((await ctx.skills.get('qcu-study-coach')).provider,skill.provider)
 await next.dispose();await ctx.fiber.dispose()
})
test('real Host fiber unload aborts its pending preparation and revokes in-memory receipts',async()=>{
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 const fork=ctx.plugin(market);await fork.await();const packages=ctx.get('qcuMarket').packages
 // Exercise legacy download cancellation without consulting production authority.
 packages.authority=null
 let started;const ready=new Promise(resolve=>{started=resolve})
 packages.download=({signal})=>new Promise((resolve,reject)=>{started();signal.addEventListener('abort',()=>reject(Error('preparation aborted')),{once:true})})
 const running=gateway.invoke({namespace:'qcuMarket',method:'prepare',args:{id:'12345678-1234-1234-1234-123456789012',releaseKey:releaseKeyOf(release)}})
 const rejected=assert.rejects(running,/aborted|withdrawn|unavailable/);await ready;await fork.dispose();await rejected
 assert.equal(packages.pending.size,0);assert.equal(packages.receipts.size,0);assert.equal(ctx.get('qcuMarket'),undefined);await ctx.fiber.dispose()
})
