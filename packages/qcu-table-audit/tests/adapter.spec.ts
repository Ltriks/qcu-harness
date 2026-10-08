/** Synthetic proof using the shipped artifact, real Cordis/ToolRuntime and owned one-shot children. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import * as Adapter from '../lib/index.js'
import type { Config, AuthorizedCsv, AuditScope } from '../lib/index.js'
import { installQcuLaunchPolicy } from '../../../upstream/source/apps/desktop-host/src/qcu-policy.ts'

const cleanup = vi.hoisted(() => ({ root: '', reached: false, wait: Promise.resolve(), release: () => {} }))
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, rm: async (...args: Parameters<typeof actual.rm>) => {
    if (cleanup.root && String(args[0]).startsWith(`${cleanup.root}/run-`)) {
      cleanup.reached = true
      await cleanup.wait
    }
    return actual.rm(...args)
  } }
})

const roots: string[] = []
const contexts: Context[] = []
const runners: Adapter.CsvAuditRunner[] = []
const scope: AuditScope = { kind: 'local-task', id: '22222222222222222222222222222222' }
const tableId = '33333333333333333333333333333333'
const python = process.env.QCU_TEST_PYTHON
if (!python) throw new Error('Set QCU_TEST_PYTHON to the existing Python 3.10+ runtime')

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'qcu-csv-proof-'))
  roots.push(home)
  await chmod(home, 0o700)
  const source = resolve('../../skills/qcu-table-audit/examples/input.csv')
  const csv = await readFile(source)
  const rules: unknown = JSON.parse(await readFile(resolve('../../skills/qcu-table-audit/examples/rules.json'), 'utf8'))
  const grant: AuthorizedCsv = { format: 'csv', purpose: 'diagnose-csv', scope, expiresAt: Date.now() + 60000, csv, rules }
  const authority = { resolve: vi.fn(async () => grant as AuthorizedCsv | null) }
  const config: Config = { python: python!, workRoot: home, scope, authority, maxInputBytes: 100000,
    maxRuleBytes: 10000, maxReportBytes: 1000000, timeoutMs: 10000, terminateMs: 500, maxConcurrentRuns: 2 }
  return { home, source, csv, grant, authority, config }
}

async function host(config: Config, protectedLaunch = false) {
  const ctx = new Context()
  contexts.push(ctx)
  if (protectedLaunch) installQcuLaunchPolicy(ctx, { version: 1 })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const fiber = ctx.plugin(Adapter, config)
  await fiber.await()
  return { ctx, fiber }
}

function run(ctx: Context, args: Record<string, unknown> = { table_id: tableId, rules_id: 'demo' }, signal = new AbortController().signal) {
  return ctx.tools.execute({ name: 'qcu_table_audit', arguments: args, signal, callId: ToolCallId('csv-fixture') })
}

function exited(pid: number): void {
  let code: unknown
  try { process.kill(pid, 0) }
  catch (error) { if (typeof error === 'object' && error !== null && 'code' in error) code = error.code }
  expect(code).toBe('ESRCH')
}

/** Readiness is an external file written only after the child starts; no fixed sleep. */
async function pausedPython(home: string) {
  const ready = join(home, 'fixture-ready.json')
  const executable = join(home, 'fixture-python')
  await writeFile(executable, `#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid,temporary:require('node:path').dirname(process.argv[4])}));setInterval(()=>{},1000);\n`, { mode: 0o700 })
  await chmod(executable, 0o700)
  return { executable, ready, observe: async () => {
    await vi.waitUntil(() => existsSync(ready), { timeout: 5000 })
    const value: { pid: number; temporary: string } = JSON.parse(await readFile(ready, 'utf8'))
    return value
  } }
}

