import test from 'node:test'
import assert from 'node:assert/strict'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
const tick=()=>new Promise(r=>setImmediate(r))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('concurrent reads are deduplicated per entry and do not lock peer mutations or overwrite install/activation review',async()=>{
 const f=createPreviewFixture(),flow=f.flows[0],gate=deferred(),read=f.remote.pluginManager.listBundles
 f.remote.pluginManager.listBundles=async()=>{await gate.promise;return read()}
 try{
  const first=flow.status(),second=flow.status();await tick();assert.equal(flow.pending,null)
  // Real mutation review may start during inventory; the late read has no UI authority.
  const prepare=flow.prepare();await tick();assert.equal(flow.state.phase,'preparing');gate.resolve();await Promise.all([first,second,prepare]);assert.equal(flow.state.review.kind,'install')
  const review=flow.state.review;await flow.status();await f.flows[1].status();assert.equal(flow.state.review,review);assert.equal(flow.state.phase,'review')
  assert.equal(f.calls.filter(c=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(c.name)).length,0)
 }finally{f.flows.forEach(f=>f.dispose())}
})
for(const lifecycle of ['invalidate','dispose'])test(`late inventory success/failure after ${lifecycle} cannot change state`,async()=>{
 for(const fail of [false,true]){
  const f=createPreviewFixture(),flow=f.flows[0],wait=deferred();f.remote.pluginManager.listBundles=()=>wait.promise
  try{const pending=flow.status();await tick();flow[lifecycle]();const before=flow.state;fail?wait.reject(Error('late failure')):wait.resolve({ok:true,value:[]});await pending;assert.equal(flow.state,before);assert.equal(flow.statusRead,null)}finally{f.flows.forEach(f=>f.dispose())}
 }
})
test('read-only check retains genuine loader failures and exact version conflicts',async()=>{
 const f=createPreviewFixture(),flow=f.flows[0];try{
  f.remote.pluginManager.listBundles=async()=>({ok:true,value:[{name:flow.entry.id,version:flow.entry.version,installed:true,enabled:true,error:{code:'genuine-loader-failure'}}]})
  await flow.status();assert.equal(flow.state.phase,'idle');assert.equal(flow.state.status.state,'failed');assert.equal(flow.state.status.reason,'genuine-loader-failure')
  f.remote.pluginManager.listBundles=async()=>({ok:true,value:[{name:flow.entry.id,version:'different',installed:true}]})
  await flow.status();assert.equal(flow.state.status.state,'conflict');assert.equal(flow.state.status.installedVersion,'different')
 }finally{f.flows.forEach(f=>f.dispose())}
})
