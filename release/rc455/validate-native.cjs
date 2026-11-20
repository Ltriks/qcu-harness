'use strict';
// Native bundled-runtime tests use isolated synthetic Homes only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
(async()=>{
 const [kit,baselines,testRoot,out]=process.argv.slice(2),support=path.join(kit,'support');
 fs.mkdirSync(testRoot,{recursive:true,mode:0o700});
 const resources=process.platform==='darwin'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');
 const launcher=process.platform==='darwin'?path.resolve(kit,'../MacOS/QCU助手'):path.join(kit,'QCU助手.exe');
 // Determine the Mac executable name from the actual bundle, without a hard-coded alias.
 const actualLauncher=process.platform==='darwin'?path.join(path.resolve(kit,'../MacOS'),fs.readdirSync(path.resolve(kit,'../MacOS'))[0]):launcher;
 process.env.QCU_SUITE_LAUNCHER=actualLauncher;process.env.QCU_SUITE_SUPPORT=support;
 const runtime=await require(path.join(support,'offline.cjs')).runtime(resources),yaml=runtime.req('js-yaml').load,h=require(path.join(support,'start.cjs'));
 const m=h.identity(kit);assert.equal(m.buildId,'rc45.6');
 const results=[];
 const fresh=path.join(testRoot,'fresh/teacher');process.env.QCU_TEACHER_TEST_HOME=fresh;
 for(let i=0;i<2;i++){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=cp.spawnSync(actualLauncher,['--prepare-only'],{env,encoding:'utf8',timeout:120000});
  assert.equal(child.status,0,'native launcher preparation failed: '+child.stderr);
 }
 results.push({case:'native-launcher-fresh-and-repeat',passed:true});
 let rollbackInitial;
 for(const revision of [1,2,3,4]){
  const home=path.join(testRoot,'upgrade-'+revision,'teacher');process.env.QCU_TEACHER_TEST_HOME=home;
  assert.equal(h.prepare(kit,home,undefined,yaml).result,'prepared');
  const folder=path.join(baselines,String(revision)),old=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))),profile=path.join(home,'profiles/desktop');
  const pkgFile=path.join(profile,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgFile));
  for(const row of old.localSources.filter(row=>['qcu-market','qcu-branding'].includes(row.id))){
   const dest=path.join(profile,'node_modules',row.id);fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(path.join(folder,'node_modules',row.id),dest,{recursive:true});
   fs.copyFileSync(path.join(folder,'.qcu-bundles',row.file),path.join(profile,'.qcu-bundles',row.file));pkg.dependencies[row.id]=row.source;
  }
  pkg.dependencies['qcu-synthetic-extra']='0.1.0';const extra=path.join(profile,'node_modules/qcu-synthetic-extra');fs.mkdirSync(extra);fs.writeFileSync(path.join(extra,'package.json'),JSON.stringify({name:'qcu-synthetic-extra',version:'0.1.0'}));fs.writeFileSync(pkgFile,JSON.stringify(pkg));
  const receiptFile=path.join(home,'qcu-teacher.json'),receipt=JSON.parse(fs.readFileSync(receiptFile));
  Object.assign(receipt,{seedId:old.seedId,build:old.buildId,products:old.products.map(row=>({id:row.id,version:row.version})),localSources:old.localSources.map(row=>({id:row.id,source:row.source,sha256:row.sha256}))});fs.writeFileSync(receiptFile,JSON.stringify(receipt));
  const patch=path.join(profile,'cordis.patch.yml');fs.appendFileSync(patch,'\n# synthetic teacher customization retained\n');const patchBytes=fs.readFileSync(patch);
  fs.writeFileSync(path.join(home,'workspace/synthetic-note.txt'),'retained');
  const diag=path.join(path.dirname(home),'diagnostics');fs.mkdirSync(diag,{mode:0o700});
  const lan=require(path.join(support,'lan-report.cjs')),settings=path.join(diag,'reporting-settings.json');fs.writeFileSync(settings,JSON.stringify({schemaVersion:2,autoReport:false,receiver:lan.RECEIVER,policyVersion:2}),{mode:0o600});const preferenceBytes=fs.readFileSync(settings);
  if(revision===4){rollbackInitial=path.join(testRoot,'rollback/teacher');fs.mkdirSync(path.dirname(rollbackInitial),{recursive:true,mode:0o700});fs.cpSync(home,rollbackInitial,{recursive:true})}
  assert.equal(h.prepare(kit,home,undefined,yaml).result,'refreshed');assert.equal(h.prepare(kit,home,undefined,yaml).result,'already-prepared');
  assert.deepEqual(fs.readFileSync(patch),patchBytes);assert.deepEqual(fs.readFileSync(settings),preferenceBytes);
  assert.equal(JSON.parse(fs.readFileSync(pkgFile)).dependencies['qcu-synthetic-extra'],'0.1.0');assert.equal(fs.readFileSync(path.join(home,'workspace/synthetic-note.txt'),'utf8'),'retained');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'node_modules/qcu-branding/package.json'))).version,'0.3.0-pilot.7');assert.equal(JSON.parse(fs.readFileSync(receiptFile)).seedId,m.seedId);
  assert.equal(lan.enabled(diag),false);results.push({case:'upgrade-4.5.'+revision,passed:true,settingsAndWorkPreserved:true});
 }
 process.env.QCU_TEACHER_TEST_HOME=rollbackInitial;
 const oldReceipt=fs.readFileSync(path.join(rollbackInitial,'qcu-teacher.json')),oldPackage=fs.readFileSync(path.join(rollbackInitial,'profiles/desktop/package.json')),rename=fs.renameSync;let injected=false;
 try{fs.renameSync=(from,to)=>{if(!injected&&String(to).endsWith(path.join('node_modules','qcu-branding'))){injected=true;throw Error('synthetic rename failure')}return rename(from,to)};assert.throws(()=>h.prepare(kit,rollbackInitial,undefined,yaml))}finally{fs.renameSync=rename}
 assert.equal(injected,true);assert.deepEqual(fs.readFileSync(path.join(rollbackInitial,'qcu-teacher.json')),oldReceipt);assert.deepEqual(fs.readFileSync(path.join(rollbackInitial,'profiles/desktop/package.json')),oldPackage);results.push({case:'injected-hotfix-failure-rolls-back',passed:true});
 const unknown=JSON.parse(oldReceipt);unknown.seedId='0'.repeat(64);fs.writeFileSync(path.join(rollbackInitial,'qcu-teacher.json'),JSON.stringify(unknown));const unknownBytes=fs.readFileSync(path.join(rollbackInitial,'qcu-teacher.json'));assert.throws(()=>h.prepare(kit,rollbackInitial,undefined,yaml));assert.deepEqual(fs.readFileSync(path.join(rollbackInitial,'qcu-teacher.json')),unknownBytes);results.push({case:'unknown-build-preserved-and-refused',passed:true});
 const cloudHome=path.join(testRoot,'cloud-self-test/teacher');process.env.QCU_TEACHER_TEST_HOME=cloudHome;
 const api=require(path.join(support,'diagnostics-api.cjs')),lan=require(path.join(support,'lan-report.cjs')),incidents=require(path.join(support,'incidents.cjs'));
 assert.equal(api.onboarding('inspect').state,'unset');assert.equal(api.onboarding('disclosed').state,'default-enabled');
 const report=incidents.createIncident(Error('synthetic release self-test'),{suiteVersion:m.version,sourceKind:'self-test',stage:'profile'});assert.equal(report.buildId,'rc45.6');assert.equal(incidents.saveIncident(report,api.root()).saved,true);
 const delivered=await lan.flush(api.root(),{budgetMs:3000});assert.equal(delivered.received,1,'cloud receipt not confirmed');
 const again=await lan.flush(api.root());assert.equal(again.received,0);assert.equal(again.state,'idle');
 const delivery=JSON.parse(fs.readFileSync(path.join(api.root(),report.incidentId+'.delivery.json')));assert.equal(delivery.state,'received');assert.equal(api.onboarding('disable').state,'explicit-disabled');assert.equal(api.onboarding('disclosed').autoReport,false);
 results.push({case:'cloud-HTTPS-self-test-and-idempotence',passed:true,incidentId:report.incidentId,receiptId:delivery.receipt.receiptId,sourceKind:'self-test'});
 const proof={passed:true,platform:process.platform,arch:process.arch,build:m.buildId,seedId:m.seedId,results,realUserDataTouched:false,modelCalls:0,syntheticCloudIncidents:1,guiVerified:false};fs.writeFileSync(out,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
})().catch(error=>{console.error(error);process.exitCode=1});
