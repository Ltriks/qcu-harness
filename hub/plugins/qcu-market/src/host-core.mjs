import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { release } from './trusted-release.mjs'
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (ok, message) => { if (!ok) throw new Error(message) }
export function validateRelease(entry = release) {
  check(entry.id === 'qcu-study-coach' && entry.skill === entry.id && entry.version === '0.1.0-pilot.2', 'Untrusted identity')
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
export async function inspectCoach({ manager, skills, agent, entry = release }) {
  const [bundles, rows, skill] = await Promise.all([
    manager.listBundles(), manager.listPlugins(),
    skills.get(entry.skill, { cwd: agent.session.header.cwd, scope: agent }),
  ])
  const bundle = bundles.find(b => b.name === entry.id)
  const named = rows.filter(r => r.moduleName === entry.id)
  const expectedSkill = skill?.provider === entry.provider && digest(skill.content) === entry.skillSha256
  if (skill && !expectedSkill) return { state: 'conflict', reason: 'A different skill wins this name in the selected session; no overwrite.' }
  if (!bundle?.installed) return { state: skill ? 'conflict' : 'not-installed' }
  if (bundle.version !== entry.version) return { state: 'conflict', reason: 'Another package version is installed; explicit upgrade review required.' }
  if (bundle.error || named.some(r => r.fiberPhase === 'failed')) return { state: 'failed', reason: 'Official loader reports a failure; inspect plugin details.' }
  if (!bundle.enabled) return { state: 'installed-disabled', version: bundle.version }
  if (named.length !== 1 || !named[0].enabled || named[0].fiberPhase !== 'active') return { state: 'activation-required', rowIds: named.map(r => r.entryId) }
  if (!expectedSkill) return { state: 'skill-unavailable', reason: 'Installed and active, but the exact skill is not visible; restart or resolve composition.' }
  return { state: 'ready', version: bundle.version, skill: entry.skill, provider: entry.provider }
}
export function installRequest(path, entry = release) {
  return `请仅安装并启用 QCU 学习方法教练 ${entry.id}@${entry.version}。市场已校验固定包大小 ${entry.bytes} 字节，SHA256 ${entry.sha256}。本机文件：${JSON.stringify(path)}。\n保持需要逐次审批的会话权限模式；若处于全权限模式则停止并请我手动调整，不更改权限。先调用 qcu_market action=verify 复核该固定缓存，再使用官方 plugin_manager；每次管理调用保留官方审批，拒绝或取消立即停止，不换工具、不用shell安装、不重试授权。先 list_bundles/list_plugins 检查同名；若已有其他版本或同名技能则停止，不覆盖。以 install_bundle target=上述绝对文件路径 enabled=false 安装，不传 approvedBuilds、不豁免版本、不改权限模式。仅成功后逐次审批 set_bundle enabled=true，再重新 list_plugins 获取精确组件entryId并 set_plugin enabled=true。若返回 restart-required 告知我正常重启，不冒充已运行。出现失败或未知结果先停止核对，不重复安装。最后调用 qcu_market action=status；只有 ready 才报告技能可用。不要开始学习或发送额外任务。`
}
export class MarketOperations {
  constructor({ inspect, download = fetchPinned, verify = verifyFile, entry = release, authorize = () => {} }) { this.authorize = authorize; this.inspect = inspect; this.download = download; this.verify = verify; this.entry = entry; this.pending = new Map(); this.prepared = new Map() }
  async run(action, agent, signal) {
    check(['status', 'prepare', 'verify', 'cancel'].includes(action), 'Unsupported action; no management endpoint')
    const key = agent.session.id
    if (action === 'cancel') { this.pending.get(key)?.abort(); this.prepared.delete(key); return { state: 'cancelled' } }
    if (action === 'status') return this.inspect(agent)
    await this.authorize(agent)
    if (action === 'verify') {
      const path = this.prepared.get(key)
      check(path, 'No prepared package in this session; prepare again')
      await this.verify(path, this.entry); return { state: 'verified', path, sha256: this.entry.sha256 }
    }
    check(!this.pending.has(key), 'Preparation already in progress')
    const controller = new AbortController(); this.pending.set(key, controller)
    try {
      const current = await this.inspect(agent)
      check(current.state === 'not-installed', `Preparation blocked: ${current.state}; use official details for activation or review`)
      const combined = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])])
      combined.throwIfAborted()
      const path = await this.download({ entry: this.entry, signal: combined })
      combined.throwIfAborted(); this.prepared.set(key, path)
      return { state: 'prepared', version: this.entry.version, sha256: this.entry.sha256, prompt: installRequest(path, this.entry) }
    } finally { this.pending.delete(key) }
  }
  dispose() { for (const c of this.pending.values()) c.abort(); this.pending.clear(); this.prepared.clear() }
}
