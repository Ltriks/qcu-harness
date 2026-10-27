// P16 read-only audit: two fixed trust domains, exact channels and static TGZ identity.
import {readFile,lstat} from 'node:fs/promises'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash,createPublicKey} from 'node:crypto'
import {verifyCatalog,productionOrigin} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
import {verifyUpdateEnvelope} from '../hub/plugins/qcu-market/src/update-host.mjs'
import {compareUpdateVersions} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {publicTrust} from '../hub/plugins/qcu-market/src/public-trust.mjs'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
import {inspectProductArchive,archiveJson} from './product-polish-archive.mjs'
const releaseSpec=JSON.parse(await readFile(new URL('../releases/qcu-teacher-product-polish.json',import.meta.url)))
const releaseSchema=JSON.parse(await readFile(new URL('../releases/qcu-teacher-product-polish.schema.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const need=(v,m)=>{if(!v)throw Error(m)}
const canonicalVersions=v=>JSON.stringify(Object.entries(v??{}).sort())
export const freshness=(expires,issued,now)=>issued>now+120000?'future':expires<=now?'expired':expires-now<72*3600000?'near-expiry':'fresh'
async function bytes(root,name,cap){
 need(typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(name)&&!name.split('/').some(p=>['..','.',''].includes(p)),'unsafe-path')
 const target=join(root,name)
 for(let p=target;;p=dirname(p)){const s=await lstat(p);need(!s.isSymbolicLink(),'unsafe-link');if(p===dirname(p))break}
 const s=await lstat(target);need(s.isFile()&&s.nlink===1&&s.size<=cap,'unsafe-file');const b=await readFile(target);need(b.length<=cap,'size');return b
}
export async function httpBytes(origin,path,cap,fetcher=fetch,signal=AbortSignal.timeout(10000)){
 need(['/market/catalog.signed.json','/updates.json','/updates-v2.json'].includes(path)||/^\/plugins\/qcu-[a-z0-9-]+-[0-9][a-z0-9.-]*-[a-f0-9]{64}\.tgz$/.test(path),'path')
 const url=origin+path,r=await fetcher(url,{redirect:'manual',credentials:'omit',headers:{'Accept-Encoding':'identity'},signal})
 try{
  need(!r.redirected&&(!r.url||r.url===url),'redirect');if(r.status===404)return null
  need(r.status===200&&(!r.headers.get('content-encoding')||r.headers.get('content-encoding')==='identity'),'http')
  const n=r.headers.get('content-length');need(n&&/^\d+$/.test(n)&&Number(n)>0&&Number(n)<=cap&&r.body,'http-size')
  const chunks=[];let size=0;for await(const c of r.body){size+=c.length;need(size<=Number(n)&&size<=cap,'http-size');chunks.push(c)}
  need(size===Number(n),'http-length');return Buffer.concat(chunks)
 }finally{if(r.body&&!r.body.locked)await r.body.cancel().catch(()=>{})}
}
export async function audit({root,now=Date.now(),http=false,fetcher=fetch,trust=publicTrust,policy=updatePolicy,test=false,releaseOnly=false}={}){
 need(Number.isSafeInteger(now)&&now>0,'clock');need(!(http&&releaseOnly),'audit-mode');need(test||trust===publicTrust&&policy===updatePolicy,'pins')
 const origin=test?trust.origin:productionOrigin,signal=AbortSignal.timeout(10000),cache=new Map()
 const load=async(name,cap=524288)=>{if(cache.has(name))return cache.get(name);const b=await(http?httpBytes(origin,'/'+name,cap,fetcher,signal):bytes(resolve(root),name,cap).catch(e=>{if(e.code==='ENOENT')return null;throw e}));cache.set(name,b);return b}
 const report={schema:1,scope:releaseOnly?'release-input-only':'public-snapshot',trustDomain:test?'synthetic-fixture':'fixed-production-public-pins',checkedAt:new Date(now).toISOString(),source:http?'explicit-http':'staged-input',catalog:{verification:'unavailable'},updates:{verification:'unavailable'},expertFeed:{state:'unavailable'},descriptor:{state:'unconfigured'},coverage:{state:'not-checked',rows:[],gaps:[]},failures:[]}
 const fail=area=>{if(!report.failures.includes(area))report.failures.push(area)}
 const archive=async e=>{const b=await load('plugins/'+e.file,1048576);need(b&&b.length===e.bytes&&sha(b)===e.sha256,'archive');return inspectProductArchive(b,e,{policy})}
 let catalog=null,legacy=null,experts=null,expertMissing=false
 if(!releaseOnly){
  try{
   const raw=await load('market/catalog.signed.json');need(raw,'missing')
   const a=verifyCatalog(raw,trust,{now,test,allowExpired:true}),p=a.payload;catalog=a.catalog
   report.catalog={verification:'signature-verified',fingerprint:a.fingerprint,keyId:trust.keyId,revision:p.revision,issuedAt:new Date(p.issuedAt).toISOString(),expiresAt:new Date(p.expiresAt).toISOString(),freshness:freshness(p.expiresAt,p.issuedAt,now),productCount:a.catalog.entries.length,integrity:'pending',http:http?'pending':'not-checked'}
   if(['expired','future'].includes(report.catalog.freshness))fail('catalog.time')
   for(const item of a.catalog.entries)await archive(item.release)
   report.catalog.integrity='verified';if(http)report.catalog.http='verified'
  }catch{report.catalog.integrity='failed';if(http)report.catalog.http='failed';fail('catalog.verification-or-integrity')}
  const checkUpdate=async(name,channel)=>{
   const raw=await load(name);if(!raw)return null
   const envelope=archiveJson(raw),parsed=archiveJson(Buffer.from(envelope.payload)),expires=Date.parse(parsed.expiresAt),issued=Date.parse(parsed.issuedAt)
   const feed=verifyUpdateEnvelope(envelope,policy,Math.max(issued,Math.min(now,expires-1)))
   need(feed.channel===channel,'feed-channel')
   for(const e of feed.entries)await archive(e)
   const meta={verification:'signature-and-integrity-verified',channel:feed.channel,fingerprint:sha(Buffer.from(envelope.payload)),envelopeSha256:sha(raw),keyId:sha(createPublicKey(policy.publicKey).export({format:'der',type:'spki'})),revision:feed.revision,issuedAt:feed.issuedAt,expiresAt:feed.expiresAt,freshness:freshness(expires,issued,now),entryCount:feed.entries.length,http:http?'verified':'not-checked'}
   return {feed,meta}
  }
  try{const r=await checkUpdate('updates.json','pilot');need(r,'missing');legacy=r.feed;report.updates=r.meta;if(['expired','future'].includes(r.meta.freshness))fail('updates.time')}catch{fail('updates.verification-or-integrity-or-channel')}
  try{const r=await checkUpdate('updates-v2.json','pilot-experts');expertMissing=!r;experts=r?.feed??null;report.expertFeed=r?{state:'verified',...r.meta}:{state:'supported-legacy-fallback',message:'未提供专家更新源，支持回退旧更新源；版本覆盖另行核对。'};if(r&&['expired','future'].includes(r.meta.freshness))fail('expert-feed.time')}catch{report.expertFeed={state:'invalid'};fail('expert-feed.verification-or-channel')}
  if(catalog){
   const latest=(feed,id)=>feed?.entries.filter(e=>e.id===id&&!e.withdrawn).sort((a,b)=>compareUpdateVersions(b.version,a.version))[0]??null
   const effective=experts??(expertMissing?legacy:null),ids=new Set([...catalog.entries.map(e=>e.id),...(legacy?.entries??[]).map(e=>e.id),...(experts?.entries??[]).map(e=>e.id)])
   const rows=[...ids].map(id=>{
    const item=catalog.entries.find(e=>e.id===id),current=item?.release,a=latest(legacy,id),b=latest(experts,id),target=latest(effective,id)
    const state=!current?'update-only':!effective?'unavailable':!target?'not-in-updates':compareUpdateVersions(current.version,target.version)>0?'catalog-newer':current.version===target.version?(current.sha256===target.sha256?'covered':'identity-mismatch'):'update-newer'
    return {id,title:item?.title??(id==='qcu-market'?'工具市场':id),catalogVersion:current?.version??null,legacyLatest:a?.version??null,expertLatest:b?.version??null,effectiveLatest:target?.version??null,effectiveSource:experts?'updates-v2.json':expertMissing?'updates.json':'unavailable',state,action:['catalog-newer','not-in-updates','identity-mismatch'].includes(state)?'初装目录与更新覆盖不一致。请独立审核缺失版本并以更高修订更新清单，保留原信任策略；不要直接改公钥或放行候选。':state==='unavailable'?'更新源未通过核验，请先检查签名、通道、有效期和固定归档。':state==='update-only'?'此产品仅在更新清单中，不会自动加入工具市场目录。':'无需自动更改，初装与更新授权仍各自独立。'}
   })
   const gaps=rows.filter(r=>['catalog-newer','not-in-updates','identity-mismatch','unavailable'].includes(r.state))
   report.coverage={state:gaps.length?'gaps':'consistent',rows,gaps};if(gaps.length)fail('coverage.gaps')
  }
 }
 if(!http)try{
  const raw=await bytes(resolve(root),'release.json',131072),d=archiveJson(raw)
  need(Object.keys(d).sort().join()===releaseSchema.required.slice().sort().join(),'descriptor-fields')
  need(d.schema===1&&d.taskId==='QCU-TEACHER-PRODUCT-POLISH'&&d.status==='candidate-not-published'&&d.appRelease===null&&d.supportedRuntime==='0.2.0-rc.2'&&Array.isArray(d.archives)&&d.archives.length===2,'descriptor')
  need(canonicalVersions(d.versions)===canonicalVersions(releaseSpec.versions),'versions')
  need(new Set(d.archives.map(e=>e.id)).size===2&&d.archives.every(e=>e.version===releaseSpec.versions[e.id==='qcu-branding'?'branding':'market']&&['qcu-branding','qcu-market'].includes(e.id)),'identities')
  const inspected=[]
  for(const e of d.archives){
   need(Object.keys(e).sort().join()==='bytes,id,path,sha256,version'&&typeof e.sha256==='string'&&/^[a-f0-9]{64}$/.test(e.sha256)&&e.path.endsWith('/'+e.id+'-'+e.version+'-'+e.sha256+'.tgz'),'archive-fields')
   const b=await bytes(resolve(root),e.path,1048576);need(b.length===e.bytes&&sha(b)===e.sha256,'archive')
   const inventory=archiveJson(await bytes(resolve(root),dirname(e.path)+'/MANIFEST.json',131072));need(inventory.version===e.version&&inventory.sha256===e.sha256&&inventory.bytes===e.bytes,'inventory')
   const actual=inspectProductArchive(b,e,{policy,branding:e.id==='qcu-branding',inventory:inventory.files});inspected.push({id:actual.id,version:actual.version,memberCount:actual.memberCount})
  }
  report.descriptor={state:'verified',status:d.status,appRelease:null,versions:d.versions,supportedRuntime:d.supportedRuntime,archives:d.archives.map(({path,...e})=>e),identities:inspected}
 }catch(e){if(releaseOnly||e.code!=='ENOENT'){report.descriptor={state:'invalid'};fail('descriptor.identity-or-inventory')}}
 report.ok=report.failures.length===0;return report
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),root=args[args.indexOf('--root')+1];need(args.includes('--root')&&root,'root-required');const clock=args.includes('--now')?Date.parse(args[args.indexOf('--now')+1]):Date.now();const result=await audit({root,now:clock,http:args.includes('--http'),releaseOnly:args.includes('--release-only')});console.log(JSON.stringify(result));process.exitCode=result.ok?0:2}catch{console.log(JSON.stringify({ok:false,failures:['audit.configuration']}));process.exitCode=2}
}

