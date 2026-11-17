import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
const source=await readFile('hub/plugins/qcu-market/client.js','utf8')
function load(React={}){
 let definition
 vm.runInNewContext(source.replace('return createLoopPlugin(React);','return {CatalogRuntime,marketRuntime,createMarketViews};'),{window:{__ModuleLoader__:{load:v=>{definition=v}}},TextEncoder,AbortController,crypto,setTimeout,clearTimeout})
 return definition.factory(()=>React)
}
const tick=()=>new Promise(r=>setImmediate(r))
function setup(refresh){
 const {CatalogRuntime,marketRuntime}=load(),patches=[]
 const remote={qcuMarket:{status:async()=>({ok:true,value:JSON.stringify(marketRuntime)}),refresh:async()=>({ok:true,value:await refresh()})}}
 const runtime=new CatalogRuntime(remote,p=>patches.push(p))
 runtime.updates={locked:()=>false,guardJournal:async()=>{},invalidate(){},dispose(){}}
 return {runtime,patches}
}
const catalog=()=>JSON.stringify({mode:'dynamic',state:'fresh',catalog:{entries:[]},fingerprint:'fixture',message:'verified'})
test('entering market requests catalog without pressing refresh; late service availability also triggers it',()=>{
 let calls=0,ready={catalog:{entries:[]},refresh:null,unavailable:'service pending'};const effects=[]
 const React={createElement:(type,props,...children)=>({type,props,children}),Fragment:'fragment',useSyncExternalStore:()=>ready,useEffect:fn=>effects.push(fn),useState:v=>[v,()=>{}],useRef:v=>({current:v})}
 const {MarketPage}=load(React).createMarketViews(React)
 const render=()=>{effects.length=0;const tree=MarketPage({availability:{}});effects.forEach(fn=>fn());return tree}
 render();assert.equal(calls,0)
 ready={...ready,refresh:()=>calls++,unavailable:''};render();assert.equal(calls,1)
 ready={...ready,refreshing:true};const tree=render();assert.equal(calls,1);assert.match(JSON.stringify(tree),/正在加载工具市场/);assert.doesNotMatch(JSON.stringify(tree),/暂无可安装的技能/)
 ready={...ready,refreshing:false,unavailable:'network unavailable'};assert.match(JSON.stringify(render()),/工具市场暂未加载成功/)
})
test('connection reset refreshes catalog automatically',async()=>{
 let calls=0;const {runtime,patches}=setup(async()=>{calls++;return catalog()})
 runtime.reset();for(let i=0;i<6;i++)await tick()
 assert.equal(calls,1);assert.equal(patches.at(-1).refreshing,false);assert.equal(patches.find(p=>p.authority)?.authority.state,'fresh');runtime.dispose()
})
test('reset during an outstanding read discards old response and reloads once',async()=>{
 let release,calls=0;const {runtime,patches}=setup(()=>{calls++;return calls===1?new Promise(r=>release=r):catalog()})
 const pending=runtime.refresh();for(let i=0;i<4;i++)await tick();runtime.reset();release(catalog());await pending;for(let i=0;i<6;i++)await tick()
 assert.equal(calls,2);assert.equal(patches.filter(p=>p.authority).length,1);assert.equal(runtime.refreshing,false);runtime.dispose()
})
test('failed automatic read stops and leaves a retryable error, with no infinite requests',async()=>{
 let calls=0;const {runtime,patches}=setup(async()=>{calls++;throw Error('offline')})
 runtime.reset();for(let i=0;i<6;i++)await tick();assert.equal(calls,1);assert.equal(runtime.refreshing,false);assert.equal(patches.find(p=>p.unavailable==='offline')?.unavailable,'offline')
 await runtime.refresh();assert.equal(calls,2);runtime.dispose()
})
test('reset followed by disposal cannot restart a read',async()=>{
 let release,calls=0;const {runtime}=setup(()=>{calls++;return new Promise(r=>release=r)})
 const pending=runtime.refresh();for(let i=0;i<4;i++)await tick();runtime.reset();runtime.dispose();release(catalog());await pending;await tick();assert.equal(calls,1)
})
