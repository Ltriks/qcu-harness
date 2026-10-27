// Headless JS dispatch only, using the pinned reference interpreter and synthetic data.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {startupDiagnostic}=require('../tools/teacher-suite/start.cjs');
const kit=path.resolve(process.env.QCU_INTEGRATED_TEST_KIT),pin=JSON.parse(fs.readFileSync(process.env.QCU_INTEGRATED_INPUTS||path.join(kit,'support/integrated-inputs.json'))).trustedRuntime;
const bytes=fs.readFileSync(process.execPath);assert.equal(process.execPath,pin.path);assert.equal(bytes.length,pin.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pin.sha256);
test('fixed startup diagnostics never echo arbitrary messages, parser fragments or codes',()=>{
 const secret='SYNTHETIC_NOT_A_REAL_KEY';
 for(const error of [new SyntaxError(secret),Object.assign(new Error(secret),{code:secret}),null]){
  const message=startupDiagnostic(error);assert.match(message,/QCU_STARTUP_PREPARATION_FAILED/);assert.match(message,/不要删除配置/);assert.ok(!message.includes(secret));
 }
 assert.match(startupDiagnostic({code:'QCU_DATA_RELEASE_MISMATCH',message:secret}),/已有数据来自另一份测试构建，已保留/);
});
for(const kind of ['foreign-release','same-release-other-seed','malformed-receipt','malformed-profile'])test('CLI safely refuses '+kind+' without exposing synthetic content',t=>{
 const root=fs.mkdtempSync('/private/tmp/qcu-startup-diagnostic-');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'synthetic-home'),m=JSON.parse(fs.readFileSync(path.join(kit,'support/manifest.json'))),secret='SYNTHETIC_SECRET_MUST_NOT_APPEAR';
 const {prepare}=require(path.join(kit,'support/start.cjs'));prepare(kit,home);
 const receipt=path.join(home,'qcu-teacher.json'),profile=path.join(home,'profiles/desktop/package.json');
 if(kind==='malformed-profile')fs.writeFileSync(profile,'{"apiKey":"'+secret+'", INVALID');
 else if(kind==='malformed-receipt')fs.writeFileSync(receipt,'{"apiKey":"'+secret+'", INVALID');
 else{const r=JSON.parse(fs.readFileSync(receipt));r.apiKey=secret;if(kind==='foreign-release')r.version='0.1.0-rc.4';else r.seedId='0'.repeat(64);fs.writeFileSync(receipt,JSON.stringify(r));}
 const before=fs.readFileSync(receipt),beforeProfile=fs.readFileSync(profile),env={PATH:process.env.PATH,HOME:process.env.HOME,ELECTRON_RUN_AS_NODE:'1',QCU_TEACHER_TEST_HOME:home};
 const p=spawnSync(process.execPath,['--expose-internals',path.join(kit,'support/start.cjs'),'prepare','--kit',kit],{env,encoding:'utf8',timeout:15000});
 assert.equal(p.status,1);assert.equal(p.stdout,'');assert.ok(!p.stderr.includes(secret));assert.ok(!p.stderr.includes('INVALID'));assert.ok(!p.stderr.includes(home));
 assert.match(p.stderr,new RegExp(kind.startsWith('malformed')?'QCU_STARTUP_PREPARATION_FAILED':'QCU_DATA_RELEASE_MISMATCH'));assert.match(p.stderr,/不要删除配置/);
 assert.deepEqual(fs.readFileSync(receipt),before);assert.deepEqual(fs.readFileSync(profile),beforeProfile);
});
