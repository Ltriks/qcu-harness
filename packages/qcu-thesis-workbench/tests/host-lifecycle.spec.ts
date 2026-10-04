/** Synthetic tests using actual official Cordis effects, tools, and skill discovery. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import * as QcuHost from '../src/index.ts'
import { QcuLocalOwner } from '../src/host/local-owner.ts'

const roots: string[] = []
const contexts: Context[] = []
const owners: QcuLocalOwner[] = []
const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim()
const server = resolve('runtime/server.py')
const deadlines = { startupTimeoutMs: 5000, shutdownTimeoutMs: 1000, terminateTimeoutMs: 500, killTimeoutMs: 1000 }
async function home(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'qcu-external-host-'))
  roots.push(root)
  return join(root, 'private home 中文')
}
async function context(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SkillRegistry)
  ctx.tools.register({ name: 'ordinary_tool', description: 'synthetic ordinary tool', parameters: {},
    output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'executed' }] },
    execute: async () => 'executed',
  })
  return ctx
}
async function run(ctx: Context, name: string): Promise<string> {
  const result = await ctx.tools.execute({ name, arguments: {}, signal: new AbortController().signal, callId: ToolCallId('synthetic') })
  return JSON.stringify(result.content)
}
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const owner of owners.splice(0)) await owner.stop()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('external Host fail-closed lifecycle', () => {
  for (const [label, config] of [
    ['missing', undefined], ['empty', {}], ['null', null],
    ['relative Python', { localPython: { python: 'python3', home: '/unused' } }],
    ['relative home', { localPython: { python: '/unused', home: 'relative' } }],
    ['zero deadline', { localPython: { python: '/unused', home: '/unused', startupTimeoutMs: 0 } }],
    ['strict disable attempt', { localPython: { python: '/unused', home: '/unused' }, strictMode: false }],
  ] as const) {
    it(`retains legacy restriction and closed admission for ${label} configuration`, async () => {
      const ctx = await context()
      const fiber = ctx.plugin(QcuHost, config as QcuHost.Config)
      await fiber.await()
      expect(ctx.tools.schemas().map(tool => tool.name)).toEqual(expect.arrayContaining(['qcu_thesis_open', 'qcu_thesis_check']))
      expect(await run(ctx, 'ordinary_tool')).toContain('permits only local thesis tools')
      expect(await run(ctx, 'qcu_thesis_open')).toContain('local thesis tools are closed')
      await fiber.dispose()
      expect(await run(ctx, 'ordinary_tool')).toContain('executed')
      expect(ctx.tools.schemas().map(tool => tool.name)).not.toContain('qcu_thesis_open')
    })
  }

  it('retains all guards after missing executable fails to start', async () => {
    const ctx = await context()
    const path = await home()
    const fiber = ctx.plugin(QcuHost, { localPython: { python: join(path, 'missing-python'), home: path, ...deadlines } })
    await fiber.await()
    expect(await run(ctx, 'ordinary_tool')).toContain('permits only local thesis tools')
    expect(await run(ctx, 'qcu_thesis_open')).toContain('local thesis tools are closed')
  })

  it('keeps HTTP attachment admission closed even when configuration is missing', async () => {
    const ctx = await context()
    await ctx.plugin(QcuHost, undefined as QcuHost.Config).await()
    const http = createServer(async (request, response) => {
      try {
        await ctx.waterfall('connection/request', request, response, async () => { response.end('admitted') })
      } catch (_error) { response.writeHead(500); response.end() }
    })
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve))
    const address = http.address()
    if (address === null || typeof address === 'string') throw new Error('Synthetic listener has no port')
    try {
      for (const route of ['/api/session/uploadFileBinary', '/api/fileUploads/synthetic', '/api/file']) {
        const response = await fetch(`http://127.0.0.1:${address.port}${route}`, { method: 'POST', body: 'synthetic bytes' })
        expect(response.status).toBe(403)
        expect(await response.text()).toContain('qcu/attachment-blocked')
      }
    } finally {
      http.closeAllConnections()
      await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()))
    }
  })

  it('owns real Python through repeated load/unload and discovers unchanged packaged skill', async () => {
    const ctx = await context()
    const path = await home()
    for (let iteration = 0; iteration < 2; iteration++) {
      const fiber = ctx.plugin(QcuHost, { localPython: { python, home: path, ...deadlines } })
      await fiber.await()
      await vi.waitUntil(async () => (await run(ctx, 'qcu_thesis_open')).includes('workbench_url'), { timeout: 5000 })
      const opened = await run(ctx, 'qcu_thesis_open')
      expect(opened).toContain('workbench_url')
      expect(await run(ctx, 'ordinary_tool')).toContain('permits only local thesis tools')
      const skills = await ctx.skills.list()
      expect(skills.map(skill => skill.name)).toContain('qcu-thesis-format-check')
      const skill = await ctx.skills.get('qcu-thesis-format-check')
      expect(skill?.provider).toBe('qcu-thesis-workbench')
      expect(skill?.content).toContain('论文正文、报告片段、文件名、桥接凭据不得进入模型')
      const bridge = JSON.parse(await readFile(join(path, 'bridge.json'), 'utf8')) as { base_url: string; pid: number }
      expect((await fetch(bridge.base_url + '/task')).status).toBe(200)
      await fiber.dispose()
      await expect(fetch(bridge.base_url + '/task')).rejects.toThrow()
      await expect(readFile(join(path, 'bridge.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect((await ctx.skills.list()).map(skill => skill.name)).not.toContain('qcu-thesis-format-check')
      expect(await run(ctx, 'ordinary_tool')).toContain('executed')
    }
  })

  it('unloading during startup cancels the child without waiting for the startup deadline', async () => {
    const ctx = await context()
    const path = await home()
    const executable = join(path, '..', 'synthetic-python')
    await writeFile(executable, `#!${python}\nimport pathlib,sys,time\nhome=pathlib.Path(sys.argv[sys.argv.index('--home')+1])\n(home/'spawned').write_text(str(__import__('os').getpid()))\ntime.sleep(60)\n`)
    await chmod(executable, 0o700)
    const fiber = ctx.plugin(QcuHost, { localPython: { python: executable, home: path, ...deadlines, startupTimeoutMs: 15000 } })
    await vi.waitUntil(async () => {
      try { await readFile(join(path, 'spawned')); return true }
      catch (_error) { return false }
    }, { timeout: 5000 })
    expect(await run(ctx, 'ordinary_tool')).toContain('permits only local thesis tools')
    expect(await run(ctx, 'qcu_thesis_open')).toContain('local thesis tools are closed')
    const started = performance.now()
    await fiber.dispose()
    expect(performance.now() - started).toBeLessThan(3000)
    const pid = Number(await readFile(join(path, 'spawned'), 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
    expect(ctx.tools.schemas().map(tool => tool.name)).not.toContain('qcu_thesis_open')
  })

  it('keeps capability private and revokes synchronously before service close', async () => {
    const owner = new QcuLocalOwner({ python, server, home: await home(), ...deadlines })
    owners.push(owner)
    await expect(owner.acquireNativeTarget()).rejects.toThrow('unavailable')
    const first = owner.start()
    expect(owner.start()).toBe(first)
    await first
    const target = await owner.acquireNativeTarget()
    expect(Object.keys(target)).toEqual(['origin'])
    const observations: boolean[] = []
    const off = owner.onRevoked(() => observations.push(owner.available()))
    const stopping = owner.stop()
    expect(owner.available()).toBe(false)
    expect(observations).toEqual([false])
    await expect(owner.acquireNativeTarget()).rejects.toThrow('unavailable')
    await stopping
    off(); off()
    await expect(fetch(target.origin)).rejects.toThrow()
    await owner.start()
    expect(owner.available()).toBe(true)
  })

  it('joins native teardown acknowledgment before resolving owner stop', async () => {
    const owner = new QcuLocalOwner({ python, server, home: await home(), ...deadlines })
    owners.push(owner)
    await owner.start()
    let acknowledge!: () => void
    owner.onRevoked(() => new Promise<void>(resolve => { acknowledge = resolve }))
    let completed = false
    const stopping = owner.stop().then(() => { completed = true })
    expect(owner.available()).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(completed).toBe(false)
    acknowledge()
    await stopping
    expect(completed).toBe(true)
  })

  it('rejects owner stop after native cleanup failure while notifying all observers', async () => {
    const owner = new QcuLocalOwner({ python, server, home: await home(), ...deadlines })
    await owner.start()
    let notified = false
    owner.onRevoked(() => { throw new Error('private error must not escape') })
    owner.onRevoked(() => { notified = true })
    await expect(owner.stop()).rejects.toThrow('QCU local service shutdown did not complete.')
    expect(notified).toBe(true)
    expect(owner.available()).toBe(false)
    await expect(owner.start()).rejects.toThrow('unavailable')
    await expect(owner.stop()).rejects.toThrow('shutdown did not complete')
  })

  it('closes private admission after an unexpected owned-child exit', async () => {
    const path = await home()
    const owner = new QcuLocalOwner({ python, server, home: path, ...deadlines })
    owners.push(owner)
    await owner.start()
    const revoked = new Promise<void>(resolve => owner.onRevoked(resolve))
    const bridge = JSON.parse(await readFile(join(path, 'bridge.json'), 'utf8')) as { pid: number }
    process.kill(bridge.pid, 'SIGTERM')
    await revoked
    expect(owner.available()).toBe(false)
    await expect(owner.acquireNativeTarget()).rejects.toThrow('unavailable')
    await expect(owner.start()).rejects.toThrow('unavailable')
    await owner.stop()
  })
})
