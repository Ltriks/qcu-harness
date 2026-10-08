/** Browser-safe protocol; filenames, raw records and paths are not response fields. */
import type { AuditSummary } from './index.ts'
export const TASK_PATH = '/api/qcu-csv-task'
export const TASK_WS_PATH = '/api/qcu-csv-task-ws'
export const TASK_WS_PROTOCOL = 'qcu.csv.v1'
export const TASK_ERROR = 'CSV task unavailable; check authorization or retry cleanup.'
export const PURPOSE = 'diagnose-csv'
export const ISSUE_CODES = ['blank', 'surrounding_whitespace', 'duplicate_row', 'duplicate_key',
  'required_missing', 'invalid_integer', 'invalid_number', 'invalid_date', 'formula_like_text'] as const
export interface TaskReceipt { taskId: string; expiresAt: number }
export interface TaskLimits { maxInputBytes: number; maxRuleBytes: number }
export interface OpenedPage { page: string; limits: TaskLimits }
export function parseSummary(value: unknown): AuditSummary {
  if (!value || typeof value !== 'object') throw new Error(TASK_ERROR)
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join(',') !== 'counts,issues,rows,status' || data.status !== 'completed'
    || !Number.isSafeInteger(data.rows) || !Number.isSafeInteger(data.issues)
    || Number(data.rows) < 0 || Number(data.issues) < 0 || !data.counts || typeof data.counts !== 'object') throw new Error(TASK_ERROR)
  const raw = data.counts as Record<string, unknown>
  if (Object.keys(raw).sort().join(',') !== [...ISSUE_CODES].sort().join(',')) throw new Error(TASK_ERROR)
  const counts: Record<string, number> = {}
  for (const key of ISSUE_CODES) {
    if (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0) throw new Error(TASK_ERROR)
    counts[key] = Number(raw[key])
  }
  if (Object.values(counts).reduce((a, b) => a + b, 0) !== data.issues) throw new Error(TASK_ERROR)
  return { status: 'completed', rows: Number(data.rows), issues: Number(data.issues), counts }
}
export function countExport(value: unknown): string { return JSON.stringify(parseSummary(value), null, 2) + '\n' }
