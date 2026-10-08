/** Real Cordis, official signed-cookie/Origin admission and canonical Python, synthetic bytes only. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { BrowserAuth } from '@deepseek-ai/dsh-client-connection/src/browser-auth.ts'
import type { CredentialProvider, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { afterEach, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as TaskHost from '../lib/task-host.js'
import type { Config } from '../lib/task-host.js'
import { CsvTaskController } from '../src/client/controller.ts'
import { installQcuLaunchPolicy } from '../../../upstream/source/apps/desktop-host/src/qcu-policy.ts'

const cleanup = vi.hoisted(() => ({ root: '', fail: false }))
vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, rm: async (...args: Parameters<typeof actual.rm>) => {
    if (cleanup.fail && String(args[0]).startsWith(`${cleanup.root}/run-`)) throw new Error('synthetic rm failure')
    return actual.rm(...args)
  } }
})
const cleanupTasks: Array<() => Promise<void>> = []
const origin = 'http://127.0.0.1:19487'
const path = '/api/qcu-csv-task'
async function fixture(overrides: Partial<Config> = {}, protectedProfile = false) {
  const home = await mkdtemp(join(tmpdir(), 'qcu-task-proof-')); await chmod(home, 0o700)
  const ctx = new Context()
  let record: CredentialRecord | undefined
  const credentials = { readRecord: async () => record,
    modifyRecord: async (_key: unknown, mutate: (value: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
      const next = await mutate(record); if (next !== undefined) record = next; return record
    } } as unknown as CredentialProvider
  const auth = await BrowserAuth.create(ctx.root, credentials, 1)
  // Same official implementation, source import for auth versus bundled service declarations.
  new HostConnectionService(ctx, [], auth as unknown as ConstructorParameters<typeof HostConnectionService>[2])
  let cookie = ''
  auth.authorizeIndex({ method: 'GET', headers: { host: new URL(origin).host }, url: auth.authenticatedUrl(origin + '/') },
    { writeHead: (_status, headers) => { cookie = headers?.['set-cookie']?.split(';')[0] ?? '' }, end: () => {} })
  expect(cookie.length > 0).toBe(true)
  if (protectedProfile) installQcuLaunchPolicy(ctx, { version: 1 })
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime)
  const config: Config = { enabled: true, mode: 'isolated-local-csv', python: process.env.QCU_TEST_PYTHON!, workRoot: home,
    maxInputBytes: 100000, maxRuleBytes: 10000, maxReportBytes: 1000000, timeoutMs: 10000, terminateMs: 500,
    maxConcurrentRuns: 2, maxRows: 1000, maxColumns: 128, maxIssues: 10000, grantMs: 60000, maxPages: 3, ...overrides }
  const fiber = ctx.plugin(TaskHost, config); await fiber.await()
  const shared = ctx.connection.createSharedFetchHandler('/api')
  const api = async (data: Record<string, unknown>, page?: string, extra: Record<string, string> = {}, signal?: AbortSignal) => {
    const response = await shared.fetch(new Request(origin + path, { method: 'POST', body: JSON.stringify(data), signal,
      headers: { host: new URL(origin).host, origin, cookie, 'content-type': 'application/json', ...(page ? { 'x-qcu-page': page } : {}), ...extra } }))
    return { status: response.status, value: await response.json() as Record<string, unknown> }
  }
  cleanupTasks.push(async () => { cleanup.fail = false; await fiber.dispose();
    await api({ operation: 'recover' }).catch(() => {}); await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
  const csv = (await readFile(resolve('../../skills/qcu-table-audit/examples/input.csv'))).toString('base64')
  const open = async () => String((await api({ operation: 'open' })).value.page)
  const authorize = (page: string, revision = 1, additions: Record<string, unknown> = {}) => api({ operation: 'authorize', revision,
    purpose: 'diagnose-csv', format: 'csv', consent: true, csv, ruleKind: 'demo', rules: {}, ...additions }, page)
  return { ctx, fiber, home, api, shared, csv, open, authorize, cookie }
}
afterEach(async () => { cleanup.fail = false; for (const clean of cleanupTasks.splice(0)) await clean() })

it('keeps the default disabled entry inert', async () => {
  const f = await fixture({ enabled: false })
  expect((await f.shared.fetch(new Request(origin + path, { method: 'POST' }))).status).toBe(404)
  expect(f.ctx.tools.schemas().map(value => value.name)).not.toContain('qcu_table_audit')
})
it('authorizes one explicit snapshot and repeats safe diagnosis without a Session', async () => {
  const f = await fixture(); const page = await f.open(); const grant = await f.authorize(page)
  expect(grant.status).toBe(200)
  for (let i = 0; i < 2; i++) {
    const result = await f.api({ operation: 'check', taskId: grant.value.taskId }, page)
    expect(result.status).toBe(200); expect(result.value).toMatchObject({ rows: 4, issues: 7 })
    for (const privateValue of ['示例甲', '0007', 'input.csv', f.home, 'rules']) expect(JSON.stringify(result.value)).not.toContain(privateValue)
  }
  expect(await readdir(f.home)).toEqual([])
  await f.api({ operation: 'close', revision: 2 }, page)
})
it('completes the Client-controller to authenticated Host to real engine flow and exports safe counts', async () => {
  const f = await fixture()
  const controller = new CsvTaskController(async (body, page, signal) => {
    const answer = await f.api(body, page, {}, signal)
    if (answer.status !== 200) throw new Error('synthetic transport rejection')
    return answer.value
  })
  const bytes = Buffer.from(f.csv, 'base64')
  await controller.open()
  await controller.select({ name: 'synthetic.csv', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer })
  await controller.authorize(true, 'demo', '{}'); await controller.check()
  expect(JSON.parse(controller.export())).toMatchObject({ status: 'completed', rows: 4, issues: 7 })
  for (const privateValue of ['示例甲', '0007', 'synthetic.csv', f.home, f.csv]) expect(controller.export()).not.toContain(privateValue)
  await controller.cancel(); expect(controller.getSnapshot().phase).toBe('idle')
  await controller.dispose(); expect(await readdir(f.home)).toEqual([])
})
it('rejects missing authentication, missing Origin and cross-origin access', async () => {
  const f = await fixture()
  for (const extra of [{ cookie: '' }, { origin: '' }, { origin: 'https://example.invalid' }] as Array<Record<string, string>>) {
    expect((await f.api({ operation: 'open' }, undefined, extra)).status).toBe(403)
  }
  expect(await readdir(f.home)).toEqual([])
})
for (const addition of [{ consent: false }, { purpose: 'thesis-check' }, { format: 'docx' }, { path: 'arbitrary.csv' }, { csv: '!!!!' }])
  it(`rejects invalid explicit authorization ${Object.keys(addition)[0]}`, async () => {
    const f = await fixture(); const page = await f.open()
    expect((await f.authorize(page, 1, addition)).status).toBe(400)
    expect(await readdir(f.home)).toEqual([])
  })
it('binds grants to their page and revokes old grants on replacement or cancellation', async () => {
  const f = await fixture(); const page = await f.open(); const other = await f.open()
  const first = await f.authorize(page)
  expect((await f.api({ operation: 'check', taskId: first.value.taskId }, other)).status).toBe(400)
  const second = await f.authorize(page, 2, { ruleKind: 'personal', rules: {} })
  expect((await f.api({ operation: 'check', taskId: first.value.taskId }, page)).status).toBe(400)
  expect((await f.api({ operation: 'check', taskId: second.value.taskId }, page)).status).toBe(200)
  await f.api({ operation: 'cancel', revision: 3 }, page)
  expect((await f.api({ operation: 'check', taskId: second.value.taskId }, page)).status).toBe(400)
  // A delayed older authorization cannot survive a later cancel request.
  expect((await f.authorize(page, 2)).status).toBe(400)
})
it('rejects expired scopes deterministically', async () => {
  const f = await fixture(); const page = await f.open(); const grant = await f.authorize(page)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Number(grant.value.expiresAt) + 1)
  try { expect((await f.api({ operation: 'check', taskId: grant.value.taskId }, page)).status).toBe(400) }
  finally { clock.mockRestore() }
})
it('preserves the actual thesis launch denial', async () => {
  const f = await fixture({}, true); const page = await f.open(); const grant = await f.authorize(page)
  expect((await f.api({ operation: 'check', taskId: grant.value.taskId }, page)).status).toBe(400)
  expect(await readdir(f.home)).toEqual([])
})
it('retains only cleanup access after failed unload and recovers through the root-owned authenticated route', async () => {
  const f = await fixture(); cleanup.root = f.home; cleanup.fail = true
  const page = await f.open(); const grant = await f.authorize(page)
  expect((await f.api({ operation: 'check', taskId: grant.value.taskId }, page)).status).toBe(400)
  expect((await readdir(f.home)).some(name => name.startsWith('run-'))).toBe(true)
  // Cordis reports effect disposal failure; the route deliberately outlives the feature fiber.
  await f.fiber.dispose().catch(() => {})
  expect((await f.api({ operation: 'open' })).status).toBe(400)
  expect((await f.api({ operation: 'recover' })).status).toBe(400)
  cleanup.fail = false
  expect((await f.api({ operation: 'recover' })).status).toBe(200)
  expect(await readdir(f.home)).toEqual([])
  expect((await f.shared.fetch(new Request(origin + path, { method: 'POST' }))).status).toBe(404)
})
it('aborts a blocked request body when the feature unloads', async () => {
  const f = await fixture(); let cancelled = false
  const body = new ReadableStream<Uint8Array>({ cancel: () => { cancelled = true } })
  const pending = f.shared.fetch(new Request(origin + path, { method: 'POST', body,
    headers: { host: new URL(origin).host, origin, cookie: f.cookie, 'content-type': 'application/json' }, duplex: 'half' } as RequestInit))
  await f.fiber.dispose()
  expect((await pending).status).toBe(400)
  expect(cancelled).toBe(true)
})
it('applies aggregate request/input/generation budgets and page limits', async () => {
  const f = await fixture({ maxIssues: 2 }); const page = await f.open()
  expect((await f.authorize(page, 1, { csv: Buffer.alloc(100001, 65).toString('base64') })).status).toBe(400)
  const grant = await f.authorize(page, 2)
  expect((await f.api({ operation: 'check', taskId: grant.value.taskId }, page)).status).toBe(400)
  expect(await readdir(f.home)).toEqual([])
  await f.open(); await f.open()
  expect((await f.api({ operation: 'open' })).status).toBe(400)
})
it('rejects stale/invalid close revisions without closing the current valid task', async () => {
  const f = await fixture(); const page = await f.open(); const grant = await f.authorize(page, 3)
  for (const revision of [2, 3, 3.5, -1]) {
    expect((await f.api({ operation: 'close', revision }, page)).status).toBe(400)
    expect((await f.api({ operation: 'check', taskId: grant.value.taskId }, page)).status).toBe(200)
  }
})
it('releases an abandoned empty page lease without requiring browser close delivery', async () => {
  const f = await fixture({ maxPages: 1 })
  vi.useFakeTimers()
  try {
    await f.open(); expect((await f.api({ operation: 'open' })).status).toBe(400)
    await vi.advanceTimersByTimeAsync(60001)
    expect((await f.api({ operation: 'open' })).status).toBe(200)
  } finally { vi.useRealTimers() }
})
it('enforces one Host-wide child limit across pages and releases a slot after cancel', async () => {
  const executable = await mkdtemp(join(tmpdir(), 'qcu-task-child-'))
  const wrapper = join(executable, 'python-fixture')
  await writeFile(wrapper, `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');fs.writeFileSync(path.join(path.dirname(process.argv[4]),'child-ready'),String(process.pid));setInterval(()=>{},1000);\n`, { mode: 0o700 })
  cleanupTasks.push(() => rm(executable, { recursive: true, force: true }))
  const f = await fixture({ python: wrapper })
  const pages = await Promise.all([f.open(), f.open(), f.open()])
  const grants = await Promise.all(pages.map(page => f.authorize(page)))
  const first = f.api({ operation: 'check', taskId: grants[0]!.value.taskId }, pages[0])
  const second = f.api({ operation: 'check', taskId: grants[1]!.value.taskId }, pages[1])
  await vi.waitUntil(async () => {
    const dirs = (await readdir(f.home)).filter(name => name.startsWith('run-'))
    return dirs.length === 2 && dirs.every(name => existsSync(join(f.home, name, 'child-ready')))
  }, { timeout: 5000 })
  expect((await f.api({ operation: 'check', taskId: grants[2]!.value.taskId }, pages[2])).status).toBe(400)
  expect((await readdir(f.home)).filter(name => name.startsWith('run-'))).toHaveLength(2)
  expect((await f.api({ operation: 'cancel', revision: 2 }, pages[0])).status).toBe(200)
  expect((await first).status).toBe(400)
  const third = f.api({ operation: 'check', taskId: grants[2]!.value.taskId }, pages[2])
  await vi.waitUntil(async () => {
    const dirs = (await readdir(f.home)).filter(name => name.startsWith('run-'))
    return dirs.length === 2 && dirs.every(name => existsSync(join(f.home, name, 'child-ready')))
  }, { timeout: 5000 })
  await Promise.all([f.api({ operation: 'cancel', revision: 2 }, pages[1]), f.api({ operation: 'cancel', revision: 2 }, pages[2])])
  expect((await second).status).toBe(400); expect((await third).status).toBe(400)
  expect(await readdir(f.home)).toEqual([])
})
