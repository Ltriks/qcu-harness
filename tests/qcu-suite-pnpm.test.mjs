// Actual official pnpm11 + PluginManager, on a COPY of the ZIP-prepared rc4 profile only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {join,resolve,dirname} from 'node:path'
import {readFile,writeFile,mkdir,cp,readdir,realpath} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {spawnSync} from 'node:child_process'
import {syntheticUpdateArchive} from './support/market-update-fixture.mjs'
const sdk=process.env.QCU_OFFICIAL_DEPENDENCIES,kit=resolve(process.env.QCU_INTEGRATED_TEST_KIT),prepared=resolve(process.env.QCU_INTEGRATED_PREPARED_PROFILE),out=resolve(process.env.QCU_INTEGRATED_PNPM_OUT)
assert.equal(process.env.QCU_INTEGRATED_PNPM_COMMAND,undefined,'use only the frozen shipped pnpm script')
assert.equal(process.env.QCU_INTEGRATED_PNPM_ARGS,undefined)
assert.ok(sdk);const require=createRequire(join(sdk,'package.json')),load=n=>import(pathToFileURL(require.resolve(n)))
const {boot}=await load('@deepseek-ai/dsh-app-boot'),{default:PluginManager}=await load('@deepseek-ai/dsh-plugin-manager')
const anchor=join(sdk,'upstream/source/apps/desktop-host/package.json'),pnpm=join(kit,'program/DeepSeek Harness.app/Contents/Resources/runtime/pnpm/bin/pnpm.mjs')
const hash=b=>createHash('sha256').update(b).digest('hex'),evidence={runtime:process.execPath,anchor:{path:anchor,sha256:hash(await readFile(anchor))},pnpm:{path:pnpm,sha256:hash(await readFile(pnpm))},phases:[],configChecks:[],requests:[],modelCalls:0,realAuth:false,serverStopped:false}
const pins=JSON.parse(await readFile(join(kit,'support/integrated-inputs.json')));assert.equal(process.execPath,pins.trustedRuntime.path);const runtimeBytes=await readFile(process.execPath);assert.equal(runtimeBytes.length,pins.trustedRuntime.bytes);assert.equal(hash(runtimeBytes),pins.trustedRuntime.sha256);assert.equal(evidence.anchor.sha256,pins.sdkAnchor.sha256);assert.equal(evidence.pnpm.sha256,'ff3224d46b47fbb24a7e9fe15fededef7e00892d07d4e376b6762d4899906bfd');evidence.runtimeSha256=hash(runtimeBytes);evidence.runtimeVersion=process.version;evidence.nativeCandidateExecuted=false;
async function inventory(root){const rows=[];root=await realpath(root);async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name),name=prefix+entry.name;if(entry.isDirectory())await walk(p,name+'/');else{assert.ok(entry.isFile(),name);rows.push({path:name,sha256:hash(await readFile(p))})}}}await walk(root);return rows.sort((a,b)=>a.path.localeCompare(b.path))}
test('actual ZIP twelve sources survive official pnpm11 local install/upgrade and corrupt rollback',{timeout:180000},async t=>{
 await mkdir(out,{recursive:false});const root=join(out,'disposable'),dir=join(root,'profiles/desktop');await cp(dirname(dirname(prepared)),root,{recursive:true,errorOnExist:true,force:false})
 const pkgfile=join(dir,'package.json'),custom=JSON.parse(await readFile(pkgfile));custom.syntheticUserPreference={keep:true};custom.dsh.profile.bundles=custom.dsh.profile.bundles.filter(id=>id!=='qcu-study-coach');await writeFile(pkgfile,JSON.stringify(custom));
 const patchfile=join(dir,'cordis.patch.yml'),flags=JSON.parse(await readFile(patchfile));flags.find(r=>r.id==='qcu-study-coach').disabled=true;await writeFile(patchfile,JSON.stringify(flags));await writeFile(join(root,'workspace/keep.txt'),'Synthetic retained work')
 const initial=JSON.parse(await readFile(join(dir,'package.json'))),patch=await readFile(join(dir,'cordis.patch.yml')),originalModules={};assert.equal(Object.keys(initial.dependencies).length,12)
 for(const id of Object.keys(initial.dependencies))originalModules[id]=await inventory(join(dir,'node_modules',id))
 const sources=await inventory(join(dir,'.qcu-bundles'))
 const server=createServer((req,res)=>{evidence.requests.push({method:req.method,path:req.url});res.writeHead(404).end('synthetic missing package')})
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)})
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));evidence.serverStopped=true;await writeFile(join(out,'EVIDENCE.json'),JSON.stringify(evidence,null,2)+'\n')})
 const registry='http://127.0.0.1:'+server.address().port+'/',user=join(root,'empty-user.npmrc'),global=join(root,'empty-global.npmrc'),configDir=join(root,'config/pnpm');await mkdir(configDir,{recursive:true})
 for(const p of [user,global,join(configDir,'auth.ini'),join(configDir,'rc')])await writeFile(p,'')
 await writeFile(join(configDir,'config.yaml'),'{}\n');await writeFile(join(dir,'.npmrc'),'registry='+registry+'\n')
 const kept=new Set(['PATH','HOME','TMPDIR','LANG','LC_ALL','QCU_OFFICIAL_DEPENDENCIES']);for(const k of Object.keys(process.env))if(!kept.has(k))delete process.env[k]
 process.env.ELECTRON_RUN_AS_NODE='1'
 const env={ELECTRON_RUN_AS_NODE:'1',XDG_CONFIG_HOME:join(root,'config'),XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data'),XDG_STATE_HOME:join(root,'state')}
 const settings={userconfig:user,globalconfig:global,registry,store_dir:join(root,'store'),cache_dir:join(root,'cache'),state_dir:join(root,'state'),fetch_retries:'0',fetch_timeout:'2000',update_notifier:'false',manage_package_manager_versions:'false',pm_on_fail:'ignore',proxy:'',https_proxy:''}
 for(const [k,v] of Object.entries(settings)){env['npm_config_'+k]=v;env['pnpm_config_'+k]=['proxy','https_proxy'].includes(k)?'null':v}
 env.pnpm_config_npmrc_auth_file=user
 assert.deepEqual(JSON.parse(await readFile(join(dir,'pnpm-workspace.yaml'))),{autoInstallPeers:false,ignoreScripts:true,packageImportMethod:'copy'});assert.ok(!Object.keys(env).some(k=>/package.?import.?method/i.test(k)))
 const command=process.execPath,args=['--expose-internals',pnpm],probe=tail=>spawnSync(command,[...args,...tail],{cwd:dir,env:{...process.env,...env},encoding:'utf8',timeout:15000})
 evidence.pnpm.command=command;evidence.pnpm.args=args;evidence.pnpm.shippedScriptUsed=true;evidence.packageImportMethodFromZipFileOnly=true

 const version=probe(['--version']);assert.equal(version.status,0,version.stderr);evidence.pnpm.version=version.stdout.trim();assert.equal(evidence.pnpm.version,'11.7.0')
 const expected={'package-import-method':'copy',userconfig:user,globalconfig:join(configDir,'config.yaml'),'auto-install-peers':'false','ignore-scripts':'true','store-dir':settings.store_dir,'cache-dir':settings.cache_dir,'state-dir':settings.state_dir,registry,'fetch-retries':'0','fetch-timeout':'2000'}
 for(const [key,value] of Object.entries(expected)){const r=probe(['config','get',key]);evidence.configChecks.push({key,expected:value,effective:r.stdout.trim(),status:r.status});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),value)}
 const isolatedEnv={...process.env,...env,QCU_TEACHER_TEST_HOME:root,QCU_INTEGRATED_SDK_ONLY:'1',QCU_INTEGRATED_MUTABLE_PROFILE:'1'}
 const repeat=phase=>{const r=spawnSync(process.execPath,['--expose-internals',join(kit,'support/start.cjs'),'prepare','--kit',kit],{env:isolatedEnv,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/already-prepared/);assert.equal(JSON.parse(r.stdout.split('QCU_TEACHER_RESULT:')[1].split('\n')[0]).directDependencies,13);evidence.phases.push({phase:'repeat-'+phase,exitCode:r.status});}
 const cold=phase=>{const r=spawnSync(process.execPath,['--expose-internals','--require',join(kit,'support/deny-network.cjs'),'tests/support/integrated-cold.cjs',kit,root],{env:{...isolatedEnv,QCU_OFFLINE_TEST_LOG:join(out,'cold-guard.jsonl')},encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);evidence.phases.push({phase:'cold-'+phase,result:JSON.parse(r.stdout.split('INTEGRATED_COLD:')[1].split('\n')[0])});}
 const profile={name:'dsh',dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:anchor,cwd:root,home:root,overlays:[],startedBundles:[],packageManager:{command,args,env},telemetryDisabledEnv:undefined}
 const ctx=await boot('dsh',join(dir,'cordis.yml'),[],c=>{c.provide('appReady',{onReady:fn=>{fn();return()=>{}}});c.provide('profileContext',profile)})
 try{
  await ctx.plugin(PluginManager,{registry,fallbackRegistries:[],inspectTimeoutMs:5000,idleTimeoutMs:20000}).await()
  // An additional synthetic bundle keeps each of the twelve original references untouched.
  // Both installation and upgrade run real pnpm with a new isolated store/cache.
  for(const version of ['0.0.1-test.1','0.0.1-test.2']){
   const archive=join(root,'synthetic-'+version+'.tgz');await writeFile(archive,syntheticUpdateArchive('qcu-synthetic-integration-proof',version))
   const result=await ctx.pluginManager.installBundle(archive,{enabled:false,requestId:crypto.randomUUID()});evidence.phases.push({version,result});assert.notEqual(result.application,'failed',JSON.stringify(result))
   const after=JSON.parse(await readFile(join(dir,'package.json')));assert.deepEqual(after.dsh,initial.dsh)
   for(const [id,spec] of Object.entries(initial.dependencies)){assert.equal(after.dependencies[id],spec);assert.deepEqual(await inventory(join(dir,'node_modules',id)),originalModules[id])}
   assert.deepEqual(await readFile(join(dir,'cordis.patch.yml')),patch);assert.deepEqual(await inventory(join(dir,'.qcu-bundles')),sources)
   assert.equal(JSON.parse(await readFile(join(dir,'node_modules/qcu-synthetic-integration-proof/package.json'))).version,version)
   repeat(version);cold(version)
  }
  const before={};for(const file of ['package.json','pnpm-lock.yaml','cordis.patch.yml'])before[file]=await readFile(join(dir,file))
  const installed=await inventory(join(dir,'node_modules/qcu-synthetic-integration-proof')),corrupt=join(root,'corrupt.tgz');await writeFile(corrupt,'synthetic corrupt archive')
  const rejected=await ctx.pluginManager.installBundle(corrupt,{enabled:false,requestId:crypto.randomUUID()});evidence.phases.push({phase:'corrupt-rollback',result:rejected});assert.equal(rejected.application,'failed')
  for(const [file,bytes] of Object.entries(before))assert.deepEqual(await readFile(join(dir,file)),bytes)
  for(const [id,rows] of Object.entries(originalModules))assert.deepEqual(await inventory(join(dir,'node_modules',id)),rows)
  assert.deepEqual(await inventory(join(dir,'node_modules/qcu-synthetic-integration-proof')),installed);assert.equal(evidence.requests.length,0)
  repeat('after-corrupt-refusal');cold('after-corrupt-refusal');assert.equal(await readFile(join(root,'workspace/keep.txt'),'utf8'),'Synthetic retained work');assert.deepEqual(JSON.parse(await readFile(pkgfile)).syntheticUserPreference,{keep:true});evidence.userChoicesAndWorkRetained=true;evidence.extraRemainsUnselected=true;evidence.errorAtomicityClaim='corrupt archive fixture only; prior default timeout moved roots without restoration';
  evidence.passed=true;evidence.originalTwelveRelativeSourcesModulesSettingsAndEnablesPreserved=true;evidence.failedOperationManifestLockPatchModulesPreserved=true
 }finally{await ctx.fiber.dispose()}
})
