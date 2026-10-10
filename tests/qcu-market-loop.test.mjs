import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { digest, validateRelease, fetchPinned, inspectCoach, MarketOperations } from '../hub/plugins/qcu-market/src/host-core.mjs'
import { release } from '../hub/plugins/qcu-market/src/trusted-release.mjs'
import { MarketFlow } from '../hub/plugins/qcu-market/src/flow.mjs'
const bytes=Buffer.from('bounded immutable fixture'),sha=digest(bytes)
const entry={...release,bytes:bytes.length,sha256:sha,file:`qcu-study-coach-0.1.0-pilot.2-${sha}.tgz`}
const agent={session:{id:'test',header:{cwd:'/synthetic'}}}
const response=(body=bytes,options={})=>new Response(body,{status:200,headers:{'content-length':String(bytes.length)},...options})
async function cache(t){const dir=await mkdtemp(join(tmpdir(),'qcu-loop-'));t.after(()=>rm(dir,{recursive:true,force:true}));return join(dir,'cache')}
test('fixed catalog rejects arbitrary identity, origin, protocol, filename and size',()=>{
 for(const change of [{id:'other'},{origin:'https://evil.invalid'},{origin:'file:///tmp'},{file:'../anything'},{bytes:1048577},{sha256:'bad'}])assert.throws(()=>validateRelease({...entry,...change}))
 assert.equal(validateRelease(entry),`${entry.origin}/plugins/${entry.file}`)
})
test('pinned download validates before durable write and cache reuse performs no network',async t=>{
 const root=await cache(t);let calls=0
 const fetcher=async(url,opt)=>{calls++;assert.equal(url,validateRelease(entry));assert.equal(opt.redirect,'manual');assert.equal(opt.credentials,'omit');return response()}
 const path=await fetchPinned({entry,root,fetcher});assert.deepEqual(await readFile(path),bytes)
 assert.equal(await fetchPinned({entry,root,fetcher}),path);assert.equal(calls,1);assert.deepEqual(await readdir(root),[entry.file])
})
for(const [label,make] of Object.entries({redirect:()=>response(null,{status:302}),length:()=>response(bytes,{headers:{'content-length':'1'}}),oversize:()=>response(Buffer.concat([bytes,bytes])),truncated:()=>response(bytes.subarray(1)),hash:()=>response(Buffer.alloc(bytes.length)),encoded:()=>response(bytes,{headers:{'content-length':String(bytes.length),'content-encoding':'gzip'}}),network:()=>{throw new Error('offline')}}))test(`download ${label} fails without an installable cache artifact`,async t=>{
 const root=await cache(t);await assert.rejects(fetchPinned({entry,root,fetcher:async()=>make()}));assert.deepEqual(await readdir(root),[])
})
test('abort and symlink cache fail closed',async t=>{
 const root=await cache(t),c=new AbortController();c.abort()
 await assert.rejects(fetchPinned({entry,root,signal:c.signal,fetcher:async()=>response()}));assert.deepEqual(await readdir(root),[])
 const target=join(root,'target');await writeFile(target,bytes);await symlink(target,join(root,entry.file))
 await assert.rejects(fetchPinned({entry,root,fetcher:()=>{throw new Error('must not fetch')}}),/Unsafe cached/)
})
test('status requires exact bundle, active row and winning session skill; restart discovery simulation',async()=>{
 const body=await readFile(new URL('../skills/qcu-study-coach/SKILL.md',import.meta.url),'utf8')
 let bundles=[],rows=[],skill
 const inspect=()=>inspectCoach({manager:{listBundles:()=>bundles,listPlugins:()=>rows},skills:{get:async(name,options)=>{assert.equal(name,release.skill);assert.equal(options.scope,agent);return skill}},agent})
 assert.equal((await inspect()).state,'not-installed')
 bundles=[{name:release.id,installed:true,version:release.version,enabled:false}];assert.equal((await inspect()).state,'installed-disabled')
 bundles[0].enabled=true;assert.equal((await inspect()).state,'activation-required')
 rows=[{moduleName:release.id,entryId:'exact:row',enabled:true,fiberPhase:'active'}];assert.equal((await inspect()).state,'skill-unavailable')
 // Simulates discovery after fresh runtime composition, not a real App restart.
 skill={provider:release.provider,content:body};assert.equal((await inspect()).state,'ready')
 skill={provider:'shadow',content:body};assert.equal((await inspect()).state,'conflict')
 skill={provider:release.provider,content:body+'changed'};assert.equal((await inspect()).state,'conflict')
 skill=undefined;rows[0].fiberPhase='failed';assert.equal((await inspect()).state,'failed')
 bundles[0].version='0.1.0-pilot.1';assert.equal((await inspect()).state,'conflict')
})
test('Host duplicate and cancellation guard; no arbitrary installation operation',async()=>{
 let calls=0,started
 const start=new Promise(r=>started=r)
 const ops=new MarketOperations({inspect:async()=>({state:'not-installed'}),download:({signal})=>{calls++;started();return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true})})}})
 const pending=ops.run('prepare',agent);await start
 await assert.rejects(ops.run('prepare',agent),/progress/);assert.equal(calls,1)
 await ops.run('cancel',agent);await assert.rejects(pending,/cancelled/)
 await assert.rejects(ops.run('install',agent),/Unsupported/);await assert.rejects(ops.run('verify',agent),/No prepared/)
 ops.dispose()
})
test('Host verify binds prepared file to session and requires approval-compatible policy',async()=>{
 let allowed=true;const ops=new MarketOperations({inspect:async()=>({state:'not-installed'}),authorize:()=>{if(!allowed)throw new Error('policy')},download:async()=>'/fixed/cache.tgz',verify:async path=>assert.equal(path,'/fixed/cache.tgz')})
 const result=await ops.run('prepare',agent);assert.equal(result.state,'prepared');assert.match(result.prompt,/enabled=false/)
 assert.equal((await ops.run('verify',agent)).state,'verified')
 await assert.rejects(ops.run('verify',{session:{id:'other'}}),/No prepared/)
 allowed=false;await assert.rejects(ops.run('prepare',agent),/policy/);await assert.rejects(ops.run('verify',agent),/policy/)
 assert.equal((await ops.run('status',agent)).state,'not-installed');await ops.run('cancel',agent);allowed=true;await assert.rejects(ops.run('verify',agent),/No prepared/);ops.dispose()
})
function context(){const calls=[],state={draft:'',phase:'plain',attachmentIds:[],queue:[]};let releases=0
 const ctx={sessions:{create:async()=>{calls.push('create');return 'market-session'},retain:(id,options)=>{assert.equal(options.source,'qcu-market');return {sessionId:id,ready:Promise.resolve({sessionId:id,ctx:{synthetic:true}}),release:()=>releases++}}},remote:{commands:{execute:async(id,line)=>{calls.push(line);return {ok:true,value:{result:{kind:'success',text:JSON.stringify({state:'not-installed'})}}}}}},conversation:{input:{for:()=>({state:{getSnapshot:()=>state},setDraft:text=>{state.draft=text;calls.push('draft')},submit:()=>{throw new Error('MUST NEVER SUBMIT')}})}},uiWorkspace:{openSession:()=>calls.push('open')},layout:{selectPanel:id=>calls.push(id)}}
 return {ctx,calls,state,releases:()=>releases}}
