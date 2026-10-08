/** Official Client discovery ignores subpath Host rows. */
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { exactPackageSpecifier } from '@deepseek-ai/dsh-client-modules/src/client/manifest.ts'
it('exposes the task Host at a package-root row for official Client discovery', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const patches = JSON.parse(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'))
  const task = patches[0].insert.find(row => row.id === 'qcu-table-audit-task')
  expect(exactPackageSpecifier(task.name)).toBe(pkg.name)
  expect(exactPackageSpecifier(pkg.name + '/task-host')).toBeUndefined()
  expect(pkg.exports['.']).toBe('./lib/task-host.js')
  expect(pkg.exports['./adapter']).toBe('./lib/index.js')
  expect(task.disabled).toBe(true)
  expect(task.config.enabled).toBe(false)
})
