import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const root=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!root)throw new Error('QCU_OFFICIAL_DEPENDENCIES required')
const require=createRequire(pathToFileURL(root+'/package.json'))
const {Context}=require('@deepseek-ai/cordis')
const {SkillRegistry}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-skill')))
const coach=await import('../.work/host-check/coach/package/index.js')
const market=await import('../.work/host-check/market/index.js')
const official=await import(pathToFileURL(root+'/node_modules/@deepseek-ai/dsh-plugin-manager/src/tools.ts'))
test('official plugin_manager rejects/cancels before management, and forwards disabled installation only after approval',async()=>{
 let outcome='rejected',installed=0,approvals=0,definition
 const agent={session:{id:'synthetic'}},signal=new AbortController().signal
 const ctx={tools:{register:d=>definition=d},sandboxPolicy:{resolve:()=>({mode:'workspace-write'})},get:()=>({request:async()=>{approvals++;return outcome}}),pluginManager:{installBundle:async(target,options)=>{installed++;assert.equal(target,'/synthetic/pinned.tgz');assert.deepEqual(options,{enabled:false});return {status:'restart-required'}}}}
 official.apply(ctx)
 const args={action:'install_bundle',target:'/synthetic/pinned.tgz',enabled:false},exec={agent,signal,callId:'synthetic'}
 await assert.rejects(definition.execute(args,exec),/rejected/);assert.equal(installed,0)
 outcome='cancelled';await assert.rejects(definition.execute(args,exec),/cancelled/);assert.equal(installed,0)
 outcome='allowed-once';assert.match(await definition.execute(args,exec),/restart-required/);assert.equal(installed,1);assert.equal(approvals,3)
})
test('market Host imports official defineTool, exposes same bounded command/tool, refuses full-access preparation',async()=>{
 let command,tool,dispose
 const ctx={commands:{register:d=>command=d},tools:{register:d=>tool=d},effect:fn=>dispose=fn(),get:()=>undefined,sandboxPolicy:{resolve:()=>({mode:'danger-full-access'})},pluginManager:{listBundles:()=>[],listPlugins:()=>[]},skills:{get:async()=>undefined}}
 market.apply(ctx);assert.equal(tool.name,'qcu_market');assert.equal(command.name,'qcu-market')
 const agent={session:{id:'s',header:{cwd:'/synthetic'}}},signal=new AbortController().signal
 assert.equal(JSON.parse(await tool.execute({action:'status'},{agent,signal})).state,'not-installed')
 const result=await command.handler({rawInput:'prepare',agent,signal});assert.equal(result.kind,'error');assert.match(result.text,/permission mode/)
 await assert.rejects(tool.execute({action:'install'},{agent,signal}),/must be one of/);dispose()
})
test('real Cordis Skills registry loads exact coach, refuses duplicate and discovers after fresh composition',async()=>{
 const ctx=new Context();new SkillRegistry(ctx)
 const fork=ctx.plugin(coach,{enabled:true});await fork.await()
 let skill=await ctx.skills.get('qcu-study-coach');assert.equal(skill.provider,'qcu-study-coach@0.1.0-pilot.2');assert.match(skill.content,/2.?5/)
 await assert.rejects(coach.apply(ctx,{enabled:true}),/Existing/)
 await assert.rejects(coach.apply(ctx,{enabled:false}),/Explicit/)
 await fork.dispose();assert.equal(await ctx.skills.get('qcu-study-coach'),undefined)
 const next=ctx.plugin(coach,{enabled:true});await next.await();assert.equal((await ctx.skills.get('qcu-study-coach')).provider,skill.provider)
 await next.dispose();await ctx.fiber.dispose()
})
