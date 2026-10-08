/** Experimental Host adapter; production CSV selection and profile installation are not implemented. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { chmod, lstat, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Scope created by a trusted Host owner, never taken from model arguments. */
export type AuditScope = { readonly kind: 'conversation' | 'local-task'; readonly id: string }
/** An explicit, revocable CSV snapshot supplied by a trusted authority. */
export interface AuthorizedCsv {
  readonly format: string
  readonly purpose: string
  readonly scope: AuditScope
  readonly expiresAt: number
  readonly csv: Uint8Array
  readonly rules: unknown
}
/** Host-side authority seam; the implementation must recheck revocation on every resolution. */
export interface CsvAuthority {
  resolve(tableId: string, rulesId: string, scope: AuditScope, signal: AbortSignal): Promise<AuthorizedCsv | null>
}
/** Programmatic prototype composition, not serializable profile configuration. */
export interface Config {
  readonly python: string
  readonly workRoot: string
  readonly scope: AuditScope
  readonly authority: CsvAuthority
  readonly maxInputBytes: number
  readonly maxRuleBytes: number
  readonly maxReportBytes: number
  readonly timeoutMs: number
  readonly terminateMs: number
  readonly maxConcurrentRuns: number
}

const codes = ['blank', 'surrounding_whitespace', 'duplicate_row', 'duplicate_key',
  'required_missing', 'invalid_integer', 'invalid_number', 'invalid_date', 'formula_like_text'] as const
const issueProperties = Object.fromEntries(codes.map(code => [code, { type: 'integer' as const, required: true as const }]))
const ERROR = 'CSV diagnosis unavailable; confirm the local task authorization and explicit rules.'
const engine = fileURLToPath(new URL('./audit.py', import.meta.url))
function fail(): never { throw new Error(ERROR) }
const sameScope = (a: AuditScope, b: AuditScope): boolean => a.kind === b.kind && a.id === b.id
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function cancelled(signal: AbortSignal): void { if (signal.aborted) fail() }

/** Resolve an owned wait promptly on cancellation while observing late rejection. */
function interruptible<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = (): void => { reject(new Error(ERROR)) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.then(resolve, () => reject(new Error(ERROR))).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Only safe counts leave this module; the complete temporary report is removed. */
export interface AuditSummary {
  readonly status: 'completed'
  readonly rows: number
  readonly issues: number
  readonly counts: Record<string, number>
}

function summary(value: unknown): AuditSummary {
  if (!record(value) || !Number.isSafeInteger(value.rows) || typeof value.rows !== 'number' || value.rows < 0
    || !record(value.counts) || !Array.isArray(value.issues) || value.clean_applied !== false
    || !Array.isArray(value.changes) || value.changes.length !== 0) fail()
  const counts: Record<string, number> = {}
  for (const key of Object.keys(value.counts)) if (!codes.some(code => code === key)) fail()
  for (const code of codes) {
    const count = value.counts[code] ?? 0
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) fail()
    counts[code] = count
  }
  const issues = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!Number.isSafeInteger(issues) || issues !== value.issues.length) fail()
  return { status: 'completed', rows: value.rows, issues, counts }
}

