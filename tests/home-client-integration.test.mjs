import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import vm from 'node:vm'
const require=createRequire('/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source/package.json'),{Context}=require('@deepseek-ai/cordis'),React=require('react')
test('built home and market exchange optional services using actual Cordis scopes',async()=>{
 const factories=new Map(),data=new Map(),store=value=>({getSnapshot:()=>value,subscribe:()=>()=>{}}),rows=[],ctx=new Context()
 const sandbox={window:{__ModuleLoader__:{load:row=>factories.set(row.id,row.factory)}},TextEncoder,AbortController,crypto,setTimeout,clearTimeout,queueMicrotask,localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},document:{createElement:()=>({dataset:{},remove(){}}),head:{append(){}},body:{setAttribute(){},removeAttribute(){}}}}
 for(const name of ['qcu-branding','qcu-market'])vm.runInNewContext(await readFile(`hub/plugins/${name}/client.js`,'utf8'),sandbox)
 const slots={inject:(_name,fn)=>{const result=fn();if(result?.[Symbol.iterator])for(const _ of result){}},register:(options,Component)=>{rows.push({options,Component});return()=>{}},entries:()=>rows,entriesOfSlot:()=>[],subscribe:()=>()=>{},getVersion:()=>0}
 for(const [name,value] of Object.entries({slots,layout:{panelInfo:store({activePanelId:'qcu-teacher-home'}),selectPanel(){},toggleSidebar(){}},theme:{getTheme:()=>({fontSize:14,preference:'light'}),overrideTokens:()=>()=>{}},locale:{setLocale(){}},workspaces:{list:store({phase:'ready',items:[]})},sessions:{list:store({phase:'ready',ids:[],byId:{}})},uiWorkspace:{selection:store({}),startSession(){},openSession(){}},conversation:{},remote:{$mount:async()=>()=>{}}}))ctx.reflect.provide(name,value)
 try{
  const market=ctx.plugin(factories.get('qcu-market')(()=>React));await market.await()
  const home=ctx.plugin(factories.get('qcu-branding')(()=>React));await home.await();await new Promise(r=>setImmediate(r))
  const panel=rows.find(row=>row.options.key==='qcu-capabilities'),ready=panel.options.inject().availability.snapshot()
  assert.ok(ready.personalization);ready.personalization.pin('qcu-hallmark-design')
  assert.equal(ctx.qcuHomePersonalization.snapshot().pinned[0],'qcu-hallmark-design')
  assert.equal(ctx.qcuHomeCapabilities.availability.snapshot().personalization,ctx.qcuHomePersonalization)
  assert.ok(rows.some(row=>row.options.key==='qcu-teacher-home'))
  await home.dispose();await new Promise(r=>setImmediate(r));assert.equal(panel.options.inject().availability.snapshot().personalization,null)
 }finally{await ctx.fiber.dispose()}
})
