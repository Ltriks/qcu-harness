import test from 'node:test'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {admissionOut} from './support/reading-admission.mjs'
import {publishedReading} from './support/reading-publication.mjs'
import {prepareAdmissionFeeds,hash} from './support/reading-admission.mjs'
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises'
import {resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {verifyUpdateEnvelope} from '../hub/plugins/qcu-market/src/update-host.mjs'
import {legacyUpdatePolicy,expertUpdatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
test('actual immutable reading upload/review/prepare/signed publish/withdraw/restore preserves existing teacher product',async()=>{
 const p=await publishedReading(join(admissionOut,'publication'))
 try{assert.equal(p.evidence.status,'passed');assert.equal(p.authority.snapshot().catalog.revision,4)}finally{await p.close()}
})
test('actual manifest-pinned Hub routes serve all three signed projections and exact package hashes',async()=>{
 const dir=await mkdtemp('/private/tmp/qcu-reading-routes-');let child,origin
 const result={status:'running',routes:[],unknownRoutesDenied:true,writesDenied:true}
 try{
  const f=await prepareAdmissionFeeds(join(dir,'producer')),snapshot=join(dir,'snapshot');await mkdir(join(snapshot,'plugins'),{recursive:true})
  const files={'index.html':Buffer.from('Synthetic route fixture'),'themes.html':Buffer.from('Synthetic route fixture')}
  const plugins=f.plugins.filter(p=>!p.synthetic).map(p=>({...p,status:'published',review:'approved'}));files['catalog.json']=Buffer.from(JSON.stringify({schemaVersion:1,audience:'lan-private',publicRelease:false,skills:[],plugins}))
  for(const [projection,file] of [['legacy','updates.json'],['v2','updates-v2.json'],['v3','updates-v3.json']])files[file]=await readFile(join(f.feeds,file))
  for(const p of plugins)files['plugins/'+p.file]=await readFile(join(f.job.archives,p.file))
  for(const [name,raw] of Object.entries(files))await writeFile(join(snapshot,name),raw)
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,files:Object.fromEntries(Object.entries(files).map(([name,raw])=>[name,{bytes:raw.length,sha256:hash(raw)}]))}));await writeFile(join(snapshot,'manifest.json'),manifest)
  const code="import importlib.util,sys; s=importlib.util.spec_from_file_location('hub',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); server=m.make_server(m.load_snapshot(sys.argv[2],sys.argv[3]),port=0); print(server.server_port,flush=True); server.serve_forever()"
  child=spawn('python3',['-B','-c',code,resolve('hub/release/serve-hub.py'),snapshot,hash(manifest)],{stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',b=>log+=b)
  const port=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('route server timeout '+log)),10000);child.stdout.once('data',b=>{clearTimeout(timer);r(Number(b.toString().trim()))});child.once('exit',c=>{clearTimeout(timer);j(Error('route server exit '+c+' '+log))})});origin='http://127.0.0.1:'+port
  for(const [projection,file,products] of [['legacy','updates.json',legacyUpdatePolicy.products],['v2','updates-v2.json',expertUpdatePolicy.products],['v3','updates-v3.json',f.keys.policy.products]]){
   const r=await fetch(origin+'/'+file);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^application\/json/);assert.equal(r.headers.get('cache-control'),'no-store');const raw=Buffer.from(await r.arrayBuffer());assert.deepEqual(raw,files[file]);const feed=verifyUpdateEnvelope(JSON.parse(raw),{...f.keys.policy,products});assert.equal(feed.entries.some(e=>e.id==='qcu-reading'),projection==='v3');result.routes.push({projection,file,channel:feed.channel,sha256:hash(raw),signature:true})
   const head=await fetch(origin+'/'+file,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'')
   for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await fetch(origin+'/'+file,{method})).status,405)
  }
  for(const p of plugins){const r=await fetch(origin+'/plugins/'+p.file);assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),p.sha256)}
  for(const path of ['/updates-v4.json','/updates-v3.json?x=1','/updates-review.json','/private/signing.key','/manifest.json'])assert.equal((await fetch(origin+path)).status,404)
  child.kill('SIGTERM');await once(child,'exit');await writeFile(join(snapshot,'updates-v3.json'),'tampered')
  const check=spawn('python3',['-B','hub/release/serve-hub.py','--root',snapshot,'--manifest-sha256',hash(manifest)],{stdio:['ignore','pipe','pipe']});let error='';check.stderr.on('data',b=>error+=b);const [status]=await once(check,'exit');assert.equal(status,1);assert.match(error,/file-integrity-mismatch/);result.tamperedSnapshotRejected=true;result.status='passed';result.manifestSha256=hash(manifest)
 }finally{
  if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit')}
  if(origin)await assert.rejects(fetch(origin+'/updates-v3.json'))
  result.temporaryServerClosed=true;await writeFile(join(admissionOut,'routing-proof.json'),JSON.stringify(result,null,2));await rm(dir,{recursive:true,force:true})
 }
})
