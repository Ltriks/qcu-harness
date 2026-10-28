// Narrow fixed-origin feedback RPC. Persist intent before POST; never retry.
import {marketRuntime} from './remote-contract.mjs'
import {createHash} from 'node:crypto'
import {strictJson} from './catalog-authority.mjs'
import {feedbackCanonical,feedbackNeed,feedbackExact,feedbackPreviewOf,validateFeedbackSubmission,validateFeedbackQuery,feedbackText} from './feedback-schema.mjs'
import {feedbackReceiptId} from './feedback-storage.mjs'
const cap=16384,origin='http://192.168.1.68:8080'
const safeCode=e=>/^feedback\.[a-z-]+$/.test(e?.code??'')?e.code:'feedback.unavailable'
export class FeedbackTransport{
 constructor({fetcher=fetch,runtime='unobserved',testOrigin,journal}={}){
  feedbackNeed(!testOrigin||/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(testOrigin),'feedback.origin')
  this.origin=testOrigin??origin;this.fetcher=fetcher;this.runtime=runtime;this.journal=journal;this.owned=new Set();this.disposed=false
 }
 dispose(){this.disposed=true;for(const c of this.owned)c.abort();this.owned.clear()}
 async receipts(){try{feedbackNeed(!this.disposed&&this.journal,'feedback.store-unavailable');return JSON.stringify({ok:true,value:await this.journal.list()})}catch(e){return JSON.stringify({ok:false,error:safeCode(e),unknown:false,tracked:false})}}
 async post(method,payload,signal){
  let tracked=false,dispatched=false;const controller=new AbortController();this.owned.add(controller)
  try{
   feedbackNeed(!this.disposed&&this.journal,'feedback.store-unavailable');feedbackNeed(['submit','status'].includes(method),'feedback.invalid')
   const body=strictJson(Buffer.from(payload),cap)
   if(method==='submit'){
    validateFeedbackSubmission(body)
    feedbackNeed(body.knownVersions.market===marketRuntime.version&&(body.knownVersions.runtime===this.runtime||body.knownVersions.runtime==='unobserved'),'feedback.version')
    feedbackNeed(body.previewSha256===createHash('sha256').update(feedbackCanonical(feedbackPreviewOf(body))).digest('hex'),'feedback.preview')
   }else validateFeedbackQuery(body)
   const operation=AbortSignal.any([controller.signal,AbortSignal.timeout(5000),...(signal?[signal]:[])])
   operation.throwIfAborted()
   if(method==='submit'){
    const intent=await this.journal.reserve(body.requestId,marketRuntime.version,operation);tracked=true
    if(intent.existing)return JSON.stringify({ok:false,error:'feedback.already-tracked',unknown:true,tracked:true})
   }else{feedbackNeed((await this.journal.list()).records.some(r=>r.requestId===body.requestId),'feedback.local-missing');tracked=true}
   operation.throwIfAborted();feedbackNeed(!this.disposed,'feedback.cancelled')
   const url=this.origin+'/feedback/'+method;dispatched=true
   const r=await this.fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','Accept-Encoding':'identity'},body:payload,redirect:'manual',credentials:'omit',signal:operation})
   try{
    feedbackNeed(!r.redirected&&(!r.url||r.url===url)&&(!r.headers.get('content-encoding')||r.headers.get('content-encoding')==='identity'),'feedback.response')
    const n=r.headers.get('content-length');feedbackNeed(n&&/^\d+$/.test(n)&&Number(n)<=cap&&r.body,'feedback.response')
    const chunks=[];let size=0;for await(const b of r.body){operation.throwIfAborted();size+=b.length;feedbackNeed(size<=cap&&size<=Number(n),'feedback.response');chunks.push(b)}
    feedbackNeed(size===Number(n),'feedback.response');const value=strictJson(Buffer.concat(chunks),cap)
    if(r.status!==200){
     feedbackExact(value,['error']);feedbackNeed(/^feedback\.[a-z-]+$/.test(value.error),'feedback.response')
     return JSON.stringify({ok:false,error:value.error,unknown:!(r.status>=400&&r.status<500),tracked})
    }
    feedbackExact(value,['receiptId','state','updatedAt','revision','message'])
    feedbackNeed(value.receiptId===feedbackReceiptId(body.requestId)&&['received','in-progress','resolved'].includes(value.state)&&Number.isSafeInteger(value.revision)&&value.revision>0&&typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt)),'feedback.response')
    feedbackText(value.message,300,{empty:true});operation.throwIfAborted();feedbackNeed(!this.disposed,'feedback.cancelled')
    return JSON.stringify({ok:true,value})
   }finally{if(r.body&&!r.body.locked)await r.body.cancel().catch(()=>{})}
  }catch(e){return JSON.stringify({ok:false,error:!tracked&&!dispatched&&!e.code?'feedback.invalid':safeCode(e),unknown:dispatched||tracked,tracked})}
  finally{this.owned.delete(controller)}
 }
}
