import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,readFile,readdir,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

test('default package downloader falls back for macOS host-unreachable and keeps integrity gates',{skip:process.platform!=='darwin'},async()=>{
 const original=globalThis.fetch
 let calls=0
 globalThis.fetch=async()=>{calls++;throw Object.assign(new TypeError('fetch failed'),{cause:{code:'EHOSTUNREACH'}})}
 let fetchPinned
 try{({fetchPinned}=await import('../hub/plugins/qcu-market/src/host-core.mjs?transport-test'))}finally{globalThis.fetch=original}
 const bytes=Buffer.from('synthetic KET package transport fixture')
 const server=createServer((req,res)=>{res.writeHead(req.url==='/redirect'?302:200,{'Content-Length':bytes.length,Location:'/package'});res.end(bytes)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const origin='http://127.0.0.1:'+server.address().port
 const entry={file:'fixture.tgz',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
 try{
  const root=await mkdtemp(join(await realpath(tmpdir()),'qcu-package-transport-'))
  const file=await fetchPinned({entry,root,validate:()=>origin+'/package'})
  assert.deepEqual(await readFile(file),bytes);assert.equal(calls,1)
  await fetchPinned({entry,root,validate:()=>origin+'/package'})
  assert.equal(calls,1) // Verified cache does not repeat network traffic.
  const bad=await mkdtemp(join(await realpath(tmpdir()),'qcu-package-bad-hash-'))
  await assert.rejects(fetchPinned({entry:{...entry,sha256:'0'.repeat(64)},root:bad,validate:()=>origin+'/package'}),/integrity/)
  assert.deepEqual(await readdir(bad),[])
  const redirected=await mkdtemp(join(await realpath(tmpdir()),'qcu-package-redirect-'))
  await assert.rejects(fetchPinned({entry,root:redirected,validate:()=>origin+'/redirect'}),/status or redirect/)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})

test('download failure identifies stage, and cancellation remains cancellation',async()=>{
 const {fetchPinned}=await import('../hub/plugins/qcu-market/src/host-core.mjs')
 const root=await mkdtemp(join(await realpath(tmpdir()),'qcu-package-failed-'))
 const entry={file:'fixture.tgz',bytes:1,sha256:'0'.repeat(64)}
 const options={entry,root,validate:()=> 'http://127.0.0.1:1/fixture',fetcher:async()=>{throw new TypeError('fetch failed')}}
 await assert.rejects(fetchPinned(options),e=>e.code==='QCU-MKT-DOWNLOAD'&&e.message.includes('尚未进入安装阶段'))
 await assert.rejects(fetchPinned({...options,signal:AbortSignal.abort()}),e=>e.name==='AbortError')
})
