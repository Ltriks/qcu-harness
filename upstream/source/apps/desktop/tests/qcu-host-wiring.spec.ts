import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { afterEach, expect, it, vi } from 'vitest'
import { DesktopHostProcess } from '../src/host-process.ts'
import type { QcuHostBinding } from '../src/qcu-host-binding.ts'

const roots: string[] = []
const hosts: DesktopHostProcess[] = []
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stop().catch(() => undefined)))
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(binding?: QcuHostBinding, environment = process.env, dedicated = false): { root: string; host: DesktopHostProcess } {
  const root = mkdtempSync(join(tmpdir(), 'qcu-host-wiring-'))
  roots.push(root)
  const entry = join(root, 'node_modules/@deepseek-ai/dsh-desktop-host/lib')
  mkdirSync(entry, { recursive: true })
  writeFileSync(join(entry, '../package.json'), '{"type":"module"}')
  writeFileSync(join(entry, 'index.js'), `
    import { writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    writeFileSync(join(process.cwd(),'private-marker'),process.env.DSH_QCU_PRIVATE_IPC ?? 'absent');
    writeFileSync(join(process.cwd(),'dedicated-marker'),process.env.DSH_QCU_DEDICATED ?? 'absent');
    if (process.env.DSH_QCU_PRIVATE_IPC === '1') process.send({type:'qcu:test-only'});
    process.send({type:'ready',url:'http://127.0.0.1:1234'});
    process.on('message', message => {
      if (message.type === 'shutdown') {
        writeFileSync(join(process.cwd(),'shutdown-seen'),'yes');
        process.send({type:'shutdown-complete'},()=>process.disconnect());
      }
    });
  `)
  const host = new DesktopHostProcess(process.execPath, root, root, undefined, environment,
    undefined, undefined, undefined, undefined, binding, dedicated)
  hosts.push(host)
  return { root, host }
}

function bindingStub() {
  const attach = vi.fn<(child: ChildProcess) => void>()
  const handleMessage = vi.fn((_child: ChildProcess, message: unknown) =>
    (message as { type?: string }).type === 'qcu:test-only')
  const revoke = vi.fn<(_: ChildProcess) => Promise<void>>().mockResolvedValue(undefined)
  const disconnected = vi.fn<(_: ChildProcess) => Promise<void>>().mockResolvedValue(undefined)
  return { attach, handleMessage, revoke, disconnected }
}

it('routes only fixed private messages before ordinary Host event validation', async () => {
  const binding = bindingStub()
  const { host, root } = fixture(binding as unknown as QcuHostBinding)
  await expect(host.start()).resolves.toEqual({ url: 'http://127.0.0.1:1234', injections: undefined })
  expect(readFileSync(join(root, 'private-marker'), 'utf8')).toBe('1')
  const child = binding.attach.mock.calls[0]?.[0]
  expect(child).toBeDefined()
  expect(binding.handleMessage.mock.calls.every(([source]) => source === child)).toBe(true)
  await host.stop(true)
  expect(binding.revoke).toHaveBeenCalledWith(child)
  expect(binding.disconnected).toHaveBeenCalledWith(child)
})

it('awaits native cleanup before sending shutdown to its exact child', async () => {
  const binding = bindingStub()
  let finish!: () => void
  binding.revoke.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const { host, root } = fixture(binding as unknown as QcuHostBinding)
  await host.start()
  const stopping = host.stop(true)
  expect(binding.revoke).toHaveBeenCalledTimes(1)
  expect(existsSync(join(root, 'shutdown-seen'))).toBe(false)
  finish()
  await stopping
  expect(existsSync(join(root, 'shutdown-seen'))).toBe(true)
})

it('still shuts down the child and reports failure when native cleanup fails', async () => {
  const binding = bindingStub()
  binding.revoke.mockRejectedValue(new Error('sensitive synthetic detail'))
  const { host, root } = fixture(binding as unknown as QcuHostBinding)
  await host.start()
  await expect(host.stop(true)).rejects.toThrow('QCU private view teardown did not complete.')
  expect(existsSync(join(root, 'shutdown-seen'))).toBe(true)
})


it('strips an inherited capability marker when the shell has no QCU binding', async () => {
  const { host, root } = fixture(undefined, { ...process.env, DSH_QCU_PRIVATE_IPC: '1' })
  await host.start()
  expect(readFileSync(join(root, 'private-marker'), 'utf8')).toBe('absent')
  await host.stop(true)
})


it('takes dedicated policy mode only from the explicit immutable launch choice', async () => {
  const { host, root } = fixture(undefined, { ...process.env, DSH_QCU_DEDICATED: '1' })
  await host.start()
  expect(readFileSync(join(root, 'dedicated-marker'), 'utf8')).toBe('absent')
  await host.stop(true)
  const protectedHost = fixture(undefined, { ...process.env, DSH_QCU_DEDICATED: 'bad' }, true)
  await protectedHost.host.start()
  expect(readFileSync(join(protectedHost.root, 'dedicated-marker'), 'utf8')).toBe('1')
  await protectedHost.host.stop(true)
})
