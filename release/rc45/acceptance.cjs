// Frozen rc45 support checks. Uses pristine synthetic data, no model or network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const [kit,launcher]=process.argv.slice(2).map(p=>path.resolve(p)),temp=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'qcu-rc45-support-')),home=path.join(temp,'data'),support=path.join(kit,'support'),h=require(path.join(support,'start.cjs')),m=h.identity(kit);
 process.env.QCU_SUITE_LAUNCHER=launcher;process.env.QCU_TEACHER_TEST_HOME=home;process.env.QCU_SUITE_SUPPORT=support;
 const resources=m.target==='mac-arm64'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');
 const api=await require(path.join(support,'offline.cjs')).runtime(resources),yaml=api.req('js-yaml').load;
 assert.equal(m.version,'0.1.0-rc.4.5');assert.equal(m.localSources.length,18);assert.equal(m.branding.version,'0.3.0-pilot.6');
 assert.equal(h.prepare(kit,home,undefined,yaml).result,'prepared');assert.equal(h.prepare(kit,home,undefined,yaml).result,'already-prepared');
 const patch=path.join(home,'profiles/desktop/cordis.patch.yml'),data=fs.readFileSync(patch);fs.appendFileSync(patch,'\n# synthetic preservation marker\n');const changed=fs.readFileSync(patch);assert.equal(h.prepare(kit,home,undefined,yaml).result,'already-prepared');assert.deepEqual(fs.readFileSync(patch),changed);
 const occupied=path.join(temp,'occupied');fs.mkdirSync(occupied);fs.writeFileSync(path.join(occupied,'keep'),'preserve');assert.throws(()=>h.prepare(kit,occupied,undefined,yaml));assert.equal(fs.readFileSync(path.join(occupied,'keep'),'utf8'),'preserve');
 const bad=JSON.parse(JSON.stringify(m));bad.localSources[0].version='wrong';assert.throws(()=>require(path.join(support,'integrated.cjs')).identity(bad));
 const diagnostics=require(path.join(support,'diagnostics-api.cjs'));assert.equal(diagnostics.status().autoReport,false);assert.equal(diagnostics.status().version,m.version);
 const profile=path.join(home,'profiles/desktop');assert.equal(fs.existsSync(path.join(profile,'node_modules/qcu-course-workbench')),false);
 const report={passed:true,suite:m.version,components:18,checks:['frozen-composition','seed-hashes','fresh-prepare','repeat-prepare','config-preserved','occupied-target-preserved','altered-composition-refused','diagnostics-default-off','no-course-preinstall'],modelCalls:0,newLauncherTested:false,commitHelper:'existing rc44 native launcher with isolated test home'};
 console.log('QCU_RC45_SUPPORT:'+JSON.stringify(report));fs.writeFileSync(path.resolve(process.argv[4]||'support-acceptance.json'),JSON.stringify(report,null,2));fs.rmSync(temp,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1});
