'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),cp=require('node:child_process');
(async()=>{
 const stage=path.resolve(process.argv[2]),kit=path.join(stage,'QCU助手.app/Contents/Resources');
 const src=path.join(kit,'seed/profiles/desktop/node_modules/qcu-market/src');
 const pkg=JSON.parse(fs.readFileSync(path.join(src,'../package.json'),'utf8'));
 assert.equal(pkg.version,'0.1.0-pilot.16.15');
 const {publicTrust}=await import(pathToFileURL(path.join(src,'public-trust.mjs')));
 assert.equal(publicTrust.origin,'https://111.229.103.201');
 // /var/folders -> /private/var is fine; avoid /tmp symlink ancestors required by privateDirectory.
 const root=path.join(path.resolve(stage,'..'),'qcu-mac-cloud-'+process.pid);
 fs.rmSync(root,{recursive:true,force:true});
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 const authorityRoot=path.join(root,'authority');
 fs.mkdirSync(authorityRoot,{mode:0o700});
 try{
  const {CatalogAuthority}=await import(pathToFileURL(path.join(src,'catalog-authority.mjs')));
  const started=Date.now();
  const authority=new CatalogAuthority(publicTrust,{root:authorityRoot});
  const r=await authority.refresh();
  assert.equal(r.state,'fresh',r.message);
  assert.equal(r.catalog.entries.length,17);
  const item=r.catalog.entries.find(i=>String(i.id).includes('hallmark'));
  assert.ok(item);
  const {PackagePreparation,fetchPinned}=await import(pathToFileURL(path.join(src,'host-core.mjs')));
  const {releaseKeyOf}=await import(pathToFileURL(path.join(src,'catalog-core.mjs')));
  const prep=new PackagePreparation({authority,download:o=>fetchPinned({...o,root:path.join(root,'packages'),validate:e=>prep.releaseUrl(e)})});
  const receipt=JSON.parse(await prep.prepare('test-cloud-mac',releaseKeyOf(item.release)));
  await prep.verify('test-cloud-mac');
  assert.equal(fs.statSync(receipt.path).size,item.release.bytes);
  // Official PluginManager install must run under the bundled Electron (ASAR require).
  const electron=path.join(kit,'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness');
  const helper=path.join(root,'install-helper.cjs');
  fs.writeFileSync(helper,`'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const kit=${JSON.stringify(kit)},root=${JSON.stringify(root)},receiptPath=${JSON.stringify(receipt.path)},itemId=${JSON.stringify(item.id)},itemVersion=${JSON.stringify(item.release.version)};
 const resources=path.join(kit,'program/DeepSeek Harness.app/Contents/Resources');
 const api=await require(path.join(kit,'support/offline.cjs')).runtime(resources);
 const dir=path.join(root,'profiles/desktop');
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'qcu-disposable-install',private:true,dependencies:{},dsh:{profile:{bundles:[]}}}));
 fs.writeFileSync(path.join(dir,'cordis.yml'),'[]');
 fs.writeFileSync(path.join(dir,'cordis.patch.yml'),'[]');
 fs.writeFileSync(path.join(dir,'pnpm-workspace.yaml'),JSON.stringify({autoInstallPeers:false,ignoreScripts:true,packageImportMethod:'copy'}));
 const profile={name:'dsh',dir,patchPath:path.join(dir,'cordis.patch.yml'),installAnchor:api.anchor,cwd:root,home:root,overlays:[],startedBundles:[],packageManager:{command:process.execPath,args:['--expose-internals',path.join(resources,'runtime/pnpm/bin/pnpm.mjs')],env:{ELECTRON_RUN_AS_NODE:'1',npm_config_registry:'http://127.0.0.1:9/',npm_config_fetch_retries:'0',npm_config_store_dir:path.join(root,'store'),npm_config_ignore_scripts:'true',npm_config_auto_install_peers:'false'}}};
 const {boot}=api.boot,{default:PluginManager}=await api.load('@deepseek-ai/dsh-plugin-manager');
 const ctx=await boot('dsh',path.join(dir,'cordis.yml'),[],c=>{c.provide('appReady',{onReady:fn=>{fn();return()=>{}}});c.provide('profileContext',profile)});
 try{
  await ctx.plugin(PluginManager,{registry:'http://127.0.0.1:9/',fallbackRegistries:[],inspectTimeoutMs:15000,idleTimeoutMs:45000}).await();
  const result=await ctx.pluginManager.installBundle(receiptPath,{enabled:false,requestId:require('node:crypto').randomUUID()});
  assert.notEqual(result.application,'failed',JSON.stringify(result));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'node_modules',itemId,'package.json'))).version,itemVersion);
  assert.ok(!JSON.parse(fs.readFileSync(path.join(dir,'package.json'))).dsh.profile.bundles.includes(itemId));
  console.log(JSON.stringify({installPassed:true,tool:itemId,version:itemVersion}));
 }finally{await ctx.fiber.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
`);
  const install=cp.spawnSync(electron,[helper],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:120000});
  assert.equal(install.status,0,install.stderr||install.stdout);
  assert.match(install.stdout,/installPassed":true/);
  console.log(JSON.stringify({passed:true,platform:'mac-arm64',origin:publicTrust.origin,marketVersion:pkg.version,catalogState:r.state,entries:r.catalog.entries.length,tool:item.id,bytes:item.release.bytes,refreshMs:Date.now()-started,installedDisabled:true,modelCalls:0,gui:false}));
 }finally{try{fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(e){if(!['EPERM','EBUSY'].includes(e.code))throw e}}
})().catch(e=>{console.error(e);process.exitCode=1});
