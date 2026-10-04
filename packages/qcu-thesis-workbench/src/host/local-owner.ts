/** Private Host lifecycle and native-only admission; never serialized to the Client. */
import { QcuService, type QcuServiceDependencies, type QcuServiceOptions } from './qcu-service.ts'

/** Private owner capability used only by the effect-owned desktop IPC publisher; not a package export. */
export interface QcuPrivateServiceBinding {
  /** Whether this exact owner currently admits native work. */
  available(): boolean
  /** Return the private service origin only while the owner is ready. */
  acquireNativeTarget(): Promise<{ readonly origin: string }>
  /** Close native admission synchronously; returned cleanup promises become the awaited stop barrier. */
  onRevoked(listener: () => void | Promise<void>): () => void
}

type Phase = 'idle' | 'starting' | 'ready' | 'failed' | 'stopping' | 'stopped'

/** Owns one local service and closes all native admission before any asynchronous cleanup. */
export class QcuLocalOwner implements QcuPrivateServiceBinding {
  private readonly service: QcuService
  private phase: Phase = 'idle'
  private origin: string | undefined
  private startup: Promise<void> | undefined
  private stopping: Promise<void> | undefined
  private readonly listeners = new Set<() => void | Promise<void>>()
  private revocation: Promise<void> = Promise.resolve()

  /** Construct without starting or exposing a service; callbacks receive fixed safe errors only. */
  constructor(options: QcuServiceOptions, dependencies: QcuServiceDependencies = {}) {
    this.service = new QcuService({ ...options, onFailure: () => {
      this.revoke('failed')
      try { options.onFailure?.(new Error('QCU local service unavailable.')) }
      catch (_error) { /* A diagnostic observer cannot interrupt owned-child teardown. */ }
    } }, dependencies)
  }

  /** Start once, join repeated calls, and permit a fresh start only after completed teardown. */
  start(): Promise<void> {
    if (this.stopping !== undefined) return Promise.reject(new Error('QCU local service is stopping.'))
    if (this.phase === 'failed') return Promise.reject(new Error('QCU local service unavailable.'))
    if (this.startup !== undefined) return this.startup
    this.phase = 'starting'
    this.startup = this.service.start().then(ready => {
      if (this.phase !== 'starting') throw new Error('QCU local service unavailable.')
      this.origin = ready.url
      this.phase = 'ready'
    }).catch(() => {
      if (this.phase !== 'stopping' && this.phase !== 'stopped') this.revoke('failed')
      throw new Error('QCU local service unavailable.')
    })
    return this.startup
  }

  /** Revoke synchronously, then join child close; failed teardown retains ownership for a retry. */
  stop(): Promise<void> {
    if (this.stopping !== undefined) return this.stopping
    this.revoke('stopping')
    // Cancel pending service startup immediately, but do not complete stop before native acknowledgment.
    this.stopping = Promise.allSettled([this.service.stop(), this.revocation]).then(results => {
      if (results.some(result => result.status === 'rejected')) throw new Error('QCU shutdown did not complete.')
    }).then(() => {
      this.phase = 'stopped'
      this.startup = undefined
      this.stopping = undefined
    }, () => {
      this.phase = 'failed'
      this.stopping = undefined
      throw new Error('QCU local service shutdown did not complete.')
    })
    return this.stopping
  }

  available(): boolean { return this.phase === 'ready' }

  async acquireNativeTarget(): Promise<{ readonly origin: string }> {
    if (!this.available() || this.origin === undefined) throw new Error('QCU local service unavailable.')
    return { origin: this.origin }
  }

  onRevoked(listener: () => void | Promise<void>): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private revoke(phase: Phase): void {
    const notify = this.phase === 'starting' || this.phase === 'ready'
    this.phase = phase
    this.origin = undefined
    if (!notify) return
    const pending: Promise<void>[] = [this.revocation]
    for (const listener of [...this.listeners]) {
      try { pending.push(Promise.resolve(listener())) }
      catch (_error) {
        // Notify every consumer; an observer failure cannot count as completed native teardown.
        pending.push(Promise.reject(new Error('QCU native teardown did not complete.')))
      }
    }
    this.revocation = Promise.all(pending).then(() => undefined)
    void this.revocation.catch(() => undefined)
  }
}
