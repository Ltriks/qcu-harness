/** Built standard-Web profile retains fixed entry restrictions after business configuration removal. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FiberState } from '@deepseek-ai/cordis'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'
import { expect, it, type TestContext } from 'vitest'
import { qcuProfileRestrictions } from '../../../../../desktop-host/src/qcu-profile-policy.ts'

const repo = resolve(import.meta.dirname, '../../../../../..')
const driver = fileURLToPath(new URL('./fixtures/qcu-persistent-restrictions-driver.mjs', import.meta.url))

interface Phase {
  phase: string
  policy: string
  rows: Array<{ id: string; present: boolean; disabled: boolean; state?: number; name: string }>
  businessPresent: boolean
  businessState?: number
  businessPackageBytesPresent: boolean
  businessDependencyPresent: boolean
  selectedBundles: string[]
  clientEntries: string[]
  rejected?: string
}

interface Result {
  beforeEntryCount?: number
  phases: Phase[]
  modelRequests: number
  error?: string
}

function temporary(test: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-qcu-restrictions-'))
  test.onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  return root
}

function launch(root: string, mode: string): Result {
  const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', timeout: 5000 })
  expect(python.status, python.stderr).toBe(0)
  const launch = resolveExampleLaunch({
    srcBin: join(repo, 'apps/cli/src/bin.ts'), libBin: driver, mode: 'lib', configArgs: [repo, root, mode, python.stdout.trim()],
    env: { HOME: root, DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, '.agents'),
      DSH_TELEMETRY_DISABLED: '1', DSH_QCU_DEDICATED: '1', DEEPSEEK_API_KEY: 'keyless-no-model-call',
      NODE_OPTIONS: undefined, NODE_PATH: undefined, TSX_TSCONFIG_PATH: undefined },
  })
  const child = spawnSync(launch.command, ['--expose-internals', '--no-experimental-strip-types', ...launch.args], {
    cwd: root, env: { PATH: process.env.PATH, ...launch.env }, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL',
  })
  expect(child.error, child.stderr).toBeUndefined()
  expect(child.signal, child.stderr).toBeNull()
  expect(child.status, child.stdout + child.stderr).toBe(0)
  const output = child.stdout.split('\n').find(line => line.startsWith('QCU_RESTRICTIONS_RESULT '))
  expect(output, child.stdout + child.stderr).toBeDefined()
  return JSON.parse(output!.slice('QCU_RESTRICTIONS_RESULT '.length)) as Result
}

function restricted(result: Result): void {
  expect(result.error).toBeUndefined()
  expect(result.beforeEntryCount).toBe(0)
  expect(result.modelRequests).toBe(0)
  const expected = qcuProfileRestrictions().map(({ id }) => id)
  for (const phase of result.phases) {
    expect(phase.rows.map(row => row.id), phase.phase).toEqual(expected)
    expect(phase.rows, phase.phase).toHaveLength(28)
    expect(phase.policy, phase.phase).toBe('ready')
    for (const row of phase.rows) {
      expect(row.present, `${phase.phase}: ${row.id}`).toBe(true)
      expect(row.disabled, `${phase.phase}: ${row.id}`).toBe(true)
      expect(row.state, `${phase.phase}: ${row.id}`).not.toBe(FiberState.ACTIVE)
      expect(phase.clientEntries, `${phase.phase}: ${row.id}`).not.toContain(row.name)
    }
    expect(phase.businessPackageBytesPresent, phase.phase).toBe(true)
  }
}

it('retains all 28 restrictions through business configuration removal, user overrides, failed reloads and restart', (test) => {
  const root = temporary(test)
  const result = launch(root, 'lifecycle')
  restricted(result)
  expect(result.phases.map(phase => phase.phase)).toEqual([
    'initial', 'business-configuration-removed', 'user-enablement-attempt-reconciled',
    'missing-target-reload-rejected', 'bad-patch-reload-rejected',
  ])
  expect(result.phases[0]!.businessState).toBe(FiberState.ACTIVE)
  expect(result.phases[0]!.selectedBundles).toContain('qcu-thesis-workbench')
  expect(result.phases[0]!.businessDependencyPresent).toBe(true)
  for (const phase of result.phases.slice(1)) {
    expect(phase.businessPresent, phase.phase).toBe(false)
    expect(phase.businessDependencyPresent, phase.phase).toBe(false)
    expect(phase.selectedBundles, phase.phase).not.toContain('qcu-thesis-workbench')
  }
  expect(result.phases[3]!.rejected).toContain('Launcher restriction target is missing')
  expect(result.phases[4]!.rejected).toContain('patch')
  const restarted = launch(root, 'restart')
  restricted(restarted)
  expect(restarted.phases[0]!.phase).toBe('restart-without-business')
  expect(restarted.phases[0]!.businessPresent).toBe(false)
  expect(restarted.phases[0]!.businessDependencyPresent).toBe(false)
  expect(restarted.phases[0]!.selectedBundles).toEqual(['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
})

it('rejects malformed profile patches before any standard-Web entry mounts', (test) => {
  const result = launch(temporary(test), 'bad-patch')
  expect(result.error).toContain('patch')
  expect(result.beforeEntryCount).toBeUndefined()
  expect(result.phases).toEqual([])
  expect(result.modelRequests).toBe(0)
})

it('rejects a missing fixed target before any standard-Web entry mounts', (test) => {
  const result = launch(temporary(test), 'missing-target')
  expect(result.error).toContain('Launcher restriction target is missing: absent-required-target')
  expect(result.beforeEntryCount).toBeUndefined()
  expect(result.phases).toEqual([])
  expect(result.modelRequests).toBe(0)
})
