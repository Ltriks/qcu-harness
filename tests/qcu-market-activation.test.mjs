import test from "node:test"
import assert from "node:assert/strict"
import {createCatalogFlows} from "../hub/plugins/qcu-market/src/direct-flow.mjs"
import {bundledCatalog} from "../hub/plugins/qcu-market/src/bundled-catalog.mjs"
import {marketRuntime} from "../hub/plugins/qcu-market/src/remote-contract.mjs"
import {createMarketViews} from "../hub/plugins/qcu-market/src/market-view.mjs"
const ok=value=>({ok:true,value}),tick=()=>new Promise(r=>setImmediate(r))
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)}}
function fixture({enabled=false,auto=false,live=false}={}){
 const item=bundledCatalog.entries[1],entry=item.release,calls=[]
 const row={moduleName:entry.id,entryId:"exact:"+entry.id,patchId:entry.id,enabled:false,fiberPhase:null,meta:{description:"reviewed identity"}}
 const bundle={name:entry.id,version:entry.version,installed:true,enabled,rows:[{rowId:entry.id,moduleName:entry.id,...(enabled||live?{entryId:row.entryId}:{})}],overrides:[],meta:{description:"reviewed bundle"}}
 let rows=enabled||live?[row]:[],time=0
 const result=target=>ok({application:"applied",stage:"enable",target,enabled:true})
 const manager={listBundles:async()=>ok([bundle]),listPlugins:async()=>ok(rows),setBundleEnabled:async id=>{calls.push(["bundle",id]);bundle.enabled=true;bundle.rows[0].entryId=row.entryId;rows=[row];if(auto){row.enabled=true;row.fiberPhase="active"}return result(id)},setPluginEnabled:async id=>{calls.push(["row",id]);row.enabled=true;row.fiberPhase="active";return result(id)}}
 const remote={pluginManager:manager,qcuMarket:{status:async()=>ok(JSON.stringify(marketRuntime))},$on:()=>()=>{}}
 const flows=createCatalogFlows(remote),flow=flows[1];flows.forEach(f=>f.now=()=>time)
 return {item,entry,row,bundle,manager,remote,flow,flows,calls,result,setRows:r=>rows=r,setTime:t=>time=t}
}
async function activate(f){await f.flow.reviewActivate();assert.equal(f.flow.state.review?.kind,"activate");assert.equal(f.calls.length,0);await f.flow.confirmActivate()}
test("one consent enables bundle and exact remaining row, keeping other entries untouched",async()=>{
 const f=fixture();await activate(f);assert.deepEqual(f.calls,[["bundle",f.entry.id],["row",f.row.entryId]]);assert.equal(f.flow.state.status.state,"component-active");assert.equal(f.flows[2].state.phase,"idle");assert.equal(f.flow.state.activationResults.length,2)
})
test("official bundle enable that activates its row is verified without duplicate row enable",async()=>{
 const f=fixture({auto:true});await activate(f);assert.deepEqual(f.calls,[["bundle",f.entry.id]]);assert.equal(f.flow.state.status.state,"component-active")
})
test("already enabled bundle permits one reviewed exact row enable",async()=>{
 const f=fixture({enabled:true});await activate(f);assert.deepEqual(f.calls,[["row",f.row.entryId]])
})
for(const [label,mutate] of Object.entries({
 wrongRow:f=>f.bundle.rows[0].rowId="wrong",wrongModule:f=>f.bundle.rows[0].moduleName="wrong",multiple:f=>f.bundle.rows.push({...f.bundle.rows[0]}),missing:f=>f.bundle.rows=[],overrides:f=>f.bundle.overrides=["unrelated"],wrongVersion:f=>f.bundle.version="other",wrongLive:f=>{f.bundle.enabled=true;f.bundle.rows[0].entryId="expected";f.setRows([{...f.row,entryId:"wrong"}])},multipleLive:f=>{f.bundle.enabled=true;f.bundle.rows[0].entryId=f.row.entryId;f.setRows([f.row,{...f.row}])},failed:f=>{f.bundle.enabled=true;f.bundle.rows[0].entryId=f.row.entryId;f.row.fiberPhase="failed";f.setRows([f.row])}
}))test(`activation review rejects ${label} without mutation`,async()=>{const f=fixture();mutate(f);await f.flow.reviewActivate();assert.equal(f.flow.state.phase,"error");assert.equal(f.flow.state.review,null);assert.deepEqual(f.calls,[])})
for(const [label,mutate] of Object.entries({
 version:f=>f.bundle.version="changed",bundleIdentity:f=>f.bundle.meta.description="changed",rowIdentity:f=>f.row.meta.description="changed",catalog:f=>f.flow.fingerprint="changed",release:f=>f.flow.entry={...f.entry,sha256:"0".repeat(64)},expiry:f=>f.setTime(300001),host:f=>f.remote.qcuMarket.status=async()=>ok(JSON.stringify({...marketRuntime,version:"stale"})),transport:f=>f.remote.pluginManager={...f.manager},reset:f=>f.flow.invalidate(),leave:f=>f.flow.leave()
}))test(`stale activation confirmation rejects ${label}`,async()=>{const f=fixture({live:true});await f.flow.reviewActivate();mutate(f);await f.flow.confirmActivate().catch(()=>{});assert.deepEqual(f.calls,[]);assert.equal(f.flow.state.review,null)})
for(const application of ["failed","overridden","restart-required","cancelled","unknown"])test(`bundle ${application} stops before component mutation and preserves result`,async()=>{
 const f=fixture();const original=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{await original(id);return ok({application,stage:"enable",target:id,enabled:true,pendingBuilds:["do-not-authorize"]})};await activate(f);assert.equal(f.calls.length,1);assert.equal(f.flow.state.result.application,application);assert.equal(f.flow.state.status.state,"row-disabled");assert.equal(f.flow.state.phase,application==="unknown"?"unconfirmed":"partial")
})
test("restart-required partial outcome resumes only through new row consent",async()=>{
 const f=fixture();const original=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{await original(id);return ok({application:"restart-required",stage:"enable",target:id,enabled:true})};await activate(f);await f.flow.confirmActivate().catch(()=>{});assert.equal(f.calls.length,1);await f.flow.reviewActivate();assert.equal(f.flow.state.review.inventory.status.state,"row-disabled");await f.flow.confirmActivate();assert.equal(f.calls.length,2)
})
for(const stage of ["bundle","row"])test(`${stage} lost reply is reconciled read-only; no duplicate mutation`,async()=>{
 const f=fixture({enabled:stage==="row"});const method=stage==="bundle"?"setBundleEnabled":"setPluginEnabled",original=f.manager[method];f.manager[method]=async id=>{await original(id);throw Error("reply lost")};await activate(f);assert.equal(f.flow.state.phase,"unconfirmed");assert.ok(f.flow.activation);await assert.rejects(f.flows[2].prepare(),/其他条目/);await assert.rejects(f.flow.reviewActivate(),/进行中/);await f.flow.reconcileActivation();assert.equal(f.calls.length,1);assert.equal(f.flow.activation,null);assert.equal(f.flow.state.phase,"partial");if(stage==="bundle"){await f.flow.reviewActivate();await f.flow.confirmActivate();assert.deepEqual(f.calls.map(c=>c[0]),["bundle","row"])}
})
test("lost reply with disabled inventory stays blocked after read-only reconciliation",async()=>{
 const f=fixture();f.manager.setBundleEnabled=async id=>{f.calls.push(["bundle",id]);throw Error("reply lost")};await activate(f);await f.flow.reconcileActivation();assert.ok(f.flow.activation);await assert.rejects(f.flow.confirmActivate(),/进行中/);assert.equal(f.calls.length,1)
})
test("duplicate click and cross-entry lock hold over both in-flight mutations",async()=>{
 const f=fixture(),bundle=deferred(),row=deferred(),b=f.manager.setBundleEnabled,r=f.manager.setPluginEnabled
 f.manager.setBundleEnabled=async id=>{await bundle.promise;return b(id)};f.manager.setPluginEnabled=async id=>{await row.promise;return r(id)}
 await f.flow.reviewActivate();const running=f.flow.confirmActivate();await tick();await assert.rejects(f.flow.confirmActivate(),/进行中/);await f.flows[2].status();assert.equal(f.flows[2].state.phase,'idle');bundle.resolve();await tick();await f.flows[2].status();assert.equal(f.flows[2].state.phase,'idle');row.resolve();await running;assert.equal(f.calls.length,2)
})
for(const action of ["leave","invalidate","dispose"])test(`${action} during bundle enable prevents late component enable and retains actual status`,async()=>{
 const f=fixture(),d=deferred(),b=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{await d.promise;return b(id)}
 await f.flow.reviewActivate();const running=f.flow.confirmActivate();await tick();f.flow[action]();d.resolve();await running;assert.deepEqual(f.calls,[["bundle",f.entry.id]]);assert.equal(f.flow.state.status.state,"row-disabled");assert.equal(f.flow.state.phase,"partial");assert.match(f.flow.state.message,/没有被取消/)
})
test("leave during pre-mutation inventory check revokes consent",async()=>{
 const f=fixture(),d=deferred(),read=f.manager.listBundles;await f.flow.reviewActivate();f.manager.listBundles=async()=>{await d.promise;return read()};const running=f.flow.confirmActivate();await tick();f.flow.leave();d.resolve();await running;assert.deepEqual(f.calls,[]);assert.equal(f.flow.state.phase,"error")
})
test("wrong rows or changed bundle identity after enable never enable another component",async()=>{
 for(const change of [f=>f.bundle.rows.push({...f.bundle.rows[0]}),f=>f.bundle.meta.description="different content"]){const f=fixture(),b=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{const result=await b(id);change(f);return result};await activate(f);assert.equal(f.calls.length,1);assert.ok(f.flow.activation);assert.equal(f.flow.state.phase,"unconfirmed")}
})
test("enabled but pending row is not enabled again and never claimed loaded",async()=>{
 const f=fixture(),b=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{const result=await b(id);f.row.enabled=true;f.row.fiberPhase="loading";return result};await activate(f);assert.equal(f.calls.length,1);assert.equal(f.flow.state.phase,"partial");assert.equal(f.flow.state.status.state,"restart-or-pending")
})
const flatten=n=>!n||typeof n!=="object"?[]:[n,...n.children.flatMap(flatten)]
test("activation decline has truthful copy, revokes consent and mutates neither bundle nor row",async()=>{
 const f=fixture(),before=structuredClone({bundle:f.bundle,row:f.row}),React={createElement:(type,props,...children)=>typeof type==="function"?type({...props,children}):({type,props:props||{},children}),useSyncExternalStore:(_,get)=>get(),useState:v=>[v,()=>{}],useEffect:()=>{}}
 await f.flow.reviewActivate();const nodes=flatten(createMarketViews(React).Detail({item:f.item,flow:f.flow,onBack:()=>{},onDetails:()=>{}}))
 assert.equal(nodes.filter(n=>n.type==="button"&&n.children.includes("拒绝／不安装")).length,0)
 await nodes.find(n=>n.type==="button"&&n.children.includes("拒绝／不启用")).props.onClick()
 assert.equal(f.flow.state.phase,"declined");assert.equal(f.flow.state.message,"未授权启用；不会重试。");assert.equal(f.flow.state.review,null)
 await assert.rejects(f.flow.confirmActivate(),/缺少启用确认/);assert.deepEqual(f.calls,[]);assert.deepEqual({bundle:f.bundle,row:f.row},before)
})
test("detail has one explicit compound confirmation, no instruction body, and unmount revokes in-flight authority",async()=>{
 const f=fixture(),cleanups=[],React={createElement:(type,props,...children)=>typeof type==="function"?type({...props,children}):({type,props:props||{},children}),useSyncExternalStore:(_,get)=>get(),useState:v=>[v,()=>{}],useEffect:fn=>cleanups.push(fn())}
 const render=()=>flatten(createMarketViews(React).Detail({item:f.item,flow:f.flow,onBack:()=>{},onDetails:()=>{}}))
 await f.flow.status();let nodes=render();assert.equal(nodes.filter(n=>n.type==="button"&&n.children.includes("查看启用确认")).length,1)
 await f.flow.reviewActivate();nodes=render();const text=nodes.flatMap(n=>n.children.filter(c=>typeof c==="string")).join(" ");for(const part of ["唯一组件",f.entry.id,"profile", "应用用户权限"] )assert.ok(text.includes(part));assert.doesNotMatch(text,/Skill正文|name: qcu-lesson-planning/);assert.equal(nodes.filter(n=>n.type==="button"&&n.children.includes("确认启用")).length,1)
 const d=deferred(),b=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{await d.promise;return b(id)};const running=f.flow.confirmActivate();await tick();cleanups.forEach(fn=>fn?.());d.resolve();await running;assert.equal(f.calls.length,1);assert.equal(f.flow.state.phase,"partial")
})

