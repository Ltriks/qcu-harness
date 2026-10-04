/** Synthetic frontend resolution cases; no Electron, credentials, private data or models. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, chmodSync, statSync } from 'node:fs'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'
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
  mkdirSync(dirname(path), { recursive: true })
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
  assert.equal(result.facts.rendererManifestPresent, true)
  assert.equal(result.facts.hostIndexExists, false)
})

test('accepts the official direct runtime package symlink and preserves artifact bytes', t => {
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

test('rejects ancestor-only frontend even when Node can resolve it for runtime', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  writeFileSync(join(f.frontend, 'dist', 'index.html'), '<html>synthetic</html>')
  link(f.host, f.frontend, f.packagePath)
  link(dirname(f.runtime), f.frontend, f.packagePath)
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 1)
  assert.equal(result.facts.hostIndexReadable, true)
  assert.equal(result.facts.rendererIndexExists, false)
  assert.equal(result.facts.rendererIndexReadable, false)
  assert.equal(result.facts.samePhysicalIndex, false)
})

test('checks the actual runtime index without requiring a Renderer package manifest', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  writeFileSync(join(f.frontend, 'dist', 'index.html'), '<html>synthetic Host</html>')
  link(f.host, f.frontend, f.packagePath)
  const direct = join(f.runtime, f.packagePath, 'dist')
  mkdirSync(direct, { recursive: true })
  writeFileSync(join(direct, 'index.html'), '<html>synthetic Renderer</html>')
  const result = verifyDesktopWeb(f.upstream, f.runtime)
  assert.equal(result.exitCode, 0)
  assert.equal(result.facts.rendererIndexReadable, true)
  assert.equal(result.facts.rendererManifestPresent, false)
  assert.equal(result.facts.samePhysicalIndex, false)
})

test('fails safely when index disappears after access checks and before canonical comparison', t => {
  const f = fixture(t)
  packageManifest(f.frontend)
  mkdirSync(join(f.frontend, 'dist'))
  const index = join(f.frontend, 'dist', 'index.html')
  writeFileSync(index, '<html>synthetic</html>')
  link(f.host, f.frontend, f.packagePath)
  link(f.runtime, f.frontend, f.packagePath)
  const original = fs.realpathSync
  const canonicalIndex = original(index)
  let removed = false
  fs.realpathSync = function(path, ...args) {
    if (path === index || path === canonicalIndex) {
      rmSync(index)
      removed = true
    }
    return original(path, ...args)
  }
  syncBuiltinESMExports()
  let result
  try {
    result = verifyDesktopWeb(f.upstream, f.runtime)
  } finally {
    fs.realpathSync = original
    syncBuiltinESMExports()
  }
  assert.equal(removed, true)
  assert.equal(result.exitCode, 1)
  assert.equal(result.facts.artifactCheckCompleted, false)
  assert.equal(result.facts.samePhysicalIndex, false)
  assert.ok(Object.values(result.facts).every(value => typeof value === 'boolean'))
  assert.equal(JSON.stringify(result).includes(dirname(f.upstream)), false)
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
