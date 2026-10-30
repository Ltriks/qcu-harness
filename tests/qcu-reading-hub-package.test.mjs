// Exercise the actual unchanged checker and market readers, never incoming scripts.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {readUpdateArchive, inspectUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
import {parseUpdatePayload} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {updatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
const output = resolve('.work/qcu-reading-hub-package')
const baseline = resolve(process.env.QCU_READING_BASELINE_DIR ?? join(output, 'baseline-handoff'))

test('frozen pilot.3 is actually rejected by the unchanged submission checker and market archive reader', async () => {
  const meta = JSON.parse(await readFile(join(baseline, 'submission.json')))
  const raw = await readFile(join(baseline, meta.archive.file))
  assert.equal(raw.length, 628112); assert.equal(sha(raw), '7ff0f9abe7e95775b7f290a60bc8bd9a42353d474a89208b0f8a63cd3a0940b7')
  const checker = spawnSync('python3', ['-B', 'scripts/qcu-check-submission.py', '--submission', join(baseline, 'submission.json')], {encoding:'utf8'})
  assert.equal(checker.status, 1, checker.stderr)
  const report = JSON.parse(checker.stdout)
  assert.equal(report.staticChecksPassed, false)
  assert.ok(report.errors.some(e => e.code === 'archive.file_type_unsupported'))
  assert.ok(report.errors.some(e => e.code === 'manifest.value'))
  assert.throws(() => readUpdateArchive(raw), /不支持的包成员/)
  await writeFile(join(output, 'baseline-market.json'), JSON.stringify({artifact:meta.archive, rejected:true, readerError:'不支持的包成员', checkerErrors:report.errors, causes:['pack.py is not an allowed member type', 'vendor/pdf.worker.mjs is 1268229 bytes (>1048576)']}, null, 2) + '\n')
})

test('exact pilot.4 fits canonical archive bounds and matching synthetic entry inspection while product admission remains rejected', async () => {
  assert.ok(process.env.QCU_READING_PACKAGE_DIR)
  const dir = resolve(process.env.QCU_READING_PACKAGE_DIR)
  const manifest = JSON.parse(await readFile(join(dir, 'MANIFEST.json')))
  const raw = await readFile(join(dir, manifest.file)), files = readUpdateArchive(raw)
  const pkg = JSON.parse(files.get('package.json'))
  assert.equal(pkg.version, '0.1.0-pilot.4'); assert.equal(files.has('pack.py'), false)
  assert.ok(files.size <= 80 && [...files.values()].every(b => b.length <= 1048576))
  const tar = gunzipSync(raw); assert.ok(tar.length <= 5 * 1048576)
  assert.ok([...files.values()].reduce((n, b) => n + b.length, 0) <= 4194304)
  let offset = 0
  for (const [name, bytes] of files) {
    const header = tar.subarray(offset, offset + 512)
    assert.equal(header.subarray(257, 265).toString(), 'ustar\x0000')
    assert.ok(header.subarray(345, 500).every(b => b === 0))
    assert.equal(header[156], 48)
    assert.equal(parseInt(header.subarray(100, 108).toString(), 8), 0o644)
    for (const [start, end] of [[108,116],[116,124],[136,148]]) assert.equal(parseInt(header.subarray(start,end).toString(), 8), 0)
    assert.ok(!name.endsWith('.py'))
    offset += 512 + Math.ceil(bytes.length / 512) * 512
  }
  assert.ok(tar.length - offset >= 1024 && tar.subarray(offset).every(b => b === 0))
  const entry = {id:pkg.name, version:pkg.version, file:manifest.file, bytes:manifest.bytes, sha256:manifest.sha256, runtime:'0.2.0-rc.2', capability:'local-reading', changes:'Synthetic archive-shape fixture; not signed or published.', upgradePolicy:'manual-review', withdrawn:false, peers:pkg.peerDependencies, files:manifest.files.map(f => ({...f, path:f.path.slice(8)}))}
  assert.equal(inspectUpdateArchive(raw, entry).components, 1)
  assert.throws(() => inspectUpdateArchive(raw, {...entry, sha256:'0'.repeat(64)}), /SHA256/)
  assert.throws(() => inspectUpdateArchive(raw, {...entry, peers:{}}), /peer依赖不符/)
  assert.throws(() => inspectUpdateArchive(raw, {...entry, files:entry.files.slice(1)}), /签名指纹不符/)
  const now = Date.now(), feed = {schemaVersion:1, channel:'pilot', revision:1, issuedAt:new Date(now).toISOString(), expiresAt:new Date(now + 86400000).toISOString(), entries:[entry]}
  assert.throws(() => parseUpdatePayload(JSON.stringify(feed), updatePolicy, now), /产品或能力类别未获支持/)
  await writeFile(join(output, 'synthetic-entry.json'), JSON.stringify(entry, null, 2) + '\n')
  await writeFile(join(output, 'market-evidence.json'), JSON.stringify({artifact:manifest.file, sha256:manifest.sha256, bytes:raw.length, members:files.size, payloadBytes:tar.length, readUpdateArchive:'passed', inspectUpdateArchive:'passed', badHashPeersFiles:'rejected', fixtureOnly:true, signature:false, published:false, updateProductAdmission:'rejected by unchanged allowlist', approval:'required'}, null, 2) + '\n')
})
