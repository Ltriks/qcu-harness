import {createHash,createPublicKey,verify,randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {lstat,mkdir,open,link,unlink,readdir} from 'node:fs/promises'
import {resolve,dirname,join} from 'node:path'
import {homedir} from 'node:os'
import {parseMarketCatalog} from './catalog-core.mjs'
export const productionOrigin='http://192.168.1.68:8080'
export const authorityLimit=524288
export const authorityDigest=raw=>createHash('sha256').update(raw).digest('hex')
const need=(v,m)=>{if(!v)throw Error('Catalog authority: '+m)}
export function canonical(value,depth=0){
 need(depth<=20,'nesting')
 if(Array.isArray(value))return '['+value.map(v=>canonical(v,depth+1)).join(',')+']'
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}'
 return JSON.stringify(value)
}
const exact=(o,keys)=>need(o&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join()===keys.sort().join(),'fields')
export function strictJson(raw,limit=authorityLimit){
 need(Buffer.isBuffer(raw)&&raw.length<=limit,'size')
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),value=JSON.parse(text)
 need(canonical(value)===text,'noncanonical or duplicate JSON');return value
}
function base64(value,max){need(typeof value==='string'&&value.length<=max&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'base64');const b=Buffer.from(value,'base64');need(b.toString('base64')===value,'base64');return b}
export function validateTrust(trust,{test=false}={}){
 exact(trust,['schema','keyId','origin','spki'])
 need(trust.schema===1&&/^[a-f0-9]{64}$/.test(trust.keyId),'trust identity')
 need(trust.origin===productionOrigin||(test&&/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(trust.origin)),'origin')
 const der=base64(trust.spki,128),key=createPublicKey({key:der,format:'der',type:'spki'})
 need(key.asymmetricKeyType==='ed25519'&&key.export({format:'der',type:'spki'}).equals(der)&&authorityDigest(der)===trust.keyId,'pinned key');return key
}
export function verifyCatalog(raw,trust,{now=Date.now(),test=false,allowExpired=false}={}){
 const key=validateTrust(trust,{test}),envelope=strictJson(raw)
 exact(envelope,['schema','keyId','payload','signature']);need(envelope.schema===1&&envelope.keyId===trust.keyId,'envelope identity')
 const bytes=base64(envelope.payload,350000),signature=base64(envelope.signature,88)
 need(signature.length===64&&verify(null,bytes,key,signature),'signature')
 const payload=strictJson(bytes,262144)
 exact(payload,['domain','schema','origin','revision','issuedAt','expiresAt','catalog','withdrawn'])
 need(payload.domain==='QCU-MARKET-CATALOG/ED25519/V1'&&payload.schema===1&&payload.origin===trust.origin,'protocol or source')
 need(Number.isSafeInteger(payload.revision)&&payload.revision>0,'revision')
 need(Number.isSafeInteger(payload.issuedAt)&&Number.isSafeInteger(payload.expiresAt)&&payload.issuedAt>0&&payload.expiresAt>payload.issuedAt&&payload.expiresAt-payload.issuedAt<=30*86400000,'time bounds')
 need(allowExpired||(payload.issuedAt<=now+120000&&payload.expiresAt>now),'expired or future')
 const catalog=parseMarketCatalog(JSON.stringify(payload.catalog),{dynamic:true,origin:trust.origin})
 need(catalog.revision===payload.revision,'revision mismatch')
 need(Array.isArray(payload.withdrawn)&&payload.withdrawn.length<=100&&new Set(payload.withdrawn).size===payload.withdrawn.length&&payload.withdrawn.every(id=>/^qcu-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&!catalog.entries.some(e=>e.id===id)),'withdrawals')
 return {catalog,payload,fingerprint:authorityDigest(raw)}
}
// Private, plugin-owned roots only. Refuse symlink ancestors, including /tmp on macOS.
export async function privateDirectory(root,{create=false}={}){
 need(resolve(root)===root,'absolute state path')
 const parts=[];for(let p=root;;p=dirname(p)){parts.unshift(p);if(p===dirname(p))break}
 let parent
 for(const p of parts){try{const s=await lstat(p);need(s.isDirectory()&&!s.isSymbolicLink(),'unsafe ancestor');parent=s}catch(e){if(e.code!=='ENOENT'||!create)throw e;need(parent?.uid===process.getuid(),'unowned parent for private state');await mkdir(p,{mode:0o700});parent=await lstat(p)}}
 const s=await lstat(root);need(s.uid===process.getuid()&&(s.mode&0o777)===0o700,'private state permissions');return root
}
export async function privateRead(path,limit=authorityLimit){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK)
 try{const s=await f.stat();need(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&s.size<=limit,'unsafe state file');const raw=await f.readFile();need(raw.length<=limit,'state size');return raw}finally{await f.close()}
}
export async function immutableWrite(root,name,bytes){
 const tmp='.pending-'+randomUUID();let f
 try{f=await open(join(root,tmp),'wx',0o600);await f.writeFile(bytes);await f.sync();await f.close();f=null;await link(join(root,tmp),join(root,name));const d=await open(root,constants.O_RDONLY);try{await d.sync()}finally{await d.close()}}
 finally{await f?.close();await unlink(join(root,tmp)).catch(e=>{if(e.code!=='ENOENT')throw e})}
}
export class CatalogAuthority{
 constructor(trust,{root=join(homedir(),'.cache','qcu-market-authority'),fetcher=fetch,now=()=>Date.now(),test=false}={}){
  validateTrust(trust,{test});this.trust=trust;this.root=root;this.fetcher=fetcher;this.now=now;this.test=test;this.accepted=null;this.state='unavailable';this.message='尚未验证签名目录';this.running=null
 }
 snapshot(){return {mode:'dynamic',state:this.state,message:this.message,catalog:this.accepted?.catalog||{schemaVersion:4,protocol:4,revision:1,entries:[]},fingerprint:this.accepted?.fingerprint||null,lastRefresh:this.lastRefresh||null}}
 async highWater(){
  let high={revision:0,fingerprint:null}
  for(const name of await readdir(this.root))if(/^revision-[1-9][0-9]*\.json$/.test(name)){
   const v=strictJson(await privateRead(join(this.root,name),1024),1024);exact(v,['revision','fingerprint']);need(Number.isSafeInteger(v.revision)&&v.revision>0&&name===`revision-${v.revision}.json`&&/^[a-f0-9]{64}$/.test(v.fingerprint),'watermark');if(v.revision>high.revision)high=v
  }return high
 }
 async refresh(){if(this.running)return this.running;this.running=this.load();try{return await this.running}finally{this.running=null}}
 async load(){
  try{
   await privateDirectory(this.root,{create:true})
   const url=this.trust.origin+'/market/catalog.signed.json',signal=AbortSignal.timeout(10000),r=await this.fetcher(url,{redirect:'manual',credentials:'omit',headers:{'Accept-Encoding':'identity'},signal})
   let raw;try{need(r.status===200&&!r.redirected&&(!r.url||r.url===url)&&(!r.headers.get('content-encoding')||r.headers.get('content-encoding')==='identity'),'HTTP');const length=r.headers.get('content-length');need(length&&/^[0-9]+$/.test(length)&&Number(length)<=authorityLimit,'HTTP size');const chunks=[];let size=0;for await(const b of r.body){size+=b.length;need(size<=authorityLimit,'HTTP size');chunks.push(b)}raw=Buffer.concat(chunks);need(raw.length===Number(length),'HTTP length')}finally{if(r.body&&!r.body.locked)await r.body.cancel().catch(()=>{})}
   const accepted=verifyCatalog(raw,this.trust,{now:this.now(),test:this.test}),v={revision:accepted.payload.revision,fingerprint:accepted.fingerprint}
   const high=await this.highWater();need(v.revision>=high.revision&&(v.revision!==high.revision||v.fingerprint===high.fingerprint),'replay or equivocation')
   try{await immutableWrite(this.root,`revision-${v.revision}.json`,Buffer.from(canonical(v)))}catch(e){if(e.code!=='EEXIST')throw e}
   const actual=await this.highWater();need(actual.revision===v.revision&&actual.fingerprint===v.fingerprint,'concurrent replay or equivocation')
   this.accepted=accepted;this.state='fresh';this.message='签名目录已验证';this.lastRefresh=this.now()
  }catch(e){this.state=this.accepted?'stale':'unavailable';this.message='签名目录不可用；安装与启用已停止：'+e.message;this.lastRefresh=this.now()}
  return this.snapshot()
 }
 async require(fingerprint,key){const s=await this.refresh();need(s.state==='fresh'&&s.fingerprint===fingerprint&&s.catalog.entries.some(e=>`${e.release.id}@${e.release.version}+${e.release.sha256}`===key),'authority changed; review again');return s}
}
