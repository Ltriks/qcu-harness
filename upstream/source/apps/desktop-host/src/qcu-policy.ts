/** Process-lifetime admission policy for the dedicated QCU Desktop Host launch. */
import { Context, FiberState } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'

const TOOL_DENIED = 'QCU dedicated thesis profile permits only local thesis tools.'
const UNAVAILABLE = 'QCU launch policy is unavailable; this Host is closed.'
const ATTACHMENT_DENIED = 'QCU thesis profile accepts text commands only; use the local workbench for documents.'
const LOCAL_TOOLS = new Set(['qcu_thesis_open', 'qcu_thesis_check'])
const ATTACHMENT_TYPES = new Set(['file', 'image', 'attachment', 'file_attachment', 'image_attachment'])

/** Fixed policy version selected by the dedicated application launcher. */
export interface QcuLaunchPolicyConfig {
  readonly version: 1
}

/** Observable admission state; no release or reconfiguration operation is exposed. */
export interface QcuLaunchPolicyStatus {
  readonly status: 'waiting' | 'ready' | 'closed' | 'failed'
}

// These roots deliberately outlive every Host and business-plugin fiber. Their
// effects have no production release path; process exit is their cleanup.
const owners = new Set<Context>()
const installed = new WeakMap<Context, QcuLaunchPolicyStatus>()

function configured(value: unknown): value is QcuLaunchPolicyConfig {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.hasOwn(value, 'version') && 'version' in value && value.version === 1 && Object.keys(value).every(key => key === 'version')
}

function hasAttachment(value: unknown): boolean {
  const pending: unknown[] = [value]
  const seen = new Set<object>()
  let inspected = 0
  while (pending.length > 0) {
    const item = pending.pop()
    if (item === null || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)
    if ('type' in item && typeof item.type === 'string' && ATTACHMENT_TYPES.has(item.type)) return true
    for (const child of Object.values(item)) {
      // Reject over-complex ingress without recursion or unbounded work.
      if (++inspected > 10_000) return true
      if (child !== null && typeof child === 'object') pending.push(child)
    }
  }
  return false
}

/**
 * Install the fixed QCU policy before mounting any profile-tree entries.
 * Only the official ToolRuntime class-plugin lifecycle is supported. A binding
 * failure synchronously exits this dedicated Host, before queued work can run.
 * The independent owner retains guards and ingress listeners after Host teardown;
 * this is trusted application policy, not an untrusted Node or OS sandbox.
 * @param host - The dedicated Host root, still active and owned by the launcher.
 * @param config - Required explicit fixed-version selection; omission is an error.
 * @returns Frozen read-only admission status, never a disposer.
 */
export function installQcuLaunchPolicy(host: Context, config?: QcuLaunchPolicyConfig): QcuLaunchPolicyStatus {
  if (!configured(config)) {
    throw new Error('QCU launch requires exactly policy { version: 1 }.')
  }
  if (host !== host.root || host.fiber.state !== FiberState.ACTIVE) {
    throw new Error('QCU launch policy requires an active dedicated Host root.')
  }
  const previous = installed.get(host)
  if (previous) return previous

  const owner = new Context()
  owners.add(owner)
  owner.events = host.events
  let state: QcuLaunchPolicyStatus['status'] = 'waiting'
  const status = Object.freeze({ get status() { return state } })
  const attached = new Set<object>()
  const ready = (): boolean => state === 'ready'
  const denial = (name: string): string | undefined => !ready()
    ? UNAVAILABLE : LOCAL_TOOLS.has(name) ? undefined : TOOL_DENIED
  const terminate = (): never => {
    state = 'failed'
    // This must remain synchronous. exitCode / a rejected startup promise would
    // let Cordis resume queued consumers after a failed guard registration.
    try { console.error('QCU launch policy could not bind the official tools service; terminating Host.') }
    finally { process.exit(1) }
  }
  const bind = (identity: object, tools: ToolRuntime): void => {
    try {
      if (!(tools instanceof ToolRuntime) || Object.getPrototypeOf(tools) !== ToolRuntime.prototype) {
        throw new Error('QCU requires the exact official tools service class.')
      }
      if (!attached.has(identity)) {
        if (owner.get('tools')) owner.set('tools', tools)
        else owner.provide('tools', tools)
        // Access through the independent owner makes the global guard its effect,
        // rather than an effect of the service provider or the profile tree.
        owner.tools.guard(exec => denial(exec.name))
        attached.add(identity)
      }
      if (state !== 'closed' && state !== 'failed') state = 'ready'
    } catch (_error) {
      terminate()
    }
  }

  owner.on('internal/status', (fiber) => {
    if (fiber === host.fiber && fiber.state !== FiberState.ACTIVE && state !== 'failed') state = 'closed'
  }, { global: true, prepend: true })
  owner.on('internal/service', function (name, value: unknown) {
    // Mirroring the service into the detached owner must not re-enter binding.
    if (name !== 'tools' || this.root !== host || state === 'failed') return
    // The dedicated profile supports one shared official tools service. An
    // isolated provider would not receive the root service's monotonic guard.
    if (this[Context.isolate].tools !== host[Context.isolate].tools) return terminate()
    if (state !== 'closed') state = 'waiting'
    let tools: ToolRuntime | undefined
    try { tools = host.get('tools') }
    catch (_error) { terminate() }
    if (!tools) return
    if (!(value instanceof ToolRuntime) || Object.getPrototypeOf(value) !== ToolRuntime.prototype) return terminate()
    bind(value, tools)
  }, { global: true, prepend: true })
  owner.on('tools/pre-execute', async (exec, next) => {
    const reason = denial(exec.name)
    return reason === undefined ? next() : { kind: 'deny', reason }
  }, { global: true, prepend: true })
  owner.on('connection/request', async (request, response, next) => {
    if (!ready()) {
      response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ error: { code: 'qcu/policy-unavailable', message: UNAVAILABLE } }))
      return
    }
    let pathname: string
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname) }
    catch (_error) { response.writeHead(400); response.end(); return }
    if (pathname === '/api/session/uploadFileBinary' || pathname.startsWith('/api/fileUploads/') || pathname === '/api/file') {
      response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ error: { code: 'qcu/attachment-blocked', message: ATTACHMENT_DENIED } }))
      return
    }
    await next()
  }, { global: true, prepend: true })
  owner.on('agent/pre-step', async (payload, next) => {
    return !ready() || hasAttachment(payload.messages) ? { kind: 'reject' } : next()
  }, { global: true, prepend: true })
  owner.on('llm/stream', async function* (options, next) {
    if (!ready()) throw new Error(UNAVAILABLE)
    if (hasAttachment(options.messages)) throw new Error(ATTACHMENT_DENIED)
    yield* next()
  }, { global: true, prepend: true })

  installed.set(host, status)
  let existing: ToolRuntime | undefined
  try { existing = host.get('tools') }
  catch (_error) { terminate() }
  if (existing) bind(existing, existing)
  return status
}
