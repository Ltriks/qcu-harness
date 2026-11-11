import {parseTeam,parseExpert,parseBundle,errors,PROTOCOL,VERSION} from './protocol.mjs'
const copy=value=>JSON.parse(JSON.stringify(value))
const replaceRow=(rows,row,kind)=>rows.some(r=>r[kind].id===row[kind].id)?rows.map(r=>r[kind].id===row[kind].id?row:r):[...rows,row]
export function teamFlow(team){
 if(team.members.every(m=>m.id===team.outputId?m.dependsOn.length===team.members.length-1:m.dependsOn.length===0))return 'parallel'
 if(team.members.at(-1)?.id===team.outputId&&team.members.every((m,i)=>JSON.stringify(m.dependsOn)===JSON.stringify(i?[team.members[i-1].id]:[])))return 'sequence'
 return 'custom'
}
export function applyFlow(team,mode){
 if(mode==='custom')return team
 const outputId=mode==='sequence'?team.members.at(-1)?.id??'':team.outputId||team.members.at(-1)?.id||''
 return {...team,outputId,members:team.members.map((m,i)=>({...m,dependsOn:mode==='sequence'?(i?[team.members[i-1].id]:[]):m.id===outputId?team.members.filter(x=>x.id!==outputId).map(x=>x.id):[]}))}
}
export class TeamsController{
 constructor(remote,options={}){
  this.remote=remote;this.options=options;this.listeners=new Set();this.epoch=0;this.closed=false;this.pollEpoch=0;this.historyEpoch=0
  this.storage=options.storage??null;try{if(!this.storage&&typeof window!=='undefined')this.storage=window.localStorage}catch{}
  this.state={selectedRuns:[],cleanup:null,cleanupConsent:false,capacity:null,workspaces:[],workspaceId:'',experts:[],teams:[],runs:[],skills:[],row:null,expertRow:null,tab:'teams',detailTab:'task',editing:false,dirty:false,query:'',showArchived:false,pendingNavigation:null,importCandidate:null,task:'',materials:'',prepared:null,consent:false,run:null,error:'',busy:false,loading:true,notice:''}
  this.subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)};this.snapshot=()=>this.state
 }
 set(p){if(this.closed)return;this.state={...this.state,...p};for(const fn of this.listeners)fn()}
 remember(id){try{this.storage?.setItem('qcu-expert-teams.workspace',id)}catch{}}
 remembered(){try{return this.storage?.getItem('qcu-expert-teams.workspace')}catch{return null}}
 async call(payload){const wire=await this.remote.dispatch(JSON.stringify(payload)),r=typeof wire==='string'?JSON.parse(wire):wire.ok&&typeof wire.value==='string'?JSON.parse(wire.value):wire;if(!r.ok)throw Object.assign(Error(r.error),{code:r.error});if(r.protocol!==PROTOCOL||r.version!==VERSION)throw Error('version-mismatch');return r.value}
 message(e){return errors[e?.code]??'连接暂时不可用，请重新连接。未自动重试模型任务。'}
 async action(fn){if(this.state.busy)return false;const epoch=this.epoch;this.set({busy:true,error:'',notice:''});try{await fn(epoch);return epoch===this.epoch}catch(e){if(epoch===this.epoch)this.set({error:this.message(e)});return false}finally{if(epoch===this.epoch)this.set({busy:false})}}
 async boot(){const epoch=++this.epoch;this.set({loading:true});try{
  const workspaces=await this.call({action:'workspaces'});if(epoch!==this.epoch||this.closed)return;this.set({workspaces,error:'',loading:false})
  if(this.options.autoSelect!==false){const current=workspaces.find(w=>w.id===this.state.workspaceId),remembered=workspaces.find(w=>w.id===this.remembered()),target=current??remembered??(workspaces.length===1?workspaces[0]:null);if(target)await this.loadWorkspace(target.id,true)}
 }catch(e){if(epoch===this.epoch)this.set({error:this.message(e),loading:false})}}
 async loadWorkspace(workspaceId,preserve=false){
  clearTimeout(this.timer);++this.pollEpoch;const epoch=++this.epoch,changed=workspaceId!==this.state.workspaceId
  this.dismissCleanup();this.set({selectedRuns:[],capacity:null,workspaceId,loading:!!workspaceId,error:'',prepared:null,consent:false,busy:false,...(changed?{teams:[],experts:[],runs:[],row:null,expertRow:null,run:null,dirty:false,editing:false,task:'',materials:'',query:'',showArchived:false}:{})})
  if(!workspaceId){this.set({loading:false});return}
  try{const data=await this.call({action:'catalog',workspaceId});if(epoch!==this.epoch||this.closed)return
   const row=data.teams.find(r=>r.team.id===this.state.row?.team.id)??data.teams.find(r=>!r.archived)??null,expertRow=(data.experts??[]).find(r=>r.expert.id===this.state.expertRow?.expert.id)??(data.experts??[]).find(r=>!r.archived)??null
   this.set({...data,loading:false,...(this.state.run&&!data.runs.some(r=>r.id===this.state.run.id)?{run:null}:{}),...(!preserve||!this.state.dirty?{row:copy(row),expertRow:copy(expertRow),saved:row?JSON.stringify(row.team):'',savedExpert:expertRow?JSON.stringify(expertRow.expert):'',dirty:false}:{})});this.remember(workspaceId)
  }catch(e){if(epoch===this.epoch)this.set({error:this.message(e),loading:false})}
 }
 selectWorkspace(id){if(this.state.dirty){this.set({pendingNavigation:{type:'workspace',id}});return Promise.resolve()}return this.loadWorkspace(id)}
 navigate(next){if(this.state.busy)return;if(this.state.dirty){this.set({pendingNavigation:next});return}this.performNavigation(next)}
 performNavigation(next){
  this.dismissCleanup();this.set({selectedRuns:[]});
  this.set({dirty:false,editing:false,pendingNavigation:null,prepared:null,consent:false,error:'',notice:'',query:'',showArchived:false})
  if(next.type==='workspace'){void this.loadWorkspace(next.id);return}
  if(next.type==='tab'){this.set({tab:next.id});if(next.id==='runs'){if(!this.state.run&&this.state.runs.length)void this.readRun(this.state.runs[0].id);else void this.action(epoch=>this.refreshHistory(epoch))}return}
  if(next.type==='team'){const row=this.state.teams.find(r=>r.team.id===next.id);if(row)this.set({tab:'teams',row:copy(row),saved:JSON.stringify(row.team),detailTab:'task'});return}
  if(next.type==='expert'){const row=this.state.experts.find(r=>r.expert.id===next.id);if(row)this.set({tab:'experts',expertRow:copy(row),savedExpert:JSON.stringify(row.expert)});return}
  if(next.type==='newExpert'){
   const expert=next.copy?{...copy(next.copy),id:'expert-'+crypto.randomUUID().slice(0,20),name:next.copy.name+'副本'}:{format:'qcu-expert',schemaVersion:1,id:'expert-'+crypto.randomUUID().slice(0,20),name:'新专家',description:'',instructions:'',skillNames:[]}
   this.set({tab:'experts',expertRow:{expert,revision:0,archived:false},savedExpert:'',editing:true,dirty:true});return
  }
  if(next.type==='newTeam'){
   const team=next.copy?{...copy(next.copy),id:'team-'+crypto.randomUUID().slice(0,20),name:next.copy.name+'副本'}:{format:'qcu-expert-team',schemaVersion:2,id:'team-'+crypto.randomUUID().slice(0,20),name:'新专家团',description:'',members:[],outputId:'',parallelism:2}
   this.set({tab:'teams',row:{team,revision:0,archived:false},saved:'',detailTab:'config',editing:true,dirty:true})
  }
 }
 async resolveNavigation(choice){const next=this.state.pendingNavigation;if(!next)return;if(choice==='cancel'){this.set({pendingNavigation:null});return}if(choice==='save'&&!await this.saveCurrent())return;this.discard();this.performNavigation(next)}
 discard(){const row=this.state.teams.find(r=>r.team.id===this.state.row?.team.id)??null,expertRow=this.state.experts.find(r=>r.expert.id===this.state.expertRow?.expert.id)??null;this.set({row:copy(row),expertRow:copy(expertRow),dirty:false,editing:false,error:''})}
 selectTeam(id){this.navigate({type:'team',id})}
 selectExpert(id){this.navigate({type:'expert',id})}
 editTeam(team){this.set({row:{...this.state.row,team},dirty:JSON.stringify(team)!==this.state.saved,prepared:null,consent:false,error:''})}
 editExpert(expert){this.set({expertRow:{...this.state.expertRow,expert},dirty:JSON.stringify(expert)!==this.state.savedExpert,prepared:null,consent:false,error:''})}
 input(key,value){this.set({[key]:value,prepared:null,consent:false})}
 dirty(){return this.state.dirty||!this.state.row}
 newTeam(team){this.navigate({type:'newTeam',copy:team})}
 setMembers(expertIds){const team=this.state.row.team,previous=new Map(team.members.map(m=>[m.expertId,m])),members=expertIds.map(id=>previous.get(id)??{id:'m-'+crypto.randomUUID().slice(0,12),expertId:id,assignment:'',dependsOn:[]}),ids=new Set(members.map(m=>m.id));let next={...team,members:members.map(m=>({...m,dependsOn:m.dependsOn.filter(id=>ids.has(id))})),outputId:ids.has(team.outputId)?team.outputId:members.at(-1)?.id??''};const mode=teamFlow(team);if(mode!=='custom')next=applyFlow(next,mode);this.editTeam(next)}
 async save(){let parsed;try{parsed=parseTeam(this.state.row.team)}catch(e){this.set({error:this.message(e)});return false}return this.action(async epoch=>{const row=await this.call({action:'saveTeam',workspaceId:this.state.workspaceId,team:parsed,revision:this.state.row.revision});if(epoch!==this.epoch)return;this.set({row,teams:replaceRow(this.state.teams,row,'team'),saved:JSON.stringify(row.team),dirty:false,editing:false,prepared:null,consent:false,notice:'专家团已保存'})})}
 async saveExpert(){let parsed;try{parsed=parseExpert(this.state.expertRow.expert)}catch(e){this.set({error:this.message(e)});return false}return this.action(async epoch=>{const row=await this.call({action:'saveExpert',workspaceId:this.state.workspaceId,expert:parsed,revision:this.state.expertRow.revision});if(epoch!==this.epoch)return;this.set({expertRow:row,experts:replaceRow(this.state.experts,row,'expert'),savedExpert:JSON.stringify(row.expert),dirty:false,editing:false,prepared:null,consent:false,notice:'专家已保存，可在专家团中选择'})})}
 saveCurrent(){return this.state.tab==='experts'?this.saveExpert():this.save()}
 async archive(entity,row){return this.action(async epoch=>{const data=await this.call({action:'archive',workspaceId:this.state.workspaceId,entity,id:row[entity].id,revision:row.revision,archived:!row.archived});if(epoch!==this.epoch)return;const selected=(entity==='expert'?data.experts:data.teams).find(r=>r[entity].id===row[entity].id);this.set({...data,...(entity==='expert'?{expertRow:selected}:{row:selected}),notice:row.archived?'已恢复':'已归档，可在已归档列表中恢复',prepared:null,consent:false})})}
 importConfig(raw){try{if(raw?.format==='qcu-expert-team')parseTeam(raw);else parseBundle(raw);this.set({importCandidate:raw,error:''})}catch(e){this.set({error:this.message(e)})}}
 async importConfirmed(){return this.action(async epoch=>{const data=await this.call({action:'importBundle',workspaceId:this.state.workspaceId,config:this.state.importCandidate});if(epoch!==this.epoch)return;const row=data.teams.find(t=>t.team.id===data.importedTeamId);this.set({...data,tab:'teams',row,detailTab:'config',saved:JSON.stringify(row.team),editing:false,dirty:false,importCandidate:null,notice:'已导入新的专家团与独立专家'})})}
 exportTeam(){const team=parseTeam(this.state.row.team);return {format:'qcu-expert-team-bundle',schemaVersion:1,team,experts:[...new Set(team.members.map(m=>m.expertId))].map(id=>copy(this.state.experts.find(e=>e.expert.id===id).expert))}}
 async prepare(){if(this.dirty()){this.set({error:'请先保存团队配置。'});return false}return this.action(async epoch=>{const s=this.state,prepared=await this.call({action:'prepare',workspaceId:s.workspaceId,teamId:s.row.team.id,revision:s.row.revision,task:s.task,materials:s.materials});if(epoch===this.epoch)this.set({prepared,consent:false,notice:''})})}
 async start(){if(!this.state.prepared||!this.state.consent)return;await this.action(async epoch=>{const requestId=crypto.randomUUID(),s=this.state;this.set({prepared:null,consent:false});const run=await this.call({action:'start',workspaceId:s.workspaceId,intentId:s.prepared.id,requestId,consent:true});if(epoch===this.epoch){this.set({run,tab:'runs',query:'',runs:[{id:run.id,teamName:run.team.name,task:run.input.task,status:run.status,createdAt:run.createdAt},...this.state.runs.filter(r=>r.id!==run.id)]});this.poll(run.id,++this.pollEpoch);await this.refreshHistory(epoch)}})}
 async readRun(runId){await this.action(async epoch=>{const run=await this.call({action:'run',workspaceId:this.state.workspaceId,runId});if(epoch===this.epoch){this.set({run,tab:'runs'});if(run.status==='running')this.poll(run.id,++this.pollEpoch);await this.refreshHistory(epoch)}})}
 poll(id,token){clearTimeout(this.timer);this.timer=setTimeout(async()=>{
  const epoch=this.epoch,generation=this.historyEpoch
  try{const run=await this.call({action:'run',workspaceId:this.state.workspaceId,runId:id});if(token!==this.pollEpoch||epoch!==this.epoch||this.closed)return
   if(generation===this.historyEpoch){this.set({...(this.state.run?.id===id?{run}:{}),runs:this.state.runs.map(r=>r.id===id?{...r,status:run.status}:r)});await this.refreshHistory(epoch,token)}
  }catch(e){if(token===this.pollEpoch&&epoch===this.epoch&&generation===this.historyEpoch)this.set({error:this.message(e)})}
  finally{if(token===this.pollEpoch&&epoch===this.epoch&&!this.closed&&this.state.runs.some(r=>r.id===id&&r.status==='running'))this.poll(id,token)}
 },800)}
 async cancel(){await this.action(async epoch=>{const run=await this.call({action:'cancel',workspaceId:this.state.workspaceId,runId:this.state.run.id});if(epoch===this.epoch){this.set({run});await this.refreshHistory(epoch)}})}
 async refreshHistory(epoch,token){const generation=this.historyEpoch,data=await this.call({action:'history',workspaceId:this.state.workspaceId});if(epoch===this.epoch&&generation===this.historyEpoch&&(token===undefined||token===this.pollEpoch))this.set(data)}
 toggleRun(id){if(this.state.busy)return;this.dismissCleanup();this.set({selectedRuns:this.state.selectedRuns.includes(id)?this.state.selectedRuns.filter(v=>v!==id):[...this.state.selectedRuns,id]})}
 async exportHistory(deliver){return this.action(async epoch=>{const backup=await this.call({action:'exportHistory',workspaceId:this.state.workspaceId,runIds:this.state.selectedRuns});if(epoch===this.epoch){deliver(backup);this.set({notice:'已下载所选记录的数据备份；请妥善保管，不能导入执行。'})}})}
 async previewCleanup(){return this.action(async epoch=>{const cleanup=await this.call({action:'previewCleanup',workspaceId:this.state.workspaceId,runIds:this.state.selectedRuns});if(epoch===this.epoch)this.set({cleanup,cleanupConsent:false})})}
 dismissCleanup(){const p=this.state.cleanup;if(p)void this.call({action:'cancelCleanup',workspaceId:p.workspaceId,cleanupId:p.id}).catch(()=>{});this.set({cleanup:null,cleanupConsent:false})}
 async confirmCleanup(){if(!this.state.cleanup||!this.state.cleanupConsent)return;return this.action(async epoch=>{const p=this.state.cleanup;try{const data=await this.call({action:'confirmCleanup',workspaceId:p.workspaceId,cleanupId:p.id,consent:true});if(epoch!==this.epoch)return;++this.historyEpoch;this.set({...data,run:data.removed.includes(this.state.run?.id)?null:this.state.run,selectedRuns:[],cleanup:null,cleanupConsent:false,prepared:null,consent:false,notice:'已清理 '+data.removed.length+' 条本地运行记录。后续任务请重新预览确认。'})}catch(e){if(epoch===this.epoch)this.set({cleanup:null,cleanupConsent:false});throw e}})}
 invalidate(){this.dismissCleanup();this.set({selectedRuns:[]});++this.epoch;++this.pollEpoch;clearTimeout(this.timer);this.set({prepared:null,consent:false,busy:false,error:'连接已变化，正在重新读取配置。任务不会自动重新运行。'})}
 async reconnect(){if(this.closed)return;this.invalidate();await this.boot()}
 dispose(){this.invalidate();this.closed=true;this.listeners.clear()}
}
