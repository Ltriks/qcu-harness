import {releaseKeyOf} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {release} from '../hub/plugins/qcu-market/src/trusted-release.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdir,symlink,unlink,rm,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {startHost,startClient,attachDownload,archiveDir,work,Context,load,req,tick} from './support/market-http-fixture.mjs'
const id=()=>crypto.randomUUID()
async function fixture(t,options){const h=await startHost(options);const d=await attachDownload(h);const c=await startClient(h);t.after(async()=>{await c.close();await d.close();await h.close()});return {h,d,c,flow:c.flow()}}
test('actual archived Client → official HTTP → Gateway → archived Host prepares verified fixed bytes and decline never installs',async t=>{
 const {h,d,flow}=await fixture(t);assert.equal(h.calls.length,0)
 await flow.status();assert.equal(flow.state.status.state,'not-installed',flow.state.message)
 await flow.prepare();assert.equal(flow.state.phase,'review',flow.state.message)
 const r=flow.state.review.receipt;assert.equal(r.entry.sha256,d.release.sha256);assert.equal((await readFile(r.path)).length,d.release.bytes);assert.equal(d.count(),1);assert.equal(h.state.mutations.length,0)
 await flow.decline();assert.equal(flow.state.phase,'declined');const revoked=await h.raw('qcuMarket/verify',{id:r.id});assert.equal((await revoked.json()).result.ok,false)
 assert.equal(h.state.mutations.length,0);assert.ok(h.calls.every(c=>c.method==='POST'))
})
test('real HTTP install/enable uses all eight official generated contracts and exact success stage enable',async t=>{
 const {h,flow}=await fixture(t);await flow.prepare();assert.equal(flow.state.phase,'review',flow.state.message)
 const install=flow.confirmInstall();await assert.rejects(flow.confirmInstall(),/进行中/);await install
 assert.equal(flow.state.phase,'installed',flow.state.message);assert.equal(flow.state.status.state,'installed-disabled');assert.equal(h.state.mutations.length,1)
 await flow.reviewEnable('bundle');await flow.confirmEnable();assert.equal(flow.state.status.state,'row-disabled',flow.state.message)
 await flow.reviewEnable('row');await flow.confirmEnable();assert.equal(flow.state.status.state,'component-active',flow.state.message)
 flow.request={id:id()};await flow.reconcile();assert.equal(flow.state.phase,'unconfirmed');await flow.cancel();assert.equal(flow.state.phase,'unconfirmed');flow.request=null
 assert.deepEqual([...new Set(h.calls.filter(c=>c.path.startsWith('/api/pluginManager/')).map(c=>c.path.split('/').pop()))].sort(),['cancelInstall','inspect','installBundle','listBundles','listPlugins','setBundleEnabled','setPluginEnabled','waitForInstall'])
})
for(const mode of ['bad-hash','offline'])test(`actual download ${mode} cannot reach install review`,async t=>{
 const {h,d,flow}=await fixture(t);d.setMode(mode);await flow.prepare();assert.equal(flow.state.phase,'error');assert.equal(flow.state.review,null);assert.equal(h.state.mutations.length,0);assert.deepEqual(await readdir(d.cache),[])
})
test('HTTP cancellation and duplicate preparation abort real pending download without install',async t=>{
 const {h,d,flow}=await fixture(t);d.setMode('slow');const pending=flow.prepare();await d.started();await assert.rejects(flow.prepare(),/进行中/)
 const duplicate=await h.raw('qcuMarket/prepare',{id:id(),releaseKey:releaseKeyOf(release)});assert.equal((await duplicate.json()).result.ok,false)
 await flow.cancel();await pending;assert.equal(flow.state.phase,'cancelled');assert.equal(h.state.mutations.length,0);assert.equal(d.count(),1);assert.equal(h.host.get('qcuMarket').packages.pending.size,0)
 d.setMode('ok');await flow.prepare();assert.equal(flow.state.phase,'review',flow.state.message);assert.equal(h.state.mutations.length,0)
})
test('Host/Client remount revokes receipts and restores HTTP route without duplicate services',async t=>{
 const {h,d,c,flow}=await fixture(t);await flow.prepare();const receipt=flow.state.review.receipt
 await c.remount();assert.notEqual(c.flow(),flow);await h.remount();d.apply()
 const old=await h.raw('qcuMarket/verify',{id:receipt.id});assert.equal((await old.json()).result.ok,false)
 await c.flow().status();assert.equal(c.flow().state.status.state,'not-installed');await c.flow().prepare();assert.equal(c.flow().state.phase,'review',c.flow().state.message);assert.equal(d.count(),1)
 assert.equal(h.state.mutations.length,0)
})
test('HTTP route refuses malformed envelope and arbitrary operation without invoking download',async t=>{
 const {h,d}=await fixture(t)
 const malformed=await h.raw('qcuMarket/prepare',{id:id()},{body:'{}'});assert.equal((await malformed.json()).result.ok,false)
 const invalid=await h.raw('qcuMarket/prepare',{id:'https://arbitrary.invalid'});assert.equal((await invalid.json()).result.ok,false)
 const unknown=await h.raw('qcuMarket/install',{id:id()});assert.equal(unknown.status,404)
 const get=await h.send('/api/qcuMarket/prepare');assert.equal(get.status,404)
 assert.equal(d.count(),0);assert.equal(h.state.mutations.length,0)
})
test('official Loader same-name P2 → actual archive reinstall retains old Host and gives HTTP404; fresh process restores routes',async t=>{
 const {Loader}=await load('@deepseek-ai/cordis-plugin-loader')
 const dir=join(work,'cache-'+id());await mkdir(dir+'/node_modules',{recursive:true});t.after(()=>rm(dir,{recursive:true,force:true}))
 await symlink(join(work,'old/package'),dir+'/node_modules/qcu-market')
 const ctx=new Context(),loader=new Loader(ctx,{baseUrl:pathToFileURL(dir+'/cordis.yml').href});loader.write=()=>{}
 t.after(()=>ctx.fiber.dispose());const old=await loader.import('qcu-market')
 const first=await startHost({marketModule:old});await first.close()
 await unlink(dir+'/node_modules/qcu-market');await symlink(archiveDir,dir+'/node_modules/qcu-market')
 const disk=JSON.parse(await readFile(dir+'/node_modules/qcu-market/package.json','utf8'));assert.notEqual(disk.version,'0.1.0-pilot.2')
 const cached=await loader.import('qcu-market');assert.equal(cached,old)
 const stale=await startHost({marketModule:cached});const client=await startClient(stale)
 try{
  const raw=await stale.raw('qcuMarket/prepare',{id:id()});assert.equal(raw.status,404);assert.equal(stale.host.get('qcuMarket'),undefined)
  await client.flow().prepare();assert.equal(client.flow().state.phase,'error');assert.equal(stale.state.mutations.length,0)
  if(disk.version==='0.1.0-pilot.4.2')assert.match(client.flow().state.message,/正常.*重新打开|正常重启/)
 }finally{await client.close();await stale.close()}
 const fresh=spawnSync(process.execPath,['--expose-internals',new URL('./support/market-http-cold.mjs',import.meta.url).pathname,dir],{env:process.env,encoding:'utf8',timeout:20000})
 assert.equal(fresh.status,0,fresh.stderr);assert.match(fresh.stdout,/"cancel":true/);console.log(JSON.stringify({cacheReproduction:{diskVersion:disk.version,moduleIdentityUnchanged:true,http:404,coldProcess:JSON.parse(fresh.stdout.trim())}}))
})
test('Host disappearance or version mismatch stops before download or manager install',async t=>{
 const {h,d,flow}=await fixture(t)
 const service=h.host.get('qcuMarket'),original=service.status
 assert.equal(typeof original,'function','new archive must expose Host readiness')
 service.status=()=>JSON.stringify({version:'stale',protocol:1})
 await flow.prepare();assert.equal(flow.state.phase,'error');assert.match(flow.state.message,/版本不一致/);assert.equal(d.count(),0)
 service.status=original;await h.fork.dispose();await flow.prepare();assert.equal(flow.state.phase,'error');assert.match(flow.state.message,/Host 尚未就绪/);assert.equal(d.count(),0);assert.equal(h.state.mutations.length,0)
})
test('Host unload cancels outstanding HTTP download and remount can prepare again',async t=>{
 const {h,d,flow}=await fixture(t);d.setMode('slow');const operation=flow.prepare();await d.started();const preparation=h.host.get('qcuMarket').packages
 await h.fork.dispose();await operation;assert.equal(flow.state.phase,'error');assert.equal(preparation.pending.size,0);assert.equal(preparation.receipts.size,0)
 await h.remount();d.apply();d.setMode('ok');await flow.prepare();assert.equal(flow.state.phase,'review',flow.state.message);assert.equal(h.state.mutations.length,0)
})
test('official HTTP cancellation and wait contracts with pending manager backend never repeat installation',async t=>{
 let finish,started;const ready=new Promise(r=>started=r)
 const backend={install(state){state.pending=new Promise(r=>finish=r);started();return state.pending},wait:state=>state.pending,cancel(state){finish({changed:false,application:'cancelled',stage:'install',target:'fixture.tgz',enabled:false});state.pending=null;return {status:'cancelled'}}}
 const {h,flow}=await fixture(t,{backend});await flow.prepare();const installing=flow.confirmInstall();await ready
 await assert.rejects(flow.prepare(),/进行中/);const waiting=flow.reconcile();await tick();await flow.cancel();await waiting;await installing;assert.equal(flow.state.phase,'cancelled');assert.equal(h.state.mutations.filter(x=>x.method==='installBundle').length,1)
})
test('official profile resolver preserves same-path module cache while metadata advances',()=>{
 const r=spawnSync(process.execPath,['--expose-internals',new URL('./support/market-profile-cache.mjs',import.meta.url).pathname],{env:process.env,encoding:'utf8',timeout:20000})
 assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout.trim());assert.equal(result.http,404);assert.equal(result.moduleIdentityUnchanged,true);console.log(JSON.stringify({profileCacheReproduction:result}))
})
test('official authenticated HTTP trust fence rejects anonymous and foreign-origin preparation',async t=>{
 const {h,d}=await fixture(t)
 const anonymous=await fetch(h.origin+'/api/qcuMarket/prepare',{method:'POST'});assert.equal(anonymous.status,401)
 const foreign=await h.raw('qcuMarket/prepare',{id:id()},{headers:{'content-type':'application/json',origin:'https://untrusted.invalid'}});assert.equal(foreign.status,403)
 assert.equal(d.count(),0);assert.equal(h.state.mutations.length,0)
})

test('actual HTTP refuses an unreviewed release key and client-controlled URL before download',async t=>{
 const {h,d}=await fixture(t)
 for(const args of [{id:id(),releaseKey:'qcu-unknown@0.1.0+'+'0'.repeat(64)},{id:id(),releaseKey:releaseKeyOf(release),url:'https://evil.invalid'}]){const r=await h.raw('qcuMarket/prepare',args);assert.equal((await r.json()).result.ok,false)}
 assert.equal(d.count(),0);assert.equal(h.state.mutations.length,0)
})
