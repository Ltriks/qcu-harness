import { createHash } from 'node:crypto'
import { lstat, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isIP } from 'node:net'

export const MAX_CATALOG_BYTES = 256 * 1024
export const MAX_PACKAGE_BYTES = 32 * 1024 * 1024
const hashPattern = /^[a-f0-9]{64}$/
const idPattern = /^[a-z][a-z0-9-]{0,79}$/
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
function requireThat(ok, code) { if (!ok) throw new Error(code) }
function keys(obj, allowed) {
  requireThat(obj && typeof obj === 'object' && !Array.isArray(obj), 'invalid-record')
  requireThat(Object.keys(obj).every(key => allowed.includes(key)), 'unknown-field')
}

// Explicit exact-version compatibility declarations; the official installer still
// enforces its own peer compatibility and lifecycle gates.
export function validateCatalog(catalog) {
  keys(catalog, ['schemaVersion', 'revision', 'title', 'tagline', 'updated_at', 'compatible_dsh', 'install_hint', 'skill_hint', 'plugin_hint', 'audience', 'publicRelease', 'skills', 'plugins'])
  requireThat(catalog.schemaVersion === 1 && idPattern.test(catalog.revision), 'invalid-schema-or-revision')
  requireThat(catalog.audience === 'lan-private' && catalog.publicRelease === false, 'not-private-lan')
  for (const field of ['title', 'tagline', 'updated_at', 'compatible_dsh', 'install_hint', 'skill_hint', 'plugin_hint']) {
    requireThat(typeof catalog[field] === 'string' && catalog[field].length <= 2000, 'invalid-display-field')
  }
  const versions = new Set()
  let aggregateBytes = 0
  for (const kind of ['skills', 'plugins']) {
    requireThat(Array.isArray(catalog[kind]) && catalog[kind].length <= 100, 'invalid-entry-list')
    for (const entry of catalog[kind]) {
      keys(entry, ['id', 'name', 'category', 'version', 'risk', 'summary', 'status', 'file', 'sha256', 'bytes', 'dshVersions', 'review', 'synthetic', 'defaultDisabled'])
      requireThat(idPattern.test(entry.id) && versionPattern.test(entry.version), 'invalid-package-identity')
      requireThat(hashPattern.test(entry.sha256), 'invalid-hash')
      requireThat(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_PACKAGE_BYTES, 'invalid-package-size')
      aggregateBytes += entry.bytes
      requireThat(aggregateBytes <= 64 * 1024 * 1024, 'release-too-large')
      const suffix = kind === 'plugins' ? 'tgz' : 'zip'
      requireThat(entry.file === `${entry.id}-${entry.version}-${entry.sha256}.${suffix}`, 'nonimmutable-filename')
      requireThat(entry.status === 'published' && entry.review === 'approved', 'not-reviewed')
      requireThat(typeof entry.synthetic === 'boolean', 'missing-synthetic-label')
      if (kind === 'plugins') requireThat(entry.defaultDisabled === true, 'unsafe-plugin-default')
      requireThat(Array.isArray(entry.dshVersions) && entry.dshVersions.length > 0 && entry.dshVersions.length <= 10 && entry.dshVersions.every(v => versionPattern.test(v)), 'unbounded-compatibility')
      for (const field of ['name', 'category', 'risk', 'summary']) requireThat(typeof entry[field] === 'string' && entry[field].length <= 1000, 'invalid-entry-text')
      const key = `${kind}/${entry.id}@${entry.version}`
      requireThat(!versions.has(key), 'duplicate-package-version')
      versions.add(key)
    }
  }
  return catalog
}

async function regularBytes(path, cap) {
  const info = await lstat(path)
  requireThat(info.isFile() && !info.isSymbolicLink() && info.size <= cap, 'unsafe-resource')
  const bytes = await readFile(path)
  requireThat(bytes.length <= cap, 'oversize-resource')
  return bytes
}

