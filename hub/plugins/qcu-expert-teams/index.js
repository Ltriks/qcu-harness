import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import {discoverInstalledTeams} from './src/installed-teams.mjs'
import {UnifiedTeamStore} from './src/unified-store.mjs'
import {deepResearchTemplate,legacyToUnified,blankUnifiedTeam} from './src/unified-model.mjs'
import {createNativeStageRunner,nativeExecutionInfo} from './src/unified-native.mjs'
import {randomUUID} from 'node:crypto'
import {lstat} from 'node:fs/promises'
import {join} from 'node:path'
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
 async unifiedStore(workspaceId){
  await this.store(workspaceId);const slot=this.stores.get(workspaceId)
  if(!slot.unified)slot.unified=new UnifiedTeamStore(slot.path,{model:signal=>resolveRoute(this.owner,signal),info:()=>nativeExecutionInfo(this.owner),generate:createNativeStageRunner(this.owner)}).init()
  return slot.unified
 }
 async unifiedSnapshot(workspaceId){
  const slot=this.stores.get(workspaceId)
  if(!slot.unified){try{await lstat(join(slot.path,'.qcu-expert-teams','unified','state.json'))}catch(e){if(e.code==='ENOENT')return {unifiedTeams:[],unifiedRuns:[],executionInfo:nativeExecutionInfo(this.owner)};throw e}}
  return (await this.unifiedStore(workspaceId)).snapshot()
 }
 async installed(workspaceId,signal){return discoverInstalledTeams(this.owner.get('skills'),this.owner.workspaceRegistry.get(workspaceId).path,signal,{profileDir:this.owner.get('profileContext')?.dir,bundles:await this.owner.get('pluginManager')?.listBundles()??[]})}
 async dispatch(payload,signal){
  const abort=new AbortController(),cancel=()=>abort.abort();this.lookups.add(abort);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();const timer=setTimeout(cancel,15000)
  try{
   check(!this.closed,'plugin-stopped');check(typeof payload==='string'&&payload.length<=500000,'invalid-input');const r=JSON.parse(payload);let value
   if(r.action==='workspaces'){exact(r,['action']);value=this.owner.workspaceRegistry.list().map(w=>({id:w.id,title:w.title}))}
   else{
    exact(r,['action','workspaceId','team','expert','revision','teamId','task','materials','intentId','requestId','consent','runId','entity','id','archived','config','runIds','cleanupId','source','definition','mode']);const store=await this.store(r.workspaceId);abort.signal.throwIfAborted()
    if(r.action.startsWith('unified')){
     const unified=await this.unifiedStore(r.workspaceId)
     if(r.action==='unifiedCreate'){
      exact(r,['action','workspaceId','source','id']);const id='team-'+randomUUID();let definition
      if(r.source==='template')definition=deepResearchTemplate((await this.installed(r.workspaceId,abort.signal)).find(t=>t.id===r.id),id)
      else if(r.source==='legacy'){const row=store.state.teams.find(t=>t.team.id===r.id);check(row,'team-not-found');definition=legacyToUnified(store.resolvedTeam(row).team,id)}
      else{check(r.source==='blank','invalid-input');definition=blankUnifiedTeam(id)}
      value=await unified.create(definition)
     }else if(r.action==='unifiedSave'){exact(r,['action','workspaceId','definition','revision']);value=await unified.save(r.definition,r.revision)}
     else if(r.action==='unifiedPrepare'){exact(r,['action','workspaceId','id','revision','task','materials','mode']);value=await unified.prepare(r,abort.signal)}
     else if(r.action==='unifiedStart'){exact(r,['action','workspaceId','intentId','requestId','consent']);value=await unified.start(r)}
     else if(r.action==='unifiedRun'){exact(r,['action','workspaceId','runId']);value=unified.run(r.runId)}
     else if(r.action==='unifiedCancel'){exact(r,['action','workspaceId','runId']);value=await unified.cancel(r.runId)}
     else if(r.action==='unifiedReport'){exact(r,['action','workspaceId','runId']);value=unified.report(r.runId)}
     else check(false,'invalid-fields')
    }else if(r.action==='catalog'){
     exact(r,['action','workspaceId']);let skills=[];try{skills=await lookup(()=>this.owner.get('skills')?.list({cwd:this.owner.workspaceRegistry.get(r.workspaceId).path,signal:abort.signal})??[],abort.signal)}catch{check(false,'skill-unavailable')}
     const installedTeams=await lookup(()=>this.installed(r.workspaceId,abort.signal),abort.signal),unified=await this.unifiedSnapshot(r.workspaceId)
     value={...store.snapshot(),...unified,installedTeams,skills:skills.filter(s=>s.invocation?.userInvocable!==false).slice(0,300).map(s=>({name:s.name,description:s.description.slice(0,500)}))}
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
  }catch(e){return JSON.stringify({ok:false,error:safeCode(e),...(e.public?{detail:e.message}:{})})}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.lookups.delete(abort)}
 }
 async dispose(){this.closed=true;for(const c of this.lookups)c.abort();await Promise.allSettled([...this.stores.values()].map(async s=>{await (await s.unified)?.dispose();await (await s.promise).dispose()}));this.stores.clear()}
}
export function apply(ctx,config={enabled:true}){exact(config,['enabled']);check(typeof config.enabled==='boolean','invalid-fields');if(!config.enabled)return;new TeamService(ctx);ctx.typert.register({package:name,face:'host',schemas:[],invocations:remoteContribution.descriptors,model:{services:[],events:[],objects:[]}})}
