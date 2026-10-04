import { expect, it } from 'vitest'
import { qcuDedicatedLaunch } from '../src/qcu-launch.ts'

const ordinary = { layers: [], skippedBundles: [] }
const business = { ...ordinary, skippedBundles: [{ packageName: 'qcu-thesis-workbench', reason: 'synthetic missing package' }] }
it('preserves ordinary mode only for an ordinary profile', () => {
  expect(qcuDedicatedLaunch(undefined, ordinary)).toBe(false)
})
it('requires a dedicated launch even when the selected business package is missing', () => {
  expect(() => qcuDedicatedLaunch(undefined, business)).toThrow('requires the protected')
})
it('keeps dedicated mode after all business and policy rows are removed', () => {
  expect(qcuDedicatedLaunch('1', ordinary)).toBe(true)
  expect(qcuDedicatedLaunch('1', business)).toBe(true)
})
it.each(['', '0', 'false', '2', 'true'])('rejects ambiguous dedicated mode %s before loading entries', (selection) => {
  expect(() => qcuDedicatedLaunch(selection, ordinary)).toThrow('Invalid QCU')
})
