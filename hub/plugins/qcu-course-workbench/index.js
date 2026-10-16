import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol'
import {BlockAssembler,createUserMessage} from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import {readFileSync} from 'node:fs'
import {CourseStore} from './src/store.mjs'
import {remoteContribution,VERSION,PROTOCOL,check,exact,profile,text} from './src/protocol.mjs'
import {SYSTEM,promptFor} from './src/prompt.mjs'
export const name='qcu-course-workbench'
export const inject=['typert','workspaceRegistry']
export const Config=z.object({enabled:z.boolean().default(true),frameworkJson:z.string().default('{}').description('课程模板 JSON；school/stages/pathways/alignments/competencies/careerLinkRequired。未知字段拒绝。')})
export function createGenerator(ctx){return async(input,refs,signal,expected)=>{
 const llm=ctx.get('llm'),selection=ctx.get('agentDefaultModel')?.currentSelection()
 check(llm&&selection?.provider&&selection?.model,'model-not-configured')
 check(!expected||(expected.provider===selection.provider&&expected.model===selection.model),'model-selection-changed')
 const messages=[createUserMessage({content:[{type:'text',text:promptFor(input,refs)}],source:{kind:'user'}})]
 const assembler=new BlockAssembler();let bytes=0,finished=false
 for await(const chunk of llm.stream({...selection,messages,system:SYSTEM,maxTokens:12000,tools:[],signal})){
  signal.throwIfAborted();bytes+=JSON.stringify(chunk).length;check(bytes<=1500000,'output-too-large');assembler.push(chunk)
  if(chunk.type==='finish'){finished=true;check(chunk.reason.kind==='stop','model-incomplete')}
 }
 signal.throwIfAborted();check(finished,'model-incomplete');const blocks=assembler.blocks();check(blocks.every(b=>['text','reasoning'].includes(b.type)),'model-incomplete')
 const response=blocks.filter(b=>b.type==='text').map(b=>b.text).join('');check(response.length<=180000,'output-too-large')
 try{return JSON.parse(response.replace(/^\s*```(?:json)?\s*\n?/,'').replace(/\n?```\s*$/,''))}catch{check(false,'invalid-model-json')}
}}
export class CourseService extends TypertRemoteService{
 constructor(ctx,framework){super(ctx,'qcuCourse');this.framework=framework;this.stores=new Map();this.owner=ctx;this.closed=false;ctx.effect(()=>()=>this.dispose())}
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
    exact(raw,['action']);const selection=this.owner.get('agentDefaultModel')?.currentSelection()
    return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,workspaces:this.owner.workspaceRegistry.list().map(w=>({id:w.id,title:w.title,path:w.path})),model:selection?{provider:selection.provider,model:selection.model}:null})
   }
   exact(raw,['workspaceId','request','expectedModel']);const store=await this.store(text(raw.workspaceId,200,true));signal?.throwIfAborted()
   let request=raw.request
   if(request?.action==='generate'){
    // Bind the confirmation to the displayed model route before starting work.
    const selection=this.owner.get('agentDefaultModel')?.currentSelection();check(selection?.provider&&selection?.model,'model-not-configured')
    exact(raw.expectedModel,['provider','model'])
    check(raw.expectedModel?.provider===selection.provider&&raw.expectedModel?.model===selection.model,'model-selection-changed')
    request={...request,route:{provider:selection.provider,model:selection.model}}
   }else check(raw.expectedModel===undefined,'invalid-fields')
   return JSON.stringify({ok:true,value:await store.dispatch(request)})
  }catch(e){return JSON.stringify({ok:false,error:['model-not-configured','model-selection-changed','state-write-failed','store-limit','save-not-found','invalid-fields','invalid-text','invalid-id','invalid-enum','invalid-list','invalid-target','disabled-target','missing-targets','invalid-lesson','empty-profile','course-not-found','task-not-found','reference-required','reference-expired-or-course-mismatch','course-mismatch','model-consent-required','task-busy','stale-preview','file-changed','invalid-filename','unsupported-file-use-text','file-too-large','empty-material','reference-limit','idempotency-conflict','draft-not-ready','save-confirmation-required','unsafe-file','unsafe-directory','workspace-not-found','workspace-changed','workspace-limit','course-limit','task-limit','version-limit','save-limit','invalid-store','invalid-sequence','invalid-timing','missing-components','invalid-draft','draft-too-large'].includes(e.code)?e.code:'operation-failed'})}
 }
 async dispose(){this.closed=true;await Promise.all([...this.stores.values()].map(async s=>{const store=await s.promise;await store.dispose()}));this.stores.clear()}
}
export function apply(ctx,config={enabled:true,frameworkJson:'{}'}){
 exact(config,['enabled','frameworkJson']);check(typeof config.enabled==='boolean','invalid-config');if(!config.enabled)return
 const framework=profile(JSON.parse(config.frameworkJson??'{}'))
 // No global overlay, tool permission changes, credential reads, shell, or private native bridge.
 new CourseService(ctx,framework)
 ctx.typert.register({package:name,face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})
 ctx.inject(['skills'],child=>child.skills.register({name:'qcu-course-draft',description:'Use the Course Design Studio to select references, generate, review and save a classroom activity draft.',provider:name+'@'+VERSION,source:name+'@'+VERSION,content:readFileSync(new URL('./skills/qcu-course-draft/SKILL.md',import.meta.url),'utf8')}))
}
