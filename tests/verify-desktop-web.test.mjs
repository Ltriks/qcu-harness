/** Synthetic frontend resolution cases; no Electron, credentials, private data or models. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, chmodSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyDesktopWeb } from '../scripts/verify-desktop-web.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'qcu-frontend-artifacts-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const upstream = join(root, 'upstream')
  const host = join(upstream, 'packages', 'bundle', 'web-app')
  const runtime = join(root, 'runtime')
  for (const directory of [host, runtime]) {
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), '{}\n')
  }
  const frontend = join(upstream, 'apps', 'web')
  const packagePath = join('node_modules', '@deepseek-ai', 'dsh-web-frontend')
  return { upstream, host, runtime, frontend, packagePath }
}

function link(from, target, packagePath) {
  const path = join(from, packagePath)
  mkdirSync(join(path, '..'), { recursive: true })
  symlinkSync(target, path)
}

function packageManifest(path) {
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-web-frontend' }) + '\n')
}

test('fails when frontend is absent without creating a build output', t => {
  const f = fixture(t)
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 1)
  assert.equal(result.facts.hostManifestResolvable, false)
  assert.equal(result.facts.rendererIndexExists, false)
  assert.ok(Object.values(result.facts).every(value => typeof value === 'boolean'))
})

test('fails when packages resolve but index is missing', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  link(f.host, f.frontend, f.packagePath)
  link(f.runtime, f.frontend, f.packagePath)
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 1)
  assert.equal(result.facts.hostManifestResolvable, true)
  assert.equal(result.facts.rendererManifestResolvable, true)
  assert.equal(result.facts.hostIndexExists, false)
})

test('checks both resolvers and preserves readable artifact bytes', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  const index = join(f.frontend, 'dist', 'index.html')
  writeFileSync(index, '<html><head></head><body>synthetic</body></html>')
  const before = readFileSync(index)
  link(f.host, f.frontend, f.packagePath)
  link(f.runtime, f.frontend, f.packagePath)
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 0)
  assert.equal(result.facts.samePhysicalIndex, true)
  assert.deepEqual(readFileSync(index), before)
  assert.equal(verifyDesktopWeb(f.upstream).facts.rendererChecked, false)
})

test('fails when only Host has a readable frontend', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  writeFileSync(join(f.frontend, 'dist', 'index.html'), '<html>synthetic</html>')
  link(f.host, f.frontend, f.packagePath)
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 1)
  assert.equal(result.facts.hostIndexReadable, true)
  assert.equal(result.facts.rendererIndexReadable, false)
})

test('fails for an unreadable index without changing its permissions', {
  skip: process.platform === 'win32' || process.getuid?.() === 0,
}, t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  const index = join(f.frontend, 'dist', 'index.html')
  writeFileSync(index, '<html>synthetic</html>')
  link(f.host, f.frontend, f.packagePath)
  link(f.runtime, f.frontend, f.packagePath)
  chmodSync(index, 0o000)
  try {
    const result = verifyDesktopWeb(f.upstream, f.runtime)
    assert.equal(result.exitCode, 1)
    assert.equal(result.facts.hostIndexExists, true)
    assert.equal(result.facts.hostIndexReadable, false)
    assert.equal(result.facts.rendererIndexReadable, false)
    assert.equal(statSync(index).mode & 0o777, 0o000)
  } finally {
    chmodSync(index, 0o600)
  }
})
