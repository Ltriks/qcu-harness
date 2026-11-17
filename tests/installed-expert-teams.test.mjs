import test from 'node:test'
import assert from 'node:assert/strict'
import {resolve,join} from 'node:path'
import {mkdtemp,cp,writeFile,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {discoverInstalledTeams} from '../hub/plugins/qcu-expert-teams/src/installed-teams.mjs'
import {TeamsController} from '../hub/plugins/qcu-expert-teams/src/controller.mjs'
import {VERSION,PROTOCOL} from '../hub/plugins/qcu-expert-teams/src/protocol.mjs'

const names=['qcu-deep-research','qcu-document-team','qcu-data-copilot','qcu-ket-prep','qcu-ncre-prep']
function registry(roots={}){return {list:async()=>[...names.map(name=>({name})),{name:'qcu-hallmark-design'}],get:async name=>({name,description:'test',resourceBase:{kind:'directory',path:roots[name]||resolve('packages',name)}})}}
test('studio discovers five enabled teams with all 28 role resources',async()=>{
 const rows=await discoverInstalledTeams(registry(),'/synthetic',AbortSignal.timeout(3000))
 assert.equal(rows.length,5);assert.equal(rows.reduce((n,r)=>n+r.members.length,0),28)
 assert.equal(rows.find(r=>r.id==='qcu-deep-research').members.length,7)
 assert.ok(rows.every(r=>!r.unavailable&&r.members.every(m=>m.instructions)))
})
test('disabled skill providers are absent and altered roles are unavailable',async()=>{
 const disabled=registry();disabled.get=async()=>undefined
 assert.deepEqual(await discoverInstalledTeams(disabled,'/synthetic'),[])
 const temp=await mkdtemp(join(await realpath(tmpdir()),'qcu-team-invalid-')),root=join(temp,'team')
 await cp(resolve('packages/qcu-deep-research'),root,{recursive:true})
 await writeFile(join(root,'references/agents/topic-researcher.md'),'changed')
 const rows=await discoverInstalledTeams(registry({'qcu-deep-research':root}),'/synthetic')
 assert.equal(rows.find(r=>r.id==='qcu-deep-research').unavailable,true)
 assert.equal(rows.filter(r=>!r.unavailable).length,4)
})
test('workspace catalog presents installed teams without rewriting custom teams or experts',async()=>{
 const installedTeams=await discoverInstalledTeams(registry(),'/synthetic')
 const payload={teams:[],experts:[],runs:[],installedTeams,skills:[]}
 const remote={dispatch:async raw=>{const r=JSON.parse(raw);return JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value:r.action==='workspaces'?[{id:'example',title:'合成工作区'}]:payload})}}
 const launched=[];const c=new TeamsController(remote,{startNative:async input=>launched.push(input),storage:{getItem:()=>null,setItem(){}}})
 try{await c.boot();await c.openInstalledTeam('qcu-deep-research');c.input('task','测试调研');await c.startInstalledTeam();assert.equal(c.state.installedTeams.length,5);assert.equal(c.state.installedTeamId,'qcu-deep-research');assert.equal(launched[0].id,'qcu-deep-research');assert.deepEqual(c.state.teams,[]);assert.deepEqual(c.state.experts,[])}finally{c.dispose()}
})
test('installed but disabled teams remain visible with members, without being launch-ready',async()=>{
 const profile=await mkdtemp(join(await realpath(tmpdir()),'qcu-team-disabled-'))
 await cp(resolve('packages/qcu-deep-research'),join(profile,'node_modules/qcu-deep-research'),{recursive:true})
 const rows=await discoverInstalledTeams(null,'/synthetic',undefined,{profileDir:profile,bundles:[{name:'qcu-deep-research',installed:true,enabled:false,version:'0.1.0-pilot.1'}]})
 assert.equal(rows.length,1);assert.equal(rows[0].members.length,7);assert.equal(rows[0].enabled,false)
})
