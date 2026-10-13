// Real public Settings + ConfigEditor + Loader, with synthetic isolated files only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { isVolatile } from '@deepseek-ai/cosmokit'
import z from '@deepseek-ai/schemastery'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Settings from '@deepseek-ai/dsh-settings'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { mountRootInclude } from '@deepseek-ai/dsh-app-boot'
import * as sourcePlugin from '../hub/plugins/qcu-feishu-readonly/index.js'
import { fixture, doc, sectionContent, selected, signal, waitCalls } from './qcu-feishu-readonly.test.mjs'
import { ReadAuthority } from '../hub/plugins/qcu-feishu-readonly/src/authority.mjs'

const plugin=process.env.QCU_FEISHU_EXTRACTED?await import(pathToFileURL(process.env.QCU_FEISHU_EXTRACTED+'/index.js')):sourcePlugin
const id='qcu-feishu-readonly'
async function setup() {
  if(!process.env.QCU_FEISHU_OFFICIAL_APP_BOOT)throw new Error('Configuration tests require audited exact ASAR app-boot')
  const dir=await mkdtemp(resolve('.work/feishu-refine/settings-'))
  const profile=join(dir,'profile');const home=join(dir,'synthetic-home');await mkdir(profile);await mkdir(home)
  const anchor=join(profile,'package.json');const patchPath=join(profile,'cordis.patch.yml');const base=join(dir,'cordis.json')
  await writeFile(anchor,JSON.stringify({name:'synthetic-profile',private:true,dsh:{profile:{bundles:[]}}}))
  const initial=[{insert:[{id,name:'cordis:feishu',config:{enabled:true,cliPath:'',documentUrl:''}}]}]
  await writeFile(patchPath,JSON.stringify(initial))
  await writeFile(base,'[]\n')
  const ctx=new Context();new Loader(ctx,{baseUrl:pathToFileURL(base).href})
  ctx.provide('profileContext',{name:'synthetic-profile',dir:profile,home,patchPath,installAnchor:anchor,overlays:[]})
  await ctx.plugin(SystemPrompt).await();await ctx.plugin(ToolRuntime).await()
  ctx.loader.builtins.feishu=plugin
  await mountRootInclude(ctx,base,initial);await ctx.loader.await()
  const entry=[...ctx.loader.entries()].find(e=>e.options.id===id)
  assert.ok(entry?.fiber);assert.equal(entry.fiber.state,2)
  await ctx.plugin(ConfigEditor).await();await ctx.plugin(Settings).await()
  const agent={session:{id:'SyntheticSetupSession01'}};let sequence=0
  const execute=(name,args)=>ctx.tools.execute({name,arguments:args,agent,signal:signal(),callId:'setup-'+(++sequence)})
  const form=()=>ctx.settings.describe().find(x=>x.ns===id)
  const update=patch=>ctx.settings.update(id,patch,form().revision)
  return {ctx,dir,entry,patchPath,form,update,execute,agent}
}
const value=r=>{assert.equal(r.isError,false,JSON.stringify(r));return JSON.parse(r.content[0].text)}

