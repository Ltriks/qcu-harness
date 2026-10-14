// Real official Cordis + Skills, extracted fixed bundles. No profile or installer.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdir,writeFile,rm,symlink} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {bundledCatalog,catalogSha256} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'

const deps=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!deps)throw Error('QCU_OFFICIAL_DEPENDENCIES required; use existing audited tree only')
const require=createRequire(resolve(deps,'package.json'))
const {Context}=require('@deepseek-ai/cordis')
const {SkillRegistry,BUNDLED_SKILL_RANK,isModelInvocable,isUserInvocable}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-skill')))
const {createScope}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-scope')))
const teachingProducts=JSON.parse(await readFile(new URL('../hub/market/skill-releases.json',import.meta.url),'utf8'))
const external=JSON.parse(await readFile(new URL('../hub/market/external-skill-release.json',import.meta.url),'utf8'))
const products=[...teachingProducts,external]
const work=resolve('.work/teaching-skill-check')
const sha=data=>createHash('sha256').update(data).digest('hex')
const python=process.env.QCU_PYTHON||'python3.11'
await mkdir(work,{recursive:true})
await rm(work,{recursive:true});await mkdir(work,{recursive:true})
await symlink(resolve(deps,'node_modules'),resolve(work,'node_modules'),'dir')
const pack=out=>JSON.parse(execFileSync('rtk',['proxy',python,'scripts/pack-teaching-skills.py','--check-records','--out',out],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
const built=pack(resolve(work,'build'))
assert.deepEqual(built,teachingProducts)
const externalBuilt=JSON.parse(execFileSync('rtk',['proxy',python,'scripts/pack-external-skill.py','--check-records','--out',resolve(work,'external-build')],{encoding:'utf8'}));assert.deepEqual(externalBuilt,external)
execFileSync('rtk',['proxy',python,'-c',
 `import pathlib,tarfile\nw=pathlib.Path(${JSON.stringify(work)})\nfor p in [*(w/'build').glob('*.tgz'), *(w/'external-build').glob('*.tgz')]:\n with tarfile.open(p) as t:\n  assert all(m.isfile() and m.name.startswith('package/') and '..' not in pathlib.Path(m.name).parts for m in t.getmembers())\n  t.extractall(w/p.name.split('-0.1.0-')[0],filter='data')`])

test('five bundles reproduce exactly, explicit resources only, unchanged coach trust root',async()=>{
 assert.deepEqual(pack(resolve(work,'rebuild')),teachingProducts)
 for(const entry of teachingProducts){
  const bytes=await readFile(resolve(work,'build',entry.file));assert.equal(sha(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes)
  const dir=resolve(work,entry.id,'package'),pkg=JSON.parse(await readFile(dir+'/package.json','utf8'))
  assert.equal(pkg.name,entry.id);assert.equal(pkg.version,'0.1.0-pilot.1.1')
  assert.deepEqual(pkg.peerDependencies,{'@deepseek-ai/cordis':'4.0.4','@deepseek-ai/dsh-skill':'0.2.0-rc.2','@deepseek-ai/dsh-scope':'0.2.0-rc.2'})
  assert.deepEqual(pkg.dsh,{bundle:{patch:'./cordis.patch.yml'}})
  for(const key of ['dependencies','optionalDependencies','bundledDependencies','scripts'])assert.equal(pkg[key],undefined)
  assert.deepEqual(pkg.files,['LICENSE','README.md','SKILL.md','SOURCE.json','cordis.patch.yml','index.js','skill-content.js'])
  assert.deepEqual(JSON.parse(await readFile(dir+'/cordis.patch.yml','utf8')),[{insert:[{id:entry.id,name:entry.id,disabled:true,config:{enabled:true}}]}])
  const canonical=await readFile('skills/'+entry.id+'/SKILL.md');assert.deepEqual(await readFile(dir+'/SKILL.md'),canonical);assert.equal(sha(canonical),entry.skillSha256)
  assert.deepEqual(await readFile(dir+'/LICENSE'),await readFile('LICENSE'))
  const source=JSON.parse(await readFile(dir+'/SOURCE.json','utf8'))
  const upstream=execFileSync('rtk',['proxy','git','show',source.baseline+':'+source.source]);assert.equal(sha(upstream),source.sourceSha256)
  assert.deepEqual(bundledCatalog.entries.find(e=>e.id===entry.id).provenance,source.provenance)
  const code=await readFile(dir+'/index.js','utf8');assert.doesNotMatch(code,/fetch|readFile|session|tools|child_process|eval\(|import\(/)
 }
 const coach=JSON.parse(await readFile('hub/market/coach-release.json','utf8'))
 assert.deepEqual(bundledCatalog.entries[0].release,coach)
 assert.deepEqual(await readFile('hub/plugins/qcu-market/src/trusted-release.mjs'),execFileSync('rtk',['proxy','git','show','HEAD:hub/plugins/qcu-market/src/trusted-release.mjs']))
})

test('different bytes at immutable archive path are refused without overwriting',async()=>{
 const out=resolve(work,'collision');await mkdir(out,{recursive:true})
 const target=out+'/'+products[0].file;await writeFile(target,'collision fixture')
 assert.throws(()=>pack(out),/Immutable artifact collision/)
 assert.equal(await readFile(target,'utf8'),'collision fixture')
 await rm(out,{recursive:true})
})

test('market build is current, archive reproducible, members match source and collision refuses',async()=>{
 const before=await readFile('hub/plugins/qcu-market/client.js')
 execFileSync('rtk',['proxy',process.execPath,'hub/plugins/qcu-market/build.mjs'],{stdio:'pipe'})
 assert.deepEqual(await readFile('hub/plugins/qcu-market/client.js'),before,'generated source must be current')
 const out=resolve(work,'market'),packMarket=()=>JSON.parse(execFileSync('rtk',['proxy',python,'hub/plugins/qcu-market/pack-pilot.py',out],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
 const report=packMarket();assert.deepEqual(packMarket(),report)
 const path=out+'/'+report.file;assert.equal(sha(await readFile(path)),report.sha256);assert.equal(report.bytes,(await readFile(path)).length)
 assert.equal(report.file,`qcu-market-0.1.0-pilot.9.1-${report.sha256}.tgz`)
 const members=JSON.parse(execFileSync('rtk',['proxy',python,'-c',`import json,hashlib,tarfile\nwith tarfile.open(${JSON.stringify(path)}) as t:\n assert all(m.isfile() and m.mode==0o644 and m.uid==0 and m.gid==0 and m.mtime==0 for m in t.getmembers())\n print(json.dumps({m.name:hashlib.sha256(t.extractfile(m).read()).hexdigest() for m in t.getmembers()}))`],{encoding:'utf8'}))
 for(const file of report.files)assert.equal(members[file.path],sha(await readFile('hub/plugins/qcu-market/'+file.path.slice(8))))
 assert.equal(Object.keys(members).length,14);assert.equal(members['package/preview-fixture.mjs'],undefined)
 await writeFile(path,'different fixture');assert.throws(()=>packMarket(),/Refusing to replace different bytes/);assert.equal(await readFile(path,'utf8'),'different fixture')
})

for(const entry of products)test(`${entry.id}: explicit activation, exact content, duplicate/tamper refusal and owned disposal`,async()=>{
 const dir=resolve(work,entry.id,'package'),module=await import(pathToFileURL(dir+'/index.js'))
 const ctx=new Context();new SkillRegistry(ctx)
 try{
  assert.deepEqual(module.inject,['skills'])
  await assert.rejects(module.apply(ctx,{enabled:false}),/Explicit activation/)
  await assert.rejects(module.apply(ctx,{}),/Explicit activation/)
  assert.deepEqual(await ctx.skills.list(),[])
  const unrelated=ctx.plugin({apply(c){c.skills.register({name:'synthetic-unrelated',description:'fixture',source:'test',content:'preserve'})}});await unrelated.await()
  const fiber=ctx.plugin(module,{enabled:true});await fiber.await()
  const skill=await ctx.skills.get(entry.id);assert.equal(skill.content,await readFile(dir+'/SKILL.md','utf8'));assert.equal(skill.provider,entry.provider)
  assert.deepEqual(skill.invocation,{modelInvocable:true,userInvocable:true})
  assert.equal(isModelInvocable(skill),true);assert.equal(isUserInvocable(skill),true)
  const summary=(await ctx.skills.list()).find(s=>s.name===entry.id)
  assert.deepEqual(summary,{name:entry.id,description:skill.description,source:entry.provider,provider:entry.provider,invocation:skill.invocation})
  assert.equal(summary.content,undefined,'discovery exposes metadata only')
  await assert.rejects(module.apply(ctx,{enabled:true}),/Existing/)
  await fiber.dispose();assert.equal(await ctx.skills.get(entry.id),undefined);assert.equal((await ctx.skills.get('synthetic-unrelated')).content,'preserve')
  // Import a separately compiled tampered fixture; do not alter canonical bundles.
  const bad=resolve(work,'tampered-'+entry.id);await mkdir(bad,{recursive:true})
  await writeFile(bad+'/package.json','{"type":"module"}')
  await writeFile(bad+'/index.js',await readFile(dir+'/index.js'))
  await writeFile(bad+'/skill-content.js',(await readFile(dir+'/skill-content.js','utf8')).replace('export const content = ','export const content = "tampered" + '))
  const changed=await import(pathToFileURL(bad+'/index.js'));await assert.rejects(changed.apply(ctx,{enabled:true}),/integrity/)
  assert.equal(await ctx.skills.get(entry.id),undefined);assert.deepEqual((await ctx.skills.list()).map(s=>s.name),['synthetic-unrelated'])
 }finally{await ctx.fiber.dispose()}
})

// Distinct wrappers exercise separate Cordis fibers, rather than Cordis' reuse
// of the same plugin callback. No mock registry and no profile/manager effects.
const mount=(ctx,module)=>ctx.plugin({inject:module.inject,apply(c,config){return module.apply(c,config)}},{enabled:true})
for(const entry of products){
 const module=await import(pathToFileURL(resolve(work,entry.id,'package/index.js')))
 test(`${entry.id}: concurrent distinct fibers cannot both register successfully`,async()=>{
  const ctx=new Context();new SkillRegistry(ctx)
  try{
   const unrelated=ctx.plugin({apply(c){c.skills.register({name:'synthetic-unrelated',description:'fixture',source:'test',content:'preserve'})}});await unrelated.await()
   const fibers=[mount(ctx,module),mount(ctx,module)]
   const results=await Promise.allSettled(fibers.map(f=>f.await()))
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
   const loser=results.findIndex(r=>r.status==='rejected'),winner=1-loser
   assert.match(results[loser].reason.message,/skill provider.*already registered/)
   assert.equal((await ctx.skills.get(entry.id)).provider,entry.provider)
   assert.equal((await ctx.skills.list()).filter(s=>s.name===entry.id).length,1)
   await fibers[loser].dispose()
   assert.equal((await ctx.skills.get(entry.id)).provider,entry.provider,'loser disposal retains winner')
   await fibers[winner].dispose()
   assert.equal(await ctx.skills.get(entry.id),undefined)
   assert.equal((await ctx.skills.get('synthetic-unrelated')).content,'preserve')
   // Cache invalidation and provider-name release permit a fresh owned mount.
   const replacement=mount(ctx,module);await replacement.await();await replacement.dispose()
   assert.equal(await ctx.skills.get(entry.id),undefined)
  }finally{await ctx.fiber.dispose()}
 })

 for(const collision of ['runtime','provider-higher-rank','provider-lower-rank','provider-unloadable','provider-name'])test(`${entry.id}: existing ${collision} refuses without disturbing owner`,async()=>{
  const ctx=new Context();new SkillRegistry(ctx)
  const sameProvider=collision==='provider-name'
  const name=sameProvider?'synthetic-unrelated':entry.id
  const provider=sameProvider?entry.provider:'synthetic-existing-provider'
  const definition={name,description:'existing fixture',source:'test',provider,content:'existing body',invocation:{modelInvocable:false,userInvocable:true}}
  const candidate={...definition,rank:collision==='provider-higher-rank'?1:BUNDLED_SKILL_RANK+100,locator:name}
  const owner=ctx.plugin({apply(c){
   if(collision==='runtime')c.skills.register(definition)
   else c.skills.registerProvider(()=>({name:provider,list:async()=>[candidate],get:async candidate=>collision==='provider-unloadable'?undefined:candidate.locator===name?definition:undefined}))
  }})
  try{
   await owner.await();const before=await ctx.skills.list()
   const attempt=mount(ctx,module)
   await assert.rejects(attempt.await(),sameProvider?/skill provider.*already registered/:/Existing/)
   await attempt.dispose();assert.deepEqual(await ctx.skills.list(),before)
   assert.deepEqual(await ctx.skills.get(name),collision==='provider-unloadable'?undefined:definition)
   await owner.dispose();assert.deepEqual(await ctx.skills.list(),[])
  }finally{await ctx.fiber.dispose()}
 })
}

for(const entry of [teachingProducts[0],external])test(`${entry.id}: official caller scopes isolate identical providers and disposal; visible ancestor collision refuses`,async()=>{
 const module=await import(pathToFileURL(resolve(work,entry.id,'package/index.js')))
 const ctx=new Context();new SkillRegistry(ctx)
 const leftKey={},rightKey={},childKey={}
 const left=createScope(ctx,leftKey),right=createScope(ctx,rightKey),child=createScope(ctx,childKey,{parent:leftKey})
 try{
  const unrelated=ctx.plugin({apply(c){c.skills.register({name:'synthetic-unrelated',description:'fixture',source:'test',content:'preserve'})}});await unrelated.await()
  const fibers=[mount(left.ctx,module),mount(right.ctx,module)]
  await Promise.all(fibers.map(f=>f.await()))
  assert.equal(await ctx.skills.get(entry.id),undefined,'scoped providers are absent globally')
  for(const scope of [leftKey,rightKey])assert.equal((await ctx.skills.get(entry.id,{scope})).provider,entry.provider)
  const duplicate=mount(left.ctx,module);await assert.rejects(duplicate.await(),/Existing/);await duplicate.dispose()
  const descendant=mount(child.ctx,module);await assert.rejects(descendant.await(),/Existing/);await descendant.dispose()
  await left.dispose();assert.equal(await ctx.skills.get(entry.id,{scope:leftKey}),undefined)
  assert.equal((await ctx.skills.get(entry.id,{scope:rightKey})).provider,entry.provider)
  assert.equal((await ctx.skills.get('synthetic-unrelated')).content,'preserve')
  await right.dispose();assert.equal(await ctx.skills.get(entry.id,{scope:rightKey}),undefined)
 }finally{await child.dispose();await left.dispose();await right.dispose();await ctx.fiber.dispose()}
})

test('eight real preview entries have isolated installation/activation, reviewed catalog lock and unknown outcome block',async()=>{
 const {flows,calls,remote}=createPreviewFixture();const [coach,first,second]=flows
 try{
  assert.deepEqual(calls,[]);await first.prepare();assert.equal(first.state.phase,'review')
  await assert.rejects(second.prepare(),/其他条目/);assert.equal(second.state.phase,'idle')
  await first.decline();await second.prepare();await second.confirmInstall()
  assert.equal(second.state.status.state,'installed-disabled');assert.equal(first.state.status.state,'not-installed');assert.equal(coach.state.phase,'idle')
  await first.prepare();await first.confirmInstall()
  await second.reviewActivate();await assert.rejects(first.reviewActivate(),/其他条目/);await second.confirmActivate();assert.equal(second.state.status.state,'component-active')
  const bundles=(await remote.pluginManager.listBundles()).value;assert.equal(bundles.find(b=>b.name===first.entry.id).enabled,false)
  const rows=(await remote.pluginManager.listPlugins()).value;assert.equal(rows.find(r=>r.moduleName===first.entry.id).enabled,false)
  coach.request={id:'synthetic-unknown'};coach.set({phase:'unconfirmed'});await assert.rejects(first.reviewEnable('bundle'),/其他条目/)
  assert.equal(second.fingerprint,catalogSha256)
 }finally{flows.forEach(f=>f.dispose())}
})