test('Client uses actual command envelope, preserves draft/attachments, never submits, releases scope',async()=>{
 const c=context(),flow=new MarketFlow(c.ctx);assert.equal((await flow.run('status')).state,'not-installed')
 c.state.attachmentIds=['local'];await assert.rejects(flow.draft('task'),/clear/);c.state.attachmentIds=[]
 await flow.draft('task');assert.equal(c.state.draft,'task');await assert.rejects(flow.draft('second'),/clear/)
 assert.deepEqual(c.calls,['create','/qcu-market status','draft','open',null]);flow.dispose();assert.equal(c.releases(),1)
})
test('Client cancel before asynchronous session creation never starts prepare',async()=>{
 const c=context();let resolve;c.ctx.sessions.create=()=>new Promise(r=>resolve=r)
 const flow=new MarketFlow(c.ctx),pending=flow.run('prepare');await flow.cancel();resolve('market-session')
 await assert.rejects(pending,/cancelled/);assert.equal(c.calls.length,0);flow.dispose();assert.equal(c.releases(),1)
})
test('Client repeated click rejects, Host errors propagate without success',async()=>{
 const c=context();let resolve;c.ctx.remote.commands.execute=()=>new Promise(r=>resolve=r)
 const flow=new MarketFlow(c.ctx),pending=flow.run('status');await assert.rejects(flow.run('prepare'),/progress/)
 await new Promise(r=>setImmediate(r));resolve({ok:false,error:{message:'offline'}});await assert.rejects(pending,/offline/);flow.dispose()
})
