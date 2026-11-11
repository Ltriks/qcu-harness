import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import {TeamStore} from './src/store.mjs'
import {createGenerator,resolveRoute,lookup} from './src/model.mjs'
import {exact,text,check,remoteContribution,VERSION,PROTOCOL,safeCode} from './src/protocol.mjs'
export const name='qcu-expert-teams',inject=['typert','workspaceRegistry']
export const Config=z.object({enabled:z.boolean().default(true)})
export class TeamService extends TypertRemoteService{
 constructor(ctx){super(ctx,'qcuTeams');this.owner=ctx;this.stores=new Map();this.lookups=new Set();this.closed=false;ctx.effect(()=>()=>this.dispose())}
 async store(workspaceId){
  check(!this.closed,'plugin-stopped');text(workspaceId,200,true);const w=this.owner.workspaceRegistry.get(workspaceId);check(w,'workspace-not-found')
  let slot=this.stores.get(workspaceId);if(slot){check(slot.path===w.path,'workspace-changed');return slot.promise}
  check(this.stores.size<8,'workspace-limit');slot={path:w.path,promise:new TeamStore(w.path,{model:signal=>resolveRoute(this.owner,signal),skills:(id,signal)=>this.owner.get('skills')?.get(id,{cwd:w.path,signal}),generate:createGenerator(this.owner)}).init()};this.stores.set(workspaceId,slot)
  try{return await slot.promise}catch(e){this.stores.delete(workspaceId);throw e}
 }
 async dispatch(payload,signal){
  const abort=new AbortController(),cancel=()=>abort.abort();this.lookups.add(abort);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();const timer=setTimeout(cancel,15000)
  try{
   check(!this.closed,'plugin-stopped');check(typeof payload==='string'&&payload.length<=500000,'invalid-input');const r=JSON.parse(payload);let value
   if(r.action==='workspaces'){exact(r,['action']);value=this.owner.workspaceRegistry.list().map(w=>({id:w.id,title:w.title}))}
   else{
    exact(r,['action','workspaceId','team','expert','revision','teamId','task','materials','intentId','requestId','consent','runId','entity','id','archived','config','runIds','cleanupId']);const store=await this.store(r.workspaceId);abort.signal.throwIfAborted()
    if(r.action==='catalog'){
     exact(r,['action','workspaceId']);let skills=[];try{skills=await lookup(()=>this.owner.get('skills')?.list({cwd:this.owner.workspaceRegistry.get(r.workspaceId).path,signal:abort.signal})??[],abort.signal)}catch{check(false,'skill-unavailable')}
     value={...store.snapshot(),skills:skills.filter(s=>s.invocation?.userInvocable!==false).slice(0,300).map(s=>({name:s.name,description:s.description.slice(0,500)}))}
    }else if(r.action==='history'){exact(r,['action','workspaceId']);const data=store.snapshot();value={runs:data.runs,capacity:data.capacity}}else if(r.action==='saveTeam'){exact(r,['action','workspaceId','team','revision']);value=await store.saveTeam(r.team,r.revision)}
    else if(r.action==='saveExpert'){exact(r,['action','workspaceId','expert','revision']);value=await store.saveExpert(r.expert,r.revision)}
    else if(r.action==='archive'){exact(r,['action','workspaceId','entity','id','revision','archived']);value=await store.archive(r.entity,r.id,r.revision,r.archived)}
    else if(r.action==='importBundle'){exact(r,['action','workspaceId','config']);value=await store.importBundle(r.config)}
    else if(r.action==='prepare'){exact(r,['action','workspaceId','teamId','revision','task','materials']);value=await store.prepare(r,abort.signal)}
    else if(r.action==='start'){exact(r,['action','workspaceId','intentId','requestId','consent']);value=await store.start(r,abort.signal)}
    else if(r.action==='run'){exact(r,['action','workspaceId','runId']);value=store.run(text(r.runId,100,true))}
    else if(r.action==='cancel'){exact(r,['action','workspaceId','runId']);value=await store.cancel(text(r.runId,100,true))}
    else if(r.action==='exportHistory'){exact(r,['action','workspaceId','runIds']);value=await store.exportHistory(r)}
    else if(r.action==='previewCleanup'){exact(r,['action','workspaceId','runIds']);value=await store.previewCleanup(r)}
    else if(r.action==='cancelCleanup'){exact(r,['action','workspaceId','cleanupId']);value=await store.cancelCleanup(r)}
    else if(r.action==='confirmCleanup'){exact(r,['action','workspaceId','cleanupId','consent']);value=await store.confirmCleanup(r)}
    else check(false,'invalid-fields')
   }
   check(!this.closed,'plugin-stopped');return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value})
  }catch(e){return JSON.stringify({ok:false,error:safeCode(e)})}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.lookups.delete(abort)}
 }
 async dispose(){this.closed=true;for(const c of this.lookups)c.abort();await Promise.allSettled([...this.stores.values()].map(async s=>(await s.promise).dispose()));this.stores.clear()}
}
export function apply(ctx,config={enabled:true}){exact(config,['enabled']);check(typeof config.enabled==='boolean','invalid-fields');if(!config.enabled)return;new TeamService(ctx);ctx.typert.register({package:name,face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})}
