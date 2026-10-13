// Imports the core suite too; one entry runs every isolated fixture test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ApprovalService from '@deepseek-ai/dsh-user-approval'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import * as sourcePlugin from '../hub/plugins/qcu-feishu-readonly/index.js'
import { fixture, doc, sectionContent, selected, signal, waitCalls } from './qcu-feishu-readonly.test.mjs'
import './qcu-feishu-readonly-settings.test.mjs'

const plugin = process.env.QCU_FEISHU_EXTRACTED
  ? await import(new URL('file://' + process.env.QCU_FEISHU_EXTRACTED + '/index.js')) : sourcePlugin
async function runtime(config) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt).await(); await ctx.plugin(ToolRuntime).await()
  const fiber = ctx.plugin(plugin, config); await fiber.await()
  const agent = { session: { id: 'SyntheticSession01' } }
  let sequence=0
  const execute = (name, arguments_, who=agent, s=signal()) => ctx.tools.execute({name,arguments:arguments_,agent:who,signal:s,callId:'synthetic-'+(++sequence)})
  return {ctx,fiber,agent,execute}
}
const value = r => {assert.equal(r.isError,false,JSON.stringify(r));return JSON.parse(r.content[0].text)}

test('official registration, guard denial and around-wrapper denial prevent subprocess; owned disposal preserves unrelated tool', async () => {
  const f=await fixture([{value:doc()},{value:doc(sectionContent)}]); const r=await runtime(f.config)
  try {
    r.ctx.tools.register(defineTool({name:'unrelated_synthetic',parameters:{},description:'unrelated',output:{schema:{type:'json'},render:()=>[]},execute:()=>({status:'ok'})}))
    assert.ok(r.ctx.tools.get('qcu_feishu_outline'));assert.ok(r.ctx.tools.get('qcu_feishu_section'))
    const guard=r.ctx.tools.guard(exec=>exec.name.startsWith('qcu_feishu_')?'synthetic deny':undefined)
    assert.equal((await r.execute('qcu_feishu_outline',{})).isError,true);assert.equal((await f.calls()).length,0);guard()
    const wrapper=r.ctx.on('tools/execute',async (_exec,_next)=>({isError:true,content:[{type:'text',text:'synthetic wrapper denial'}]}))
    assert.equal((await r.execute('qcu_feishu_outline',{})).isError,true);assert.equal((await f.calls()).length,0);wrapper()
    const o=value(await r.execute('qcu_feishu_outline',{}));assert.equal(o.revision,7)
    const section=value(await r.execute('qcu_feishu_section',selected(o)));assert.equal(section.content,sectionContent)
    assert.equal((await f.calls()).length,2)
    await r.fiber.dispose()
    assert.equal(r.ctx.tools.get('qcu_feishu_outline'),undefined);assert.equal(r.ctx.tools.get('qcu_feishu_section'),undefined)
    assert.ok(r.ctx.tools.get('unrelated_synthetic'))
  } finally {await r.ctx.fiber.dispose();await f.runner.dispose()}
})
test('official parameter validation and caller/session changes fail closed before subprocess',async()=>{
  const f=await fixture([{value:doc()}]);const r=await runtime(f.config)
  try {
    assert.equal((await r.execute('qcu_feishu_outline',{argv:['auth','login']})).isError,true)
    assert.equal((await r.ctx.tools.execute({name:'qcu_feishu_outline',arguments:{},signal:signal(),callId:'no-agent'})).isError,true)
    assert.equal((await f.calls()).length,0)
    const o=value(await r.execute('qcu_feishu_outline',{}))
    assert.equal((await r.execute('qcu_feishu_section',selected(o),{session:r.agent.session})).isError,true)
    r.agent.session={id:'SyntheticSession02'}
    assert.equal((await r.execute('qcu_feishu_section',selected(o))).isError,true)
    assert.equal((await f.calls()).length,1)
  } finally {await r.ctx.fiber.dispose();await f.runner.dispose()}
})
test('duplicate IDs roll back partial registration and preserve existing owner',async()=>{
  const f=await fixture([]);const ctx=new Context()
  try {
    await ctx.plugin(SystemPrompt).await();await ctx.plugin(ToolRuntime).await()
    const existing=defineTool({name:'qcu_feishu_section',parameters:{},description:'existing',output:{schema:{type:'json'},render:()=>[]},execute:()=>({})})
    ctx.tools.register(existing)
    assert.throws(()=>plugin.apply(ctx,f.config),/duplicate|already|registered/i)
    assert.equal(ctx.tools.get('qcu_feishu_outline'),undefined);assert.equal(ctx.tools.get('qcu_feishu_section'),existing)
    assert.equal((await f.calls()).length,0)
  } finally {await ctx.fiber.dispose();await f.runner.dispose()}
})
test('official approval rejection prevents process; allowed-once uses normal runtime execution',async()=>{
  const f=await fixture([{value:doc()}]);const r=await runtime(f.config)
  try {
    await r.ctx.plugin(SessionProjections).await();await r.ctx.plugin(ApprovalService,{policy:'ask'}).await()
    let answer='rejected';let requests=0
    r.ctx.on('approval/request',()=>{requests++;return Promise.resolve(answer)})
    r.ctx.on('tools/pre-execute',()=>Promise.resolve({kind:'ask',reason:'synthetic document read approval'}))
    const id=SessionId('synthetic-feishu-approval')
    const session=Session.create(id,undefined,{version:SESSION_FORMAT_VERSION,id,createdAt:0,isSeeded:false})
    session.append('turn/start',{turn:1});const agent={session}
    assert.equal((await r.execute('qcu_feishu_outline',{},agent)).isError,true);assert.equal((await f.calls()).length,0)
    answer='allowed-once';value(await r.execute('qcu_feishu_outline',{},agent));assert.equal((await f.calls()).length,1);assert.equal(requests,2)
    session.append('turn/end',{turn:1,reason:{kind:'completed'}})
  } finally {await r.ctx.fiber.dispose();await f.runner.dispose()}
})
test('official unload aborts an in-flight owned subprocess, removes both tools and invalidates receipt',async()=>{
  const f=await fixture([{hang:true,ignoreTerm:true}]);const r=await runtime(f.config)
  try {
    const pending=r.execute('qcu_feishu_outline',{});await waitCalls(f,1)
    await r.fiber.dispose();assert.equal((await pending).isError,true)
    const [{pid}]=await f.calls();assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH')
    assert.equal(r.ctx.tools.get('qcu_feishu_outline'),undefined)
  } finally {await r.ctx.fiber.dispose();await f.runner.dispose()}
})
test('empty setup mounts guarded tools but returns a Chinese setup error without a process; disabled exposes no tools',async()=>{
  const empty=await runtime({enabled:true,cliPath:'',documentUrl:''})
  try{assert.ok(empty.ctx.tools.get('qcu_feishu_outline'));const error=await empty.execute('qcu_feishu_outline',{});assert.equal(error.isError,true);assert.match(JSON.stringify(error),/请在插件设置中填写/)}finally{await empty.ctx.fiber.dispose()}
  const r=await runtime({enabled:false,cliPath:'',documentUrl:''})
  try {assert.equal(r.ctx.tools.get('qcu_feishu_outline'),undefined)}finally{await r.ctx.fiber.dispose()}
})