test('official form exposes only two Chinese-described volatile fields; initial empty tools are unconfigured',async()=>{
  const s=await setup();const f=await fixture([])
  try {
    const form=s.form();assert.ok(form);assert.equal(form.applies,'live')
    // Official schemastery serializes schemas as a uid/refs graph, not JSON Schema.
    assert.deepEqual(Object.keys(form.schema.refs[form.schema.uid].dict).sort(),['cliPath','documentUrl'])
    assert.match(JSON.stringify(form.schema),/本机 CLI 路径/);assert.match(JSON.stringify(form.schema),/授权文档链接/)
    assert.ok(isVolatile(s.entry.fiber.config.cliPath));assert.equal(s.entry.fiber.config.cliPath.get(),'')
    assert.ok(s.ctx.tools.get('qcu_feishu_outline'))
    const r=await s.execute('qcu_feishu_outline',{});assert.equal(r.isError,true);assert.match(JSON.stringify(r),/请在插件设置/)
    await s.update({cliPath:f.config.cliPath});assert.equal((await s.execute('qcu_feishu_outline',{})).isError,true)
    assert.equal((await f.calls()).length,0)
    await assert.rejects(s.update({enabled:false}),/not volatile/)
    await assert.rejects(s.ctx.settings.mutate(id,[{op:'set',path:['documentUrl'],value:42}],s.form().revision))
    assert.equal((await f.calls()).length,0)
  } finally {await s.ctx.fiber.dispose();await f.runner.dispose()}
})
test('official Settings persists and Loader updates stable refs without remount; replacement revokes receipt',async()=>{
  const s=await setup();const f=await fixture([{value:doc()},{value:doc(sectionContent)},{value:doc()}]);const uid=s.entry.fiber.uid;const ref=s.entry.fiber.config.documentUrl
  try {
    await s.update({cliPath:f.config.cliPath,documentUrl:f.config.documentUrl})
    assert.equal(s.entry.fiber.uid,uid);assert.equal(s.entry.fiber.config.documentUrl,ref);assert.equal(ref.get(),f.config.documentUrl)
    const persisted=await readFile(s.patchPath,'utf8');assert.match(persisted,/cliPath:/);assert.match(persisted,/DocSynthetic01/)
    const o=value(await s.execute('qcu_feishu_outline',{}));value(await s.execute('qcu_feishu_section',selected(o)))
    await s.update({documentUrl:'https://fixture.feishu.cn/docx/OtherSynthetic01'})
    assert.equal((await s.execute('qcu_feishu_section',selected(o))).isError,true)
    assert.equal((await f.calls()).length,2)
    await s.update({documentUrl:'https://fixture.feishu.cn/docx/DocSynthetic01?arbitrary=1'})
    assert.equal((await s.execute('qcu_feishu_outline',{})).isError,true);assert.equal((await f.calls()).length,2)
    await s.update({documentUrl:f.config.documentUrl});value(await s.execute('qcu_feishu_outline',{}))
    assert.equal((await f.calls()).length,3)
    const revision=s.form().revision
    await s.update({documentUrl:''})
    await assert.rejects(s.ctx.settings.update(id,{documentUrl:f.config.documentUrl},revision),/changed|revision|conflict/i)
    assert.equal((await s.execute('qcu_feishu_outline',{})).isError,true)
  } finally {await s.ctx.fiber.dispose();await f.runner.dispose()}
})
test('in-flight official update cancels child; rapid invalid/valid changes cannot overlap or reuse old receipt; unload closes owner',async()=>{
  const s=await setup();const old=await fixture([{hang:true,ignoreTerm:true}]);const next=await fixture([{value:doc()}])
  try {
    await s.update({cliPath:old.config.cliPath,documentUrl:old.config.documentUrl})
    const pending=s.execute('qcu_feishu_outline',{});await waitCalls(old,1)
    await s.update({cliPath:next.config.cliPath,documentUrl:''})
    assert.equal((await s.execute('qcu_feishu_outline',{})).isError,true)
    await s.update({documentUrl:next.config.documentUrl})
    const fresh=s.execute('qcu_feishu_outline',{})
    assert.equal((await pending).isError,true)
    const [{pid}]=await old.calls();assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH')
    value(await fresh);assert.equal((await old.calls()).length,1);assert.equal((await next.calls()).length,1)
    await s.entry.fiber.dispose();assert.equal(s.ctx.tools.get('qcu_feishu_outline'),undefined)
  } finally {await s.ctx.fiber.dispose();await old.runner.dispose();await next.runner.dispose()}
})
test('authority generation discards late successful old results and does not resurrect after unload',async()=>{
  let finish;let close;let made=0
  const authority=new ReadAuthority({enabled:true,cliPath:'/synthetic/lark-cli',documentUrl:'https://fixture.feishu.cn/docx/DocSynthetic01'},()=>{
    made++;return {outline:()=>new Promise(r=>{finish=r}),dispose:()=>new Promise(r=>{close=r})}
  })
  const pending=authority.read('outline',{},Object.freeze({}),signal());await new Promise(r=>setImmediate(r))
  authority.update({enabled:true,cliPath:'/synthetic/lark-cli',documentUrl:''})
  const rejection=assert.rejects(pending,e=>e.category==='cancelled');finish({status:'late-body'});await rejection
  await assert.rejects(authority.read('outline',{},Object.freeze({}),signal()),e=>e.category==='setup')
  const disposing=authority.dispose();close();await disposing
  authority.update({enabled:true,cliPath:'/synthetic/lark-cli',documentUrl:'https://fixture.feishu.cn/docx/DocSynthetic01'})
  await assert.rejects(authority.read('outline',{},Object.freeze({}),signal()),e=>e.category==='cancelled');assert.equal(made,1)
})
test('authority rapid generations wait for prior disposal and unload prevents a queued replacement runner',async()=>{
  let finish;let close;let made=0
  const config={enabled:true,cliPath:'/synthetic/lark-cli',documentUrl:'https://fixture.feishu.cn/docx/DocSynthetic01'}
  const authority=new ReadAuthority(config,()=>{made++;return {outline:()=>new Promise(r=>{finish=r}),dispose:()=>new Promise(r=>{close=r})}})
  const old=authority.read('outline',{},Object.freeze({}),signal());await new Promise(r=>setImmediate(r))
  authority.update({...config,documentUrl:'https://fixture.feishu.cn/docx/OtherSynthetic01'})
  const queued=authority.read('outline',{},Object.freeze({}),signal())
  const rejectedOld=assert.rejects(old,e=>e.category==='cancelled');const rejectedQueued=assert.rejects(queued,e=>e.category==='cancelled')
  authority.update(config);const disposal=authority.dispose();finish({late:true});close()
  await Promise.all([rejectedOld,rejectedQueued,disposal]);assert.equal(made,1)
})
test('official owned volatile event for unrelated entry leaves this receipt valid',async()=>{
  const s=await setup();const f=await fixture([{value:doc()},{value:doc(sectionContent)}])
  try {
    await s.update({cliPath:f.config.cliPath,documentUrl:f.config.documentUrl});const o=value(await s.execute('qcu_feishu_outline',{}))
    s.ctx.loader.builtins.unrelated={Config:z.object({value:z.string().default('').volatile()}),apply(){}}
    const include=s.ctx.loader.resolve('include').subtree
    const otherId=await include.create({id:'unrelated-setup',name:'cordis:unrelated',config:{value:'a'}})
    const other=s.ctx.loader.resolve(otherId);await other.fiber.await()
    await other.update({config:{value:'b'}})
    value(await s.execute('qcu_feishu_section',selected(o)));assert.equal((await f.calls()).length,2)
  } finally {await s.ctx.fiber.dispose();await f.runner.dispose()}
})
