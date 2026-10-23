import {createHash,verify as verifySignature} from 'node:crypto'
import {join,dirname} from 'node:path'
import {homedir} from 'node:os'
import {realpath,lstat,open,link,unlink} from 'node:fs/promises'
import {updatePolicy} from './update-policy.mjs'
import {updateAssert,updateExact,parseUpdatePayload,updateCandidate,updateReleaseKey,updateOrigin} from './update-model.mjs'
import {inspectUpdateArchive} from './update-archive.mjs'
import {UpdateStorage,ownedUpdateDir,regularUpdateBytes} from './update-storage.mjs'
const digest=b=>createHash('sha256').update(b).digest('hex')
export function verifyUpdateEnvelope(envelope,policy=updatePolicy,now=Date.now()){
 updateExact(envelope,['payload','signature'])
 updateAssert(typeof envelope.payload==='string'&&typeof envelope.signature==='string'&&/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature),'签名格式无效')
 updateAssert(verifySignature(null,Buffer.from(envelope.payload),policy.publicKey,Buffer.from(envelope.signature,'base64')),'发布者签名校验失败')
 return parseUpdatePayload(envelope.payload,policy,now)
}
async function boundedUpdateFetch(url,cap,fetcher,signal){
 const response=await fetcher(url,{redirect:'manual',credentials:'omit',headers:{'Accept-Encoding':'identity'},signal:AbortSignal.any([AbortSignal.timeout(30000),...(signal?[signal]:[])])})
 try{
  updateAssert(response.status===200&&!response.redirected&&(!response.url||response.url===url),'网络返回异常或发生跳转')
  updateAssert(!response.headers.get('content-encoding')||response.headers.get('content-encoding')==='identity','不接受压缩传输')
  const length=response.headers.get('content-length');updateAssert(length!==null&&/^\d+$/.test(length)&&Number(length)>0&&Number(length)<=cap&&response.body,'网络内容大小无效')
  const chunks=[];let count=0
  for await(const chunk of response.body){signal?.throwIfAborted();count+=chunk.length;updateAssert(count<=Number(length)&&count<=cap,'网络内容过大');chunks.push(chunk)}
  updateAssert(count===Number(length),'网络内容不完整');return Buffer.concat(chunks)
 }finally{if(response.body&&!response.body.locked)await response.body.cancel().catch(()=>{})}
}
export class MarketUpdates{
 constructor({profileDir,runtime,marketVersion,inventory,bootId=`${process.pid}:${performance.timeOrigin}`,root,policy=updatePolicy,fetcher=fetch,now=()=>Date.now()}={}){
  this.profileDir=profileDir;this.runtime=runtime;this.marketVersion=marketVersion;this.readInventory=inventory;this.bootId=bootId;this.root=root??join(homedir(),'.cache','qcu-market-updates','profile-'+digest(Buffer.from(profileDir??'unavailable')).slice(0,24));this.policy=policy;this.fetcher=fetcher;this.now=now;this.storage=new UpdateStorage(this.root);this.feed=null;this.fingerprint=null;this.receipts=new Map();this.pending=null;this.disposed=false
 }
 ensureFeed(){updateAssert(!this.disposed&&this.feed&&Date.parse(this.feed.expiresAt)>this.now(),'请重新检查更新；当前清单无效或已过期')}
 find(key){this.ensureFeed();const e=this.feed.entries.find(e=>updateReleaseKey(e)===key);updateAssert(e&&!e.withdrawn&&e.runtime===this.runtime&&e.upgradePolicy==='preserve-config-no-migration','目标版本不可直接升级');return e}
 async installed(id){
  updateAssert(this.policy.products[id]&&this.profileDir,'缺少当前profile信息，无法核对安装来源')
  const manifestBytes=await regularUpdateBytes(join(this.profileDir,'package.json'),1048576),manifest=JSON.parse(manifestBytes.toString('utf8'))
  let patch=Buffer.alloc(0);try{patch=await regularUpdateBytes(join(this.profileDir,'cordis.patch.yml'),1048576)}catch(e){if(e.code!=='ENOENT')throw e}
  const configurationDigest=digest(patch),inventoryFingerprint=digest(Buffer.concat([manifestBytes,patch]))
  if(!Object.hasOwn(manifest.dependencies??{},id))return {version:null,verified:false,notInstalled:true,reason:'未在当前profile安装'}
  const root=await realpath(join(this.profileDir,'node_modules',id)),stat=await lstat(root)
  updateAssert(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid(),'安装目录无效')
  const pkg=JSON.parse((await regularUpdateBytes(join(root,'package.json'),1048576)).toString('utf8'))
  const release=this.feed.entries.find(e=>e.id===id&&e.version===pkg.version)
  if(pkg.name!==id||!release)return {version:typeof pkg.version==='string'?pkg.version:null,verified:false,reason:'版本来源不在已审核记录中'}
  try{
   for(const f of release.files){
    let parent=dirname(f.path)
    while(parent!=='.'){const s=await lstat(join(root,parent));updateAssert(s.isDirectory()&&!s.isSymbolicLink(),'安装包包含链接目录');parent=dirname(parent)}
    const b=await regularUpdateBytes(join(root,f.path),f.bytes);updateAssert(b.length===f.bytes&&digest(b)===f.sha256,'安装文件与审核记录不符')
   }
   return {version:pkg.version,verified:true,inventoryFingerprint,configurationDigest,reason:'安装文件与已签名的发行记录一致'}
  }catch{return {version:pkg.version,verified:false,reason:'安装文件已变更或无法核对，请在官方页面处理'}}
 }
 async candidates(){
  const items=[]
  for(const id of Object.keys(this.policy.products)){
   let installed
   try{installed=await this.installed(id)}catch{installed={version:null,verified:false,reason:'无法读取当前安装信息'}}
   const candidate=updateCandidate(this.feed.entries,id,installed.version,this.runtime),target=candidate.target
   items.push({id,installedVersion:installed.version,sourceVerified:installed.verified,sourceReason:installed.reason,configurationDigest:installed.configurationDigest??null,state:!installed.verified&&!installed.notInstalled?'source-unknown':candidate.state,latest:candidate.latest,target:target?{key:updateReleaseKey(target),id,version:target.version,file:target.file,bytes:target.bytes,sha256:target.sha256,changes:target.changes,runtime:target.runtime,capability:target.capability,peers:target.peers}:null})
  }return items
 }
 async check(signal){
  updateAssert(!this.pending&&!this.disposed,'已有更新操作进行中')
  const abort=new AbortController();this.pending=abort;this.feed=null;this.receipts.clear()
  try{
   const raw=await boundedUpdateFetch(updateOrigin+'/updates.json',524288,this.fetcher,AbortSignal.any([abort.signal,...(signal?[signal]:[])])),envelope=JSON.parse(raw.toString('utf8')),feed=verifyUpdateEnvelope(envelope,this.policy,this.now()),fingerprint=digest(Buffer.from(envelope.payload)),saved=await this.storage.read('state.json')
   if(saved){updateExact(saved,['revision','fingerprint','envelope']);updateAssert(Number.isSafeInteger(saved.revision)&&saved.revision>0&&/^[a-f0-9]{64}$/.test(saved.fingerprint),'本地更新状态损坏');updateAssert(feed.revision>saved.revision||feed.revision===saved.revision&&fingerprint===saved.fingerprint,'更新清单发生回退或同修订内容变化')}
   await this.storage.write('state.json',{revision:feed.revision,fingerprint,envelope});abort.signal.throwIfAborted();updateAssert(!this.disposed,'市场已关闭')
   this.feed=feed;this.fingerprint=fingerprint
   return JSON.stringify({revision:feed.revision,fingerprint,expiresAt:feed.expiresAt,checkedAt:this.now(),bootId:this.bootId,runtime:this.runtime,items:await this.candidates()})
  }finally{this.pending=null}
 }
 async download(entry,signal){
  await ownedUpdateDir(this.root);const path=join(this.root,entry.file)
  try{const raw=await regularUpdateBytes(path,entry.bytes);inspectUpdateArchive(raw,entry);return path}catch(e){if(e.code!=='ENOENT')throw e}
  const raw=await boundedUpdateFetch(updateOrigin+'/plugins/'+entry.file,entry.bytes,this.fetcher,signal);inspectUpdateArchive(raw,entry)
  const temp=join(this.root,'.partial-'+crypto.randomUUID());let file
  try{file=await open(temp,'wx',0o400);await file.writeFile(raw);await file.sync();await file.close();file=null;signal?.throwIfAborted();try{await link(temp,path)}catch(e){if(e.code!=='EEXIST')throw e};inspectUpdateArchive(await regularUpdateBytes(path,entry.bytes),entry);return path}finally{await file?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e})}
 }
 async prepare(id,key,signal){
  updateAssert(!this.pending&&!this.disposed,'已有更新操作进行中');this.ensureFeed();const entry=this.find(key),abort=new AbortController();this.pending=abort
  try{const installed=await this.installed(entry.id);updateAssert(installed.verified&&installed.version&&updateCandidate(this.feed.entries,entry.id,installed.version,this.runtime).target?.version===entry.version,'安装来源或目标版本已变化，请重新检查');const combined=AbortSignal.any([abort.signal,...(signal?[signal]:[])]),path=await this.download(entry,combined);combined.throwIfAborted();this.ensureFeed();updateAssert(!this.disposed,'市场已关闭');const receipt={id,product:entry.id,fromVersion:installed.version,fromFingerprint:installed.inventoryFingerprint,version:entry.version,key,path,sha256:entry.sha256,bytes:entry.bytes,revision:this.feed.revision,fingerprint:this.fingerprint,expiresAt:Math.min(this.now()+300000,Date.parse(this.feed.expiresAt))};this.receipts.clear();this.receipts.set(id,receipt);return JSON.stringify(receipt)}finally{this.pending=null}
 }
 async verify(id){
  this.ensureFeed();const receipt=this.receipts.get(id);updateAssert(receipt&&receipt.expiresAt>this.now()&&receipt.fingerprint===this.fingerprint,'升级准备已过期，请重新核对')
  const entry=this.find(receipt.key),installed=await this.installed(entry.id);updateAssert(installed.verified&&installed.version===receipt.fromVersion&&installed.inventoryFingerprint===receipt.fromFingerprint,'已安装内容或配置变化，原升级确认失效')
  inspectUpdateArchive(await regularUpdateBytes(receipt.path,entry.bytes),entry);this.ensureFeed();updateAssert(this.receipts.get(id)===receipt&&receipt.expiresAt>this.now()&&receipt.fingerprint===this.fingerprint,'升级准备已变化或过期');return JSON.stringify(receipt)
 }
 cancel(id){this.pending?.abort();this.receipts.delete(id);return '{}'}
 async inventory(id){
  updateAssert(this.readInventory,'官方库存服务不可用')
  const {bundles,rows}=await this.readInventory(),matches=bundles.filter(b=>b.name===id)
  updateAssert(matches.length===1,'包数量不符');const bundle=matches[0]
  updateAssert(bundle.installed&&!bundle.optional&&bundle.removable&&!bundle.error&&!bundle.readOnlyReason&&bundle.rows?.length===1&&bundle.rows[0].rowId===id&&bundle.rows[0].moduleName===id&&bundle.overrides?.length===0,'安装来源、组件或权限需要官方页面核对')
  const component=rows.filter(r=>r.moduleName===id)
  updateAssert(component.length<=1&&(!bundle.enabled||component.length===1)&&component.every(r=>r.patchId===id&&!r.readOnlyReason&&r.entryId===bundle.rows[0].entryId),'组件状态不符')
  return {bundle,rows:component}
 }
 async journal(receiptId,requestId){
  const r=JSON.parse(await this.verify(receiptId));const previous=await this.storage.read('journal.json')
  updateAssert(!previous||previous.state==='verified'||previous.state==='failed','上次升级尚待核对，请先检查升级结果')
  const inv=await this.inventory(r.product),source=await this.installed(r.product)
  updateAssert(inv.bundle.version===r.fromVersion&&source.verified&&source.inventoryFingerprint===r.fromFingerprint,'升级前库存已变化')
  await this.storage.write('journal.json',{product:r.product,fromVersion:r.fromVersion,version:r.version,sha256:r.sha256,requestId,state:'pending',createdAt:this.now(),bootId:this.bootId,configurationDigest:source.configurationDigest,bundleEnabled:inv.bundle.enabled,rowEnabled:inv.rows[0]?.enabled??null});return '{}'
 }
 async recovery(){
  const record=await this.storage.read('journal.json');if(!record)return 'null'
  updateExact(record,['product','fromVersion','version','sha256','requestId','state','createdAt','bootId','configurationDigest','bundleEnabled','rowEnabled']);updateAssert(this.policy.products[record.product]&&/^[a-f0-9]{64}$/.test(record.sha256)&&/^[a-f0-9]{64}$/.test(record.configurationDigest)&&typeof record.bootId==='string'&&typeof record.bundleEnabled==='boolean'&&(record.rowEnabled===null||typeof record.rowEnabled==='boolean')&&['pending','verified','failed'].includes(record.state),'升级核对记录无效');return JSON.stringify(record)
 }
 async acknowledge(requestId,state){
  const record=JSON.parse(await this.recovery());updateAssert(record?.state==='pending'&&record.requestId===requestId&&['verified','failed'].includes(state),'升级核对记录不匹配');this.ensureFeed();const installed=await this.installed(record.product),inv=await this.inventory(record.product)
  updateAssert(installed.verified&&installed.version===(state==='verified'?record.version:record.fromVersion),'安装文件尚未核对')
  if(state==='verified')updateAssert(record.bootId!==this.bootId&&installed.configurationDigest===record.configurationDigest&&inv.bundle.enabled===record.bundleEnabled&&(record.rowEnabled===null||inv.rows[0]?.enabled===record.rowEnabled)&&(!record.bundleEnabled||!record.rowEnabled||inv.rows[0]?.fiberPhase==='active')&&(record.product!=='qcu-market'||this.marketVersion===record.version),'尚未在新进程核对目标版本、配置和组件')
  await this.storage.write('journal.json',{...record,state});return '{}'
 }
 dispose(){this.disposed=true;this.pending?.abort();this.receipts.clear()}
}
