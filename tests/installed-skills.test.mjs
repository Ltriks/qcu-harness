import test from 'node:test'
import assert from 'node:assert/strict'
import {projectInstalledSkills,InstalledSkillInventory,launchSkillDraft,launchOfficeDraft,officeTasks,taskPresentation} from '../hub/plugins/qcu-market/src/capability-library.mjs'
const entry=id=>({id,title:id,kind:'skill',release:{id,skill:id,version:'catalog-version'}})
test('installed list uses local state across versions; excludes absent skills and expert templates',()=>{
 const items=projectInstalledSkills([entry('qcu-one'),entry('qcu-two'),entry('qcu-missing'),entry('qcu-deep-research')],[{name:'qcu-one',installed:true,enabled:true,version:'newer-local-version'},{name:'qcu-two',installed:true,enabled:false},{name:'qcu-deep-research',installed:true,enabled:true}],[{moduleName:'qcu-one',enabled:true,fiberPhase:'active'}])
 assert.deepEqual(items.map(i=>i.id),['qcu-one','qcu-two']);assert.equal(items[0].localStatus.state,'component-active');assert.equal(items[0].installedVersion,'newer-local-version');assert.equal(items[0].release.version,'catalog-version');assert.equal(items[1].localStatus.state,'installed-disabled')
})
test('local inventory works without a market request, retains stable flows, and blocks stale states on error',async()=>{
 let fail=false,state;const manager={listBundles:async()=>{if(fail)throw Error('offline');return {ok:true,value:[{name:'qcu-one',installed:true,enabled:true}]}},listPlugins:async()=>({ok:true,value:[{moduleName:'qcu-one',enabled:true,fiberPhase:'active'}]})}
 const inventory=new InstalledSkillInventory(manager,()=>[entry('qcu-one')],patch=>{state={...state,...patch}});await inventory.refresh();const flow=state.localSkillFlows['qcu-one'];assert.equal(flow.snapshot().status.state,'component-active');await inventory.refresh();assert.equal(state.localSkillFlows['qcu-one'],flow);fail=true;await inventory.refresh();assert.equal(state.localSkills.phase,'error');assert.equal(flow.snapshot().status,null);inventory.dispose()
})
test('direct skill launch verifies local state, retains official session binding and never sends',async()=>{
 const calls=[],runtime={workspaces:{list:{getSnapshot:()=>({items:[{workspaceId:'w'}]})}},isSkillActive:async id=>{calls.push(['verify',id]);return true},sessions:{create:async v=>{calls.push(['create',v]);return 's'},retain:()=>({binding:{ctx:{}},release:()=>calls.push(['release'])})},conversation:{input:{for:()=>({snapshot:{draft:'',attachmentIds:[]},setDraft:v=>calls.push(['draft',v])})}},uiWorkspace:{openSession:v=>calls.push(['open',v])},layout:{selectPanel:v=>calls.push(['panel',v])}}
 assert.deepEqual(await launchSkillDraft(runtime,{item:entry('qcu-one'),workspaceId:'w',task:'研究课堂活动'}),{sessionId:'s',sent:false});assert.deepEqual(calls[0],['verify','qcu-one']);assert.ok(calls.some(c=>c[0]==='draft'&&c[1]==='/qcu-one\n研究课堂活动'));assert.equal(calls.at(-1)[0],'release')
 calls.length=0;runtime.isSkillActive=async()=>false;await assert.rejects(launchSkillDraft(runtime,{item:entry('qcu-one'),workspaceId:'w',task:'x'}),/尚未启用/);assert.equal(calls.length,0)
 runtime.isSkillActive=async()=>true;runtime.conversation.input.for=()=>({snapshot:{draft:'keep'},setDraft:()=>assert.fail('overwrite')});await assert.rejects(launchSkillDraft(runtime,{item:entry('qcu-one'),workspaceId:'w',task:'x'}),/不会覆盖/)
})
test('department suite expands into independent members while retaining one install identity',()=>{
 const items=projectInstalledSkills([],[{name:'qcu-accounting-suite',installed:true,enabled:true,version:'0.1.0-pilot.1'}],[{moduleName:'qcu-accounting-suite',enabled:true,fiberPhase:'active'}]);assert.equal(items.length,5)
 const member=items.find(i=>i.id==='qcu-accounting-journals');assert.equal(member.release.id,'qcu-accounting-suite');assert.equal(member.skillName,'qcu-accounting-journals');assert.equal(member.packageId,'qcu-accounting-suite');assert.equal(member.localStatus.state,'component-active')
 const changed=projectInstalledSkills([],[{name:'qcu-accounting-suite',installed:true,enabled:true,version:'future-version'}],[{moduleName:'qcu-accounting-suite',enabled:true,fiberPhase:'active'}]);assert.equal(changed.length,1,'unknown suite version must not invent member availability')
})
test('office tasks prepare ordinary drafts without pretending to be installed skills',async()=>{
 const calls=[],runtime={workspaces:{list:{getSnapshot:()=>({items:[{workspaceId:'w'}]})}},isSkillActive:()=>assert.fail('office task must not invoke skill activation checks'),sessions:{create:async()=>{calls.push(['create']);return 'office'},retain:()=>({binding:{ctx:{}},release:()=>calls.push(['release'])})},conversation:{input:{for:()=>({snapshot:{draft:'',attachmentIds:[]},setDraft:text=>calls.push(['draft',text])})}},uiWorkspace:{openSession:id=>calls.push(['open',id])},layout:{selectPanel:id=>calls.push(['panel',id])}}
 await launchOfficeDraft(runtime,{id:'qcu-office-minutes',workspaceId:'w',task:'会议决定：周五演示；负责人待定。'});const text=calls.find(c=>c[0]==='draft')[1];assert.ok(text.includes('负责人')&&text.includes('会议决定'));assert.equal(text.startsWith('/'),false);assert.equal(calls.at(-1)[0],'release')
 calls.length=0;await assert.rejects(launchOfficeDraft(runtime,{id:'unknown',workspaceId:'w',task:'x'}),/不可用/);assert.equal(calls.length,0)
 for(const entry of officeTasks){calls.length=0;const result=await launchOfficeDraft(runtime,{id:entry.id,workspaceId:'w',task:'',allowEmpty:true});assert.equal(result.sent,false);const prompt=calls.find(c=>c[0]==='draft')[1];assert.ok(prompt.includes(entry.title)&&prompt.includes(entry.instructions)&&prompt.includes('我的材料与要求'));assert.equal(prompt.startsWith('/'),false);assert.ok(calls.some(c=>c[0]==='open'))}
 calls.length=0;await assert.rejects(launchOfficeDraft(runtime,{id:officeTasks[0].id,workspaceId:'w',task:''}),/填写材料/);await assert.rejects(launchOfficeDraft(runtime,{id:officeTasks[0].id,workspaceId:'missing',task:'',allowEmpty:true}),/工作文件夹/);assert.equal(calls.length,0)
 runtime.conversation.input.for=()=>({snapshot:{draft:'existing',attachmentIds:['a']},setDraft:()=>assert.fail('must not overwrite')});await assert.rejects(launchOfficeDraft(runtime,{id:officeTasks[0].id,workspaceId:'w',task:'',allowEmpty:true}),/不会覆盖/)
 assert.deepEqual([...new Set(officeTasks.map(t=>t.workGroup))].sort(),['meetings','reports','tables','writing']);assert.equal(taskPresentation({id:'qcu-accounting-journals'}).workGroup,'departments')
})
