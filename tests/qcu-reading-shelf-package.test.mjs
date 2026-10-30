// R2 candidate shape and source identity; pilot4-only regressions remain pinned separately.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {readUpdateArchive, inspectUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
import {parseUpdatePayload} from '../hub/plugins/qcu-market/src/update-model.mjs'
import {updatePolicy, expertUpdatePolicy} from '../hub/plugins/qcu-market/src/update-policy.mjs'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

test('exact R2 archive matches every source member, original parser/vendor and unchanged tools admission; migration is manual-review', async () => {
  const dir = resolve(process.env.QCU_READING_PACKAGE_DIR), manifest = JSON.parse(await readFile(join(dir, 'MANIFEST.json')))
  const raw = await readFile(join(dir, manifest.file)), files = readUpdateArchive(raw), pkg = JSON.parse(files.get('package.json'))
  assert.equal(manifest.version, '0.2.0-pilot.1'); assert.equal(pkg.version, manifest.version); assert.equal(manifest.upgradePolicy, 'manual-review')
  assert.equal(manifest.protocol, 3); assert.equal(manifest.stateSchema, 3); assert.equal(raw.length, manifest.bytes); assert.equal(sha(raw), manifest.sha256)
  assert.equal(files.size, manifest.files.length); assert.equal(files.has('pack.py'), false); assert.equal(files.has('src/shelf.mjs'), true)
  assert.equal(Object.keys(pkg.peerDependencies).length, 10); assert.deepEqual(pkg.peerDependencies, updatePolicy.products['qcu-reading'].peers)
  assert.ok(!pkg.dependencies && !pkg.scripts); assert.ok(files.size <= 80 && [...files.values()].every(b => b.length <= 1048576))
  const baseline = JSON.parse(await readFile('.work/qcu-reading-r2-shelf/baseline-inventory.json'))
  const originalPaths = ['src/parser.mjs', 'src/parser-worker.mjs', 'src/source.mjs', 'src/zip.mjs', 'vendor.mjs', ...[...files.keys()].filter(p => p.startsWith('vendor/') || p.startsWith('vendor-inputs/'))]
  for (const record of manifest.files) {
    const name = record.path.slice(8), bytes = files.get(name)
    assert.equal(bytes.length, record.bytes); assert.equal(sha(bytes), record.sha256)
    assert.deepEqual(bytes, await readFile(join('hub/plugins/qcu-reading', name)), name)
    if (originalPaths.includes(name)) assert.equal(sha(bytes), baseline.records.find(r => r.root === process.cwd() && r.path === 'hub/plugins/qcu-reading/' + name)?.sha256, name)
  }
  const patch = JSON.parse(files.get('cordis.patch.yml')); assert.equal(patch.length, 1); assert.equal(patch[0].insert.length, 1); assert.equal(patch[0].insert[0].disabled, true)
  const entry = {id:pkg.name, version:pkg.version, file:manifest.file, bytes:manifest.bytes, sha256:manifest.sha256, runtime:'0.2.0-rc.2', capability:'tools', changes:'R2 schema3 migration requires manual review; local candidate, native/business/Windows untested.', upgradePolicy:'manual-review', withdrawn:false, peers:pkg.peerDependencies, files:manifest.files.map(f => ({...f, path:f.path.slice(8)}))}
  assert.equal(inspectUpdateArchive(raw, entry).components, 1)
  assert.throws(() => inspectUpdateArchive(raw, {...entry, sha256:'0'.repeat(64)}), /SHA256/)
  assert.throws(() => inspectUpdateArchive(raw, {...entry, peers:{}}), /peer依赖不符/)
  const now = Date.now(), payload = JSON.stringify({schemaVersion:1, channel:'pilot-reading', revision:1, issuedAt:new Date(now).toISOString(), expiresAt:new Date(now + 86400000).toISOString(), entries:[entry]})
  assert.equal(parseUpdatePayload(payload, updatePolicy, now).entries[0].upgradePolicy, 'manual-review')
  assert.throws(() => parseUpdatePayload(payload, expertUpdatePolicy, now), /通道/)
  // This is local unsigned inspection data, never a production feed or signature.
  await writeFile(join(dir, 'MARKET-INSPECTION.json'), JSON.stringify({sha256:sha(raw), bytes:raw.length, members:files.size, payloadBytes:gunzipSync(raw).length, totalFileBytes:[...files.values()].reduce((n, b) => n + b.length, 0), readUpdateArchive:'passed', inspectUpdateArchive:'passed', currentToolsAdmission:'passed', frozenOldPolicy:'still rejects', upgradePolicy:entry.upgradePolicy, noNewProductAdmission:true, signed:false, published:false, installed:false, native:'untested', business:'untested', windows:'untested', approval:'required'}, null, 2) + '\n')
})

test('real unchanged checker verifies complete R2 handoff and keeps human/native/teacher approval required', async () => {
  const handoff = resolve(process.env.QCU_READING_R2_HANDOFF), submission = join(handoff, 'submission.json')
  const result = spawnSync('python3', ['-B', 'scripts/qcu-check-submission.py', '--submission', submission], {encoding:'utf8'})
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.staticChecksPassed, true); assert.equal(report.approval, 'required'); assert.deepEqual(report.errors, []); assert.deepEqual(report.unsupported, [])
  assert.equal(report.evidence.source, 'passed'); assert.equal(report.evidence.preview, 'passed'); assert.equal(report.evidence.liveInstall, 'untested'); assert.equal(report.evidence.businessAcceptance, 'untested')
  await writeFile(resolve(process.env.QCU_READING_R2_CHECKER_OUT), result.stdout)
})
