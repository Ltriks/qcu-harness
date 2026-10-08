/** Trusted local-task owner: only explicit CSV snapshots, no filesystem input API. */
import { randomBytes } from 'node:crypto'
import { CsvAuditRunner } from './index.ts'
import type { Config, AuthorizedCsv, AuditScope, AuditSummary } from './index.ts'
import { PURPOSE, TASK_ERROR } from './task-protocol.ts'
import type { OpenedPage, TaskReceipt } from './task-protocol.ts'

export interface TaskConfig extends Omit<Config, 'scope' | 'authority'> {
  readonly grantMs: number
  readonly maxPages: number
  readonly demoRules: unknown
}
interface Task {
  id: string; scope: AuditScope; grant: AuthorizedCsv | null; csv: Buffer
  runner: CsvAuditRunner; abort: AbortController; running: boolean
  timer: ReturnType<typeof setTimeout>; cleanupFailed: boolean
}
interface Page { binding?: object; epoch: number; revision: number; closing: boolean; task?: Task; lease?: ReturnType<typeof setTimeout> }
const opaque = () => randomBytes(16).toString('hex')
function fail(): never { throw new Error(TASK_ERROR) }
export type TaskExecute = (tableId: string, signal: AbortSignal) => Promise<AuditSummary>

export class CsvTaskOwner {
  private readonly pages = new Map<string, Page>()
  private closed = false
  private running = 0
  constructor(private readonly config: TaskConfig) {
    if ([config.grantMs, config.maxPages].some(value => !Number.isSafeInteger(value) || value <= 0)
      || config.grantMs > 2147483647) fail()
  }
  open(binding?: object): OpenedPage {
    if (this.closed || this.pages.size >= this.config.maxPages) fail()
    const key = opaque(); const page: Page = { binding, epoch: 0, revision: 0, closing: false }
    this.pages.set(key, page); this.lease(key, page)
    return { page: key, limits: { maxInputBytes: this.config.maxInputBytes, maxRuleBytes: this.config.maxRuleBytes } }
  }
  private lease(key: string, page: Page): void {
    clearTimeout(page.lease)
    page.lease = setTimeout(() => {
      page.closing = true; ++page.epoch
      void (page.task ? this.retire(page, page.task) : Promise.resolve()).then(() => {
        this.pages.delete(key)
      }, () => { /* Retain the closing page for authenticated recovery. */ })
    }, this.config.grantMs)
    page.lease.unref?.()
  }
  private page(key: string, binding?: object): Page {
    const page = /^[0-9a-f]{32}$/.test(key) ? this.pages.get(key) : undefined
    if (!page || page.binding !== binding) fail()
    return page
  }
  private advance(page: Page, revision: number): number {
    if (!Number.isSafeInteger(revision) || revision <= page.revision) fail()
    page.revision = revision
    return ++page.epoch
  }
  async authorize(key: string, revision: number, csvBase64: string, rules: unknown, ruleKind: 'demo' | 'personal', consent: unknown, purpose: unknown, binding?: object): Promise<TaskReceipt> {
    const page = this.page(key, binding)
    if (this.closed || page.closing || consent !== true || purpose !== PURPOSE
      || !['demo', 'personal'].includes(ruleKind) || typeof csvBase64 !== 'string'
      || csvBase64.length > Math.ceil(this.config.maxInputBytes / 3) * 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(csvBase64)) fail()
    const csv = Buffer.from(csvBase64, 'base64')
    if (!csv.length || csv.length > this.config.maxInputBytes || csv.toString('base64') !== csvBase64) fail()
    const selectedRules: unknown = ruleKind === 'demo' ? this.config.demoRules : rules
    const ruleText = JSON.stringify(selectedRules)
    if (!ruleText || Buffer.byteLength(ruleText) > this.config.maxRuleBytes
      || !selectedRules || typeof selectedRules !== 'object' || Array.isArray(selectedRules)) fail()
    const epoch = this.advance(page, revision)
    if (page.task) await this.retire(page, page.task)
    if (this.closed || page.closing || page.epoch !== epoch) fail()
    const id = opaque(); const scope: AuditScope = { kind: 'local-task', id: opaque() }
    const expiresAt = Date.now() + this.config.grantMs
    const grant: AuthorizedCsv = { format: 'csv', purpose: PURPOSE, scope, expiresAt, csv,
      rules: JSON.parse(ruleText) as unknown }
    const task = {} as Task
    const authority = { resolve: async (tableId: string, rulesId: string, caller: AuditScope) =>
      !this.closed && !page.closing && page.task === task && tableId === id && rulesId === 'explicit'
        && caller.kind === scope.kind && caller.id === scope.id ? task.grant : null }
    Object.assign(task, { id, scope, grant, csv, abort: new AbortController(), running: false, cleanupFailed: false,
      runner: new CsvAuditRunner({ ...this.config, scope, authority }),
      timer: setTimeout(() => { ++page.epoch; void this.retire(page, task).catch(() => { task.cleanupFailed = true }) }, this.config.grantMs) })
    task.timer.unref?.()
    page.task = task
    this.lease(key, page)
    return { taskId: id, expiresAt }
  }
  private task(key: string, id: string, binding?: object): { page: Page; task: Task } {
    const page = this.page(key, binding); const task = page.task
    if (this.closed || page.closing || !task || task.id !== id || !task.grant
      || task.cleanupFailed || task.grant.expiresAt <= Date.now()) fail()
    return { page, task }
  }
  async check(key: string, id: string, signal: AbortSignal, execute: TaskExecute, binding?: object): Promise<AuditSummary> {
    const { page, task } = this.task(key, id, binding)
    if (task.running || signal.aborted) fail()
    task.running = true
    this.lease(key, page)
    try {
      const result = await execute(id, AbortSignal.any([signal, task.abort.signal]))
      if (page.task !== task || task.abort.signal.aborted) fail()
      this.task(key, id, binding)
      return result
    } finally { task.running = false }
  }
  /** Internal tool dispatch; model Agent calls are refused by the Host entry. */
  async diagnose(id: string, signal: AbortSignal): Promise<AuditSummary> {
    for (const page of this.pages.values()) if (page.task?.id === id) {
      const task = page.task
      if (this.closed || page.closing || !task.grant || task.cleanupFailed) fail()
      if (this.running >= this.config.maxConcurrentRuns) fail()
      ++this.running
      try { return await task.runner.run(id, 'explicit', task.scope, AbortSignal.any([signal, task.abort.signal])) }
      finally { --this.running }
    }
    fail()
  }
  private async retire(page: Page, task: Task): Promise<void> {
    task.grant = null; clearTimeout(task.timer); task.abort.abort(); task.csv.fill(0)
    try {
      await task.runner.dispose()
      task.cleanupFailed = false
      if (page.task === task) page.task = undefined
    } catch (_error) { task.cleanupFailed = true; fail() }
  }
  async cancel(key: string, revision: number, binding?: object): Promise<void> {
    const page = this.page(key, binding); this.advance(page, revision)
    if (page.task) await this.retire(page, page.task)
    if (page.closing) { clearTimeout(page.lease); this.pages.delete(key) }
    else this.lease(key, page)
  }
  async close(key: string, revision: number, binding?: object): Promise<void> {
    const page = this.page(key, binding); this.advance(page, revision); page.closing = true; clearTimeout(page.lease)
    if (page.task) await this.retire(page, page.task)
    this.pages.delete(key)
  }
  /** Trusted carrier teardown; independent of client revision delivery/exhaustion. */
  async disconnect(key: string, binding: object): Promise<void> {
    if (!this.pages.has(key)) return
    const page = this.page(key, binding)
    page.closing = true; ++page.epoch; clearTimeout(page.lease)
    if (page.task) await this.retire(page, page.task)
    this.pages.delete(key)
  }
  /** Retry only revoked/closing pages; never cancel another page's live grant. */
  async recover(binding?: object): Promise<void> {
    const work = [...this.pages.entries()].filter(([, page]) => (binding === undefined || page.binding === binding) && (page.closing || page.task?.cleanupFailed))
    const results = await Promise.allSettled(work.map(async ([key, page]) => {
      if (page.task) await this.retire(page, page.task)
      if (page.closing) { clearTimeout(page.lease); this.pages.delete(key) }
    }))
    if (results.some(value => value.status === 'rejected')) fail()
  }
  /** A stopped owner admits only cleanup retries through its retained route. */
  async dispose(): Promise<void> {
    this.closed = true
    const pages = [...this.pages.entries()]
    for (const [, page] of pages) { page.closing = true; ++page.epoch; clearTimeout(page.lease) }
    const results = await Promise.allSettled(pages.map(async ([key, page]) => {
      if (page.task) await this.retire(page, page.task)
      this.pages.delete(key)
    }))
    if (results.some(value => value.status === 'rejected')) fail()
  }
  get stopped(): boolean { return this.closed }
}
