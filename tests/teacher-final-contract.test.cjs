const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('legacy rc3 and rc4 guides remain byte-exact independently of the current rc4.1 guide',()=>{
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
 assert.notEqual(sha(current),sha(rc4));assert.match(current.toString(),/Mac 教师套件 0\.1\.0-rc\.4\.1/);
});
test('current guide retains offline anchors, seven copy examples, current Mac identity and explicit confirmations',()=>{
 const html=fs.readFileSync(path.join(root,'tools/teacher-guide/QCU助手使用指南.html'),'utf8');
 for(const text of ['0.1.0-rc.4.1','0.2.3','Windows rc4.1 尚未发布','不会自动导入','插件市场与专家团','本人明确确认','自己的 API Key','QCU_DATA_RELEASE_MISMATCH','不要删除配置','connect-src \'none\''])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/无\s*QCU市场|teacher\/0\.1\.0-rc\.3|<form|<input|<script[^>]+src=|<link[^>]+href=/);
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 for(const m of html.matchAll(/href="#([^"]+)"|data-copy="([^"]+)"/g))assert.ok(ids.has(m[1]??m[2]),m[0]);
 for(const id of ['lesson','tiered','study','note','reading','integrity','brief'])assert.ok(ids.has(id==='lesson'?'lesson-first':id+'-prompt'),id);
});
test('builder and helper pin current branding, rc4.1 policy and reference interpreter',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'release/integrated-teacher-macos.json')));
 assert.deepEqual(config.packagePolicy,{autoInstallPeers:false,ignoreScripts:true,packageImportMethod:'copy'});
 assert.equal(config.trustedRuntime.sha256,'86708c2c6e826ed2732766a45b75b11dc3cc940c88af48c129f9c6ecf2dc70df');
 assert.equal(config.version,'0.1.0-rc.4.1');
 const client=fs.readFileSync(path.join(root,'tools/teacher-branding/src/view.mjs'),'utf8');assert.match(client,/当前教师套件/);assert.match(client,/0\.1\.0-rc\.4\.1/);assert.match(client,/QCU清蓝 0\.2\.3/);
});
