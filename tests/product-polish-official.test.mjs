// Official Cordis, Typert codec and Host Gateway; synthetic transport, no app boot.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {feedbackCanonical} from '../hub/plugins/qcu-market/src/feedback-schema.mjs'
import {mkdtemp,rm,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {reviewSubmission} from './support/product-polish-review-fixture.mjs'
import {feedbackReceiptId} from '../hub/plugins/qcu-market/src/feedback-storage.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
import {createLoopPlugin} from '../hub/plugins/qcu-market/src/loop-plugin.mjs'
const root=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!root)throw Error('QCU_OFFICIAL_DEPENDENCIES required')
const require=createRequire(pathToFileURL(root+'/package.json')),{Context}=require('@deepseek-ai/cordis')
const {TypertRegistry}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-typert-registry')))
const {TypertGatewayService}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-api-gateway')))
const market=await import(process.env.QCU_MARKET_HOST_PATH?pathToFileURL(process.env.QCU_MARKET_HOST_PATH):new URL('../.work/host-check/market/index.js',import.meta.url))
test('actual Host exposes only bounded optional feedback RPC and withdraws it on unload',async()=>{
 const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{}),fork=ctx.plugin(market);await fork.await()
 const calls=[],service=ctx.get('qcuMarket');service.feedback.post=async(method,payload)=>{calls.push([method,JSON.parse(payload)]);return JSON.stringify({ok:false,error:'feedback.missing',unknown:false})}
 const invoke=(method,payload)=>gateway.invoke({namespace:'qcuMarket',method,args:{payload}})
 try{
  const payload=feedbackCanonical({requestId:'a'.repeat(64)})
  assert.equal(JSON.parse(await invoke('feedbackStatus',payload)).error,'feedback.missing')
  await invoke('feedbackSubmit',payload);assert.deepEqual(calls.map(c=>c[0]),['status','submit'])
  await assert.rejects(invoke('feedbackStatus','x'.repeat(16385)),/boundary validation/)
  await assert.rejects(invoke('feedbackFetch','{}'),/no active Remote/)
  assert.equal(calls.length,2)
  await fork.dispose();await assert.rejects(invoke('feedbackStatus','{}'),/withdrawn|unavailable/)
 }finally{await fork.dispose();await ctx.fiber.dispose()}
})

test('fresh official Host Gateway restores private receipts with exact status, no automatic submit/query',async t=>{
 const root=await mkdtemp('/private/tmp/qcu-feedback-official-review-'),profile=join(root,'profile');await mkdir(profile,{mode:0o700});t.after(()=>rm(root,{recursive:true,force:true}));const calls=[]
 async function compose(){
  const ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
  const host=ctx.plugin(market);await host.await();const owner=ctx.plugin({apply(scope){scope.provide('profileContext',{dir:profile})}});await owner.await()
  const service=ctx.get('qcuMarket');service.feedback.fetcher=async(url,options)=>{calls.push(url);const body=JSON.parse(options.body),raw=feedbackCanonical({receiptId:feedbackReceiptId(body.requestId),state:'received',revision:1,updatedAt:'2026-10-27T00:00:00Z',message:''});return new Response(raw,{headers:{'content-length':String(Buffer.byteLength(raw))}})}
  return{invoke:(method,args={})=>gateway.invoke({namespace:'qcuMarket',method,args}),close:()=>ctx.fiber.dispose()}
 }
 let host=await compose()
 assert.deepEqual(JSON.parse(await host.invoke('status')),marketRuntime)
 assert.equal(JSON.parse(await host.invoke('feedbackReceipts')).value.records.length,0)
 assert.equal(JSON.parse(await host.invoke('feedbackSubmit',{payload:feedbackCanonical(reviewSubmission())})).ok,true);assert.equal(calls.length,1);await host.close()
 host=await compose();try{const records=JSON.parse(await host.invoke('feedbackReceipts')).value.records;assert.equal(records.length,1);assert.equal(calls.length,1);assert.equal(JSON.parse(await host.invoke('feedbackStatus',{payload:feedbackCanonical({requestId:records[0].requestId})})).ok,true);assert.equal(calls.length,2)}finally{await host.close()}
})

test('actual official Layout/Slot registry rejects missing branding panel and preserves market manual guide',async()=>{
 const React=require('react'),{SlotRegistry}=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-client-ui-renderer/src/client/registry.ts')),{LayoutController}=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'))
 const ctx=new Context();new SlotRegistry(ctx);ctx.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'}}},()=>null)
 let active='qcu-market';const info={getSnapshot:()=>({activePanelId:active}),subscribe:()=>()=>{}}
 const layout=new LayoutController({selectPanel:id=>{active=id}},id=>ctx.slots.entriesOfSlot('main').some(e=>e.options.key===id),info);ctx.reflect.provide('layout',layout)
 const fork=ctx.plugin(createLoopPlugin(React));await fork.await()
 try{const row=ctx.slots.entriesOfSlot('main')[0],availability=row.inject().availability;assert.equal(availability.snapshot().openFirstTask(),false);assert.equal(active,'qcu-market');const stop=ctx.slots.register({name:'main',key:'qcu-teacher-help'},()=>null);assert.equal(availability.snapshot().openFirstTask(),true);assert.equal(active,'qcu-teacher-help');stop()}finally{await fork.dispose();layout.dispose();await ctx.fiber.dispose()}
})
