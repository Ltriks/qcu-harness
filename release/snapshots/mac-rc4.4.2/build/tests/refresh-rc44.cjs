'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const kit=path.join(root,'dist/QCU助手.app/Contents/Resources');
const h=require(path.join(kit,'support/start.cjs'));
const integrated=require(path.join(root,'support/integrated.cjs'));
const temp=fs.mkdtempSync('/private/tmp/qcu-rc44-refresh-');
const home=path.join(temp,'home');
process.env.QCU_TEACHER_TEST_HOME=home;
process.env.QCU_SUITE_LAUNCHER=path.join(kit,'../MacOS/城院助手');
process.env.QCU_SUITE_SUPPORT=path.join(kit,'support');

async function main(){
 const m=JSON.parse(fs.readFileSync(path.join(kit,'support/manifest.json'),'utf8'));
 // First prepare with current kit via rename path if launcher missing commit - use integrated after staging manually
 fs.mkdirSync(path.dirname(home),{recursive:true});
 const staging=fs.mkdtempSync(path.join(path.dirname(home),'.qcu-prepare-'));
 fs.cpSync(path.join(kit,'seed'),staging,{recursive:true});
 for(const name of ['workspace','agents','electron'])fs.mkdirSync(path.join(staging,name),{recursive:true});
 fs.writeFileSync(path.join(staging,'workspace','keep-me.txt'),'user-work-must-survive\n');
 fs.writeFileSync(path.join(staging,'electron','keep-setting.json'),'{"v":1}\n');
 const patch=path.join(staging,'profiles/desktop/cordis.patch.yml');
 const patches=JSON.parse(fs.readFileSync(patch,'utf8'));
 const feishu=patches.find(r=>r.id==='qcu-feishu-readonly');
 if(feishu){feishu.config=feishu.config||{};feishu.config.cliPath=path.join(home,'bin/lark-cli');feishu.config.apiKey='SYNTHETIC-KEEP';}
 fs.writeFileSync(patch,JSON.stringify(patches,null,2)+'\n');
 // receipt claims OLD market composition (rc44.1)
 const oldMarket={id:'qcu-market',source:'file:./.qcu-bundles/qcu-market-0.1.0-pilot.16.2-454309803d4b532f7c112d1199ac454823977bec7fa99d376328bd3088933c68.tgz',sha256:'454309803d4b532f7c112d1199ac454823977bec7fa99d376328bd3088933c68'};
 const localSources=m.localSources.map(p=>p.id==='qcu-market'?{id:p.id,source:oldMarket.source,sha256:oldMarket.sha256}:{id:p.id,source:p.source,sha256:p.sha256});
 const products=m.products.map(p=>p.id==='qcu-market'?{id:p.id,version:'0.1.0-pilot.16.2'}:{id:p.id,version:p.version});
 fs.writeFileSync(path.join(staging,'qcu-teacher.json'),JSON.stringify({version:m.version,seedId:'a'.repeat(64),products,localSources,preparedAt:new Date().toISOString(),packageManagerInvoked:false},null,2)+'\n');
 fs.renameSync(staging,home);
 // marker files
 assert.equal(fs.readFileSync(path.join(home,'workspace/keep-me.txt'),'utf8'),'user-work-must-survive\n');
 const result=integrated.prepare(kit,home,m,h);
 assert.equal(result.result,'refreshed');
 const receipt=JSON.parse(fs.readFileSync(path.join(home,'qcu-teacher.json'),'utf8'));
 assert.equal(receipt.seedId,m.seedId);
 assert.equal(receipt.localSources.find(p=>p.id==='qcu-market').sha256,m.localSources.find(p=>p.id==='qcu-market').sha256);
 assert.equal(fs.readFileSync(path.join(home,'workspace/keep-me.txt'),'utf8'),'user-work-must-survive\n');
 assert.equal(fs.readFileSync(path.join(home,'electron/keep-setting.json'),'utf8'),'{"v":1}\n');
 const kept=JSON.parse(fs.readFileSync(path.join(home,'profiles/desktop/cordis.patch.yml'),'utf8'));
 assert.equal(kept.find(r=>r.id==='qcu-feishu-readonly').config.apiKey,'SYNTHETIC-KEEP');
 const marketPkg=JSON.parse(fs.readFileSync(path.join(home,'profiles/desktop/node_modules/qcu-market/package.json'),'utf8'));
 assert.equal(marketPkg.version,m.localSources.find(p=>p.id==='qcu-market').version);
 // second prepare is already-prepared
 assert.equal(integrated.prepare(kit,home,m,h).result,'already-prepared');
 console.log(JSON.stringify({ok:true,result:result.result,market:marketPkg.version,seedId:receipt.seedId.slice(0,12)}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
