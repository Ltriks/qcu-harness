// Real admin/store/publication APIs in the existing disposable fixture.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {CatalogAuthority,verifyCatalog} from '../../hub/plugins/qcu-market/src/catalog-authority.mjs'
import {admissionOut,readingRoot,readingMeta,readingRaw,readingSource,hash} from './reading-admission.mjs'
export async function publishedReading(output){
 await mkdir(output,{recursive:true})
 const child=spawn('python3',['-B','tests/support/hub-publication-fixture.py'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
 let log='',closed=false,fixture;child.stderr.on('data',b=>log+=b)
 const close=async()=>{if(closed)return;closed=true;if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit')}if(fixture)for(const origin of [fixture.admin,fixture.public])await assert.rejects(fetch(origin+'/'));await writeFile(join(output,'server-closed.json'),JSON.stringify({ownedFixturePid:child.pid,closed:true,origins:fixture?[fixture.admin,fixture.public]:[],connectionRefused:Boolean(fixture),exitCode:child.exitCode,signal:child.signalCode,stderr:log},null,2))}
 try{
  fixture=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('publication fixture timeout '+log)),15000);child.stdout.once('data',b=>{clearTimeout(timer);try{r(JSON.parse(b.toString().trim()))}catch(e){j(e)}});child.once('exit',c=>{clearTimeout(timer);j(Error('fixture exit '+c+' '+log))})})
  const login=await fetch(fixture.admin+'/api/login',{method:'POST',headers:{Origin:fixture.admin,'content-type':'application/vnd.qcu.submission+json'},body:JSON.stringify({account:'qcu-admin',password:'Synthetic-only-admin-2026!'})});assert.equal(login.status,200);const {token}=await login.json()
  const api=async(path,body,{status=200}={})=>{const r=await fetch(fixture.admin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{Origin:fixture.admin,'content-type':'application/vnd.qcu.submission+json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value}
  const upload=async(root,{reading=false}={})=>{
   const files=[],projection={source:root,retained:[],omitted:[],reason:'Existing 64-file/text-only upload bounds; PNG, .log and SHA256SUMS extras are omitted; original handoff and archive remain byte-identical.'}
   async function walk(dir=''){for(const row of await readdir(join(root,dir),{withFileTypes:true})){const name=dir?dir+'/'+row.name:row.name;if(row.isDirectory()){await walk(name);continue}assert.ok(row.isFile()&&!row.isSymbolicLink());const raw=await readFile(join(root,name)),entry={path:name,bytes:raw.length,sha256:hash(raw)};if(reading&&((name.startsWith('screenshots/')&&name.endsWith('.png'))||name.endsWith('.log')||name==='SHA256SUMS')){projection.omitted.push(entry);continue}projection.retained.push(entry);files.push({path:name,base64:raw.toString('base64')})}}
   await walk();if(reading)await writeFile(join(output,'handoff-projection.json'),JSON.stringify(projection,null,2))
   const record=await api('submissions',{files});assert.equal(record.status,'in-review',JSON.stringify(record.report));return record
  }
  const attachment=(meta,reading=false)=>({purpose:reading?'本地材料伴读：导入 TXT/MD/PDF/DOCX，检索原文、记录笔记并逐次确认发送有来源的提问。':'预存教师工具（合成夹具，仅核对发布保留行为）。',scenario:'通用工具',prerequisites:'官方 DSH 0.2.0-rc.2；本机测试使用合成安装与模型适配器。',example:'先选材料、查原文；每次发送问题前确认片段范围。此页不调用模型。',risk:reading?'读取所选本地工作区与导入字节；写入 .qcu-reading 快照、笔记、历史和备份；Worker 有界解析，无 OCR 或外部资源下载。仅逐次确认后调用官方默认模型；不注册 DSH 工具或 Skill。':'惰性合成夹具；不代表教师业务已通过。',testStatus:reading?'pilot.4 source/preview passed；native installation and teacher/business acceptance UNTESTED。本机模拟操作员审核、临时密钥签名发布与浏览器链路测试；不代表真人批准或生产上架。':'Synthetic publication preservation test only; native and business untested.',provenance:{ownership:'qcu',author:reading?'QCU 材料伴读项目':'Synthetic fixture authors',upstreamSource:reading?'QCU repository; immutable reading pilot.4 package; bundled parser notices retained.':'Trusted repository fixture generator',pinnedRevision:meta.sourceRevision,license:meta.license,modifications:reading?'使用 source2a 固定归档，不修改源码、归档或既有交接；仅测试市场准入。':'Synthetic acceptance data only.'}})
  const prepare=async(record,reading=false)=>{
   const path='submissions/'+record.id,entry=attachment(record.metadata,reading)
   if(reading){const wrong=structuredClone(entry);wrong.provenance.pinnedRevision='0'.repeat(40);await api(path+'/market-entry',{materialsDigest:record.materialsDigest,entry:wrong},{status:400});await api(path+'/market-entry',{materialsDigest:'0'.repeat(64),entry},{status:409})}
   await api(path+'/market-entry',{materialsDigest:record.materialsDigest,entry})
   const reviewed=await api(path+'/review',{action:'approve',reason:'SIMULATION ONLY: exact source/archive, license, permissions and evidence boundaries inspected. Native/model/business untested.',materialsDigest:record.materialsDigest,checklist:{source:true,license:true,permissions:true,evidenceBoundaries:true}})
   assert.equal(reviewed.approval.entryDigest,reviewed.marketEntryDigest)
   if(reading)await api(path+'/market-entry',{materialsDigest:record.materialsDigest,entry},{status:409})
   const preview=await api(path+'/preview');if(reading)await api(path+'/prepare',{confirm:true,materialsDigest:record.materialsDigest,proposalDigest:'0'.repeat(64)},{status:409})
   return api(path+'/prepare',{confirm:true,materialsDigest:record.materialsDigest,proposalDigest:preview.proposalDigest})
  }
  const preview=async(record,operation)=>api('submissions/'+record.id+'/publication-preview',{operation})
  const confirm=async(record,p,options)=>api('submissions/'+record.id+'/publish',{operation:p.proposal.operation,previewDigest:p.previewDigest,confirm:true},options)
  const publish=async(record,operation='publish')=>{const p=await preview(record,operation);const r=await confirm(record,p);assert.equal(r.state,'verified');return {preview:p,result:r}}
  const teacher=await prepare(await upload(fixture.handoff));await publish(teacher)
  const authority=new CatalogAuthority(fixture.trust,{test:true,root:join(fixture.root,'reading-authority')})
  let teacherEntry
  const snapshot=async name=>{
   const s=await authority.refresh();assert.equal(s.state,'fresh',s.message)
   const raw=Buffer.from(await(await fetch(fixture.public+'/market/catalog.signed.json')).arrayBuffer());const verified=verifyCatalog(raw,fixture.trust,{test:true});assert.equal(verified.payload.revision,s.catalog.revision)
   await writeFile(join(output,name+'-catalog.signed.json'),raw)
   const current=s.catalog.entries.find(e=>e.id===teacher.metadata.id);if(!teacherEntry)teacherEntry=current;assert.deepEqual(current,teacherEntry)
   return s
  }
  await snapshot('teacher-before')
  const uploaded=await upload(join(readingRoot,'handoff'),{reading:true});assert.equal(uploaded.metadata.sourceRevision,readingSource);assert.deepEqual(uploaded.metadata.archive,readingMeta.archive);assert.equal(uploaded.metadata.testEvidence.liveInstall.status,'untested');assert.equal(uploaded.metadata.testEvidence.businessAcceptance.status,'untested')
  const reading=await prepare(uploaded,true),pending=await preview(reading,'publish');assert.equal((await snapshot('reading-pending')).catalog.entries.length,1)
  const published=await confirm(reading,pending);assert.equal(published.state,'verified')
  let s=await snapshot('reading-published');assert.equal(s.catalog.revision,2);const entry=s.catalog.entries.find(e=>e.id==='qcu-reading');assert.equal(entry.kind,'bundle');assert.deepEqual(entry.capabilities,['tools']);for(const field of ['skill','provider','skillSha256'])assert.equal(entry.release[field],null)
  assert.equal(entry.provenance.pinnedRevision,readingSource);assert.equal(entry.release.sha256,readingMeta.archive.sha256)
  const url=fixture.public+'/plugins/'+readingMeta.archive.file,download=Buffer.from(await(await fetch(url)).arrayBuffer());assert.deepEqual(download,readingRaw);await writeFile(join(output,readingMeta.archive.file),download)
  await publish(reading,'withdraw');s=await snapshot('reading-withdrawn');assert.equal(s.catalog.revision,3);assert.equal(s.catalog.entries.some(e=>e.id==='qcu-reading'),false);assert.deepEqual(Buffer.from(await(await fetch(url)).arrayBuffer()),readingRaw)
  await confirm(reading,pending,{status:409});await publish(reading,'rollback');s=await snapshot('reading-restored');assert.equal(s.catalog.revision,4);assert.deepEqual(s.catalog.entries.find(e=>e.id==='qcu-reading'),entry)
  const evidence={status:'passed',scope:'actual local admin API/store and signed HTTP; synthetic operator/account and ephemeral key only',archive:readingMeta.archive,sourceRevision:readingSource,materialsDigest:reading.materialsDigest,entryDigest:reading.marketEntryDigest,approvalEntryDigest:reading.approval.entryDigest,publishPreviewDigest:pending.previewDigest,teacher:{id:teacher.metadata.id,synthetic:true,preserved:true,nativeAndBusiness:'untested'},revisions:[1,2,3,4],staleConfirmationRefused:true,archiveImmutableThroughWithdrawal:true,skill:null,provider:null,nativePilot4:'untested',business:'untested',production:'untouched'}
  await writeFile(join(output,'publication-proof.json'),JSON.stringify(evidence,null,2))
  return {fixture,authority,entry,api,close,evidence}
 }catch(e){await close();throw e}
}
