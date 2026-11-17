'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const [kit,root]=process.argv.slice(2),home=path.join(root,'fresh user data');process.env.QCU_TEACHER_TEST_HOME=home;process.env.QCU_SUITE_SUPPORT=path.join(kit,'support');process.env.QCU_SUITE_LAUNCHER=path.join(kit,'QCU助手.exe');
const api=require(path.join(kit,'support/start.cjs')),m=api.identity(kit),yaml=require('node:module').createRequire(path.join(kit,'program/resources/app.asar/dsh/package.json'))('js-yaml').load;
const patch=path.join(home,'profiles/desktop/cordis.patch.yml'),before=fs.readFileSync(patch,'utf8');
fs.writeFileSync(patch,before+'\n# Windows synthetic preservation marker\n');
const preserved=fs.readFileSync(patch);assert.equal(api.prepare(kit,home,undefined,yaml).result,'already-prepared');assert.deepEqual(fs.readFileSync(patch),preserved);
const occupied=path.join(root,'occupied');fs.mkdirSync(occupied,{recursive:true});fs.writeFileSync(path.join(occupied,'keep.txt'),'keep');assert.throws(()=>api.prepare(kit,occupied,undefined,yaml));assert.equal(fs.readFileSync(path.join(occupied,'keep.txt'),'utf8'),'keep');
const seed=path.join(kit,m.seedFiles.find(r=>r.path.endsWith('package.json')).path),original=fs.readFileSync(seed);
fs.chmodSync(seed,0o600);try{fs.appendFileSync(seed,' ');assert.throws(()=>api.prepare(kit,path.join(root,'damaged-seed'),undefined,yaml));assert.equal(fs.existsSync(path.join(root,'damaged-seed')),false)}finally{fs.writeFileSync(seed,original)}
// Exclusive native directory commit must preserve even an empty occupied target.
const stage=fs.mkdtempSync(path.join(root,'.qcu-prepare-'));const r=cp.spawnSync(path.join(kit,'QCU助手.exe'),['--commit-upgrade',stage,home],{windowsHide:true});assert.notEqual(r.status,0);assert.ok(fs.existsSync(stage));fs.rmSync(stage,{recursive:true});
const incidents=require(path.join(kit,'support/incidents.cjs')),diagnostics=require(path.join(kit,'support/diagnostics-api.cjs'));
const failure=incidents.captureFailure(Object.assign(Error('synthetic private payload MUST NOT LEAK'),{code:'EACCES'}),{stage:'prepare',suiteVersion:m.version,sourceKind:'self-test'},diagnostics.root());
assert.ok(failure.message.includes('故障编号：'));const status=diagnostics.status();assert.equal(status.storageAvailable,true);assert.equal(status.autoReport,false);assert.ok(status.records.length);
const exported=diagnostics.exportRecord(status.records[0].incidentId);assert.equal(JSON.stringify(exported).includes('MUST NOT LEAK'),false);
const result={passed:true,platform:process.platform,arch:process.arch,checks:['config-preserved','occupied-home-preserved','damaged-seed-refused','native-exclusive-commit','private-windows-acl','traceable-sanitized-diagnostic','diagnostic-export','reporting-default-off'],modelCalls:0};
fs.writeFileSync(path.join(root,'acceptance.json'),JSON.stringify(result,null,2));console.log('QCU_WINDOWS_ACCEPTANCE:'+JSON.stringify(result));
