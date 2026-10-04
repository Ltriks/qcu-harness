/** Real profile, package, Python child and inherited IPC with failed native cleanup. */
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'
import { expect, it } from 'vitest'

const repo = resolve(import.meta.dirname, '../../../../../..')
const driver = fileURLToPath(new URL('./fixtures/qcu-protected-profile-driver.mjs', import.meta.url))

interface NativeResult {
  error?: string
  beforeEntryCount: number
  nativeEvidence: {
    elapsedMs: number
    serviceClosed: boolean
    bridgeRemoved: boolean
    listenersRemoved: number
    localToolsRemoved: boolean
  }
  bodies: string[]
  phases: Array<{
    phase: string
    policy: string
    ordinary: unknown
    nearMiss: unknown
    attachments: Array<{ status: number }>
    agentDelegations: number
    modelDelegations: number
  }>
}

for (const acknowledgment of ['negative', 'missing']) it(`retains launch restrictions after actual QCU unload with ${acknowledgment} native acknowledgment`, async (test) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-qcu-protected-native-'))
  test.onTestFinished(() => rm(root, { recursive: true, force: true }))
  const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', timeout: 5000 })
  expect(python.status, python.stderr).toBe(0)
  const launch = resolveExampleLaunch({
    srcBin: join(repo, 'apps/cli/src/bin.ts'), libBin: driver, mode: 'lib',
    configArgs: [repo, root, 'native-' + acknowledgment, python.stdout.trim()],
    env: { HOME: root, DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, '.agents'),
      DSH_TELEMETRY_DISABLED: '1', DSH_QCU_DEDICATED: '1', DSH_QCU_PRIVATE_IPC: '1',
      NODE_OPTIONS: undefined, NODE_PATH: undefined, TSX_TSCONFIG_PATH: undefined },
  })
  const child = spawn(launch.command, ['--expose-internals', '--no-experimental-strip-types', ...launch.args], {
    cwd: root, env: { PATH: process.env.PATH, ...launch.env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout!.setEncoding('utf8').on('data', (value: string) => { stdout += value })
  child.stderr!.setEncoding('utf8').on('data', (value: string) => { stderr += value })
  const completion = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>()
  let closed = false
  let timedOut = false
  let force: NodeJS.Timeout | undefined
  const errors: Error[] = []
  child.once('error', (error) => { errors.push(error) })
  child.once('close', (code, signal) => { closed = true; completion.resolve({ code, signal }) })
  const stop = (): void => {
    if (closed) return
    child.kill('SIGTERM')
    force ??= setTimeout(() => { if (!closed) child.kill('SIGKILL') }, 6000)
  }
  const timeout = setTimeout(() => { timedOut = true; stop() }, 20_000)
  test.signal.addEventListener('abort', stop, { once: true })
  const generation = randomUUID()
  let ownerId: string | undefined
  let origin: string | undefined
  const messages: string[] = []
  const send = (value: object): void => {
    child.send(value, (error) => { if (error !== null) errors.push(error) })
  }
  child.on('message', (value: unknown) => {
    if (typeof value !== 'object' || value === null || !('type' in value)) return
    const message = value as Record<string, unknown>
    if (typeof message.type !== 'string' || !message.type.startsWith('qcu:')) return
    messages.push(message.type)
    if (message.type === 'qcu:hello') {
      ownerId = String(message.ownerId)
      send({ ...message, type: 'qcu:bind', generation, requestId: 1 })
    } else if (message.ownerId === ownerId && message.generation === generation) {
      if (message.type === 'qcu:ready') {
        origin = String(message.origin)
        send({ type: 'qcu:grant', protocolVersion: 1, ownerId, generation, requestId: 1 })
      } else if (message.type === 'qcu:granted') {
        send({ type: 'fixture:native-granted', origin })
      } else if (message.type === 'qcu:revoke' && acknowledgment === 'negative') {
        send({ ...message, type: 'qcu:revoked', ok: false })
      }
    }
  })
  try {
    const result = await completion.promise
    expect(timedOut, stderr).toBe(false)
    expect(errors, stderr).toEqual([])
    expect(result.signal, stderr).toBeNull()
    expect(result.code, stdout + stderr).toBe(0)
    expect(messages).toEqual(['qcu:hello', 'qcu:ready', 'qcu:granted', 'qcu:revoke'])
    const line = stdout.split('\n').find(value => value.startsWith('QCU_PROTECTED_RESULT '))
    expect(line, stderr).toBeDefined()
    const evidence = JSON.parse(line!.slice('QCU_PROTECTED_RESULT '.length)) as NativeResult
    expect(evidence.error, stderr).toBeUndefined()
    expect(evidence.beforeEntryCount).toBe(0)
    expect(evidence.nativeEvidence).toMatchObject({
      serviceClosed: true, bridgeRemoved: true, listenersRemoved: 1, localToolsRemoved: true,
    })
    // This is the production timeout, not an injected short binding deadline.
    if (acknowledgment === 'missing') expect(evidence.nativeEvidence.elapsedMs).toBeGreaterThanOrEqual(4900)
    expect(evidence.phases.map(phase => phase.phase)).toEqual(['initial', 'native-business-removed', 'root-disposed'])
    for (const phase of evidence.phases) {
      const closed = phase.phase === 'root-disposed'
      expect(phase.policy).toBe(closed ? 'closed' : 'ready')
      expect(JSON.stringify(phase.ordinary)).toContain(closed ? 'Host is closed' : 'permits only local thesis tools')
      expect(JSON.stringify(phase.nearMiss)).toContain(closed ? 'Host is closed' : 'permits only local thesis tools')
      expect(phase.attachments.map(response => response.status)).toEqual(Array(4).fill(closed ? 503 : 403))
      expect(phase.agentDelegations).toBe(0)
      expect(phase.modelDelegations).toBe(0)
    }
    expect(evidence.bodies).toEqual([])
  } finally {
    stop()
    await completion.promise
    clearTimeout(timeout)
    clearTimeout(force)
    test.signal.removeEventListener('abort', stop)
    await rm(root, { recursive: true, force: true })
  }
})
