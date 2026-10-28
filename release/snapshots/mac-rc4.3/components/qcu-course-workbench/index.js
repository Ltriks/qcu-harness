import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol'
import {BlockAssembler,createUserMessage} from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import {readFileSync} from 'node:fs'
import {CourseStore} from './src/store.mjs'
import {remoteContribution,VERSION,PROTOCOL,check,exact,profile,text,OUTPUT_BUDGET,DIAGNOSTIC_COUNTER_MAX,safeFailureCode,parseRoute,policyFor,sameRoute} from './src/protocol.mjs'
import {SYSTEM,promptFor} from './src/prompt.mjs'
export const name='qcu-course-workbench'
export const inject=['typert','workspaceRegistry']
export const Config=z.object({enabled:z.boolean().default(true),frameworkJson:z.string().default('{}').description('课程模板 JSON；school/stages/pathways/alignments/competencies/careerLinkRequired。未知字段拒绝。')})
// Promptly abandon lookups even when an adapter ignores cancellation.
async function cancellableLookup(lookup,signal){
 signal?.throwIfAborted();let listener
 try{return await Promise.race([Promise.resolve().then(()=>{signal?.throwIfAborted();return lookup()}),new Promise((_,reject)=>{listener=()=>reject(Error('cancelled'));signal?.addEventListener('abort',listener,{once:true})})])}
 finally{signal?.removeEventListener('abort',listener);signal?.throwIfAborted()}
}
// Lookup is read-only and never exposes provider errors or descriptive metadata.
export async function resolveRoute(ctx,signal){
 signal?.throwIfAborted()
 const selection=ctx.get('agentDefaultModel')?.currentSelection(),llm=ctx.get('llm')
 check(llm&&selection?.provider&&selection?.model,'model-not-configured')
 const route=parseRoute({provider:selection.provider,model:selection.model})
 try{
  const info=await cancellableLookup(()=>llm.resolveModelInfo(route.provider,route.model,signal),signal)
  signal?.throwIfAborted()
  const current=ctx.get('agentDefaultModel')?.currentSelection()
  check(current?.provider===route.provider&&current?.model===route.model,'model-selection-changed')
  check(info?.provider===route.provider&&info?.id===route.model,'model-policy-unavailable')
  return {...route,policy:policyFor(info)}
 }catch(e){signal?.throwIfAborted();check(false,e?.code==='model-selection-changed'?'model-selection-changed':'model-policy-unavailable')}
}
export function createGenerator(ctx){return async(input,refs,signal,expected)=>{
 const llm=ctx.get('llm'),confirmed=parseRoute(expected,true)
 const route=await resolveRoute(ctx,signal)
 check(sameRoute(confirmed,route),'model-policy-changed')
 const messages=[createUserMessage({content:[{type:'text',text:promptFor(input,refs)}],source:{kind:'user'}})]
 const assembler=new BlockAssembler(),stats={chunks:0,textChars:0,reasoningChars:0,streamChars:0,outputBudget:OUTPUT_BUDGET}
 let stage='stream',finishKind='missing',failureCode
 const add=(key,n)=>{check(Number.isSafeInteger(n)&&n>=0,'invalid-stream-counter');stats[key]=Math.min(DIAGNOSTIC_COUNTER_MAX,stats[key]+n)}
 // A local marker prevents provider/middleware throws from impersonating our diagnostic errors.
 let ownFailure
 const codeOf=value=>{try{return safeFailureCode(Object.getOwnPropertyDescriptor(value,'code')?.value)}catch{return}}
 const reject=reason=>{const e=Error(reason);e.code=reason;e.diagnostic={stage,reason,finishKind,...stats,...(failureCode?{failureCode}:{})};ownFailure=e;throw e}
 // The official one-shot prepared call also binds adapter defaults/registration,
 // closing the extra capability lookup inside llm.stream before any adapter generation.
 const config={provider:route.provider,model:route.model,maxTokens:OUTPUT_BUDGET,...(route.policy.effort==='default'?{}:{reasoningEffort:route.policy.effort})}
 let prepared
 try{prepared=await cancellableLookup(()=>llm.prepareCall(config,signal),signal)}catch{signal.throwIfAborted();check(false,'model-policy-unavailable')}
 signal.throwIfAborted()
 const effective=route.policy.effort==='default'?route.policy.defaultEffort??undefined:route.policy.effort
 check(prepared.config.reasoningEffort===effective&&prepared.config.maxTokens===OUTPUT_BUDGET,'model-policy-changed')
 check(sameRoute(confirmed,await resolveRoute(ctx,signal)),'model-policy-changed')
 signal.throwIfAborted()
 try{
  for await(const chunk of prepared.stream({...prepared.config,messages,system:SYSTEM,tools:[],signal})){
   signal.throwIfAborted();add('chunks',1);if(finishKind==='stop')reject('model-stream-failed')
   if(chunk.type==='finish'){
    finishKind=['stop','tool-calls','max-tokens','aborted','error'].includes(chunk.reason?.kind)?chunk.reason.kind:'unknown'
    if(['error','aborted'].includes(finishKind))failureCode=codeOf(chunk.reason.failure)
   }
   if(chunk.type==='text-delta'||chunk.type==='reasoning-delta')add(chunk.type==='text-delta'?'textChars':'reasoningChars',chunk.text.length)
   if(chunk.type==='block-end'&&['text','reasoning'].includes(chunk.block?.type))add(chunk.block.type==='text'?'textChars':'reasoningChars',chunk.block.text.length)
   add('streamChars',JSON.stringify(chunk).length);if(stats.streamChars>1500000)reject('output-too-large')
   if(chunk.type==='finish'){
    if(finishKind!=='stop')reject({'max-tokens':'model-max-tokens',error:'model-provider-error',aborted:'model-provider-aborted','tool-calls':'model-unexpected-blocks'}[finishKind]??'model-unknown-finish')
   }
   if((chunk.type==='block-start'&&!['text','reasoning'].includes(chunk.blockType))||chunk.type==='tool-call-delta'||(chunk.type==='block-end'&&!['text','reasoning'].includes(chunk.block?.type)))reject('model-unexpected-blocks')
   assembler.push(chunk)
  }
  signal.throwIfAborted();if(finishKind==='missing')reject('model-missing-finish')
  stage='assembly';const blocks=assembler.blocks();if(!blocks.every(b=>['text','reasoning'].includes(b.type)))reject('model-unexpected-blocks')
  const response=blocks.filter(b=>b.type==='text').map(b=>b.text).join('');if(response.length>180000)reject('output-too-large')
  stage='json'
  try{return JSON.parse(response.replace(/^\s*```(?:json)?\s*\n?/,'').replace(/\n?```\s*$/,''))}catch{reject('invalid-model-json')}
 }catch(e){
  signal.throwIfAborted();if(ownFailure&&e===ownFailure)throw e
  // Never propagate raw thrown values, failure payloads, replay state or provider messages.
  failureCode=codeOf(e);reject('model-stream-failed')
 }
}}
export class CourseService extends TypertRemoteService{
 constructor(ctx,framework){super(ctx,'qcuCourse');this.framework=framework;this.stores=new Map();this.owner=ctx;this.closed=false;this.lookups=new Set();ctx.effect(()=>()=>this.dispose())}
 async store(workspaceId){
  check(typeof workspaceId==='string'&&workspaceId.length<=200,'invalid-workspace');const w=this.owner.workspaceRegistry.get(workspaceId);check(w,'workspace-not-found')
  let slot=this.stores.get(workspaceId)
  if(slot){check(slot.path===w.path,'workspace-changed');return slot.promise}
  check(this.stores.size<12,'workspace-limit')
  slot={path:w.path,promise:new CourseStore(w.path,{generate:createGenerator(this.owner),framework:this.framework}).init()};this.stores.set(workspaceId,slot)
  try{return await slot.promise}catch(e){this.stores.delete(workspaceId);throw e}
 }
 async dispatch(payload,signal){
  check(!this.closed,'plugin-stopped');signal?.throwIfAborted();check(typeof payload==='string'&&payload.length<=12000000,'wire-size')
  try{
   const raw=JSON.parse(payload)
   if(raw.action==='workspaces'){
    exact(raw,['action'])
    return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,workspaces:this.owner.workspaceRegistry.list().map(w=>({id:w.id,title:w.title,path:w.path}))})
   }
   if(raw.action==='model'){
    exact(raw,['action']);const abort=new AbortController(),cancel=()=>abort.abort()
    this.lookups.add(abort);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel()
    const timer=setTimeout(cancel,5000);let model=null,policyError
    try{model=await resolveRoute(this.owner,abort.signal)}catch(e){policyError=e.code==='model-not-configured'?'model-not-configured':'model-policy-unavailable'}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.lookups.delete(abort)}
    signal?.throwIfAborted();check(!this.closed,'plugin-stopped')
    return JSON.stringify({ok:true,model,...(policyError?{policyError}:{})})
   }
   exact(raw,['workspaceId','request','expectedModel']);const store=await this.store(text(raw.workspaceId,200,true));signal?.throwIfAborted()
   let request=raw.request
   if(request?.action==='generate'){
    check(request.route===undefined,'invalid-fields')
    // Exact route, effective policy and budget must match the displayed consent.
    const expected=parseRoute(raw.expectedModel,true),route=await resolveRoute(this.owner,signal)
    check(expected.provider===route.provider&&expected.model===route.model,'model-selection-changed')
    check(sameRoute(expected,route),'model-policy-changed')
    request={...request,route}
   }else check(raw.expectedModel===undefined,'invalid-fields')
   return JSON.stringify({ok:true,value:await store.dispatch(request)})
  }catch(e){return JSON.stringify({ok:false,error:['model-policy-unavailable','model-policy-changed','invalid-model-policy','model-not-configured','model-selection-changed','state-write-failed','store-limit','save-not-found','invalid-fields','invalid-text','invalid-id','invalid-enum','invalid-list','invalid-target','disabled-target','missing-targets','invalid-lesson','empty-profile','course-not-found','task-not-found','reference-required','reference-expired-or-course-mismatch','course-mismatch','model-consent-required','task-busy','stale-preview','file-changed','invalid-filename','unsupported-file-use-text','file-too-large','empty-material','reference-limit','idempotency-conflict','draft-not-ready','save-confirmation-required','unsafe-file','unsafe-directory','workspace-not-found','workspace-changed','workspace-limit','course-limit','task-limit','version-limit','save-limit','invalid-store','invalid-sequence','invalid-timing','missing-components','invalid-draft','draft-too-large'].includes(e.code)?e.code:'operation-failed'})}
 }
 async dispose(){this.closed=true;for(const abort of this.lookups)abort.abort();this.lookups.clear();await Promise.all([...this.stores.values()].map(async s=>{const store=await s.promise;await store.dispose()}));this.stores.clear()}
}
export function apply(ctx,config={enabled:true,frameworkJson:'{}'}){
 exact(config,['enabled','frameworkJson']);check(typeof config.enabled==='boolean','invalid-config');if(!config.enabled)return
 const framework=profile(JSON.parse(config.frameworkJson??'{}'))
 // No global overlay, tool permission changes, credential reads, shell, or private native bridge.
 new CourseService(ctx,framework)
 ctx.typert.register({package:name,face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})
 ctx.inject(['skills'],child=>child.skills.register({name:'qcu-course-draft',description:'Use the Course Design Studio to select references, generate, review and save a classroom activity draft.',provider:name+'@'+VERSION,source:name+'@'+VERSION,content:readFileSync(new URL('./skills/qcu-course-draft/SKILL.md',import.meta.url),'utf8')}))
}
