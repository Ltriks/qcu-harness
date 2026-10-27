import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile,readdir,symlink,link,chmod,cp} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {FeedbackTransport} from '../hub/plugins/qcu-market/src/feedback-host.mjs'
import {FeedbackReceiptJournal,feedbackReceiptId} from '../hub/plugins/qcu-market/src/feedback-storage.mjs'
import {FeedbackFlow,feedbackFingerprint} from '../hub/plugins/qcu-market/src/feedback-flow.mjs'
import {feedbackCanonical,validateFeedbackSubmission} from '../hub/plugins/qcu-market/src/feedback-schema.mjs'
import {createTeacherHomeState} from '../tools/teacher-branding/src/plugin.mjs'
import {teachingTasks} from '../tools/teacher-branding/src/tasks.mjs'
import {CatalogRuntime} from '../hub/plugins/qcu-market/src/catalog-runtime.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
import {reviewHash,reviewPreview,reviewSubmission} from './support/product-polish-review-fixture.mjs'
const unwrap=async v=>JSON.parse(await v)
async function fixture(t){
 const root=await mkdtemp('/private/tmp/qcu-feedback-review-');t.after(()=>rm(root,{recursive:true,force:true}));const journal=new FeedbackReceiptJournal(join(root,'receipts'))
 const received=new Map(),calls=[];let mode='normal'
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body),method=url.split('/').at(-1);calls.push({method,body,options,url})
  if(method==='submit')received.set(body.requestId,{receiptId:feedbackReceiptId(body.requestId),state:'received',revision:1,updatedAt:'2026-10-27T00:00:00Z',message:''})
  let value=received.get(body.requestId)??{error:'feedback.missing'},status=received.has(body.requestId)?200:404
  if(mode==='500') {value={error:'feedback.unavailable'};status=500}
  if(mode==='forged')value={...value,receiptId:'0'.repeat(64)}
  const raw=feedbackCanonical(value);return new Response(raw,{status,headers:{'content-length':String(Buffer.byteLength(raw))}})
 }
 const host=new FeedbackTransport({journal,fetcher,runtime:'0.2.0-rc.2'});t.after(()=>host.dispose())
 const remote=h=>({qcuMarket:{feedbackSubmit:(p,s)=>h.post('submit',p,s),feedbackStatus:(p,s)=>h.post('status',p,s),feedbackReceipts:()=>h.receipts()}})
 return {root,journal,received,calls,fetcher,host,remote,setMode:v=>mode=v}
}
test('whole preview fingerprint agrees with Python Unicode; each field mutation is refused before journal/network',async t=>{
 const f=await fixture(t),preview=reviewPreview();preview.title='中文😀 e\u0301\t匿名';const body=reviewSubmission(undefined,preview)
 const python=spawn('rtk',['proxy','python3','-c',"import sys,json,hashlib;v=json.load(sys.stdin);print(hashlib.sha256(json.dumps(v,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest())"],{stdio:['pipe','pipe','pipe']});let out='';python.stdout.on('data',b=>out+=b);python.stdin.end(feedbackCanonical(preview));await new Promise(r=>python.once('exit',r));assert.equal(out.trim(),body.previewSha256);assert.equal(await feedbackFingerprint(preview),body.previewSha256)
 for(const delta of [{confirmed:false},{requestId:'bad'},{steps:'字'.repeat(1201)},{title:'api_key=synthetic-secret'},{category:'other'},{title:'改动'},{steps:'新步骤'},{expected:'新期望'},{actual:'新现象'},{knownVersions:{...body.knownVersions,runtime:'0.2.0-rc.2'}},{text:'改动预览'}]){const r=await unwrap(f.host.post('submit',feedbackCanonical({...body,...delta})));assert.equal(r.ok,false);assert.equal(r.tracked,false)}
 assert.equal(f.calls.length,0);assert.equal((await f.journal.list()).records.length,0)
 assert.throws(()=>validateFeedbackSubmission({...body,title:'\ud800'}));assert.throws(()=>validateFeedbackSubmission({...body,extra:'private'}))
})
test('pending intent precedes POST, fresh Host/Client restores history without HTTP, explicit query only',async t=>{
 const f=await fixture(t),body=reviewSubmission();let checked=false
 const host=new FeedbackTransport({journal:f.journal,fetcher:async(...args)=>{assert.equal((await f.journal.list()).records[0].requestId,body.requestId);checked=true;return f.fetcher(...args)}})
 assert.equal((await unwrap(host.post('submit',feedbackCanonical(body)))).ok,true);assert.ok(checked);host.dispose()
 const restarted=new FeedbackTransport({journal:new FeedbackReceiptJournal(join(f.root,'receipts')),fetcher:f.fetcher});t.after(()=>restarted.dispose())
 const flow=new FeedbackFlow(f.remote(restarted));t.after(()=>flow.dispose());await flow.restore();assert.equal(f.calls.length,1);assert.equal(flow.state.history.length,1);assert.equal(flow.state.needsNew,true)
 await flow.check();assert.equal(f.calls.length,2);assert.equal(flow.state.history[0].last.state,'received')
 const contents=(await Promise.all((await readdir(join(f.root,'receipts'))).map(n=>readFile(join(f.root,'receipts',n),'utf8')))).join('');for(const value of [body.title,body.text,body.actual,'knownVersions','payload'])assert.ok(!contents.includes(value))
})
test('committed 5xx stays unknown, duplicate intent never reposts, explicit new choice retains old receipt',async t=>{
 const f=await fixture(t);f.setMode('500');const flow=new FeedbackFlow(f.remote(f.host));t.after(()=>flow.dispose())
 await flow.preview(reviewPreview());flow.acknowledge(true);await flow.submit();assert.equal(flow.state.phase,'unknown');const first=flow.state.history[0]
 await assert.rejects(flow.preview(reviewPreview()),e=>e.code==='feedback.new-required');const duplicate=await unwrap(f.host.post('submit',feedbackCanonical(reviewSubmission(first.requestId))));assert.equal(duplicate.unknown,true);assert.equal(f.calls.length,1)
 flow.startNew();f.setMode('normal');await flow.preview(reviewPreview());flow.acknowledge(true);await flow.submit();assert.equal(flow.state.history.length,2);assert.equal(flow.state.history[0].requestId,first.requestId);assert.equal((await f.journal.list()).records.length,2)
 await flow.check(first.requestId);assert.equal(flow.state.history.find(r=>r.requestId===first.requestId).last.state,'received')
})
test('dispose aborts Host fetch; journal survives; forged receipt and invalid replies remain unknown',async t=>{
 const f=await fixture(t);let entered,aborted=false;const started=new Promise(r=>entered=r)
 const host=new FeedbackTransport({journal:f.journal,fetcher:async(_url,{signal})=>{entered();return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'))},{once:true}))}})
 const pending=host.post('submit',feedbackCanonical(reviewSubmission()));await started;host.dispose();assert.equal((await unwrap(pending)).unknown,true);assert.ok(aborted);assert.equal((await f.journal.list()).records.length,1)
 f.setMode('forged');const r=await unwrap(f.host.post('status',feedbackCanonical({requestId:'1'.repeat(64)})));assert.equal(r.ok,false)
})
test('late submit/query failure after reset/dispose cannot overwrite new receipt or resurrect consent',async t=>{
 let finish,started;const ready=new Promise(r=>started=r);const receipts=[]
 const remote={qcuMarket:{feedbackSubmit:async raw=>{const body=JSON.parse(raw);receipts.push(body.requestId);if(receipts.length===1){started();return new Promise(r=>finish=r)}return JSON.stringify({ok:false,error:'feedback.unavailable',unknown:true,tracked:true})}}}
 const flow=new FeedbackFlow(remote);await flow.preview(reviewPreview());flow.acknowledge(true);const pending=flow.submit();await ready;flow.invalidate();flow.startNew();await flow.preview(reviewPreview());flow.acknowledge(true);await flow.submit();const selected=flow.state.selected;finish(JSON.stringify({ok:false,error:'feedback.sensitive',unknown:false,tracked:true}));await pending;assert.equal(flow.state.selected,selected);assert.equal(flow.state.history.length,2);assert.equal(flow.state.ack,false)
 let reject;remote.qcuMarket.feedbackStatus=()=>new Promise((_,r)=>reject=r);const query=flow.check(selected);const before=flow.state;flow.dispose();reject(Error('late'));await query;assert.equal(flow.state,before)
})
test('journal bounded capacity/lock wait, corruption, symlink and hardlink are fail closed before send',async t=>{
 const f=await fixture(t);for(let i=0;i<32;i++)await f.journal.reserve(i.toString(16).padStart(64,'0'),'0.1.0-pilot.16.1')
 const r=await unwrap(f.host.post('submit',feedbackCanonical(reviewSubmission('f'.repeat(64)))));assert.equal(r.error,'feedback.store-full');assert.equal(f.calls.length,0)
 const root=join(f.root,'blocked'),j=new FeedbackReceiptJournal(root,{waitMs:120});await j.ensure();await writeFile(join(root,'.intent-00.lock'),'{}',{mode:0o600});const start=performance.now();await assert.rejects(j.reserve('a'.repeat(64),'0.1.0-pilot.16.1'),e=>e.code==='feedback.store-busy');assert.ok(performance.now()-start<600);assert.equal((await j.list()).blocked,true)
 await writeFile(join(f.root,'receipts/intent-00.json'),'{}');await assert.rejects(f.journal.list())
 const linked=join(f.root,'linked');await symlink(root,linked);await assert.rejects(new FeedbackReceiptJournal(linked).list())
 const clean=new FeedbackReceiptJournal(join(f.root,'hard'));await clean.reserve('b'.repeat(64),'0.1.0-pilot.16.1');await link(join(f.root,'hard/intent-00.json'),join(f.root,'alias'));await assert.rejects(clean.list())
})
test('real processes compete for one immutable intent, capacity remains bounded and idempotent',async t=>{
 const f=await fixture(t);await f.journal.ensure();const module=resolve('hub/plugins/qcu-market/src/feedback-storage.mjs')
 const source=`import {FeedbackReceiptJournal} from ${JSON.stringify(module)};const j=new FeedbackReceiptJournal(process.argv[1]);console.log(JSON.stringify(await j.reserve('c'.repeat(64),'0.1.0-pilot.16.1')))`
 const results=await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{const p=spawn('rtk',['proxy','node','--input-type=module','-e',source,join(f.root,'receipts')],{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('exit',c=>c===0?resolve(JSON.parse(out)):reject(Error(err)))})))
 assert.equal(results.filter(r=>!r.existing).length,1);assert.equal((await f.journal.list()).records.length,1)
})
test('guide persistence stores only bounded step/task/explicit confirmation and ignores legacy success',()=>{
 const data=new Map([['qcu.teacher.initialized.v1','yes'],['old-tutorial','done']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
 const a=createTeacherHomeState({storage,tasks:teachingTasks});assert.equal(a.getSnapshot().firstTaskDone,false);a.update({drafts:{private:'never persist'},workspaceId:'/private/path',guideStep:2,selected:teachingTasks[1].id,viewed:true,firstTaskDone:true,draftOpened:true})
 const raw=data.get('qcu.teacher.first-task.v2');assert.ok(raw.length<512);assert.ok(!/private|draft|workspace|openSettings/.test(raw));const b=createTeacherHomeState({storage,tasks:teachingTasks});assert.equal(b.getSnapshot().firstTaskDone,true);assert.equal(b.getSnapshot().draftOpened,false);assert.deepEqual(b.getSnapshot().drafts,{})
 b.update({guideStep:0,firstTaskDone:false,viewed:false});assert.equal(data.get('qcu.teacher.initialized.v1'),'yes');data.set('qcu.teacher.first-task.v2',JSON.stringify({schema:2,step:99,taskId:'fake',completed:true,viewed:true}));assert.equal(createTeacherHomeState({storage,tasks:teachingTasks}).getSnapshot().firstTaskDone,false)
})

test('stopped synthetic Host receipt backup/restore preserves query capability without content or automatic HTTP',async t=>{
 const f=await fixture(t);assert.equal((await unwrap(f.host.post('submit',feedbackCanonical(reviewSubmission())))).ok,true);f.host.dispose();const restored=join(f.root,'restored');await cp(join(f.root,'receipts'),restored,{recursive:true,force:false,errorOnExist:true});
 const host=new FeedbackTransport({journal:new FeedbackReceiptJournal(restored),fetcher:f.fetcher});t.after(()=>host.dispose());const rows=(await unwrap(host.receipts())).value.records;assert.equal(rows.length,1);assert.equal(f.calls.length,1);assert.equal((await unwrap(host.post('status',feedbackCanonical({requestId:rows[0].requestId})))).ok,true);assert.equal(f.calls.length,2)
});

test('combined preview byte limit is checked before consent or RPC, preserving local copy and empty history',async()=>{
 const calls=[],flow=new FeedbackFlow({qcuMarket:{feedbackSubmit:async()=>calls.push('unexpected')}});const p={...reviewPreview(),text:'汉'.repeat(6000)};await assert.rejects(flow.preview(p),e=>e.code==='feedback.limit');assert.equal(flow.state.preview,null);assert.equal(flow.state.history.length,0);assert.deepEqual(calls,[]);flow.dispose();
});

test('version mismatch and feedback cancellation never unlock an outstanding installer or start a new install',async()=>{
 const f=createPreviewFixture(),remote=f.remote;let state={};const runtime=new CatalogRuntime(remote,p=>state={...state,...p})
 remote.qcuMarket.status=async()=>({ok:true,value:JSON.stringify({...marketRuntime,version:'0.1.0-pilot.16.0'})})
 assert.equal(await runtime.refresh(),false);assert.match(state.refreshMessage,/版本不一致/);assert.equal(runtime.flows.length,0)
 remote.qcuMarket.status=async()=>({ok:true,value:JSON.stringify(marketRuntime)});assert.equal(await runtime.refresh(),true)
 const installer=runtime.flows[0],request={id:'synthetic-pending-install'};installer.request=request
 const feedback=new FeedbackFlow({qcuMarket:{feedbackSubmit:async()=>JSON.stringify({ok:false,error:'feedback.unavailable',unknown:true,tracked:true})}})
 await feedback.preview(reviewPreview());feedback.acknowledge(true);await feedback.submit();feedback.invalidate();feedback.dispose()
 assert.equal(installer.request,request);assert.equal(await runtime.refresh(),false);runtime.reset();assert.equal(installer.request,request)
 assert.equal(f.calls.filter(c=>c.name==='installBundle'||c.name==='prepare'||c.name==='setBundleEnabled'||c.name==='setPluginEnabled').length,0);runtime.dispose()
})
