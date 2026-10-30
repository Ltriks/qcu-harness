// Immutable input bytes only. Never import or execute the incoming reading package.
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join,dirname} from 'node:path'
import {generateKeyPairSync,sign,createHash} from 'node:crypto'
import {updatePolicy} from '../../hub/plugins/qcu-market/src/update-policy.mjs'
import {archiveFingerprint,readUpdateArchive} from '../../hub/plugins/qcu-market/src/update-archive.mjs'
import {syntheticUpdateArchive,syntheticUpdateEntry} from './market-update-fixture.mjs'
import {prepareMarketUpdates} from '../../scripts/publish-market-updates.mjs'
const admissionBase=resolve('.work/qcu-reading-market-admission')
export const admissionBaseline=join(admissionBase,'baseline')
export const admissionOut=resolve(process.env.QCU_ADMISSION_OUT??admissionBase)
export const readingRoot='/Users/mcq/Artifacts/qcu-harness/0.1.0-reading.4'
export const readingSource='2a157b356f6af7a9c8d467ddf7c55701fbc33bff'
export const hash=raw=>createHash('sha256').update(raw).digest('hex')
export const readingMeta=JSON.parse(await readFile(join(readingRoot,'handoff/submission.json')))
export const readingRaw=await readFile(join(readingRoot,'packages',readingMeta.archive.file))
assert.equal(hash(readingRaw),'d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50')
assert.equal(readingRaw.length,628171)
export const readingEntry={id:readingMeta.id,version:readingMeta.version,...readingMeta.archive,runtime:readingMeta.runtime,capability:'tools',changes:'材料伴读 pilot.4：固定包本机签名链路测试；原生安装与教师业务尚未验收。',upgradePolicy:'preserve-config-no-migration',withdrawn:false,files:archiveFingerprint(readingRaw),peers:readingMeta.peerDependencies}
export const testKeys=()=>{const keys=generateKeyPairSync('ed25519');return {...keys,policy:{...updatePolicy,publicKey:keys.publicKey.export({format:'pem',type:'spki'})}}}
export function signedFeed(keys,channel,entries,revision=7,now=Date.now()){
 const payload=JSON.stringify({schemaVersion:1,channel,revision,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),entries})
 return {payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64')}
}
export async function materialize(raw,directory){
 for(const [name,bytes] of readUpdateArchive(raw)){await mkdir(dirname(join(directory,name)),{recursive:true});await writeFile(join(directory,name),bytes)}
}
export async function prepareAdmissionFeeds(directory,{marketDir}={}){
 const keys=testKeys(),archives=join(directory,'archives'),plugins=[];await mkdir(archives,{recursive:true})
 const records=[[readingRaw,readingEntry]]
 for(const id of ['qcu-study-coach','qcu-expert-teams']){
  const raw=syntheticUpdateArchive(id,'0.0.1-test.1',{peers:updatePolicy.products[id].peers})
  records.push([raw,syntheticUpdateEntry(id,'0.0.1-test.1',raw,updatePolicy.products[id].capability)])
 }
 if(marketDir){const manifest=JSON.parse(await readFile(join(marketDir,'MANIFEST.json'))),raw=await readFile(join(marketDir,manifest.file));records.push([raw,syntheticUpdateEntry('qcu-market',manifest.version,raw,'market')])}
 for(const [raw,e] of records){await writeFile(join(archives,e.file),raw);plugins.push({id:e.id,version:e.version,file:e.file,bytes:e.bytes,sha256:e.sha256,dshVersions:[e.runtime],summary:e.changes})}
 plugins.push({id:'qcu-deliberate-synthetic-omission',version:'0.0.1-test.1',synthetic:true})
 const catalog=join(directory,'catalog.json');await writeFile(catalog,JSON.stringify({plugins}))
 const job={catalog,archives,revision:7,projections:['legacy','v2','v3'],issuedAt:new Date(Date.now()-1000).toISOString()},feeds=join(directory,'feeds')
 const review=await prepareMarketUpdates(job,keys.privateKey,feeds,keys.policy),envelopes={}
 for(const [p,file] of [['legacy','updates.json'],['v2','updates-v2.json'],['v3','updates-v3.json']])envelopes[p]=JSON.parse(await readFile(join(feeds,file)))
 return {keys,job,review,envelopes,records,feeds,plugins}
}