export async function verifyDirectory(root) {
  const info = await lstat(root)
  requireThat(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-directory')
  const bytes = await regularBytes(join(root, 'catalog.json'), MAX_CATALOG_BYTES)
  const catalog = validateCatalog(JSON.parse(bytes.toString('utf8')))
  for (const kind of ['skills', 'plugins']) {
    if (catalog[kind].length) {
      const info = await lstat(join(root, kind))
      requireThat(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-package-directory')
    }
    for (const entry of catalog[kind]) {
      const bytes = await regularBytes(join(root, kind, entry.file), MAX_PACKAGE_BYTES)
      requireThat(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, 'package-integrity-mismatch')
    }
  }
  return { catalog, catalogSha256: sha256(bytes) }
}

// Fresh release directories only; no running service path, symlink or App profile
// is adopted. This prepares an artifact, never changes deployment state.
export async function stageRelease(source, target) {
  const verified = await verifyDirectory(source)
  await mkdir(target, { recursive: false, mode: 0o700 })
  try {
    const sourceAgain = await verifyDirectory(source)
    requireThat(sourceAgain.catalogSha256 === verified.catalogSha256, 'catalog-changed-during-stage')
    for (const name of ['index.html', 'themes.html']) {
      const bytes = await regularBytes(fileURLToPath(new URL(`../web/${name}`, import.meta.url)), 512 * 1024)
      await writeFile(join(target, name), bytes, { flag: 'wx', mode: 0o444 })
    }
    await writeFile(join(target, 'catalog.json'), await regularBytes(join(source, 'catalog.json'), MAX_CATALOG_BYTES), { flag: 'wx', mode: 0o444 })
    for (const kind of ['skills', 'plugins']) {
      await mkdir(join(target, kind), { mode: 0o700 })
      for (const entry of verified.catalog[kind]) {
        const bytes = await regularBytes(join(source, kind, entry.file), MAX_PACKAGE_BYTES)
        requireThat(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, 'package-integrity-mismatch')
        await writeFile(join(target, kind, entry.file), bytes, { flag: 'wx', mode: 0o444 })
      }
    }
    requireThat((await verifyDirectory(target)).catalogSha256 === verified.catalogSha256, 'catalog-changed-during-stage')
    return verified.catalogSha256
  } catch (error) { await rm(target, { recursive: true, force: true }); throw error }
}

function originUrl(raw) {
  const url = new URL(raw)
  requireThat(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'invalid-origin')
  const host = url.hostname
  const privateV4 = isIP(host) === 4 && (/^(?:127\.|10\.|192\.168\.)/.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host))
  requireThat(url.protocol === 'https:' || (url.protocol === 'http:' && privateV4), 'untrusted-http-origin')
  return url
}

async function boundedFetch(url, cap, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  requireThat(response.ok && !response.redirected && (!response.url || response.url === url.href), 'download-http-failure')
  const declared = response.headers.get('content-length')
  if (declared !== null) requireThat(/^\d+$/.test(declared) && Number(declared) <= cap, 'download-too-large')
  requireThat(response.body, 'download-no-body')
  const reader = response.body.getReader()
  const chunks = []; let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      total += value.byteLength
      requireThat(total <= cap, 'download-too-large')
      chunks.push(Buffer.from(value))
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
  return Buffer.concat(chunks, total)
}

export function selectVersion(catalog, kind, id, version, dshVersion) {
  validateCatalog(catalog)
  requireThat(['plugins', 'skills'].includes(kind), 'invalid-kind')
  const entry = catalog[kind].find(e => e.id === id && e.version === version)
  requireThat(entry && entry.dshVersions.includes(dshVersion), 'missing-or-incompatible-version')
  return entry
}

// catalogPin must come from an independently trusted delivery channel. A hash
// served by the same unauthenticated LAN site is NOT source authentication.
export async function fetchPinned({ origin, catalogPin, kind, id, version, dshVersion, target, fetchImpl = fetch }) {
  requireThat(hashPattern.test(catalogPin), 'missing-trusted-catalog-pin')
  const base = originUrl(origin)
  const bytes = await boundedFetch(new URL('catalog.json', base), MAX_CATALOG_BYTES, fetchImpl)
  requireThat(sha256(bytes) === catalogPin, 'catalog-trust-mismatch')
  const catalog = JSON.parse(bytes.toString('utf8'))
  const entry = selectVersion(catalog, kind, id, version, dshVersion)
  const archive = await boundedFetch(new URL(`${kind}/${entry.file}`, base), entry.bytes, fetchImpl)
  requireThat(archive.length === entry.bytes && sha256(archive) === entry.sha256, 'package-integrity-mismatch')
  await writeFile(target, archive, { flag: 'wx', mode: 0o444 })
  return { id: entry.id, version: entry.version, sha256: entry.sha256, bytes: entry.bytes, installed: false }
}

export function planChange({ catalog, previousCatalog, kind, id, fromVersion, toVersion, dshVersion }) {
  const from = selectVersion(previousCatalog, kind, id, fromVersion, dshVersion)
  const to = selectVersion(catalog, kind, id, toVersion, dshVersion)
  requireThat(fromVersion !== toVersion, 'no-version-change')
  // Same identity/version must never acquire different content in a new catalog.
  for (const old of previousCatalog[kind]) {
    const current = catalog[kind].find(e => e.id === old.id && e.version === old.version)
    if (current) requireThat(current.sha256 === old.sha256 && current.bytes === old.bytes, 'version-content-rewritten')
  }
  return { id, from, to, rollback: from, automatic: false, installed: false,
    rollbackArtifactMustBeRetained: true, priorCatalogPinRequired: true,
    profileDataRollbackVerified: false, officialApprovalAndRestartRequired: kind === 'plugins' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, ...args] = process.argv.slice(2)
    if (action === 'verify' && args.length === 1) {
      const { catalog, catalogSha256 } = await verifyDirectory(args[0]); console.log(JSON.stringify({ revision: catalog.revision, catalogSha256, verified: true }))
    } else if (action === 'stage' && args.length === 2) {
      console.log(JSON.stringify({ catalogSha256: await stageRelease(args[0], args[1]), deployed: false }))
    } else if (action === 'fetch' && args.length === 8) {
      const [origin, catalogPin, kind, id, version, dshVersion, target, confirmation] = args
      requireThat(confirmation === '--trusted-origin', 'explicit-origin-confirmation-required')
      console.log(JSON.stringify(await fetchPinned({ origin, catalogPin, kind, id, version, dshVersion, target })))
    } else throw new Error('usage: verify ROOT | stage SOURCE NEW_DIRECTORY | fetch ORIGIN CATALOG_SHA256 KIND ID EXACT_VERSION DSH_VERSION NEW_FILE --trusted-origin')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
