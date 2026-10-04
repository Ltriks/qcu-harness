/** Real Node parent/child IPC exercises the shipped transport with a synthetic service owner. */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { QcuHostBinding } from '../../upstream/apps/desktop/src/qcu-host-binding.ts'

async function fixture(teardown: () => Promise<void>) {
  const child = spawn(process.execPath, ['--import', 'tsx/esm', fileURLToPath(new URL('./fixtures/private-ipc-child.ts', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), env: { DSH_QCU_PRIVATE_IPC: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  const binding = new QcuHostBinding(teardown, 1000)
  binding.attach(child)
  const events: string[] = []
  const errors: string[] = []
  let stderr = ''
  child.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })
  child.on('message', value => {
    if (binding.handleMessage(child, value)) return
    if (typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string') events.push(value.type)
  })
  child.on('error', () => { errors.push('child error'); void binding.disconnected(child).catch(() => undefined) })
  child.on('disconnect', () => { void binding.disconnected(child).catch(() => undefined) })
  const closed = new Promise<void>(resolve => { child.once('close', () => { void binding.disconnected(child).catch(() => undefined); resolve() }) })
  await vi.waitUntil(() => events.includes('fixture:installed') || errors.length > 0 || child.exitCode !== null)
  expect(errors).toEqual([])
  expect(stderr).toBe('')
  expect(events).toContain('fixture:installed')
  return { child, binding, events, closed }
}

it('holds real Host stop until the main-side native teardown acknowledgment arrives', async () => {
  let finish!: () => void
  let revoked = false
  const cleanup = new Promise<void>(resolve => { finish = resolve })
  const f = await fixture(() => { revoked = true; return cleanup })
  try {
    expect(f.binding.available()).toBe(false)
    f.child.send({ type: 'fixture:start' })
    await vi.waitUntil(() => f.binding.available())
    expect(await f.binding.acquireNativeTarget()).toEqual({ origin: 'http://127.0.0.1:34567' })
    f.child.send({ type: 'fixture:stop' })
    await vi.waitUntil(() => revoked)
    expect(f.binding.available()).toBe(false)
    expect(f.events).not.toContain('fixture:stopped')
    finish()
    await f.closed
    expect(f.events).toContain('fixture:stopped')
    expect(f.events).not.toContain('fixture:failed')
  } finally { finish(); f.child.kill('SIGKILL'); await f.closed }
})

it('unbinds over real IPC before shell shutdown and retires unexpected child death', async () => {
  let revocations = 0
  const f = await fixture(async () => { revocations++ })
  try {
    f.child.send({ type: 'fixture:start' })
    await vi.waitUntil(() => f.binding.available())
    await f.binding.revoke(f.child)
    expect(revocations).toBe(1)
    expect(f.binding.available()).toBe(false)
    f.child.send({ type: 'fixture:stop' })
    await f.closed
    expect(f.events).toContain('fixture:stopped')
  } finally { f.child.kill('SIGKILL'); await f.closed }
  const dead = await fixture(async () => { revocations++ })
  try {
    dead.child.send({ type: 'fixture:start' })
    await vi.waitUntil(() => dead.binding.available())
    dead.child.kill('SIGKILL')
    await dead.closed
    expect(dead.binding.available()).toBe(false)
    expect(revocations).toBe(2)
    await expect(dead.binding.acquireNativeTarget()).rejects.toThrow('unavailable')
  } finally { dead.child.kill('SIGKILL'); await dead.closed }
})

it('does not treat a real native cleanup rejection as a completed Host stop', async () => {
  const f = await fixture(async () => { throw new Error('synthetic native cleanup failure') })
  try {
    f.child.send({ type: 'fixture:start' })
    await vi.waitUntil(() => f.binding.available())
    f.child.send({ type: 'fixture:stop' })
    await f.closed
    expect(f.events).toContain('fixture:failed')
    expect(f.events).not.toContain('fixture:stopped')
    expect(f.binding.available()).toBe(false)
  } finally { f.child.kill('SIGKILL'); await f.closed }
})
