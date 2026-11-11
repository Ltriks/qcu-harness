'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),kit=process.env.QCU_TEST_KIT||path.join(root,'dist/QCU助手.app/Contents/Resources'),h=require(path.join(kit,'support/start.cjs')),temp=fs.mkdtempSync('/private/tmp/qcu-rc44-accept-'),launcher=path.join(kit,'../MacOS/城院助手'),results=[];

process.env.QCU_SUITE_LAUNCHER=launcher;process.env.QCU_SUITE_SUPPORT=path.join(kit,'support');
const report=(name)=>results.push({name,passed:true});
async function main(){
 assert.equal(globalThis.QCU_OFFLINE_NETWORK_GUARD,true);
 const home=path.join(temp,'fresh','home');process.env.QCU_TEACHER_TEST_HOME=home;
 assert.equal(h.prepare(kit,home).result,'prepared');assert.equal(h.prepare(kit,home).result,'already-prepared');report('offline fresh preparation and reopen');
 const profile=path.join(home,'profiles/desktop'),pkgFile=path.join(profile,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgFile));
 assert(!Object.hasOwn(pkg.dependencies,'qcu-course-workbench'));assert(!fs.existsSync(path.join(profile,'node_modules/qcu-course-workbench')));report('course not installed or selected');
 const runtime=path.join(kit,'program/DeepSeek Harness.app/Contents/Resources');const api=await require(path.join(kit,'support/offline.cjs')).runtime(runtime),yaml=api.req('js-yaml').load;
 const optional=['@deepseek-ai/dsh-experimental-agent-team-profile','@deepseek-ai/dsh-experimental-voice-input-bundle','@deepseek-ai/dsh-experimental-auto-review','@deepseek-ai/dsh-experimental-schedule-bundle'];
 for(const id of optional){pkg.dsh.profile.bundles.push(id);fs.writeFileSync(pkgFile,JSON.stringify(pkg));assert.equal(h.prepare(kit,home,undefined,yaml).result,'already-prepared');pkg.dsh.profile.bundles.pop();fs.writeFileSync(pkgFile,JSON.stringify(pkg))}report('four official optional selections enabled and disabled');
 const incident=require(path.join(kit,'support/incidents.cjs')),diagnostics=require(path.join(kit,'support/diagnostics-api.cjs'));
 const item=incident.createIncident(Error('SECRET-SHOULD-NOT-LEAK'),{suiteVersion:'0.1.0-rc.4.4',stage:'profile',sourceKind:'self-test'});assert(incident.saveIncident(item,diagnostics.root()).saved);assert.equal(diagnostics.status().autoReport,false);assert.equal(diagnostics.status().records.length,1);assert(!JSON.stringify(diagnostics.exportRecord(item.incidentId)).includes('SECRET'));await diagnostics.preference(true);assert(diagnostics.status().autoReport);await diagnostics.preference(false);assert(!diagnostics.status().autoReport);report('safe diagnostic export, offline queue and explicit preference');
 for(const version of ['0.1.0-rc.4.1','0.1.0-rc.4.3']){
  const group=path.join(temp,version),target=path.join(group,'new'),source=path.join(group,version);fs.mkdirSync(group);process.env.QCU_TEACHER_TEST_HOME=target;
  const oldKit=path.join('/Users/mcq/Artifacts/qcu-harness',version,version.endsWith('1')?'mac-arm64-final':'mac-arm64','QCU助手.app/Contents/Resources');require(path.join(oldKit,'support/start.cjs')).prepare(oldKit,source);
  const oldProfile=path.join(source,'profiles/desktop'),patchFile=path.join(oldProfile,'cordis.patch.yml'),patch=JSON.parse(fs.readFileSync(patchFile));patch.push({id:'synthetic-preservation',disabled:true,config:{apiKey:'SYNTHETIC-ONLY-KEY',value:73}});fs.writeFileSync(patchFile,JSON.stringify(patch));
  fs.writeFileSync(path.join(source,'workspace','synthetic-note.md'),'synthetic work must survive');fs.writeFileSync(path.join(source,'electron','synthetic-setting.json'),'{"value":7}');
  const oldPkgFile=path.join(oldProfile,'package.json'),oldPkg=JSON.parse(fs.readFileSync(oldPkgFile));oldPkg.dsh.profile.bundles.push(...optional);fs.writeFileSync(oldPkgFile,JSON.stringify(oldPkg));
  const upgrade=require(path.join(kit,'support/upgrade.cjs')),before=upgrade.fingerprint(source);const migrated=upgrade.migrate(kit,target,version,yaml,h);assert.equal(migrated.result,'migrated');assert.deepEqual(before,upgrade.fingerprint(source));
  assert.equal(fs.readFileSync(path.join(target,'workspace/synthetic-note.md'),'utf8'),'synthetic work must survive');assert.equal(fs.readFileSync(path.join(target,'electron/synthetic-setting.json'),'utf8'),'{"value":7}');assert(fs.readFileSync(path.join(target,'profiles/desktop/cordis.patch.yml'),'utf8').includes('SYNTHETIC-ONLY-KEY'));assert.equal(h.prepare(kit,target,undefined,yaml).result,'already-prepared');
  const newPkg=JSON.parse(fs.readFileSync(path.join(target,'profiles/desktop/package.json')));for(const id of optional)assert(newPkg.dsh.profile.bundles.includes(id));assert(!newPkg.dsh.profile.bundles.includes('qcu-course-workbench'));
  assert.throws(()=>upgrade.migrate(kit,target,version,yaml,h));assert.deepEqual(before,upgrade.fingerprint(source));report(version+' copied with synthetic key, records, settings; original unchanged; occupied target refused');
 }
 // Use the actual ASAR loader and Typert registry for both new host plugins.
 process.env.QCU_TEACHER_TEST_HOME=home;const p=api.boot.loadProfileDirectory('dsh',profile,api.anchor),resolution=await api.boot.createRuntimeResolution({installAnchor:api.anchor,profile:p,home});const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context();
 try{new api.boot.PluginPackages(ctx,{resolution});const {TypertRegistry}=await api.load('@deepseek-ai/dsh-typert-registry');new TypertRegistry(ctx);const {Loader}=await api.load('@deepseek-ai/cordis-plugin-loader');const loader=new Loader(ctx,{baseUrl:pathToFileURL(path.join(profile,'cordis.yml')).href});loader.write=()=>{};
 for(const name of ['qcu-branding','qcu-market']){const mod=await loader.import(name);await ctx.plugin(mod).await()}
 assert.equal(JSON.parse(ctx.qcuMarket.status()).version,'0.1.0-pilot.16.4');const status=JSON.parse(ctx.qcuDiagnostics.status());assert.equal(status.value.build,'rc44.2');assert.equal(JSON.parse(ctx.qcuDiagnostics.exportRecord(JSON.stringify({incidentId:item.incidentId}))).value.diagnostic.incidentId,item.incidentId);report('actual ASAR import and Typert host registration for branding and market');
 }finally{await ctx.fiber.dispose()}
 fs.writeFileSync(path.join(root,'artifacts/ACCEPTANCE.json'),JSON.stringify({networkGuard:true,actualAsar:true,modelsCalled:0,results},null,2)+'\n');console.log(JSON.stringify(results));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
