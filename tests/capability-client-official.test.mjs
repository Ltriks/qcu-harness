// Real Cordis scopes and the shipped client artifact, with synthetic services only.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
const require=createRequire('/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source/package.json')
const {Context}=require('@deepseek-ai/cordis'),React=require('react')
const tick=()=>new Promise(r=>setImmediate(r))
test('shipped market client routes expert teams into studio and releases navigation on teardown',async()=>{
 let definition
 vm.runInNewContext(await readFile('hub/plugins/qcu-market/client.js','utf8'),{window:{__ModuleLoader__:{load:row=>{definition=row}}},TextEncoder,AbortController,crypto,setTimeout,clearTimeout})
 const plugin=definition.factory(()=>React),ctx=new Context(),slots=[],calls=[]
 ctx.reflect.provide('slots',{inject:(name,fn)=>fn(),register:(options,Component)=>{slots.push({options,Component});return()=>{}}})
 ctx.reflect.provide('layout',{selectPanel:id=>calls.push(['panel',id])})
 ctx.reflect.provide('workspaces',{list:{getSnapshot:()=>({items:[{workspaceId:'w'}]})}})
 ctx.reflect.provide('sessions',{create:async()=>{calls.push(['create']);return 's'},retain:()=>({binding:{ctx:{}},release:()=>calls.push(['release'])})})
 ctx.reflect.provide('conversation',{input:{for:()=>({snapshot:{draft:'',attachmentIds:[]},setDraft:text=>calls.push(['draft',text])})}})
 ctx.reflect.provide('uiWorkspace',{openSession:id=>calls.push(['open',id])})
 const releaseNavigation=ctx.reflect.provide('qcuTeamNavigation',{open:id=>calls.push(['studio',id])})
 try{
  await ctx.plugin(plugin).await();await tick()
  const panel=slots.find(s=>s.options.key==='qcu-capabilities')
  assert.ok(panel);assert.equal(slots.some(s=>s.options.id==='qcu-capabilities'),false,'duplicate capability sidebar entry is removed');assert.ok(slots.some(s=>s.options.id==='qcu-market'))
  assert.equal(ctx.qcuHomeCapabilities.availability.snapshot().officeTasks.length,5)
  await ctx.qcuHomeCapabilities.openTask('qcu-office-minutes','w', '')
  assert.ok(calls.some(c=>c[0]==='draft'&&c[1].includes('整理会议纪要和待办')))
  assert.ok(calls.some(c=>c[0]==='open'&&c[1]==='s'))
  assert.equal(calls.some(c=>c[0]==='panel'&&c[1]==='qcu-capabilities'),false,'empty home task must not detour through assistant')
  assert.equal(panel.options.inject().initialTask,undefined)
  calls.length=0
  const props=panel.options.inject(),ready=props.availability.snapshot()
  assert.equal(typeof ready.openStudio,'function')
  await ready.openStudio('qcu-deep-research')
  assert.deepEqual(calls[0],['studio','qcu-deep-research'])
  props.onMarket('qcu-data-copilot')
  const market=slots.find(s=>s.options.key==='qcu-market')
  assert.equal(market.options.inject().initialItem,'qcu-data-copilot')
  releaseNavigation();await tick()
  assert.equal(props.availability.snapshot().openStudio,null)
 }finally{await ctx.fiber.dispose()}
})
test('shipped installed-skills inventory is available with local manager and no market Host/network',async()=>{
 let definition;vm.runInNewContext(await readFile('hub/plugins/qcu-market/client.js','utf8'),{window:{__ModuleLoader__:{load:row=>{definition=row}}},TextEncoder,AbortController,crypto,setTimeout,clearTimeout})
 const ctx=new Context(),slots=[]
 ctx.reflect.provide('slots',{inject:(_name,fn)=>fn(),register:(options,Component)=>{slots.push({options,Component});return()=>{}}});ctx.reflect.provide('layout',{selectPanel(){}})
 const manager={listBundles:async()=>({ok:true,value:[{name:'qcu-lesson-planning',installed:true,enabled:true,version:'newer-local'}]}),listPlugins:async()=>({ok:true,value:[{moduleName:'qcu-lesson-planning',enabled:true,fiberPhase:'active'}]})};ctx.reflect.provide('remote',{$mount:async()=>()=>{},pluginManager:manager});ctx.reflect.provide('remote.pluginManager',manager)
 try{await ctx.plugin(definition.factory(()=>React)).await();for(let i=0;i<10;i++)await tick();const ready=slots.find(s=>s.options.key==='qcu-capabilities').options.inject().availability.snapshot();assert.equal(ready.localSkills.phase,'ready');assert.equal(ready.localSkills.items.length,1);assert.equal(ready.localSkills.items[0].id,'qcu-lesson-planning');assert.equal(ready.localSkillFlows['qcu-lesson-planning'].snapshot().status.state,'component-active')}
 finally{await ctx.fiber.dispose()}
})
