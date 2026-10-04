import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { qcuProfileRestrictions } from '../src/qcu-profile-policy.ts'

it('retains precisely the original business patch disable rows without its business configuration', () => {
  const source = readFileSync(new URL('../../../../package/cordis.patch.yml', import.meta.url), 'utf8')
  const rows = JSON.parse(source.replace(/^#.*\n/u, '')) as Array<{ id?: string; disabled?: boolean }>
  const restrictions = qcuProfileRestrictions()
  expect(restrictions).toHaveLength(28)
  expect(restrictions).toEqual(rows.filter(row => row.disabled === true))
  expect(new Set(restrictions.map(row => row.id)).size).toBe(28)
})

it('returns independent disable rows for every launch', () => {
  const first = qcuProfileRestrictions()
  first[0]!.disabled = false
  first.pop()
  expect(qcuProfileRestrictions()).toHaveLength(28)
  expect(qcuProfileRestrictions().every(row => row.disabled === true)).toBe(true)
})
