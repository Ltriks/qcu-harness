'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const versions=['0.1.0-rc.4.3','0.1.0-rc.4.1'];
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function sourceHome(version,h){if(!versions.includes(version))throw Error('migration.version');return process.env.QCU_TEACHER_TEST_HOME?path.join(path.dirname(path.resolve(process.env.QCU_TEACHER_TEST_HOME)),version):h.defaultHome(version)}
function inspect(home,h){return {targetExists:fs.existsSync(home),sources:versions.filter(v=>fs.existsSync(path.join(sourceHome(v,h),'qcu-teacher.json')))}}
const skip=new Set(['Cache','Code Cache','GPUCache','ShaderCache','GrShaderCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','Crash Reports','SingletonLock','SingletonCookie','SingletonSocket','lockfile','LOCK']);
function included(root,p){const rel=path.relative(root,p).split(path.sep);return !(rel[0]==='electron'&&(skip.has(rel[1])||(rel[1]==='Default'&&skip.has(rel[2]))||(rel[1]==='Service Worker'&&['CacheStorage','ScriptCache'].includes(rel[2]))))}
function fingerprint(root){const hash=crypto.createHash('sha256');let files=0;const modules=path.join(root,'profiles/desktop/node_modules');function walk(dir){for(const name of fs.readdirSync(dir).sort()){const p=path.join(dir,name);if(!included(root,p))continue;const s=fs.lstatSync(p),rel=path.relative(root,p);hash.update(rel+'\0'+(s.mode&0o777)+'\0');if(s.isSymbolicLink()){const real=fs.realpathSync(p);if(!p.startsWith(modules+path.sep)||!real.startsWith(modules+path.sep))throw Error('migration.link');hash.update(fs.readlinkSync(p))}else if(s.isDirectory())walk(p);else if(s.isFile()&&s.nlink>=1){hash.update(fs.readFileSync(p));files++}else throw Error('migration.entry')}}walk(root);return {sha256:hash.digest('hex'),files}}
function stopped(source){const r=cp.spawnSync('/usr/sbin/lsof',['-t','+D',source],{encoding:'utf8',timeout:15000,maxBuffer:65536});if(r.error||!([0,1].includes(r.status))||(r.stderr||'').trim())throw Error('migration.stop-unconfirmed');if((r.stdout||'').trim())throw Error('migration.old-running')}
function migrate(kit,home,version,yaml,h){
 let stage;try{
 const m=h.identity(kit),source=sourceHome(version,h);h.privatePath(home);h.privatePath(source);
 if(fs.existsSync(home))throw Error('migration.target-occupied');
 const baselines=json(path.join(kit,'support/supported-upgrades.json')),base=baselines[version],old=json(h.plain(source,'qcu-teacher.json'));
 const fields=x=>({version:x.version,seedId:x.seedId,products:x.products,localSources:x.localSources});
 if(!base||JSON.stringify(fields(old))!==JSON.stringify(base))throw Error('migration.baseline');
 stopped(source);const before=fingerprint(source);fs.mkdirSync(path.dirname(home),{recursive:true});stage=fs.mkdtempSync(path.join(path.dirname(home),'.qcu-upgrade-'));
 fs.cpSync(source,stage,{recursive:true,dereference:false,verbatimSymlinks:true,filter:p=>included(source,p)});
 // Convert permitted absolute local-store links to stage-local relative links.
 const remap=dir=>{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isSymbolicLink()){const original=path.join(source,path.relative(stage,p)),real=fs.realpathSync(original),dest=path.join(stage,path.relative(source,real));fs.unlinkSync(p);fs.symlinkSync(path.relative(path.dirname(p),dest),p)}else if(s.isDirectory())remap(p)}};remap(stage);
 const profile=path.join(stage,'profiles/desktop'),seed=path.join(kit,'seed/profiles/desktop'),pkg=json(path.join(profile,'package.json')),fresh=json(path.join(seed,'package.json'));
 if(!Array.isArray(pkg.dsh?.profile?.bundles))throw Error('migration.profile');
 const patches=yaml(fs.readFileSync(path.join(profile,'cordis.patch.yml'),'utf8')),freshPatches=json(path.join(seed,'cordis.patch.yml'));
 if(!Array.isArray(patches)||new Set(patches.map(r=>r.id)).size!==patches.length)throw Error('migration.patch');
 for(const id of [...Object.keys(fresh.dependencies),'qcu-course-workbench']){fs.rmSync(path.join(profile,'node_modules',id),{recursive:true,force:true});delete pkg.dependencies[id]}
 pkg.dependencies={...pkg.dependencies,...fresh.dependencies};pkg.dsh.profile.bundles=[...new Set(pkg.dsh.profile.bundles.filter(id=>id!=='qcu-course-workbench'))];
 for(const id of fresh.dsh.profile.bundles)if(!pkg.dsh.profile.bundles.includes(id)&&!old.localSources.some(r=>r.id===id))pkg.dsh.profile.bundles.push(id);
 fs.cpSync(path.join(seed,'node_modules'),path.join(profile,'node_modules'),{recursive:true});
 for(const row of old.localSources){const f=path.join(profile,'.qcu-bundles',path.basename(row.source.replace('file:./.qcu-bundles/','')));fs.rmSync(f,{force:true})}fs.cpSync(path.join(seed,'.qcu-bundles'),path.join(profile,'.qcu-bundles'),{recursive:true});
 for(const row of freshPatches)if(!patches.some(p=>p.id===row.id))patches.push(row);
 const course=patches.find(r=>r.id==='qcu-course-workbench');if(course)course.disabled=true;
 const feishu=patches.find(r=>r.id==='qcu-feishu-readonly');if(feishu?.config?.cliPath===path.join(source,'bin/lark-cli'))feishu.config.cliPath=path.join(home,'bin/lark-cli');
 for(const id of ['ui-brand-official','ui-sidebar']){const row=patches.find(r=>r.id===id);if(row)row.disabled=true}
 fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify(pkg,null,2)+'\n');fs.writeFileSync(path.join(profile,'cordis.patch.yml'),JSON.stringify(patches,null,2)+'\n');
 fs.copyFileSync(path.join(seed,'pnpm-workspace.yaml'),path.join(profile,'pnpm-workspace.yaml'));
 require('./integrated.cjs').installed(stage,m,h,yaml);
 stopped(source);const after=fingerprint(source);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('migration.source-changed');
 fs.writeFileSync(path.join(stage,'qcu-teacher.json'),JSON.stringify({version:m.version,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),localSources:m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),preparedAt:new Date().toISOString(),packageManagerInvoked:false,migration:{from:version,sourceFingerprint:before.sha256,files:before.files}},null,2)+'\n');
 const launcher=process.env.QCU_SUITE_LAUNCHER;if(!launcher)throw Error('migration.commit-unavailable');const commit=cp.spawnSync(launcher,['--commit-upgrade',stage,home],{stdio:'ignore',timeout:15000});if(commit.error||commit.status!==0)throw Error('migration.commit');stage=null;
 return {home,result:'migrated',from:version,products:m.products.length};
 }catch(e){if(e.message==='migration.old-running'){e.code='QCU_PREVIOUS_RUNNING'}if(stage)try{fs.rmSync(stage,{recursive:true,force:true})}catch{}e.incidentStage='migration';throw e}
}
module.exports={inspect,migrate,sourceHome,fingerprint};
