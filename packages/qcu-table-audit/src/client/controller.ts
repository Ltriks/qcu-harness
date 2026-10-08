/** Local page state; selection is read only after explicit per-file confirmation. */
import { countExport, parseSummary, PURPOSE, TASK_ERROR, TASK_PATH } from '../task-protocol.ts'
import type { OpenedPage, TaskReceipt } from '../task-protocol.ts'
import type { AuditSummary } from '../index.ts'
import { nativeTaskTransport } from './socket-transport.ts'
export interface CsvChoice { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
export interface TaskTransport {
  (body: Record<string, unknown>, page?: string, signal?: AbortSignal): Promise<unknown>
  dispose?(): void
}
export interface TaskState {
  phase: 'opening' | 'idle' | 'selected' | 'authorizing' | 'ready' | 'checking' | 'complete' | 'clearing' | 'failed' | 'closed'
  filename?: string; summary?: AuditSummary; error?: string; expiresAt?: number
}
export function browserTransport(fetcher: typeof fetch = fetch): TaskTransport {
  return async (body, page, signal) => {
    const response = await fetcher(TASK_PATH, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(page ? { 'x-qcu-page': page } : {}) },
      body: JSON.stringify(body), signal })
    if (!response.ok) throw new Error(TASK_ERROR)
    return response.json() as Promise<unknown>
  }
}
export class CsvTaskController {
  private state: TaskState = { phase: 'opening' }
  private readonly listeners = new Set<() => void>()
  private page?: string
  private limits = { maxInputBytes: 0, maxRuleBytes: 0 }
  private revision = 0
  private epoch = 0
  private file?: CsvChoice
  private receipt?: TaskReceipt
  private abort?: AbortController
  private disposed = false
  constructor(private readonly api: TaskTransport = nativeTaskTransport() ?? browserTransport()) {}
  getSnapshot = (): TaskState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(state: TaskState): void {
    if (this.disposed) return
    this.state = state; for (const listener of this.listeners) listener()
  }
  private failed(): void { this.publish({ phase: 'failed', error: TASK_ERROR }) }
  async open(): Promise<void> {
    try {
      const value = await this.api({ operation: 'open' }) as OpenedPage
      if (!/^[0-9a-f]{32}$/.test(value.page) || !value.limits
        || !Number.isSafeInteger(value.limits.maxInputBytes) || value.limits.maxInputBytes <= 0
        || !Number.isSafeInteger(value.limits.maxRuleBytes) || value.limits.maxRuleBytes <= 0) throw new Error(TASK_ERROR)
      this.page = value.page; this.limits = value.limits
      if (this.disposed) { await this.api({ operation: 'close', revision: ++this.revision }, this.page); return }
      this.publish({ phase: 'idle' })
    } catch (_error) { this.failed() }
  }
  async select(file?: CsvChoice): Promise<void> {
    const epoch = ++this.epoch; this.abort?.abort(); this.receipt = undefined; this.file = undefined
    this.publish({ phase: 'clearing' })
    try {
      if (!this.page) throw new Error(TASK_ERROR)
      await this.api({ operation: 'cancel', revision: ++this.revision }, this.page)
      if (epoch !== this.epoch || this.disposed) return
      if (file && (!/\.csv$/i.test(file.name) || file.size <= 0 || file.size > this.limits.maxInputBytes)) throw new Error(TASK_ERROR)
      this.file = file
      this.publish(file ? { phase: 'selected', filename: file.name } : { phase: 'idle' })
    } catch (_error) { if (epoch === this.epoch) this.failed() }
  }
  async authorize(consent: boolean, ruleKind: 'demo' | 'personal', ruleText: string): Promise<void> {
    const file = this.file
    if (!consent || !file || !this.page || this.state.phase !== 'selected') return
    const epoch = ++this.epoch; const abort = new AbortController(); this.abort = abort
    this.publish({ phase: 'authorizing', filename: file.name })
    try {
      if (new TextEncoder().encode(ruleText).byteLength > this.limits.maxRuleBytes) throw new Error(TASK_ERROR)
      const rules: unknown = ruleKind === 'personal' ? JSON.parse(ruleText) : {}
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength !== file.size || bytes.byteLength > this.limits.maxInputBytes) throw new Error(TASK_ERROR)
      if (epoch !== this.epoch || abort.signal.aborted || this.disposed) return
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
      const value = await this.api({ operation: 'authorize', revision: ++this.revision, purpose: PURPOSE,
        format: 'csv', consent: true, csv: btoa(binary), ruleKind, rules }, this.page, abort.signal) as TaskReceipt
      if (epoch !== this.epoch || this.disposed) return
      if (!/^[0-9a-f]{32}$/.test(value.taskId) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new Error(TASK_ERROR)
      this.receipt = value
      this.publish({ phase: 'ready', filename: file.name, expiresAt: value.expiresAt })
    } catch (_error) { if (epoch === this.epoch && !this.disposed) this.failed() }
  }
  async check(): Promise<void> {
    if (!this.page || !this.receipt || !['ready', 'complete'].includes(this.state.phase)) return
    const epoch = ++this.epoch; const abort = new AbortController(); this.abort = abort
    this.publish({ phase: 'checking', filename: this.file?.name })
    try {
      const value = await this.api({ operation: 'check', taskId: this.receipt.taskId }, this.page, abort.signal)
      if (epoch === this.epoch && !this.disposed) this.publish({ phase: 'complete', filename: this.file?.name, summary: parseSummary(value) })
    } catch (_error) { if (epoch === this.epoch && !this.disposed) this.failed() }
  }
  async cancel(): Promise<void> { await this.select() }
  async retryCleanup(): Promise<void> {
    try {
      if (this.page) {
        try { await this.api({ operation: 'retry', revision: ++this.revision }, this.page); this.page = undefined }
        catch (_error) {
          // Lost/expired page capabilities cannot be revived. Recovery only
          // clears revoked owners; open a new empty page, never reuse a grant.
          await this.api({ operation: 'recover' }); this.page = undefined
        }
      }
      else await this.api({ operation: 'recover' })
      this.file = undefined; this.receipt = undefined
      if (!this.page) await this.open(); else this.publish({ phase: 'idle' })
    } catch (_error) { this.failed() }
  }
  export(): string {
    if (!this.state.summary || this.state.phase !== 'complete') throw new Error(TASK_ERROR)
    return countExport(this.state.summary)
  }
  async dispose(): Promise<void> {
    this.disposed = true; ++this.epoch; this.abort?.abort(); this.file = undefined; this.receipt = undefined
    try { if (this.page) await this.api({ operation: 'close', revision: ++this.revision }, this.page) }
    finally { this.api.dispose?.(); this.listeners.clear() }
  }
}
