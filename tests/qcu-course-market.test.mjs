import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {bundledCatalog,catalogText} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {parseMarketCatalog} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {fetchPinned} from '../hub/plugins/qcu-market/src/host-core.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {createMarketViews} from '../hub/plugins/qcu-market/src/market-view.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json')),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const item=bundledCatalog.entries.find(i=>i.id==='qcu-course-workbench'),release=item.release
test('nine-entry market preserves all eight old fixed releases and pins actual course source, Skill and archive',async()=>{
 assert.equal(bundledCatalog.entries.length,9);assert.deepEqual(item.capabilities,['workbench']);assert.equal(release.skill,'qcu-course-draft')
 for(const file of ['coach-release.json','skill-releases.json','external-skill-release.json','feishu-release.json']){const old=JSON.parse(await readFile('hub/market/'+file,'utf8'));for(const r of Array.isArray(old)?old:[old])assert.deepEqual(bundledCatalog.entries.find(i=>i.id===r.id).release,r)}
 const archive=process.env.QCU_COURSE_ARCHIVE;assert.ok(archive);const bytes=await readFile(archive);assert.equal(bytes.length,release.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),release.sha256)
 const code=`import tarfile,pathlib,subprocess,json
root=pathlib.Path('hub/plugins/qcu-course-workbench')
revision=${JSON.stringify(item.provenance.pinnedRevision)}
with tarfile.open(${JSON.stringify(archive)}) as t:
 members=t.getmembers();manifest=json.loads(t.extractfile('package/package.json').read());assert len(members)==len(manifest['files'])+1
 for m in members:
  assert m.isfile() and not m.issym() and m.name.startswith('package/') and '..' not in pathlib.Path(m.name).parts
  name=m.name.removeprefix('package/');data=t.extractfile(m).read();assert data==(root/name).read_bytes()
  committed=subprocess.check_output(['rtk','proxy','git','show',revision+':hub/plugins/qcu-course-workbench/'+name]);assert committed==data
 patch=json.loads(t.extractfile('package/cordis.patch.yml').read());assert len(patch)==1 and len(patch[0]['insert'])==1 and patch[0]['insert'][0]['disabled'] is True
 print('all archive members equal pinned source; standard npm prefix; one disabled row; deterministic bytes')`
 assert.match(execFileSync('rtk',['proxy','python3','-c',code],{encoding:'utf8'}),/all archive members/)
 assert.equal(createHash('sha256').update(await readFile('hub/plugins/qcu-course-workbench/skills/qcu-course-draft/SKILL.md')).digest('hex'),release.skillSha256)
})
test('workbench contract rejects forged Skill identity and Host downloads only the pinned bytes',async()=>{
 for(const change of [e=>e.release.skill=e.id,e=>e.id='qcu-fake-workbench',e=>e.release.provider='forged',e=>e.capabilities=['workbench','skill']]){const c=JSON.parse(catalogText);change(c.entries.find(i=>i.id===item.id));assert.throws(()=>parseMarketCatalog(JSON.stringify(c)))}
 const bytes=await readFile(process.env.QCU_COURSE_ARCHIVE),root=join(await mkdtemp(join(tmpdir(),'qcu-course-cache-')),'cache');let calls=0
 const path=await fetchPinned({entry:release,root,fetcher:async(url,options)=>{calls++;assert.equal(url,release.origin+'/plugins/'+release.file);assert.equal(options.redirect,'manual');return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}})
 assert.deepEqual(await readFile(path),bytes);assert.equal(calls,1)
})
test('workbench detail states model and file permissions correctly, and retains independent install/enable confirmations',async()=>{
 const f=createPreviewFixture(),flow=f.flows.find(v=>v.entry.id===item.id),{Detail}=createMarketViews(React)
 try{
  const render=()=>renderToStaticMarkup(React.createElement(Detail,{item,flow,onBack(){},onDetails(){}}))
  let html=render();assert.match(html,/Course Studio/);assert.match(html,/14种草案组件/);assert.doesNotMatch(html,/提供方只注册静态说明|复制学习示例/);assert.deepEqual(f.calls,[])
  await flow.prepare();assert.equal(flow.state.phase,'review');html=render();assert.match(html,/可能产生费用/);assert.match(html,/预览|审阅/);assert.equal(f.calls.filter(c=>c.name==='installBundle').length,0)
  await flow.confirmInstall();assert.equal(flow.state.status.state,'installed-disabled');assert.equal(f.calls.filter(c=>c.name==='setBundleEnabled').length,0)
  await flow.reviewActivate();await flow.confirmActivate();assert.equal(flow.state.status.state,'component-active');assert.match(render(),/请打开侧栏 Course Studio/)
 }finally{f.flows.forEach(v=>v.dispose())}
})
