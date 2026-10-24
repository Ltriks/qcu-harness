// Fixed reviewed archive and metadata integration only; never executes CLI/auth/docs.
import {realpathSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {bundledCatalog,catalogText,catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {parseMarketCatalog,releaseKeyOf} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {validateRelease,fetchPinned,PackagePreparation} from '../hub/plugins/qcu-market/src/host-core.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {createMarketViews} from '../hub/plugins/qcu-market/src/market-view.mjs'
const item=bundledCatalog.entries.find(e=>e.id==='qcu-feishu-readonly'),release=item.release
const clone=()=>JSON.parse(catalogText),tools=c=>c.entries.find(e=>e.id===item.id)
test('paired reviewed schema4/protocol4 and strict frozen capabilities preserve all seven old releases',async()=>{
 assert.equal(bundledCatalog.schemaVersion,4);assert.equal(bundledCatalog.protocol,4);assert.equal(bundledCatalog.revision,6)
 assert.equal(marketRuntime.version,'0.1.0-pilot.15.2');assert.equal(marketRuntime.protocol,6);assert.equal(marketRuntime.catalogSha256,catalogSha256)
 const read=async path=>JSON.parse(await readFile(path,'utf8'))
 for(const old of [await read('hub/market/coach-release.json'),...await read('hub/market/skill-releases.json'),await read('hub/market/external-skill-release.json')]){
  const entry=bundledCatalog.entries.find(e=>e.id===old.id);assert.deepEqual(entry.release,old);assert.deepEqual(entry.capabilities,['skill'])
 }
 assert.deepEqual(item.capabilities,['tools']);assert.equal(item.kind,'bundle')
 for(const k of ['skill','skillSha256','provider'])assert.equal(release[k],null)
 assert.throws(()=>item.capabilities.push('skill'));assert.throws(()=>item.capabilities[0]='skill')
 assert.equal(item.provenance.pinnedRevision,'cc54be21d20b37491ea32805b6d58ac36048f1f8')
 assert.doesNotMatch(item.example,/\/qcu-feishu-readonly/)
})
for(const [label,mutate] of Object.entries({
 missing:i=>delete i.capabilities,empty:i=>i.capabilities=[],unknown:i=>i.capabilities=['commands'],mixed:i=>i.capabilities=['skill','tools'],duplicate:i=>i.capabilities=['tools','tools'],wrongKind:i=>i.kind='skill',object:i=>i.capabilities={tools:true},
 fakeSkill:i=>i.release.skill=i.id,fakeHash:i=>i.release.skillSha256='0'.repeat(64),fakeProvider:i=>i.release.provider=i.id+'@'+i.release.version,
 allFake:i=>Object.assign(i.release,{skill:i.id,skillSha256:'0'.repeat(64),provider:i.id+'@'+i.release.version}),license:i=>i.release.license='Apache-2.0',ownership:i=>i.provenance.ownership='third-party',url:i=>i.release.origin+='?download=1',script:i=>i.release.scripts={},
}))test(`tools capability contract refuses ${label}`,()=>{const c=clone();mutate(tools(c));assert.throws(()=>parseMarketCatalog(JSON.stringify(c)))})
for(const mask of [1,2,3,4,5,6,7])test(`Skill contract refuses null field combination ${mask}`,()=>{
 const c=clone();['skill','skillSha256','provider'].forEach((k,index)=>{if(mask&(1<<index))c.entries[0].release[k]=null});assert.throws(()=>parseMarketCatalog(JSON.stringify(c)))
})
test('Host refuses tools field tampering before cache writes or network and downloads actual reviewed archive',async t=>{
 const archive=process.env.QCU_FEISHU_ARCHIVE;assert.ok(archive,'QCU_FEISHU_ARCHIVE must be the fixed reviewed candidate')
 const bytes=await readFile(archive);assert.equal(bytes.length,11263);assert.equal(createHash('sha256').update(bytes).digest('hex'),release.sha256)
 const dir=await mkdtemp(join(realpathSync(tmpdir()),'qcu-tools-download-'));t.after(()=>rm(dir,{recursive:true,force:true}));const root=join(dir,'cache');let requests=0
 const fetcher=async(url,options)=>{requests++;assert.equal(url,release.origin+'/plugins/'+release.file);assert.equal(options.redirect,'manual');return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}
 for(const k of ['skill','skillSha256','provider'])await assert.rejects(fetchPinned({entry:{...release,[k]:'fake'},root,fetcher}))
 assert.equal(requests,0);assert.deepEqual(await readdir(dir),[])
 const path=await fetchPinned({entry:release,root,fetcher});assert.deepEqual(await readFile(path),bytes);assert.equal(await fetchPinned({entry:release,root,fetcher}),path);assert.equal(requests,1)
 const p=new PackagePreparation({authority:null,download:async()=>path}),id=crypto.randomUUID(),key=releaseKeyOf(release)
 const receipt=JSON.parse(await p.prepare(id,key));assert.equal(receipt.catalogSha256,catalogSha256);assert.deepEqual(receipt.entry,release);await p.verify(id);p.cancel(id);await assert.rejects(p.verify(id));p.dispose()
 assert.equal(validateRelease(release),release.origin+'/plugins/'+release.file)
})
test('actual Feishu1.1 eight archive members equal untouched reviewed source; two tools, empty config, official peers and no Skill',()=>{
 const archive=process.env.QCU_FEISHU_ARCHIVE;assert.ok(archive)
 const code=`import json,tarfile,pathlib,hashlib
p=pathlib.Path(${JSON.stringify(archive)})
m=json.loads(pathlib.Path(str(p)+'.json').read_text())
assert m['releaseStatus']=='standalone-local-candidate-not-published'
with tarfile.open(p) as t:
 assert len(t.getmembers())==8
 for e in t.getmembers():
  assert e.isfile() and not e.issym()
  name=e.name.removeprefix('package/');data=t.extractfile(e).read()
  assert data==pathlib.Path('hub/plugins/qcu-feishu-readonly',name).read_bytes()
  assert hashlib.sha256(data).hexdigest()==m['members'][name]
 print(json.dumps({e.name.removeprefix('package/'):t.extractfile(e).read().decode() for e in t.getmembers()}))`
 const files=JSON.parse(execFileSync('rtk',['proxy',process.env.QCU_PYTHON||'python3.11','-c',code],{encoding:'utf8'}))
 assert.deepEqual(Object.keys(files).sort(),['LICENSE','NOTICE','README.md','cordis.patch.yml','index.js','package.json','src/authority.mjs','src/core.mjs'].sort())
 const pkg=JSON.parse(files['package.json']);assert.equal(pkg.name,release.id);assert.equal(pkg.version,release.version);assert.equal(pkg.license,'MIT')
 assert.deepEqual(pkg.peerDependencies,{'@deepseek-ai/cordis':'4.0.4','@deepseek-ai/cosmokit':'1.8.5','@deepseek-ai/dsh-tools':'0.2.0-rc.2','@deepseek-ai/schemastery':'3.18.4'})
 for(const k of ['scripts','dependencies','optionalDependencies','bundledDependencies'])assert.equal(pkg[k],undefined)
 assert.deepEqual(JSON.parse(files['cordis.patch.yml']),[{insert:[{id:release.id,name:release.id,disabled:true,config:{enabled:true,cliPath:'',documentUrl:''}}]}])
 assert.match(files['index.js'],/qcu_feishu_outline/);assert.match(files['index.js'],/qcu_feishu_section/);assert.doesNotMatch(files['index.js'],/registerProvider|ctx\.skills|dsh-skill/)
})
const flatten=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flatten)]
const React={createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props:props||{},children}),useSyncExternalStore:(_,get)=>get(),useState:v=>[v,()=>{}],useEffect:()=>{}}
test('tool-only view never claims Skill readiness and keeps install and activation consent independent',async()=>{
 const {flows,calls}=createPreviewFixture(),flow=flows.find(f=>f.entry.id===release.id)
 try{
  const render=()=>flatten(createMarketViews(React).Detail({item,flow,onBack(){},onDetails(){}}))
  let nodes=render(),text=()=>nodes.flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ')
  assert.deepEqual(calls,[]);for(const value of ['qcu_feishu_outline','qcu_feishu_section','官方插件设置','基础链接','开发机授权不会转移','cc54be21'])assert.ok(text().includes(value),value)
  assert.doesNotMatch(text(),/启用并确认技能可用后|技能发现|只注册静态说明/)
  assert.doesNotMatch(nodes.find(n=>n.type==='textarea').props.value,/\/qcu-feishu-readonly/)
  assert.ok(nodes.some(n=>n.type==='button'&&n.children.includes('复制工具请求示例')))
  await flow.prepare();nodes=render();assert.doesNotMatch(text(),/提供方仅在明确启用后校验并注册静态说明/)
  await flow.confirmInstall();assert.equal(flow.state.status.state,'installed-disabled')
  await flow.reviewActivate();assert.equal(flow.state.review.kind,'activate');assert.equal(calls.filter(c=>c.name==='setBundleEnabled'||c.name==='setPluginEnabled').length,0)
  await flow.confirmActivate();nodes=render();assert.ok(text().includes('加载状态不证明已配置、已授权或可读'))
  assert.deepEqual(calls.filter(c=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(c.name)).map(c=>c.name),['installBundle','setBundleEnabled','setPluginEnabled'])
  for(const peer of flows.filter(f=>f!==flow))assert.equal(peer.state.phase,'idle')
 }finally{flows.forEach(f=>f.dispose())}
})
for(const protocol of [5,7])test(`stale protocol ${protocol} stops tools preparation before download or inspection`,async()=>{
 const {flows,remote,calls}=createPreviewFixture(),flow=flows.find(f=>f.entry.id===release.id)
 remote.qcuMarket.status=async()=>({ok:true,value:JSON.stringify({...marketRuntime,protocol})})
 try{await flow.prepare();assert.equal(flow.state.phase,'error');assert.match(flow.state.message,/正常重启/);assert.deepEqual(calls,[])}finally{flows.forEach(f=>f.dispose())}
})
