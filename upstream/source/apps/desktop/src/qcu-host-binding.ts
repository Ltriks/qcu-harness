/** Fixed main-only QCU service binding over the desktop-owned Host child IPC connection. */
import { randomUUID } from 'node:crypto'
import type { ChildProcess } from 'node:child_process'

type QcuPrivateMessage =
  | { readonly type: 'qcu:hello'; readonly protocolVersion: 1; readonly ownerId: string }
  | { readonly type: 'qcu:bind' | 'qcu:grant' | 'qcu:granted' | 'qcu:revoke' | 'qcu:unbind' | 'qcu:unbound'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number }
  | { readonly type: 'qcu:ready'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number; readonly origin: string }
  | { readonly type: 'qcu:revoked'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number; readonly ok: boolean }

/** Recognize the reserved family without admitting a malformed member. */
function isQcuPrivateMessage(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'type' in value
    && typeof value.type === 'string' && value.type.startsWith('qcu:')
}

/** Validate an exact loopback origin; never include a rejected value in diagnostics. */
function qcuPrivateOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/?$/.test(value)) return undefined
  const port = Number(value.slice('http://127.0.0.1:'.length).replace(/\/$/, ''))
  if (port < 1 || port > 65535) return undefined
  return new URL(value).origin
}

/** Parse only version 1 exact fields, UUID owner/generation, and positive integer correlation IDs. */
function parseQcuPrivateMessage(value: unknown): QcuPrivateMessage | undefined {
  if (!isQcuPrivateMessage(value)) return undefined
  const candidate = value as Record<string, unknown>
  const uuid = (input: unknown): boolean => typeof input === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input)
  if (candidate.protocolVersion !== 1 || !uuid(candidate.ownerId)) return undefined
  const fields = ['type', 'protocolVersion', 'ownerId']
  if (candidate.type !== 'qcu:hello') {
    if (!uuid(candidate.generation) || !Number.isSafeInteger(candidate.requestId) || Number(candidate.requestId) <= 0) return undefined
    fields.push('generation', 'requestId')
    if (candidate.type === 'qcu:ready') {
      if (qcuPrivateOrigin(candidate.origin) === undefined) return undefined
      fields.push('origin')
    } else if (candidate.type === 'qcu:revoked') {
      if (typeof candidate.ok !== 'boolean') return undefined
      fields.push('ok')
    } else if (!['qcu:bind', 'qcu:grant', 'qcu:granted', 'qcu:revoke', 'qcu:unbind', 'qcu:unbound'].includes(String(candidate.type))) return undefined
  }
  if (Object.keys(candidate).length !== fields.length || Object.keys(candidate).some(key => !fields.includes(key))) return undefined
  return candidate as QcuPrivateMessage
}

interface Owner {
  readonly child: ChildProcess
  readonly generation: string
  readonly ownerId: string
  readonly bindId: number
  phase: 'binding' | 'granting' | 'ready' | 'closing'
  initiated?: boolean | undefined
  release?: Promise<void> | undefined
  origin?: string | undefined
  timer?: ReturnType<typeof setTimeout> | undefined
  cleanup?: Promise<void> | undefined
  unbind?: { readonly requestId: number; readonly resolve: () => void; readonly reject: (error: Error) => void } | undefined
  revokeId?: number | undefined
}

/** One fixed QCU capability; retain this instance across Host replacements to preserve cleanup failure. */
export class QcuHostBinding {
  private child: ChildProcess | undefined
  private generation: string | undefined
  private owner: Owner | undefined
  private blocked = false
  private barrier: Promise<void> = Promise.resolve()
  private nextRequestId = 1
  private readonly retiredOwners = new Set<string>()
  private readonly listeners = new Set<() => void>()

  /**
   * @param teardown - Synchronously retire native admission, then await all private view/session cleanup.
   * @param timeoutMs - Bounded private-protocol deadline; injectable for synthetic tests.
   */
  constructor(private readonly teardown: () => Promise<void>, private readonly timeoutMs = 5000) {}

