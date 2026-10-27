const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('legacy rc3 and rc4 guides remain byte-exact independently of the current rc4.3 guide',()=>{
 const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
 const imported=spawnSync('python3',['-c',"import importlib.util,json,sys;from pathlib import Path;s=importlib.util.spec_from_file_location('legacy_guide',Path(sys.argv[1])/'scripts/add-teacher-guide.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps({'guide':str(m.GUIDE.resolve()),'targets':sorted(m.BASES)}))",root],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(imported.status,0,imported.stderr);const resolved=JSON.parse(imported.stdout);
 assert.equal(resolved.guide,path.join(root,'tools/teacher-guide/rc3/QCU助手使用指南.html'));
 assert.equal(path.basename(resolved.guide),'QCU助手使用指南.html');assert.deepEqual(resolved.targets,['mac-arm64','win-x64']);
 const historical=fs.readFileSync(resolved.guide),current=fs.readFileSync(path.join(root,'tools/teacher-guide/QCU助手使用指南.html'));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(historical),'3d8b2a0a6df0dcb7edce322a9766b44493557e0129a36581669b7492f3e80274');
 assert.match(historical.toString(),/教师预装版 0\.1\.0-rc\.3/);assert.doesNotMatch(historical.toString(),/0\.1\.0-rc\.4/);
 const rc4=fs.readFileSync(path.join(root,'tools/teacher-guide/rc4/QCU助手使用指南.html'));
 assert.equal(sha(rc4),'b1e9ddc1e77c20fda11b8dd3140be0b0d55e8b3f1b05ba7c9e8472ace3c5420e');
 for(const [folder,hash]of [['rc41','cd1ed6281af67b500367aab5ee15d255b4dca8052b3e5a2e13e733327b1f40e7'],['rc42','a033f0e49663ca1ad9c3849f88f0b148485cc83082d80abeb66ee3393b4548cb']])assert.equal(sha(fs.readFileSync(path.join(root,'tools/teacher-guide',folder,'QCU助手使用指南.html'))),hash);
 assert.notEqual(sha(current),sha(rc4));assert.match(current.toString(),/Mac 教师套件 0\.1\.0-rc\.4\.3/);
});
test('current guide retains offline anchors, seven copy examples, current Mac identity and explicit confirmations',()=>{
 const html=fs.readFileSync(path.join(root,'tools/teacher-guide/QCU助手使用指南.html'),'utf8');
 for(const text of ['0.1.0-rc.4.3','0.2.6-pilot.2','Windows rc4.3 尚未发布','不会自动导入','工具市场与专家团','本人明确确认','自己的 API Key','QCU_DATA_RELEASE_MISMATCH','不要删除配置','connect-src \'none\'','Hub','限流','额度','工作区不可用','安装成功','回执历史','原始日志','candidate-not-published','composition.json'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/无\s*QCU市场|teacher\/0\.1\.0-rc\.3|<form|<input|<script[^>]+src=|<link[^>]+href=/);
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 for(const m of html.matchAll(/href="#([^"]+)"|data-copy="([^"]+)"/g))assert.ok(ids.has(m[1]??m[2]),m[0]);
 for(const id of ['lesson','tiered','study','note','reading','integrity','brief'])assert.ok(ids.has(id==='lesson'?'lesson-first':id+'-prompt'),id);
});
test('historical configs retain exact public identities and current preparation has no placeholder release',()=>{
 const {createHash}=require('node:crypto');
 const config=JSON.parse(fs.readFileSync(path.join(root,'release/integrated-teacher-macos.json')));
 assert.deepEqual(config.packagePolicy,{autoInstallPeers:false,ignoreScripts:true,packageImportMethod:'copy'});
 assert.equal(config.version,'0.1.0-rc.4.1');
 const rc42=fs.readFileSync(path.join(root,'release/integrated-teacher-macos-rc42.json'));
 assert.equal(createHash('sha256').update(rc42).digest('hex'),'3c721d1ab3747ccb2195cacd21a5756495b0b73903db13cfa79925e79df3ead5');
 assert.equal(JSON.parse(rc42).version,'0.1.0-rc.4.2');
 const generated=path.join(root,'release/integrated-teacher-macos-rc43.json');
 if(fs.existsSync(generated)){const c=JSON.parse(fs.readFileSync(generated));assert.equal(c.version,'0.1.0-rc.4.3');assert.ok(['0.2.6-pilot.2','0.2.6-pilot.3'].includes(c.brandingVersion));assert.ok(c.brandingPackageManifest.sha256);assert.ok(c.marketArchive.sha256);}
});
