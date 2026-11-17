import {launchInstalledTeam} from '../hub/plugins/qcu-expert-teams/src/native-launch.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {capabilityKind,matchesCapability} from '../hub/plugins/qcu-market/src/capability-library.mjs'

test('expert teams are separated from ordinary skills and unrelated plugins',()=>{
 assert.equal(capabilityKind({id:'qcu-data-copilot',kind:'skill'}),'teams')
 assert.equal(capabilityKind({id:'qcu-expert-teams',kind:'bundle',capabilities:['tools']}),'teams')
 assert.equal(capabilityKind({id:'qcu-hallmark-design',kind:'skill'}),'skills')
 assert.equal(capabilityKind({id:'other',kind:'bundle',capabilities:['tools']}),'plugins')
 assert.equal(matchesCapability({id:'qcu-data-copilot'},'skills'),false)
})

function fixture({phase='ready',enabled=true,existingDraft=''}={}){
 const calls=[]
 return {calls,services:{
  workspaces:{list:{getSnapshot:()=>({phase,items:[{workspaceId:'w1'}]})}},
  isEnabled:async id=>{calls.push(['enabled',id]);return enabled},
  sessions:{create:async input=>{calls.push(['create',input]);return 'fresh-session'}},
  conversation:{input:{shell:id=>({snapshot:{draft:existingDraft,attachmentIds:[]},actions:{setDraft:text=>calls.push(['draft',id,text])}})}},
  uiWorkspace:{openSession:id=>calls.push(['open',id])},layout:{selectPanel:value=>calls.push(['panel',value])},
 }}
}
const team={id:'qcu-data-copilot',name:'智数分析团队',execution:'native-dsh-agent',members:[{id:'lead'}]};
const input={team,workspaceId:'w1',task:'分析 CSV',materials:'data/example.csv'}
test('start creates a fresh workspace-bound session, prefills, navigates, and never sends',async()=>{
 const {calls,services}=fixture()
 const result=await launchInstalledTeam(services,input)
 assert.deepEqual(result,{sessionId:'fresh-session',sent:false})
 assert.deepEqual(calls.map(c=>c[0]),['create','draft','open','panel'])
 assert.deepEqual(calls[0][1],{workspaceId:'w1'})
 assert.ok(calls[1][2].startsWith('/qcu-data-copilot\n'))
 assert.ok(calls[1][2].includes('data/example.csv'))
})
test('invalid workspaces cannot create sessions',async()=>{const {calls,services}=fixture();await assert.rejects(launchInstalledTeam(services,{...input,workspaceId:'missing'}));assert.equal(calls.some(c=>c[0]==='create'),false)})
test('pre-existing draft is preserved even if a session provider reuses an id',async()=>{
 const {calls,services}=fixture({existingDraft:'用户未发送的内容'})
 await assert.rejects(launchInstalledTeam(services,input),/任务未发送/)
 assert.equal(calls.some(c=>c[0]==='draft'||c[0]==='open'),false)
})
test('unavailable teams and invalid tasks do not create sessions',async()=>{for(const data of [{...input,team:{...team,unavailable:true}},{...input,task:' '},{...input,task:'a'.repeat(8001)}]){const {calls,services}=fixture();await assert.rejects(launchInstalledTeam(services,data));assert.deepEqual(calls,[])}})
