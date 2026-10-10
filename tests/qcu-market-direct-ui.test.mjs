import test from 'node:test'
import assert from 'node:assert/strict'
import {createLoopPlugin} from '../hub/plugins/qcu-market/src/loop-plugin.mjs'
import {release} from '../hub/plugins/qcu-market/src/trusted-release.mjs'
const ok=value=>({ok:true,value}),tick=()=>new Promise(r=>setImmediate(r))
const flatten=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flatten)]
async function renderFixture(){
 const cleanups=[],effects=[],registrations=[];let installs=0,bundles=[]
 const React={createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props:props||{},children}),useSyncExternalStore:(_,get)=>get(),useState:v=>[v,()=>{}],useEffect:fn=>cleanups.push(fn())}
 const receipt={id:'12345678-1234-1234-1234-123456789012',path:'/cache/'+release.file,entry:release,expiresAt:Date.now()+100000}
 const remote={$mount:async()=>()=>{},$on:()=>()=>{},qcuMarket:{prepare:async id=>{receipt.id=id;return ok(JSON.stringify(receipt))},verify:async()=>ok(JSON.stringify(receipt)),cancel:async()=>ok('{}')},pluginManager:{listBundles:async()=>ok(bundles),inspect:async()=>ok({status:'accepted',kind:'tarball',bundle:null,registry:null}),installBundle:async(path,options)=>{installs++;assert.equal(options.enabled,false);bundles=[{name:release.id,version:release.version,installed:true,enabled:false}];return ok({application:'applied',stage:'install',bundle:release.id})}}}
 const ctx={remote,inject:(_,fn)=>{const done=Promise.resolve(fn(ctx));done.dispose=async()=>{};return done},effect:fn=>effects.push(fn()),on:()=>()=>{},layout:{selectPanel(){}},slots:{inject:(_,fn)=>fn(),register:(options,component)=>{registrations.push({options,component});return()=>{}}}}
 await createLoopPlugin(React).apply(ctx);await tick();const main=registrations.find(r=>r.options.name==='main'),props=main.options.inject()
 return {tree:()=>flatten(main.component(props)),flow:props.availability.snapshot().flow,installs:()=>installs,cleanups}
}
test('confirmation component shows identity/hash/permissions before confirm, decline mutates nothing',async()=>{
 const f=await renderFixture();await f.flow.prepare();let nodes=f.tree();const text=nodes.flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ')
 for(const fragment of [release.id,release.version,release.sha256,release.origin,'不受工作区沙箱','registry','enabled=false'])assert.ok(text.includes(fragment),fragment)
 assert.equal(f.installs(),0);nodes.find(n=>n.type==='button'&&n.children.includes('拒绝／不安装')).props.onClick();await tick();assert.equal(f.installs(),0);assert.equal(f.flow.state.phase,'declined');f.flow.dispose()
})
test('confirmation button double click performs one disabled installation; panel cleanup invalidates pending review',async()=>{
 const f=await renderFixture();await f.flow.prepare();const button=f.tree().find(n=>n.type==='button'&&n.children.includes('确认安装（保持未启用）'));button.props.onClick();button.props.onClick();await tick();await tick();assert.equal(f.installs(),1);assert.equal(f.flow.state.status.state,'installed-disabled');f.flow.dispose()
 const g=await renderFixture();await g.flow.prepare();g.tree();for(const cleanup of g.cleanups)cleanup?.();await tick();assert.equal(g.installs(),0);assert.notEqual(g.flow.state.phase,'review');g.flow.dispose()
})
