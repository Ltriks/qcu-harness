// Same-suite hotfix: replace only changed frozen components, preserve settings and extra installs.
'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function refresh(kit,home,m,h,parseYaml,previous){
 const allowed={
  'win-x64':new Set([
   '2d401583c171fae2233548d1646a050d7e199152d94f5e03b913777a1502e632', // original rc45
   'bc3b5fb1c9a3690d142554865abd48353b19b41a3bbfd42f051c25b9f325c630', // 0.1.0-rc.4.5.1
   'b7aac643416dc6a34bca5271651c2f05db3f269efb3a8784577de0dc994899c0', // 0.1.0-rc.4.5.2
   '07cf1e4fe8641a4cab6ee04dad7da07a3f9e8f0d080a66162455999ea3c5017e',
   'd210ed131bea07b5721652b1d60b77250892f884f8e5fd84ce55d597c9604bec'  // 0.1.0-rc.4.5.3
  ]),
  'mac-arm64':new Set([
   'b69fcd0a75b0addaac4858162024165e3643b97b71d6da8e54c2f179ec70fb37',
   'f9feb24888f14c717056df3cd762fbbcbfc291d55c7db6f8960d2171d2c8922a',
   'b914ee2aab20d6997c79ad443dff77d75aa448b53a951ed74d4c96c44e74318a',
   '818db928d410046501cbecb026e9ecb1e141b84232466af5745020fd2e7e5d1d',
   '462875a1d234af9c2bff3ea5d3af17d2b0b0e923dc6247875bf42c29ce1b81de'
  ])
 };
 if(!Object.hasOwn(allowed,m.target)||m.buildId!=='rc45.6'||previous.version!==m.version||!allowed[m.target].has(previous.seedId))throw Error('Unrecognized previous hotfix composition; preserved');
 const integrated=require('./integrated.cjs');integrated.installed(home,m,h,parseYaml);(h.assertPreviousStopped??require('./start.cjs').assertPreviousStopped)(home);
 const profile=path.join(home,'profiles/desktop'),seedProfile=path.join(kit,'seed/profiles/desktop'),pkgPath=path.join(profile,'package.json'),receiptPath=path.join(home,'qcu-teacher.json');
 const oldPkg=fs.readFileSync(pkgPath),oldReceipt=fs.readFileSync(receiptPath),pkg=JSON.parse(oldPkg),oldSources=new Map(previous.localSources.map(p=>[p.id,p]));
 const changed=m.localSources.filter(p=>oldSources.get(p.id)?.sha256!==p.sha256);
 if(changed.some(p=>!oldSources.has(p.id)||pkg.dependencies[p.id]!==oldSources.get(p.id).source))throw Error('Managed component was independently changed; preserved');
 if(changed.some(p=>!['qcu-market','qcu-branding'].includes(p.id)))throw Error('Unexpected hotfix component; preserved');
 const archiveRoot=path.join(profile,'.qcu-bundles');if(fs.lstatSync(archiveRoot).isSymbolicLink())throw Error('Unsafe archive directory; preserved');
 // Branding inventory drifts across 4.5.1/4.5.2 hotfixes; verify market strictly, branding by package.json identity only.
 for(const item of changed){
  if(item.id==='qcu-market'){
   const frozen=require('./rc451-previous-market.json');
   const root=fs.realpathSync(path.join(profile,'node_modules',item.id)),found=[];
   const walk=dir=>{for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Local component link changed; preserved');if(stat.isDirectory())walk(file);else if(stat.isFile())found.push(path.relative(root,file).split(path.sep).join('/'));else throw Error('Unsafe component entry')}};walk(root);
   if(found.sort().join()!==frozen.map(r=>r.path).sort().join())throw Error('Local component inventory changed; preserved');
   for(const row of frozen){const bytes=fs.readFileSync(h.plain(root,row.path));if(bytes.length!==row.bytes||h.sha(bytes)!==row.sha256)throw Error('Local component was edited; preserved')}
  }else{
   const root=fs.realpathSync(path.join(profile,'node_modules',item.id));
   const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
   if(pkg.name!=='qcu-branding'||typeof pkg.version!=='string')throw Error('Local branding identity changed; preserved');
  }
 }
 const area=path.join(home,'.qcu-hotfix-backups');h.privatePath(area);fs.mkdirSync(area,{recursive:true,mode:0o700});const backup=fs.mkdtempSync(path.join(area,'rc45.6-')),moved=[],added=[];
 fs.writeFileSync(path.join(backup,'package.json'),oldPkg,{mode:0o600});fs.writeFileSync(path.join(backup,'qcu-teacher.json'),oldReceipt,{mode:0o600});
 try{
  for(const p of changed){
   const stage=path.join(backup,'new-'+p.id),dest=path.join(profile,'node_modules',p.id),old=path.join(backup,'old-'+p.id);fs.cpSync(path.join(seedProfile,'node_modules',p.id),stage,{recursive:true,dereference:false});
   const archive=path.join(archiveRoot,p.file),bytes=fs.readFileSync(path.join(seedProfile,'.qcu-bundles',p.file));if(bytes.length!==p.bytes||h.sha(bytes)!==p.sha256)throw Error('New archive integrity failed');
   if(fs.existsSync(archive)){if(h.sha(fs.readFileSync(archive))!==p.sha256)throw Error('Immutable archive conflict')}else{fs.writeFileSync(archive,bytes,{flag:'wx',mode:0o600});added.push(archive)}
   fs.renameSync(dest,old);moved.push({dest,old});fs.renameSync(stage,dest);pkg.dependencies[p.id]=p.source;
  }
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');integrated.installed(home,m,h,parseYaml);
  const receipt={...previous,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),localSources:m.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),refreshedFromSeedId:previous.seedId,refreshedAt:new Date().toISOString(),build:m.buildId};
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');return {home,result:'refreshed',products:m.products.length,directDependencies:Object.keys(pkg.dependencies).length,updatedComponents:changed.map(p=>p.id),settingsPreserved:true};
 }catch(e){
  for(const p of moved.reverse()){fs.rmSync(p.dest,{recursive:true,force:true});fs.renameSync(p.old,p.dest)}for(const p of added)fs.unlinkSync(p);fs.writeFileSync(pkgPath,oldPkg);fs.writeFileSync(receiptPath,oldReceipt);throw e;
 }
};
