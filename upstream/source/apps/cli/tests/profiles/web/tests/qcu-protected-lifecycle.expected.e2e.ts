/** Built runProfile and real Loader/HMR proof for launch-owned QCU restrictions. */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'
import { expect, it, type TestContext } from 'vitest'

const repo = resolve(import.meta.dirname, '../../../../../..')
const driver = fileURLToPath(new URL('./fixtures/qcu-protected-profile-driver.mjs', import.meta.url))
const denied = 'QCU dedicated thesis profile permits only local thesis tools.'
const unavailable = 'QCU launch policy is unavailable; this Host is closed.'

interface Result {
  mode: string
  error?: string
  beforeEntryCount?: number
  entries: string[]
  bodies: string[]
  cleanup?: string[]
  initial?: unknown[]
  retained?: unknown[]
  businessPresent?: boolean
  phases?: Array<{
    phase: string
    policy?: string
    ordinary: unknown
    nearMiss: unknown
    allowed: unknown[]
    attachments: Array<{ status: number }>
    health: { status: number }
    agent: { kind: string }
    modelError?: string
    calls: string[]
    captures: number
    httpDelegations: number
    agentDelegations: number
    modelDelegations: number
    reloads?: number
    generation?: number
  }>
}

function temporary(test: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-qcu-protected-'))
  test.onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  return root
}

function launch(root: string, mode: string, dedicated = true) {
  const command = resolveExampleLaunch({
    srcBin: join(repo, 'apps/cli/src/bin.ts'), libBin: driver, mode: 'lib', configArgs: [repo, root, mode],
    env: { HOME: root, DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, '.agents'),
      DSH_TELEMETRY_DISABLED: '1', DSH_QCU_DEDICATED: dedicated ? '1' : undefined,
      NODE_OPTIONS: undefined, NODE_PATH: undefined, TSX_TSCONFIG_PATH: undefined },
  })
  const processResult = spawnSync(command.command, ['--expose-internals', '--no-experimental-strip-types', ...command.args], {
    cwd: root, env: { PATH: process.env.PATH, ...command.env }, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  })
  expect(processResult.error, processResult.stderr).toBeUndefined()
  expect(processResult.signal, processResult.stderr).toBeNull()
  const output = processResult.stdout.split('\n').find(line => line.startsWith('QCU_PROTECTED_RESULT '))
  return { processResult, result: output === undefined ? undefined : JSON.parse(output.slice('QCU_PROTECTED_RESULT '.length)) as Result }
}

function success(root: string, mode: string, dedicated = true): Result {
  const { processResult, result } = launch(root, mode, dedicated)
  expect(processResult.status, processResult.stdout + processResult.stderr).toBe(0)
  expect(result, processResult.stderr).toBeDefined()
  expect(result!.error, processResult.stderr).toBeUndefined()
  return result!
}

function protectedPhases(result: Result): void {
  expect(result.beforeEntryCount).toBe(0)
  for (const phase of result.phases!) {
    const closed = phase.policy !== 'ready'
    expect(JSON.stringify(phase.ordinary), phase.phase).toContain(closed ? unavailable : denied)
    expect(JSON.stringify(phase.nearMiss), phase.phase).toContain(closed ? unavailable : denied)
    expect(phase.attachments.map(reply => reply.status), phase.phase).toEqual(Array(4).fill(closed ? 503 : 403))
    expect(phase.health.status, phase.phase).toBe(closed ? 503 : 200)
    expect(phase.agent, phase.phase).toEqual({ kind: 'reject' })
    expect(phase.agentDelegations, phase.phase).toBe(0)
    expect(phase.modelDelegations, phase.phase).toBe(0)
    expect(phase.modelError, phase.phase).toContain(closed ? unavailable : 'accepts text commands only')
    expect(phase.calls.every(name => name === 'qcu_thesis_open' || name === 'qcu_thesis_check'), phase.phase).toBe(true)
    for (const allowed of phase.allowed) expect(JSON.stringify(allowed), phase.phase).toContain(closed ? unavailable : 'synthetic-executed')
  }
  expect(result.bodies.every(name => name === 'qcu_thesis_open' || name === 'qcu_thesis_check')).toBe(true)
  for (const initial of result.initial!) expect(JSON.stringify(initial)).toContain(denied)
}