afterEach(async () => {
  cleanup.release(); cleanup.root = ''; cleanup.reached = false
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const runner of runners.splice(0)) await runner.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('minimal CSV Host adapter', () => {
  for (const mode of ['cancel', 'unload', 'expiry', 'revocation'] as const) it(`does not publish counts after ${mode} during successful-run cleanup`, async () => {
    const f = await fixture()
    cleanup.root = f.home
    cleanup.wait = new Promise<void>(resolve => { cleanup.release = resolve })
    const runner = new Adapter.CsvAuditRunner(f.config); runners.push(runner)
    const abort = new AbortController()
    const pending = runner.run(tableId, 'demo', scope, abort.signal)
    const rejected = expect(pending).rejects.toThrow('CSV diagnosis unavailable')
    await vi.waitUntil(() => cleanup.reached, { timeout: 5000 })
    expect(f.authority.resolve).toHaveBeenCalledTimes(2)
    let disposal: Promise<void> | undefined
    if (mode === 'cancel') abort.abort()
    else if (mode === 'unload') disposal = runner.dispose()
    else if (mode === 'expiry') Object.assign(f.grant, { expiresAt: 0 })
    else f.authority.resolve.mockResolvedValue(null)
    cleanup.release()
    await rejected
    await disposal
    expect(await readdir(f.home)).toEqual([])
  })

  it('discovers and executes the built tool without a Session, returning only safe counts', async () => {
    const f = await fixture()
    const before = createHash('sha256').update(await readFile(f.source)).digest('hex')
    const { ctx, fiber } = await host(f.config)
    expect(ctx.tools.schemas().map(item => item.name)).toContain('qcu_table_audit')
    const result = await run(ctx)
    expect(result.isError).toBe(false)
    const content = result.content[0]
    expect(content?.type).toBe('text')
    if (content?.type !== 'text') throw new Error('Expected safe text summary')
    expect(JSON.parse(content.text)).toMatchObject({ status: 'completed', rows: 4, issues: 7 })
    const text = JSON.stringify(result)
    for (const forbidden of ['示例甲', '0007', 'input.csv', 'columns', 'invalid_date\":{', f.home, 'report.json']) expect(text).not.toContain(forbidden)
    expect(createHash('sha256').update(await readFile(f.source)).digest('hex')).toBe(before)
    expect(await readdir(f.home)).toEqual([])
    await fiber.dispose()
    expect(ctx.tools.schemas().map(item => item.name)).not.toContain('qcu_table_audit')
  })

  for (const [label, grant] of [
    ['other task', { scope: { ...scope, id: '44444444444444444444444444444444' } }],
    ['thesis purpose', { purpose: 'thesis-check' }],
    ['DOCX type', { format: 'docx' }],
    ['expired grant', { expiresAt: 0 }],
  ] as const) it(`rejects ${label} before any child or output`, async () => {
    const f = await fixture()
    f.authority.resolve.mockResolvedValue({ ...f.grant, ...grant })
    const { ctx } = await host(f.config)
    expect((await run(ctx)).isError).toBe(true)
    expect(await readdir(f.home)).toEqual([])
  })

  it('rejects missing grants, unknown/path arguments and pre-aborted execution', async () => {
    const f = await fixture()
    f.authority.resolve.mockResolvedValue(null)
    const { ctx } = await host(f.config)
    expect((await run(ctx)).isError).toBe(true)
    f.authority.resolve.mockClear()
    expect((await run(ctx, { table_id: tableId, rules_id: 'demo', path: 'arbitrary.csv' })).isError).toBe(true)
    const abort = new AbortController(); abort.abort()
    expect((await run(ctx, undefined, abort.signal)).isError).toBe(true)
    expect(f.authority.resolve).not.toHaveBeenCalled()
    expect(await readdir(f.home)).toEqual([])
  })

  it('rejects oversized snapshots without creating a work directory', async () => {
    const f = await fixture()
    const { ctx } = await host({ ...f.config, maxInputBytes: 2 })
    expect((await run(ctx)).isError).toBe(true)
    expect(await readdir(f.home)).toEqual([])
  })

  it('does not publish a result after authority revocation', async () => {
    const f = await fixture()
    f.authority.resolve.mockResolvedValueOnce(f.grant).mockResolvedValueOnce(null)
    const { ctx } = await host(f.config)
    expect((await run(ctx)).isError).toBe(true)
    expect(f.authority.resolve).toHaveBeenCalledTimes(2)
    expect(await readdir(f.home)).toEqual([])
  })

  it('checks trusted caller scope and supports a distinct conversation scope', async () => {
    const f = await fixture()
    const runner = new Adapter.CsvAuditRunner(f.config); runners.push(runner)
    await expect(runner.run(tableId, 'demo', { ...scope, id: '55555555555555555555555555555555' }, new AbortController().signal)).rejects.toThrow('CSV diagnosis unavailable')
    expect(f.authority.resolve).not.toHaveBeenCalled()
    const conversation: AuditScope = { kind: 'conversation', id: '6'.repeat(64) }
    f.authority.resolve.mockResolvedValue({ ...f.grant, scope: conversation })
    const other = new Adapter.CsvAuditRunner({ ...f.config, scope: conversation }); runners.push(other)
    expect((await other.run(tableId, 'demo', conversation, new AbortController().signal)).issues).toBe(7)
    const { ctx } = await host({ ...f.config, scope: conversation })
    expect((await run(ctx)).isError).toBe(true) // No Session cannot consume a conversation grant.
  })

  for (const mode of ['cancel', 'unload'] as const) it(`${mode} waits for the actual owned child to exit and removes its temporary directory`, async () => {
    const f = await fixture(); const fixtureChild = await pausedPython(f.home)
    const { ctx, fiber } = await host({ ...f.config, python: fixtureChild.executable })
    const abort = new AbortController()
    const pending = run(ctx, undefined, abort.signal)
    const child = await fixtureChild.observe()
    expect(existsSync(child.temporary)).toBe(true)
    if (mode === 'cancel') abort.abort(); else await fiber.dispose()
    expect((await pending).isError).toBe(true)
    exited(child.pid)
    expect(existsSync(child.temporary)).toBe(false)
    if (mode === 'unload') expect(ctx.tools.schemas().map(item => item.name)).not.toContain('qcu_table_audit')
  })

  it('unloads while an authority promise is pending, and never starts late work', async () => {
    const f = await fixture(); let release = (_grant: AuthorizedCsv | null): void => {}
    const pendingGrant = new Promise<AuthorizedCsv | null>(resolve => { release = resolve })
    f.authority.resolve.mockImplementation(() => pendingGrant)
    const { ctx, fiber } = await host(f.config)
    const pending = run(ctx)
    await vi.waitUntil(() => f.authority.resolve.mock.calls.length === 1)
    await fiber.dispose(); expect((await pending).isError).toBe(true)
    release(f.grant)
    await pendingGrant
    expect(await readdir(f.home)).toEqual([])
  })

  it('timeout waits for child exit instead of accepting a stopped run', async () => {
    const f = await fixture(); const fixtureChild = await pausedPython(f.home)
    // Budget includes executable startup under concurrent test processes. The
    // readiness file proves startup; this is a real timeout, not a fixed sleep.
    const { ctx } = await host({ ...f.config, python: fixtureChild.executable, timeoutMs: 3000 })
    const pending = run(ctx); const child = await fixtureChild.observe()
    expect((await pending).isError).toBe(true)
    exited(child.pid)
    expect(existsSync(child.temporary)).toBe(false)
  })

  it('keeps the existing actual QCU launch policy closed to the new tool', async () => {
    const f = await fixture(); const { ctx } = await host(f.config, true)
    expect(ctx.tools.schemas().map(item => item.name)).toContain('qcu_table_audit')
    const result = await run(ctx)
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('permits only local thesis tools')
    expect(f.authority.resolve).not.toHaveBeenCalled()
  })

  it('materializes exactly the canonical engine instead of another editable copy', async () => {
    expect(await readFile(resolve('lib/audit.py'))).toEqual(await readFile(resolve('../../skills/qcu-table-audit/scripts/audit.py')))
  })
})
