/* Isolated upgrade check using a real rc.2 test profile, never the user's home. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [kit,previous,out]=process.argv.slice(2).map(p=>path.resolve(p));
if(fs.existsSync(out))throw Error('Fresh migration test directory required');
fs.mkdirSync(out,{recursive:true});
const old=path.join(out,'previous'),home=path.join(out,'upgraded');fs.cpSync(previous,old,{recursive:true});
const resources=process.platform==='darwin'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');
const yaml=require('node:module').createRequire(path.join(resources,'app.asar/dsh/package.json'))('js-yaml');
const patch=path.join(old,'profiles/desktop/cordis.patch.yml'),rows=yaml.load(fs.readFileSync(patch,'utf8'));
const feishu=rows.find(p=>p.id==="qcu-feishu-readonly");if(feishu?.config)feishu.config.cliPath=path.join(old,"bin",process.platform==="win32"?"lark-cli.exe":"lark-cli");
rows.push({id:'qcu-synthetic-model-check',config:{model:'synthetic-test-only'}});fs.writeFileSync(patch,yaml.dump(rows));
const note=path.join(old,'workspace/keep-lesson.txt');fs.writeFileSync(note,'Synthetic teaching note');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(patch);
const result=require(path.join(kit,'support/start.cjs')).prepare(kit,home,old,yaml.load);
assert.equal(hash(patch),before);assert.equal(fs.readFileSync(path.join(home,'workspace/keep-lesson.txt'),'utf8'),'Synthetic teaching note');
const after=yaml.load(fs.readFileSync(path.join(home,'profiles/desktop/cordis.patch.yml'),'utf8'));
assert.equal(after.find(p=>p.id==='qcu-synthetic-model-check').config.model,'synthetic-test-only');assert.equal(after.find(p=>p.id==='ui-brand-official').disabled,true);assert.equal(after.find(p=>p.id==='qcu-feishu-readonly').config.cliPath,path.join(home,'bin',process.platform==='win32'?'lark-cli.exe':'lark-cli'));
assert.equal(JSON.parse(fs.readFileSync(path.join(home,'profiles/desktop/package.json'))).dsh.profile.bundles.includes('qcu-branding'),true);
console.log('QCU_MIGRATION_VERIFIED:'+JSON.stringify({result:result.result,previousUnchanged:true,realYamlParsed:true,syntheticSettingsPreserved:true,workFilePreserved:true,brandingEnabled:true}));