for(const application of ['failed','overridden','restart-required','unknown'])test(`row ${application} preserves partial outcome without retry`,async()=>{
 const f=fixture({enabled:true});f.manager.setPluginEnabled=async id=>{f.calls.push(['row',id]);f.row.fiberPhase='failed';return ok({application,stage:'enable',target:id,enabled:true})};await activate(f);assert.equal(f.calls.length,1);assert.equal(f.flow.state.status.state,'failed');assert.equal(f.flow.state.result.application,application)
})
for(const change of [f=>f.remote.pluginManager={...f.manager},f=>f.setTime(300001),f=>f.remote.qcuMarket.status=async()=>ok(JSON.stringify({...marketRuntime,version:'changed'}))])test('changed authority or Host after bundle result prevents second mutation',async()=>{
 const f=fixture(),b=f.manager.setBundleEnabled;f.manager.setBundleEnabled=async id=>{const result=await b(id);change(f);return result};await activate(f);assert.equal(f.calls.length,1);assert.notEqual(f.flow.state.phase,'idle')
})
test('inventory change during pre-row Host check is rejected before row mutation',async()=>{
 const f=fixture();let checks=0;const host=f.remote.qcuMarket.status;f.remote.qcuMarket.status=async()=>{if(++checks===4)f.row.meta.description='changed during Host check';return host()};await activate(f);assert.equal(f.calls.length,1);assert.notEqual(f.flow.state.phase,'idle')
})