/** Own a fixed one-shot Python child and wait for exit after timeout, cancel or unload. */
async function execute(config: Config, directory: string, signal: AbortSignal): Promise<void> {
  cancelled(signal)
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ['PATH', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP'].includes(key)))
  const child = spawn(config.python, ['-B', engine, join(directory, 'input.csv'), '--rules', join(directory, 'rules.json'),
    '--out', join(directory, 'report')], { cwd: directory, env: environment, stdio: 'ignore' })
  let stopped = false
  let ended = false
  let forced: ReturnType<typeof setTimeout> | undefined
  const stop = (): void => {
    if (ended || stopped) return
    stopped = true
    child.kill('SIGTERM')
    forced = setTimeout(() => { if (!ended) child.kill('SIGKILL') }, config.terminateMs)
  }
  signal.addEventListener('abort', stop, { once: true })
  if (signal.aborted) stop()
  const timeout = setTimeout(stop, config.timeoutMs)
  try {
    await new Promise<void>((resolve, reject) => {
      let startupError = false
      child.once('error', () => { startupError = true })
      child.once('close', (code, exitSignal) => {
        ended = true
        if (startupError || stopped || signal.aborted || code !== 0 || exitSignal !== null) reject(new Error(ERROR))
        else resolve()
      })
    })
  } finally {
    clearTimeout(timeout)
    if (forced !== undefined) clearTimeout(forced)
    signal.removeEventListener('abort', stop)
  }
}

/** Per-plugin ownership, authorization checks and quiescent teardown. */
export class CsvAuditRunner {
  private closed = false
  private readonly active = new Set<{ controller: AbortController; done: Promise<void> }>()
  constructor(private readonly config: Config) {}

  /** Run only a CSV grant belonging to the configured trusted owner. */
  async run(tableId: string, rulesId: string, caller: AuditScope, signal: AbortSignal): Promise<AuditSummary> {
    if (this.closed || this.active.size >= this.config.maxConcurrentRuns || !sameScope(caller, this.config.scope)
      || !/^[0-9a-f]{32}$/.test(tableId) || !/^[a-zA-Z0-9-]{1,100}$/.test(rulesId)) fail()
    cancelled(signal)
    const controller = new AbortController()
    const abort = (): void => { controller.abort() }
    signal.addEventListener('abort', abort, { once: true })
    let finish = (): void => {}
    const done = new Promise<void>(resolve => { finish = resolve })
    const operation = { controller, done }
    this.active.add(operation)
    let directory: string | undefined
    try {
      const grant = await interruptible(this.config.authority.resolve(tableId, rulesId, caller, controller.signal), controller.signal)
      this.authorized(grant, caller)
      const csv = Buffer.from(grant.csv)
      const rules = Buffer.from(JSON.stringify(grant.rules))
      if (csv.length === 0 || csv.length > this.config.maxInputBytes || rules.length > this.config.maxRuleBytes) fail()
      cancelled(controller.signal)
      directory = await mkdtemp(join(this.config.workRoot, 'run-'))
      await chmod(directory, 0o700)
      await writeFile(join(directory, 'input.csv'), csv, { flag: 'wx', mode: 0o600 })
      await writeFile(join(directory, 'rules.json'), rules, { flag: 'wx', mode: 0o600 })
      await execute(this.config, directory, controller.signal)
      const report = join(directory, 'report/report.json')
      if ((await stat(report)).size > this.config.maxReportBytes) fail()
      const value: unknown = JSON.parse(await readFile(report, 'utf8'))
      const result = summary(value)
      const latest = await interruptible(this.config.authority.resolve(tableId, rulesId, caller, controller.signal), controller.signal)
      this.authorized(latest, caller)
      if (!Buffer.from(latest.csv).equals(csv) || JSON.stringify(latest.rules) !== rules.toString()) fail()
      // Keep ownership through asynchronous cleanup; a return in try/finally would
      // publish its already-selected value even if cancellation arrives in rm().
      await rm(directory, { recursive: true, force: true })
      directory = undefined
      cancelled(controller.signal)
      const finalGrant = await interruptible(this.config.authority.resolve(tableId, rulesId, caller, controller.signal), controller.signal)
      this.authorized(finalGrant, caller)
      if (!Buffer.from(finalGrant.csv).equals(csv) || JSON.stringify(finalGrant.rules) !== rules.toString()) fail()
      cancelled(controller.signal)
      return result
    } catch (_error) {
      throw new Error(ERROR)
    } finally {
      try { if (directory !== undefined) await rm(directory, { recursive: true, force: true }) }
      catch (_cleanupError) { throw new Error(ERROR) }
      finally { signal.removeEventListener('abort', abort); this.active.delete(operation); finish() }
    }
  }

  private authorized(grant: AuthorizedCsv | null, scope: AuditScope): asserts grant is AuthorizedCsv {
    if (!grant || grant.format !== 'csv' || grant.purpose !== 'diagnose-csv' || !sameScope(grant.scope, scope)
      || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now()) fail()
  }

  /** Revoke new work, abort owned operations and await their cleanup. */
  async dispose(): Promise<void> {
    this.closed = true
    const work = [...this.active]
    for (const item of work) item.controller.abort()
    await Promise.all(work.map(item => item.done))
  }
}

/** Official Cordis function-plugin identity and required service. */
export const name = 'qcu-table-audit'
export const inject = ['tools']

/** Mount one experimental tool in an explicit trusted scope; no profile or Native capability is changed. */
export async function apply(ctx: Context, config: Config): Promise<void> {
  if (!config || !isAbsolute(config.python) || !isAbsolute(config.workRoot)
    || !config.authority || typeof config.authority.resolve !== 'function'
    || !['conversation', 'local-task'].includes(config.scope?.kind)
    || !(config.scope.kind === 'local-task' ? /^[0-9a-f]{32}$/ : /^[0-9a-f]{64}$/).test(config.scope.id)
    || [config.maxInputBytes, config.maxRuleBytes, config.maxReportBytes, config.timeoutMs,
      config.terminateMs, config.maxConcurrentRuns].some(value => !Number.isSafeInteger(value) || value <= 0)) fail()
  const directory = await lstat(config.workRoot)
  if (!directory.isDirectory() || directory.isSymbolicLink()
    || (process.platform !== 'win32' && (directory.uid !== process.getuid?.() || (directory.mode & 0o077) !== 0))) fail()
  const runner = new CsvAuditRunner(config)
  ctx.effect(() => {
    ctx.tools.register(defineTool({
      name: 'qcu_table_audit', description: 'Diagnose an explicitly authorized local CSV; only safe issue counts leave the Host. No cleaning or file paths.',
      parameters: { table_id: { type: 'string', required: true }, rules_id: { type: 'string', required: true } },
      output: { schema: { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', const: 'completed', required: true }, rows: { type: 'integer', required: true },
        issues: { type: 'integer', required: true }, counts: { type: 'object', additionalProperties: false, properties: issueProperties, required: true },
      } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: async (args, exec) => {
        if (!record(exec.arguments)) fail()
        if (Object.keys(exec.arguments).some(key => !['table_id', 'rules_id'].includes(key))) fail()
        if (config.scope.kind === 'local-task') { if (exec.agent !== undefined) fail() }
        else {
          const id = exec.agent?.session?.id
          if (typeof id !== 'string' || !id || createHash('sha256').update(id).digest('hex') !== config.scope.id) fail()
        }
        return runner.run(args.table_id, args.rules_id, config.scope, exec.signal)
      },
    }))
    return () => runner.dispose()
  }, 'owned CSV diagnostic adapter')
}
