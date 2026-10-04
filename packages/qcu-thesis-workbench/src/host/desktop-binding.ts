/** Effect-owned fixed QCU handoff. No socket, public service, renderer RPC, or reusable credential exists. */
import { randomUUID } from 'node:crypto'
import type { QcuPrivateServiceBinding } from './local-owner.ts'
import { isQcuPrivateMessage, parseQcuPrivateMessage, qcuPrivateOrigin, type QcuPrivateMessage } from './private-wire.ts'

/** The inherited Node IPC channel; the desktop owns the exact parent/child pair. */
export interface QcuHostIpc {
  readonly connected: boolean
  send?(message: object, callback: (error: Error | null) => void): boolean
  on(event: 'message', listener: (message: unknown) => void): unknown
  on(event: 'disconnect', listener: () => void): unknown
  off(event: 'message', listener: (message: unknown) => void): unknown
  off(event: 'disconnect', listener: () => void): unknown
}

/** Private owner publisher; start readiness separately, and dispose only after owner.stop settles. */
export class QcuDesktopBinding {
  private readonly ownerId = randomUUID()
  private generation: string | undefined
  private bindId: number | undefined
  private phase: 'waiting' | 'binding' | 'ready' | 'granted' | 'revoking' | 'closed' = 'waiting'
  private ready = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private revokePromise: Promise<void> | undefined
  private revokeResolve: (() => void) | undefined
  private revokeReject: ((error: Error) => void) | undefined
  private revokeId = 0
  private unbound = false
  private readonly unsubscribe: () => void
  private readonly listening: boolean

  /** Install synchronously only for the fixed desktop launch marker and inherited Node IPC. The marker is not a credential. */
  constructor(private readonly owner: QcuPrivateServiceBinding, private readonly ipc: QcuHostIpc = process, private readonly timeoutMs = 5000, enabled = process.env.DSH_QCU_PRIVATE_IPC === '1') {
    this.listening = enabled && typeof ipc.send === 'function' && ipc.connected
    this.unsubscribe = owner.onRevoked(() => this.revoke())
    if (!this.listening) return
    ipc.on('message', this.message)
    ipc.on('disconnect', this.disconnected)
  }

  /** Publish the service target only after both readiness and the fixed desktop initiation. */
  serviceReady(): void {
    if (this.ready || this.phase !== 'waiting' || !this.listening || !this.owner.available()) return
    this.ready = true
    this.send({ type: 'qcu:hello', protocolVersion: 1, ownerId: this.ownerId })
  }

  /** Remove only this effect's listeners; callers must first await owner.stop. */
  dispose(): void {
    this.phase = 'closed'
    this.clearTimer()
    this.unsubscribe()
    if (this.listening) {
      this.ipc.off('message', this.message)
      this.ipc.off('disconnect', this.disconnected)
    }
  }

  private readonly message = (value: unknown): void => {
    if (!isQcuPrivateMessage(value)) return
    const message = parseQcuPrivateMessage(value)
    if (message === undefined) { this.fail(); return }
    // A replacement effect cannot consume or acknowledge the preceding owner's traffic.
    if (message.ownerId !== this.ownerId) return
    if (message.type === 'qcu:bind') {
      if (this.phase !== 'waiting') { this.fail(); return }
      this.generation = message.generation
      this.bindId = message.requestId
      this.phase = 'binding'
      this.armTimeout()
      void this.publishReady()
      return
    }
    if (!('generation' in message) || message.generation !== this.generation) { this.fail(); return }
    if (message.type === 'qcu:grant') {
      // A grant already queued by main cannot reopen an owner that is stopping or stopped.
      if (message.requestId === this.bindId && (this.phase === 'revoking' || this.phase === 'closed')) return
      if (this.phase !== 'ready' || message.requestId !== this.bindId || !this.owner.available()) { this.fail(); return }
      this.phase = 'granted'
      this.clearTimer()
      this.send({ ...message, type: 'qcu:granted' })
    } else if (message.type === 'qcu:revoked') {
      if (this.unbound && message.requestId === this.revokeId) return
      if (this.phase !== 'revoking' || message.requestId !== this.revokeId) { this.fail(); return }
      this.clearTimer()
      this.phase = 'closed'
      if (message.ok) this.revokeResolve?.()
      else this.revokeReject?.(new Error('QCU native teardown did not complete.'))
    } else if (message.type === 'qcu:unbind') {
      if (message.requestId !== (this.bindId ?? 0) + 1 || this.unbound) { this.fail(); return }
      // Main sends this only after its native teardown barrier completed successfully.
      this.unbound = true
      this.phase = 'closed'
      this.clearTimer()
      this.send({ ...message, type: 'qcu:unbound' })
      this.revokeResolve?.()
    } else this.fail()
  }

  private async publishReady(): Promise<void> {
    if (!this.ready || this.phase !== 'binding' || this.generation === undefined || this.bindId === undefined) return
    const generation = this.generation
    const requestId = this.bindId
    try {
      const target = await this.owner.acquireNativeTarget()
      if (this.phase !== 'binding' || generation !== this.generation || !this.owner.available()) return
      const origin = qcuPrivateOrigin(target.origin)
      if (origin === undefined) { this.fail(); return }
      this.phase = 'ready'
      this.send({ type: 'qcu:ready', protocolVersion: 1, ownerId: this.ownerId, generation, requestId, origin: target.origin.replace(/\/$/, '') })
    } catch (_error) { this.fail() }
  }

  private revoke(): Promise<void> {
    if (this.revokePromise !== undefined) return this.revokePromise
    if (!this.listening || this.generation === undefined || this.unbound) {
      this.phase = 'closed'
      return Promise.resolve()
    }
    this.phase = 'revoking'
    this.revokeId = (this.bindId ?? 0) + 1
    this.revokePromise = new Promise<void>((resolve, reject) => { this.revokeResolve = resolve; this.revokeReject = reject })
    // Failure can precede effect disposal; retain the rejection for stop without an unhandled rejection.
    void this.revokePromise.catch(() => undefined)
    this.armTimeout()
    this.send({ type: 'qcu:revoke', protocolVersion: 1, ownerId: this.ownerId, generation: this.generation, requestId: this.revokeId })
    return this.revokePromise
  }

  private readonly disconnected = (): void => { this.fail() }

  private send(message: QcuPrivateMessage): void {
    if (!this.ipc.connected || this.ipc.send === undefined) { this.fail(); return }
    try { this.ipc.send(message, error => { if (error !== null) this.fail() }) }
    catch (_error) { this.fail() }
  }

  private armTimeout(): void {
    this.clearTimer()
    this.timer = setTimeout(() => { this.fail() }, this.timeoutMs)
  }

  private clearTimer(): void { clearTimeout(this.timer); this.timer = undefined }

  private fail(): void {
    this.phase = 'closed'
    this.clearTimer()
    if (this.generation !== undefined && this.revokePromise === undefined && !this.unbound) {
      void this.revoke().catch(() => undefined)
    } else this.revokeReject?.(new Error('QCU native binding unavailable.'))
  }
}
