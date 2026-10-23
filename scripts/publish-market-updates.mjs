// Offline release preparation only. Never uploads, installs, or runs archive code.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash,sign,createPublicKey} from 'node:crypto'
import {join} from 'node:path'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {parseUpdatePayload} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {archiveFingerprint,readUpdateArchive,inspectUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
const [jobPath,keyPath,output]=process.argv.slice(2)
if(!jobPath||!keyPath||!output)throw Error('Usage: node scripts/publish-market-updates.mjs JOB_JSON PRIVATE_KEY OUTPUT_DIRECTORY')
const job=JSON.parse(await readFile(jobPath,'utf8')),catalog=JSON.parse(await readFile(job.catalog,'utf8')),privateKey=await readFile(keyPath)
if(createPublicKey(privateKey).export({type:'spki',format:'pem'})!==updatePolicy.publicKey)throw Error('Publisher key does not match pinned public key')
const entries=[]
for(const e of catalog.plugins){
 if(e.synthetic)continue
 if(!updatePolicy.products[e.id])throw Error('Product needs separate policy review: '+e.id)
 const raw=await readFile(join(job.archives,e.file))
 if(raw.length!==e.bytes||createHash('sha256').update(raw).digest('hex')!==e.sha256)throw Error('Archive bytes differ: '+e.file)
 const members=readUpdateArchive(raw),pkg=JSON.parse(members.get('package.json').toString('utf8'))
 const record={id:e.id,version:e.version,file:e.file,bytes:e.bytes,sha256:e.sha256,runtime:e.dshVersions[0],capability:updatePolicy.products[e.id].capability,changes:e.summary,upgradePolicy:'preserve-config-no-migration',withdrawn:false,files:archiveFingerprint(raw),peers:pkg.peerDependencies??{}}
 inspectUpdateArchive(raw,record);entries.push(record)
}
const issuedAt=job.issuedAt??new Date().toISOString(),payload=JSON.stringify({schemaVersion:1,channel:'pilot',revision:job.revision,issuedAt,expiresAt:new Date(Date.parse(issuedAt)+7*86400000).toISOString(),entries})
parseUpdatePayload(payload,updatePolicy,Date.parse(issuedAt))
const envelope={payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64')}
await mkdir(output,{recursive:true});await writeFile(join(output,'updates.json'),JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o644})
await writeFile(join(output,'updates-review.json'),JSON.stringify({revision:job.revision,issuedAt,payloadSha256:createHash('sha256').update(payload).digest('hex'),products:Object.keys(updatePolicy.products).length,archives:entries.length,expiresAt:JSON.parse(payload).expiresAt},null,2)+'\n',{flag:'wx'})
console.log('Prepared signed update feed for '+entries.length+' immutable archives; no deployment performed')
