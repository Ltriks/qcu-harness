'use strict';
// Only the rc4 whole-suite seed. Legacy rc2/rc3 preparation stays in start.cjs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const VERSION='0.1.0-rc.4';
const IDS=['qcu-study-coach','qcu-lesson-planning','qcu-tiered-practice','qcu-note-organizer','qcu-reading-outline','qcu-integrity-guard','qcu-team-briefing','qcu-feishu-readonly','qcu-course-workbench','qcu-market','qcu-expert-teams','qcu-branding'];
function identity(m){
 const sources=m.localSources;
 if(m.version!==VERSION||m.target!=='mac-arm64'||m.products?.length!==11||m.branding?.version!=='0.2.2'||m.migrateFrom||!Array.isArray(sources)||sources.length!==12||new Set(sources.map(p=>p.id)).size!==12||IDS.some(id=>!sources.some(p=>p.id===id))||sha(Buffer.from(JSON.stringify(m.seedFiles)))!==m.seedId)throw Error('Unexpected integrated teacher release');
 if(new Set(m.products.map(p=>p.id)).size!==11||IDS.filter(id=>id!=='qcu-branding').some(id=>!m.products.some(p=>p.id===id&&p.version===sources.find(s=>s.id===id).version)))throw Error('Unexpected integrated product selection');
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
 if(!Array.isArray(bundles)||new Set(bundles).size!==bundles.length||bundles.some(id=>!native.includes(id)&&!Object.hasOwn(deps,id))||!native.every(id=>bundles.includes(id)))throw Error('Installed bundle selection invalid; preserved');
 const patches=parseYaml(metadata(home,'profiles/desktop/cordis.patch.yml',h)),base=parseYaml(metadata(home,'profiles/desktop/cordis.yml',h));
 if(!Array.isArray(base)||!Array.isArray(patches)||patches.some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||('disabled'in r&&typeof r.disabled!=='boolean'))||new Set(patches.map(r=>r.id)).size!==patches.length)throw Error('Installed component selection invalid; preserved');
 const policy=JSON.parse(metadata(home,'profiles/desktop/pnpm-workspace.yaml',h));if(JSON.stringify(policy)!==JSON.stringify(POLICY))throw Error('Installed package policy mismatch; preserved');
 fs.accessSync(h.plain(home,'bin/lark-cli'),fs.constants.X_OK);
 return Object.keys(deps).length;
}
function prepare(kit,home,m,h,parseYaml=JSON.parse){
 identity(m);h.privatePath(home);verifySeed(kit,m,h);
 const receipt=path.join(home,'qcu-teacher.json');
 if(fs.existsSync(receipt)){
  const r=JSON.parse(metadata(home,'qcu-teacher.json',h));
  if(r.version!==m.version||r.seedId!==m.seedId||JSON.stringify(r.products)!==JSON.stringify(m.products.map(p=>({id:p.id,version:p.version})))||JSON.stringify(r.localSources)!==JSON.stringify(m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256}))))throw Error('Existing integrated receipt mismatch; preserved');
  const directDependencies=installed(home,m,h,parseYaml);return {home,result:'already-prepared',products:11,directDependencies};
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
  fs.renameSync(staging,home);return {home,result:'prepared',products:11,directDependencies:12};
 }catch(e){fs.rmSync(staging,{recursive:true,force:true});throw e}
}
module.exports={identity,prepare,installed,verifySeed};
