import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises'
import {join,dirname,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {audit,freshness,httpBytes} from '../scripts/audit-product-polish.mjs'
import {inspectProductArchive} from '../scripts/product-polish-archive.mjs'
import {bundledCatalog} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {canonical,authorityDigest} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
import {archiveFingerprint} from '../hub/plugins/qcu-market/src/update-archive.mjs'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {syntheticUpdateArchive,syntheticUpdateEntry} from './support/market-update-fixture.mjs'
import {reviewHash as digest,reviewArchive} from './support/product-polish-review-fixture.mjs'
async function fixture(t){
 const root=await mkdtemp('/private/tmp/qcu-p16-audit-review-');t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'market'));await mkdir(join(root,'plugins'))
 const keys=generateKeyPairSync('ed25519'),der=keys.publicKey.export({format:'der',type:'spki'}),trust={schema:1,keyId:authorityDigest(der),origin:'http://192.168.1.68:8080',spki:der.toString('base64')},now=Date.parse('2026-10-27T00:00:00Z')
 const item=structuredClone(bundledCatalog.entries.find(e=>e.id==='qcu-study-coach')),b=syntheticUpdateArchive(item.id,item.release.version)
 Object.assign(item.release,{releaseStatus:'published',sha256:digest(b),bytes:b.length,file:item.id+'-'+item.release.version+'-'+digest(b)+'.tgz'});await writeFile(join(root,'plugins',item.release.file),b)
 const payload={domain:'QCU-MARKET-CATALOG/ED25519/V1',schema:1,origin:trust.origin,revision:8,issuedAt:now-86400000,expiresAt:now+2*86400000,catalog:{schemaVersion:4,protocol:4,revision:8,entries:[item]},withdrawn:[]}
 const signCatalog=async()=>{const p=Buffer.from(canonical(payload)),envelope={schema:1,keyId:trust.keyId,payload:p.toString('base64'),signature:sign(null,p,keys.privateKey).toString('base64')};await writeFile(join(root,'market/catalog.signed.json'),canonical(envelope))};await signCatalog()
 const key2=generateKeyPairSync('ed25519'),entry=syntheticUpdateEntry(item.id,item.release.version,b),policy={...structuredClone(updatePolicy),publicKey:key2.publicKey.export({format:'pem',type:'spki'})}
 const feed={schemaVersion:1,channel:'pilot',revision:2,issuedAt:new Date(now-86400000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),entries:[entry]}
 const signFeed=async(name='updates.json',value=feed)=>{const p=JSON.stringify(value);await writeFile(join(root,name),JSON.stringify({payload:p,signature:sign(null,Buffer.from(p),key2.privateKey).toString('base64')}))};await signFeed()
 return{root,trust,policy,now,payload,feed,signCatalog,signFeed}
}
test('maintenance verifies independent signatures, real package identities, expiry and supported fallback',async t=>{
 const f=await fixture(t),options={...f,test:true};let r=await audit(options);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.catalog.freshness,'near-expiry');assert.equal(r.updates.verification,'signature-and-integrity-verified');assert.equal(r.expertFeed.state,'supported-legacy-fallback');assert.equal(r.coverage.state,'consistent');assert.notEqual(r.catalog.keyId,r.updates.keyId)
 r=await audit({...options,now:f.now+3*86400000});assert.equal(r.catalog.freshness,'expired');assert.equal(r.updates.freshness,'expired');assert.equal(r.ok,false)
 f.feed.entries[0].id='qcu-unreviewed';await f.signFeed();r=await audit(options);assert.ok(r.failures.includes('updates.verification-or-integrity-or-channel'))
})
test('valid signatures swapped across signed channels are refused and do not become supported 404 fallback',async t=>{
 const f=await fixture(t)
 await f.signFeed('updates.json',{...f.feed,channel:'pilot-experts'})
 let r=await audit({...f,test:true});assert.ok(r.failures.includes('updates.verification-or-integrity-or-channel'));assert.equal(r.updates.verification,'unavailable')
 await f.signFeed();await f.signFeed('updates-v2.json',{...f.feed,channel:'pilot'})
 r=await audit({...f,test:true});assert.equal(r.expertFeed.state,'invalid');assert.ok(r.failures.includes('expert-feed.verification-or-channel'))
 await f.signFeed('updates-v2.json',{...f.feed,channel:'pilot-experts'});r=await audit({...f,test:true});assert.equal(r.ok,true,JSON.stringify(r))
})
test('latest catalog/update gaps remain visible without widening update policy or treating fallback itself as outage',async t=>{
 const f=await fixture(t),before=JSON.stringify(f.policy);const old=syntheticUpdateArchive('qcu-study-coach','0.1.0-pilot.1'),entry=syntheticUpdateEntry('qcu-study-coach','0.1.0-pilot.1',old);await writeFile(join(f.root,'plugins',entry.file),old);f.feed.entries=[entry];await f.signFeed()
 const r=await audit({...f,test:true});assert.equal(r.catalog.integrity,'verified');assert.equal(r.updates.verification,'signature-and-integrity-verified');assert.equal(r.expertFeed.state,'supported-legacy-fallback');assert.equal(r.coverage.gaps[0].state,'catalog-newer');assert.ok(r.failures.includes('coverage.gaps'));assert.equal(JSON.stringify(f.policy),before)
})
test('metadata without signature, archive scripts/peers/inventory/identity and HTTP redirects fail closed',async t=>{
 const f=await fixture(t);await writeFile(join(f.root,'market/catalog.signed.json'),'{}');const r=await audit({...f,test:true});assert.notEqual(r.catalog.verification,'signature-verified');assert.equal(r.ok,false)
 for(const extra of [{name:'qcu-other'},{version:'9.9.9'},{scripts:{postinstall:'NEVER EXECUTE'}},{peerDependencies:{unreviewed:'1.0.0'}}]){
  const raw=syntheticUpdateArchive('qcu-study-coach','0.1.0-pilot.2',{extra});assert.throws(()=>inspectProductArchive(raw,{id:'qcu-study-coach',version:'0.1.0-pilot.2'},{policy:updatePolicy}))
 }
 await assert.rejects(httpBytes('http://127.0.0.1:1','/api/feedback',100));await assert.rejects(httpBytes('http://127.0.0.1:1','/updates.json',100,async()=>new Response('',{status:302})))
 assert.equal(freshness(100,1,100),'expired');assert.equal(freshness(73*3600000,1,1),'fresh')
})
async function releaseFixture(t){
 const root=await mkdtemp('/private/tmp/qcu-p16-release-review-');t.after(()=>rm(root,{recursive:true,force:true}));const spec=JSON.parse(await readFile(new URL('../releases/qcu-teacher-product-polish.json',import.meta.url))),archives=[]
 const patch=[{id:'ui-brand-official',disabled:true},{id:'ui-sidebar',disabled:true},{insert:[{id:'qcu-branding',name:'qcu-branding'}]}]
 const files={'LICENSE':'MIT','client.js':'// synthetic no execution','cordis.patch.yml':JSON.stringify(patch),'icon.svg':'<svg/>','index.js':'export function apply(){}','package.json':JSON.stringify({name:'qcu-branding',version:spec.versions.branding,type:'module',exports:{'.':'./index.js','./client':'./client.js','./package.json':'./package.json'},dsh:{bundle:{patch:'./cordis.patch.yml'}}})}
 for(const [id,version,raw]of [['qcu-branding',spec.versions.branding,reviewArchive(files)],['qcu-market',spec.versions.market,syntheticUpdateArchive('qcu-market',spec.versions.market,{peers:updatePolicy.products['qcu-market'].peers})]]){
  const sha256=digest(raw),path='packages/'+id+'/'+id+'-'+version+'-'+sha256+'.tgz';await mkdir(join(root,dirname(path)),{recursive:true});await writeFile(join(root,path),raw);await writeFile(join(root,dirname(path),'MANIFEST.json'),JSON.stringify({id,version,bytes:raw.length,sha256,files:archiveFingerprint(raw)}));archives.push({id,version,path,sha256,bytes:raw.length})
 }
 await writeFile(join(root,'release.json'),JSON.stringify({...spec,archives}));return{root,spec,archives}
}
test('descriptor rejects a genuinely valid but mislabeled TGZ even when filename/hash/member manifest are updated',async t=>{
 const f=await releaseFixture(t);assert.equal((await audit({root:f.root,releaseOnly:true})).ok,true)
 const entry=f.archives[0],wrong=syntheticUpdateArchive('qcu-market',f.spec.versions.branding,{peers:updatePolicy.products['qcu-market'].peers});entry.bytes=wrong.length;entry.sha256=digest(wrong);entry.path='packages/qcu-branding/qcu-branding-'+entry.version+'-'+entry.sha256+'.tgz'
 await writeFile(join(f.root,entry.path),wrong);await writeFile(join(f.root,dirname(entry.path),'MANIFEST.json'),JSON.stringify({version:entry.version,bytes:entry.bytes,sha256:entry.sha256,files:archiveFingerprint(wrong)}));await writeFile(join(f.root,'release.json'),JSON.stringify({...f.spec,archives:f.archives}))
 const r=await audit({root:f.root,releaseOnly:true});assert.equal(r.ok,false);assert.ok(r.failures.includes('descriptor.identity-or-inventory'))
 await assert.rejects(audit({root:f.root,releaseOnly:true,http:true}))
})
test('unsigned renewal carries independent fingerprints, higher revisions and bounded proposed windows',async t=>{
 const f=await fixture(t),r=await audit({...f,test:true});const path=join(f.root,'audit.json'),output=join(f.root,'draft.json');await writeFile(path,JSON.stringify(r))
 const child=spawnSync('rtk',['proxy','python3','scripts/draft-product-polish-renewal.py','--audit',path,'--output',output],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);const d=JSON.parse(await readFile(output));assert.equal(d.signed,false);assert.equal(d.deployable,false);assert.equal(d.catalog.minimumNextRevision,9);assert.equal(d.legacyUpdates.minimumNextRevision,3);assert.equal(d.catalog.currentFingerprint,r.catalog.fingerprint);assert.equal(d.legacyUpdates.currentFingerprint,r.updates.fingerprint);assert.notEqual(d.catalog.publicKeyId,d.legacyUpdates.publicKeyId);assert.equal(Date.parse(d.catalog.proposedTimeBounds.expiresAt)-Date.parse(d.catalog.proposedTimeBounds.issuedAt),7*86400000)
})

