/** Actual Cordis unload behavior when the private native peer rejects or misses teardown acknowledgment. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { QcuHostIpc } from '../src/host/desktop-binding.ts'
import type { QcuPrivateServiceBinding } from '../src/host/local-owner.ts'
import { parseQcuPrivateMessage } from '../src/host/private-wire.ts'
import * as QcuHost from '../src/index.ts'
import { installQcuLaunchPolicy } from '../../upstream/apps/desktop-host/lib/types/qcu-policy.js'

const transport = vi.hoisted(() => ({ ipc: undefined as QcuHostIpc | undefined }))
vi.mock('../src/host/desktop-binding.ts', async (original) => {
  const actual = await original<typeof import('../src/host/desktop-binding.ts')>()
  return { ...actual, QcuDesktopBinding: class extends actual.QcuDesktopBinding {
    constructor(owner: QcuPrivateServiceBinding) { super(owner, transport.ipc, 50, true) }
  } }
})

class NativePeer extends EventEmitter implements QcuHostIpc {
  connected = true
  granted = false
  revokeRequested = false
  constructor(private readonly response: 'negative' | 'missing') { super() }
  send(value: object, callback: (error: Error | null) => void) {
    const message = parseQcuPrivateMessage(value)
    callback(null)
    if (message?.type === 'qcu:hello') queueMicrotask(() => { this.emit('message', { ...message, type: 'qcu:bind', generation: '22222222-2222-4222-8222-222222222222', requestId: 1 }) })
    if (message?.type === 'qcu:ready') queueMicrotask(() => { const { origin: _origin, ...fields } = message; this.emit('message', { ...fields, type: 'qcu:grant' }) })
    if (message?.type === 'qcu:granted') this.granted = true
    if (message?.type === 'qcu:revoke') {
      this.revokeRequested = true
      if (this.response === 'negative') queueMicrotask(() => { this.emit('message', { ...message, type: 'qcu:revoked', ok: false }) })
    }
    return true
  }
}

const contexts: Context[] = []
const homes: string[] = []
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.fiber.dispose()
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true })
  transport.ipc = undefined
})

for (const protectedLaunch of [false, true]) for (const response of ['negative', 'missing'] as const) it(`compares protected=${String(protectedLaunch)} after ${response} native acknowledgment and explicit unload`, async () => {
  const ctx = new Context()
  contexts.push(ctx)
  if (protectedLaunch) installQcuLaunchPolicy(ctx, { version: 1 })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SkillRegistry)
  ctx.tools.register({ name: 'ordinary_tool', description: 'synthetic', parameters: {},
    output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'executed' }] }, execute: async () => 'executed' })
  const run = async (name: string) => JSON.stringify((await ctx.tools.execute({ name, arguments: {}, signal: new AbortController().signal, callId: ToolCallId('synthetic') })).content)
  const home = await mkdtemp(join(tmpdir(), 'qcu-unload-ack-'))
  homes.push(home)
  const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim()
  const peer = new NativePeer(response)
  transport.ipc = peer
  const fiber = ctx.plugin(QcuHost, { localPython: { python, home, startupTimeoutMs: 5000, shutdownTimeoutMs: 1000, terminateTimeoutMs: 500, killTimeoutMs: 1000 } })
  const http = createServer(async (request, reply) => {
    await ctx.waterfall('connection/request', request, reply, async () => { reply.end('admitted') })
  })
  await new Promise<void>(resolve => { http.listen(0, '127.0.0.1', resolve) })
  const address = http.address()
  if (address === null || typeof address === 'string') throw new Error('No synthetic HTTP listener')
  const attachment = `http://127.0.0.1:${address.port}/api/session/uploadFileBinary`
  try {
    await fiber.await()
    await vi.waitUntil(() => peer.granted, { timeout: 5000 })
    expect(await run('ordinary_tool')).toContain('permits only local thesis tools')
    expect((await fetch(attachment, { method: 'POST', body: 'synthetic' })).status).toBe(403)
    const bridge = JSON.parse(await readFile(join(home, 'bridge.json'), 'utf8')) as { base_url: string }
    // Cordis records disposer rejection internally; this completion is intentionally not native cleanup success.
    await fiber.dispose()
    expect(peer.revokeRequested).toBe(true)
    expect(peer.listenerCount('message')).toBe(0)
    expect(await run('ordinary_tool')).toContain(protectedLaunch ? 'permits only local thesis tools' : 'executed')
    expect(ctx.tools.schemas().map(tool => tool.name)).not.toContain('qcu_thesis_open')
    expect((await fetch(attachment, { method: 'POST', body: 'synthetic' })).status).toBe(protectedLaunch ? 403 : 200)
    await expect(fetch(bridge.base_url + '/task')).rejects.toThrow()
    await expect(readFile(join(home, 'bridge.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    http.closeAllConnections()
    await new Promise<void>((resolve, reject) => { http.close(error => { if (error) reject(error); else resolve() }) })
  }
})