  /**
   * Select the exact desktop-owned child; an absent bundle sends nothing and creates no deadline.
   * @param child - The existing DesktopHostProcess child, never supplied by a renderer.
   */
  attach(child: ChildProcess): void {
    if (this.child === child) return
    if (this.owner !== undefined) {
      clearTimeout(this.owner.timer)
      this.owner.unbind?.reject(new Error('QCU native binding unavailable.'))
      void this.retire(this.owner).catch(() => undefined)
    }
    this.child = child
    this.generation = randomUUID()
    this.owner = undefined
    this.nextRequestId = 1
  }

  /**
   * Consume only the fixed QCU family before the ordinary Host event validator.
   * @param child - Actual emitter of the IPC message.
   * @param value - Untrusted process message; malformed QCU data permanently closes this capability.
   * @returns Whether the message belonged to QCU, including malformed or stale QCU traffic.
   */
  handleMessage(child: ChildProcess, value: unknown): boolean {
    if (!isQcuPrivateMessage(value)) return false
    if (child !== this.child) return true
    const message = parseQcuPrivateMessage(value)
    if (message === undefined) { this.fail(); return true }
    if (message.type === 'qcu:hello') {
      if (this.blocked || this.retiredOwners.has(message.ownerId)) return true
      if (this.owner !== undefined || this.generation === undefined) { this.fail(); return true }
      const owner: Owner = { child, generation: this.generation, ownerId: message.ownerId, bindId: this.nextRequestId++, phase: 'binding' }
      this.owner = owner
      void this.barrier.then(() => {
        if (!this.current(owner) || this.blocked || owner.phase !== 'binding') return
        this.armTimeout(owner)
        owner.initiated = true
        this.send(owner, { type: 'qcu:bind', protocolVersion: 1, ownerId: owner.ownerId, generation: owner.generation, requestId: owner.bindId })
      }).catch(() => { this.fail() })
      return true
    }
    const owner = this.owner
    if (owner === undefined || message.ownerId !== owner.ownerId || message.generation !== owner.generation) return true
    if (owner.phase === 'closing' && ['qcu:ready', 'qcu:granted'].includes(message.type)) return true
    if (message.type === 'qcu:ready') {
      if (owner.phase !== 'binding' || message.requestId !== owner.bindId) { this.fail(); return true }
      owner.origin = message.origin.replace(/\/$/, '')
      owner.phase = 'granting'
      this.send(owner, { type: 'qcu:grant', protocolVersion: 1, ownerId: owner.ownerId, generation: owner.generation, requestId: owner.bindId })
    } else if (message.type === 'qcu:granted') {
      if (owner.phase !== 'granting' || message.requestId !== owner.bindId || !child.connected || this.blocked) { this.fail(); return true }
      clearTimeout(owner.timer)
      owner.phase = 'ready'
    } else if (message.type === 'qcu:revoke') {
      if (message.requestId !== owner.bindId + 1 || owner.revokeId !== undefined) { this.fail(); return true }
      owner.revokeId = message.requestId
      void this.retire(owner).then(() => {
        this.send(owner, { ...message, type: 'qcu:revoked', ok: true })
        if (this.current(owner) && owner.unbind === undefined) this.owner = undefined
      }, () => {
        this.send(owner, { ...message, type: 'qcu:revoked', ok: false })
      })
    } else if (message.type === 'qcu:unbound') {
      if (owner.phase !== 'closing' || owner.unbind?.requestId !== message.requestId) { this.fail(); return true }
      clearTimeout(owner.timer)
      owner.unbind.resolve()
      owner.unbind = undefined
      if (this.current(owner)) this.owner = undefined
    } else this.fail()
    return true
  }

  /** Whether this exact live child has completed ready, grant, and acknowledgment. */
  available(): boolean {
    return !this.blocked && this.owner?.phase === 'ready' && this.owner.origin !== undefined
      && this.current(this.owner) && this.owner.child.connected
  }

  /**
   * Return only the main-private origin; callers must recheck occurrence and binding liveness after awaiting.
   * @returns The fixed QCU service target, never a renderer return value.
   */
  acquireNativeTarget(): Promise<{ readonly origin: string }> {
    if (!this.available() || this.owner?.origin === undefined) return Promise.reject(new Error('QCU native binding unavailable.'))
    return Promise.resolve({ origin: this.owner.origin })
  }

