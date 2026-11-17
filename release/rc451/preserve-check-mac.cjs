'use strict';
// Isolated Mac hotfix preserve check. Never touches the real teacher Home.
// Must run under bundled Electron: ELECTRON_RUN_AS_NODE=1 "<DeepSeek Harness>" this.js <stage> <oldKit>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const stage=path.resolve(process.argv[2]),app=path.join(stage,'QCU助手.app'),kit=path.join(app,'Contents/Resources');
 const oldKit=path.resolve(process.argv[3]),support=path.join(kit,'support'),h=require(path.join(support,'start.cjs'));
 const resources=path.join(kit,'program/DeepSeek Harness.app/Contents/Resources');
 const api=await require(path.join(support,'offline.cjs')).runtime(resources),yaml=api.req('js-yaml').load;
 const info=require('child_process').execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleExecutable',path.join(app,'Contents/Info.plist')],{encoding:'utf8'}).trim();
 const launcher=path.join(app,'Contents/MacOS',info);
 const temp=fs.mkdtempSync(path.join(path.resolve(stage,'..'),'qcu-mac-hotfix-preserve-'));
 try{
  process.env.QCU_SUITE_LAUNCHER=launcher;
  const home=path.join(temp,'previous');process.env.QCU_TEACHER_TEST_HOME=home;
  const m=h.identity(kit);
  assert.equal(m.buildId,'rc45.2');
  assert.equal(m.target,'mac-arm64');
  assert.equal(h.prepare(kit,home,undefined,yaml).result,'prepared');
  const previousMarket=JSON.parse(fs.readFileSync(path.join(support,'rc451-previous-market.json'),'utf8'));
  const previousSeed='b69fcd0a75b0addaac4858162024165e3643b97b71d6da8e54c2f179ec70fb37';
  const profile=path.join(home,'profiles/desktop');
  const marketRoot=path.join(profile,'node_modules/qcu-market');
  const oldMarket=path.join(oldKit,'seed/profiles/desktop/node_modules/qcu-market');
  const oldBundleDir=path.join(oldKit,'seed/profiles/desktop/.qcu-bundles');
  const oldManifest=JSON.parse(fs.readFileSync(path.join(oldKit,'support/manifest.json'),'utf8'));
  const oldMarketRow=oldManifest.localSources.find(r=>r.id==='qcu-market');
  assert.equal(oldMarketRow.version,'0.1.0-pilot.16.14');
  fs.rmSync(marketRoot,{recursive:true,force:true});
  fs.cpSync(oldMarket,marketRoot,{recursive:true});
  const pkgPath=path.join(profile,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgPath));
  pkg.dependencies['qcu-market']=oldMarketRow.source;
  const archiveRoot=path.join(profile,'.qcu-bundles');
  for(const name of fs.readdirSync(archiveRoot)){
   if(name.startsWith('qcu-market-')&&name!==oldMarketRow.file)fs.unlinkSync(path.join(archiveRoot,name));
  }
  if(!fs.existsSync(path.join(archiveRoot,oldMarketRow.file)))fs.copyFileSync(path.join(oldBundleDir,oldMarketRow.file),path.join(archiveRoot,oldMarketRow.file));
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  const receipt={
   version:m.version,seedId:previousSeed,
   products:oldManifest.products.map(p=>({id:p.id,version:p.version})),
   localSources:oldManifest.localSources.map(p=>({id:p.id,source:p.source,sha256:p.sha256})),
   preparedAt:new Date().toISOString(),packageManagerInvoked:false
  };
  fs.writeFileSync(path.join(home,'qcu-teacher.json'),JSON.stringify(receipt,null,2)+'\n');
  const found=[];
  const walk=dir=>{for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),stat=fs.lstatSync(file);if(stat.isDirectory())walk(file);else if(stat.isFile())found.push(path.relative(marketRoot,file).split(path.sep).join('/'))}};
  walk(marketRoot);
  assert.deepEqual(found.sort(),previousMarket.map(r=>r.path).sort());
  const patch=path.join(profile,'cordis.patch.yml');
  fs.appendFileSync(patch,'\n# synthetic user setting to preserve\n');
  const beforePatch=fs.readFileSync(patch);
  pkg.dependencies['qcu-user-test']='0.1.0';
  const extra=path.join(profile,'node_modules/qcu-user-test');fs.mkdirSync(extra);
  fs.writeFileSync(path.join(extra,'package.json'),JSON.stringify({name:'qcu-user-test',version:'0.1.0'}));
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  fs.mkdirSync(path.join(home,'workspace'),{recursive:true});
  fs.writeFileSync(path.join(home,'workspace/synthetic-note.txt'),'retained');
  const initial=path.join(temp,'initial');fs.cpSync(home,initial,{recursive:true});
  assert.equal(h.prepare(kit,home,undefined,yaml).result,'refreshed');
  assert.equal(h.prepare(kit,home,undefined,yaml).result,'already-prepared');
  assert.deepEqual(fs.readFileSync(patch),beforePatch);
  assert.equal(JSON.parse(fs.readFileSync(pkgPath)).dependencies['qcu-user-test'],'0.1.0');
  assert.equal(fs.readFileSync(path.join(home,'workspace/synthetic-note.txt'),'utf8'),'retained');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'node_modules/qcu-market/package.json'))).version,'0.1.0-pilot.16.15');
  assert.match(fs.readFileSync(path.join(profile,'node_modules/qcu-market/src/public-trust.mjs'),'utf8'),/https:\/\/111\.229\.103\.201/);
  const edited=path.join(temp,'edited');fs.cpSync(initial,edited,{recursive:true});
  fs.appendFileSync(path.join(edited,'profiles/desktop/node_modules/qcu-market/index.js'),'\n// independently edited');
  const receiptBefore=fs.readFileSync(path.join(edited,'qcu-teacher.json'));
  assert.throws(()=>h.prepare(kit,edited,undefined,yaml),/edited|inventory|changed/);
  assert.deepEqual(fs.readFileSync(path.join(edited,'qcu-teacher.json')),receiptBefore);
  console.log(JSON.stringify({passed:true,platform:'mac-arm64',result:'refreshed',marketVersion:'0.1.0-pilot.16.15',settingsPreserved:true,editedRefused:true,modelCalls:0}));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
