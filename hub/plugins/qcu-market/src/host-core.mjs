import {bundledCatalog,catalogSha256} from './bundled-catalog.mjs'
import {findMarketRelease,releaseKeyOf} from './catalog-core.mjs'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { release } from './trusted-release.mjs'
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (ok, message) => { if (!ok) throw new Error(message) }
export function validateRelease(entry = release) {
  check(/^qcu-[a-z0-9-]+$/.test(entry.id) && entry.skill === entry.id && /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(entry.version), 'Untrusted identity')
  check(entry.origin === 'http://192.168.1.68:8080', 'Untrusted origin')
  check(/^[a-f0-9]{64}$/.test(entry.sha256) && /^[a-f0-9]{64}$/.test(entry.skillSha256), 'Invalid digest')
  check(entry.file === `${entry.id}-${entry.version}-${entry.sha256}.tgz`, 'Invalid immutable filename')
  check(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 1024 * 1024, 'Invalid package size')
  return `${entry.origin}/plugins/${entry.file}`
}
async function safeDir(path) {
  try { await mkdir(path, { mode: 0o700 }) } catch (e) { if (e.code !== 'EEXIST') throw e }
  const info = await lstat(path)
  check(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid(), 'Unsafe cache directory')
  return path
}
export async function verifyFile(path, entry = release) {
  const info = await lstat(path)
  check(info.isFile() && !info.isSymbolicLink() && info.uid === process.getuid() && info.size === entry.bytes, 'Unsafe cached package')
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const actual = await file.stat()
    check(actual.ino === info.ino && actual.dev === info.dev && actual.size === entry.bytes, 'Cached file changed')
    const bytes = await file.readFile()
    check(bytes.length === entry.bytes && digest(bytes) === entry.sha256, 'Package integrity failure')
    return path
  } finally { await file.close() }
}
export async function fetchPinned({ entry = release, fetcher = fetch, signal, root = join(homedir(), '.cache', 'qcu-market') } = {}) {
  const url = validateRelease(entry)
  // Production root is plugin-owned and fixed; no RPC/tool accepts root, URL or path.
  await safeDir(join(root, '..'))
  await safeDir(root)
  const path = join(root, entry.file)
  try { await verifyFile(path, entry); signal?.throwIfAborted(); return path } catch (e) { if (e.code !== 'ENOENT') throw e }
  const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(30000)])
  const response = await fetcher(url, { redirect: 'manual', credentials: 'omit', headers: { 'Accept-Encoding': 'identity' }, signal: bounded })
  try {
    check(response.status === 200 && !response.redirected && (!response.url || response.url === url), 'Download refused: status or redirect')
    check(!response.headers.get('content-encoding') || response.headers.get('content-encoding') === 'identity', 'Encoded package refused')
    const length = response.headers.get('content-length')
    check(length !== null && /^\d+$/.test(length) && Number(length) === entry.bytes, 'Download size mismatch')
    check(response.body, 'Missing download body')
    const chunks = []; let bytes = 0
    for await (const chunk of response.body) {
      bounded.throwIfAborted(); bytes += chunk.length
      check(bytes <= entry.bytes, 'Download too large'); chunks.push(chunk)
    }
    bounded.throwIfAborted()
    const data = Buffer.concat(chunks)
    check(data.length === entry.bytes && digest(data) === entry.sha256, 'Package integrity failure')
    const temp = join(root, `.partial-${randomUUID()}`)
    let file
    try {
      file = await open(temp, 'wx', 0o400); await file.writeFile(data); await file.sync(); await file.close(); file = null
      bounded.throwIfAborted()
      try { await link(temp, path) } catch (e) { if (e.code !== 'EEXIST') throw e }
      return await verifyFile(path, entry)
    } finally { await file?.close(); await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e }) }
  } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => {}) }
}
// Receipts bind a fixed reviewed release to bytes, not user authority.
export class PackagePreparation {
  constructor({download=fetchPinned,verify=verifyFile,entry=release,catalog=bundledCatalog,fingerprint=catalogSha256,now=()=>Date.now()}={}) { this.download=download;this.verifyBytes=verify;this.entry=entry;this.catalog=catalog;this.fingerprint=fingerprint;this.now=now;this.pending=new Map();this.receipts=new Map() }
  prune(){for(const [id,r] of this.receipts)if(r.expiresAt<=this.now())this.receipts.delete(id)}
  async prepare(id,key=releaseKeyOf(this.entry),signal){
    const entry=findMarketRelease(this.catalog,key)
    this.prune();check(!this.receipts.has(id),'Receipt already exists');check(!this.pending.has(id),'Preparation already running');check(this.pending.size<1,'Another preparation is running');check(this.receipts.size<16,'Too many outstanding receipts')
    const controller=new AbortController();this.pending.set(id,controller)
    try{
      const combined=AbortSignal.any([controller.signal,...(signal?[signal]:[])]);combined.throwIfAborted()
      const path=await this.download({entry,signal:combined});combined.throwIfAborted()
      const receipt={id,path,entry,releaseKey:key,catalogSha256:this.fingerprint,expiresAt:this.now()+5*60*1000}
      this.receipts.set(id,receipt);return JSON.stringify(receipt)
    }finally{this.pending.delete(id)}
  }
  async verify(id,signal){this.prune();const receipt=this.receipts.get(id);check(receipt,'Receipt expired or cancelled');signal?.throwIfAborted();check(receipt.catalogSha256===this.fingerprint&&JSON.stringify(receipt.entry)===JSON.stringify(findMarketRelease(this.catalog,receipt.releaseKey)),'Release changed');await this.verifyBytes(receipt.path,receipt.entry);signal?.throwIfAborted();check(this.receipts.get(id)===receipt&&receipt.expiresAt>this.now(),'Receipt expired or cancelled');return JSON.stringify(receipt)}
  cancel(id){this.pending.get(id)?.abort();this.receipts.delete(id);return JSON.stringify({state:'cancelled'})}
  dispose(){for(const c of this.pending.values())c.abort();this.pending.clear();this.receipts.clear()}
}
