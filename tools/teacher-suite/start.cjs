'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const VERSION='0.1.0-rc.2';
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function relative(value){if(typeof value!=='string'||!value||value.includes('\\')||value.includes(':')||value.split('/').some(p=>!p||p==='..'||p==='.')||path.isAbsolute(value))throw Error('Invalid release path');return value}
function plain(root,name){let p=root;for(const part of relative(name).split('/')){p=path.join(p,part);if(fs.lstatSync(p).isSymbolicLink())throw Error('Release links are not supported')}if(!fs.statSync(p).isFile())throw Error('Missing release file');return p}
function privatePath(home){if(!path.isAbsolute(home)||home===path.parse(home).root||home===os.homedir())throw Error('Choose a separate data directory');let p=home;while(p!==path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Data path uses a link');p=path.dirname(p)}}
function defaultHome(version=VERSION){return process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/QCU-DSH/teacher',version):path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'QCU-DSH','teacher',version)}
function identity(kit){const m=readJson(plain(kit,'support/manifest.json'));if(m.version==='0.1.0-rc.4')return require('./integrated.cjs').identity(m);if(![VERSION,'0.1.0-rc.3'].includes(m.version)||!['win-x64','mac-arm64'].includes(m.target)||m.products.length!==9||new Set(m.products.map(p=>p.id)).size!==9||m.products.some(p=>p.id==='qcu-market'||!/^qcu-[a-z0-9-]+$/.test(p.id))||(m.version==='0.1.0-rc.3'&&m.branding?.id!=='qcu-branding'))throw Error('Unexpected teacher release');return m}
function installed(home,m){const profile=path.join(home,'profiles/desktop');for(const p of m.products){const v=readJson(path.join(profile,'node_modules',p.id,'package.json'));if(v.name!==p.id||v.version!==p.version)throw Error('Installed product mismatch: '+p.id)}if(fs.existsSync(path.join(profile,'node_modules/qcu-market')))throw Error('Teacher profile unexpectedly contains market');if(m.target==='mac-arm64')fs.accessSync(path.join(home,'bin/lark-cli'),fs.constants.X_OK)}
function seedMembers(kit){const found=[];function walk(dir){if(fs.lstatSync(dir).isSymbolicLink())throw Error('Release links are not supported');for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isSymbolicLink())throw Error('Release links are not supported');if(s.isDirectory())walk(p);else if(s.isFile())found.push(path.relative(kit,p).split(path.sep).join('/'));else throw Error('Unexpected release member')}}walk(path.join(kit,'seed'));return found.sort()}
function brandingInstalled(home,m){if(m.branding){const p=readJson(path.join(home,'profiles/desktop/node_modules/qcu-branding/package.json'));if(p.name!=='qcu-branding'||p.version!==m.branding.version)throw Error('Branding component mismatch')}}
// Chromium caches and process locks are recreated, not teacher settings or work.
// Apply this before inspecting/copying so locked cache contents are never opened.
const transientElectronPaths=['Cache','Code Cache','GPUCache','ShaderCache','GrShaderCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','Crash Reports','Service Worker/CacheStorage','Service Worker/ScriptCache','SingletonLock','SingletonCookie','SingletonSocket','lockfile','LOCK'].map(p=>p.toLowerCase());
function migrationIncluded(previousHome,source){
 const rel=path.relative(previousHome,source).split(path.sep).join('/').toLowerCase();
 return !['electron/','electron/default/'].some(prefix=>rel.startsWith(prefix)&&transientElectronPaths.some(name=>rel===prefix+name||rel.startsWith(prefix+name+'/')));
}
function assertPreviousStopped(previousHome){
 if(process.platform!=='win32')return;
 // Inspect only local process command lines, returning an exit status, never their contents.
 const script=`$ErrorActionPreference='Stop';$p=$env:QCU_TEACHER_PREVIOUS_ELECTRON.TrimEnd('\\');$rx='(?i)--user-data-dir="?'+[regex]::Escape($p)+'(?=["\\s]|$)';$running=@(Get-CimInstance Win32_Process -Filter "Name = 'DeepSeek Harness.exe'" | Where-Object {$_.CommandLine -match $rx});if($running.Count){exit 23};exit 0`;
 const result=require('node:child_process').spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:15000,stdio:'ignore',env:{...process.env,QCU_TEACHER_PREVIOUS_ELECTRON:path.join(previousHome,'electron')}});
 if(result.status===23){const error=Error('旧版城院助手仍在运行。请先保存工作，并在旧版中正常退出（包括托盘中的后台实例），再双击QCU助手。已有配置和文件会保留。');error.code='QCU_PREVIOUS_RUNNING';throw error}
 if(result.error||result.status!==0)throw Error('暂时无法确认旧版是否已退出。请先保存并正常退出旧版城院助手，再重试；若仍出现此提示，请联系维护人员。已有数据未改动。');
}
function prepare(kit,home,previousHome,parseYaml=JSON.parse){
 const m=identity(kit);privatePath(home);
 if(m.version==='0.1.0-rc.4'){if(previousHome)throw Error('Integrated release requires explicit maintainer migration');return require('./integrated.cjs').prepare(kit,home,m,{plain,privatePath,seedMembers,sha},parseYaml)}
 const receipt=path.join(home,'qcu-teacher.json');
 if(fs.existsSync(receipt)){const r=readJson(receipt);if(r.version!==m.version||r.seedId!==m.seedId)throw Error('Existing data belongs to another teacher release; preserved');installed(home,m);brandingInstalled(home,m);return {home,result:'already-prepared',products:9}}
 if(fs.existsSync(home))throw Error('Data directory already exists without a completed receipt; preserved');
 if(JSON.stringify(seedMembers(kit))!==JSON.stringify(m.seedFiles.map(r=>r.path).sort()))throw Error('Seed file inventory differs from release');
 for(const r of m.seedFiles){const p=plain(kit,r.path),data=fs.readFileSync(p);if(data.length!==r.bytes||sha(data)!==r.sha256)throw Error('Release integrity failed: '+r.path)}
 const parent=path.dirname(home);fs.mkdirSync(parent,{recursive:true});
 const staging=fs.mkdtempSync(path.join(parent,'.qcu-prepare-'));
 let copyingPrevious=false;
 try{
  let migrated=false;
  if(previousHome&&fs.existsSync(previousHome)){
   privatePath(previousHome);const old=readJson(path.join(previousHome,'qcu-teacher.json'));
   if(!m.migrateFrom||old.version!==m.migrateFrom.version||old.seedId!==m.migrateFrom.seedId)throw Error('Previous data does not match this upgrade; preserved');
   installed(previousHome,m);
   copyingPrevious=true;
   // Never follow user-created links while copying private data to a new version.
   const inspect=dir=>{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(!migrationIncluded(previousHome,p))continue;const s=fs.lstatSync(p);if(s.isSymbolicLink())throw Error('Previous data uses a link; preserved');if(s.isDirectory())inspect(p)}};inspect(previousHome);
   if(fs.existsSync(path.join(previousHome,'profiles/desktop/node_modules/qcu-branding')))throw Error('Previous branding namespace is occupied; preserved');
   fs.cpSync(previousHome,staging,{recursive:true,dereference:false,filter:source=>migrationIncluded(previousHome,source)});
   fs.cpSync(path.join(kit,'seed/profiles/desktop/node_modules/qcu-branding'),path.join(staging,'profiles/desktop/node_modules/qcu-branding'),{recursive:true});
   const file=path.join(staging,'profiles/desktop/package.json'),pkg=readJson(file);
   pkg.dependencies={...pkg.dependencies,'qcu-branding':m.branding.version};
   if(!Array.isArray(pkg.dsh?.profile?.bundles))throw Error('Previous profile has no bundle list; preserved');
   pkg.dsh.profile.bundles=[...pkg.dsh.profile.bundles.filter(x=>x!=='qcu-branding'),'qcu-branding'];
   fs.writeFileSync(file,JSON.stringify(pkg,null,2)+'\n');migrated=true;
  }else fs.cpSync(path.join(kit,'seed'),staging,{recursive:true,errorOnExist:true,force:false,dereference:false});
  for(const name of ['workspace','agents','electron'])fs.mkdirSync(path.join(staging,name),{recursive:true});
  const patchFile=path.join(staging,'profiles/desktop/cordis.patch.yml');const patches=migrated?parseYaml(fs.readFileSync(patchFile,'utf8')):readJson(patchFile);
  if(!Array.isArray(patches))throw Error('Unsupported previous profile patch; preserved');
  if(m.branding){let row=patches.find(p=>p.id==='ui-brand-official');if(!row){row={id:'ui-brand-official'};patches.push(row)}row.disabled=true}
  const feishu=patches.find(p=>p.id==='qcu-feishu-readonly'),native=m.target==='mac-arm64'?'lark-cli':'lark-cli.exe';
  if(feishu?.config&&(!migrated||feishu.config.cliPath===path.join(previousHome,'bin',native)))feishu.config.cliPath=path.join(home,'bin',native);
  fs.writeFileSync(patchFile,JSON.stringify(patches,null,2)+'\n');
  installed(staging,m);brandingInstalled(staging,m);
  fs.writeFileSync(path.join(staging,'qcu-teacher.json'),JSON.stringify({version:m.version,seedId:m.seedId,products:m.products.map(p=>({id:p.id,version:p.version})),preparedAt:new Date().toISOString(),packageManagerInvoked:false,...(migrated?{migratedFrom:previousHome}:{})},null,2)+'\n',{flag:migrated?'w':'wx'});
  fs.renameSync(staging,home);
  return {home,result:'prepared',products:9,...(migrated?{migratedFrom:previousHome}:{})};
 }catch(e){
  // A Windows lock can also prevent cleanup; preserve the original cause.
  try{fs.rmSync(staging,{recursive:true,force:true})}catch(cleanupError){e.cleanupError=cleanupError}
  if(copyingPrevious&&['EACCES','EPERM','EBUSY'].includes(e.code)){
   const message='升级时有文件被占用或无法读取。请先保存工作，并正常退出旧版城院助手后重试；若仍失败，请联系维护人员。旧版配置和工作文件保持不变。';
   const error=new Error(message,{cause:e});error.code=e.code;throw error;
  }
  throw e;
 }
}
module.exports={relative,prepare,defaultHome,identity,assertPreviousStopped};
if(require.main===module){try{const args=process.argv.slice(2);if(args[0]!=='prepare'||args[1]!=='--kit'||!args[2]||args.length!==3)throw Error('Invalid launch arguments');const kit=path.resolve(args[2]),m=identity(kit),target=m.target;if(!((target==='win-x64'&&process.platform==='win32'&&process.arch==='x64')||(target==='mac-arm64'&&process.platform==='darwin'&&process.arch==='arm64')))throw Error('Runtime does not match teacher release');const testing=process.env.QCU_TEACHER_TEST_HOME,home=testing?path.resolve(testing):defaultHome(m.version),previous=!testing&&m.migrateFrom?defaultHome(m.migrateFrom.version):undefined;let yaml=JSON.parse;if(m.version==='0.1.0-rc.4'||(previous&&fs.existsSync(previous))){if(previous&&!fs.existsSync(path.join(home,'qcu-teacher.json')))assertPreviousStopped(previous);const resources=target==='mac-arm64'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');yaml=require('node:module').createRequire(path.join(resources,'app.asar/dsh/package.json'))('js-yaml').load}const result=prepare(kit,home,previous,yaml);console.log('QCU_TEACHER_RESULT:'+JSON.stringify(result));console.log('QCU_TEACHER_HOME:'+result.home)}catch(e){console.error('QCU_TEACHER_ERROR: '+e.message);process.exitCode=1}}
