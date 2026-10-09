import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, request } from 'node:http'
import { validateCatalog, sha256, verifyDirectory, stageRelease, fetchPinned, planChange } from '../hub/release/catalog.mjs'
const archive = Buffer.from('synthetic opaque archive, not an installable plugin')
function entry(version='0.0.1-test.1', bytes=archive) {
  const hash=sha256(bytes)
  return { id:'qcu-probe', name:'Synthetic probe',category:'Synthetic',risk:'test',summary:'Not school rules',version,status:'published',review:'approved',synthetic:true,defaultDisabled:true,bytes:bytes.length,sha256:hash,file:`qcu-probe-${version}-${hash}.tgz`,dshVersions:['0.2.0-rc.2'] }
}
function catalog(entries=[entry()]) {return {schemaVersion:1,revision:'test-one',title:'Synthetic',tagline:'test',updated_at:'2026-10-09',compatible_dsh:'exact entry versions',install_hint:'manual approval',skill_hint:'separate channel',plugin_hint:'default disabled',audience:'lan-private',publicRelease:false,skills:[],plugins:entries}}
async function temp(t) {const root=await mkdtemp(join(tmpdir(),'qcu-release-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root}
async function fixture(root, c=catalog()) {await mkdir(root);await mkdir(join(root,'plugins'));await writeFile(join(root,'catalog.json'),JSON.stringify(c));for(const e of c.plugins)await writeFile(join(root,'plugins',e.file),archive)}
function mocked(c, bytes=archive) {return async url => new Response(url.pathname==='/catalog.json'?JSON.stringify(c):bytes)}
function fetchArgs(c,target,extra={}) {return {origin:'http://127.0.0.1:12345/',catalogPin:sha256(Buffer.from(JSON.stringify(c))),kind:'plugins',id:'qcu-probe',version:'0.0.1-test.1',dshVersion:'0.2.0-rc.2',target,fetchImpl:mocked(c),...extra}}

test('reject draft, unbounded version, unsafe names and unreviewed rows',()=>{
  for(const patch of [{status:'draft'},{review:'pending'},{version:'latest'},{file:'../escape.tgz'},{defaultDisabled:false},{dshVersions:['*']},{sha256:'bad'}]) assert.throws(()=>validateCatalog(catalog([{...entry(),...patch}])))
  assert.throws(()=>validateCatalog({...catalog(),install:'shell'}),/unknown-field/)
  assert.throws(()=>validateCatalog(catalog([entry(),entry()])),/duplicate/)
})
test('fresh stage verifies exact bytes and never overwrites existing output',async t=>{
 const root=await temp(t),src=join(root,'src'),dst=join(root,'release');await fixture(src)
 const pin=await stageRelease(src,dst);assert.equal(pin,(await verifyDirectory(dst)).catalogSha256)
 await assert.rejects(stageRelease(src,dst),/EEXIST/)
 await writeFile(join(src,'plugins',entry().file),'changed')
 await assert.rejects(stageRelease(src,join(root,'bad')),/integrity/)
 await assert.rejects(readFile(join(root,'bad','catalog.json')),/ENOENT/)
})
test('reject symlink archive and package directory',async t=>{
 const root=await temp(t),src=join(root,'src');await fixture(src)
 const path=join(src,'plugins',entry().file);await rm(path);await symlink(join(src,'catalog.json'),path)
 await assert.rejects(verifyDirectory(src),/unsafe-resource/)
 await rm(join(src,'plugins'),{recursive:true});await symlink(root,join(src,'plugins'))
 await assert.rejects(verifyDirectory(src),/unsafe-package-directory/)
})
test('pinned download succeeds and refuses existing file',async t=>{
 const target=join(await temp(t),'probe.tgz'),c=catalog();assert.equal((await fetchPinned(fetchArgs(c,target))).installed,false)
 assert.deepEqual(await readFile(target),archive);await assert.rejects(fetchPinned(fetchArgs(c,target)),/EEXIST/)
})
test('tampered catalog, archive and incompatible runtime never write output',async t=>{
 const root=await temp(t),c=catalog()
 for(const extra of [{catalogPin:'0'.repeat(64)},{fetchImpl:mocked(c,Buffer.from('bad'))},{dshVersion:'0.1.1-rc.2'}]) {
  const target=join(root,'bad');await assert.rejects(fetchPinned(fetchArgs(c,target,extra)));await assert.rejects(readFile(target),/ENOENT/)
 }
})
test('private HTTP origin is exact IP, no credentials, query or redirect',async t=>{
 const c=catalog(),target=join(await temp(t),'bad')
 for(const origin of ['http://127.attacker.example/','http://8.8.8.8/','http://user@example.test/','http://127.0.0.1/?x=1']) await assert.rejects(fetchPinned(fetchArgs(c,target,{origin})))
 await assert.rejects(fetchPinned(fetchArgs(c,target,{fetchImpl:async()=>Response.redirect('http://127.0.0.1:9/')})),/http-failure/)
})
test('bounded streaming cancels excess body before writing',async t=>{
 const c=catalog(),target=join(await temp(t),'bad');let cancelled=false
 const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(256*1024+1))},cancel(){cancelled=true}})
 await assert.rejects(fetchPinned(fetchArgs(c,target,{fetchImpl:async()=>new Response(stream)})),/too-large/)
 assert.equal(cancelled,true);await assert.rejects(readFile(target),/ENOENT/)
})
test('update and explicit rollback retain immutable previous artifact without claiming data rollback',()=>{
 const old=catalog(),next=catalog([entry(),entry('0.0.1-test.2')]);next.revision='test-two'
 const plan=planChange({catalog:next,previousCatalog:old,kind:'plugins',id:'qcu-probe',fromVersion:'0.0.1-test.1',toVersion:'0.0.1-test.2',dshVersion:'0.2.0-rc.2'})
 assert.equal(plan.rollback.sha256,old.plugins[0].sha256);assert.equal(plan.profileDataRollbackVerified,false);assert.equal(plan.automatic,false)
 const rollback=planChange({catalog:old,previousCatalog:next,kind:'plugins',id:'qcu-probe',fromVersion:'0.0.1-test.2',toVersion:'0.0.1-test.1',dshVersion:'0.2.0-rc.2'});assert.equal(rollback.to.version,'0.0.1-test.1')
 const rewritten=catalog([entry('0.0.1-test.1',Buffer.from('changed')),entry('0.0.1-test.2')])
 assert.throws(()=>planChange({catalog:rewritten,previousCatalog:old,kind:'plugins',id:'qcu-probe',fromVersion:'0.0.1-test.1',toVersion:'0.0.1-test.2',dshVersion:'0.2.0-rc.2'}),/rewritten/)
})
test('real temporary loopback HTTP transport verifies external pin and exact package',async t=>{
 const c=catalog(),root=await temp(t);const server=createServer((req,res)=>{if(req.url==='/catalog.json')res.end(JSON.stringify(c));else if(req.url===`/plugins/${entry().file}`)res.end(archive);else{res.statusCode=404;res.end()}})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try { const result=await fetchPinned(fetchArgs(c,join(root,'real.tgz'),{origin:`http://127.0.0.1:${server.address().port}/`,fetchImpl:fetch}));assert.equal(result.sha256,sha256(archive)) }
 finally {await new Promise(resolve=>server.close(resolve))}
})

