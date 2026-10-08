/** Public official upgrade API + official cookie admission + canonical Python worker. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { BrowserAuth } from '@deepseek-ai/dsh-client-connection/src/browser-auth.ts'
import type { CredentialProvider, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { WebSocket } from 'ws'
import { afterEach, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as TaskHost from '../lib/task-host.js'
import type { Config } from '../lib/task-host.js'
import { CsvTaskController } from '../src/client/controller.ts'
import { socketTransport } from '../src/client/socket-transport.ts'
import { TASK_WS_PATH, TASK_WS_PROTOCOL } from '../src/task-protocol.ts'

const cleanup = vi.hoisted(() => ({ root: '', fail: false }))
vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, rm: async (...args: Parameters<typeof actual.rm>) => {
    if (cleanup.fail && String(args[0]).startsWith(`${cleanup.root}/run-`)) throw new Error('synthetic cleanup failure')
    return actual.rm(...args)
  } }
})
const cleanupTasks: Array<() => Promise<void>> = []
interface Reply { id: number; ok: boolean; value: Record<string, unknown>; error?: string }
async function fixture(overrides: Partial<Config> = {}) {
  const home = await mkdtemp(join(tmpdir(), 'qcu-csv-ws-')); await chmod(home, 0o700)
  const ctx = new Context()
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const origin = `http://127.0.0.1:${ctx.webServer.port}`
  let record: CredentialRecord | undefined
  const credentials = { readRecord: async () => record,
    modifyRecord: async (_key: unknown, mutate: (value: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
      const next = await mutate(record); if (next !== undefined) record = next; return record
    } } as unknown as CredentialProvider
  const auth = await BrowserAuth.create(ctx.root, credentials, 1)
  new HostConnectionService(ctx, [], auth as unknown as ConstructorParameters<typeof HostConnectionService>[2])
  let cookie = ''
  auth.authorizeIndex({ method: 'GET', headers: { host: new URL(origin).host }, url: auth.authenticatedUrl(origin + '/') },
    { writeHead: (_status, headers) => { cookie = headers?.['set-cookie']?.split(';')[0] ?? '' }, end: () => {} })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  const config: Config = { enabled: true, websocketEnabled: true, mode: 'isolated-local-csv',
    python: process.env.QCU_TEST_PYTHON!, workRoot: home, maxInputBytes: 100000, maxRuleBytes: 10000,
    maxReportBytes: 1000000, timeoutMs: 10000, terminateMs: 100, maxConcurrentRuns: 1, maxRows: 1000,
    maxColumns: 128, maxIssues: 10000, grantMs: 60000, maxPages: 4, ...overrides }
  const fiber = ctx.plugin(TaskHost, config); await fiber.await()
  const shared = ctx.connection.createSharedFetchHandler('/api')
  const httpAnswer = async (value: Record<string, unknown>, page: string) => {
    const res = await shared.fetch(new Request(origin + '/api/qcu-csv-task', { method: 'POST', body: JSON.stringify(value),
      headers: { host: new URL(origin).host, origin, cookie, 'content-type': 'application/json', 'x-qcu-page': page } }))
    return { status: res.status, value: res.status === 404 ? {} : await res.json() as Record<string, unknown> }
  }
  const http = async (value: Record<string, unknown>, page: string) => (await httpAnswer(value, page)).status
  const clients = new Set<WebSocket>()
  const connect = async (extra: Record<string, string> = {}, query = '', protocol = TASK_WS_PROTOCOL) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + TASK_WS_PATH + query, protocol,
      { headers: { origin, cookie, ...extra }, handshakeTimeout: 2000 })
    ws.on('error', () => {})
    clients.add(ws)
    await new Promise<void>((done, reject) => {
      ws.once('open', done); ws.once('error', reject)
    })
    let id = 0
    const pending = new Map<number, (reply: Reply) => void>()
    ws.on('message', bytes => {
      const reply = JSON.parse(bytes.toString()) as Reply
      pending.get(reply.id)?.(reply); pending.delete(reply.id)
    })
    ws.on('close', () => {
      for (const [key, done] of pending) done({ id: key, ok: false, value: {} }); pending.clear()
    })
    const call = (value: Record<string, unknown>, page?: string): Promise<Reply> => {
      const key = ++id
      return new Promise(done => { pending.set(key, done); ws.send(JSON.stringify({ id: key, value, ...(page ? { page } : {}) })) })
    }
    const closed = () => ws.readyState === WebSocket.CLOSED ? Promise.resolve() : new Promise<void>(done => ws.once('close', () => done()))
    return { ws, call, closed, open: async () => String((await call({ operation: 'open' })).value.page), abort: () => ws.send(JSON.stringify({ abort: id })) }
  }
  cleanupTasks.push(async () => {
    for (const ws of clients) ws.terminate()
    cleanup.fail = false; await fiber.dispose(); await http({ operation: 'recover' }, '').catch(() => {}); await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true })
  })
  const csv = (await readFile(resolve('../../skills/qcu-table-audit/examples/input.csv'))).toString('base64')
  const authorize = (client: Awaited<ReturnType<typeof connect>>, page: string, revision = 1, extra: Record<string, unknown> = {}) =>
    client.call({ operation: 'authorize', revision, format: 'csv', purpose: 'diagnose-csv', consent: true,
      csv, ruleKind: 'demo', rules: {}, ...extra }, page)
  const transport = () => socketTransport(origin, (url, protocol) => new WebSocket(url, protocol,
    { headers: { origin, cookie } }) as unknown as globalThis.WebSocket)
  const replaceAuthenticationKey = async () => {
    let next: CredentialRecord | undefined
    const provider = { readRecord: async () => next,
      modifyRecord: async (_key: unknown, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
        const updated = await mutate(next); if (updated !== undefined) next = updated; return next
      } } as unknown as CredentialProvider
    const replacement = await BrowserAuth.create(ctx.root, provider, 1)
    // Simulate official auth-service reactivation with a new loaded key, not editing a live credentials file.
    return vi.spyOn(auth, 'isAuthenticated').mockImplementation(request => replacement.isAuthenticated(request))
  }
  return { ctx, fiber, config, home, connect, authorize, http, httpAnswer, csv, transport, replaceAuthenticationKey }
}
afterEach(async () => { cleanup.fail = false; for (const clean of cleanupTasks.splice(0)) await clean() })

it('uses real worker repeatedly and exposes only safe counts', async () => {
  const f = await fixture(); const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  expect(grant.ok).toBe(true)
  for (let n = 0; n < 2; n++) {
    const answer = await c.call({ operation: 'check', taskId: grant.value.taskId }, page)
    expect(answer.ok).toBe(true); expect(answer.value).toMatchObject({ rows: 4, issues: 7 })
    expect(Object.keys(answer.value).sort()).toEqual(['counts', 'issues', 'rows', 'status'])
    for (const privateValue of [f.csv, f.home, '示例甲', 'input.csv']) expect(JSON.stringify(answer)).not.toContain(privateValue)
  }
  expect(await readdir(f.home)).toEqual([])
})
it('binds grants to one socket and rejects cross-socket and raw HTTP redemption', async () => {
  const f = await fixture(); const a = await f.connect(); const b = await f.connect()
  const page = await a.open(); const other = await b.open(); const grant = await f.authorize(a, page)
  expect((await b.call({ operation: 'check', taskId: grant.value.taskId }, page)).ok).toBe(false)
  expect((await b.call({ operation: 'check', taskId: grant.value.taskId }, other)).ok).toBe(false)
  expect(await f.http({ operation: 'check', taskId: grant.value.taskId }, page)).toBe(400)
  expect(await f.http({ operation: 'cancel', revision: 2 }, page)).toBe(400)
  expect((await a.call({ operation: 'check', taskId: grant.value.taskId }, page)).ok).toBe(true)
})
it('keeps nonmissing exact Origin, Host, official cookie and subprotocol mandatory', async () => {
  const f = await fixture()
  for (const headers of [{ origin: '' }, { origin: 'null' }, { origin: 'https://example.invalid' },
    { cookie: '' }, { cookie: 'dsh_auth=forged' }, { host: '127.0.0.1:1' }, { 'sec-fetch-site': 'cross-site' }] as Array<Record<string, string>>) {
    await expect(f.connect(headers)).rejects.toThrow()
  }
  await expect(f.connect({}, '?x=1')).rejects.toThrow()
  await expect(f.connect({}, '', 'operator')).rejects.toThrow()
  const valid = await f.connect(); expect(await valid.open()).toMatch(/^[0-9a-f]{32}$/)
})
it('keeps the opt-in WebSocket transport disabled by default', async () => {
  const f = await fixture({ websocketEnabled: false })
  await expect(f.connect()).rejects.toThrow()
})
it('rejects path/consent/purpose changes and revokes replacement, cancel and expired grants', async () => {
  const f = await fixture(); const c = await f.connect(); const page = await c.open()
  for (const extra of [{ path: 'private.csv' }, { consent: false }, { purpose: 'clean-csv' }, { format: 'docx' }]) {
    expect((await f.authorize(c, page, 1, extra)).ok).toBe(false)
  }
  const first = await f.authorize(c, page)
  const second = await f.authorize(c, page, 2, { rules: {}, ruleKind: 'personal' })
  expect((await c.call({ operation: 'check', taskId: first.value.taskId }, page)).ok).toBe(false)
  expect((await c.call({ operation: 'check', taskId: second.value.taskId }, page)).ok).toBe(true)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Number(second.value.expiresAt) + 1)
  try { expect((await c.call({ operation: 'check', taskId: second.value.taskId }, page)).ok).toBe(false) }
  finally { clock.mockRestore() }
  expect((await c.call({ operation: 'cancel', revision: 3 }, page)).ok).toBe(true)
  expect((await c.call({ operation: 'check', taskId: second.value.taskId }, page)).ok).toBe(false)
  expect(await readdir(f.home)).toEqual([])
})
it('preserves the model Agent tool guard', async () => {
  const f = await fixture(); const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  const tool = await f.ctx.tools.execute({ name: 'qcu_table_audit', arguments: { table_id: grant.value.taskId },
    agent: {} as never, callId: 'synthetic-model-call' as never, signal: new AbortController().signal })
  expect(tool.isError).toBe(true); expect(await readdir(f.home)).toEqual([])
})
it('bounds frames and closes binary or oversized input without any worker', async () => {
  const f = await fixture({ maxInputBytes: 100, maxRuleBytes: 100 })
  const a = await f.connect(); a.ws.send(Buffer.from('{}')); await a.closed()
  const b = await f.connect(); b.ws.send('x'.repeat(10000)); await b.closed()
  expect(await readdir(f.home)).toEqual([])
})
it('expires an abandoned connection and frees its page quota', async () => {
  const f = await fixture({ grantMs: 60, maxPages: 1 }); const c = await f.connect(); await c.open()
  await c.closed()
  await vi.waitUntil(async () => { try { const fresh = await f.connect(); await fresh.open(); return true } catch { return false } })
  expect(await readdir(f.home)).toEqual([])
})

async function blockingFixture(overrides: Partial<Config> = {}) {
  const executable = await mkdtemp(join(tmpdir(), 'qcu-ws-child-')); const wrapper = join(executable, 'python-fixture')
  await writeFile(wrapper, `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');fs.writeFileSync(path.join(path.dirname(process.argv[4]),'child-ready'),String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);\n`, { mode: 0o700 })
  cleanupTasks.push(() => rm(executable, { recursive: true, force: true }))
  return fixture({ python: wrapper, ...overrides })
}
async function childReady(home: string): Promise<number> {
  let pid = 0
  await vi.waitUntil(async () => {
    for (const dir of await readdir(home)) if (existsSync(join(home, dir, 'child-ready'))) {
      pid = Number(await readFile(join(home, dir, 'child-ready'), 'utf8')); return true
    }
    return false
  }, { timeout: 5000 })
  return pid
}
it('disconnects independently of exhausted revision and terminates child plus private files', async () => {
  const f = await blockingFixture(); const c = await f.connect(); const page = await c.open()
  const grant = await f.authorize(c, page, Number.MAX_SAFE_INTEGER)
  const pending = c.call({ operation: 'check', taskId: grant.value.taskId }, page)
  const pid = await childReady(f.home); c.ws.terminate(); await c.closed(); await pending
  await vi.waitUntil(async () => (await readdir(f.home)).length === 0, { timeout: 5000 })
  expect(() => process.kill(pid, 0)).toThrow()
})
it('shares global concurrency with HTTP and other sockets and cancels without leaking children', async () => {
  const f = await blockingFixture(); const a = await f.connect(); const b = await f.connect()
  const page = await a.open(); const other = await b.open()
  const first = await f.authorize(a, page); const second = await f.authorize(b, other)
  const pending = a.call({ operation: 'check', taskId: first.value.taskId }, page)
  const pid = await childReady(f.home)
  expect((await b.call({ operation: 'check', taskId: second.value.taskId }, other)).ok).toBe(false)
  expect((await a.call({ operation: 'cancel', revision: 2 }, page)).ok).toBe(true)
  expect((await pending).ok).toBe(false)
  expect(() => process.kill(pid, 0)).toThrow(); expect(await readdir(f.home)).toEqual([])
})
it('wire abort interrupts only its own pending check; explicit cancel revokes the grant', async () => {
  const f = await blockingFixture(); const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  const pending = c.call({ operation: 'check', taskId: grant.value.taskId }, page)
  const pid = await childReady(f.home); c.abort()
  expect((await pending).ok).toBe(false)
  expect((await c.call({ operation: 'cancel', revision: 2 }, page)).ok).toBe(true)
  expect(() => process.kill(pid, 0)).toThrow(); expect(await readdir(f.home)).toEqual([])
})
it('timeout and feature unload clear owned worker processes and reject further work', async () => {
  const f = await blockingFixture({ timeoutMs: 1500 }); const c = await f.connect(); const page = await c.open()
  const grant = await f.authorize(c, page); const pending = c.call({ operation: 'check', taskId: grant.value.taskId }, page)
  const pid = await childReady(f.home); expect((await pending).ok).toBe(false)
  expect(() => process.kill(pid, 0)).toThrow(); expect(await readdir(f.home)).toEqual([])
  const next = c.call({ operation: 'check', taskId: grant.value.taskId }, page); const nextPid = await childReady(f.home)
  await f.fiber.dispose(); await next; await c.closed()
  expect(() => process.kill(nextPid, 0)).toThrow(); expect(await readdir(f.home)).toEqual([])
  await expect(f.connect()).rejects.toThrow()
})

it('retains failed disconnect cleanup for authenticated recovery without reviving a grant', async () => {
  const f = await fixture(); cleanup.root = f.home; cleanup.fail = true
  const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  expect((await c.call({ operation: 'check', taskId: grant.value.taskId }, page)).ok).toBe(false)
  expect((await readdir(f.home)).some(dir => dir.startsWith('run-'))).toBe(true)
  c.ws.terminate(); await c.closed()
  expect(await f.http({ operation: 'check', taskId: grant.value.taskId }, page)).toBe(400)
  await f.fiber.dispose().catch(() => {})
  expect(await f.http({ operation: 'recover' }, '')).toBe(400)
  cleanup.fail = false
  expect(await f.http({ operation: 'recover' }, '')).toBe(200)
  expect(await readdir(f.home)).toEqual([])
  expect(await f.http({ operation: 'open' }, '')).toBe(404)
})
it('keeps the same global worker budget when HTTP and WebSocket tasks coexist', async () => {
  const f = await blockingFixture(); const c = await f.connect(); const page = await c.open()
  const grant = await f.authorize(c, page); const pending = c.call({ operation: 'check', taskId: grant.value.taskId }, page)
  await childReady(f.home)
  const other = String((await f.httpAnswer({ operation: 'open' }, '')).value.page)
  const next = await f.httpAnswer({ operation: 'authorize', revision: 1, format: 'csv', purpose: 'diagnose-csv',
    consent: true, csv: f.csv, ruleKind: 'demo', rules: {} }, other)
  expect(next.status).toBe(200)
  expect(await f.http({ operation: 'check', taskId: next.value.taskId }, other)).toBe(400)
  expect((await readdir(f.home)).filter(name => name.startsWith('run-'))).toHaveLength(1)
  await c.call({ operation: 'cancel', revision: 2 }, page); await pending
  expect(await readdir(f.home)).toEqual([])
})

it('connects the real Client controller through the dedicated carrier to canonical worker and exports safe counts', async () => {
  const f = await fixture(); const api = f.transport(); const controller = new CsvTaskController(api)
  const bytes = Buffer.from(f.csv, 'base64')
  await controller.open()
  await controller.select({ name: 'synthetic.csv', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer })
  await controller.authorize(true, 'demo', '{}'); await controller.check()
  expect(JSON.parse(controller.export())).toMatchObject({ rows: 4, issues: 7 })
  await controller.cancel(); expect(controller.getSnapshot().phase).toBe('idle')
  await controller.dispose(); expect(await readdir(f.home)).toEqual([])
  await expect(api({ operation: 'open' })).rejects.toThrow()
})
it('recovers a lost connection with a fresh empty page and never migrates a previous grant', async () => {
  const f = await fixture(); const api = f.transport()
  const opened = await api({ operation: 'open' }) as { page: string }
  const grant = await api({ operation: 'authorize', revision: 1, format: 'csv', purpose: 'diagnose-csv',
    consent: true, csv: f.csv, ruleKind: 'demo', rules: {} }, opened.page) as { taskId: string }
  await api({ operation: 'recover' })
  const fresh = await api({ operation: 'open' }) as { page: string }
  expect(fresh.page).not.toBe(opened.page)
  await expect(api({ operation: 'check', taskId: grant.taskId }, fresh.page)).rejects.toThrow()
  await api({ operation: 'close', revision: 1 }, fresh.page); api.dispose?.()
  expect(await readdir(f.home)).toEqual([])
})

it('rejects mid-connection cookie expiry before authorization even while connection/task TTL would remain valid', async () => {
  const f = await fixture({ grantMs: 2 * 86400000 }); const c = await f.connect(); const page = await c.open()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400001)
  try {
    expect((await f.authorize(c, page)).ok).toBe(false); await c.closed()
    expect(await readdir(f.home)).toEqual([])
  } finally { clock.mockRestore() }
})
it('auth expiry during an idle running check revokes the grant and clears its child/files without another message', async () => {
  const f = await blockingFixture({ grantMs: 2 * 86400000 }); const c = await f.connect(); const page = await c.open()
  const grant = await f.authorize(c, page); const pending = c.call({ operation: 'check', taskId: grant.value.taskId }, page)
  const pid = await childReady(f.home)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400001)
  try {
    expect((await pending).ok).toBe(false); await c.closed()
    await vi.waitUntil(async () => (await readdir(f.home)).length === 0, { timeout: 5000 })
    expect(() => process.kill(pid, 0)).toThrow()
  } finally { clock.mockRestore() }
})
it('refuses new checks after the current official authentication key withdraws the original cookie', async () => {
  const f = await fixture(); const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  const restore = await f.replaceAuthenticationKey()
  try {
    expect((await c.call({ operation: 'check', taskId: grant.value.taskId }, page)).ok).toBe(false); await c.closed()
    expect(await f.http({ operation: 'check', taskId: grant.value.taskId }, page)).toBe(403)
    expect(await readdir(f.home)).toEqual([])
  } finally { restore.mockRestore() }
})
it('closes and revokes on duplicate or decreasing message identifiers', async () => {
  const f = await fixture()
  for (const id of [2, 1]) {
    const c = await f.connect(); const page = await c.open(); await f.authorize(c, page)
    c.ws.send(JSON.stringify({ id, page, value: { operation: 'check', taskId: '0'.repeat(32) } }))
    await c.closed()
  }
  expect(await readdir(f.home)).toEqual([])
})
it('enforces the two-request budget before a third request can execute or publish', async () => {
  const f = await blockingFixture(); const c = await f.connect(); const page = await c.open(); const grant = await f.authorize(c, page)
  const check = c.call({ operation: 'check', taskId: grant.value.taskId }, page); const pid = await childReady(f.home)
  // One worker check and a cancel waiting for ignored TERM occupy the two permitted requests.
  const cancel = c.call({ operation: 'cancel', revision: 2 }, page)
  const third = c.call({ operation: 'authorize', revision: 3, format: 'csv', purpose: 'diagnose-csv', consent: true,
    csv: f.csv, ruleKind: 'demo', rules: {} }, page)
  await c.closed(); await Promise.all([check, cancel, third])
  await vi.waitUntil(async () => (await readdir(f.home)).length === 0, { timeout: 5000 })
  expect(() => process.kill(pid, 0)).toThrow()
})
it('bounds repeated authenticated operation frames and revokes the connection at its budget', async () => {
  const f = await fixture(); const c = await f.connect(); const page = await c.open(); await f.authorize(c, page)
  // Deliberately invalid operations still consume a finite frame budget, without spawning workers.
  for (let n = 0; n < 254; n++) expect((await c.call({ operation: 'unknown' }, page)).ok).toBe(false)
  const extra = c.call({ operation: 'unknown' }, page); await c.closed(); await extra
  expect(await readdir(f.home)).toEqual([])
})
