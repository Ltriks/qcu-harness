/** Exact-wire and lifecycle tests for the actual fixed Host/Electron private transport. */
import { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QcuDesktopBinding, type QcuHostIpc } from '../src/host/desktop-binding.ts'
import type { QcuPrivateServiceBinding } from '../src/host/local-owner.ts'
import { parseQcuPrivateMessage, qcuPrivateOrigin } from '../src/host/private-wire.ts'
import { QcuHostBinding } from '../../upstream/apps/desktop/src/qcu-host-binding.ts'

const id = '11111111-1111-4111-8111-111111111111'
const generation = '22222222-2222-4222-8222-222222222222'
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }
class Owner implements QcuPrivateServiceBinding {
  live = true
  listeners = new Set<() => void | Promise<void>>()
  available() { return this.live }
  async acquireNativeTarget() { if (!this.live) throw new Error('closed'); return { origin: 'http://127.0.0.1:34567' } }
  onRevoked(listener: () => void | Promise<void>) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  stop() { this.live = false; return Promise.all([...this.listeners].map(listener => listener())).then(() => undefined) }
}
class Ipc extends EventEmitter implements QcuHostIpc {
  connected = true
  sent: unknown[] = []
  send(message: object, callback: (error: Error | null) => void) { this.sent.push(message); callback(null); return true }
}
function shell(teardown: () => Promise<void> = async () => undefined, timeout = 5000) {
  const child = new ChildProcess()
  Object.defineProperty(child, 'connected', { value: true, writable: true })
  const sent: unknown[] = []
  Object.defineProperty(child, 'send', { value: (message: object, callback: (error: Error | null) => void) => { sent.push(message); callback(null); return true } })
  const binding = new QcuHostBinding(teardown, timeout)
  binding.attach(child)
  return { binding, child, sent }
}
async function hello(h: ReturnType<typeof shell>, ownerId = id) {
  h.binding.handleMessage(h.child, { type: 'qcu:hello', protocolVersion: 1, ownerId })
  await Promise.resolve()
  const bind = parseQcuPrivateMessage(h.sent.at(-1))
  if (bind?.type !== 'qcu:bind') throw new Error('No private bind')
  return bind
}
async function ready(h: ReturnType<typeof shell>) {
  const bind = await hello(h)
  h.binding.handleMessage(h.child, { ...bind, type: 'qcu:ready', origin: 'http://127.0.0.1:34567/' })
  expect(h.binding.available()).toBe(false)
  h.binding.handleMessage(h.child, { ...bind, type: 'qcu:granted' })
  return bind
}
afterEach(() => { vi.useRealTimers() })

describe('fixed exact private wire', () => {
  it('accepts only exact 127.0.0.1 HTTP origins and bounded ports', () => {
    expect(qcuPrivateOrigin('http://127.0.0.1:80/')).toBe('http://127.0.0.1')
    expect(qcuPrivateOrigin('http://127.0.0.1:65535')).toBe('http://127.0.0.1:65535')
    for (const value of ['http://localhost:9', 'http://[::1]:9', 'https://127.0.0.1:9', 'http://127.1:9', 'http://127.0.0.1:0', 'http://127.0.0.1:65536', 'http://127.0.0.1:0009', 'http://user@127.0.0.1:9', 'http://127.0.0.1:9/task', 'http://127.0.0.1:9?x', 'http://127.0.0.1:9#x']) expect(qcuPrivateOrigin(value)).toBeUndefined()
  })
  it('rejects extra fields, versions, IDs, operations and private credential payloads', () => {
    const valid = { type: 'qcu:ready', protocolVersion: 1, ownerId: id, generation, requestId: 1, origin: 'http://127.0.0.1:99' }
    expect(parseQcuPrivateMessage(valid)).toEqual(valid)
    for (const patch of [{ protocolVersion: 2 }, { ownerId: '../path' }, { generation: 'old' }, { requestId: 0 }, { requestId: 0.5 }, { requestId: Number.MAX_SAFE_INTEGER + 1 }, { type: 'qcu:execute' }, { token: 'secret' }, { command: 'run' }, { filename: 'paper.docx' }, { origin: 'http://127.0.0.1:99/task' }]) expect(parseQcuPrivateMessage({ ...valid, ...patch })).toBeUndefined()
  })
})

