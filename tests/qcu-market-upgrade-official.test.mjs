// Actual official manager, profile boot/Loader and pnpm; only synthetic packages in disposable profiles.
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
const dep=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!dep)throw Error('QCU_OFFICIAL_DEPENDENCIES required')
const require=createRequire(dep+'/package.json')
const load=n=>import(pathToFileURL(require.resolve(n)))
const {boot,initProfile,readProfilePatches,loadProfileDirectory}=await load('@deepseek-ai/dsh-app-boot')
const {default:PluginManager}=await load('@deepseek-ai/dsh-plugin-manager')
async function packageAt(root,version,{broken=false}={}){
 const path=join(root,'src-'+version),name='qcu-update-probe';await mkdir(path)
 await writeFile(join(path,'package.json'),JSON.stringify({name,version,type:'module',main:'index.mjs',dsh:{bundle:{patch:'./cordis.patch.yml'}}}))
 await writeFile(join(path,'cordis.patch.yml'),JSON.stringify([{insert:[{id:name,name:'./index.mjs',config:{teacherChoice:'keep'}}]}]))
 await writeFile(join(path,'index.mjs'),`export function apply(ctx,config){${broken?'throw Error("synthetic load failure")':`let manager;ctx.inject(['pluginManager'],scope=>{manager=scope.pluginManager});ctx.provide('upgradeProbe',{version:'${version}',config,upgrade:path=>manager.installBundle(path,{enabled:false,requestId:crypto.randomUUID()})})`}}`)
 const tar=join(root,name+'-'+version+'.tgz')
 const code='import sys,tarfile,pathlib; p=pathlib.Path(sys.argv[1]); t=tarfile.open(sys.argv[2],"w:gz"); [t.add(f,arcname="package/"+f.name) for f in sorted(p.iterdir())];t.close()'
 const result=spawnSync('python3',['-c',code,path,tar],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return tar
}
async function fixture(t,enabled,{rowDisabled=false}={}){
 const home=await mkdtemp(join(tmpdir(),'qcu-official-upgrade-'));t.after(()=>rm(home,{recursive:true,force:true}))
 const dir=join(home,'profile'),anchor=join(home,'package.json');await writeFile(anchor,'{"name":"isolated-installation","dependencies":{}}')
 initProfile(dir,[]);await writeFile(join(dir,'cordis.yml'),'[]\n')
 await writeFile(join(dir,'.npmrc'),`offline=true\nignore-scripts=true\nauto-install-peers=false\nregistry=http://127.0.0.1:9/\nstore-dir=${join(home,'store')}\n`)
 const a=await packageAt(home,'0.1.0-pilot.1'),b=await packageAt(home,'0.1.0-pilot.2')
 const initial=spawnSync('pnpm',['add',a,'--offline','--ignore-scripts'],{cwd:dir,encoding:'utf8',timeout:30000});assert.equal(initial.status,0,initial.stderr+initial.stdout)
 const manifest=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));manifest.dsh={profile:{bundles:enabled?['qcu-update-probe']:[]}};await writeFile(join(dir,'package.json'),JSON.stringify(manifest))
 if(rowDisabled)await writeFile(join(dir,'cordis.patch.yml'),JSON.stringify([{id:'qcu-update-probe',disabled:true,config:{teacherChoice:'custom'}}])+'\n')
 let ctx
 async function start(){
  const profile={name:'dsh',dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:anchor,cwd:home,home,overlays:[],startedBundles:loadProfileDirectory('dsh',dir,anchor).layers.map(l=>l.packageName),telemetryDisabledEnv:undefined}
  ctx=await boot('dsh',join(dir,'cordis.yml'),readProfilePatches('dsh',profile),c=>{c.provide('appReady',{onReady:fn=>{fn();return()=>{}}});c.provide('profileContext',profile)})
  const fork=ctx.plugin(PluginManager,{fallbackRegistries:[],registry:'http://127.0.0.1:9/'});await fork.await();assert.ok(ctx.pluginManager);return ctx
 }
 await start();t.after(()=>ctx.fiber.dispose())
 return {dir,b,get ctx(){return ctx},async restart(){await ctx.fiber.dispose();const r=spawnSync(process.execPath,['--experimental-transform-types','--expose-internals',new URL('./support/market-upgrade-cold.mjs',import.meta.url).pathname,dir,home],{env:process.env,encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.split('COLD_RESULT:')[1].trim())}}
}
for(const enabled of [false,true])test(`official TGZ upgrade preserves enabled=${enabled}, config and old runtime until restart`,{timeout:60000},async t=>{
 const f=await fixture(t,enabled),before=await f.ctx.pluginManager.listBundles()
 assert.equal(before.find(b=>b.name==='qcu-update-probe').version,'0.1.0-pilot.1')
 assert.equal(Boolean(f.ctx.get('upgradeProbe')),enabled)
 const oldRuntime=f.ctx.get('upgradeProbe')
 const result=await f.ctx.pluginManager.installBundle(f.b,{enabled:false,requestId:crypto.randomUUID()})
 assert.equal(result.application,'restart-required',JSON.stringify(result));assert.equal(result.bundle,'qcu-update-probe')
 const after=(await f.ctx.pluginManager.listBundles()).find(b=>b.name==='qcu-update-probe')
 assert.equal(after.version,'0.1.0-pilot.2');assert.equal(after.enabled,enabled);assert.equal(f.ctx.get('upgradeProbe'),oldRuntime)
 const cold=await f.restart();assert.equal(Boolean(cold),enabled)
 if(enabled){assert.equal(cold.version,'0.1.0-pilot.2');assert.equal(cold.config.teacherChoice,'keep')}
})
test('a running synthetic market can initiate its own replacement through the real official manager', {timeout:60000},async t=>{
 const f=await fixture(t,true),service=f.ctx.upgradeProbe
 const result=await service.upgrade(f.b)
 assert.equal(result.application,'restart-required',JSON.stringify(result));assert.equal(f.ctx.upgradeProbe,service);assert.equal(service.version,'0.1.0-pilot.1')
 const cold=await f.restart();assert.equal(cold.version,'0.1.0-pilot.2');assert.equal(cold.config.teacherChoice,'keep')
})
test('official upgrade preserves a disabled component and configured profile patch', {timeout:60000},async t=>{
 const f=await fixture(t,true,{rowDisabled:true}),before=await readFile(join(f.dir,'cordis.patch.yml'),'utf8')
 assert.equal(f.ctx.get('upgradeProbe'),undefined)
 const result=await f.ctx.pluginManager.installBundle(f.b,{enabled:false,requestId:crypto.randomUUID()});assert.equal(result.application,'restart-required',JSON.stringify(result))
 assert.equal((await f.ctx.pluginManager.listBundles()).find(b=>b.name==='qcu-update-probe').enabled,true)
 assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),before)
 assert.equal(await f.restart(),null)
})
test('official pnpm rejection of a corrupt upgrade retains original manifest and active runtime', {timeout:60000},async t=>{
 const f=await fixture(t,true),manifest=await readFile(join(f.dir,'package.json'),'utf8'),lock=await readFile(join(f.dir,'pnpm-lock.yaml'),'utf8')
 await writeFile(f.b,'corrupt synthetic archive')
 const result=await f.ctx.pluginManager.installBundle(f.b,{enabled:false,requestId:crypto.randomUUID()});assert.equal(result.application,'failed',JSON.stringify(result))
 assert.equal(await readFile(join(f.dir,'package.json'),'utf8'),manifest);assert.equal(await readFile(join(f.dir,'pnpm-lock.yaml'),'utf8'),lock);assert.equal(f.ctx.upgradeProbe.version,'0.1.0-pilot.1')
})
