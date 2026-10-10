import {bundledCatalog,catalogSha256} from './bundled-catalog.mjs'
import {releaseKeyOf,findMarketRelease} from './catalog-core.mjs'
import { marketRuntime } from './remote-contract.mjs'
import { release } from './trusted-release.mjs'
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const failure=e=>e?.message||String(e)
export function unwrap(answer){if(!answer?.ok)throw new Error(answer?.error?.message||'官方服务不可用');return answer.value}
export async function readCoach(manager,entry=release){
  const bundles=unwrap(await manager.listBundles()),bundle=bundles.find(b=>b.name===entry.id)
  if(!bundle?.installed)return {state:'not-installed'}
  if(bundle.version!==entry.version)return {state:'conflict',reason:'已有其他版本，请在官方插件页单独审核处理。'}
  if(bundle.error)return {state:'failed',reason:typeof bundle.error==='string'?bundle.error:(bundle.error.code||'官方加载失败')}
  if(!bundle.enabled)return {state:'installed-disabled'}
  const rows=unwrap(await manager.listPlugins()).filter(r=>r.moduleName===entry.id)
  if(rows.length!==1)return {state:'conflict',reason:'组件数量不符；不猜测组件标识。'}
  const row=rows[0]
  if(row.fiberPhase==='failed')return {state:'failed',reason:'官方加载器报告失败。'}
  if(!row.enabled)return {state:'row-disabled',entryId:row.entryId}
  return {state:row.fiberPhase==='active'?'component-active':'restart-or-pending',entryId:row.entryId}
}
export class DirectMarketFlow {
  constructor(remote,{entry=release,catalog=bundledCatalog,fingerprint=catalogSha256,peers=null,uuid=()=>crypto.randomUUID(),now=()=>Date.now()}={}){
    this.remote=remote;this.entry=entry;this.catalog=catalog;this.fingerprint=fingerprint;this.releaseKey=releaseKeyOf(entry);this.peers=peers;this.uuid=uuid;this.now=now;this.listeners=new Set();this.state={phase:'idle',status:null,review:null,message:'',result:null};this.generation=0;this.pending=null;this.request=null;this.disposed=false
    this.unlisten=remote.$on?.('plugin-manager/install-state',p=>this.progress(p))
  }
  snapshot=()=>this.state
  subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  set(next){if(this.disposed)return;this.state={...this.state,...next};for(const fn of this.listeners)fn()}
  guard(){if(this.peers?.some(f=>f!==this&&(f.pending||f.request||f.state.review)))throw new Error('其他条目已有操作进行中；请先完成或取消');if(this.disposed)throw new Error('市场已关闭');if(this.pending||this.request)throw new Error('已有操作进行中；请等待或核对结果')}
  valid(n){if(this.disposed||n!==this.generation)throw new Error('操作已取消或目录已变化')}
  checkReceipt(r){if(!r||r.catalogSha256!==this.fingerprint||r.releaseKey!==this.releaseKey||!same(findMarketRelease(this.catalog,this.releaseKey),this.entry)||!same(r.entry,this.entry)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt<=this.now()||typeof r.path!=='string'||!r.path.startsWith('/')||!r.path.endsWith('/'+this.entry.file))throw new Error('包来源、目录或有效期已变化；请重新准备并确认')}
  async checkHost(){
    let actual
    try{actual=JSON.parse(unwrap(await this.remote.qcuMarket.status()))}catch(e){throw new Error('市场 Host 尚未就绪；如刚更新或重装，请正常退出并重新打开 DSH 后再检查。未发起安装。详情：'+failure(e))}
    if(!same(actual,{...marketRuntime,catalogSha256:this.fingerprint}))throw new Error('市场 Host 与界面版本不一致，请正常重启 DSH 后再检查；未发起安装。')
  }
  async status(){this.guard();const n=++this.generation;this.pending={kind:'status'};this.set({phase:'checking',review:null,message:''});try{await this.checkHost();this.valid(n);const s=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);this.set({phase:'idle',status:s})}catch(e){if(n===this.generation)this.set({phase:'error',status:null,message:failure(e)})}finally{this.pending=null}}
  async prepare(){
    this.guard();const n=++this.generation,id=this.uuid(),abort=new AbortController();this.pending={kind:'prepare',id,abort};this.set({phase:'preparing',review:null,message:'',result:null})
    try{
      await this.checkHost();this.valid(n)
      const status=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);if(status.state!=='not-installed'){this.set({phase:'idle',status});return}
      const receipt=JSON.parse(unwrap(await this.remote.qcuMarket.prepare(id,this.releaseKey,abort.signal)));this.valid(n);this.checkReceipt(receipt);if(receipt.id!==id)throw new Error('包凭据不匹配')
      const inspected=unwrap(await this.remote.pluginManager.inspect(receipt.path,{},abort.signal));this.valid(n)
      if(inspected.status!=='accepted')throw new Error(inspected.reason||'官方包检查未通过')
      if(inspected.kind!=='tarball')throw new Error('官方检查的包格式不符')
      this.set({phase:'review',status,review:{kind:'install',receipt,inspected},message:''})
    }catch(e){if(n===this.generation)this.set({phase:'error',review:null,message:failure(e)})}finally{this.pending=null}
  }
  async confirmInstall(){
    this.guard();const review=this.state.review;if(this.state.phase!=='review'||review?.kind!=='install')throw new Error('请先查看并确认安装信息')
    const n=++this.generation,abort=new AbortController();this.pending={kind:'verify',id:review.receipt.id,abort};this.set({phase:'verifying',review:null,message:''})
    try{
      await this.checkHost();this.valid(n);this.checkReceipt(review.receipt)
      const receipt=JSON.parse(unwrap(await this.remote.qcuMarket.verify(review.receipt.id,abort.signal)));this.valid(n);this.checkReceipt(receipt)
      if(!same(receipt,review.receipt))throw new Error('包凭据发生变化；原确认失效')
      const status=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);if(status.state!=='not-installed')throw new Error('本实例状态已变化；原确认失效')
      const inspected=unwrap(await this.remote.pluginManager.inspect(receipt.path,{},abort.signal));this.valid(n)
      if(!same(inspected,review.inspected))throw new Error('官方包检查或安装源发生变化；请重新确认')
      this.checkReceipt(receipt)
      const request={id:this.uuid(),acknowledged:false,cancelRequested:false,cancelInFlight:false};this.request=request;this.pending=null;this.set({phase:'installing',message:'安装中；默认不启用。',result:null})
      let reply
      try{reply=await this.remote.pluginManager.installBundle(receipt.path,{enabled:false,requestId:request.id,registry:inspected.registry})}catch(e){if(this.request===request)this.set({phase:'unconfirmed',message:'安装结果未确认：'+failure(e)});return}
      if(this.request!==request||this.disposed)return
      if(!reply?.ok){this.set({phase:'unconfirmed',message:'安装结果未确认：'+(reply?.error?.message||'连接中断')});return}
      await this.settle(request,reply.value)
    }catch(e){if(n===this.generation)this.set({phase:'error',review:null,message:failure(e)})}finally{this.pending=null}
  }
  async settle(request,result){
    if(this.request!==request||this.disposed)return
    if(!result||!['applied','restart-required','overridden','failed','cancelled'].includes(result.application)){this.set({phase:'unconfirmed',message:'官方返回未知结果；不得重装。'});return}
    if(result.application==='cancelled'){this.request=null;this.set({phase:'cancelled',result,message:'官方已确认取消并恢复安装文件。'});return}
    if(result.application==='failed'||result.application==='overridden'){this.request=null;this.set({phase:'error',result,message:result.error?.message||result.error?.code||'官方拒绝或未按预期应用；不自动重试或授权脚本。'});return}
    if(result.stage!=='enable'||result.target!==this.entry.id||result.bundle!==this.entry.id||result.enabled!==false){this.set({phase:'unconfirmed',result,message:'返回的包或操作不符，请在官方详情核对。'});return}
    this.set({phase:'checking',result})
    try{const status=await readCoach(this.remote.pluginManager,this.entry);if(this.request!==request||this.disposed)return;this.request=null;this.set({phase:status.state==='installed-disabled'?'installed':'unconfirmed',status,result,message:status.state==='installed-disabled'?'已安装，未启用。': '安装返回成功，但当前状态不符；请核对。'})}catch(e){this.set({phase:'unconfirmed',result,message:failure(e)})}
  }
  async decline(){
    this.guard();const id=this.state.review?.receipt?.id;++this.generation;this.set({phase:'declined',review:null,message:'未授权安装；不会重试。'})
    if(id)await this.remote.qcuMarket.cancel(id).catch(()=>{})
  }
  async cancel(){
    if(this.request){this.request.cancelRequested=true;return this.cancelRequest(this.request)}
    const pending=this.pending,id=pending?.id||this.state.review?.receipt?.id;++this.generation;pending?.abort?.abort();this.set({phase:'cancelled',review:null,message:'尚未发起安装，操作已取消。'})
    if(id){try{unwrap(await this.remote.qcuMarket.cancel(id))}catch(e){this.set({message:'未发起安装；下载取消请求未确认：'+failure(e)})}}
  }
  async cancelRequest(request){
    if(this.request!==request||request.cancelInFlight)return
    request.cancelInFlight=true;this.set({phase:'cancelling',message:'等待官方确认取消；关闭界面不等于已停止。'})
    try{
      const value=unwrap(await this.remote.pluginManager.cancelInstall(request.id));if(this.request!==request||this.disposed)return
      if(value.status==='cancelled'){this.request=null;this.set({phase:'cancelled',message:'官方已确认取消。'});return}
      if(value.status==='too-late'){request.acknowledged=true;this.set({phase:'applying',message:'已进入收尾，无法确认取消；请核对结果。'});return}
      this.set({phase:'unconfirmed',message:'取消尚未确认，可能尚未接收请求；不会重新发起安装。'})
    }catch(e){if(this.request===request)this.set({phase:'unconfirmed',message:'取消未确认：'+failure(e)})}finally{request.cancelInFlight=false;if(request.cancelAfterAck){request.cancelAfterAck=false;void this.cancelRequest(request)}}
  }
  progress(p){const request=this.request;if(!request||p.requestId!==request.id)return;const first=!request.acknowledged;request.acknowledged=true;if(p.phase==='applying')this.set({phase:'applying',message:'官方正在应用安装结果。'});if(first&&request.cancelRequested){if(request.cancelInFlight)request.cancelAfterAck=true;else void this.cancelRequest(request)}}
  async reconcile(){const request=this.request;if(!request||request.reconciling)return;request.reconciling=true;try{const result=unwrap(await this.remote.pluginManager.waitForInstall(request.id));if(this.request!==request)return;if(result===null)this.set({phase:'unconfirmed',message:'后端没有保留该任务结果；不代表成功或取消，请在官方详情核对。'});else await this.settle(request,result)}catch(e){this.set({phase:'unconfirmed',message:failure(e)})}finally{request.reconciling=false}}
  async reviewEnable(kind){
    this.guard();const n=++this.generation;this.pending={kind:'enable-check'};this.set({phase:'checking',review:null,message:''})
    try{const status=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);if((kind==='bundle'&&status.state!=='installed-disabled')||(kind==='row'&&status.state!=='row-disabled'))throw new Error('当前状态不支持此启用操作')
      this.set({phase:'review',status,review:{kind,entry:JSON.stringify(this.entry),status}})
    }catch(e){this.set({phase:'error',message:failure(e)})}finally{this.pending=null}
  }
  async confirmEnable(){
    this.guard();const review=this.state.review;if(this.state.phase!=='review'||!['bundle','row'].includes(review?.kind))throw new Error('缺少启用确认')
    const n=++this.generation;this.pending={kind:'enable'};this.set({phase:'enabling',review:null,message:''})
    try{await this.checkHost();this.valid(n);const status=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);if(review.entry!==JSON.stringify(this.entry)||!same(status,review.status))throw new Error('目录或组件状态变化；原确认失效')
      const result=unwrap(await (review.kind==='bundle'?this.remote.pluginManager.setBundleEnabled(this.entry.id,true):this.remote.pluginManager.setPluginEnabled(status.entryId,true)));this.valid(n)
      if(!['applied','restart-required'].includes(result.application)){this.set({phase:'error',result,message:result.error?.message||result.error?.code||'官方未应用启用；不重试。'});return}
      const next=await readCoach(this.remote.pluginManager,this.entry);this.valid(n);this.set({phase:'idle',status:next,result,message:result.application==='restart-required'?'需要你正常重启应用；此处不执行重启。':'启用操作已返回；以当前组件状态为准。'})
    }catch(e){if(n===this.generation)this.set({phase:'error',message:'启用结果需核对：'+failure(e)})}finally{this.pending=null}
  }
  invalidate(){const receiptId=this.state.review?.receipt?.id;if(receiptId)void this.remote.qcuMarket.cancel(receiptId).catch(()=>{});++this.generation;this.pending?.abort?.abort();if(!this.request)this.set({phase:'error',status:null,review:null,message:'连接或目录变化，原确认已作废；已发出的启用操作需重新检查。'})}
  dispose(){this.disposed=true;++this.generation;this.pending?.abort?.abort();const id=this.pending?.id||this.state.review?.receipt?.id;if(id)void this.remote.qcuMarket.cancel(id).catch(()=>{});if(this.request)void this.remote.pluginManager.cancelInstall(this.request.id).catch(()=>{});this.unlisten?.();this.listeners.clear()}
}

export function createCatalogFlows(remote,{catalog=bundledCatalog,fingerprint=catalogSha256}={}){const flows=[];for(const item of catalog.entries)flows.push(new DirectMarketFlow(remote,{entry:item.release,catalog,fingerprint,peers:flows}));return flows}
