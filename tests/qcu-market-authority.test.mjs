import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto'
import {mkdtemp,rm,writeFile,symlink,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {canonical,verifyCatalog,authorityDigest,CatalogAuthority} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
import {bundledCatalog} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {PackagePreparation,fetchPinned,verifyFile} from '../hub/plugins/qcu-market/src/host-core.mjs'
import {DirectMarketFlow} from '../hub/plugins/qcu-market/src/direct-flow.mjs'
import {CatalogRuntime} from '../hub/plugins/qcu-market/src/catalog-runtime.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
const keys=generateKeyPairSync('ed25519'),der=keys.publicKey.export({format:'der',type:'spki'})
const trust={schema:1,keyId:authorityDigest(der),origin:'http://192.168.1.68:8080',spki:der.toString('base64')}
const now=Date.now(),bytes=Buffer.from('synthetic immutable package')
function item(origin=trust.origin){const i=structuredClone(bundledCatalog.entries[0]);i.id='qcu-synthetic-tool';i.title='Synthetic generic tool';i.kind='bundle';i.capabilities=['tools'];i.release={...i.release,id:i.id,version:'0.0.1',origin,skill:null,skillSha256:null,provider:null,releaseStatus:'published',sha256:authorityDigest(bytes),bytes:bytes.length};i.release.file=`${i.id}-${i.release.version}-${i.release.sha256}.tgz`;return i}
function payload(revision=1,entries=[item()],origin=trust.origin){return {domain:'QCU-MARKET-CATALOG/ED25519/V1',schema:1,origin,revision,issuedAt:now-1000,expiresAt:now+600000,catalog:{schemaVersion:4,protocol:4,revision,entries},withdrawn:entries.length?[]:['qcu-synthetic-tool']}}
function envelope(p=payload(),privateKey=keys.privateKey){const b=Buffer.from(canonical(p));return Buffer.from(canonical({schema:1,keyId:trust.keyId,payload:b.toString('base64'),signature:sign(null,b,privateKey).toString('base64')}))}
test('actual Ed25519 exact-byte authority rejects malformed roots, signatures, source and time bounds',()=>{
 const raw=envelope(),accepted=verifyCatalog(raw,trust,{now});assert.equal(accepted.fingerprint,authorityDigest(raw));assert.equal(accepted.catalog.entries[0].id,'qcu-synthetic-tool')
 for(const change of [{schema:2},{domain:'OTHER'},{origin:'https://other.invalid'},{revision:0},{issuedAt:now+120001},{expiresAt:now},{expiresAt:now+31*86400000},{catalog:{...payload().catalog,entries:Array(101).fill(item())}},{withdrawn:['qcu-synthetic-tool']}])assert.throws(()=>verifyCatalog(envelope({...payload(),...change}),trust,{now}))
 assert.throws(()=>verifyCatalog(envelope(payload(),generateKeyPairSync('ed25519').privateKey),trust,{now}),/signature/)
 for(const mutate of [e=>({...e,keyId:'0'.repeat(64)}),e=>({...e,schema:2}),e=>({...e,publicKey:trust.spki}),e=>({...e,payload:e.payload+'='}),e=>({...e,signature:'A'.repeat(88)})])assert.throws(()=>verifyCatalog(Buffer.from(canonical(mutate(JSON.parse(raw)))),trust,{now}))
 assert.throws(()=>verifyCatalog(Buffer.from('{"schema":1,"schema":1}'),trust))
 assert.throws(()=>verifyCatalog(Buffer.alloc(524289),trust));assert.throws(()=>verifyCatalog(Buffer.from([255]),trust))
 assert.throws(()=>verifyCatalog(raw,{...trust,spki:generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).toString('base64')}))
})
async function live(t){
 const root=await mkdtemp('/private/tmp/qcu-authority-');t.after(()=>rm(root,{recursive:true,force:true}))
 let raw,downloads=0,offline=false
 const server=createServer((req,res)=>{if(offline){res.writeHead(503).end();return}const data=req.url==='/market/catalog.signed.json'?raw:req.url==='/plugins/'+entry.release.file?(downloads++,bytes):null;if(!data){res.writeHead(404).end();return}res.writeHead(200,{'content-length':data.length});res.end(data)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)))
 const origin='http://127.0.0.1:'+server.address().port,local={...trust,origin},entry=item(origin)
 const set=(revision,entries=[entry],change={})=>{raw=envelope({...payload(revision,entries,origin),...change});return raw}
 set(1)
 const options={root:join(root,'authority'),test:true},authority=new CatalogAuthority(local,options)
 return {root,local,options,authority,entry,set,downloads:()=>downloads,offline:v=>offline=v,raw:()=>raw}
}
test('real loopback HTTP and durable watermark reject replay/equivocation after restart; higher revision can rollback package',async t=>{
 const f=await live(t);assert.equal((await f.authority.refresh()).state,'fresh');f.set(2,[]);assert.equal((await f.authority.refresh()).catalog.entries.length,0)
 let a=new CatalogAuthority(f.local,f.options);f.set(1);assert.equal((await a.refresh()).state,'unavailable');f.set(2,[f.entry]);assert.equal((await a.refresh()).state,'unavailable');f.set(3);assert.equal((await a.refresh()).state,'fresh')
 f.offline(true);assert.equal((await a.refresh()).state,'stale');assert.equal(a.snapshot().catalog.entries.length,1);assert.equal(f.downloads(),0)
 const symlinkRoot=join(f.root,'alias');await symlink(f.options.root,symlinkRoot);assert.equal((await new CatalogAuthority(f.local,{root:symlinkRoot,test:true}).refresh()).state,'unavailable')
})
test('real shared flow binds current signature through cached download, decline, withdraw and independent activation',async t=>{
 const f=await live(t),authority=f.authority,p=new PackagePreparation({authority,download:opts=>fetchPinned({...opts,root:join(f.root,'cache'),validate:e=>p.releaseUrl(e)}),verify:(path,e)=>verifyFile(path,e,v=>p.releaseUrl(v))})
 t.after(()=>p.dispose());let installs=0,enables=0,bundles=[],rows=[]
 const ok=value=>({ok:true,value}),manager={cancelInstall:async()=>ok({status:'not-running'}),listBundles:async()=>ok(bundles),listPlugins:async()=>ok(rows),inspect:async()=>ok({status:'accepted',kind:'tarball',registry:null}),installBundle:async(path,options)=>{installs++;assert.equal(options.enabled,false);bundles=[{name:f.entry.id,version:f.entry.release.version,installed:true,enabled:false,rows:[{rowId:f.entry.id,moduleName:f.entry.id}],overrides:[]}];return ok({application:'applied',stage:'enable',target:f.entry.id,bundle:f.entry.id,enabled:false})},setBundleEnabled:async()=>{enables++;bundles[0].enabled=true;bundles[0].rows[0].entryId='row';rows=[{moduleName:f.entry.id,entryId:'row',patchId:f.entry.id,enabled:true,fiberPhase:'active'}];return ok({application:'applied',stage:'enable',target:f.entry.id,enabled:true})}}
 const remote={pluginManager:manager,qcuMarket:Object.fromEntries(['prepare','verify','cancel','refresh'].map(m=>[m,async(...args)=>ok(await p[m](...args))]))};remote.qcuMarket.updatesRecovery=async()=>ok('null');remote.qcuMarket.status=async()=>ok(JSON.stringify(marketRuntime))
 let state={};const runtime=new CatalogRuntime(remote,patch=>state={...state,...patch});t.after(()=>runtime.dispose());await runtime.refresh();assert.equal(f.downloads(),0)
 let flow=state.flows[0];await flow.prepare();assert.equal(flow.state.phase,'review');assert.equal(await runtime.refresh(),false);assert.equal(installs,0);await flow.decline();assert.equal(installs,0)
 await flow.prepare();assert.equal(f.downloads(),1);f.set(2,[]);await flow.confirmInstall();assert.equal(installs,0);assert.equal(flow.state.phase,'error')
 await runtime.refresh();assert.equal(state.catalog.entries.length,0);f.set(3);await runtime.refresh();flow=state.flows[0];await flow.prepare();await flow.confirmInstall();assert.equal(installs,1);assert.equal(enables,0);assert.equal(flow.state.status.state,'installed-disabled');assert.equal(f.downloads(),1)
 await flow.reviewActivate();f.set(4,[]);await flow.confirmActivate();assert.equal(enables,0)
 await runtime.refresh();f.set(5);await runtime.refresh();flow=state.flows[0];await flow.reviewActivate();await flow.confirmActivate();assert.equal(enables,1);assert.equal(flow.state.status.state,'component-active')
 // Unknown official result and connection reset retain the owner and block refresh.
 flow.request={id:randomUUID()};runtime.reset();assert.equal(await runtime.refresh(),false);assert.ok(flow.request)
})
test('Host unload during initial authority refresh cannot start a late package download',async()=>{
 let finish,started,downloads=0
 const waiting=new Promise(r=>finish=r),ready=new Promise(r=>started=r)
 const authority={state:'fresh',refresh:async()=>{started();await waiting;return {catalog:bundledCatalog,fingerprint:'synthetic'}}}
 const packages=new PackagePreparation({authority,download:async()=>{downloads++;return '/never'}})
 const pending=packages.prepare(randomUUID());await ready;packages.dispose();finish()
 await assert.rejects(pending,/disposed/);assert.equal(downloads,0);assert.equal(packages.pending.size,0)
})
test('signed first load creates an absent Home cache safely, while symlink ancestors refuse before fetch',async t=>{
 const f=await live(t),home=join(f.root,'fresh-home');await mkdir(home,{mode:0o700})
 const root=join(home,'.cache','qcu-market-authority'),a=new CatalogAuthority(f.local,{root,test:true})
 assert.equal((await a.refresh()).state,'fresh')
 const alias=join(f.root,'linked-home');await symlink(home,alias);let fetched=false
 const unsafe=new CatalogAuthority(f.local,{root:join(alias,'.cache','other'),test:true,fetcher:async()=>{fetched=true;throw Error('must not fetch')}})
 assert.equal((await unsafe.refresh()).state,'unavailable');assert.equal(fetched,false)
})
test('actual shared flows cannot begin mutation during delayed refresh, and unknown official request is retained',async()=>{
 const ok=value=>({ok:true,value}),state={mode:'legacy',state:'legacy',catalog:bundledCatalog,fingerprint:authorityDigest(Buffer.from('unused')),message:'legacy'}
 // Legacy fingerprint must match the bundled authority for the actual receipt checks.
 const {catalogSha256}=await import('../hub/plugins/qcu-market/src/bundled-catalog.mjs');state.fingerprint=catalogSha256
 let finish,started,hold=false,installs=0,prepares=0,receipt
 const remote={qcuMarket:{updatesRecovery:async()=>ok('null'),status:async()=>ok(JSON.stringify(marketRuntime)),refresh:async()=>{if(hold){started();await new Promise(r=>finish=r)}return ok(JSON.stringify(state))},prepare:async id=>{prepares++;const entry=bundledCatalog.entries[0].release;receipt={id,entry,releaseKey:`${entry.id}@${entry.version}+${entry.sha256}`,catalogSha256,path:'/cache/'+entry.file,expiresAt:Date.now()+60000};return ok(JSON.stringify(receipt))},verify:async()=>ok(JSON.stringify(receipt)),cancel:async()=>ok('{}')},pluginManager:{listBundles:async()=>ok([]),inspect:async()=>ok({status:'accepted',kind:'tarball',registry:null}),installBundle:async()=>{installs++;return {ok:false,error:{message:'Synthetic lost reply'}}},cancelInstall:async()=>ok({status:'not-running'})}}
 let snapshot;const runtime=new CatalogRuntime(remote,patch=>snapshot={...snapshot,...patch});await runtime.refresh();const flow=snapshot.flows[0]
 hold=true;const ready=new Promise(r=>started=r),refresh=runtime.refresh();await ready
 await assert.rejects(flow.prepare(),/目录刷新/);await assert.rejects(flow.reviewActivate(),/目录刷新/);await assert.rejects(flow.confirmInstall(),/目录刷新/)
 assert.equal(prepares,0);assert.equal(installs,0);assert.equal(flow.disposed,false);finish();await refresh;hold=false
 const current=snapshot.flows[0];await current.prepare();await current.confirmInstall();assert.equal(installs,1);const request=current.request;assert.ok(request)
 assert.equal(await runtime.refresh(),false);assert.equal(snapshot.flows[0],current);assert.equal(current.request,request);assert.equal(current.disposed,false);runtime.dispose()
})
