import test from 'node:test'
import assert from 'node:assert/strict'
import {CatalogRuntime} from '../hub/plugins/qcu-market/src/catalog-runtime.mjs'
import {bundledCatalog,catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {updateFixture} from './support/market-update-fixture.mjs'
const ok=value=>({ok:true,value}),tick=()=>new Promise(r=>setImmediate(r))
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
async function fixture(t){
 const f=await updateFixture(t),preview=createPreviewFixture()
 for(const method of ['prepare','verify','cancel'])f.remote.qcuMarket[method]=preview.remote.qcuMarket[method]
 let catalog=bundledCatalog,state={}
 f.remote.qcuMarket.refresh=async()=>ok(JSON.stringify({mode:'legacy',state:'legacy',catalog,fingerprint:catalogSha256,message:'synthetic catalog'}))
 const runtime=new CatalogRuntime(f.remote,patch=>state={...state,...patch})
 t.after(()=>{runtime.dispose();preview.flows.forEach(f=>f.dispose())})
 assert.equal(await runtime.refresh(),true)
 return {...f,runtime,updates:runtime.updates,preview,state:()=>state,catalog:value=>catalog=value}
}
test('shared update operations and ordinary mutations refuse while a real catalog refresh is awaiting HTTP',async t=>{
 const f=await fixture(t),wait=deferred(),started=deferred(),refresh=f.remote.qcuMarket.refresh
 f.remote.qcuMarket.refresh=async()=>{started.resolve();await wait.promise;return refresh()}
 const running=f.runtime.refresh();await started.promise
 for(const action of [()=>f.updates.check(),()=>f.updates.prepare(f.id),()=>f.updates.reconcile(),()=>f.state().flows[1].prepare(),()=>f.state().flows[1].reviewActivate()])await assert.rejects(action(),/目录刷新/)
 assert.equal(f.calls.filter(c=>c.name==='updatesCheck'||c.name==='installBundle').length,0)
 wait.resolve();assert.equal(await running,true)
})
test('update check, download and review retain catalog ownership; refreshed peers are current flows',async t=>{
 const f=await fixture(t),old=f.runtime.flows,check=f.remote.qcuMarket.updatesCheck,wait=deferred()
 f.remote.qcuMarket.updatesCheck=async(...a)=>{await wait.promise;return check(...a)}
 const checking=f.updates.check();await tick();assert.equal(await f.runtime.refresh(),false);assert.equal(f.runtime.flows,old)
 wait.resolve();await checking
 const prepare=f.remote.qcuMarket.updatesPrepare,download=deferred(),started=deferred()
 f.remote.qcuMarket.updatesPrepare=async(...a)=>{started.resolve();await download.promise;return prepare(...a)}
 const preparing=f.updates.prepare(f.id);await started.promise
 assert.equal(await f.runtime.refresh(),false);await assert.rejects(f.runtime.flows[1].prepare(),/更新正在进行/)
 download.resolve();await preparing;assert.equal(f.updates.state.phase,'review',f.updates.state.message)
 assert.equal(await f.runtime.refresh(),false);await f.updates.decline()
 f.catalog({...bundledCatalog,entries:[bundledCatalog.entries[1]]});assert.equal(await f.runtime.refresh(),true)
 assert.ok(old.every(f=>f.disposed));assert.equal(f.updates.peers(),f.runtime.flows);assert.notEqual(f.updates.peers(),old)
 const current=f.runtime.flows[0];await current.prepare();assert.equal(current.state.phase,'review',current.state.message)
 await assert.rejects(f.updates.check(),/其他产品/);await assert.rejects(f.updates.prepare(f.id),/其他产品/)
 await current.decline();await f.updates.check();assert.equal(f.updates.state.phase,'idle')
 assert.equal(f.calls.filter(c=>c.name==='installBundle').length,0)
})
test('lost update result locks refresh and installs across reset, unload and a fresh runtime; only new-process verification releases it',async t=>{
 const f=await fixture(t);await f.updates.check();await f.updates.prepare(f.id);f.setResponse('lost');await f.updates.confirm()
 assert.equal(f.updates.state.phase,'unconfirmed');const owner=f.updates.request
 f.setMode('offline');await f.updates.check();assert.equal(f.updates.state.phase,'error');assert.equal(f.updates.request,owner)
 await f.updates.reconcile();assert.equal(f.updates.state.phase,'unconfirmed');assert.equal(f.updates.request,owner)
 assert.equal(await f.runtime.refresh(),false);f.runtime.reset();assert.equal(f.updates.request,owner)
 assert.equal(await f.runtime.refresh(),false);f.runtime.dispose()
 assert.equal(f.calls.filter(c=>c.name==='cancelInstall').length,0)
 const next=new CatalogRuntime(f.remote,()=>{});t.after(()=>next.dispose())
 assert.equal(await next.refresh(),false);assert.equal(next.updates.locked(),true);assert.equal(next.flows.length,0)
 f.setMode('offline');await next.updates.check();assert.equal(next.updates.state.phase,'error');assert.equal(next.updates.locked(),true)
 f.setMode('ok');f.restart();await next.updates.check();assert.equal(next.updates.state.phase,'complete',next.updates.state.message)
 assert.equal(await next.refresh(),true);assert.equal(f.calls.filter(c=>c.name==='installBundle').length,1)
})
test('ordinary unknown install and activation owners block updates/refresh without automatic cancellation',async t=>{
 const f=await fixture(t),flow=f.runtime.flows[1]
 flow.request={id:crypto.randomUUID()};flow.set({phase:'unconfirmed'});f.runtime.reset()
 await assert.rejects(f.updates.check(),/其他产品/);assert.equal(await f.runtime.refresh(),false)
 flow.request=null;flow.activation={authorized:false};await assert.rejects(f.updates.check(),/其他产品/)
 assert.equal(await f.runtime.refresh(),false);f.runtime.dispose();assert.equal(f.calls.filter(c=>c.name==='cancelInstall').length,0)
 assert.equal(f.preview.calls.filter(c=>c.name==='installBundle').length,0)
})
test('connection reset prevents a late catalog response from replacing the current flows',async t=>{
 const f=await fixture(t),old=f.runtime.flows,wait=deferred(),started=deferred(),refresh=f.remote.qcuMarket.refresh
 f.remote.qcuMarket.refresh=async()=>{started.resolve();await wait.promise;return refresh()}
 const running=f.runtime.refresh();await started.promise;f.runtime.reset();wait.resolve()
 assert.equal(await running,false);assert.equal(f.runtime.flows,old);assert.ok(old.every(f=>!f.disposed))
 assert.equal(f.updates.state.phase,'idle');assert.equal(f.calls.filter(c=>c.name==='installBundle').length,0)
})
