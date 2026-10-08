/** Optional isolated-profile Host entry; default bundle configuration is disabled. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { lstat, readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { CsvTaskOwner } from './task-owner.ts'
import type { TaskConfig } from './task-owner.ts'
import { parseSummary, TASK_ERROR, TASK_PATH, ISSUE_CODES } from './task-protocol.ts'

import { dispatch, exact } from './task-dispatch.ts'
import { registerTaskSocket } from './task-socket.ts'

export const name = 'qcu-table-audit-task'
export const inject = ['connection', 'tools']
export interface Config extends Omit<TaskConfig, 'demoRules'> {
  readonly websocketEnabled?: boolean
  readonly enabled: boolean
  readonly mode: 'isolated-local-csv'
}
function fail(): never { throw new Error(TASK_ERROR) }
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })

async function body(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (!request.body || request.headers.get('content-type')?.split(';')[0] !== 'application/json') fail()
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0
  const abort = (): void => { void reader.cancel().catch(() => {}) }
  request.signal.addEventListener('abort', abort, { once: true })
  try {
    for (;;) {
      if (request.signal.aborted) fail()
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) fail()
      chunks.push(next.value)
    }
  } catch (_error) { await reader.cancel().catch(() => {}); fail() }
  finally { request.signal.removeEventListener('abort', abort); reader.releaseLock() }
  if (request.signal.aborted) fail()
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  return value as Record<string, unknown>
}

export async function apply(ctx: Context, config: Config): Promise<void> {
  if (config?.enabled === false) return
  if (config?.enabled !== true || (config.websocketEnabled !== undefined && typeof config.websocketEnabled !== 'boolean') || config.mode !== 'isolated-local-csv'
    || !isAbsolute(config.python) || !isAbsolute(config.workRoot)
    || [config.maxInputBytes, config.maxRuleBytes, config.maxReportBytes, config.timeoutMs,
      config.terminateMs, config.maxConcurrentRuns, config.grantMs, config.maxPages,
      config.maxRows, config.maxColumns, config.maxIssues].some(value =>
      !Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 2147483647)) fail()
  const root = await lstat(config.workRoot)
  if (!root.isDirectory() || root.isSymbolicLink() || process.platform === 'win32'
    || root.uid !== process.getuid?.() || (root.mode & 0o077) !== 0) fail()
  const demoRules: unknown = JSON.parse(await readFile(new URL('./demo-rules.json', import.meta.url), 'utf8'))
  const owner = new CsvTaskOwner({ ...config, demoRules })
  // Recovery must use a root binding after the feature Context is disposed.
  const connection = ctx.root.connection
  const lifetime = new AbortController()
  let release: (() => Promise<void>) | undefined
  let sockets: ReturnType<typeof registerTaskSocket> | undefined
  let unguard: (() => void) | undefined
  const execute = async (tableId: string, signal: AbortSignal) => {
    const answer = await ctx.tools.execute({ name: 'qcu_table_audit', arguments: { table_id: tableId }, signal,
      callId: ToolCallId('csv-local-task') })
    const content = answer.content[0]
    if (answer.isError || content?.type !== 'text') fail()
    return parseSummary(JSON.parse(content.text) as unknown)
  }
  const dispose = async (): Promise<void> => {
    // The root-owned route and guard remain reachable if private cleanup fails.
    lifetime.abort(); sockets?.stop(); await owner.dispose()
    await sockets?.release()
    await release?.(); await unguard?.()
  }
  try {
  unguard = ctx.root.tools.guard(exec => exec.name !== 'qcu_table_audit' || exec.agent !== undefined
    ? 'Isolated CSV tasks admit only explicitly authorized local diagnosis.' : undefined)
  release = connection.fetch.register({ path: TASK_PATH, methods: ['POST'], requestBody: 'streaming',
    fetch: async request => {
      try {
        const url = new URL(request.url)
        // Official HTTP bridging uses dsh.internal for Request.url. Bind
        // authority to the wire Host and exact browser Origin, then retain
        // the official authenticated request fence. Never trust forwarded hosts.
        const origin = request.headers.get('origin') ?? ''
        if (!URL.canParse(origin)) return json({ error: TASK_ERROR }, 403)
        const browser = new URL(origin)
        if (!['http:', 'https:'].includes(browser.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(browser.hostname)
          || browser.origin !== origin || browser.host !== request.headers.get('host')
          || url.search || connection.requestRejection(request) !== undefined) return json({ error: TASK_ERROR }, 403)
        const value = await body(new Request(request, { signal: owner.stopped ? request.signal :
          AbortSignal.any([request.signal, lifetime.signal]) }), owner.stopped ? 256 :
          Math.ceil(config.maxInputBytes / 3) * 4 + config.maxRuleBytes * 6 + 4096)
        if (value.operation === 'recover') {
          exact(value, ['operation'])
          if (owner.stopped) await dispose(); else await owner.recover()
          return json({ recovered: true })
        }
        if (owner.stopped) fail()
        const page = request.headers.get('x-qcu-page') ?? ''
        if (value.operation === 'open') { exact(value, ['operation']); return json(owner.open()) }
        return json(await dispatch(owner, value, page, AbortSignal.any([request.signal, lifetime.signal]), execute))
      } catch (_error) { return json({ error: TASK_ERROR }, 400) }
    },
  })
  if (config.websocketEnabled) sockets = registerTaskSocket(ctx.root, config, owner, execute, lifetime.signal)
  ctx.effect(() => {
    ctx.tools.register(defineTool({ name: 'qcu_table_audit', description: 'Explicit local CSV task; safe counts only. No model calls.',
      parameters: { table_id: { type: 'string', required: true } },
      output: { schema: { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', const: 'completed', required: true }, rows: { type: 'integer', required: true },
        issues: { type: 'integer', required: true }, counts: { type: 'object', additionalProperties: false, required: true,
          properties: Object.fromEntries(ISSUE_CODES.map(code => [code, { type: 'integer' as const, required: true as const }])) },
      } }, render: (_args, result) => [{ type: 'text', text: JSON.stringify(parseSummary(result)) }] },
      execute: async (args, exec) => {
        if (exec.agent !== undefined || !exec.arguments || typeof exec.arguments !== 'object'
          || Array.isArray(exec.arguments) || Object.keys(exec.arguments).join(',') !== 'table_id') fail()
        return owner.diagnose(args.table_id, exec.signal)
      },
    }))
    return dispose
  }, 'isolated CSV tasks and retryable cleanup')
  } catch (_error) { await dispose(); fail() }
}
