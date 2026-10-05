/** Ephemeral native-view ownership; it never receives document content; an optional Session identity is hashed locally. */
import { qcuContextId } from '../native-contract.ts'
import type { QcuBounds, QcuContextId, QcuNativeBridge } from '../native-contract.ts'

/** Only presentation state crosses back into the main Client. */
export interface QcuEntryState {
  readonly availability: 'checking' | 'ready' | 'unavailable'
  readonly phase: 'idle' | 'opening' | 'open'
  readonly error?: 'failed' | 'closeFailed'
}

interface Occurrence {
  id: QcuContextId
  bounds: QcuBounds
  requested: boolean
}

/** A bridge is captured for one mounted Session-scoped entry. */
export class QcuPanelController {
  private state: QcuEntryState = { availability: 'checking', phase: 'idle' }
  private active: Occurrence | undefined
  private disposed = false
  private checkRevision = 0
  private closeFailed = false
  private pendingCloses = 0

  /**
   * @param bridge - Version-checked, fixed QCU native methods, or absence.
   * @param changed - Receives localized-state keys, never native exception text.
   * @param createId - Generates one unpredictable occurrence identifier per explicit open.
   */
  constructor(
    private readonly bridge: QcuNativeBridge | undefined,
    private readonly changed: (state: QcuEntryState) => void,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly sessionKey?: string,
  ) {}

  /** @returns A stable snapshot until presentation state changes. */
  getSnapshot(): QcuEntryState { return this.state }

  private update(state: QcuEntryState): void {
    if (this.disposed) return
    this.state = state
    this.changed(state)
  }

  /** Check support without opening a view or issuing any task request. */
  async checkAvailability(): Promise<void> {
    if (this.disposed || this.active || this.closeFailed || this.pendingCloses > 0) return
    const revision = ++this.checkRevision
    this.update({ availability: 'checking', phase: 'idle' })
    let available = false
    try {
      available = await this.bridge?.available() === true
    } catch (_error) {
      // Bridge errors are intentionally reduced to a fixed unavailable state.
    }
    if (this.disposed || revision !== this.checkRevision || this.active || this.closeFailed || this.pendingCloses > 0) return
    this.update({ availability: available ? 'ready' : 'unavailable', phase: 'idle' })
  }

  /**
   * Open only after an explicit entry click and a second capability check.
   * @param bounds - The entry's own empty view rectangle in CSS pixels.
   */
  async open(bounds: QcuBounds): Promise<void> {
    if (this.disposed || this.active || this.closeFailed || this.pendingCloses > 0) return
    const bridge = this.bridge
    if (!bridge) {
      this.update({ availability: 'unavailable', phase: 'idle' })
      return
    }
    ++this.checkRevision
    let occurrence: Occurrence
    try {
      occurrence = { id: qcuContextId(this.createId()), bounds, requested: false }
    } catch (_error) {
      this.update({ availability: 'ready', phase: 'idle', error: 'failed' })
      return
    }
    this.active = occurrence
    this.update({ availability: 'ready', phase: 'opening' })
    try {
      const available = await bridge.available()
      if (this.active !== occurrence || this.disposed) return
      if (available !== true) {
        this.active = undefined
        this.update({ availability: 'unavailable', phase: 'idle' })
        return
      }
      if (this.sessionKey !== undefined) {
        if (!this.sessionKey || this.sessionKey.length > 256) throw new Error('Invalid QCU session')
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this.sessionKey))
        if (this.active !== occurrence || this.disposed) return
        const tag = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
        occurrence.id = qcuContextId(`scope_${tag}_${occurrence.id}`)
      }
      occurrence.requested = true
      await bridge.open(occurrence.id, occurrence.bounds)
      if (this.active !== occurrence || this.disposed) {
        await this.release(occurrence)
        return
      }
      this.update({ availability: 'ready', phase: 'open' })
    } catch (_error) {
      if (this.active !== occurrence || this.disposed) return
      this.active = undefined
      await this.release(occurrence)
      this.update({ availability: 'ready', phase: 'idle', error: this.closeFailed ? 'closeFailed' : 'failed' })
    }
  }

  /**
   * Keep an opening or open occurrence aligned with its own element.
   * @param bounds - CSS-pixel bounds; never a document or file reference.
   */
  async resize(bounds: QcuBounds): Promise<void> {
    const occurrence = this.active
    if (this.disposed || !occurrence) return
    occurrence.bounds = bounds
    if (!occurrence.requested) return
    try {
      await this.bridge?.setBounds(occurrence.id, bounds)
    } catch (_error) {
      if (this.active !== occurrence || this.disposed) return
      await this.close()
      this.update({ availability: 'ready', phase: 'idle', error: this.closeFailed ? 'closeFailed' : 'failed' })
    }
  }

  /** Navigate only within the native panel's fixed QCU history. */
  async back(): Promise<void> {
    const occurrence = this.active
    if (this.disposed || !occurrence || this.state.phase !== 'open') return
    try {
      await this.bridge?.back(occurrence.id)
    } catch (_error) {
      if (this.active !== occurrence || this.disposed) return
      await this.close()
      this.update({ availability: 'ready', phase: 'idle', error: this.closeFailed ? 'closeFailed' : 'failed' })
    }
  }

  private async release(occurrence: Occurrence): Promise<void> {
    if (!occurrence.requested) return
    ++this.pendingCloses
    try {
      await this.bridge?.close(occurrence.id)
    } catch (_error) {
      // A failed close blocks reopening; it is not reported as cancellation of computation.
      this.closeFailed = true
      const newer = this.active
      if (newer && newer !== occurrence) {
        this.active = undefined
        await this.release(newer)
      }
      this.update({ availability: 'unavailable', phase: 'idle', error: 'closeFailed' })
    } finally {
      --this.pendingCloses
    }
  }

  /** Revoke this occurrence. This does not cancel any server-side computation. */
  async close(): Promise<void> {
    const revision = ++this.checkRevision
    const availability = this.state.availability
    const occurrence = this.active
    this.active = undefined
    this.update({ availability: occurrence?.requested ? 'checking' : availability, phase: 'idle' })
    if (occurrence) await this.release(occurrence)
    if (revision !== this.checkRevision || this.active) return
    this.update(this.closeFailed
      ? { availability: 'unavailable', phase: 'idle', error: 'closeFailed' }
      : { availability, phase: 'idle' })
  }

  /** Retire before teardown so late promises cannot revive a removed Session entry. */
  async dispose(): Promise<void> {
    this.disposed = true
    await this.close()
  }
}
