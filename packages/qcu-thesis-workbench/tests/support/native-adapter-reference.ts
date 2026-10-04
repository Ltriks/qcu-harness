/** Synthetic reference only: models fixed IPC admission and revocation, not Electron isolation. */
import { parseQcuNativeRequest, QCU_NATIVE_PROTOCOL_VERSION, type QcuBounds, type QcuContextId } from '../../src/native-contract.ts'
import type { QcuPrivateServiceBinding } from '../../src/host/local-owner.ts'

/** Every native callback must check this lease after each await and before any side effect. */
export interface QcuReferenceLease {
  readonly signal: AbortSignal
  current(): boolean
}

/** Trusted, fixed-QCU test callbacks; none of this interface is exposed to a renderer. */
export interface QcuReferenceNativeAdapter {
  readonly protocolVersion: number
  available(): boolean
  open(contextId: QcuContextId, bounds: QcuBounds, origin: string, lease: QcuReferenceLease): Promise<void>
  setBounds(contextId: QcuContextId, bounds: QcuBounds): void
  back(contextId: QcuContextId): Promise<void>
  /** Must revoke its occurrence synchronously, before returning pending cleanup. */
  close(contextId: QcuContextId): Promise<void>
}

/** Process-lifetime admission; native replacement must not clear a failed private-session cleanup. */
export interface QcuReferenceAdmission { cleanupFailed: boolean }

interface Occurrence {
  readonly contextId: QcuContextId
  readonly abort: AbortController
  bounds: QcuBounds
  nativeStarted: boolean
  opening: Promise<void>
}

/** Fixed-QCU reference dispatcher for synthetic conformance tests; not shipped in the package. */
export class QcuNativeReferenceDispatcher {
  private active: Occurrence | undefined
  private enabled = true
  private bound = true
  private disposed = false
  private readonly retired = new Set<QcuContextId>()
  private readonly cleanup = new Set<Promise<void>>()
  private readonly unsubscribe: () => void

  constructor(private readonly options: {
    readonly owner: object
    readonly native?: QcuReferenceNativeAdapter
    readonly service?: QcuPrivateServiceBinding
    readonly admission: QcuReferenceAdmission
  }) {
    this.unsubscribe = options.service?.onRevoked(() => {
      this.bound = false
      this.retire()
    }) ?? (() => {})
  }

  /** Sender identity stands in for trusted Electron main-frame/owner authorization in these tests. */
  async dispatch(sender: object, operation: unknown, ...args: readonly unknown[]): Promise<boolean | void> {
    if (sender !== this.options.owner) throw new Error('QCU sender is not authorized')
    const request = parseQcuNativeRequest(operation, args)
    if (request.operation === 'available') {
      if (!this.available()) this.retire()
      return this.available()
    }
    if (request.operation === 'close') {
      // Retiring an unopened occurrence prevents close-before-open IPC races from resurrecting it.
      this.retired.add(request.contextId)
      if (this.active?.contextId === request.contextId) this.retire()
      await this.waitCleanup()
      return
    }
    if (!this.available()) {
      if (request.operation === 'open') this.retired.add(request.contextId)
      this.retire()
      throw new Error('QCU task is unavailable')
    }
    if (request.operation === 'open') return this.open(request.contextId, request.bounds)
    const active = this.active
    if (active?.contextId !== request.contextId) return
    if (request.operation === 'setBounds') {
      active.bounds = request.bounds
      if (active.nativeStarted) {
        try { this.options.native!.setBounds(active.contextId, request.bounds) }
        catch (_error) { this.retire(); throw new Error('QCU task operation failed') }
      }
      return
    }
    if (active.nativeStarted) {
      try { await this.options.native!.back(active.contextId) }
      catch (_error) { throw new Error('QCU task operation failed') }
    }
  }

  /** Trusted plugin disable, never an IPC operation. Revocation happens before this call returns. */
  setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled
    if (!enabled) this.retire()
    return this.waitCleanup()
  }

  /** Trusted service loss, never an IPC operation. No rebind or provider-registration API exists. */
  unbindService(): Promise<void> {
    this.bound = false
    this.retire()
    return this.waitCleanup()
  }

  /** Trusted owner/process teardown; independent of renderer close or pending service readiness. */
  dispose(): Promise<void> {
    this.disposed = true
    this.unsubscribe()
    this.retire()
    return this.waitCleanup()
  }

  private available(): boolean {
    try {
      return !this.disposed && this.enabled && this.bound && !this.options.admission.cleanupFailed
        && this.options.native?.protocolVersion === QCU_NATIVE_PROTOCOL_VERSION
        && this.options.native.available() && this.options.service?.available() === true
    } catch (_error) { return false }
  }

  private current(occurrence: Occurrence): boolean {
    return this.active === occurrence && !occurrence.abort.signal.aborted && this.available()
  }

  private open(contextId: QcuContextId, bounds: QcuBounds): Promise<void> {
    if (this.retired.has(contextId)) return Promise.reject(new Error('QCU context is retired'))
    if (this.active?.contextId === contextId) {
      this.active.bounds = bounds
      if (this.active.nativeStarted) {
        try { this.options.native!.setBounds(contextId, bounds) }
        catch (_error) { this.retire(); return Promise.reject(new Error('QCU task operation failed')) }
      }
      return this.active.opening
    }
    this.retire()
    const occurrence: Occurrence = {
      contextId, bounds, abort: new AbortController(), nativeStarted: false, opening: Promise.resolve(),
    }
    this.active = occurrence
    occurrence.opening = this.activate(occurrence)
    return occurrence.opening
  }

  private async activate(occurrence: Occurrence): Promise<void> {
    try {
      await this.waitCleanup()
      if (!this.current(occurrence)) return
      const target = await this.options.service!.acquireNativeTarget()
      if (!this.current(occurrence)) return
      const origin = exactPrivateOrigin(target.origin)
      occurrence.nativeStarted = true
      await this.options.native!.open(occurrence.contextId, occurrence.bounds, origin, {
        signal: occurrence.abort.signal, current: () => this.current(occurrence),
      })
    } catch (_error) {
      if (!this.current(occurrence)) return
      this.retire()
      await this.waitCleanup()
      throw new Error('QCU task could not be opened')
    }
  }

  private retire(): void {
    const occurrence = this.active
    this.active = undefined
    if (occurrence === undefined) return
    this.retired.add(occurrence.contextId)
    occurrence.abort.abort()
    if (!occurrence.nativeStarted) return
    let pending: Promise<void>
    try { pending = this.options.native!.close(occurrence.contextId) }
    catch (_error) { pending = Promise.reject(new Error('QCU cleanup failed')) }
    const cleanup = pending.then(() => {}, () => {
      this.options.admission.cleanupFailed = true
      this.retire()
    })
    this.cleanup.add(cleanup)
    void cleanup.then(() => { this.cleanup.delete(cleanup) })
  }

  private async waitCleanup(): Promise<void> {
    await Promise.all(this.cleanup)
    if (this.options.admission.cleanupFailed) throw new Error('QCU task session cleanup failed')
  }
}

function exactPrivateOrigin(value: string): string {
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/?$/u.exec(value)
  if (match === null || Number(match[1]) > 65_535) throw new Error('Invalid QCU service origin')
  return new URL(value).origin
}
