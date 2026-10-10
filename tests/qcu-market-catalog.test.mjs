import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {bundledCatalog,catalogText,catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {parseMarketCatalog,releaseKeyOf,findMarketRelease} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {PackagePreparation} from '../hub/plugins/qcu-market/src/host-core.mjs'
import {createCatalogFlows} from '../hub/plugins/qcu-market/src/direct-flow.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
const clone=()=>JSON.parse(catalogText),key=releaseKeyOf(bundledCatalog.entries[0].release)
test('bundled reviewed fingerprint is exact, immutable, coach only, with no startup network',()=>{
 assert.equal(createHash('sha256').update(catalogText).digest('hex'),catalogSha256)
 assert.equal(bundledCatalog.entries.length,1);assert.equal(bundledCatalog.entries[0].id,'qcu-study-coach')
 assert.throws(()=>bundledCatalog.entries[0].release.origin='https://evil.invalid')
 assert.equal(findMarketRelease(bundledCatalog,key),bundledCatalog.entries[0].release)
 assert.throws(()=>findMarketRelease(bundledCatalog,key+'0'))
})
for(const [label,mutate] of Object.entries({
 unknown:c=>c.trusted=true,old:c=>c.schemaVersion=1,revision:c=>c.revision=0,protocol:c=>c.protocol=1,
 duplicate:c=>c.entries.push(c.entries[0]),sameVersionOtherHash:c=>{const e=structuredClone(c.entries[0]);e.release.sha256='0'.repeat(64);c.entries.push(e)},
 remoteHash:c=>c.catalogSha256='0'.repeat(64),installed:c=>c.entries[0].installed=true,
 source:c=>c.entries[0].sourceLabel='DSH官方',draft:c=>c.entries[0].kind='draft',withdrawn:c=>c.entries[0].release.releaseStatus='withdrawn',
 origin:c=>c.entries[0].release.origin='https://evil.invalid',path:c=>c.entries[0].release.file='../x.tgz',
 hash:c=>c.entries[0].release.sha256='bad',size:c=>c.entries[0].release.bytes=1048577,
 version:c=>c.entries[0].release.version='latest',runtime:c=>c.entries[0].release.runtime='*',
 script:c=>c.entries[0].release.command='npm install',count:c=>c.entries=Array(101).fill(c.entries[0])
}))test(`catalog rejects ${label}`,()=>{const c=clone();mutate(c);assert.throws(()=>parseMarketCatalog(JSON.stringify(c)))})
test('catalog rejects malformed and byte oversized text',()=>{assert.throws(()=>parseMarketCatalog('{'));assert.throws(()=>parseMarketCatalog('界'.repeat(100000)))})
function multiple(){const c=clone(),item=structuredClone(c.entries[0]);item.id='qcu-synthetic-fixture';Object.assign(item.release,{id:item.id,skill:item.id,provider:item.id+'@'+item.release.version});item.release.file=`${item.id}-${item.release.version}-${item.release.sha256}.tgz`;c.entries.push(item);return parseMarketCatalog(JSON.stringify(c))}
test('host selects reviewed entry by key and rejects unknown keys without downloading; replay revoked',async()=>{
 const catalog=multiple(),downloads=[],p=new PackagePreparation({catalog,download:async({entry})=>{downloads.push(entry.id);return '/cache/'+entry.file},verify:async()=>{}})
 await assert.rejects(p.prepare(randomUUID(),'unreviewed'));assert.deepEqual(downloads,[])
 const id=randomUUID(),r=JSON.parse(await p.prepare(id,releaseKeyOf(catalog.entries[1].release)))
 assert.equal(r.entry.id,'qcu-synthetic-fixture');assert.equal(r.catalogSha256,catalogSha256)
 await assert.rejects(p.prepare(id,key),/already exists/)
 p.fingerprint='0'.repeat(64);await assert.rejects(p.verify(id),/Release changed/);p.dispose()
})
test('two synthetic entries keep independent state, serialize review and mutations, cancel/reenter/dispose safely',async()=>{
 const catalog=multiple(),p=new PackagePreparation({catalog,download:async({entry})=>'/cache/'+entry.file,verify:async()=>{}}),installed=[],calls=[]
 const ok=value=>({ok:true,value}),remote={qcuMarket:{status:async()=>ok(JSON.stringify(marketRuntime)),prepare:async(...a)=>ok(await p.prepare(...a)),verify:async(...a)=>ok(await p.verify(...a)),cancel:async id=>ok(p.cancel(id))},pluginManager:{listBundles:async()=>ok(installed),inspect:async()=>ok({status:'accepted',kind:'tarball',registry:null}),installBundle:async(path)=>{calls.push(path);const e=catalog.entries.find(i=>path.endsWith(i.release.file)).release;installed.push({name:e.id,version:e.version,installed:true,enabled:false});return ok({application:'applied',stage:'enable',target:e.id,bundle:e.id,enabled:false})}}}
 const flows=createCatalogFlows(remote,{catalog});assert.deepEqual(calls,[])
 await flows[0].prepare();assert.equal(flows[0].state.phase,'review');await assert.rejects(flows[1].prepare(),/其他条目/);assert.equal(flows[1].state.phase,'idle')
 await flows[0].decline();await flows[1].prepare();await flows[1].confirmInstall();assert.equal(flows[1].state.status.state,'installed-disabled');assert.equal(flows[0].state.status.state,'not-installed');assert.equal(calls.length,1)
 await flows[0].prepare();flows[0].invalidate();await assert.rejects(flows[0].confirmInstall());assert.equal(calls.length,1)
 await flows[0].prepare();await flows[0].cancel();await flows[0].prepare();assert.equal(flows[0].state.phase,'review');flows.forEach(f=>f.dispose());p.dispose()
})
test('changed catalog fingerprint in receipt fails before official inspection',async()=>{
 const e=bundledCatalog.entries[0].release;let inspections=0
 const remote={qcuMarket:{status:async()=>({ok:true,value:JSON.stringify(marketRuntime)}),prepare:async id=>({ok:true,value:JSON.stringify({id,entry:e,path:'/cache/'+e.file,expiresAt:Date.now()+10000,releaseKey:key,catalogSha256:'0'.repeat(64)})})},pluginManager:{listBundles:async()=>({ok:true,value:[]}),inspect:async()=>inspections++}}
 const [flow]=createCatalogFlows(remote);await flow.prepare();assert.equal(flow.state.phase,'error');assert.equal(inspections,0);flow.dispose()
})
