/* MIT. Runs with the unmodified official Desktop's bundled Electron/Node. */
'use strict';
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const SUITE='0.1.0-rc.1';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
function safeRelative(name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(name)||name.includes(':'))throw Error('Invalid release path');
 return name;
}
async function fileHash(file){const h=crypto.createHash('sha256');for await(const data of fs.createReadStream(file))h.update(data);return h.digest('hex')}
function plainPath(root,name){let file=root;for(const part of safeRelative(name).split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Release links are not permitted: '+name)}return file}
async function verifyKit(kit){
 const file=path.join(kit,'manifest.json');if(fs.lstatSync(file).isSymbolicLink())throw Error('Manifest must be a regular file');
 const raw=fs.readFileSync(file),m=JSON.parse(raw);
 if(m.schemaVersion!==1||m.suiteVersion!==SUITE||m.dshVersion!=='0.2.0-rc.2'||m.products.length!==10)throw Error('Unexpected release identity');
 if(new Set(m.products.map(p=>p.id)).size!==10||m.products.some(p=>!/^qcu-[a-z0-9-]+$/.test(p.id)))throw Error('Invalid product identities');
 const target=process.platform==='darwin'&&process.arch==='arm64'?'mac-arm64':process.platform==='win32'&&process.arch==='x64'?'win-x64':null;
 if(m.target!==target)throw Error('This package requires '+m.target+'; current runtime is '+process.platform+'-'+process.arch);
 const seen=new Set();for(const r of m.files){
  if(seen.has(r.path)||!Number.isSafeInteger(r.bytes)||r.bytes<0||!/^[a-f0-9]{64}$/.test(r.sha256))throw Error('Invalid file record');seen.add(r.path);
  const p=plainPath(kit,r.path),stat=fs.statSync(p);
  if(!stat.isFile()||stat.size!==r.bytes||await fileHash(p)!==r.sha256)throw Error('Release integrity failed: '+r.path);
 }
 for(const p of m.products){if(!seen.has(p.path))throw Error('Missing bundle record: '+p.id)}
 if(!seen.has(m.lark.path))throw Error('Missing native CLI record');
 return {manifest:m,digest:hash(raw)};
}
function defaultHome(){return process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'QCU-DSH','offline',SUITE):path.join(os.homedir(),'Library','Application Support','QCU-DSH','offline',SUITE)}
async function runtime(resources){
 const req=createRequire(path.join(resources,'app.asar','dsh','package.json'));
 const load=name=>import(pathToFileURL(req.resolve(name)));
 const version=json(req.resolve('@deepseek-ai/dsh/package.json')).version;
 if(version!=='0.2.0-rc.2')throw Error('Requires official DSH 0.2.0-rc.2, found '+version);
 const boot=await load('@deepseek-ai/dsh-app-boot');
 const operations=await load('@deepseek-ai/dsh-plugin-manager/operations');
 const atomic=await load('@deepseek-ai/dsh-atomic-write');
 return {req,load,boot,operations,atomic,anchor:req.resolve('@deepseek-ai/dsh/package.json')};
}
function ensurePrivateHome(home){
 if(!path.isAbsolute(home)||home===path.parse(home).root||home===os.homedir())throw Error('Choose a separate QCU data directory');
 let p=home;while(p!==path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Data directory must not use symbolic links');p=path.dirname(p)}
 if(fs.existsSync(home)&&fs.readdirSync(home).length)throw Error('Data directory is not empty; existing files were preserved');
 fs.mkdirSync(home,{recursive:true,mode:0o700});
}
function installedVersions(home,m){
 return m.products.map(p=>{const file=path.join(home,'profiles','desktop','node_modules',p.id,'package.json');const v=json(file);if(v.name!==p.id||v.version!==p.version)throw Error('Installed version mismatch: '+p.id);return {id:p.id,version:v.version}});
}
function shellQuote(s){return "'"+s.replace(/'/g,"'\\''")+"'"}
function launcher(home,resources){
 const executable=process.platform==='win32'?path.join(resources,'..','DeepSeek Harness.exe'):path.join(resources,'..','MacOS','DeepSeek Harness');
 if(process.platform==='win32'){
  const e=s=>s.replace(/%/g,'%%');
  const text='@echo off\r\nsetlocal\r\nset "DSH_HOME='+e(home)+'"\r\nset "ELECTRON_RUN_AS_NODE="\r\nset "NODE_OPTIONS="\r\ntasklist /FI "IMAGENAME eq DeepSeek Harness.exe" /NH 2>nul | find /I "DeepSeek Harness.exe" >nul\r\nif not errorlevel 1 (echo Please fully quit DeepSeek Harness before starting QCU DSH.& pause& exit /b 1)\r\nstart "" "'+e(executable)+'" "--user-data-dir='+e(path.join(home,'electron'))+'"\r\n';
  fs.writeFileSync(path.join(home,'Start-QCU-DSH.cmd'),text,{flag:'wx'});
 }else{
  const text='#!/bin/bash\nset -e\nexport DSH_HOME='+shellQuote(home)+'\nunset ELECTRON_RUN_AS_NODE NODE_OPTIONS\nif /usr/bin/pgrep -f '+shellQuote('/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness')+' >/dev/null; then\n echo "请先正常退出已有 DSH，再启动城院环境。"; read -r -p "回车关闭" _; exit 1\nfi\nexec '+shellQuote(executable)+' '+shellQuote('--user-data-dir='+path.join(home,'electron'))+'\n';
  fs.writeFileSync(path.join(home,'Start-QCU-DSH.command'),text,{mode:0o700,flag:'wx'});
 }
}
async function install(kit,home,resources,verified){
 const {manifest:m,digest}=verified;
 if(fs.existsSync(path.join(home,'qcu-offline-install.json'))){const r=json(path.join(home,'qcu-offline-install.json'));if(r.manifestSha256!==digest)throw Error('Existing installation belongs to another kit; preserved');installedVersions(home,m);return {...r,result:'already-installed'};}
 ensurePrivateHome(home);const lock=path.join(home,'.qcu-install.lock');const fd=fs.openSync(lock,'wx',0o600);
 try{
  process.env.DSH_HOME=home;
  const api=await runtime(resources),dir=path.join(home,'profiles','desktop');
  const packageDir=path.join(home,'packages');fs.mkdirSync(packageDir,{mode:0o700});
  const specs=[];for(const p of m.products){const dest=path.join(packageDir,path.basename(p.path));fs.copyFileSync(plainPath(kit,p.path),dest,fs.constants.COPYFILE_EXCL);if(await fileHash(dest)!==p.sha256)throw Error('Copied bundle changed');specs.push(dest)}
  const binDir=path.join(home,'bin');fs.mkdirSync(binDir,{mode:0o700});
  const binary=path.join(binDir,process.platform==='win32'?'lark-cli.exe':'lark-cli');fs.copyFileSync(plainPath(kit,m.lark.path),binary,fs.constants.COPYFILE_EXCL);fs.chmodSync(binary,0o700);
  api.boot.initProfile(dir,api.boot.PROFILE_TEMPLATES.web.bundles);
  fs.writeFileSync(path.join(dir,'cordis.yml'),'[]\n',{mode:0o600,flag:'wx'});
  const configDir=path.join(home,'installer-config');fs.mkdirSync(configDir,{mode:0o700});
  const config=path.join(configDir,'empty.npmrc');fs.writeFileSync(config,'',{mode:0o600});
  const store=path.join(home,'cache','pnpm-store');
  const environment={...process.env,ELECTRON_RUN_AS_NODE:'1',DSH_DESKTOP_NODE_EXECUTABLE:process.execPath,NODE_OPTIONS:'',npm_config_userconfig:config,npm_config_globalconfig:config,npm_config_offline:'true',npm_config_ignore_scripts:'true',npm_config_registry:'http://127.0.0.1:9/',XDG_CONFIG_HOME:configDir};
  const pnpmArgs=['--expose-internals',...(process.env.QCU_OFFLINE_TEST_PRELOAD?['--require',process.env.QCU_OFFLINE_TEST_PRELOAD]:[]),path.join(resources,'runtime','pnpm','bin','pnpm.mjs')];
  const result=await api.atomic.withFileLock(path.join(dir,'package.json'),()=>api.operations.runProfilePnpm({profile:'desktop',dir,home,installAnchor:api.anchor,cwd:home},['add',...specs,'--offline','--ignore-scripts','--reporter=append-only','--registry=http://127.0.0.1:9/','--store-dir='+store],{command:process.execPath,args:pnpmArgs,env:environment,execution:'cli',outputBytes:16384,onOutput:(text,stream)=>process[stream].write(text)}),{waitMs:1000});
  if(result.exitCode!==0)throw Error('Official offline installation failed; diagnostics remain in '+dir);
  const versions=installedVersions(home,m);
  api.boot.writeProfileBundles(dir,api.boot.readProfileManifest('dsh',dir),api.boot.PROFILE_TEMPLATES.web.bundles);
  const patches=m.products.map(p=>({id:p.componentId,disabled:true,...p.id==='qcu-feishu-readonly'?{config:{cliPath:binary,documentUrl:''}}:{}}));
  fs.writeFileSync(path.join(dir,'cordis.patch.yml'),JSON.stringify(patches,null,2)+'\n',{mode:0o600});
  launcher(home,resources);
  const receipt={schemaVersion:1,suiteVersion:SUITE,manifestSha256:digest,dshVersion:m.dshVersion,target:m.target,products:versions,teachingEnabled:false,installedAt:new Date().toISOString(),home,resources,offlinePackageInstall:true,testNetworkGuard:globalThis.QCU_OFFLINE_NETWORK_GUARD===true};
  writeJson(path.join(home,'qcu-offline-install.json'),receipt);return {...receipt,result:'installed'};
 }finally{fs.closeSync(fd);fs.unlinkSync(lock)}
}
async function activate(home,resources,verified){
 const {manifest:m,digest}=verified;const receiptFile=path.join(home,'qcu-offline-install.json'),receipt=json(receiptFile);
 if(receipt.manifestSha256!==digest)throw Error('Kit and installed receipt differ');installedVersions(home,m);
 if(receipt.teachingEnabled)return {...receipt,result:'already-enabled'};
 process.env.DSH_HOME=home;const api=await runtime(resources),dir=path.join(home,'profiles','desktop');
 await api.atomic.withFileLock(path.join(dir,'package.json'),async()=>{
  const yaml=api.req('yaml'),file=path.join(dir,'cordis.patch.yml'),doc=yaml.parseDocument(fs.readFileSync(file,'utf8'));
  if(doc.errors.length||!yaml.isSeq(doc.contents))throw Error('Profile patch is not a supported sequence; preserved');
  const chosen=m.products.filter(p=>p.teachingPreset);
  for(const p of chosen)doc.add({id:p.componentId,disabled:false});
  await api.atomic.writeFileAtomic(file,String(doc),{mode:0o600});
  api.boot.writeProfileBundles(dir,api.boot.readProfileManifest('dsh',dir),[...api.boot.PROFILE_TEMPLATES.web.bundles,...chosen.map(p=>p.id)]);
  receipt.teachingEnabled=true;await api.atomic.writeFileAtomic(receiptFile,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 },{waitMs:1000});
 return {...receipt,result:'teaching-enabled'};
}
async function main(){
 const args=process.argv.slice(2),action=args.shift();const options={};
 while(args.length){const key=args.shift();if(!['--kit','--home','--resources'].includes(key)||!args.length)throw Error('Invalid arguments');options[key.slice(2)]=path.resolve(args.shift())}
 if(!['verify','install','activate','status'].includes(action))throw Error('Use verify, install, activate or status');
 const kit=options.kit||path.resolve(__dirname,'..'),home=options.home||defaultHome();
 const v=await verifyKit(kit);let result;
 if(action==='verify')result={result:'verified',target:v.manifest.target,products:v.manifest.products.length};
 else if(action==='status'){const receipt=json(path.join(home,'qcu-offline-install.json'));installedVersions(home,v.manifest);result=receipt;}
 else {if(!options.resources)throw Error('An installed official DSH resources directory is required');result=await(action==='install'?install(kit,home,options.resources,v):activate(home,options.resources,v));}
 console.log('QCU_OFFLINE_RESULT:'+JSON.stringify(result));
}
module.exports={safeRelative,fileHash,verifyKit,defaultHome,installedVersions,install,activate,runtime};
if(require.main===module)main().catch(e=>{console.error('QCU_OFFLINE_ERROR: '+e.message);process.exitCode=1});
