// Real immutable reading bytes and actual signature/producer/Host code; no native install.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,rm,readdir,access} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import vm from 'node:vm'
import {verify as verifySignature} from 'node:crypto'
import {admissionOut,admissionBaseline,readingRaw,readingEntry,readingMeta,hash,testKeys,signedFeed,materialize,prepareAdmissionFeeds} from './support/reading-admission.mjs'
import {prepareMarketUpdates} from '../scripts/publish-market-updates.mjs'
// Run this same suite against the exact unpacked candidate as well as source.
const root=pathToFileURL(resolve(process.env.QCU_ADMISSION_MARKET_ROOT??'hub/plugins/qcu-market')+'/')
const {updatePolicy,expertUpdatePolicy,legacyUpdatePolicy}=await import(new URL('src/update-policy.mjs',root))
const {parseUpdatePayload,readingProjectionCapable,expertProjectionCapable,updateProjections}=await import(new URL('src/update-model.mjs',root))
const {MarketUpdates,verifyUpdateEnvelope}=await import(new URL('src/update-host.mjs',root))
const {inspectUpdateArchive}=await import(new URL('src/update-archive.mjs',root))
const {MarketUpdateFlow}=await import(new URL('src/update-flow.mjs',new URL('../hub/plugins/qcu-market/',import.meta.url)))
const {marketRuntime}=await import(new URL('src/remote-contract.mjs',root))
const frozen=JSON.parse(await readFile(new URL('fixtures/qcu-market-frozen-update-policies.json',import.meta.url)))
await mkdir(admissionOut,{recursive:true})
async function temp(t){const dir=await mkdtemp('/private/tmp/qcu-reading-admission-');t.after(()=>rm(dir,{recursive:true,force:true}));return dir}
const response=value=>{const raw=Buffer.from(JSON.stringify(value));return new Response(raw,{headers:{'content-length':String(raw.length)}})}
test('frozen policies/key unchanged; only exact reading tools and ten immutable peers are added',()=>{
 assert.deepEqual(legacyUpdatePolicy,frozen.legacy);assert.deepEqual(expertUpdatePolicy,frozen.expert)
 assert.deepEqual(updatePolicy.products,{...frozen.expert.products,'qcu-reading':{capability:'tools',peers:readingMeta.peerDependencies}})
 assert.equal(updatePolicy.publicKey,frozen.expert.publicKey);assert.equal(Object.keys(readingEntry.peers).length,10)
 assert.ok(Object.isFrozen(updatePolicy.products['qcu-reading'].peers));assert.ok(expertProjectionCapable(expertUpdatePolicy));assert.ok(readingProjectionCapable(updatePolicy));assert.ok(!readingProjectionCapable(expertUpdatePolicy))
 assert.equal(inspectUpdateArchive(readingRaw,readingEntry).components,1)
})
test('all three real signed projections preserve frozen contents and old compiled parsers cannot see reading',async t=>{
 const dir=await temp(t),f=await prepareAdmissionFeeds(dir),now=Date.now(),result={}
 // These are the actual baseline compiled Client functions, captured before editing.
 let compiled
 const before=await readFile(join(admissionBaseline,'client.js'),'utf8')
 vm.runInNewContext(before.replace('return createLoopPlugin(React);','return {parseUpdatePayload,updatePolicy,expertProjectionCapable};'),{TextEncoder,window:{__ModuleLoader__:{load:m=>compiled=m}}})
 const old=compiled.factory(()=>({})),oldExpert={...frozen.expert,publicKey:f.keys.policy.publicKey},oldLegacy={...frozen.legacy,publicKey:f.keys.policy.publicKey}
 const released=await readFile(join(admissionBaseline,'released-legacy-client.js'),'utf8');let legacyModule
 vm.runInNewContext(released.replace('return createLoopPlugin(React);','return {parseUpdatePayload};'),{TextEncoder,window:{__ModuleLoader__:{load:m=>legacyModule=m}}})
 const releasedLegacy=legacyModule.factory(()=>({})),releasedPolicy=await import(pathToFileURL(join(admissionBaseline,'released-legacy-update-policy.mjs')))
 assert.deepEqual(releasedPolicy.updatePolicy,frozen.legacy)
 assert.deepEqual(Array.from(releasedLegacy.parseUpdatePayload(f.envelopes.legacy.payload,oldLegacy,now).entries,e=>e.id),['qcu-study-coach'])
 assert.throws(()=>releasedLegacy.parseUpdatePayload(f.envelopes.v2.payload,oldLegacy,now),/通道/)
 for(const [projection,policy,expected] of [['legacy',oldLegacy,['qcu-study-coach']],['v2',oldExpert,['qcu-study-coach','qcu-expert-teams']],['v3',f.keys.policy,['qcu-reading','qcu-study-coach','qcu-expert-teams']]]){
  const feed=verifyUpdateEnvelope(f.envelopes[projection],policy,now);assert.deepEqual(feed.entries.map(e=>e.id),expected)
  for(const e of feed.entries){const raw=await readFile(join(f.job.archives,e.file));inspectUpdateArchive(raw,e)}
  if(projection!=='v3')assert.deepEqual(Array.from(old.parseUpdatePayload(f.envelopes[projection].payload,policy,now).entries,e=>e.id),expected)
  const omissions=f.review.feeds.find(p=>p.projection===projection).omissions;assert.ok(omissions.some(e=>e.id==='qcu-deliberate-synthetic-omission'))
  result[projection]={channel:feed.channel,entries:expected,omissions,signatureVerified:true}
 }
 assert.throws(()=>old.parseUpdatePayload(f.envelopes.v3.payload,oldExpert,now),/通道/)
 assert.throws(()=>verifyUpdateEnvelope(f.envelopes.v3,oldLegacy,now),/通道/)
 const output=process.env.QCU_ADMISSION_MARKET_ROOT?'exact-projection-proof.json':'source-projection-proof.json'
 await writeFile(join(admissionOut,output),JSON.stringify({ephemeralKeyOnly:true,immutableReading:readingEntry.sha256,oldCompiledClientTested:true,projections:result},null,2))
})
test('producer refuses unknowns, invalid requested projections, wrong keys, bytes and peer drift before any writes',async t=>{
 const dir=await temp(t),f=await prepareAdmissionFeeds(dir);let n=0
 async function refuses(job,pattern,key=f.keys.privateKey){const output=join(dir,'refused-'+n++);await assert.rejects(prepareMarketUpdates(job,key,output,f.keys.policy),pattern);await assert.rejects(access(output),{code:'ENOENT'})}
 for(const projections of [undefined,[],['v3','v3'],['legacy','unknown'],[['v3']]])await refuses({...f.job,projections},/projections/)
 await refuses(f.job,/key/,testKeys().privateKey)
 const limitedOutput=join(dir,'limited-policy'),limitedCatalog=join(dir,'limited-catalog.json')
 await writeFile(limitedCatalog,JSON.stringify({plugins:f.plugins.filter(p=>p.id==='qcu-study-coach')}))
 await assert.rejects(prepareMarketUpdates({...f.job,catalog:limitedCatalog,projections:['legacy','v3']},f.keys.privateKey,limitedOutput,{...f.keys.policy,products:legacyUpdatePolicy.products}),/exact reviewed policy/)
 await assert.rejects(access(limitedOutput),{code:'ENOENT'})
 const catalog=JSON.parse(await readFile(f.job.catalog));catalog.plugins.push({...catalog.plugins[0],id:'qcu-unreviewed'});await writeFile(f.job.catalog,JSON.stringify(catalog));await refuses(f.job,/policy review/)
 catalog.plugins.pop();catalog.plugins[0].bytes++;await writeFile(f.job.catalog,JSON.stringify(catalog));await refuses(f.job,/bytes differ/)
 for(const mutate of [p=>delete p['@deepseek-ai/dsh-llm'],p=>p.extra='1.0.0',p=>p['@deepseek-ai/dsh-llm']='0.2.0']){
  const peers={...readingEntry.peers};mutate(peers)
  const {syntheticUpdateArchive,syntheticUpdateEntry}=await import('./support/market-update-fixture.mjs'),raw=syntheticUpdateArchive('qcu-reading','0.0.1-test.1',{peers}),e=syntheticUpdateEntry('qcu-reading','0.0.1-test.1',raw,'tools')
  await writeFile(join(f.job.archives,e.file),raw);await writeFile(f.job.catalog,JSON.stringify({plugins:[{...e,dshVersions:[e.runtime],summary:e.changes}]}))
  await refuses({...f.job,projections:['legacy','v3']},/依赖/)
 }
})
test('new v3 channel refuses incomplete/arbitrary expanded policies and misplaced reading in old channels',()=>{
 const k=testKeys(),feed=signedFeed(k,'pilot-reading',[readingEntry])
 for(const mutate of [p=>delete p.products['qcu-study-coach'],p=>delete p.products['qcu-reading'],p=>p.products.extra={capability:'tools',peers:{}},p=>p.products['qcu-reading'].capability='skill',p=>p.products['qcu-reading'].peers.extra='1.0.0']){
  const p=structuredClone(k.policy);mutate(p);assert.equal(readingProjectionCapable(p),false);assert.equal(expertProjectionCapable(p),Object.keys(p.products).sort().join()===Object.keys(frozen.expert.products).sort().join());assert.throws(()=>verifyUpdateEnvelope(feed,p),/通道/)
 }
 for(const channel of ['pilot','pilot-experts'])assert.throws(()=>verifyUpdateEnvelope(signedFeed(k,channel,[readingEntry]),k.policy),/产品或能力/)
})
test('actual parser, compiled Client, valid signed envelope and Host reject reading under malformed or reduced policies on every channel',async t=>{
 const dir=await temp(t),keys=testKeys(),proof=[],variants={
  'missing-workspace-peer':p=>delete p.products['qcu-reading'].peers['@deepseek-ai/dsh-workspace'],
  'changed-workspace-peer':p=>p.products['qcu-reading'].peers['@deepseek-ai/dsh-workspace']='0.2.0',
  'extra-peer':p=>p.products['qcu-reading'].peers.unreviewed='1.0.0',
  'missing-unrelated-product':p=>delete p.products['qcu-study-coach'],
  'extra-product':p=>p.products['qcu-unreviewed']={capability:'tools',peers:{}},
  'changed-unrelated-capability':p=>p.products['qcu-study-coach'].capability='tools',
  'changed-reading-capability':p=>p.products['qcu-reading'].capability='skill',
  'reading-only':p=>p.products={'qcu-reading':p.products['qcu-reading']},
  'reading-only-missing-peer':p=>{p.products={'qcu-reading':p.products['qcu-reading']};delete p.products['qcu-reading'].peers['@deepseek-ai/dsh-workspace']},
  'legacy-plus-reading':p=>delete p.products['qcu-expert-teams']
 }
 let compiled
 const client=await readFile(new URL('client.js',root),'utf8')
 vm.runInNewContext(client.replace('return createLoopPlugin(React);','return {parseUpdatePayload};'),{TextEncoder,window:{__ModuleLoader__:{load:m=>compiled=m}}})
 const compiledParser=compiled.factory(()=>({})).parseUpdatePayload
 for(const [name,mutate] of Object.entries(variants))for(const channel of ['pilot','pilot-experts','pilot-reading']){
  const policy=structuredClone(keys.policy);mutate(policy);assert.equal(readingProjectionCapable(policy),false)
  // Keep exact immutable archive/member hashes, but match the malformed policy's
  // declaration. This reproduces the review edge before archive download.
  const entry={...readingEntry,capability:policy.products['qcu-reading'].capability,peers:policy.products['qcu-reading'].peers},envelope=signedFeed(keys,channel,[entry])
  assert.ok(verifySignature(null,Buffer.from(envelope.payload),keys.publicKey,Buffer.from(envelope.signature,'base64')))
  for(const parser of [parseUpdatePayload,compiledParser])assert.throws(()=>parser(envelope.payload,policy),/产品或能力|通道/)
  assert.throws(()=>verifyUpdateEnvelope(envelope,policy),/产品或能力|通道/)
  const calls=[],host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,name+'-'+channel),policy,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(new URL(url).pathname);return response(envelope)}})
  try{
   await assert.rejects(host.check(),/产品或能力|通道/);assert.deepEqual(calls,['/updates.json']);assert.equal(host.feed,null);assert.equal(host.receipts.size,0)
   for(const projection of Object.values(updateProjections))assert.equal(await host.storage.read(projection.state),null)
  }finally{host.dispose()}
  proof.push({policy:name,channel,signatureCryptographicallyValid:true,sourceParser:'rejected',compiledClientParser:'rejected',signedEnvelope:'rejected',host:'rejected before pin/download',requests:calls})
 }
 const valid=signedFeed(keys,'pilot-reading',[readingEntry]),calls=[],host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,'valid'),policy:keys.policy,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(new URL(url).pathname);return response(valid)}})
 try{
  for(const parser of [parseUpdatePayload,compiledParser])assert.equal(parser(valid.payload,keys.policy).entries[0].id,'qcu-reading')
  assert.equal(verifyUpdateEnvelope(valid,keys.policy).entries[0].id,'qcu-reading');await host.check();assert.deepEqual(calls,['/updates-v3.json']);assert.ok(await host.storage.read('state-v3.json'))
 }finally{host.dispose()}
 // A custom legacy fixture retains its original subset-peer contract.
 const custom={publicKey:keys.policy.publicKey,products:{'qcu-study-coach':{capability:'skill',peers:{}}}},entry={...readingEntry,id:'qcu-study-coach',capability:'skill',file:'qcu-study-coach-'+readingEntry.version+'-'+readingEntry.sha256+'.tgz',peers:{}},legacy=signedFeed(keys,'pilot',[entry])
 assert.equal(parseUpdatePayload(legacy.payload,custom).entries[0].id,'qcu-study-coach');assert.equal(verifyUpdateEnvelope(legacy,custom).entries[0].id,'qcu-study-coach')
 await writeFile(join(admissionOut,process.env.QCU_ADMISSION_MARKET_ROOT?'exact-boundary-proof.json':'source-boundary-proof.json'),JSON.stringify({scope:'client/parser policy contract; ephemeral valid signatures; not a production incident',cases:proof,positiveExactV3:'parser, compiled Client, signature and Host accepted',customLegacyFixture:'unchanged subset-peer acceptance'},null,2))
})
test('exact policies select v3/v2/v1; only genuine missing projections permit ordered fallback and separate pins',async t=>{
 const dir=await temp(t),f=await prepareAdmissionFeeds(dir)
 for(const [products,start] of [[updatePolicy.products,'v3'],[expertUpdatePolicy.products,'v2'],[legacyUpdatePolicy.products,'legacy'],[{'qcu-study-coach':legacyUpdatePolicy.products['qcu-study-coach']},'legacy']]){
  const calls=[],missing=new Set(),policy={publicKey:f.keys.policy.publicKey,products},host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,'cache-'+start+'-'+Object.keys(products).length),policy,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(url);const p=Object.keys(updateProjections).find(p=>url.endsWith('/'+updateProjections[p].file));return missing.has(p)?new Response(null,{status:404}):response(f.envelopes[p])}});t.after(()=>host.dispose())
  await host.check();assert.ok(calls[0].endsWith('/'+updateProjections[start].file))
  if(start==='legacy')continue
  missing.add(start);await host.check();assert.ok(await host.storage.read(start==='v3'?'state-v2.json':'state.json'))
  if(start==='v3'){missing.add('v2');await host.check();assert.ok(await host.storage.read('state.json'));assert.ok(await host.storage.read('state-v3.json'))}
 }
})
for(const mode of ['signature','tampering','timeout','expired','origin','redirect404','wrong404','oversize','channel','500','cancel'])test('v3 must not fall back on '+mode,async t=>{
 const dir=await temp(t),k=testKeys(),calls=[],good=signedFeed(k,'pilot-reading',[readingEntry]);let host
 host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,'cache'),policy:k.policy,runtime:'0.2.0-rc.2',fetcher:async(url,{signal})=>{
  calls.push(url);signal.throwIfAborted()
  if(mode==='timeout')throw new DOMException('Synthetic timeout','TimeoutError')
  if(mode==='cancel'){host.cancel();return new Response(null,{status:404})}
  if(mode==='500')return new Response(null,{status:500})
  if(['origin','redirect404','wrong404'].includes(mode))return {status:mode==='origin'?200:404,url:url+'/wrong',redirected:mode==='redirect404',headers:new Headers(),body:null}
  if(mode==='oversize')return new Response('large',{headers:{'content-length':'524289'}})
  if(mode==='expired')return response(signedFeed(k,'pilot-reading',[readingEntry],7,Date.now()-2*86400000))
  if(mode==='channel'){
   const {syntheticUpdateArchive,syntheticUpdateEntry}=await import('./support/market-update-fixture.mjs'),raw=syntheticUpdateArchive('qcu-study-coach','0.0.1-test.1',{peers:updatePolicy.products['qcu-study-coach'].peers})
   return response(signedFeed(k,'pilot-experts',[syntheticUpdateEntry('qcu-study-coach','0.0.1-test.1',raw)],7))
  }
  return response({...good,...(mode==='tampering'?{payload:good.payload.replace('pilot.4','pilot.5')}:{signature:'A'.repeat(86)+'=='})})
 }});t.after(()=>host.dispose());await assert.rejects(host.check());assert.equal(calls.length,1);assert.equal(host.feed,null)
 for(const p of Object.values(updateProjections))assert.equal(await host.storage.read(p.state),null)
})
test('v3 404 permits v2 but a validly signed wrong channel on v2 stops before v1 or state writes',async t=>{
 const dir=await temp(t),f=await prepareAdmissionFeeds(dir),calls=[]
 const host=new MarketUpdates({profileDir:join(dir,'profile'),root:join(dir,'cache'),policy:f.keys.policy,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(url);return url.endsWith('/updates-v3.json')?new Response(null,{status:404}):response(f.envelopes.legacy)}});t.after(()=>host.dispose())
 await assert.rejects(host.check(),/通道与请求地址/);assert.deepEqual(calls.map(u=>new URL(u).pathname),['/updates-v3.json','/updates-v2.json'])
 for(const p of Object.values(updateProjections))assert.equal(await host.storage.read(p.state),null)
})
test('v3 high-water, replay, per-projection equivocation and stale prepare survive reopening storage',async t=>{
 const dir=await temp(t),f=await prepareAdmissionFeeds(dir),calls=[];let current=f.envelopes.v3,missing=false
 const options={profileDir:join(dir,'profile'),root:join(dir,'cache'),policy:f.keys.policy,runtime:'0.2.0-rc.2',fetcher:async url=>{calls.push(url);return missing&&url.endsWith('updates-v3.json')?new Response(null,{status:404}):response(current)}}
 let host=new MarketUpdates(options);await host.check();const pin=await host.storage.read('state-v3.json');host.dispose();host=new MarketUpdates(options);t.after(()=>host.dispose());await host.check()
 current=signedFeed(f.keys,'pilot-reading',[readingEntry],6);await assert.rejects(host.check(),/回退/)
 current=signedFeed(f.keys,'pilot-reading',[readingEntry],7);await assert.rejects(host.check(),/同修订/)
 missing=true;current=signedFeed(f.keys,'pilot-experts',JSON.parse(f.envelopes.v2.payload).entries,6);await assert.rejects(host.check(),/回退/);assert.equal(await host.storage.read('state-v2.json'),null)
 assert.deepEqual(await host.storage.read('state-v3.json'),pin)
})
for(const enabled of [false,true])test('actual reading .4 update preparation/consent/cancel/stale/journal/restart preserves config and enabled='+enabled,async t=>{
 const dir=await temp(t),profile=join(dir,'profile'),local=join(profile,'node_modules/qcu-reading'),k=testKeys(),{syntheticUpdateArchive,syntheticUpdateEntry}=await import('./support/market-update-fixture.mjs')
 const previous=syntheticUpdateArchive('qcu-reading','0.1.0-pilot.3',{peers:readingEntry.peers}),old=syntheticUpdateEntry('qcu-reading','0.1.0-pilot.3',previous,'tools');await materialize(previous,local)
 await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'qcu-reading':'file:synthetic-old.tgz'},dsh:{profile:{bundles:enabled?['qcu-reading']:[]}}}));const patch='[{"id":"qcu-reading","config":{"teacherChoice":"keep"}}]\n';await writeFile(join(profile,'cordis.patch.yml'),patch)
 let installed=old.version,boot='before',installs=0,downloads=0,revision=7;const now=Date.now()
 const inv=()=>({bundles:[{name:'qcu-reading',version:installed,installed:true,optional:false,removable:true,enabled,rows:[{rowId:'qcu-reading',moduleName:'qcu-reading',entryId:'row:reading'}],overrides:[]}],rows:[{moduleName:'qcu-reading',entryId:'row:reading',patchId:'qcu-reading',enabled,fiberPhase:enabled?'active':null}]})
 const options={profileDir:profile,root:join(dir,'cache'),policy:k.policy,runtime:'0.2.0-rc.2',inventory:async()=>inv(),fetcher:async url=>{if(url.endsWith('/updates-v3.json'))return response(signedFeed(k,'pilot-reading',[old,readingEntry],revision,now));downloads++;assert.ok(url.endsWith('/plugins/'+readingEntry.file));return new Response(readingRaw,{headers:{'content-length':String(readingRaw.length)}})}}
 let host=new MarketUpdates({...options,bootId:boot});const ok=value=>({ok:true,value}),call=fn=>async(...a)=>ok(await fn(...a))
 const remote={qcuMarket:{status:call(()=>JSON.stringify(marketRuntime)),updatesCheck:call(s=>host.check(s)),updatesPrepare:call((i,key,s)=>host.prepare(i,key,s)),updatesVerify:call(i=>host.verify(i)),updatesCancel:call(i=>host.cancel(i)),updatesJournal:call((i,r)=>host.journal(i,r)),updatesRecovery:call(()=>host.recovery()),updatesAcknowledge:call((i,s)=>host.acknowledge(i,s))},pluginManager:{listBundles:call(()=>inv().bundles),listPlugins:call(()=>inv().rows),inspect:call(()=>({status:'accepted',kind:'tarball',bundle:null,registry:null})),installBundle:call(async(path,options)=>{assert.equal(options.enabled,false);assert.equal(hash(await readFile(path)),readingEntry.sha256);installs++;await materialize(readingRaw,local);installed=readingEntry.version;return {application:'restart-required',stage:'enable',bundle:'qcu-reading',target:'qcu-reading',enabled:false}})}}
 let flow=new MarketUpdateFlow(remote);t.after(()=>{flow.dispose();host.dispose()})
 await flow.check();assert.equal(downloads,0);assert.equal(installs,0);await flow.prepare('qcu-reading');assert.equal(flow.state.phase,'review',flow.state.message);const receipt=flow.state.review.receipt;await flow.decline();assert.equal(installs,0);await assert.rejects(host.verify(receipt.id),/过期/)
 await flow.prepare('qcu-reading');await writeFile(join(profile,'cordis.patch.yml'),patch+' ');await flow.confirm();assert.equal(installs,0);assert.equal(flow.state.phase,'error');await writeFile(join(profile,'cordis.patch.yml'),patch)
 await flow.check();await flow.prepare('qcu-reading');const stale=flow.state.review.receipt;revision++;await host.check();await assert.rejects(host.verify(stale.id),/过期/);await flow.decline()
 await flow.check();await flow.prepare('qcu-reading');await flow.confirm();assert.equal(installs,1);assert.equal(flow.state.phase,'restart',flow.state.message);const journal=JSON.parse(await host.recovery());assert.equal(journal.bundleEnabled,enabled);assert.equal(journal.state,'pending');await flow.check();assert.equal(flow.state.phase,'restart')
 flow.dispose();host.dispose();host=new MarketUpdates({...options,bootId:'after'});flow=new MarketUpdateFlow(remote);await flow.check();assert.equal(flow.state.phase,'complete',flow.state.message);assert.equal(JSON.parse(await host.recovery()).state,'verified');assert.equal(installs,1);assert.equal(await readFile(join(profile,'cordis.patch.yml'),'utf8'),patch)
 await writeFile(join(admissionOut,'reading-update-'+enabled+(process.env.QCU_ADMISSION_MARKET_ROOT?'-exact':'')+'.json'),JSON.stringify({actualTarget:readingEntry.sha256,previous:'synthetic fixture, not real pilot.3',officialAdapter:'mock; no native install',enabled,configPreserved:true,cancelAndStaleRefused:true,installs,downloads,restart:'fresh Host/Flow, verified journal',journal},null,2))
})
