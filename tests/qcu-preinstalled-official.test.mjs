// Actual rc2 PluginManager/pnpm and cold Loader; only frozen public packages and disposable data.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {resolve,join,dirname} from 'node:path'
import {readFile,writeFile,mkdir,cp,readdir,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {spawnSync} from 'node:child_process'

const sdk=process.env.QCU_OFFICIAL_DEPENDENCIES
assert.ok(sdk,'QCU_OFFICIAL_DEPENDENCIES required')
// Capture test-only overrides before removing inherited environment variables.
const pnpmOverride=process.env.QCU_PREINSTALLED_PNPM_COMMAND,pnpmCommand=pnpmOverride??'/opt/homebrew/bin/pnpm'
const pnpmArgs=JSON.parse(process.env.QCU_PREINSTALLED_PNPM_ARGS??'[]')
assert.ok(Array.isArray(pnpmArgs)&&pnpmArgs.every(arg=>typeof arg==='string'),'QCU_PREINSTALLED_PNPM_ARGS must be a JSON string array')
const electronNode=pnpmOverride!==undefined&&process.env.QCU_PREINSTALLED_ELECTRON_NODE==='1'
const require=createRequire(join(sdk,'package.json')),load=n=>import(pathToFileURL(require.resolve(n)))
const out=resolve(process.env.QCU_PREINSTALLED_OUT??'.work/preinstalled-proof/official'),prepared=resolve(process.env.QCU_PREINSTALLED_PREPARED??'.work/preinstalled-proof/prepared-profile')
const archiveRoot=resolve('.work/expert-hardening/candidate-reviewed'),candidate=JSON.parse(await readFile(join(archiveRoot,'MANIFEST.json'),'utf8'))
const newArchive=join(archiveRoot,candidate.file)
const baseline=process.env.QCU_EXPERT_BASELINE
assert.ok(baseline,'QCU_EXPERT_BASELINE required')
const hash=b=>createHash('sha256').update(b).digest('hex')
assert.equal(hash(await readFile(baseline)),'565f713880771709d0f4388b0690330bf8f3c439ef322d5a11b67b3a5ec96d09')
assert.equal(hash(await readFile(newArchive)),candidate.sha256)
// Keep the audited source installation anchor. require.resolve() canonicalizes an SDK alias
// to a historical build whose own node_modules closure is incomplete.
const anchor=join(sdk,'upstream/source/apps/desktop-host/package.json')
const {boot,loadProfileDirectory,resolveBundleDir}=await load('@deepseek-ai/dsh-app-boot')
const {default:PluginManager}=await load('@deepseek-ai/dsh-plugin-manager')
await mkdir(out)
const evidence={schemaVersion:1,officialSdk:sdk,installAnchor:{path:anchor,sha256:hash(await readFile(anchor))},baseline:{path:baseline,sha256:hash(await readFile(baseline))},candidate:{path:newArchive,sha256:candidate.sha256},phases:[],requests:[],realModelCalls:0,activation:'separate cold synthetic Loader check only',serverStopped:false}
evidence.configChecks=[]
evidence.runtime={node:{executable:process.execPath,arguments:process.execArgv,version:process.version},pnpm:{command:pnpmCommand,args:pnpmArgs},electronRunAsNode:electronNode}
// Keep the original HOME value; explicitly remove unrelated inherited configuration/proxy/secrets.
const kept=new Set(['PATH','HOME','TMPDIR','LANG','LC_ALL','QCU_OFFICIAL_DEPENDENCIES'])
for(const key of Object.keys(process.env))if(!kept.has(key))delete process.env[key]
if(electronNode)process.env.ELECTRON_RUN_AS_NODE='1'
const server=createServer((req,res)=>{evidence.requests.push({method:req.method,path:req.url});res.writeHead(404,{'content-type':'application/json'}).end('{"error":"synthetic missing private QCU package"}')})
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)})
const registry='http://127.0.0.1:'+server.address().port+'/'
evidence.network={registry,fallbackRegistries:[],sources:'local TGZs only; original bare dependencies may ask this loopback 404 server',requested:{peerAutoInstall:false,scripts:false,fetchRetries:0,fetchTimeoutMs:2000,emptyUserAndGlobalConfig:true,isolatedStoreCacheState:true},effectiveConfig:'see configChecks; requests alone do not prove configuration',homeReassigned:false,externalPacketCapture:false}

