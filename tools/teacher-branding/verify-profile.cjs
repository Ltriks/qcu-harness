const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {runtime}=require('../offline-suite/offline.cjs');
(async()=>{
 const [resources,kit,home]=process.argv.slice(2).map(p=>path.resolve(p));
 const prepare=require(path.join(kit,'support/start.cjs')).prepare;
 const result=prepare(kit,home),again=prepare(kit,home);assert.equal(again.result,'already-prepared');
 const api=await runtime(resources),dir=path.join(home,'profiles/desktop');
 const profile=api.boot.loadProfileDirectory('dsh',dir,api.anchor);
 assert.equal(profile.skippedBundles.length,0,JSON.stringify(profile.skippedBundles));
 const rows=api.boot.composeEntries([...profile.layers.map(layer=>layer.patches),profile.patches]);
 const all=[];function walk(values){for(const row of values){all.push(row);if(Array.isArray(row.config))walk(row.config);if(Array.isArray(row.children))walk(row.children);}}
 walk(rows);
 const sidebar=all.filter(r=>r.id==='ui-sidebar'),brand=all.filter(r=>r.id==='qcu-branding');
 assert.equal(sidebar.length,1);assert.equal(sidebar[0].disabled,true);
 assert.equal(brand.length,1); // Missing disabled is enabled.
 const enabled=brand[0].disabled!==true;assert.equal(enabled,true);
 const manifest=JSON.parse(fs.readFileSync(path.join(kit,'support/manifest.json'),'utf8'));
 assert.equal(manifest.migrateFrom,undefined);assert.equal(manifest.themePreview.formalRelease,false);
 const installed=JSON.parse(fs.readFileSync(path.join(dir,'node_modules/qcu-branding/package.json'),'utf8'));
 assert.equal(installed.version,'0.2.0');
 console.log('QCU_THEME_PROFILE_VERIFIED:'+JSON.stringify({target:manifest.target,prepare:result.result,repeat:again.result,skippedBundles:0,brandEnabled:enabled,officialSidebarDisabled:true,themeVersion:installed.version,seedFiles:manifest.seedFiles.length,migration:false,gui:false,modelCalls:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
