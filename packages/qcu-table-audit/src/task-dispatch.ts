/** Shared narrow operation schema. Carrier identities are server-owned objects. */
import type { CsvTaskOwner, TaskExecute } from './task-owner.ts'
import { PURPOSE, TASK_ERROR } from './task-protocol.ts'

export function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new Error(TASK_ERROR)
}
export async function dispatch(owner: CsvTaskOwner, value: Record<string, unknown>, page: string,
  signal: AbortSignal, execute: TaskExecute, binding?: object): Promise<unknown> {
  const fail = (): never => { throw new Error(TASK_ERROR) }
  if (owner.stopped || signal.aborted) fail()
  if (value.operation === 'authorize') {
    exact(value, ['operation', 'revision', 'purpose', 'format', 'consent', 'csv', 'ruleKind', 'rules'])
    if (value.format !== 'csv' || value.purpose !== PURPOSE || typeof value.csv !== 'string'
      || !['demo', 'personal'].includes(String(value.ruleKind)) || typeof value.revision !== 'number') fail()
    return owner.authorize(page, value.revision as number, value.csv as string, value.rules,
      value.ruleKind as 'demo' | 'personal', value.consent, value.purpose, binding)
  }
  if (value.operation === 'check') {
    exact(value, ['operation', 'taskId']); if (typeof value.taskId !== 'string') fail()
    return owner.check(page, value.taskId as string, signal, execute, binding)
  }
  if (value.operation === 'cancel' || value.operation === 'retry' || value.operation === 'close') {
    exact(value, ['operation', 'revision']); if (typeof value.revision !== 'number') fail()
    if (value.operation === 'cancel') await owner.cancel(page, value.revision as number, binding)
    else await owner.close(page, value.revision as number, binding)
    return { cleared: true }
  }
  fail()
}