async function inventory(root,prefix=''){
 const entries=[]
 for(const entry of await readdir(root,{withFileTypes:true})){
  const name=prefix+entry.name,path=join(root,entry.name)
  if(entry.isDirectory())entries.push(...await inventory(path,name+'/'))
  else entries.push({path:name,sha256:hash(await readFile(path))})
 }
 return entries.sort((a,b)=>a.path.localeCompare(b.path))
}
async function fixture(name,{old=false}={}){
 const root=join(out,name),dir=join(root,'profiles','desktop');await mkdir(root,{recursive:true});await cp(prepared,dir,{recursive:true,errorOnExist:true,force:false})
 if(old)await cp(resolve('.work/preinstalled-proof-inputs/profile-template/package.json'),join(dir,'package.json'))
 const userConfig=join(root,'empty-user.npmrc'),globalConfig=join(root,'empty-global.npmrc'),configDir=join(root,'config','pnpm'),globalYaml=join(configDir,'config.yaml')
 await writeFile(userConfig,'');await writeFile(globalConfig,'')
 await mkdir(configDir,{recursive:true});await writeFile(globalYaml,'{}\n');await writeFile(join(configDir,'auth.ini'),'');await writeFile(join(configDir,'rc'),'')
 const env={XDG_CACHE_HOME:join(root,'cache'),XDG_CONFIG_HOME:join(root,'config'),XDG_DATA_HOME:join(root,'data'),XDG_STATE_HOME:join(root,'state')}
 const settings={userconfig:userConfig,globalconfig:globalConfig,registry,store_dir:join(root,'store'),cache_dir:join(root,'cache'),state_dir:join(root,'state'),fetch_retries:'0',fetch_timeout:'2000',update_notifier:'false',manage_package_manager_versions:'false',pm_on_fail:'ignore',proxy:'',https_proxy:''}
 // pnpm 11 parses proxy values as URL/null; an empty URL throws even for --version.
 for(const [key,value] of Object.entries(settings)){
  env['npm_config_'+key]=value
  env['pnpm_config_'+key]=key==='proxy'||key==='https_proxy'?'null':value
 }
 // pnpm 11 selects its auth file separately and global YAML via XDG_CONFIG_HOME.
 env.pnpm_config_npmrc_auth_file=userConfig
 // Neither env nor .npmrc supplies policy: prove the generated workspace is effective.
 const policy=await readFile(join(dir,'pnpm-workspace.yaml'))
 assert.deepEqual(JSON.parse(policy),{autoInstallPeers:false,ignoreScripts:true})
 await writeFile(join(dir,'.npmrc'),`registry=${registry}\n`)
 if(electronNode)env.ELECTRON_RUN_AS_NODE='1'
 const configCheck={profile:dir,requested:{settings,pnpmProxy:{proxy:'null',https_proxy:'null'},policy:{path:join(dir,'pnpm-workspace.yaml'),sha256:hash(policy),autoInstallPeers:false,ignoreScripts:true},emptyConfigFiles:[userConfig,globalConfig,globalYaml,join(configDir,'auth.ini'),join(configDir,'rc')],homeReassigned:false},effective:{},probes:[]}
 evidence.configChecks.push(configCheck)
 if(evidence.runtime.pnpm.version===undefined){
  const args=[...pnpmArgs,'--version'],version=spawnSync(pnpmCommand,args,{cwd:dir,env:{...process.env,...env},encoding:'utf8',timeout:10000})
  evidence.runtime.pnpm.versionProbe={arguments:args,status:version.status,stdout:version.stdout,stderr:version.stderr}
  assert.equal(version.status,0,version.stdout+version.stderr);evidence.runtime.pnpm.version=version.stdout.trim()
 }
 const expected={userconfig:userConfig,globalconfig:Number(evidence.runtime.pnpm.version.split('.')[0])>=11?globalYaml:join(configDir,'rc'),'auto-install-peers':'false','ignore-scripts':'true','store-dir':settings.store_dir,'cache-dir':settings.cache_dir,'state-dir':settings.state_dir,registry,'fetch-retries':'0','fetch-timeout':'2000'}
 for(const [key,value] of Object.entries(expected)){
  const args=[...pnpmArgs,'config','get',key],probe=spawnSync(pnpmCommand,args,{cwd:dir,env:{...process.env,...env},encoding:'utf8',timeout:10000})
  configCheck.probes.push({key,arguments:args,status:probe.status,stdout:probe.stdout,stderr:probe.stderr})
  assert.equal(probe.status,0,probe.stdout+probe.stderr)
  configCheck.effective[key]=probe.stdout.trim()
  assert.equal(configCheck.effective[key],value,`effective ${key} must match isolated ${name} configuration`)
 }
 const profile={name:'dsh',dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:anchor,cwd:root,home:root,overlays:[],startedBundles:[],packageManager:{command:pnpmCommand,args:pnpmArgs,env},telemetryDisabledEnv:undefined}
 // Dependency operations require the official Loader and profileContext, without booting teacher services.
 const ctx=await boot('dsh',join(dir,'cordis.yml'),[],c=>{c.provide('appReady',{onReady:fn=>{fn();return()=>{}}});c.provide('profileContext',profile)})
 const fork=ctx.plugin(PluginManager,{registry,fallbackRegistries:[],inspectTimeoutMs:5000,idleTimeoutMs:15000});await fork.await()
 return {root,dir,ctx,profile,close:()=>ctx.fiber.dispose()}
}
async function install(f,path,phase){
 const from=evidence.requests.length,result=await f.ctx.pluginManager.installBundle(path,{enabled:false,requestId:crypto.randomUUID()})
 evidence.phases.push({phase,profile:f.dir,result,registryRequests:evidence.requests.slice(from)})
 return result
}
async function manifest(f){return JSON.parse(await readFile(join(f.dir,'package.json'),'utf8'))}
async function cold(f,enabled){
 const args=['--experimental-transform-types','--expose-internals','--experimental-loader',resolve('tests/support/feishu-official-loader.mjs'),resolve('tests/support/preinstalled-cold.mjs'),f.dir,f.root,anchor,String(enabled)]
 const result=spawnSync(process.execPath,args,{env:process.env,encoding:'utf8',timeout:30000})
 await writeFile(join(f.root,'cold-loader.log'),result.stdout+result.stderr)
 assert.equal(result.status,0,result.stdout+result.stderr)
 const data=JSON.parse(result.stdout.split('COLD_RESULT:')[1].trim());evidence.phases.push({phase:'cold-loader-'+enabled,executable:process.execPath,arguments:args,...data});return data
}
test('bare semver reproduces 404; relocated source-prepared profile installs/upgrades exact expert bytes and rolls back rejection',{timeout:180000},async t=>{
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));evidence.serverStopped=true;await writeFile(join(out,'EVIDENCE.json'),JSON.stringify(evidence,null,2)+'\n')})
 const old=await fixture('old-bare-layout',{old:true})
 try{
  const before=await readFile(join(old.dir,'package.json')),patch=await readFile(join(old.dir,'cordis.patch.yml'))
  const result=await install(old,baseline,'old-layout-baseline-expected-404')
  assert.equal(result.application,'failed',JSON.stringify(result));assert.match(result.packageResult.output,/ERR_PNPM_FETCH_404|404/)
  assert.ok(evidence.requests.some(r=>r.path.startsWith('/qcu-')))
  assert.deepEqual(await readFile(join(old.dir,'package.json')),before);assert.deepEqual(await readFile(join(old.dir,'cordis.patch.yml')),patch)
 }finally{await old.close()}
 // No store or cache is shared with the expected-failure run or between enable variants.
 for(const enabled of [false,true]){
  const f=await fixture('relocated-enabled-'+enabled)
  try{
   const initial=await manifest(f),patch=await readFile(join(f.dir,'cordis.patch.yml')),seedModules={}
   for(const name of Object.keys(initial.dependencies))seedModules[name]=await inventory(join(f.dir,'node_modules',name))
   const sources=await inventory(join(f.dir,'.qcu-bundles')),from=evidence.requests.length
   const result=await install(f,baseline,'source-prepared-baseline-'+enabled)
   assert.notEqual(result.application,'failed',JSON.stringify(result))
   let base=await manifest(f)
   assert.deepEqual(base.dsh,initial.dsh);assert.deepEqual(await readFile(join(f.dir,'cordis.patch.yml')),patch)
   assert.equal(JSON.parse(await readFile(join(f.dir,'node_modules/qcu-expert-teams/package.json'))).version,'0.2.0-pilot.1')
   // Synthetic existing profile choices before upgrade: selection and component config are independent.
   if(enabled)base.dsh.profile.bundles.push('qcu-expert-teams')
   base.syntheticTeacherSetting={preserve:'synthetic existing preference'}
   await writeFile(join(f.dir,'package.json'),JSON.stringify(base,null,2)+'\n')
   const chosenPatch=JSON.parse(patch);chosenPatch.push({id:'qcu-expert-teams',disabled:!enabled,config:{enabled:true}})
   const chosenBytes=JSON.stringify(chosenPatch,null,2)+'\n';await writeFile(join(f.dir,'cordis.patch.yml'),chosenBytes)
   const upgraded=await install(f,newArchive,'source-prepared-upgrade-'+enabled)
   assert.equal(upgraded.application,'restart-required',JSON.stringify(upgraded))
   const after=await manifest(f)
   assert.deepEqual(after.dsh,base.dsh);assert.deepEqual(after.syntheticTeacherSetting,base.syntheticTeacherSetting)
   assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),chosenBytes)
   for(const [name,spec] of Object.entries(initial.dependencies)){
    assert.equal(after.dependencies[name],spec);assert.deepEqual(await inventory(join(f.dir,'node_modules',name)),seedModules[name])
   }
   assert.deepEqual(await inventory(join(f.dir,'.qcu-bundles')),sources)
   const installed=join(f.dir,'node_modules/qcu-expert-teams')
   for(const member of candidate.files)assert.equal(hash(await readFile(join(installed,member.path.slice('package/'.length)))),member.sha256,member.path)
   assert.equal(evidence.requests.length,from,'corrected install/upgrade must make zero registry requests')
   const bundle=(await f.ctx.pluginManager.listBundles()).find(b=>b.name==='qcu-expert-teams')
   assert.equal(bundle.version,candidate.version);assert.equal(bundle.enabled,enabled)
   assert.equal(resolveBundleDir('dsh','qcu-expert-teams',anchor,f.dir),installed)
   // Dispose before the separate fresh-process Loader/import check, which uses only synthetic providers.
   await f.close();const loaded=await cold(f,enabled);assert.equal(loaded.active,enabled)
   const retained=await readFile(join(f.dir,'package.json')),lock=await readFile(join(f.dir,'pnpm-lock.yaml')),moduleBytes=await inventory(installed)
   const corrupt=join(f.root,'corrupt-upgrade.tgz');await writeFile(corrupt,'synthetic corrupt TGZ')
   // New manager context for the failed upgrade; no runtime is reactivated.
   const retryCtx=await boot('dsh',join(f.dir,'cordis.yml'),[],c=>{c.provide('appReady',{onReady:fn=>{fn();return()=>{}}});c.provide('profileContext',f.profile)})
   try{
    await retryCtx.plugin(PluginManager,{registry,fallbackRegistries:[],idleTimeoutMs:15000}).await()
    const rejected=await install({...f,ctx:retryCtx},corrupt,'failed-upgrade-retains-'+enabled)
    assert.equal(rejected.application,'failed',JSON.stringify(rejected));assert.deepEqual(await readFile(join(f.dir,'package.json')),retained);assert.deepEqual(await readFile(join(f.dir,'pnpm-lock.yaml')),lock)
    assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),chosenBytes);assert.deepEqual(await inventory(installed),moduleBytes)
    assert.equal(evidence.requests.length,from)
   }finally{await retryCtx.fiber.dispose()}
   evidence.phases.push({phase:'preservation-'+enabled,originalTenModuleTreesUnchanged:true,localArchivesUnchanged:true,originalTenRelativeSourcesUnchanged:true,bundleSelectionPreserved:true,componentPatchPreserved:true,unrelatedSettingPreserved:true,installedCandidateMembers:candidate.files,failedUpgradeManifestLockPatchAndModulesPreserved:true,registryRequests:0})
  }finally{await f.close()}
 }
 evidence.passed=true
})
