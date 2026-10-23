import {createCatalogFlows,unwrap} from './direct-flow.mjs'
import {marketRuntime} from './remote-contract.mjs'
import {releaseKeyOf} from './catalog-core.mjs'
export class CatalogRuntime{
 constructor(remote,update){this.remote=remote;this.update=update;this.flows=[];this.refreshing=false;this.gate={refreshing:false};this.closed=false}
 busy(){return this.flows.some(f=>f.pending||f.request||f.activation||f.state.review)}
 async refresh(){
  if(this.closed)return
  if(this.refreshing||this.busy()){this.update({refreshMessage:'已有安装、确认或待核对任务；请先完成或取消后刷新。'});return false}
  this.refreshing=true;this.gate.refreshing=true;this.update({refreshing:true,refreshMessage:'正在验证目录…'})
  try{
   let host
   try{host=JSON.parse(unwrap(await this.remote.qcuMarket.status()))}catch(e){throw Error('市场 Host 尚未就绪；如刚更新，请正常退出并重新打开 DSH。详情：'+e.message)}
   if(JSON.stringify(host)!==JSON.stringify(marketRuntime))throw Error('市场 Host 与界面版本不一致，请正常重启 DSH。')
   const s=JSON.parse(unwrap(await this.remote.qcuMarket.refresh()));if(this.closed)return
   if(this.busy()){this.update({refreshMessage:'仍有操作持有状态；保留原任务，请核对后再刷新。'});return false}
   if(!['legacy','dynamic'].includes(s.mode)||!Array.isArray(s.catalog?.entries)||s.catalog.entries.length>100)throw Error('Host 目录结果无效')
   // No index lookup: each flow belongs to an exact immutable release.
   this.flows.forEach(f=>f.dispose());this.flows=createCatalogFlows(this.remote,{catalog:s.catalog,fingerprint:s.fingerprint,dynamic:s.mode==='dynamic',gate:this.gate})
   this.update({catalog:s.catalog,flows:this.flows,flow:this.flows[0]||null,flowByKey:Object.fromEntries(this.flows.map(f=>[releaseKeyOf(f.entry),f])),authority:s,unavailable:s.mode==='dynamic'&&s.state!=='fresh'?s.message:'',refreshMessage:s.message,lastRefresh:s.lastRefresh})
   return true
  }catch(e){this.flows.forEach(f=>f.invalidate());this.update({unavailable:e.message,refreshMessage:e.message});return false}
  finally{this.refreshing=false;this.gate.refreshing=false;if(!this.closed)this.update({refreshing:false})}
 }
 reset(){this.flows.forEach(f=>f.invalidate());this.update({unavailable:'连接变化；请刷新市场重新验证目录。',refreshMessage:'连接已重置，原确认失效。'})}
 dispose(){this.closed=true;this.flows.forEach(f=>f.dispose())}
}
