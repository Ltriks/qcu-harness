import { expect, it, vi } from 'vitest'
import { CsvTaskController, browserTransport } from '../src/client/controller.ts'
import type { TaskTransport } from '../src/client/controller.ts'
import { ISSUE_CODES, countExport } from '../src/task-protocol.ts'
const page = '1'.repeat(32); const taskId = '2'.repeat(32)
const summary = { status: 'completed', rows: 4, issues: 0, counts: Object.fromEntries(ISSUE_CODES.map(code => [code, 0])) }
function fixture() {
  const api = vi.fn<TaskTransport>(async body => {
    if (body.operation === 'open') return { page, limits: { maxInputBytes: 1000, maxRuleBytes: 1000 } }
    if (body.operation === 'authorize') return { taskId, expiresAt: Date.now() + 60000 }
    if (body.operation === 'check') return summary
    return { cleared: true }
  })
  const read = vi.fn(async () => new TextEncoder().encode('id\n0001\n').buffer as ArrayBuffer)
  const file = { name: 'synthetic.csv', size: 8, arrayBuffer: read }
  return { api, read, file, controller: new CsvTaskController(api) }
}
it('never reads file bytes on selection or without consent, then authorizes and exports counts only', async () => {
  const f = fixture(); await f.controller.open(); await f.controller.select(f.file)
  expect(f.read).not.toHaveBeenCalled()
  await f.controller.authorize(false, 'demo', '{}'); expect(f.read).not.toHaveBeenCalled()
  await f.controller.authorize(true, 'personal', '{}'); expect(f.read).toHaveBeenCalledOnce()
  await f.controller.check()
  expect(JSON.parse(f.controller.export())).toEqual(summary)
  const authorize = f.api.mock.calls.find(([body]) => body.operation === 'authorize')?.[0]
  expect(authorize).toMatchObject({ consent: true, purpose: 'diagnose-csv', ruleKind: 'personal' })
  expect(JSON.stringify(authorize)).not.toContain('synthetic.csv')
  await f.controller.cancel(); expect(f.controller.getSnapshot().summary).toBeUndefined()
  await f.controller.select(f.file); await f.controller.dispose()
})
it('discards a file read that completes after cancellation, without sending late authorization', async () => {
  const f = fixture(); let release = (_value: ArrayBuffer): void => {}
  f.read.mockImplementation(() => new Promise<ArrayBuffer>(resolve => { release = resolve }))
  await f.controller.open(); await f.controller.select(f.file)
  const pending = f.controller.authorize(true, 'demo', '{}')
  await f.controller.cancel(); release(new TextEncoder().encode('id\n0001\n').buffer as ArrayBuffer); await pending
  expect(f.api.mock.calls.filter(([body]) => body.operation === 'authorize')).toEqual([])
  expect(f.controller.getSnapshot().phase).toBe('idle'); await f.controller.dispose()
})
it('shows fixed failure and permits cleanup retry without publishing raw errors', async () => {
  const f = fixture(); await f.controller.open()
  f.api.mockRejectedValueOnce(new Error('SYNTHETIC-PRIVATE-ERROR'))
  await f.controller.select(f.file)
  expect(f.controller.getSnapshot().phase).toBe('failed')
  expect(JSON.stringify(f.controller.getSnapshot())).not.toContain('SYNTHETIC-PRIVATE-ERROR')
  await f.controller.retryCleanup(); expect(f.controller.getSnapshot().phase).toBe('idle')
  await f.controller.dispose()
})
it('refuses oversized/unsupported inputs before reading and unsafe export projections', async () => {
  const f = fixture(); await f.controller.open(); await f.controller.select({ ...f.file, name: 'synthetic.docx' })
  expect(f.read).not.toHaveBeenCalled(); await f.controller.retryCleanup()
  await f.controller.select({ ...f.file, size: 1001 }); expect(f.read).not.toHaveBeenCalled()
  expect(() => countExport({ ...summary, filename: 'private.csv' })).toThrow()
  expect(() => countExport({ ...summary, counts: { ...summary.counts, private: 1 } })).toThrow()
  await f.controller.dispose()
})
it('uses only the fixed same-origin authenticated API with page capability outside the URL', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ cleared: true }))
  await browserTransport(fetcher)({ operation: 'cancel', revision: 1 }, page)
  expect(fetcher.mock.calls[0]?.[0]).toBe('/api/qcu-csv-task')
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'x-qcu-page': page } })
})