it('keeps launch policy through actual Loader disable/remove, failed cleanup, Tools replacement and process restart', (test) => {
  const root = temporary(test)
  const result = success(root, 'lifecycle')
  protectedPhases(result)
  expect(result.cleanup).toEqual(['failed', 'failed'])
  expect(result.phases!.map(phase => phase.phase)).toEqual([
    'initial', 'business-disabled-after-failed-cleanup', 'business-removed-after-failed-cleanup',
    'official-tools-restarted', 'official-tools-absent', 'official-tools-reenabled', 'official-tools-replaced', 'root-disposed',
  ])
  expect(result.initial).toHaveLength(4)
  expect(result.retained).toHaveLength(4)
  for (const retained of result.retained!) expect(JSON.stringify(retained)).toContain(unavailable)

  const restarted = success(root, 'restart-empty')
  protectedPhases(restarted)
  expect(restarted.businessPresent).toBe(false)
  expect(restarted.initial).toHaveLength(1)
  expect(restarted.phases![0]!.policy).toBe('ready')
})

it('protects the first injected execution after watched production HMR replaces the Tools class provider', (test) => {
  const result = success(temporary(test), 'hmr')
  protectedPhases(result)
  expect(result.initial).toHaveLength(2)
  expect(result.cleanup).toEqual(['failed'])
  const replacement = result.phases!.find(phase => phase.phase === 'watched-tools-module-replaced')!
  expect(replacement.reloads).toBe(1)
  expect(replacement.generation).toBe(2)
  expect(replacement.captures).toBe(2)
  for (const retained of result.retained!) expect(JSON.stringify(retained)).toContain(unavailable)
})

for (const mode of ['invalid-policy', 'missing-policy']) it(`rejects ${mode} in official preparation before any profile entry applies`, (test) => {
  const { processResult, result } = launch(temporary(test), mode)
  expect(processResult.status, processResult.stderr).toBe(0)
  expect(result?.error).toContain('host preparation failed')
  expect(result?.error).toContain('requires exactly policy { version: 1 }')
  expect(result?.beforeEntryCount).toBe(0)
  expect(result?.entries).toEqual([])
  expect(result?.bodies).toEqual([])
})

for (const mode of ['fatal-initial', 'fatal-rebind']) it(`synchronously terminates ${mode} before queued consumer work can run`, (test) => {
  const root = temporary(test)
  const { processResult, result } = launch(root, mode)
  expect(processResult.status, processResult.stderr).toBe(1)
  expect(processResult.stderr).toContain('could not bind the official tools service; terminating Host')
  expect(result).toBeUndefined()
  expect(existsSync(join(root, 'queued.txt'))).toBe(false)
  const calls = existsSync(join(root, 'tool-bodies.txt')) ? readFileSync(join(root, 'tool-bodies.txt'), 'utf8') : ''
  expect(calls).not.toContain('ordinary_tool')
  expect(calls).not.toContain('qcu_thesis_open_extra')
})

it('keeps ordinary profiles unprotected as an independent negative control', (test) => {
  const result = success(temporary(test), 'ordinary', false)
  expect(result.beforeEntryCount).toBeUndefined()
  expect(JSON.stringify(result.initial)).toContain('synthetic-executed')
  expect(result.phases![0]!.attachments.map(reply => reply.status)).toEqual([200, 200, 200, 200])
  expect(result.phases![0]!.agentDelegations).toBe(1)
  expect(result.phases![0]!.modelDelegations).toBe(1)
  expect(result.bodies).toContain('ordinary_tool')
  expect(result.bodies).toContain('qcu_thesis_open_extra')
})
