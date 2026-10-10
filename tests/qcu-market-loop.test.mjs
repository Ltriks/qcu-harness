import {catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {releaseKeyOf} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { digest, validateRelease, fetchPinned, PackagePreparation } from '../hub/plugins/qcu-market/src/host-core.mjs'
import { release } from '../hub/plugins/qcu-market/src/trusted-release.mjs'
import { DirectMarketFlow, readCoach } from '../hub/plugins/qcu-market/src/direct-flow.mjs'
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
const id='12345678-1234-1234-1234-123456789012'
const tick=()=>new Promise(r=>setImmediate(r))
const ok=value=>({ok:true,value})
function fixture(){
 const calls=[],mutations=[];let n=0,bundles=[],rows=[],listener
 const receipt={id,path:'/cache/'+release.file,entry:release,catalogSha256,releaseKey:releaseKeyOf(release),expiresAt:1000000}
 const inspection={status:'accepted',kind:'tarball',bundle:null,registry:null}
 const manager={listBundles:async()=>{calls.push('listBundles');return ok(bundles)},listPlugins:async()=>{calls.push('listPlugins');return ok(rows)},inspect:async()=>{calls.push('inspect');return ok(inspection)},installBundle:async(path,options)=>{mutations.push({kind:'install',path,options});bundles=[{name:release.id,version:release.version,installed:true,enabled:false}];return ok({application:'applied',stage:'enable',target:release.id,enabled:false,bundle:release.id,changed:true})},cancelInstall:async()=>ok({status:'cancelled'}),waitForInstall:async()=>ok(null),setBundleEnabled:async(name,enabled)=>{mutations.push({kind:'bundle',name,enabled});bundles[0].enabled=true;return ok({application:'applied'})},setPluginEnabled:async(entryId,enabled)=>{mutations.push({kind:'row',entryId,enabled});rows[0].enabled=true;rows[0].fiberPhase='active';return ok({application:'applied'})}}
 const remote={pluginManager:manager,qcuMarket:{status:async()=>ok(JSON.stringify(marketRuntime)),prepare:async()=>{calls.push('prepare');return ok(JSON.stringify(receipt))},verify:async()=>{calls.push('verify');return ok(JSON.stringify(receipt))},cancel:async()=>{calls.push('cancel-preparation');return ok('{}')}},$on:(_,fn)=>{listener=fn;return()=>{listener=null}}}
 const flow=new DirectMarketFlow(remote,{now:()=>0,uuid:()=>n++?id.replace('12345678','22345678'):id})
 return {flow,manager,remote,receipt,inspection,calls,mutations,setBundles:b=>bundles=b,setRows:r=>rows=r,progress:p=>listener?.(p)}
}
test('Host receipts expire, cancellation revokes them, no manager or session dependency',async()=>{
 let now=0;const p=new PackagePreparation({now:()=>now,download:async()=>'/fixed',verify:async()=>{}})
 const receipt=JSON.parse(await p.prepare(id));assert.equal(receipt.path,'/fixed');assert.equal(JSON.parse(await p.verify(id)).id,id)
 p.cancel(id);await assert.rejects(p.verify(id),/expired or cancelled/)
 await p.prepare(id);now=300001;await assert.rejects(p.verify(id),/expired or cancelled/);p.dispose()
})
test('Host duplicate preparation and disposal abort download',async()=>{
 let started;const start=new Promise(r=>started=r);const p=new PackagePreparation({download:({signal})=>new Promise((resolve,reject)=>{started();signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})})})
 const running=p.prepare(id);await start;await assert.rejects(p.prepare(id),/running/);p.dispose();await assert.rejects(running,/aborted/)
})
test('download review performs zero mutations; decline means no installation and no automatic retry',async()=>{
 const f=fixture();await f.flow.prepare();assert.equal(f.flow.state.phase,'review');assert.equal(f.mutations.length,0)
 await f.flow.decline();assert.equal(f.flow.state.phase,'declined');await assert.rejects(f.flow.confirmInstall(),/先查看/);assert.equal(f.mutations.length,0)
})
test('only explicit confirmation installs disabled once, without script grants, version exemptions or automatic enablement',async()=>{
 const f=fixture();await f.flow.prepare();const running=f.flow.confirmInstall();await assert.rejects(f.flow.confirmInstall(),/进行中/);await running
 assert.equal(f.mutations.length,1);assert.deepEqual(f.mutations[0],{kind:'install',path:f.receipt.path,options:{enabled:false,requestId:id.replace('12345678','22345678'),registry:null}})
 assert.equal(f.flow.state.phase,'installed');assert.equal(f.flow.state.status.state,'installed-disabled')
})
for(const [label,change] of Object.entries({source:f=>{f.flow.entry={...release,origin:'https://changed.invalid'}},manifest:f=>{f.receipt.entry={...release,sha256:'0'.repeat(64)}},expiry:f=>{f.flow.now=()=>1000001},registry:f=>{f.manager.inspect=async()=>ok({...f.inspection,registry:'https://changed.invalid'})},installed:f=>{f.setBundles([{name:release.id,version:release.version,installed:true,enabled:false}])},connection:f=>{f.flow.invalidate()}}))test(`confirmation invalidated by ${label} performs no installation`,async()=>{
 const f=fixture();await f.flow.prepare();change(f);await f.flow.confirmInstall().catch(()=>{});assert.equal(f.mutations.length,0);assert.equal(f.flow.state.review,null)
})
test('cancel during verification prevents late installation',async()=>{
 const f=fixture();await f.flow.prepare();let resolve;f.remote.qcuMarket.verify=()=>new Promise(r=>resolve=r)
 const pending=f.flow.confirmInstall();await tick();await f.flow.cancel();resolve(ok(JSON.stringify(f.receipt)));await pending;assert.equal(f.mutations.length,0);assert.equal(f.flow.state.phase,'cancelled')
})
test('download/official inspection refusal never reaches review or install',async()=>{
 const f=fixture();f.manager.inspect=async()=>ok({status:'refused',problem:'incompatible-version',reason:'not allowed'});await f.flow.prepare();assert.equal(f.flow.state.phase,'error');assert.equal(f.mutations.length,0)
})
test('official failure preserves pending build names without approval or retry',async()=>{
 const f=fixture();let count=0;f.manager.installBundle=async()=>{count++;return ok({application:'failed',error:{code:'builds-pending'},pendingBuilds:['blocked-script']})}
 await f.flow.prepare();await f.flow.confirmInstall();assert.equal(count,1);assert.equal(f.flow.state.phase,'error');assert.deepEqual(f.flow.state.result.pendingBuilds,['blocked-script']);assert.equal(f.flow.state.review,null)
})
test('reply loss and null reconciliation remain unconfirmed; duplicate install blocked',async()=>{
 const f=fixture();let count=0;f.manager.installBundle=async()=>{count++;return {ok:false,error:{message:'reply lost'}}}
 await f.flow.prepare();await f.flow.confirmInstall();await f.flow.reconcile();assert.equal(f.flow.state.phase,'unconfirmed');await assert.rejects(f.flow.prepare(),/进行中/);assert.equal(count,1)
})
test('early cancellation not-running retried only on official acknowledgement; no reinstall',async()=>{
 const f=fixture();let finish,cancels=0,installed=0;f.manager.installBundle=()=>{installed++;return new Promise(r=>finish=r)};f.manager.cancelInstall=async()=>ok({status:++cancels===1?'not-running':'cancelled'})
 await f.flow.prepare();const pending=f.flow.confirmInstall();await tick();await f.flow.cancel();assert.equal(f.flow.state.phase,'unconfirmed')
 f.progress({requestId:f.flow.request.id,phase:'installing'});await tick();assert.equal(f.flow.state.phase,'cancelled');assert.equal(cancels,2);assert.equal(installed,1)
 finish(ok({application:'cancelled'}));await pending
})
test('too-late cancellation never claims cancelled; official outcome reconciled without reinstall',async()=>{
 const f=fixture();let finish;f.manager.installBundle=()=>new Promise(r=>finish=r);f.manager.cancelInstall=async()=>ok({status:'too-late'})
 await f.flow.prepare();const pending=f.flow.confirmInstall();await tick();await f.flow.cancel();assert.equal(f.flow.state.phase,'applying')
 finish(ok({application:'failed',error:{code:'stopped'}}));await pending;assert.equal(f.flow.state.phase,'error')
})
test('success response must match bundle and fresh installed state',async()=>{
 const f=fixture();f.manager.installBundle=async()=>ok({application:'applied',stage:'install',bundle:'other'})
 await f.flow.prepare();await f.flow.confirmInstall();assert.equal(f.flow.state.phase,'unconfirmed')
})
test('bundle and exact row activation each need independent confirmation; restart never automated',async()=>{
 const f=fixture();await f.flow.prepare();await f.flow.confirmInstall();f.setRows([{moduleName:release.id,entryId:'exact:row',enabled:false,fiberPhase:'pending'}])
 await f.flow.reviewEnable('bundle');assert.equal(f.mutations.length,1);await f.flow.confirmEnable();assert.equal(f.mutations.length,2);assert.equal(f.flow.state.status.state,'row-disabled')
 await f.flow.reviewEnable('row');assert.equal(f.mutations.length,2);await f.flow.confirmEnable();assert.equal(f.mutations[2].entryId,'exact:row');assert.equal(f.flow.state.status.state,'component-active')
 const g=fixture();g.setBundles([{name:release.id,version:release.version,installed:true,enabled:false}]);g.manager.setBundleEnabled=async()=>ok({application:'restart-required'});await g.flow.reviewEnable('bundle');await g.flow.confirmEnable();assert.match(g.flow.state.message,/正常重启/)
})
test('changed row identity invalidates activation confirmation',async()=>{
 const f=fixture();f.setBundles([{name:release.id,version:release.version,installed:true,enabled:true}]);f.setRows([{moduleName:release.id,entryId:'row1',enabled:false}]);await f.flow.reviewEnable('row');f.setRows([{moduleName:release.id,entryId:'row2',enabled:false}]);await f.flow.confirmEnable();assert.equal(f.mutations.length,0)
})
test('metadata status never reads skill body or starts a session; missing bundle skips row inventory',async()=>{
 const f=fixture();assert.equal((await readCoach(f.manager)).state,'not-installed');assert.deepEqual(f.calls,['listBundles'])
 f.setBundles([{name:release.id,version:'old',installed:true}]);assert.equal((await readCoach(f.manager)).state,'conflict')
})
test('dispose releases subscriptions and requests cancellation, ignores late success',async()=>{
 const f=fixture();let finish;f.manager.installBundle=()=>new Promise(r=>finish=r);let cancelled=0;f.manager.cancelInstall=async()=>{cancelled++;return ok({status:'cancelled'})}
 await f.flow.prepare();const pending=f.flow.confirmInstall();await tick();const before=f.flow.state;f.flow.dispose();finish(ok({application:'applied',stage:'enable',target:release.id,enabled:false,bundle:release.id}));await pending;assert.equal(cancelled,1);assert.equal(f.flow.state,before)
})

for(const [field,value] of Object.entries({stage:'install',target:'other',bundle:'other',enabled:true}))test(`success with wrong ${field} stays unconfirmed`,async()=>{
 const f=fixture();f.manager.installBundle=async()=>{f.setBundles([{name:release.id,version:release.version,installed:true,enabled:false}]);return ok({application:'applied',stage:'enable',target:release.id,bundle:release.id,enabled:false,[field]:value})}
 await f.flow.prepare();await f.flow.confirmInstall();assert.equal(f.flow.state.phase,'unconfirmed');assert.ok(f.flow.request)
})
