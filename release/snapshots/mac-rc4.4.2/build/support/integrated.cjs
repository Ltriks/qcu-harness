'use strict';
// Exact pinned rc4.1/rc4.2/rc4.3 whole-suite seeds. Legacy rc2/rc3 preparation stays in start.cjs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const RELEASES={'0.1.0-rc.4.1':['0.2.3'],'0.1.0-rc.4.2':['0.2.4'],'0.1.0-rc.4.3':['0.2.6-pilot.2','0.2.6-pilot.3'],'0.1.0-rc.4.4':['0.2.7-pilot.2']};
function releaseMismatch(){const error=Error('[QCU_DATA_RELEASE_MISMATCH] 已有数据来自另一份测试构建，已保留。请使用对应安装包或联系维护人员核对版本，不要删除配置。');error.code='QCU_DATA_RELEASE_MISMATCH';return error}
const IDS=['qcu-study-coach','qcu-lesson-planning','qcu-tiered-practice','qcu-note-organizer','qcu-reading-outline','qcu-integrity-guard','qcu-team-briefing','qcu-feishu-readonly','qcu-course-workbench','qcu-market','qcu-expert-teams','qcu-branding'];
function idsFor(m){return m.version==='0.1.0-rc.4.4'?IDS.filter(id=>id!=='qcu-course-workbench'):IDS}
function identity(m){
 const sources=m.localSources,managedIds=idsFor(m);
 if(!Object.hasOwn(RELEASES,m.version)||m.target!=='mac-arm64'||m.products?.length!==managedIds.length-1||!RELEASES[m.version].includes(m.branding?.version)||m.migrateFrom||!Array.isArray(sources)||sources.length!==managedIds.length||new Set(sources.map(p=>p.id)).size!==managedIds.length||managedIds.some(id=>!sources.some(p=>p.id===id))||sha(Buffer.from(JSON.stringify(m.seedFiles)))!==m.seedId)throw Error('Unexpected integrated teacher release');
 if(new Set(m.products.map(p=>p.id)).size!==managedIds.length-1||managedIds.filter(id=>id!=='qcu-branding').some(id=>!m.products.some(p=>p.id===id&&p.version===sources.find(s=>s.id===id).version)))throw Error('Unexpected integrated product selection');
 if(m.branding.id!=='qcu-branding'||sources.find(p=>p.id==='qcu-branding').version!==m.branding.version)throw Error('Unexpected integrated branding selection');
 if(m.version==='0.1.0-rc.4.4'){const p=sources.find(p=>p.id==='qcu-market');if(p.version!=='0.1.0-pilot.16.4'||p.sha256!=='7d39368e0b6f20abba3d1911f4f4ea20947c163a1c289570e7c2a97b8b802c9b')throw Error('Unexpected rc4.4 market composition')}
 if(m.version==='0.1.0-rc.4.3'){
  for(const [id,version,hash] of [['qcu-market','0.1.0-pilot.16.1'],['qcu-course-workbench','0.1.0-pilot.1.3.font.1','d46ba9e2deb27f7cd6296a5bfd24b3e8db0f0d99bcc4cddc734f82b794197411'],['qcu-expert-teams','0.2.0-pilot.3.font.1','4835ab751ccef3f11089a5b5ad198ea22d1ef7d34a334ac231ef83052cdbad93']]){const p=sources.find(p=>p.id===id);if(p.version!==version||(hash&&p.sha256!==hash))throw Error('Unexpected rc4.3 frozen composition')}
 }
 for(const p of sources)if(p.source!=='file:./.qcu-bundles/'+p.file||!/^[a-z0-9.-]+\.tgz$/.test(p.file)||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('Unexpected integrated source');
 return m;
}
function verifySeed(kit,m,h){
 if(JSON.stringify(h.seedMembers(kit))!==JSON.stringify(m.seedFiles.map(r=>r.path).sort()))throw Error('Seed file inventory differs from release');
 for(const r of m.seedFiles){const p=h.plain(kit,r.path),s=fs.statSync(p),b=fs.readFileSync(p);if(b.length!==r.bytes||sha(b)!==r.sha256||(s.mode&0o777)!==r.mode)throw Error('Release integrity failed: '+r.path)}
}
function fileTree(root){if(fs.lstatSync(root).isSymbolicLink()||!fs.statSync(root).isDirectory())throw Error('Installed managed root invalid');const rows=[];function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isFile()&&!s.isDirectory()))throw Error('Installed managed files contain unsafe entries');if(s.isDirectory())walk(p);else rows.push(path.relative(root,p).split(path.sep).join('/'))}}walk(root);return rows.sort()}
const POLICY={autoInstallPeers:false,ignoreScripts:true,packageImportMethod:'copy'};
function installedSeed(home,m,h,parseYaml=JSON.parse){
 const IDS=idsFor(m);
 const profile=path.join(home,'profiles/desktop'),pkg=json(h.plain(home,'profiles/desktop/package.json'));
 if(fs.lstatSync(path.join(profile,'node_modules')).isSymbolicLink())throw Error('Installed module directory uses a link; preserved');
 if(Object.keys(pkg.dependencies??{}).sort().join()!==IDS.slice().sort().join())throw Error('Installed dependency set mismatch; preserved');
 for(const p of m.localSources){
  if(pkg.dependencies[p.id]!==p.source)throw Error('Installed relative source mismatch; preserved');
  const prefix='seed/profiles/desktop/node_modules/'+p.id+'/',rows=m.seedFiles.filter(r=>r.path.startsWith(prefix)),declared=path.join(profile,'node_modules',p.id),root=fs.realpathSync(declared);
  if(fs.lstatSync(declared).isSymbolicLink()){const store=path.join(profile,'node_modules/.pnpm');if(fs.lstatSync(store).isSymbolicLink()||!root.startsWith(store+path.sep))throw Error('Installed module link leaves local store; preserved')}
  if(JSON.stringify(fileTree(root))!==JSON.stringify(rows.map(r=>r.path.slice(prefix.length)).sort()))throw Error('Installed product inventory mismatch; preserved');
  for(const r of rows){const file=h.plain(root,r.path.slice(prefix.length)),b=fs.readFileSync(file);if(b.length!==r.bytes||sha(b)!==r.sha256)throw Error('Installed product integrity mismatch; preserved')}
  const data=fs.readFileSync(h.plain(home,'profiles/desktop/.qcu-bundles/'+p.file));if(data.length!==p.bytes||sha(data)!==p.sha256)throw Error('Installed local archive mismatch; preserved');
 }
 if(fs.readdirSync(path.join(profile,'.qcu-bundles')).sort().join()!==m.localSources.map(p=>p.file).sort().join())throw Error('Installed local source inventory mismatch; preserved');
 const bundles=pkg.dsh?.profile?.bundles,allowed=['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app',...IDS];
 if(!Array.isArray(bundles)||new Set(bundles).size!==bundles.length||bundles.some(id=>!allowed.includes(id))||!allowed.slice(0,2).every(id=>bundles.includes(id)))throw Error('Installed bundle selection invalid; preserved');
 const patches=parseYaml(fs.readFileSync(h.plain(home,'profiles/desktop/cordis.patch.yml'),'utf8'));
 if(!Array.isArray(patches)||patches.some(r=>!r||typeof r!=='object'))throw Error('Installed configuration invalid; preserved');
 for(const id of IDS){const rows=patches.filter(r=>r.id===id);if(rows.length!==1||typeof rows[0].disabled!=='boolean')throw Error('Installed component selection invalid; preserved')}
 for(const id of ['ui-brand-official','ui-sidebar'])if(patches.filter(r=>r.id===id&&r.disabled===true).length!==1)throw Error('Integrated sidebar configuration invalid; preserved');
 const policy=json(h.plain(home,'profiles/desktop/pnpm-workspace.yaml'));if(JSON.stringify(policy)!==JSON.stringify(POLICY))throw Error('Installed package policy mismatch; preserved');
 fs.accessSync(h.plain(home,'bin/lark-cli'),fs.constants.X_OK);
}
function metadata(home,name,h){const file=h.plain(home,name),s=fs.statSync(file);if(s.size>1024*1024||s.nlink!==1)throw Error('Installed metadata invalid; preserved');return fs.readFileSync(file,'utf8')}
// This is structural validation, not an extension approval or a seed repair. The
// official installer/loader owns installed code, sources and enable decisions.
function installed(home,m,h,parseYaml=JSON.parse){
 const pkg=JSON.parse(metadata(home,'profiles/desktop/package.json',h)),deps=pkg.dependencies;
 const validId=id=>typeof id==='string'&&/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(id)&&!id.split('/').some(p=>p==='.'||p==='..');
 if(!deps||typeof deps!=='object'||Array.isArray(deps)||Object.entries(deps).some(([id,spec])=>!validId(id)||typeof spec!=='string'||!spec.trim()))throw Error('Installed dependencies invalid; preserved');
 const modules=path.join(home,'profiles/desktop/node_modules');
 if(fs.lstatSync(modules).isSymbolicLink())throw Error('Installed module directory uses a link; preserved');
 h.plain(home,'profiles/desktop/package.json');
 const local=fs.realpathSync(modules),seen=new Set();
 function inspect(p){const root=fs.realpathSync(p);if(root!==local&&!root.startsWith(local+path.sep))throw Error('Installed module link leaves local store; preserved');if(seen.has(root))return;seen.add(root);const s=fs.statSync(p);if(s.isDirectory()){for(const name of fs.readdirSync(p))inspect(path.join(p,name))}else if(!s.isFile()||s.nlink<1)throw Error('Installed module entry invalid; preserved')}
 inspect(modules);
 for(const id of Object.keys(deps)){const root=fs.realpathSync(path.join(modules,id));if(!root.startsWith(local+path.sep))throw Error('Installed module path escapes profile; preserved');const p=JSON.parse(metadata(root,'package.json',h));if(p.name!==id||typeof p.version!=='string'||!p.version)throw Error('Installed package identity invalid; preserved')}
 const bundles=pkg.dsh?.profile?.bundles,native=['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'];
 // Optional bundles are supplied by the frozen DSH runtime, not profile dependencies.
 const installationBundles=[...native,'@deepseek-ai/dsh-experimental-agent-team-profile','@deepseek-ai/dsh-experimental-voice-input-bundle','@deepseek-ai/dsh-experimental-auto-review','@deepseek-ai/dsh-experimental-schedule-bundle'];
 const selectionFailure=require('./incidents.cjs').selectionError(bundles,deps,native,installationBundles);if(selectionFailure)throw selectionFailure;
 const patches=parseYaml(metadata(home,'profiles/desktop/cordis.patch.yml',h)),base=parseYaml(metadata(home,'profiles/desktop/cordis.yml',h));
 if(!Array.isArray(base)||!Array.isArray(patches)||patches.some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||('disabled'in r&&typeof r.disabled!=='boolean'))||new Set(patches.map(r=>r.id)).size!==patches.length)throw Error('Installed component selection invalid; preserved');
 const policy=JSON.parse(metadata(home,'profiles/desktop/pnpm-workspace.yaml',h));if(JSON.stringify(policy)!==JSON.stringify(POLICY))throw Error('Installed package policy mismatch; preserved');
 fs.accessSync(h.plain(home,'bin/lark-cli'),fs.constants.X_OK);
 return Object.keys(deps).length;
}
function sameSuiteComposition(r,m){
 return r&&r.version===m.version&&r.seedId===m.seedId&&JSON.stringify(r.products)===JSON.stringify(m.products.map(p=>({id:p.id,version:p.version})))&&JSON.stringify(r.localSources)===JSON.stringify(m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})))
}
// Same suite version, newer seed (e.g. rc44.1→rc44.2 market patch): refresh managed packages only.
function refreshManaged(kit,home,m,h,parseYaml,previous){
 const profile=path.join(home,'profiles/desktop'),seedProfile=path.join(kit,'seed/profiles/desktop');
 const optional=['@deepseek-ai/dsh-experimental-agent-team-profile','@deepseek-ai/dsh-experimental-voice-input-bundle','@deepseek-ai/dsh-experimental-auto-review','@deepseek-ai/dsh-experimental-schedule-bundle'];
 const pkg=json(path.join(profile,'package.json')),seedPkg=json(path.join(seedProfile,'package.json'));
 const keptOptional=(Array.isArray(pkg.dsh?.profile?.bundles)?pkg.dsh.profile.bundles:[]).filter(id=>optional.includes(id));
 for(const p of m.localSources){
  const dest=path.join(profile,'node_modules',p.id),src=path.join(seedProfile,'node_modules',p.id);
  fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(src,dest,{recursive:true,dereference:false});
  fs.copyFileSync(path.join(seedProfile,'.qcu-bundles',p.file),path.join(profile,'.qcu-bundles',p.file));
 }
 for(const name of fs.readdirSync(path.join(profile,'.qcu-bundles'))){
  if(!m.localSources.some(p=>p.file===name))fs.unlinkSync(path.join(profile,'.qcu-bundles',name));
 }
 pkg.dependencies=seedPkg.dependencies;
 const baseBundles=Array.isArray(seedPkg.dsh?.profile?.bundles)?seedPkg.dsh.profile.bundles.slice():[];
 pkg.dsh=pkg.dsh&&typeof pkg.dsh==='object'?pkg.dsh:{};pkg.dsh.profile=pkg.dsh.profile&&typeof pkg.dsh.profile==='object'?pkg.dsh.profile:{};
 pkg.dsh.profile.bundles=[...baseBundles,...keptOptional.filter(id=>!baseBundles.includes(id))];
 fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 const receipt={...previous,version:m.version,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),localSources:m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),refreshedAt:new Date().toISOString(),refreshedFromSeedId:previous.seedId||null};
 fs.writeFileSync(path.join(home,'qcu-teacher.json'),JSON.stringify(receipt,null,2)+'\n');
 const directDependencies=installed(home,m,h,parseYaml);
 return {home,result:'refreshed',products:m.products.length,directDependencies};
}
function prepare(kit,home,m,h,parseYaml=JSON.parse){
 const at=(stage,fn)=>{try{return fn()}catch(e){if(e&&typeof e==='object')e.incidentStage=stage;throw e}};
 at('release',()=>identity(m));at('data-path',()=>h.privatePath(home));at('seed',()=>verifySeed(kit,m,h));
 const receipt=path.join(home,'qcu-teacher.json');
 if(fs.existsSync(receipt)){
  const r=at('receipt',()=>JSON.parse(metadata(home,'qcu-teacher.json',h)));
  if(sameSuiteComposition(r,m)){const directDependencies=at('profile',()=>installed(home,m,h,parseYaml));return {home,result:'already-prepared',products:m.products.length,directDependencies}}
  // Preserve user workspace/config: only same suite version may refresh managed seed composition.
  if(r.version===m.version&&m.version==='0.1.0-rc.4.4')return at('profile',()=>refreshManaged(kit,home,m,h,parseYaml,r));
  throw releaseMismatch();
 }
 if(fs.existsSync(home))throw Error('Data directory already exists without a completed receipt; preserved');
 fs.mkdirSync(path.dirname(home),{recursive:true});const staging=fs.mkdtempSync(path.join(path.dirname(home),'.qcu-prepare-'));
 try{
  fs.cpSync(path.join(kit,'seed'),staging,{recursive:true,errorOnExist:true,force:false,dereference:false});
  for(const name of ['workspace','agents','electron'])fs.mkdirSync(path.join(staging,name),{recursive:true});
  const patch=path.join(staging,'profiles/desktop/cordis.patch.yml'),patches=json(patch);patches.find(r=>r.id==='qcu-feishu-readonly').config.cliPath=path.join(home,'bin/lark-cli');fs.writeFileSync(patch,JSON.stringify(patches,null,2)+'\n');
  installedSeed(staging,m,h);
  fs.writeFileSync(path.join(staging,'qcu-teacher.json'),JSON.stringify({version:m.version,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),localSources:m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),preparedAt:new Date().toISOString(),packageManagerInvoked:false},null,2)+'\n',{flag:'wx'});
  if(fs.existsSync(home))throw Error('Target became occupied; preserved');
  if(m.version==='0.1.0-rc.4.4'){const r=require('node:child_process').spawnSync(process.env.QCU_SUITE_LAUNCHER,['--commit-upgrade',staging,home],{stdio:'ignore',timeout:15000});if(r.error||r.status!==0)throw Error('Exclusive data commit failed')}else fs.renameSync(staging,home);return {home,result:'prepared',products:m.products.length,directDependencies:m.localSources.length};
 }catch(e){fs.rmSync(staging,{recursive:true,force:true});throw e}
}
module.exports={identity,prepare,installed,verifySeed};
