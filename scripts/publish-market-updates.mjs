// Offline release preparation only. Never uploads, installs, or runs archive code.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash,sign,createPublicKey} from 'node:crypto'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {parseUpdatePayload,updateProjections,sameUpdateProducts} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {archiveFingerprint,readUpdateArchive,inspectUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
const digest=raw=>createHash('sha256').update(raw).digest('hex')
// Explicit policy injection is for ephemeral-key offline tests; the CLI always uses the pinned policy.
export async function prepareMarketUpdates(job,privateKey,output,policy=updatePolicy){
 if(createPublicKey(privateKey).export({type:'spki',format:'pem'})!==policy.publicKey)throw Error('Publisher key does not match pinned public key')
 if(!Array.isArray(job.projections)||!job.projections.length||new Set(job.projections).size!==job.projections.length||job.projections.some(p=>typeof p!=='string'||!Object.hasOwn(updateProjections,p)))throw Error('Explicit projections required: legacy, v2, v3 (nonempty, unique)')
 if(!Object.values(updateProjections).some(p=>sameUpdateProducts(policy.products,p.products)))throw Error('Unreviewed update product policy')
 const catalog=JSON.parse(await readFile(job.catalog,'utf8')),entries=[],synthetic=[]
 for(const e of catalog.plugins){
  if(e.synthetic){synthetic.push({id:e.id,version:e.version,reason:'explicit synthetic catalog entry; no update admission'});continue}
  if(!Object.hasOwn(policy.products,e.id))throw Error('Product needs separate policy review: '+e.id)
  const raw=await readFile(join(job.archives,e.file))
  if(raw.length!==e.bytes||digest(raw)!==e.sha256)throw Error('Archive bytes differ: '+e.file)
  const members=readUpdateArchive(raw),pkg=JSON.parse(members.get('package.json').toString('utf8'))
  const record={id:e.id,version:e.version,file:e.file,bytes:e.bytes,sha256:e.sha256,runtime:e.dshVersions[0],capability:policy.products[e.id].capability,changes:e.summary,upgradePolicy:'preserve-config-no-migration',withdrawn:false,files:archiveFingerprint(raw),peers:pkg.peerDependencies??{}}
  inspectUpdateArchive(raw,record);entries.push(record)
 }
 const issuedAt=job.issuedAt??new Date().toISOString(),expiresAt=new Date(Date.parse(issuedAt)+7*86400000).toISOString(),outputs=[]
 // Validate excluded real entries too: omission is never a policy-review bypass.
 const admission=Object.values(updateProjections).find(p=>sameUpdateProducts(policy.products,p.products))
 parseUpdatePayload(JSON.stringify({schemaVersion:1,channel:admission.channel,revision:job.revision,issuedAt,expiresAt,entries}),policy,Date.parse(issuedAt))
 // Validate every projection before writing any feed; unsupported products are never silently dropped.
 for(const projection of job.projections){
  const {products,file,channel}=updateProjections[projection]
  if(Object.keys(products).some(id=>!Object.hasOwn(policy.products,id)))throw Error('Projection requires its exact reviewed policy: '+projection)
  const selected=entries.filter(e=>Object.hasOwn(products,e.id)),omissions=[...synthetic,...entries.filter(e=>!Object.hasOwn(products,e.id)).map(e=>({id:e.id,version:e.version,reason:'not supported by frozen '+projection+' policy; excluded from this projection'}))]
  const payload=JSON.stringify({schemaVersion:1,channel,revision:job.revision,issuedAt,expiresAt,entries:selected})
  parseUpdatePayload(payload,{publicKey:policy.publicKey,products},Date.parse(issuedAt))
  outputs.push({projection,file,payloadSha256:digest(Buffer.from(payload)),archives:selected.length,omissions,envelope:{payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64')}})
 }
 await mkdir(output,{recursive:true})
 for(const {file,envelope} of outputs)await writeFile(join(output,file),JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o644})
 const review={revision:job.revision,issuedAt,expiresAt,status:'offline-prepared-not-published',feeds:outputs.map(({envelope,...review})=>review)}
 await writeFile(join(output,'updates-review.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'})
 return review
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [jobPath,keyPath,output]=process.argv.slice(2)
 if(!jobPath||!keyPath||!output)throw Error('Usage: node scripts/publish-market-updates.mjs JOB_JSON PRIVATE_KEY OUTPUT_DIRECTORY (job.projections is required)')
 const review=await prepareMarketUpdates(JSON.parse(await readFile(jobPath,'utf8')),await readFile(keyPath),output)
 console.log(JSON.stringify(review))
}
