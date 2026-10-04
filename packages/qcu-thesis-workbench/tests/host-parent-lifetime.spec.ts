/** Python supervises actual Node→Python descendants and reaps its own fixtures. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it.skipIf(process.platform === 'win32')('verifies parent pipe lifetime, startup races, bounded shutdown and standalone negative controls', async () => {
  const { stdout, stderr } = await promisify(execFile)(process.env.QCU_SERVICE_PYTHON ?? 'python3', [
    '-B', resolve('tests/test_parent_lifetime.py'),
  ], {
    env: { ...process.env, QCU_TEST_NODE: process.execPath, QCU_TEST_TSX: import.meta.resolve('tsx') },
    timeout: 100_000, maxBuffer: 1024 * 1024,
  })
  expect(stdout + stderr).toContain('OK')
  expect(stdout + stderr).not.toContain('synthetic-private-canary')
  if (process.platform === 'linux') expect(stdout + stderr).not.toContain('skipped')
}, 105_000)