  /**
   * Subscribe to synchronous admission revocation; cleanup remains the constructor callback's responsibility.
   * @param listener - Must revoke its admission before returning; exceptions latch the capability closed.
   * @returns An idempotent unsubscribe function.
   */
  onRevoked(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Synchronously close admission, await native teardown, then acknowledge unbinding with the exact Host.
   * @param child - When supplied, ignore an obsolete DesktopHostProcess stopping after replacement.
   * @returns Completion of native teardown and bounded Host unbinding acknowledgment.
   */
  revoke(child?: ChildProcess): Promise<void> {
    if (child !== undefined && child !== this.child) return Promise.resolve()
    const owner = this.owner
    if (owner === undefined) return this.barrier
    if (owner.release !== undefined) return owner.release
    const cleanup = this.retire(owner)
    owner.release = cleanup.then(async () => {
      if (!this.current(owner) || !owner.child.connected) return
      if (!owner.initiated) { this.owner = undefined; return }
      const requestId = this.nextRequestId++
      await new Promise<void>((resolve, reject) => {
        owner.unbind = { requestId, resolve, reject }
        this.armTimeout(owner)
        this.send(owner, { type: 'qcu:unbind', protocolVersion: 1, ownerId: owner.ownerId, generation: owner.generation, requestId })
      })
    })
    return owner.release
  }

  /**
   * Immediately invalidate an exact failed/disconnected child and await private cleanup.
   * @param child - The child that emitted error, disconnect, or close.
   * @returns Completion of main-owned teardown, including any earlier in-flight cleanup.
   */
  disconnected(child: ChildProcess): Promise<void> {
    if (child !== this.child) return Promise.resolve()
    const owner = this.owner
    this.child = undefined
    this.generation = undefined
    this.owner = undefined
    if (owner !== undefined) {
      clearTimeout(owner.timer)
      owner.unbind?.reject(new Error('QCU native binding unavailable.'))
      return this.retire(owner)
    }
    return this.barrier
  }

  private current(owner: Owner): boolean {
    return this.owner === owner && this.child === owner.child && this.generation === owner.generation
  }

  private retire(owner: Owner): Promise<void> {
    if (owner.cleanup !== undefined) return owner.cleanup
    owner.phase = 'closing'
    owner.origin = undefined
    this.retiredOwners.add(owner.ownerId)
    clearTimeout(owner.timer)
    const previous = this.barrier
    let complete!: () => void
    let reject!: (error: Error) => void
    owner.cleanup = new Promise<void>((resolve, fail) => { complete = resolve; reject = fail }).catch(() => {
      this.blocked = true
      throw new Error('QCU native teardown did not complete.')
    }).finally(() => { clearTimeout(deadline) })
    this.barrier = owner.cleanup
    void owner.cleanup.catch(() => undefined)
    // Store the pending barrier before native callbacks can reenter a close or replacement path.
    const deadline = setTimeout(() => { reject(new Error('QCU native teardown did not complete.')) }, this.timeoutMs)
    for (const listener of [...this.listeners]) {
      try { listener() } catch (_error) { this.blocked = true }
    }
    let cleanup: Promise<void>
    try { cleanup = this.teardown() }
    catch (_error) { cleanup = Promise.reject(new Error('QCU native teardown did not complete.')) }
    void Promise.all([previous, cleanup]).then(() => {
      if (this.blocked) reject(new Error('QCU native binding unavailable.'))
      else complete()
    }, () => { reject(new Error('QCU native teardown did not complete.')) })
    return owner.cleanup
  }

  private send(owner: Owner, message: QcuPrivateMessage): void {
    if (owner.child !== this.child || !owner.child.connected) return
    try { owner.child.send(message, (error) => { if (error !== null && owner.child === this.child) this.fail() }) }
    catch (_error) { this.fail() }
  }

  private armTimeout(owner: Owner): void {
    clearTimeout(owner.timer)
    owner.timer = setTimeout(() => {
      if (!this.current(owner)) return
      owner.unbind?.reject(new Error('QCU native binding unavailable.'))
      this.fail()
    }, this.timeoutMs)
  }

  private fail(): void {
    this.blocked = true
    if (this.owner === undefined) return
    this.owner.unbind?.reject(new Error('QCU native binding unavailable.'))
    void this.retire(this.owner).catch(() => undefined)
  }
}