describe('Electron main exact-child binding', () => {
  it('stays inert without a bundle and admits only after the grant acknowledgment', async () => {
    const h = shell()
    expect(h.sent).toEqual([])
    expect(h.binding.handleMessage(h.child, { type: 'ready', url: 'ordinary-host' })).toBe(false)
    await expect(h.binding.acquireNativeTarget()).rejects.toThrow('unavailable')
    await ready(h)
    expect(h.binding.available()).toBe(true)
    expect(await h.binding.acquireNativeTarget()).toEqual({ origin: 'http://127.0.0.1:34567' })
    await h.binding.disconnected(h.child)
  })
  it('preserves explicit default port for the native panel origin validator', async () => {
    const h = shell()
    const bind = await hello(h)
    h.binding.handleMessage(h.child, { ...bind, type: 'qcu:ready', origin: 'http://127.0.0.1:80/' })
    h.binding.handleMessage(h.child, { ...bind, type: 'qcu:granted' })
    expect(await h.binding.acquireNativeTarget()).toEqual({ origin: 'http://127.0.0.1:80' })
    await h.binding.disconnected(h.child)
  })
  it('requires exact generation, owner, request ID, and emitter before admission', async () => {
    const h = shell()
    const bind = await hello(h)
    for (const patch of [{ ownerId: generation }, { generation: id }]) {
      h.binding.handleMessage(h.child, { ...bind, ...patch, type: 'qcu:ready', origin: 'http://127.0.0.1:9' })
      expect(h.binding.available()).toBe(false)
    }
    h.binding.handleMessage(new ChildProcess(), { ...bind, type: 'qcu:ready', origin: 'http://127.0.0.1:9' })
    expect(h.sent).toHaveLength(1)
    h.binding.handleMessage(h.child, { ...bind, requestId: 42, type: 'qcu:ready', origin: 'http://127.0.0.1:9' })
    expect(h.binding.available()).toBe(false)
    await expect(h.binding.disconnected(h.child)).rejects.toThrow('teardown')
  })
  it('revokes synchronously and acknowledges Host revoke only after teardown', async () => {
    const done = deferred()
    let closed = false
    const h = shell(() => { closed = true; return done.promise })
    const bind = await ready(h)
    h.binding.handleMessage(h.child, { ...bind, type: 'qcu:revoke', requestId: bind.requestId + 1 })
    expect(closed).toBe(true)
    expect(h.binding.available()).toBe(false)
    expect(h.sent.some(value => parseQcuPrivateMessage(value)?.type === 'qcu:revoked')).toBe(false)
    done.resolve()
    await vi.waitUntil(() => h.sent.some(value => parseQcuPrivateMessage(value)?.type === 'qcu:revoked'))
    expect(h.sent.at(-1)).toMatchObject({ type: 'qcu:revoked', ok: true })
  })
  it('joins repeated shell revoke and waits for exact unbind acknowledgment', async () => {
    const h = shell()
    const bind = await ready(h)
    const first = h.binding.revoke(h.child)
    expect(h.binding.available()).toBe(false)
    expect(h.binding.revoke(h.child)).toBe(first)
    await vi.waitUntil(() => h.sent.some(value => parseQcuPrivateMessage(value)?.type === 'qcu:unbind'))
    const unbind = parseQcuPrivateMessage(h.sent.at(-1))
    if (unbind?.type !== 'qcu:unbind') throw new Error('No unbind')
    h.binding.handleMessage(h.child, { ...bind, type: 'qcu:granted' })
    h.binding.handleMessage(h.child, { ...unbind, type: 'qcu:unbound' })
    await first
  })
  it('replaces the child immediately but does not grant until previous cleanup finishes', async () => {
    const done = deferred()
    const h = shell(() => done.promise)
    const old = await ready(h)
    const next = shell()
    h.binding.attach(next.child)
    expect(h.binding.available()).toBe(false)
    await h.binding.revoke(h.child)
    h.binding.handleMessage(next.child, { type: 'qcu:hello', protocolVersion: 1, ownerId: generation })
    h.binding.handleMessage(h.child, { ...old, type: 'qcu:granted' })
    await Promise.resolve()
    expect(next.sent).toEqual([])
    done.resolve()
    await vi.waitUntil(() => next.sent.length === 1)
    const bind = parseQcuPrivateMessage(next.sent[0])
    expect(bind).toMatchObject({ type: 'qcu:bind', ownerId: generation })
    expect(bind && 'generation' in bind ? bind.generation : undefined).not.toBe(old.generation)
    await h.binding.disconnected(next.child)
  })
  it('closes forever on cleanup failure even after attaching a replacement child', async () => {
    const h = shell(async () => { throw new Error('private path must never escape') })
    await ready(h)
    await expect(h.binding.revoke(h.child)).rejects.toThrow('QCU native teardown did not complete.')
    const next = shell()
    h.binding.attach(next.child)
    h.binding.handleMessage(next.child, { type: 'qcu:hello', protocolVersion: 1, ownerId: generation })
    await Promise.resolve()
    expect(next.sent).toEqual([])
    expect(h.binding.available()).toBe(false)
  })
  it('bounds missing acknowledgments and hanging native cleanup', async () => {
    vi.useFakeTimers()
    const h = shell(() => new Promise(() => undefined), 10)
    await ready(h)
    const result = h.binding.revoke(h.child)
    const failure = expect(result).rejects.toThrow('teardown')
    await vi.advanceTimersByTimeAsync(11)
    await failure
    expect(h.binding.available()).toBe(false)
  })
  it('revokes on child death and suppresses all later readiness', async () => {
    const closed = vi.fn(async () => undefined)
    const h = shell(closed)
    const bind = await ready(h)
    const disconnected = h.binding.disconnected(h.child)
    expect(h.binding.available()).toBe(false)
    expect(closed).toHaveBeenCalledOnce()
    h.binding.handleMessage(h.child, { ...bind, type: 'qcu:granted' })
    await disconnected
    expect(h.binding.available()).toBe(false)
  })
  it('closes on malformed QCU messages without forwarding their contents', async () => {
    const h = shell()
    await ready(h)
    h.binding.handleMessage(h.child, { type: 'qcu:ready', token: 'sensitive' })
    expect(h.binding.available()).toBe(false)
    expect(JSON.stringify(h.sent)).not.toContain('sensitive')
    await expect(h.binding.disconnected(h.child)).rejects.toThrow('teardown')
  })
})

