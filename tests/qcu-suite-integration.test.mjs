// Frozen real release inputs; ephemeral signing keys and disposable state only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,rm,readdir,cp} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {once} from 'node:events'
import {generateKeyPairSync,sign,createHash} from 'node:crypto'
import {updatePolicy,legacyUpdatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {MarketUpdates,verifyUpdateEnvelope} from '../hub/plugins/qcu-market/src/update-host.mjs'
import {parseUpdatePayload} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {readUpdateArchive,inspectUpdateArchive,archiveFingerprint} from '../hub/plugins/qcu-market/src/update-archive.mjs'
import {bundledCatalog} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {parseMarketCatalog} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {productLabelOf} from '../hub/plugins/qcu-market/src/version-model.mjs'
import {prepareMarketUpdates} from '../scripts/publish-market-updates.mjs'
import {createTeacherViews} from '../tools/teacher-branding/src/view.mjs'
const out=resolve(process.env.QCU_SUITE_OUT??'.work/suite-integration-b'),marketDir=resolve(process.env.QCU_SUITE_MARKET_DIR??join(out,'market-final-a')),expertRoot='/Users/mcq/Artifacts/qcu-harness/0.2.0-expert-library.2',oldDir='/Users/mcq/Artifacts/qcu-harness/0.1.0-pilot.15.1/deployment-20261023/static-snapshot/plugins'
const oldFile=(await readdir(oldDir)).find(f=>f.startsWith('qcu-market-0.1.0-pilot.15.1-'))
const oldMembers=readUpdateArchive(await readFile(join(oldDir,oldFile)))
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const {updatePolicy:oldPolicy}=await load(oldMembers.get('src/update-policy.mjs'))
const {parseUpdatePayload:oldParse}=await load(oldMembers.get('src/update-model.mjs'))
const {parseMarketCatalog:oldCatalogParse}=await load(oldMembers.get('src/catalog-core.mjs'))
const expert=bundledCatalog.entries.find(e=>e.id==='qcu-expert-teams'),hash=b=>createHash('sha256').update(b).digest('hex')
await mkdir(out,{recursive:true})
async function temp(t){const dir=await mkdtemp('/private/tmp/qcu-suite-');t.after(()=>rm(dir,{recursive:true,force:true}));return dir}
const keys=generateKeyPairSync('ed25519'),policy={...updatePolicy,publicKey:keys.publicKey.export({type:'spki',format:'pem'})},now=Date.now()
let prepared
async function feeds(t){
 const dir=await temp(t),archives=join(dir,'archives');await mkdir(archives)
 const manifest=JSON.parse(await readFile(join(marketDir,'MANIFEST.json'),'utf8')),catalog={plugins:[]}
 for(const [path,e] of [[join(marketDir,manifest.file),{...manifest,id:'qcu-market'}],[join(expertRoot,'release',expert.release.file),expert.release]]){
  await cp(path,join(archives,e.file));catalog.plugins.push({id:e.id,version:e.version,file:e.file,bytes:e.bytes,sha256:e.sha256,dshVersions:['0.2.0-rc.2'],summary:'Local integration candidate; native/model/production untested.'})
 }
 const catalogPath=join(dir,'catalog.json');await writeFile(catalogPath,JSON.stringify(catalog))
 const job={catalog:catalogPath,archives,revision:7,issuedAt:new Date(now-1000).toISOString(),projections:['legacy','v2']}
 const review=await prepareMarketUpdates(job,keys.privateKey,join(dir,'feeds'),policy)
 const legacy=JSON.parse(await readFile(join(dir,'feeds/updates.json'),'utf8')),v2=JSON.parse(await readFile(join(dir,'feeds/updates-v2.json'),'utf8'))
 return {dir,job,review,legacy,v2}
}
test('frozen expert package and every source member remain byte-identical',async()=>{
 const raw=await readFile(join(expertRoot,'release',expert.release.file));assert.equal(raw.length,57940);assert.equal(hash(raw),expert.release.sha256)
 const manifest=JSON.parse(await readFile(join(expertRoot,'release/MANIFEST.json'),'utf8')),members=readUpdateArchive(raw)
 for(const f of manifest.files){const path=f.path.slice(8),source=await readFile('hub/plugins/qcu-expert-teams/'+path);assert.equal(hash(source),f.sha256,path);assert.deepEqual(source,members.get(path))}
 assert.equal(manifest.files.length,15)
 const pkg=JSON.parse(members.get('package.json'));assert.deepEqual(updatePolicy.products[expert.id].peers,pkg.peerDependencies)
 assert.deepEqual(legacyUpdatePolicy,oldPolicy);assert.equal(updatePolicy.publicKey,oldPolicy.publicKey)
 assert.equal(Object.keys(updatePolicy.products).length,11)
})
test('frozen P15.1 catalog parser accepts expert legacy wire category; other entries stay unchanged',()=>{
 const parsed=oldCatalogParse(JSON.stringify(bundledCatalog));assert.deepEqual(parsed.entries.find(e=>e.id===expert.id).capabilities,['tools'])
 const frozenCatalog=oldMembers.get('src/bundled-catalog.mjs').toString().match(/export const catalogText=(.*)\n/)[1]
 assert.deepEqual(bundledCatalog.entries.filter(e=>![expert.id,'qcu-course-workbench'].includes(e.id)),JSON.parse(JSON.parse(frozenCatalog)).entries.filter(e=>e.id!=='qcu-course-workbench'))
 assert.equal(productLabelOf(expert),'专家协作插件');assert.match(expert.purpose,/专家协作插件/);assert.match(expert.risk,/不注册 DSH 工具或 Skill/)
 for(const parser of [parseMarketCatalog,oldCatalogParse])for(const field of ['skill','provider','skillSha256']){
  const c=structuredClone(bundledCatalog);c.entries.find(e=>e.id===expert.id).release[field]=field==='skillSha256'?'a'.repeat(64):'claimed';assert.throws(()=>parser(JSON.stringify(c)))
 }
 const c=structuredClone(bundledCatalog);c.entries.find(e=>e.id===expert.id).capabilities=['expert'];assert.throws(()=>oldCatalogParse(JSON.stringify(c)))
})
test('explicit two-feed preparation: actual market15.2 is old-client compatible, expert only in v2',async t=>{
 const f=await feeds(t),oldTest={...oldPolicy,publicKey:policy.publicKey}
 const old=oldParse(f.legacy.payload,oldTest,now);verifyUpdateEnvelope(f.legacy,oldTest,now)
 assert.deepEqual(old.entries.map(e=>e.id),['qcu-market']);assert.equal(old.entries[0].version,'0.1.0-pilot.15.2')
 assert.throws(()=>oldParse(f.v2.payload,oldTest,now),/通道/)
 const modern=verifyUpdateEnvelope(f.v2,policy,now);assert.deepEqual(modern.entries.map(e=>e.id),['qcu-market','qcu-expert-teams'])
 for(const entry of modern.entries){const raw=await readFile(join(f.job.archives,entry.file));assert.equal(inspectUpdateArchive(raw,entry).components,1)}
 const bad=structuredClone(modern);delete bad.entries[1].peers['@deepseek-ai/dsh-skill'];assert.throws(()=>parseUpdatePayload(JSON.stringify(bad),policy,now),/依赖/)
 bad.entries[1].peers={...modern.entries[1].peers,unreviewed:'1.0.0'};assert.throws(()=>parseUpdatePayload(JSON.stringify(bad),policy,now),/依赖/)
 const sourceCatalog=JSON.parse(await readFile(f.job.catalog));sourceCatalog.plugins.push({id:'qcu-synthetic-unadmitted',version:'0.0.1-test.1',synthetic:true});await writeFile(f.job.catalog,JSON.stringify(sourceCatalog))
 for(const projection of ['legacy','v2']){const single=await prepareMarketUpdates({...f.job,projections:[projection]},keys.privateKey,join(f.dir,projection),policy);assert.equal(single.feeds.length,1);assert.ok(single.feeds[0].omissions.some(o=>o.id==='qcu-synthetic-unadmitted'&&/no update admission/.test(o.reason)))}
 await writeFile(join(out,'compatibility-proof.json'),JSON.stringify({oldArchive:oldFile,oldPolicyProducts:Object.keys(oldPolicy.products).length,oldCatalogParserAccepted:true,legacyMarketVersion:old.entries[0].version,legacyExpertOmitted:true,v2ExpertAdmitted:true,review:f.review,ephemeralKeyOnly:true},null,2))
 prepared={legacy:f.legacy,v2:f.v2}
})
test('offline preparation requires explicit projection, rejects unknown products and wrong signing keys',async t=>{
 const f=await feeds(t)
 await assert.rejects(prepareMarketUpdates({...f.job,projections:undefined},keys.privateKey,join(f.dir,'missing'),policy),/projections/)
 await assert.rejects(prepareMarketUpdates(f.job,generateKeyPairSync('ed25519').privateKey,join(f.dir,'key'),policy),/key/)
 const catalog=JSON.parse(await readFile(f.job.catalog));catalog.plugins.push({...catalog.plugins[0],id:'qcu-unknown'});await writeFile(f.job.catalog,JSON.stringify(catalog))
 await assert.rejects(prepareMarketUpdates(f.job,keys.privateKey,join(f.dir,'unknown'),policy),/separate policy review/)
})
test('manifest-pinned legacy/v2 routes serve exact signed bytes, no-store JSON and deny writes/private/query paths',async t=>{
 const dir=await temp(t),snapshot=join(dir,'snapshot');await mkdir(snapshot)
 const files={'catalog.json':JSON.stringify({schemaVersion:1,audience:'lan-private',publicRelease:false,skills:[],plugins:[]}),'index.html':'test site','themes.html':'test themes','updates.json':JSON.stringify(prepared.legacy),'updates-v2.json':JSON.stringify(prepared.v2)}
 for(const [name,bytes] of Object.entries(files))await writeFile(join(snapshot,name),bytes)
 const manifest={schemaVersion:1,files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,{bytes:Buffer.byteLength(bytes),sha256:hash(Buffer.from(bytes))}]))},raw=JSON.stringify(manifest),pin=hash(Buffer.from(raw));await writeFile(join(snapshot,'manifest.json'),raw)
 const code="import importlib.util,sys; s=importlib.util.spec_from_file_location('hub',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); resources=m.load_snapshot(sys.argv[2],sys.argv[3]); server=m.make_server(resources); print(server.server_port,flush=True); server.serve_forever()"
 const child=spawn('python3',['-c',code,resolve('hub/release/serve-hub.py'),snapshot,pin],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
 let log='';child.stderr.on('data',b=>log+=b)
 try{
  const port=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('snapshot server timeout '+log)),10000);child.stdout.once('data',b=>{clearTimeout(timer);r(Number(b.toString().trim()))});child.once('exit',c=>{clearTimeout(timer);j(Error('snapshot server exit '+c+log))})}),origin='http://127.0.0.1:'+port
  for(const name of ['updates.json','updates-v2.json']){
   const response=await fetch(origin+'/'+name);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/json/);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),files[name])
   const head=await fetch(origin+'/'+name,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'')
   for(const method of ['POST','PUT','DELETE','PATCH','OPTIONS'])assert.equal((await fetch(origin+'/'+name,{method})).status,405)
  }
  for(const path of ['/updates-v2.json?query=1','/updates-review.json','/serve-hub.py','/private/signing/key.pem'])assert.equal((await fetch(origin+path)).status,404)
 }finally{if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit')}}
 await writeFile(join(snapshot,'updates-v2.json'),'changed')
 await assert.rejects(promisify(execFile)('python3',['hub/release/serve-hub.py','--root',snapshot,'--manifest-sha256',pin],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}),/file-integrity-mismatch/)
 await writeFile(join(out,'feed-route-proof.json'),JSON.stringify({manifestPin:pin,feeds:['updates.json','updates-v2.json'],exactBytes:true,noStore:true,json:true,head:true,writesDenied:true,privateAndQueryDenied:true,tamperedSnapshotRejected:true,temporaryServerStopped:true},null,2))
})
test('actual expert .1 to .2 archive preparation preserves source fingerprint, cancel and configuration consent checks',async t=>{
 const dir=await temp(t),id=expert.id,profile=join(dir,'profile'),local=join(profile,'node_modules',id);await mkdir(local,{recursive:true})
 const previousRoot='/Users/mcq/Artifacts/qcu-harness/0.2.0-expert-library.1',previousFile=(await readdir(previousRoot)).find(n=>n.endsWith('.tgz')),previous=await readFile(join(previousRoot,previousFile)),current=await readFile(join(expertRoot,'release',expert.release.file))
 for(const [name,bytes] of readUpdateArchive(previous)){await mkdir(join(local,name,'..'),{recursive:true});await writeFile(join(local,name),bytes)}
 await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{[id]:'file:'+previousFile}}));await writeFile(join(profile,'cordis.patch.yml'),'[]')
 const entry=(bytes,version)=>({id,version,file:id+'-'+version+'-'+hash(bytes)+'.tgz',sha256:hash(bytes),bytes:bytes.length,runtime:'0.2.0-rc.2',capability:'tools',changes:'Frozen expert local integration candidate',upgradePolicy:'preserve-config-no-migration',withdrawn:false,files:archiveFingerprint(bytes),peers:JSON.parse(readUpdateArchive(bytes).get('package.json')).peerDependencies})
 const entries=[entry(previous,'0.2.0-pilot.1'),entry(current,'0.2.0-pilot.2')],payload=JSON.stringify({schemaVersion:1,channel:'pilot-experts',revision:9,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),entries}),feed={payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64')},calls=[]
 const host=new MarketUpdates({profileDir:profile,root:join(dir,'cache'),policy,now:()=>now,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(url);const b=url.endsWith('/updates-v2.json')?Buffer.from(JSON.stringify(feed)):current;return new Response(b,{headers:{'content-length':String(b.length)}})}});t.after(()=>host.dispose())
 const check=JSON.parse(await host.check()),target=check.items.find(e=>e.id===id);assert.equal(target.sourceVerified,true);assert.equal(target.state,'available');assert.equal(calls.length,1)
 const receipt=JSON.parse(await host.prepare(crypto.randomUUID(),target.target.key));assert.equal(calls.length,2);assert.equal(inspectUpdateArchive(current,entries[1]).components,1);await host.verify(receipt.id);host.cancel(receipt.id);await assert.rejects(host.verify(receipt.id),/过期/)
 const next=JSON.parse(await host.prepare(crypto.randomUUID(),target.target.key));await writeFile(join(profile,'cordis.patch.yml'),'[{"config":"changed"}]');await assert.rejects(host.verify(next.id),/配置变化/)
 for(const patch of [{bytes:current.length+1},{sha256:'0'.repeat(64)},{peers:{}}])assert.throws(()=>inspectUpdateArchive(current,{...entries[1],...patch}))
 const corrupt=Buffer.from(current);corrupt[20]^=1;assert.throws(()=>inspectUpdateArchive(corrupt,entries[1]))
})
const envelope=(base,mutate)=>{const value=JSON.parse(base.payload);mutate(value);const payload=JSON.stringify(value);return {payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64')}}
async function hostFixture(t,mode='v2'){
 const dir=await temp(t),calls=[];let current=mode
 const bytes=value=>{const b=Buffer.from(JSON.stringify(value));return new Response(b,{headers:{'content-length':String(b.length)}})}
 const fetcher=async(url,{signal})=>{
  calls.push(url);signal.throwIfAborted()
  if(url.endsWith('/updates.json'))return bytes(prepared.legacy)
  if(current==='404')return new Response(null,{status:404})
  if(current==='redirect404')return {status:404,redirected:true,url,headers:new Headers(),body:null}
  if(current==='wrong-url404')return {status:404,redirected:false,url:url+'/',headers:new Headers(),body:null}
  if(current==='500')return new Response(null,{status:500})
  if(current==='timeout')throw new DOMException('test timeout','TimeoutError')
  if(current==='cancel'){host.cancel();return new Response(null,{status:404})}
  if(current==='json')return bytes('not an envelope')
  if(current==='signature')return bytes({...prepared.v2,signature:'A'.repeat(86)+'=='})
  if(current==='expired')return bytes(envelope(prepared.v2,v=>{v.issuedAt=new Date(now-2*86400000).toISOString();v.expiresAt=new Date(now-86400000).toISOString()}))
  return bytes(prepared.v2)
 }
 const host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,'cache'),policy,fetcher,now:()=>now,runtime:'0.2.0-rc.2'});t.after(()=>host.dispose())
 return {host,calls,setMode:value=>current=value}
}
test('new client migrates legacy state at same revision and falls back only on genuine 404',async t=>{
 const f=await hostFixture(t,'404');await f.host.check();assert.equal(f.calls.length,2);assert.match(f.calls[0],/updates-v2.json$/);assert.match(f.calls[1],/updates.json$/)
 f.setMode('v2');const r=JSON.parse(await f.host.check());assert.equal(r.revision,7);assert.ok(r.items.some(e=>e.id===expert.id));assert.equal(f.calls.length,3)
 f.setMode('404');await f.host.check();assert.equal(f.calls.length,5)
})
for(const mode of ['redirect404','wrong-url404','500','timeout','cancel','json','signature','expired'])test('no legacy fallback on '+mode,async t=>{
 const f=await hostFixture(t,mode);await assert.rejects(f.host.check());assert.equal(f.calls.length,1);assert.equal(f.host.feed,null);assert.equal(f.host.receipts.size,0)
})
test('both projections retain rollback and same-revision protection; v2 failure cannot trigger legacy retry',async t=>{
 const f=await hostFixture(t);await f.host.check()
 const saved=await f.host.storage.read('state-v2.json');await f.host.storage.write('state-v2.json',{...saved,revision:8})
 await assert.rejects(f.host.check(),/回退/);assert.equal(f.calls.length,2)
 f.setMode('404');await assert.rejects(f.host.check(),/回退/);assert.equal(f.calls.length,4)
 await f.host.storage.write('state-v2.json',{...saved,fingerprint:'0'.repeat(64)});f.setMode('v2');await assert.rejects(f.host.check(),/回退/);assert.equal(f.calls.length,5)
})
test('signed projection substitution reproduced on prior Host, refused before cache write in both directions',async t=>{
 const oldManifest=JSON.parse(await readFile('.work/suite-integration-a/market-final-a/MANIFEST.json','utf8'))
 const members=readUpdateArchive(await readFile(join('.work/suite-integration-a/market-final-a',oldManifest.file)))
 const source=members.get('src/update-host.mjs').toString().replace(/from '(\.\/[^']+)'/g,(_m,p)=>'from '+JSON.stringify(new URL('../hub/plugins/qcu-market/src/'+p.slice(2),import.meta.url).href))
 const {MarketUpdates:PriorHost}=await load(source)
 for(const reverse of [false,true]){
  const dir=await temp(t),calls=[]
  // Before binding, both projections were signed as pilot. Both swaps were accepted.
  const priorFeed=envelope(reverse?prepared.v2:prepared.legacy,v=>v.channel='pilot')
  const fixture=(Host,feed,root)=>new Host({profileDir:join(dir,'profile'),root:join(dir,root),policy,now:()=>now,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(url);if(reverse&&url.endsWith('/updates-v2.json'))return new Response(null,{status:404});const bytes=Buffer.from(JSON.stringify(feed));return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}})
  const before=fixture(PriorHost,priorFeed,'prior');try{await before.check();assert.ok(await before.storage.read(reverse?'state.json':'state-v2.json'))}finally{before.dispose()}
  calls.length=0
  const after=fixture(MarketUpdates,reverse?prepared.v2:prepared.legacy,'bound')
  try{await assert.rejects(after.check(),/通道与请求地址/);assert.equal(calls.length,reverse?2:1);assert.equal(await after.storage.read('state.json'),null);assert.equal(await after.storage.read('state-v2.json'),null);assert.equal(after.feed,null)}finally{after.dispose()}
 }
})
test('v2 parser requires exact expert-capable product policy; course1.3 metadata is local and preserved in history',async()=>{
 for(const mutate of [p=>delete p.products['qcu-expert-teams'],p=>p.products['qcu-expert-teams'].peers.extra='1.0.0',p=>p.products['qcu-expert-teams'].capability='workbench']){
  const changed=structuredClone(policy);mutate(changed);assert.throws(()=>parseUpdatePayload(prepared.v2.payload,changed,now),/通道/)
 }
 const course=bundledCatalog.entries.find(e=>e.id==='qcu-course-workbench'),history=JSON.parse(await readFile('hub/market/version-history.json','utf8'))
 assert.equal(course.release.version,'0.1.0-pilot.1.3');assert.equal(course.release.releaseStatus,'local-candidate-not-published');assert.equal(course.provenance.pinnedRevision,'7e647436f0849be617b360add1cd771d47fa8339')
 assert.deepEqual(history.entries.filter(e=>e.id===course.id).map(e=>e.version),['0.1.0-pilot.1.0','0.1.0-pilot.1.1','0.1.0-pilot.1.2','0.1.0-pilot.1.3'])
})
test('teacher navigation promotes only registered market/expert panels; click only selects panel',()=>{
 const h=(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),React={createElement:h,useSyncExternalStore:(_s,get)=>get()},calls=[]
 const {Sidebar}=createTeacherViews(React,'data:,')
 const render=ids=>Sidebar({ctx:{layout:{panelInfo:{getSnapshot:()=>({activePanelId:'qcu-market'})},selectPanel:id=>calls.push(id)},slots:{subscribe:()=>()=>{},getVersion:()=>1,entriesOfSlot:()=>ids.map(id=>({options:{id,label:id}}))}},collapsed:false,toggleSidebar(){},renderSlot:()=>null})
 const find=(node,predicate)=>node&&typeof node==='object'?[...(predicate(node)?[node]:[]),...node.children.flatMap(c=>find(c,predicate))]:[]
 const tree=render(['qcu-market','qcu-expert-teams','other-maintenance','plugins','qcu-course-workbench']),nav=find(tree,n=>n.props['aria-label']==='主要功能')[0],buttons=find(nav,n=>n.type==='button')
 assert.deepEqual(buttons.filter(n=>['插件市场','专家团'].includes(n.props['aria-label'])).map(n=>n.props['aria-label']),['插件市场','专家团'])
 buttons.find(n=>n.props['aria-label']==='插件市场').props.onClick();buttons.find(n=>n.props['aria-label']==='专家团').props.onClick();assert.deepEqual(calls,['qcu-market','qcu-expert-teams'])
 const maintenance=find(tree,n=>n.props.className==='qcu-maintenance-items')[0];assert.equal(find(maintenance,n=>n.type==='button').length,2)
 assert.equal(find(render([]),n=>n.type==='button'&&['插件市场','专家团'].includes(n.props['aria-label'])).length,0)
})
