// Requires the pinned official-source dependency tree; no App/profile is booted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createMarketPlugin } from '../hub/plugins/qcu-market/src/plugin.mjs'
const dependencyRoot=process.env.QCU_OFFICIAL_DEPENDENCIES
if (!dependencyRoot) throw new Error('Set QCU_OFFICIAL_DEPENDENCIES to a local audited rc.2 dependency root')
const require=createRequire(pathToFileURL(`${dependencyRoot}/package.json`))
const {Context}=require('@deepseek-ai/cordis')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const registryURL=pathToFileURL(`${dependencyRoot}/node_modules/@deepseek-ai/dsh-client-ui-renderer/src/client/registry.ts`)
const {SlotRegistry}=await import(registryURL)
const {LayoutController}=await import(pathToFileURL(`${dependencyRoot}/node_modules/@deepseek-ai/dsh-client-ui-layout/src/client/service.ts`))
const catalog=JSON.parse(await readFile(new URL('../hub/market/catalog.json',import.meta.url),'utf8'))
test('real Cordis/SlotRegistry and LayoutController support repeated navigation, return and plugin unload',async()=>{
 const ctx=new Context()
 new SlotRegistry(ctx)
 ctx.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'}}},()=>null)
 let active=null
 const info={getSnapshot:()=>({activePanelId:active}),subscribe:()=>()=>{}}
 const layout=new LayoutController({selectPanel:id=>{active=id}},id=>ctx.slots.entriesOfSlot('main').some(e=>e.options.key===id),info)
 ctx.reflect.provide('layout',layout)
 const fork=ctx.plugin(createMarketPlugin(React,{kind:'bundled',value:catalog}))
 await fork.await()
 assert.equal(ctx.slots.entriesOfSlot('main').length,1)
 const main=ctx.slots.entriesOfSlot('main')[0]
 assert.equal(ctx.slots.entriesOfSlot('sidebar.panellist')[0].options.id,'qcu-market')
 layout.selectPanel('qcu-market');layout.selectPanel('qcu-market');assert.equal(active,'qcu-market')
 main.inject().onBack();assert.equal(active,null)
 const html=renderToStaticMarkup(React.createElement(main.component,main.inject()))
 assert.match(html,/QCU市场/);assert.match(html,/本实例未验证/);assert.match(html,/权限与风险/)
 assert.equal((html.match(/<article/g)||[]).length,8)
 await fork.dispose()
 assert.equal(ctx.slots.entriesOfSlot('main').length,0)
 assert.equal(ctx.slots.entriesOfSlot('sidebar.panellist').length,0)
 assert.throws(()=>layout.selectPanel('qcu-market'),/not registered/)
 layout.dispose();await ctx.fiber.dispose()
})
