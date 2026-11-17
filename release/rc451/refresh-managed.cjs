// Same-suite hotfix: replace only changed frozen components, preserve settings and extra installs.
'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function refresh(kit,home,m,h,parseYaml,previous){
 const allowed={
  'win-x64':'2d401583c171fae2233548d1646a050d7e199152d94f5e03b913777a1502e632',
  'mac-arm64':'b69fcd0a75b0addaac4858162024165e3643b97b71d6da8e54c2f179ec70fb37'
 };
 if(!Object.hasOwn(allowed,m.target)||m.buildId!=='rc45.2'||previous.version!==m.version||previous.seedId!==allowed[m.target])throw Error('Unrecognized previous hotfix composition; preserved');
 const integrated=require('./integrated.cjs');integrated.installed(home,m,h,parseYaml);(h.assertPreviousStopped??require('./start.cjs').assertPreviousStopped)(home);
 const profile=path.join(home,'profiles/desktop'),seedProfile=path.join(kit,'seed/profiles/desktop'),pkgPath=path.join(profile,'package.json'),receiptPath=path.join(home,'qcu-teacher.json');
 const oldPkg=fs.readFileSync(pkgPath),oldReceipt=fs.readFileSync(receiptPath),pkg=JSON.parse(oldPkg),oldSources=new Map(previous.localSources.map(p=>[p.id,p]));
 const changed=m.localSources.filter(p=>oldSources.get(p.id)?.sha256!==p.sha256);
 if(changed.some(p=>!oldSources.has(p.id)||pkg.dependencies[p.id]!==oldSources.get(p.id).source))throw Error('Managed component was independently changed; preserved');
 const archiveRoot=path.join(profile,'.qcu-bundles');if(fs.lstatSync(archiveRoot).isSymbolicLink())throw Error('Unsafe archive directory; preserved');
 const frozen=require('./rc451-previous-market.json');
 for(const item of changed){
  if(item.id!=='qcu-market')throw Error('Unexpected hotfix component; preserved');
  const root=fs.realpathSync(path.join(profile,'node_modules',item.id)),found=[];
  const walk=dir=>{for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Local component link changed; preserved');if(stat.isDirectory())walk(file);else if(stat.isFile())found.push(path.relative(root,file).split(path.sep).join('/'));else throw Error('Unsafe component entry')}};walk(root);
  if(found.sort().join()!==frozen.map(r=>r.path).sort().join())throw Error('Local component inventory changed; preserved');
  for(const row of frozen){const bytes=fs.readFileSync(h.plain(root,row.path));if(bytes.length!==row.bytes||h.sha(bytes)!==row.sha256)throw Error('Local component was edited; preserved')}
 }
 const area=path.join(home,'.qcu-hotfix-backups');h.privatePath(area);fs.mkdirSync(area,{recursive:true,mode:0o700});const backup=fs.mkdtempSync(path.join(area,'rc45.2-')),moved=[],added=[];
 fs.writeFileSync(path.join(backup,'package.json'),oldPkg,{mode:0o600});fs.writeFileSync(path.join(backup,'qcu-teacher.json'),oldReceipt,{mode:0o600});
 try{
  for(const p of changed){
   const stage=path.join(backup,'new-'+p.id),dest=path.join(profile,'node_modules',p.id),old=path.join(backup,'old-'+p.id);fs.cpSync(path.join(seedProfile,'node_modules',p.id),stage,{recursive:true,dereference:false});
   const archive=path.join(archiveRoot,p.file),bytes=fs.readFileSync(path.join(seedProfile,'.qcu-bundles',p.file));if(bytes.length!==p.bytes||h.sha(bytes)!==p.sha256)throw Error('New archive integrity failed');
   if(fs.existsSync(archive)){if(h.sha(fs.readFileSync(archive))!==p.sha256)throw Error('Immutable archive conflict')}else{fs.writeFileSync(archive,bytes,{flag:'wx',mode:0o600});added.push(archive)}
   fs.renameSync(dest,old);moved.push({dest,old});fs.renameSync(stage,dest);pkg.dependencies[p.id]=p.source;
  }
  // Model config, selection, plugins, user archives and all non-managed dependencies stay byte-identical.
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');integrated.installed(home,m,h,parseYaml);
  const receipt={...previous,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),localSources:m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),refreshedFromSeedId:previous.seedId,refreshedAt:new Date().toISOString(),build:m.buildId};
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');return {home,result:'refreshed',products:m.products.length,directDependencies:Object.keys(pkg.dependencies).length,updatedComponents:changed.map(p=>p.id),settingsPreserved:true};
 }catch(e){
  for(const p of moved.reverse()){fs.rmSync(p.dest,{recursive:true,force:true});fs.renameSync(p.old,p.dest)}for(const p of added)fs.unlinkSync(p);fs.writeFileSync(pkgPath,oldPkg);fs.writeFileSync(receiptPath,oldReceipt);throw e;
 }
};
