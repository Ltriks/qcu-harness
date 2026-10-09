import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyDirectory, sha256 } from './catalog.mjs'

// Explicit numeric bind only, read-only allowlist, no directory listing/fallback.
// No launchd, firewall, Docker, DNS, installation or profile operations.
export async function createCatalogServer(root, { host = '127.0.0.1', lanApproved = false } = {}) {
  const privateV4 = isIP(host) === 4 && (/^(?:10\.|192\.168\.)/.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host))
  if (host !== '127.0.0.1' && !(lanApproved && privateV4)) throw new Error('explicit-private-lan-bind-required')
  const { catalog, catalogSha256 } = await verifyDirectory(root)
  // Snapshot only these verified immutable resources; file replacement after
  // verification is checked again. No credentials, logs or other directory data.
  const resources = new Map()
  const catalogBytes = await readFile(join(root, 'catalog.json'))
  if (sha256(catalogBytes) !== catalogSha256) throw new Error('catalog-changed')
  resources.set('/catalog.json', { bytes: catalogBytes, type: 'application/json; charset=utf-8', immutable: false })
  for (const name of ['index.html', 'themes.html']) resources.set(name === 'index.html' ? '/' : '/themes.html', { bytes: await readFile(fileURLToPath(new URL(`../web/${name}`, import.meta.url))), type: 'text/html; charset=utf-8', immutable: false })
  resources.set('/index.html', resources.get('/'))
  for (const kind of ['plugins', 'skills']) for (const entry of catalog[kind]) {
    const bytes = await readFile(join(root, kind, entry.file))
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error('package-integrity-mismatch')
    resources.set(`/${kind}/${entry.file}`, { bytes, type: 'application/octet-stream', immutable: true })
  }
  return createServer((req, res) => {
    const port = res.socket.localPort
    if (req.headers.host !== `${host}:${port}` || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403); res.end(); return }
    const resource = resources.get(req.url)
    if (!resource) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': resource.type, 'Content-Length': resource.bytes.length,
      'Cache-Control': resource.immutable ? 'public, max-age=31536000, immutable' : 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
    res.end(req.method === 'HEAD' ? undefined : resource.bytes)
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [root, host = '127.0.0.1', portText = '8080', confirmation] = process.argv.slice(2)
    if (!root || process.argv.length > 6 || !/^\d+$/.test(portText)) throw new Error('usage: serve.mjs ROOT [NUMERIC_HOST] [PORT] [--lan-approved]')
    const port = Number(portText)
    if (port < 1024 || port > 65535) throw new Error('nonprivileged-port-required')
    const server = await createCatalogServer(root, { host, lanApproved: confirmation === '--lan-approved' })
    server.on('error', error => { console.error(error.code || 'listen-failed'); process.exitCode = 1 })
    server.listen(port, host, () => console.log(JSON.stringify({ host, port, readOnly: true, authenticated: false, publicRelease: false })))
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close())
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
