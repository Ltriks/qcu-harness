// Real official registries, Gateway/Client transport and Skills; no application/profile or real installer.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {remoteContribution} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
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
const market=await import('../.work/host-check/market/index.js')
test('official Host Gateway validates bounded endpoints without sessions/tools/manager and unload withdraws them',async()=>{
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 const fork=ctx.plugin(market);await fork.await();assert.deepEqual(market.inject,['typert'])
 const request={namespace:'qcuMarket',method:'cancel',args:{id:'12345678-1234-1234-1234-123456789012'}}
 assert.equal(JSON.parse(await gateway.invoke(request)).state,'cancelled')
 await assert.rejects(gateway.invoke({...request,method:'prepare',args:{id:'http://arbitrary'}}),/boundary validation/)
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
 const invalid=await ctx.remote.qcuMarket.prepare('/not-a-uuid');assert.equal(invalid.ok,false);assert.equal(calls,2)
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
