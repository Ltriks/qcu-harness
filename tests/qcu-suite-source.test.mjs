// Every actual ZIP teaching module is verified by an ephemeral-key signed local feed.
import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,createHash} from 'node:crypto'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {prepareMarketUpdates} from '../scripts/publish-market-updates.mjs'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {MarketUpdates} from '../hub/plugins/qcu-market/src/update-host.mjs'
import {readUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
const out=resolve(process.env.QCU_SUITE_SOURCE_OUT??'.work/suite-integration-b/source-proof'),operator=resolve('.work/suite-integration-b/operator'),profile=resolve(process.env.QCU_INTEGRATED_PREPARED_PROFILE)
test('all eleven ZIP teaching modules source-verified; course1.3 stays current and legacy parser accepts only legacy',async()=>{
 await mkdir(out);const keys=generateKeyPairSync('ed25519'),policy={...updatePolicy,publicKey:keys.publicKey.export({type:'spki',format:'pem'})},now=Date.now()
 const review=await prepareMarketUpdates({catalog:join(operator,'catalog.json'),archives:join(operator,'archives'),revision:19,issuedAt:new Date(now-1000).toISOString(),projections:['legacy','v2']},keys.privateKey,join(out,'feeds'),policy)
 const legacy=JSON.parse(await readFile(join(out,'feeds/updates.json'))),v2=JSON.parse(await readFile(join(out,'feeds/updates-v2.json')))
 const catalog=JSON.parse(await readFile(join(operator,'catalog.json'))),old=catalog.plugins.find(p=>p.id==='qcu-market'&&p.version==='0.1.0-pilot.15.1'),members=readUpdateArchive(await readFile(join(operator,'archives',old.file)))
 const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),{parseUpdatePayload}=await load(members.get('src/update-model.mjs')),{updatePolicy:oldPolicy}=await load(members.get('src/update-policy.mjs'))
 assert.equal(parseUpdatePayload(legacy.payload,oldPolicy,now).channel,'pilot');assert.throws(()=>parseUpdatePayload(v2.payload,oldPolicy,now),/通道/)
 const calls=[],host=new MarketUpdates({profileDir:profile,root:join(out,'cache'),runtime:'0.2.0-rc.2',policy,now:()=>now,fetcher:async url=>{calls.push(url);assert.match(url,/\/updates-v2.json$/);const bytes=Buffer.from(JSON.stringify(v2));return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}})
 try{
  const result=JSON.parse(await host.check());assert.equal(calls.length,1);assert.equal(result.items.length,11)
  for(const row of result.items){assert.equal(row.sourceVerified,true,row.id);assert.equal(row.state,'current',row.id);assert.equal(row.target,null,row.id)}
  const course=result.items.find(p=>p.id==='qcu-course-workbench');assert.equal(course.installedVersion,'0.1.0-pilot.1.3');assert.equal(course.latest,'0.1.0-pilot.1.3')
  const {writeFile}=await import('node:fs/promises');await writeFile(join(out,'RESULT.json'),JSON.stringify({passed:true,actualZipProfile:profile,review,ephemeralKeyOnly:true,oldParserAcceptsLegacyRejectsV2:true,channelBinding:{legacy:'pilot',v2:'pilot-experts'},items:result.items,metadataRequests:1,archiveDownloads:0,installCalls:0,enableCalls:0,modelCalls:0,productionPublished:false},null,2)+'\n')
 }finally{host.dispose()}
})
