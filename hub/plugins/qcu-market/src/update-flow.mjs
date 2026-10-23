import {unwrap} from './direct-flow.mjs'
import {marketRuntime} from './remote-contract.mjs'
import {updateAssert,compareUpdateVersions,updateReleaseKey} from './update-model.mjs'
const updateSame=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const updateCopy=v=>JSON.parse(JSON.stringify(v))
export async function readUpgradeInventory(manager,id){
 const matches=unwrap(await manager.listBundles()).filter(b=>b.name===id);updateAssert(matches.length===1,'包数量不符')
 const bundle=matches[0]
 updateAssert(bundle.installed&&!bundle.optional&&bundle.removable&&!bundle.error&&!bundle.readOnlyReason&&bundle.rows?.length===1&&bundle.rows[0].rowId===id&&bundle.rows[0].moduleName===id&&bundle.overrides?.length===0,'安装来源、组件或权限需要官方页面核对')
 const rows=unwrap(await manager.listPlugins()).filter(r=>r.moduleName===id)
 updateAssert(rows.length<=1&&(!bundle.enabled||rows.length===1)&&rows.every(r=>r.patchId===id&&!r.readOnlyReason&&r.entryId===bundle.rows[0].entryId),'组件状态不符')
 return updateCopy({bundle,rows})
}
export class MarketUpdateFlow{
 constructor(remote,{peers=()=>[],gate=null,now=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}){this.remote=remote;this.peers=peers;this.gate=gate;this.now=now;this.uuid=uuid;this.state={phase:'idle',check:null,review:null,message:'',journal:null};this.listeners=new Set();this.pending=null;this.request=null;this.disposed=false;this.generation=0}
 snapshot=()=>this.state
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 set(patch){if(this.disposed)return;this.state={...this.state,...patch};for(const f of this.listeners)f()}
 locked=()=>Boolean(this.pending||this.request||this.state.review||this.state.journal?.state==='pending')
 guardPeers(){updateAssert(!this.gate?.refreshing,'目录刷新进行中；请等待刷新完成');updateAssert(!this.peers().some(f=>f.pending||f.request||f.activation||f.state.review),'其他产品已有操作进行中')}
 guard(readOnly=false){this.guardPeers();updateAssert(!this.disposed&&!this.pending&&(!this.request||readOnly&&['unconfirmed','error'].includes(this.state.phase))&&!this.state.review,'已有更新操作进行中');if(!readOnly)updateAssert(!this.state.journal||this.state.journal.state!=='pending','上次升级尚待核对')}
 valid(n){updateAssert(!this.disposed&&n===this.generation,'操作已取消或连接变化')}
 async host(){const actual=JSON.parse(unwrap(await this.remote.qcuMarket.status()));updateAssert(updateSame(actual,marketRuntime),'市场Host与界面版本不一致，请正常重启DSH')}
 async guardJournal(){const record=JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()));if(record?.state==='pending'){this.set({journal:record,phase:'unconfirmed',message:'上次升级尚待核对，请到版本管理检查更新或核对官方任务。'});throw Error('上次升级尚待核对，请先到版本管理处理')}return record}
 async check(){
  this.guard(true);const n=++this.generation,abort=new AbortController();this.pending={kind:'check',abort};this.set({phase:'checking',review:null,message:''})
  try{await this.host();this.valid(n);const journal=JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()));this.valid(n);this.set({journal});const check=JSON.parse(unwrap(await this.remote.qcuMarket.updatesCheck(abort.signal)));this.valid(n);updateAssert(check&&Number.isSafeInteger(check.revision)&&Array.isArray(check.items)&&typeof check.fingerprint==='string','更新结果无效');this.set({check,journal,phase:'idle',message:'已检查更新；检查不会安装或启用任何产品。'});if(journal?.state==='pending')await this.reconcileObserved(journal,check,n)}
  catch(e){if(n===this.generation)this.set({phase:'error',check:null,message:e.message})}finally{this.pending=null}
 }
 receipt(r,target){updateAssert(r&&r.id&&r.product===target.id&&r.key===target.key&&r.version===target.version&&r.sha256===target.sha256&&r.bytes===target.bytes&&r.fingerprint===this.state.check?.fingerprint&&r.revision===this.state.check?.revision&&r.expiresAt>this.now()&&typeof r.path==='string'&&r.path.startsWith('/')&&r.path.endsWith('/'+target.file),'升级准备、来源或有效期已变化')}
 async prepare(id){
  this.guard();const candidate=this.state.check?.items.find(e=>e.id===id),target=candidate?.target
  updateAssert(candidate?.state==='available'&&candidate.sourceVerified&&target&&compareUpdateVersions(target.version,candidate.installedVersion)>0,'请先检查更新并核对安装来源')
  const n=++this.generation,receiptId=this.uuid(),abort=new AbortController();this.pending={kind:'prepare',id:receiptId,abort};this.set({phase:'preparing',message:'正在下载并校验新版，尚未安装。'})
  try{await this.host();await this.guardJournal();this.valid(n);const inventory=await readUpgradeInventory(this.remote.pluginManager,id);this.valid(n);updateAssert(inventory.bundle.version===candidate.installedVersion,'已安装版本变化，请重新检查');const receipt=JSON.parse(unwrap(await this.remote.qcuMarket.updatesPrepare(receiptId,target.key,abort.signal)));this.valid(n);this.receipt(receipt,target);updateAssert(receipt.id===receiptId&&receipt.fromVersion===inventory.bundle.version,'升级准备不匹配');const inspected=unwrap(await this.remote.pluginManager.inspect(receipt.path,{},abort.signal));this.valid(n);updateAssert(inspected.status==='accepted'&&inspected.kind==='tarball','官方包检查未通过');this.set({phase:'review',review:{target,receipt,inventory,inspected},message:''})}
  catch(e){if(n===this.generation)this.set({phase:'error',review:null,message:e.message})}finally{this.pending=null}
 }
 async confirm(){
  const review=this.state.review;updateAssert(!this.pending&&!this.request&&review&&this.state.phase==='review'&&!this.disposed,'请先核对新版');this.guardPeers()
  const n=++this.generation;this.pending={kind:'verify'};this.set({phase:'verifying',review:null,message:'正在复核本次升级确认。'})
  let journalWritten=false
  try{
   await this.host();this.valid(n);await this.guardJournal();this.valid(n);this.receipt(review.receipt,review.target)
   const receipt=JSON.parse(unwrap(await this.remote.qcuMarket.updatesVerify(review.receipt.id)));this.valid(n);updateAssert(updateSame(receipt,review.receipt),'升级准备发生变化');const inventory=await readUpgradeInventory(this.remote.pluginManager,review.target.id);this.valid(n);updateAssert(updateSame(inventory,review.inventory),'安装内容或启用状态变化，原确认失效');const inspected=unwrap(await this.remote.pluginManager.inspect(receipt.path,{}));this.valid(n);updateAssert(updateSame(inspected,review.inspected),'官方检查或安装源变化，原确认失效')
   const request={id:this.uuid(),target:review.target,fromVersion:receipt.fromVersion};unwrap(await this.remote.qcuMarket.updatesJournal(receipt.id,request.id));journalWritten=true;this.valid(n)
   const finalReceipt=JSON.parse(unwrap(await this.remote.qcuMarket.updatesVerify(receipt.id)));this.valid(n);updateAssert(updateSame(finalReceipt,receipt)&&updateSame(await readUpgradeInventory(this.remote.pluginManager,review.target.id),inventory),'确认后状态发生变化，未发起安装')
   this.request=request;this.pending=null;this.set({phase:'installing',message:'正在升级；保留原启用状态。请勿重复安装。'})
   let answer
   try{answer=await this.remote.pluginManager.installBundle(receipt.path,{enabled:false,requestId:request.id,registry:inspected.registry})}catch(e){if(!this.disposed)this.set({phase:'unconfirmed',message:'升级结果待核对：'+e.message});return}
   if(this.disposed||this.request!==request)return
   if(!answer?.ok){this.set({phase:'unconfirmed',message:'升级结果待核对；不会重复发起安装。'});return}
   await this.settle(request,answer.value)
  }catch(e){if(journalWritten&&!this.request)try{const record=JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()));unwrap(await this.remote.qcuMarket.updatesAcknowledge(record.requestId,'failed'));journalWritten=false}catch{};if(n===this.generation)this.set({phase:journalWritten?'unconfirmed':'error',review:null,message:e.message});if(journalWritten)try{this.set({journal:JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()))})}catch{}}
  finally{this.pending=null}
 }
 async settle(request,result){
  if(this.request!==request||this.disposed)return
  const journal=JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()));this.set({journal})
  if(!result||!['applied','restart-required','failed','cancelled','overridden'].includes(result.application)){this.set({phase:'unconfirmed',message:'官方返回未知结果，请只读核对。'});return}
  if(['failed','cancelled'].includes(result.application)){
   // A known official reply can close the attempt only if the original installed package is still observed.
   const inv=await readUpgradeInventory(this.remote.pluginManager,request.target.id)
   if(inv.bundle.version===request.fromVersion){unwrap(await this.remote.qcuMarket.updatesAcknowledge(request.id,'failed'));this.request=null;this.set({phase:'error',journal:{...journal,state:'failed'},message:result.application==='cancelled'?'官方已确认取消。':'官方安装未完成；请查看官方插件页面，未自动重试。'});return}
  }
  if(['applied','restart-required'].includes(result.application)&&result.stage==='enable'&&result.bundle===request.target.id&&result.target===request.target.id&&result.enabled===false){this.request=null;this.set({phase:'restart',message:'新版安装已返回；请正常退出并重新打开DSH，再检查更新核对是否生效。'});return}
  this.set({phase:'unconfirmed',message:'官方结果与预期不符，请在官方插件页面核对；不会自动重试。'})
 }
 async reconcileObserved(record,check,n){
  const item=check.items.find(e=>e.id===record.product),inv=await readUpgradeInventory(this.remote.pluginManager,record.product);this.valid(n)
  if(item?.installedVersion===record.version&&item.sourceVerified&&inv.bundle.version===record.version){
   this.request=null
   if(check.bootId===record.bootId){this.set({phase:'restart',journal:record,message:'新版已安装，当前仍是升级前的进程；请正常重启DSH。'});return}
   updateAssert(item.configurationDigest===record.configurationDigest&&inv.bundle.enabled===record.bundleEnabled&&(record.rowEnabled===null||inv.rows[0]?.enabled===record.rowEnabled),'升级后的配置或启用状态与原记录不符，请到官方页面核对')
   updateAssert(!record.bundleEnabled||!record.rowEnabled||inv.rows[0]?.fiberPhase==='active','新版组件尚未加载，请到官方页面检查')
   if(record.product==='qcu-market')updateAssert(marketRuntime.version===record.version,'市场Host/Client尚未运行目标版本')
   unwrap(await this.remote.qcuMarket.updatesAcknowledge(record.requestId,'verified'));this.request=null;this.set({phase:'complete',journal:{...record,state:'verified'},message:'已在新进程核对目标版本、来源、配置和启用状态；业务调用效果仍需实际验证。'});return
  }
  this.set({phase:'unconfirmed',journal:record,message:'上次升级结果尚未确认；请核对官方任务或前往官方插件页面。不会重新安装。'})
 }
 async reconcile(){
  this.guard(true)
  const record=this.state.journal??JSON.parse(unwrap(await this.remote.qcuMarket.updatesRecovery()));updateAssert(record?.state==='pending','没有待核对升级')
  this.pending={kind:'reconcile'};this.set({phase:'checking',journal:record,message:'正在只读核对官方任务；不会重新安装。'})
  try{await this.host();const result=unwrap(await this.remote.pluginManager.waitForInstall(record.requestId));if(result&&this.request)await this.settle(this.request,result);else this.set({phase:'unconfirmed',message:'官方没有可用的任务结果；不代表安装成功、失败或已取消。请检查更新核对版本，或到官方页面处理。'})}catch(e){this.set({phase:'unconfirmed',message:e.message})}finally{this.pending=null}
 }
 async decline(){const review=this.state.review;++this.generation;this.set({phase:'idle',review:null,message:'已退出本次确认，未发起升级。'});if(review)await this.remote.qcuMarket.updatesCancel(review.receipt.id).catch(()=>{})}
 async cancel(){
  if(this.request){const request=this.request;this.set({phase:'cancelling',message:'正在向官方请求取消；尚未确认停止。'});try{const result=unwrap(await this.remote.pluginManager.cancelInstall(request.id));if(result.status==='cancelled'&&this.request===request){const inv=await readUpgradeInventory(this.remote.pluginManager,request.target.id);updateAssert(inv.bundle.version===request.fromVersion,'取消后版本需核对');unwrap(await this.remote.qcuMarket.updatesAcknowledge(request.id,'failed'));this.request=null;this.set({phase:'error',journal:{...this.state.journal,state:'failed'},message:'官方已确认取消，原版本仍在；未重新安装。'});return}this.set({phase:'unconfirmed',message:result.status==='too-late'?'安装已进入收尾，无法确认取消，请核对结果。':'已请求取消；仍需核对官方任务结果。'})}catch(e){this.set({phase:'unconfirmed',message:e.message})}return}
  const id=this.pending?.id??this.state.review?.receipt.id;++this.generation;this.pending?.abort?.abort();this.set({phase:'idle',review:null,message:'已停止准备；未发起安装。'});if(id)await this.remote.qcuMarket.updatesCancel(id).catch(()=>{})
 }
 invalidate(){const active=this.locked();++this.generation;this.pending?.abort?.abort();this.set({check:null,review:null,phase:this.request||this.state.journal?.state==='pending'?'unconfirmed':active?'error':'idle',message:active?'连接已变化，原确认失效；已发出的升级需只读核对。':''})}
 dispose(){this.disposed=true;++this.generation;this.pending?.abort?.abort();const id=this.pending?.id??this.state.review?.receipt.id;if(id)void this.remote.qcuMarket.updatesCancel(id).catch(()=>{});this.listeners.clear();/* An already sent self-upgrade is owned by the official manager; unmount must not cancel it. */}
}
