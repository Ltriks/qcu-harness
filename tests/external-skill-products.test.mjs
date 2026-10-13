// Build/source trust and immutable package checks; no profile/install/network.
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {bundledCatalog,catalogText} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {parseMarketCatalog} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
const python=process.env.QCU_PYTHON||'python3.11'
const work=resolve('.work/external-skill-check')
const release=JSON.parse(await readFile('hub/market/external-skill-release.json','utf8'))
const source=JSON.parse(await readFile('skills/qcu-team-briefing/SOURCE.json','utf8'))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const run=args=>execFileSync('rtk',['proxy',python,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
const pack=dir=>JSON.parse(run(['scripts/pack-external-skill.py','--check-records','--out',dir]))
await rm(work,{recursive:true,force:true});await mkdir(work,{recursive:true})
test('external six pinned text files, Apache instructions, unchanged MIT wrapper; reproducible explicit archive',async()=>{
 assert.equal(source.revision,'dbd4588f9e1033efb41dad4bef2f7947c8993d44');assert.equal(source.upstreamFiles.length,6)
 for(const pin of source.upstreamFiles){const bytes=await readFile(pin.vendoredPath);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256)}
 assert.deepEqual(pack(work+'/first'),release);assert.deepEqual(pack(work+'/second'),release)
 const archive=await readFile(work+'/first/'+release.file);assert.equal(sha(archive),release.sha256);assert.equal(archive.length,release.bytes)
 assert.deepEqual(archive,await readFile(work+'/second/'+release.file))
 const manifest=JSON.parse(await readFile(work+'/first/MANIFEST.json','utf8'))
 const expected=['package.json','index.js','skill-content.js','cordis.patch.yml','README.md','SKILL.md','SOURCE.json','LICENSE','NOTICE','WRAPPER-LICENSE',...source.upstreamFiles.map(p=>p.vendoredPath)].sort()
 assert.deepEqual(Object.keys(manifest.members).sort(),expected)
 const files=JSON.parse(run(['-c',`import tarfile,json,hashlib\nwith tarfile.open(${JSON.stringify(work+'/first/'+release.file)}) as t:\n assert all(m.isfile() and not m.issym() and m.mode==0o644 and m.uid==0 and m.gid==0 and m.mtime==0 for m in t.getmembers())\n print(json.dumps({m.name.removeprefix('package/'): t.extractfile(m).read().decode('utf8') for m in t.getmembers()}))`]))
 assert.deepEqual(Object.keys(files).sort(),expected)
 for(const [name,content] of Object.entries(files))assert.equal(sha(Buffer.from(content)),manifest.members[name])
 const pkg=JSON.parse(files['package.json']);assert.equal(pkg.license,'Apache-2.0');assert.equal(pkg.version,'0.1.0-pilot.1');assert.deepEqual(pkg.files,expected.filter(n=>n!=='package.json'))
 for(const key of ['scripts','dependencies','optionalDependencies','bundledDependencies'])assert.equal(pkg[key],undefined)
 assert.deepEqual(pkg.peerDependencies,{'@deepseek-ai/cordis':'4.0.4','@deepseek-ai/dsh-skill':'0.2.0-rc.2','@deepseek-ai/dsh-scope':'0.2.0-rc.2'})
 assert.equal(files['LICENSE'],files['third_party/anthropic-internal-comms/LICENSE.txt']);assert.equal(files['WRAPPER-LICENSE'],await readFile('LICENSE','utf8'))
 assert.match(files['NOTICE'],/Copyright 2026 Anthropic, PBC\./);assert.match(files['NOTICE'],/Modified files: SKILL.md/)
 assert.equal(files['index.js'],await readFile('hub/skill-products/provider-template.mjs','utf8'))
 assert.deepEqual(JSON.parse(files['cordis.patch.yml']),[{insert:[{id:release.id,name:release.id,disabled:true,config:{enabled:true}}]}])
 const item=bundledCatalog.entries.find(e=>e.id===release.id);assert.equal(item.sourceLabel,'第三方改编');assert.deepEqual(item.provenance,source.provenance);assert.deepEqual(item.release,release)
 const content=files['SKILL.md'];assert.equal(sha(Buffer.from(content)),release.skillSha256)
 // Runtime content cannot require the retained upstream relative references.
 assert.doesNotMatch(content,/examples\/|\.\/|https?:\/\/|读取.{0,8}(文件|指南)/)
 assert.equal(bundledCatalog.revision,4);assert.equal(bundledCatalog.schemaVersion,4);assert.equal(bundledCatalog.protocol,4)
})
test('external archive refuses immutable collision and preserves existing bytes',async()=>{
 await mkdir(work+'/collision');await writeFile(work+'/collision/'+release.file,'existing fixture')
 assert.throws(()=>pack(work+'/collision'),/Immutable artifact collision/)
 assert.equal(await readFile(work+'/collision/'+release.file,'utf8'),'existing fixture')
})
for(const scenario of ['upstream-tamper','wrong-pin','unknown-license','wrong-source','symlink'])test(`isolated build refuses ${scenario}`,()=>{
 const code=`import pathlib,shutil,importlib.util,json\nr=pathlib.Path(${JSON.stringify(work+'/'+scenario)})\nspec=importlib.util.spec_from_file_location('external', 'scripts/pack-external-skill.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nfor name in ['skills/qcu-team-briefing','third_party/anthropic-internal-comms','hub/skill-products']:\n shutil.copytree(pathlib.Path(name),r/name)\nshutil.copyfile('LICENSE',r/'LICENSE')\np=r/'skills/qcu-team-briefing/SOURCE.json';s=json.loads(p.read_text())\nscenario=${JSON.stringify(scenario)}\nif scenario=='upstream-tamper': (r/'third_party/anthropic-internal-comms/examples/3p-updates.md').write_text('tampered')\nif scenario=='wrong-pin': s['revision']='0'*40;p.write_text(json.dumps(s))\nif scenario=='unknown-license': s['license']='GPL-3.0';p.write_text(json.dumps(s))\nif scenario=='wrong-source': s['provenance']['ownership']='qcu';p.write_text(json.dumps(s))\nif scenario=='symlink':\n v=r/'third_party/anthropic-internal-comms/examples';shutil.rmtree(v);v.symlink_to(pathlib.Path('third_party/anthropic-internal-comms/examples').resolve(),target_is_directory=True)\ntry: m.build(r/'out',root=r)\nexcept AssertionError: pass\nelse: raise RuntimeError('unexpected acceptance')\nassert not (r/'out').exists()`
 run(['-c',code])
})
for(const [key,value] of [['license','BSD-3-Clause'],['sourceLabel','QCU自有'],['origin','https://evil.invalid']])test(`catalog rejects external ${key}`,()=>{
 const catalog=JSON.parse(catalogText),item=catalog.entries.find(e=>e.id===release.id)
 if(key==='license'){item.release.license=value;item.provenance.license=value}else if(key==='origin')item.release.origin=value;else item[key]=value
 assert.throws(()=>parseMarketCatalog(JSON.stringify(catalog)))
})

test('new external preview flow binds its own reviewed bytes, stays disabled until one activation review and leaves unvisited peers untouched',async()=>{
 const {flows,calls,remote}=createPreviewFixture(),flow=flows.find(f=>f.entry.id===release.id)
 try{
  assert.deepEqual(calls,[]);assert.deepEqual(flow.entry,release)
  await flow.prepare();assert.deepEqual(flow.state.review.receipt.entry,release);assert.equal(flow.state.phase,'review')
  await assert.rejects(flows[1].prepare(),/其他条目/)
  await flow.confirmInstall();assert.equal(flow.state.status.state,'installed-disabled')
  assert.deepEqual(calls.filter(c=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(c.name)).map(c=>c.name),['installBundle'])
  await flow.reviewActivate();assert.equal(flow.state.review.kind,'activate');await flow.confirmActivate();assert.equal(flow.state.status.state,'component-active')
  const mutations=calls.filter(c=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(c.name));assert.deepEqual(mutations.map(c=>c.name),['installBundle','setBundleEnabled','setPluginEnabled']);assert.equal(mutations[1].args[0],release.id);assert.equal(mutations[2].args[0],'preview:'+release.id)
  for(const peer of flows.filter(f=>f!==flow)){assert.equal(peer.state.phase,'idle');assert.equal(peer.state.status,null)}
  assert.equal((await remote.pluginManager.listBundles()).value.length,1)
 }finally{flows.forEach(f=>f.dispose())}
})
