const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const tool=require('../tools/offline-suite/offline.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
async function fixture(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'qcu-offline-unit-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const data=Buffer.from('non-executable fixture');await fs.writeFile(path.join(root,'bundle.tgz'),data);await fs.writeFile(path.join(root,'native.bin'),data);
 const m={schemaVersion:1,suiteVersion:'0.1.0-rc.1',dshVersion:'0.2.0-rc.2',target:process.platform==='darwin'?'mac-arm64':'win-x64',products:Array.from({length:10},(_,i)=>({id:'qcu-fixture-'+i,path:'bundle.tgz',version:'0.1.0-pilot.1'})),lark:{path:'native.bin'},files:['bundle.tgz','native.bin'].map(p=>({path:p,bytes:data.length,sha256:sha(data)}))};
 await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(m));return {root,m,save:()=>fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(m))};
}
test('release paths reject traversal, absolute and Windows escape forms',()=>{for(const p of ['../x','/x','a/../x','C:/x','a\\x','a//x'])assert.throws(()=>tool.safeRelative(p));assert.equal(tool.safeRelative('bundles/a.tgz'),'bundles/a.tgz')});
test('verify accepts intact records and detects content corruption',async t=>{const f=await fixture(t);await tool.verifyKit(f.root);await fs.writeFile(path.join(f.root,'bundle.tgz'),'corrupt');await assert.rejects(tool.verifyKit(f.root),/integrity/)});
test('symlinked payload is refused even when its content hash matches',async t=>{const f=await fixture(t);await fs.unlink(path.join(f.root,'bundle.tgz'));await fs.symlink(path.join(f.root,'native.bin'),path.join(f.root,'bundle.tgz'));await assert.rejects(tool.verifyKit(f.root),/links/)});
test('wrong platform cannot be installed',async t=>{const f=await fixture(t);f.m.target='unsupported';await f.save();await assert.rejects(tool.verifyKit(f.root),/requires/)});
test('duplicate file records and product identities cannot pass verification',async t=>{const f=await fixture(t);f.m.files.push(f.m.files[0]);await f.save();await assert.rejects(tool.verifyKit(f.root),/Invalid file record/);f.m.files.pop();f.m.products[1].id=f.m.products[0].id;await f.save();await assert.rejects(tool.verifyKit(f.root),/identities/)});
test('existing data directory remains untouched before runtime import',async t=>{const f=await fixture(t);const home=path.join(f.root,'existing');await fs.mkdir(home);await fs.writeFile(path.join(home,'keep'),'user data');const verified=await tool.verifyKit(f.root);await assert.rejects(tool.install(f.root,home,'/unreachable-runtime',verified),/not empty/);assert.equal(await fs.readFile(path.join(home,'keep'),'utf8'),'user data');assert.deepEqual(await fs.readdir(home),['keep'])});
