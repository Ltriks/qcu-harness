// Exact artifact proof: every tar member is verified, then parsed under Node permissions with
// SDK/developer files, addons and network unavailable. This is a test restriction, not product sandboxing.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, writeFile, mkdir, mkdtemp, realpath, rm} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {join, dirname, resolve} from 'node:path'
import {pdfFixture, docxFixture} from './fixtures/qcu-reading-binary.mjs'
const sha = data => createHash('sha256').update(data).digest('hex')
test('exact TGZ member manifest, standalone rebuild and offline PDF/DOCX store with all developer dependencies inaccessible', async t => {
  assert.ok(process.env.QCU_READING_PACKAGE_DIR, 'Point QCU_READING_PACKAGE_DIR to the actual pack.py artifact directory')
  const artifacts = resolve(process.env.QCU_READING_PACKAGE_DIR), manifest = JSON.parse(await readFile(join(artifacts, 'MANIFEST.json'))), tgz = await readFile(join(artifacts, manifest.file))
  assert.equal(tgz.length, manifest.bytes); assert.equal(sha(tgz), manifest.sha256); assert.ok(tgz.length <= 1048576)
  const isolated = await realpath(await mkdtemp(join(tmpdir(), 'qcu-reading-exact-')))
  t.after(() => rm(isolated, {recursive:true, force:true}))
  const tar = gunzipSync(tgz), members = [], expected = new Map(manifest.files.map(f => [f.path, f]))
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512); if (header.every(n => n === 0)) break
    const str = (s, e) => header.subarray(s, e).toString().replace(/\0.*$/s, '')
    const name = str(0, 100), bytes = parseInt(str(124, 136), 8), mtime = parseInt(str(136, 148), 8)
    assert.ok(expected.has(name) && !name.includes('..') && name.startsWith('package/'), name)
    assert.ok(['0', ''].includes(str(156, 157))); assert.equal(mtime, 0); assert.ok(!members.includes(name))
    const data = tar.subarray(at + 512, at + 512 + bytes), record = expected.get(name)
    assert.equal(bytes, record.bytes); assert.equal(sha(data), record.sha256)
    const file = join(isolated, name); await mkdir(dirname(file), {recursive:true}); await writeFile(file, data)
    members.push(name); at += 512 + Math.ceil(bytes / 512) * 512
  }
  assert.deepEqual(members, manifest.files.map(f => f.path))
  await writeFile(join(isolated, 'fixture.pdf'), pdfFixture()); await writeFile(join(isolated, 'fixture.docx'), await docxFixture())
  await mkdir(join(isolated, 'workspace'))
  await writeFile(join(isolated, 'offline.mjs'), `
import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
assert.equal(process.permission.has('fs.read','/Users/mcq/Documents/Codex'),false);
assert.equal(process.permission.has('fs.read','/Users/mcq/.cache/codex-runtimes'),false);
assert.equal(process.permission.has('addons'),false); assert.equal(process.permission.has('net'),false);
const {ReadingStore}=await import('./package/src/store.mjs');
const {parserActivity}=await import('./package/src/parser.mjs');
const before=await readFile('./package/client.js'); await import('./package/build.mjs');
assert.deepEqual(await readFile('./package/client.js'),before);
const s=await new ReadingStore(process.cwd()+'/workspace',{model:()=>assert.fail('No automatic model'),generate:()=>assert.fail('No automatic model')}).init();
for(const format of ['pdf','docx']){const bytes=await readFile('./fixture.'+format); const d=(await s.importDocument({name:'fixture.'+format,base64:bytes.toString('base64')})).document;
assert.match(d.content,format==='pdf'?/第二页形成性评价反馈/:/表格反馈建议/); assert.ok(d.paragraphs.some(p=>p.location.format===format));}
await s.dispose();const again=await new ReadingStore(process.cwd()+'/workspace',{}).init();assert.equal(again.snapshot().documents.length,2);await again.dispose();assert.equal(parserActivity(),0);
console.log(JSON.stringify({passed:true,documents:2,nativeAddons:false,developerDependencies:false,network:false,node:process.version,arch:process.arch}));
`)
  const result = spawnSync(process.execPath, ['--permission', '--allow-fs-read=' + isolated, '--allow-fs-write=' + isolated, '--allow-worker', '--no-addons', '--no-global-search-paths', 'offline.mjs'], {cwd:isolated, encoding:'utf8', timeout:30000, env:{PATH:'/usr/bin:/bin', LANG:'en_US.UTF-8'}})
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const proof = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.equal(proof.passed, true)
  await writeFile(join(artifacts, 'OFFLINE-EVIDENCE.json'), JSON.stringify({artifact:manifest.file, sha256:manifest.sha256, members:members.length, ...proof}, null, 2) + '\n')
})
