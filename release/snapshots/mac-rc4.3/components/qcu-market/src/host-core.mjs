import {bundledCatalog,catalogSha256} from './bundled-catalog.mjs'
import {findMarketRelease,releaseKeyOf,validateMarketRelease} from './catalog-core.mjs'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { release } from './trusted-release.mjs'
import {CatalogAuthority,privateDirectory} from './catalog-authority.mjs'
import {publicTrust} from './public-trust.mjs'
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (ok, message) => { if (!ok) throw new Error(message) }
export function validateRelease(entry = release) {
  const item=bundledCatalog.entries.find(item=>item.id===entry.id)
  check(item,'Unreviewed package identity')
  validateMarketRelease({...item,release:entry})
  return `${entry.origin}/plugins/${entry.file}`
}
async function safeDir(path) {
  try { await mkdir(path, { mode: 0o700 }) } catch (e) { if (e.code !== 'EEXIST') throw e }
  const info = await lstat(path)
  check(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid(), 'Unsafe cache directory')
  return path
}
export async function verifyFile(path, entry = release, validate=validateRelease) {
  validate(entry)
  const info = await lstat(path)
  check(info.isFile() && !info.isSymbolicLink() && info.nlink===1 && info.uid === process.getuid() && info.size === entry.bytes, 'Unsafe cached package')
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const actual = await file.stat()
    check(actual.ino === info.ino && actual.dev === info.dev && actual.size === entry.bytes, 'Cached file changed')
    const bytes = await file.readFile()
    check(bytes.length === entry.bytes && digest(bytes) === entry.sha256, 'Package integrity failure')
    return path
  } finally { await file.close() }
}
export async function fetchPinned({ entry = release, fetcher = fetch, signal, root = join(homedir(), '.cache', 'qcu-market'),validate=validateRelease } = {}) {
  const url = validate(entry)
  // Production root is plugin-owned and fixed; no RPC/tool accepts root, URL or path.
  await safeDir(join(root, '..'))
  await safeDir(root)
  await privateDirectory(root)
  const path = join(root, entry.file)
  try { await verifyFile(path, entry,validate); signal?.throwIfAborted(); return path } catch (e) { if (e.code !== 'ENOENT') throw e }
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
      await unlink(temp)
      return await verifyFile(path, entry,validate)
    } finally { await file?.close(); await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e }) }
  } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => {}) }
}
// Receipts bind a fixed reviewed release to bytes, not user authority.
export class PackagePreparation {
  constructor({download,verify,entry=release,catalog=bundledCatalog,fingerprint=catalogSha256,now=()=>Date.now(),authority=publicTrust?new CatalogAuthority(publicTrust):null}={}) { this.authority=authority;this.download=download||(options=>fetchPinned({...options,validate:e=>this.releaseUrl(e)}));this.verifyBytes=verify||((path,e)=>verifyFile(path,e,v=>this.releaseUrl(v)));this.entry=entry;this.catalog=catalog;this.fingerprint=fingerprint;this.now=now;this.pending=new Map();this.receipts=new Map() }
  releaseUrl(entry){if(!this.authority)return validateRelease(entry);check(JSON.stringify(entry)===JSON.stringify(findMarketRelease(this.catalog,releaseKeyOf(entry))),'Untrusted release');return `${entry.origin}/plugins/${entry.file}`}
  async refresh(){if(!this.authority)return JSON.stringify({mode:'legacy',state:'legacy',catalog:this.catalog,fingerprint:this.fingerprint,message:'固定内置目录（未配置动态信任）',lastRefresh:null});const state=await this.authority.refresh();this.catalog=state.catalog;this.fingerprint=state.fingerprint;return JSON.stringify(state)}
  async fresh(fingerprint,key){if(!this.authority)return;const s=await this.authority.require(fingerprint,key);this.catalog=s.catalog;this.fingerprint=s.fingerprint}
  prune(){for(const [id,r] of this.receipts)if(r.expiresAt<=this.now())this.receipts.delete(id)}
  async prepare(id,key=releaseKeyOf(this.entry),signal){
    check(!this.disposed,'Preparation service disposed')
    if(this.authority){await this.refresh();check(this.authority.state==='fresh','Fresh catalog authority unavailable')}
    check(!this.disposed,'Preparation service disposed')
    const entry=findMarketRelease(this.catalog,key)
    const fingerprint=this.fingerprint
    this.prune();check(!this.receipts.has(id),'Receipt already exists');check(!this.pending.has(id),'Preparation already running');check(this.pending.size<1,'Another preparation is running');check(this.receipts.size<16,'Too many outstanding receipts')
    const controller=new AbortController();this.pending.set(id,controller)
    try{
      const combined=AbortSignal.any([controller.signal,...(signal?[signal]:[])]);combined.throwIfAborted()
      const path=await this.download({entry,signal:combined});combined.throwIfAborted()
      await this.fresh(fingerprint,key);combined.throwIfAborted()
      const receipt={id,path,entry,releaseKey:key,catalogSha256:fingerprint,expiresAt:this.now()+5*60*1000}
      this.receipts.set(id,receipt);return JSON.stringify(receipt)
    }finally{this.pending.delete(id)}
  }
  async verify(id,signal){check(!this.disposed,'Preparation service disposed');this.prune();const receipt=this.receipts.get(id);check(receipt,'Receipt expired or cancelled');await this.fresh(receipt.catalogSha256,receipt.releaseKey);signal?.throwIfAborted();check(!this.disposed&&receipt.catalogSha256===this.fingerprint&&JSON.stringify(receipt.entry)===JSON.stringify(findMarketRelease(this.catalog,receipt.releaseKey)),'Release changed');await this.verifyBytes(receipt.path,receipt.entry);await this.fresh(receipt.catalogSha256,receipt.releaseKey);signal?.throwIfAborted();check(!this.disposed&&this.receipts.get(id)===receipt&&receipt.expiresAt>this.now(),'Receipt expired or cancelled');return JSON.stringify(receipt)}
  cancel(id){this.pending.get(id)?.abort();this.receipts.delete(id);return JSON.stringify({state:'cancelled'})}
  dispose(){this.disposed=true;for(const c of this.pending.values())c.abort();this.pending.clear();this.receipts.clear()}
}
