// rc4 launcher gates against the frozen public seed; disposable Homes only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {prepare,identity,defaultHome}=require('../tools/teacher-suite/start.cjs');
const kit=path.resolve(process.env.QCU_INTEGRATED_TEST_KIT),m=identity(kit);
function fixture(t){const root=fs.mkdtempSync('/private/tmp/qcu-integrated-');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,home:path.join(root,'合成 Home')}}
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
test('rc4 exact identity and default namespace have no automatic old-Home migration',t=>{
 assert.equal(m.version,'0.1.0-rc.4');assert.equal(m.products.length,11);assert.equal(m.localSources.length,12);assert.equal(m.migrateFrom,undefined);
 assert.equal(defaultHome(m.version),path.join(os.homedir(),'Library/Application Support/QCU-DSH/teacher/0.1.0-rc.4'));
 const f=fixture(t);assert.throws(()=>prepare(kit,f.home,path.join(f.root,'old')),/explicit maintainer migration/);assert.equal(fs.existsSync(f.home),false);
});
test('first/repeat checks twelve source references and preserves valid teacher configuration choices',t=>{
 const f=fixture(t);assert.equal(prepare(kit,f.home).directDependencies,12);
 const profile=path.join(f.home,'profiles/desktop'),file=path.join(profile,'package.json'),pkg=json(file);pkg.syntheticTeacherPreference={anonymous:true};pkg.dsh.profile.bundles=pkg.dsh.profile.bundles.filter(id=>id!=='qcu-study-coach');fs.writeFileSync(file,JSON.stringify(pkg));
 const patch=path.join(profile,'cordis.patch.yml'),rows=json(patch);rows.find(r=>r.id==='qcu-study-coach').disabled=true;fs.writeFileSync(patch,JSON.stringify(rows));const before=fs.readFileSync(patch);
 assert.equal(prepare(kit,f.home).result,'already-prepared');assert.deepEqual(fs.readFileSync(patch),before);assert.deepEqual(json(file),pkg);
});
for(const [name,mutate] of [
 ['receipt',home=>{const f=path.join(home,'qcu-teacher.json'),v=json(f);v.localSources.pop();fs.writeFileSync(f,JSON.stringify(v))}],
 ['duplicate component',home=>{const f=path.join(home,'profiles/desktop/cordis.patch.yml'),v=json(f);v.push({...v[0]});fs.writeFileSync(f,JSON.stringify(v))}],
 ['policy',home=>fs.writeFileSync(path.join(home,'profiles/desktop/pnpm-workspace.yaml'),'{"autoInstallPeers":true,"ignoreScripts":true}')]
])test('repeat refuses altered '+name+' without repair or overwriting personal data',t=>{
 const f=fixture(t);prepare(kit,f.home);const note=path.join(f.home,'workspace/keep.txt');fs.writeFileSync(note,'Synthetic sentinel');mutate(f.home);
 const receipt=fs.readFileSync(path.join(f.home,'qcu-teacher.json'));assert.throws(()=>prepare(kit,f.home));assert.deepEqual(fs.readFileSync(path.join(f.home,'qcu-teacher.json')),receipt);assert.equal(fs.readFileSync(note,'utf8'),'Synthetic sentinel');
});
test('occupied partial and linked target Homes are refused unchanged',t=>{
 const f=fixture(t);fs.mkdirSync(f.home);fs.writeFileSync(path.join(f.home,'keep.txt'),'synthetic');assert.throws(()=>prepare(kit,f.home),/already exists/);assert.equal(fs.readFileSync(path.join(f.home,'keep.txt'),'utf8'),'synthetic');
 const link=path.join(f.root,'linked');fs.symlinkSync(f.home,link);assert.throws(()=>prepare(kit,link),/link/);
});
test('a linked node_modules parent is refused even when all pointed-to bytes match',t=>{
 const f=fixture(t);prepare(kit,f.home);const declared=path.join(f.home,'profiles/desktop/node_modules'),external=path.join(f.root,'other-modules');fs.renameSync(declared,external);fs.symlinkSync(external,declared);
 assert.throws(()=>prepare(kit,f.home),/module directory uses a link/);assert.ok(fs.existsSync(path.join(external,'qcu-market/package.json')));
});

test('repeat structurally accepts user-owned upgraded code, sources and inactive branding without rewriting',t=>{
 const f=fixture(t);prepare(kit,f.home);const profile=path.join(f.home,'profiles/desktop'),file=path.join(profile,'package.json'),pkg=json(file);
 pkg.dependencies['qcu-market']='0.1.0-pilot.15.3';pkg.dsh.profile.bundles=pkg.dsh.profile.bundles.filter(id=>id!=='qcu-branding');fs.writeFileSync(file,JSON.stringify(pkg));
 const module=path.join(profile,'node_modules/qcu-market/package.json'),info=json(module);info.version='0.1.0-pilot.15.3';fs.writeFileSync(module,JSON.stringify(info));
 fs.appendFileSync(path.join(profile,'node_modules/qcu-market/index.js'),'// synthetic official-owned update');fs.writeFileSync(path.join(profile,'node_modules/qcu-market/extra.js'),'synthetic');fs.appendFileSync(path.join(profile,'.qcu-bundles',m.localSources[0].file),'synthetic mutable archive');
 const patch=path.join(profile,'cordis.patch.yml'),rows=json(patch);rows.find(r=>r.id==='qcu-branding').disabled=true;for(const id of ['ui-sidebar','ui-brand-official'])rows.find(r=>r.id===id).disabled=false;fs.writeFileSync(patch,JSON.stringify(rows));
 const before=fs.readFileSync(patch);assert.equal(prepare(kit,f.home).result,'already-prepared');assert.deepEqual(json(file),pkg);assert.deepEqual(fs.readFileSync(patch),before);
});
test('repeat rejects escaping package and nested symlinks, malformed core metadata, and tampered shipped seed',t=>{
 const f=fixture(t);prepare(kit,f.home);const module=path.join(f.home,'profiles/desktop/node_modules/qcu-market'),outside=path.join(f.root,'outside');fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(module,'escape'));assert.throws(()=>prepare(kit,f.home),/leaves local/);fs.unlinkSync(path.join(module,'escape'));
 const file=path.join(f.home,'profiles/desktop/package.json'),pkg=json(file);pkg.dependencies['../escape']='1';fs.writeFileSync(file,JSON.stringify(pkg));assert.throws(()=>prepare(kit,f.home),/dependencies invalid/);
 const bad=path.join(f.root,'bad-kit');fs.cpSync(kit,bad,{recursive:true});fs.appendFileSync(path.join(bad,m.seedFiles[0].path),'tampered');assert.throws(()=>prepare(bad,path.join(f.root,'fresh')),/integrity failed/);assert.equal(fs.existsSync(path.join(f.root,'fresh')),false);
});
