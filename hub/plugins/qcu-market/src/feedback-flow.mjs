import {feedbackCanonical,feedbackNeed,feedbackExact,validateFeedbackPreview,validateFeedbackSubmission} from './feedback-schema.mjs'
export async function feedbackFingerprint(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(feedbackCanonical(value))))].map(b=>b.toString(16).padStart(2,'0')).join('')}
const notice=code=>({'feedback.store-full':'本地回执已满，本次没有发送。仍可查询已有反馈，请联系维护者整理备份。','feedback.store-busy':'本地回执正在使用或有中断记录，本次没有重新发送。请稍后重开，仍有问题时联系维护者。','feedback.store-corrupt':'本地回执需要维护者检查；请保留原记录，本次没有发送。','feedback.store-unsafe':'本地回执目录需要维护者检查；请保留原记录，本次没有发送。','feedback.store-unavailable':'当前客户端尚未提供回执保存服务；本次没有发送，可先复制反馈记录。','feedback.sensitive':'记录中仍可能含有密钥或私人资料。请删除后重新生成预览。','feedback.rate':'操作较频繁，请稍后再查询。不会自动重发。','feedback.local-missing':'未找到这条本地查询凭据。请重新读取本地回执或联系维护者。','feedback.missing':'Hub 暂未查到这条反馈。可稍后查询；若要重新描述问题，请明确另建一条反馈。','feedback.host-unavailable':'当前客户端未提供反馈服务；请保留本地记录并联系维护者。','feedback.preview':'预览已变化，请重新生成、检查并确认。','feedback.invalid':'记录格式或长度不符合要求，请删减后重新生成预览。','feedback.limit':'记录较长，本次没有发送。请删减后重新生成预览。'}[code]||'本次操作未完成，请保留回执，稍后查询或联系维护者。')
export class FeedbackFlow{
 constructor(remote){this.remote=remote;this.listeners=new Set();this.generation=0;this.historyGeneration=0;this.owned=new Set();this.active=null;this.disposed=false;this.newChosen=false;this.state={phase:'idle',preview:null,ack:false,history:[],historyReady:false,selected:null,needsNew:false,busy:false,message:'',code:''}}
 snapshot=()=>this.state
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 get running(){return Boolean(this.active)}
 set(patch){if(this.disposed)return;this.state={...this.state,...patch};for(const fn of this.listeners)fn()}
 cancel(){for(const c of this.owned)c.abort();this.active=null}
 invalidate(){const submitting=this.state.phase==='submitting';++this.generation;this.cancel();this.set({preview:null,ack:false,busy:false,...(submitting?{phase:'unknown',needsNew:true,message:'提交已停止等待，请在本地回执中核对结果；不会自动重发。'}:{})})}
 async restore(){
  const n=++this.historyGeneration
  try{
   const r=await this.call('feedbackReceipts');if(this.disposed||n!==this.historyGeneration)return
   if(!r.ok){this.set({historyReady:true,message:notice(r.error),code:r.error});return}
   feedbackExact(r.value,['records','capacity','blocked']);feedbackNeed(Array.isArray(r.value.records)&&r.value.records.length<=32&&r.value.capacity===32&&typeof r.value.blocked==='boolean','feedback.response')
   const records=[]
   for(const row of r.value.records){
    feedbackExact(row,['schema','requestId','receiptId','state','createdAt','marketVersion'])
    feedbackNeed(row.schema===1&&typeof row.requestId==='string'&&/^[a-f0-9]{64}$/.test(row.requestId)&&row.receiptId===await this.expectedId(row.requestId)&&row.state==='pending'&&typeof row.createdAt==='string'&&Number.isFinite(Date.parse(row.createdAt))&&typeof row.marketVersion==='string'&&/^[a-zA-Z0-9.-]{1,80}$/.test(row.marketVersion),'feedback.response');records.push(row)
   }
   if(this.disposed||n!==this.historyGeneration)return
   feedbackNeed(new Set(records.map(r=>r.requestId)).size===records.length,'feedback.response')
   const merged=records.map(row=>({...row,...(this.state.history.find(r=>r.requestId===row.requestId)||{})}));for(const row of this.state.history)if(!merged.some(r=>r.requestId===row.requestId))merged.push(row)
   feedbackNeed(merged.length<=64,'feedback.response')
   this.set({historyReady:true,history:merged,selected:this.state.selected??(!this.newChosen?merged.at(-1)?.requestId:null)??null,storeBlocked:r.value.blocked===true,...(!this.newChosen&&merged.length&&this.state.phase==='idle'?{phase:'unknown',needsNew:true}:{})})
  }catch(e){if(!this.disposed&&n===this.historyGeneration)this.set({historyReady:true,message:'本地回执暂时无法读取。可重新读取或联系维护者；不会重新提交。',code:e.code||'feedback.unavailable'})}
 }
 async expectedId(requestId){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('QCU-FEEDBACK/V1:'+requestId)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
 async preview(payload){
  feedbackNeed(!this.disposed&&!this.running,'feedback.busy');feedbackNeed(!this.state.needsNew,'feedback.new-required')
  validateFeedbackPreview(payload);const copy=JSON.parse(feedbackCanonical(payload)),n=++this.generation
  this.set({preview:null,ack:false,code:''});const previewSha256=await feedbackFingerprint(copy)
  validateFeedbackSubmission({...copy,requestId:'0'.repeat(64),confirmed:true,previewSha256})
  if(!this.disposed&&n===this.generation)this.set({preview:{...copy,previewSha256},phase:'preview',message:'请检查所有预览内容，删除学生和私人资料，再单独确认提交。'})
 }
 acknowledge(value){this.set({ack:value===true&&Boolean(this.state.preview)})}
 startNew(){feedbackNeed(!this.running&&!this.disposed,'feedback.busy');++this.generation;this.newChosen=true;this.set({phase:'idle',preview:null,ack:false,needsNew:false,selected:null,message:'已开始另一条反馈；原回执保留在本地历史中。',code:''})}
 begin(){const c=new AbortController();this.owned.add(c);this.active=c;return c}
 finish(c){this.owned.delete(c);if(this.active===c){this.active=null;this.set({busy:false})}}
 valid(n,c){return !this.disposed&&n===this.generation&&!c.signal.aborted&&this.active===c}
 async submit(){
  if(this.state.history.length>=32){this.set({message:notice('feedback.store-full'),code:'feedback.store-full'});feedbackNeed(false,'feedback.store-full')}
  feedbackNeed(!this.running&&!this.disposed&&this.state.preview&&this.state.ack&&!this.state.needsNew,'feedback.preview')
  const n=this.generation,c=this.begin();this.set({busy:true});const requestId=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join(''),payload={...this.state.preview,requestId,confirmed:true},receiptId=await this.expectedId(requestId)
  if(!this.valid(n,c)){this.finish(c);return}
  const row={schema:1,requestId,receiptId,state:'pending',createdAt:new Date().toISOString(),marketVersion:payload.knownVersions.market}
  this.newChosen=false;this.set({phase:'submitting',busy:true,ack:false,preview:null,selected:requestId,needsNew:true,history:[...this.state.history,row],message:'正在保存查询凭据并提交；不会自动重发。',code:''})
  try{
   const r=await this.call('feedbackSubmit',payload,c.signal);if(!this.valid(n,c))return
   if(r.ok){await this.checkReceipt(r.value,requestId);if(!this.valid(n,c))return;this.remember(requestId,r.value);this.set({phase:'received',message:'反馈已收到。以后可在本地回执中主动查询进度。'})}
   else this.set({phase:r.unknown?'unknown':'rejected',needsNew:r.unknown,code:r.error,message:r.unknown?'提交结果暂不确定。请查询原回执；若要提交新内容，先点击“另建一条反馈”。':notice(r.error),...(r.tracked===false?{history:this.state.history.filter(r=>r.requestId!==requestId),selected:null}:{})})
  }catch{if(this.valid(n,c))this.set({phase:'unknown',needsNew:true,message:'提交结果暂不确定。原查询凭据已保留，请查询原回执，不要重复提交。',code:'feedback.unavailable'})}
  finally{this.finish(c)}
 }
 remember(requestId,receipt){this.set({history:this.state.history.map(r=>r.requestId===requestId?{...r,last:receipt}:r),selected:requestId})}
 async checkReceipt(v,requestId){feedbackExact(v,['receiptId','state','updatedAt','revision','message']);feedbackNeed(v.receiptId===await this.expectedId(requestId)&&['received','in-progress','resolved'].includes(v.state)&&Number.isSafeInteger(v.revision)&&v.revision>0&&typeof v.message==='string'&&[...v.message].length<=300&&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt)),'feedback.response')}
 async call(method,body,signal){
  if(typeof this.remote?.qcuMarket?.[method]!=='function')return {ok:false,error:'feedback.host-unavailable',unknown:false,tracked:false}
  const reply=await this.remote.qcuMarket[method](...(body===undefined?[]:[feedbackCanonical(body),signal])),raw=reply?.ok===true&&typeof reply.value==='string'?reply.value:reply
  feedbackNeed(typeof raw==='string'&&new TextEncoder().encode(raw).length<=16384,'feedback.response');const value=JSON.parse(raw);feedbackNeed(value&&typeof value.ok==='boolean','feedback.response');if(!value.ok)feedbackNeed(typeof value.error==='string'&&/^feedback\.[a-z-]+$/.test(value.error)&&typeof value.unknown==='boolean','feedback.response');return value
 }
 async check(requestId=this.state.selected){
  if(this.running||this.disposed||!this.state.history.some(r=>r.requestId===requestId))return
  this.invalidate();this.newChosen=false;const n=this.generation,c=this.begin();this.set({selected:requestId,busy:true,code:''})
  try{
   const r=await this.call('feedbackStatus',{requestId},c.signal);if(!this.valid(n,c))return
   if(r.ok){await this.checkReceipt(r.value,requestId);if(!this.valid(n,c))return;this.remember(requestId,r.value);this.set({phase:'received',message:r.value.state==='resolved'?'维护者已处理，请你检查问题是否解决。':'已查询到最新状态。'})}
   else this.set({message:notice(r.error),code:r.error})
  }catch{if(this.valid(n,c))this.set({message:'暂时无法查询，请稍后再试。回执仍在，不会重新提交。',code:'feedback.unavailable'})}
  finally{this.finish(c)}
 }
 dispose(){if(this.disposed)return;++this.generation;++this.historyGeneration;this.cancel();this.disposed=true;this.listeners.clear()}
}