describe('effect-owned Host publisher', () => {
  it('installs no process listener or target transfer when there is no inherited IPC', () => {
    const ipc = new Ipc()
    ipc.connected = false
    const binding = new QcuDesktopBinding(new Owner(), ipc, 5000, true)
    binding.serviceReady()
    expect(ipc.listenerCount('message')).toBe(0)
    expect(ipc.sent).toEqual([])
    binding.dispose()
  })
  it('does not emit unknown messages to an unpatched desktop with an existing IPC channel', () => {
    const ipc = new Ipc()
    const binding = new QcuDesktopBinding(new Owner(), ipc, 5000, false)
    binding.serviceReady()
    expect(ipc.listenerCount('message')).toBe(0)
    expect(ipc.sent).toEqual([])
    binding.dispose()
  })
  it('emits hello only after service ready and never sends target before shell initiation', async () => {
    const owner = new Owner()
    const ipc = new Ipc()
    const binding = new QcuDesktopBinding(owner, ipc, 5000, true)
    expect(ipc.sent).toEqual([])
    binding.serviceReady()
    const hello = parseQcuPrivateMessage(ipc.sent[0])
    if (hello?.type !== 'qcu:hello') throw new Error('No hello')
    expect(Object.keys(hello).sort()).toEqual(['ownerId', 'protocolVersion', 'type'])
    ipc.emit('message', { type: 'qcu:bind', protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 })
    await Promise.resolve()
    expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:ready', origin: 'http://127.0.0.1:34567' })
    ipc.emit('message', { type: 'qcu:grant', protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 })
    expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:granted' })
    let stopped = false
    const stop = owner.stop().then(() => { stopped = true })
    expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:revoke', requestId: 2 })
    await Promise.resolve()
    expect(stopped).toBe(false)
    ipc.emit('message', { type: 'qcu:revoked', protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 2, ok: true })
    await stop
    binding.dispose()
    expect(ipc.listenerCount('message')).toBe(0)
  })
  it('suppresses a queued grant after Host stop without rejecting successful native cleanup', async () => {
    const owner = new Owner()
    const ipc = new Ipc()
    const binding = new QcuDesktopBinding(owner, ipc, 5000, true)
    binding.serviceReady()
    const hello = parseQcuPrivateMessage(ipc.sent[0])
    if (hello?.type !== 'qcu:hello') throw new Error('No hello')
    const request = { protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 }
    ipc.emit('message', { ...request, type: 'qcu:bind' })
    await Promise.resolve()
    expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:ready' })
    const stopping = owner.stop()
    ipc.emit('message', { ...request, type: 'qcu:grant' })
    ipc.emit('message', { ...request, type: 'qcu:revoked', requestId: 2, ok: true })
    await stopping
    ipc.emit('message', { ...request, type: 'qcu:grant' })
    expect(ipc.sent.some(value => parseQcuPrivateMessage(value)?.type === 'qcu:granted')).toBe(false)
    binding.dispose()
  })
  it('rejects an unbind with a stale correlation ID and accepts the exact teardown completion', async () => {
    const owner = new Owner()
    const ipc = new Ipc()
    const binding = new QcuDesktopBinding(owner, ipc, 5000, true)
    binding.serviceReady()
    const hello = parseQcuPrivateMessage(ipc.sent[0])
    if (hello?.type !== 'qcu:hello') throw new Error('No hello')
    const request = { protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 }
    ipc.emit('message', { ...request, type: 'qcu:bind' })
    await Promise.resolve()
    ipc.emit('message', { ...request, type: 'qcu:grant' })
    ipc.emit('message', { ...request, type: 'qcu:unbind', requestId: 3 })
    expect(ipc.sent.some(value => parseQcuPrivateMessage(value)?.type === 'qcu:unbound')).toBe(false)
    const stopping = owner.stop()
    ipc.emit('message', { ...request, type: 'qcu:unbind', requestId: 2 })
    await stopping
    expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:unbound', requestId: 2 })
    binding.dispose()
  })
  it('handles simultaneous Host revoke and shell unbind in either acknowledgment order', async () => {
    for (const order of ['revoked-first', 'unbind-first']) {
      const owner = new Owner()
      const ipc = new Ipc()
      const binding = new QcuDesktopBinding(owner, ipc, 5000, true)
      binding.serviceReady()
      const hello = parseQcuPrivateMessage(ipc.sent[0])
      if (hello?.type !== 'qcu:hello') throw new Error('No hello')
      const request = { protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 }
      ipc.emit('message', { ...request, type: 'qcu:bind' })
      await Promise.resolve()
      ipc.emit('message', { ...request, type: 'qcu:grant' })
      const stopping = owner.stop()
      const revoked = { ...request, type: 'qcu:revoked', requestId: 2, ok: true }
      const unbind = { ...request, type: 'qcu:unbind', requestId: 2 }
      for (const message of order === 'revoked-first' ? [revoked, unbind] : [unbind, revoked]) ipc.emit('message', message)
      await stopping
      expect(ipc.sent.at(-1)).toMatchObject({ type: 'qcu:unbound' })
      binding.dispose()
    }
  })
  it('rejects missing/negative native teardown acknowledgment with a fixed error', async () => {
    for (const response of ['negative', 'timeout'] as const) {
      vi.useFakeTimers()
      const owner = new Owner()
      const ipc = new Ipc()
      const binding = new QcuDesktopBinding(owner, ipc, 10, true)
      binding.serviceReady()
      const hello = parseQcuPrivateMessage(ipc.sent[0])
      if (hello?.type !== 'qcu:hello') throw new Error('No hello')
      const request = { protocolVersion: 1, ownerId: hello.ownerId, generation, requestId: 1 }
      ipc.emit('message', { ...request, type: 'qcu:bind' })
      await Promise.resolve()
      ipc.emit('message', { ...request, type: 'qcu:grant' })
      const failure = expect(owner.stop()).rejects.toThrow('QCU native')
      if (response === 'negative') ipc.emit('message', { ...request, type: 'qcu:revoked', requestId: 2, ok: false })
      else await vi.advanceTimersByTimeAsync(11)
      await failure
      binding.dispose()
    }
  })
})