test('read-only server allowlist rejects foreign Host, writes, query and unknown routes',async t=>{
 const { createCatalogServer } = await import('../hub/release/serve.mjs')
 const root=await temp(t),src=join(root,'src');await fixture(src)
 await assert.rejects(createCatalogServer(src,{host:'0.0.0.0',lanApproved:true}),/private-lan/)
 const server=await createCatalogServer(src);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const origin=`http://127.0.0.1:${server.address().port}`
 try {
   assert.equal((await fetch(origin+'/')).status,200)
   assert.equal((await fetch(origin+'/catalog.json')).status,200)
   assert.equal((await fetch(origin+`/plugins/${entry().file}`)).status,200)
   for(const path of ['/missing','/catalog.json?x=1','/plugins/','/credentials.json'])assert.equal((await fetch(origin+path)).status,404)
   assert.equal((await fetch(origin+'/catalog.json',{method:'POST'})).status,403)
   const foreignStatus = await new Promise((resolve,reject)=>{const req=request(origin+'/catalog.json',{headers:{Host:'foreign.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()})
   assert.equal(foreignStatus,403)
   assert.equal((await fetch(origin+'/catalog.json',{method:'HEAD'})).headers.get('content-length'),String(Buffer.byteLength(JSON.stringify(catalog()))))
 } finally {await new Promise(resolve=>server.close(resolve))}
})

test('aggregate release size is bounded before reading packages',()=>{
 const entries=[1,2,3].map(n=>({...entry(`0.0.${n}`),bytes:32*1024*1024}))
 assert.throws(()=>validateCatalog(catalog(entries)),/release-too-large/)
})
