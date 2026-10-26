import test from 'node:test'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const root=process.env.QCU_TEAMS_PACKAGE_ROOT?pathToFileURL(process.env.QCU_TEAMS_PACKAGE_ROOT+'/'):new URL('../hub/plugins/qcu-expert-teams/',import.meta.url)
const {TeamsController}=await import(new URL('src/controller.mjs',root))
const {VERSION,PROTOCOL}=await import(new URL('src/protocol.mjs',root))
const reply=value=>JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value})
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}}
const running={id:'live',status:'running',team:{name:'Synthetic team'},input:{task:'Synthetic task'},createdAt:1}
test('successful start remains polled when history fails, without starting again',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const calls=[]
 const c=new TeamsController({dispatch:async wire=>{const r=JSON.parse(wire);calls.push(r.action);if(r.action==='start')return reply(running);if(r.action==='history')throw Error('synthetic history failure');if(r.action==='run')return reply({...running,status:calls.filter(x=>x==='run').length===1?'running':'completed'});throw Error(r.action)}})
 t.after(()=>c.dispose());c.set({workspaceId:'synthetic',prepared:{id:'intent'},consent:true});await c.start()
 assert.equal(c.state.run.id,'live');assert.equal(c.state.prepared,null)
 for(let i=0;i<2;i++){t.mock.timers.tick(800);await new Promise(setImmediate)}
 assert.equal(c.state.run.status,'completed');assert.equal(calls.filter(x=>x==='start').length,1);assert.equal(calls.filter(x=>x==='run').length,2)
})
for(const late of ['history','poll'])test(`cleanup rejects late ${late} state and continues observing an unselected running run`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const gate=deferred(),entered=deferred(),calls=[],old={id:'removed',status:'failed'},fresh={runs:[running],capacity:{count:1,bytes:100}}
 let first=true
 const c=new TeamsController({dispatch:async wire=>{const r=JSON.parse(wire);calls.push(r.action)
  if(r.action===late.replace('poll','run')&&first){first=false;entered.resolve();return gate.promise}
  if(r.action==='run'){fresh.runs=[{...running,status:'completed'}];return reply(fresh.runs[0])}
  if(r.action==='history')return reply(fresh)
  if(r.action==='confirmCleanup')return reply({...fresh,removed:['removed']})
  throw Error(r.action)
 }})
 t.after(()=>c.dispose());c.set({workspaceId:'synthetic',run:old,runs:[old,running],capacity:{count:2,bytes:200},selectedRuns:['removed'],cleanup:{id:'cleanup',workspaceId:'synthetic'},cleanupConsent:true})
 c.poll('live',++c.pollEpoch)
 const pending=late==='history'?c.refreshHistory(c.epoch):null
 if(late==='poll')t.mock.timers.tick(800)
 await entered.promise;await c.confirmCleanup();assert.equal(c.state.run,null)
 gate.resolve(reply(late==='history'?{runs:[old,running],capacity:{count:2,bytes:200}}:running));await pending;await new Promise(setImmediate)
 assert.deepEqual(c.state.runs.map(r=>r.id),['live']);assert.equal(c.state.run,null);assert.equal(c.state.capacity.count,1)
 t.mock.timers.tick(800);await new Promise(setImmediate)
 assert.equal(c.state.runs.find(r=>r.id==='live').status,'completed');assert.ok(!calls.includes('start'))
})

test('length notices count Unicode characters including punctuation and numbers, retain text, and distinguish final role',async()=>{
 const {outputLengthNotice,renderReport}=await import(new URL('src/reports.mjs',root))
 assert.equal(outputLengthNotice({output:' 教 '.repeat(180)},false),'')
 assert.match(outputLengthNotice({output:'教'.repeat(178)+'A1。'},false),/181个非空白字符/)
 assert.equal(outputLengthNotice({output:'😀'.repeat(180)},false),'')
 assert.equal(outputLengthNotice({output:'教'.repeat(181)},true),'')
 assert.match(outputLengthNotice({output:'教'.repeat(601)},true),/601个非空白字符/)
 assert.equal(outputLengthNotice(undefined,false),'')
 const output='教'.repeat(601),run={team:{name:'Fixture',outputId:'end'},steps:[{id:'end',name:'Final',output,status:'completed'}],status:'completed',input:{task:'Fixture'}}
 const report=renderReport(run);assert.ok(report.includes(output));assert.match(report,/超过建议的600字符/)
})
