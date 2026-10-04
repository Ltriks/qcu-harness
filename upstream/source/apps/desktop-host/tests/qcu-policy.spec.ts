/** Launch-owned policy exercised against real Cordis, ToolRuntime and SystemPrompt. */
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, ToolCallId, type ContentBlock, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installQcuLaunchPolicy } from '../src/qcu-policy.ts'

const DENIED = 'QCU dedicated thesis profile permits only local thesis tools.'
const UNAVAILABLE = 'QCU launch policy is unavailable; this Host is closed.'
const LOCAL_NAMES = ['qcu_thesis_open', 'qcu_thesis_check'] as const
const contexts: Context[] = []

function root(): Context {
  const ctx = new Context()
  contexts.push(ctx)
  return ctx
}

afterEach(async () => {
  vi.restoreAllMocks()
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
})

function register(tools: ToolRuntime, name: string, body = vi.fn(async () => 'executed')) {
  tools.register({
    name, description: 'Policy fixture', parameters: {},
    output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'executed' }] },
    execute: body,
  })
  return body
}

async function execute(tools: ToolRuntime, name = 'ordinary_tool'): Promise<string> {
  const result = await tools.execute({
    name, arguments: {}, signal: new AbortController().signal,
    callId: ToolCallId('launch-policy-test'),
  })
  return JSON.stringify(result.content)
}

/** Real request/response objects, with no listening socket or body transfer. */
async function request(host: Context, url = '/api/session/uploadFileBinary') {
  const incoming = new IncomingMessage(new Socket())
  incoming.url = url
  const response = new ServerResponse(incoming)
  const end = vi.spyOn(response, 'end').mockImplementation(() => response)
  const read = vi.spyOn(incoming, 'read')
  const next = vi.fn(async () => undefined)
  await host.waterfall('connection/request', incoming, response, next)
  expect(read).not.toHaveBeenCalled()
  incoming.destroy()
  return { status: response.statusCode, next, end }
}

const text: ContentBlock[] = [{ type: 'text', text: 'Hello. The word attachment and a filename thesis.docx are ordinary text.' }]

async function step(host: Context, content = text) {
  const messages = [createUserMessage({ content, source: { kind: 'user' } })]
  const next = vi.fn(async () => ({ kind: 'enter' as const, messages }))
  // Admission only reads messages; the inert agent is never used or executed.
  const result = await host.waterfall('agent/pre-step', {
    agent: {} as never, messages, turn: 1, step: 1, signal: new AbortController().signal,
  }, next)
  return { result, next }
}

async function stream(host: Context, content = text) {
  const next = vi.fn(async function* (): AsyncIterable<StreamChunk> { yield { type: 'text-delta', index: 0, text: 'hello' } })
  const options: GenerateOptions = {
    provider: 'inert', model: 'inert', messages: [{ role: 'user', content }],
  }
  const chunks: StreamChunk[] = []
  for await (const chunk of host.waterfall('llm/stream', options, next)) chunks.push(chunk)
  return { chunks, next }
}

async function readyHost() {
  const host = root()
  const policy = installQcuLaunchPolicy(host, { version: 1 })
  await host.plugin(SystemPrompt)
  const provider = await host.plugin(ToolRuntime)
  return { host, policy, provider }
}

describe('QCU process-lifetime launch policy', () => {
  it('requires the fixed version before any policy or tree installation', async () => {
    for (const config of [undefined, null, [], Object.assign([], { version: 1 }), {}, { version: 2 }, { version: 1, allow: ['bash'] }]) {
      const host = root()
      expect(() => installQcuLaunchPolicy(host, config as never)).toThrow('exactly policy { version: 1 }')
      expect((await request(host, '/ordinary')).next).toHaveBeenCalledOnce()
    }
    const host = root()
    const policy = installQcuLaunchPolicy(host, { version: 1 })
    expect(Object.isFrozen(policy)).toBe(true)
    expect(Object.keys(policy)).toEqual(['status'])
    expect(installQcuLaunchPolicy(host, { version: 1 })).toBe(policy)
    await host.fiber.dispose()
    expect(installQcuLaunchPolicy(host, { version: 1 })).toBe(policy)
    expect(policy.status).toBe('closed')
  })

  it('denies HTTP, agent steps and model requests until the official tools service is guarded', async () => {
    const host = root()
    const policy = installQcuLaunchPolicy(host, { version: 1 })
    expect(policy.status).toBe('waiting')
    expect((await request(host, '/ordinary')).status).toBe(503)
    expect((await step(host)).result).toEqual({ kind: 'reject' })
    await expect(stream(host)).rejects.toThrow(UNAVAILABLE)
    await host.plugin(SystemPrompt)
    await host.plugin(ToolRuntime)
    expect(policy.status).toBe('ready')
    expect((await request(host, '/ordinary')).next).toHaveBeenCalledOnce()
    expect((await step(host)).next).toHaveBeenCalledOnce()
    expect((await stream(host)).next).toHaveBeenCalledOnce()
  })

  it('guards the very first injected consumer and every actual tools-fiber restart', async () => {
    const host = root()
    const policy = installQcuLaunchPolicy(host, { version: 1 })
    const results: string[] = []
    const captures: ToolRuntime[] = []
    const body = vi.fn(async () => 'executed')
    const consumer = host.plugin({
      name: 'immediate-tool-consumer', inject: ['tools'],
      async apply(ctx: Context) {
        captures.push(ctx.tools)
        register(ctx.tools, 'ordinary_tool', body)
        results.push(await execute(ctx.tools))
      },
    })
    await host.plugin(SystemPrompt)
    const provider = await host.plugin(ToolRuntime)
    await consumer.await()
    expect(results).toHaveLength(1)
    await provider.restart()
    await consumer.await()
    expect(results).toHaveLength(2)
    await provider.dispose()
    expect(policy.status).toBe('waiting')
    for (const tools of captures) expect(await execute(tools)).toContain(UNAVAILABLE)
    await host.plugin(ToolRuntime)
    await consumer.await()
    expect(results).toHaveLength(3)
    for (const result of results) expect(result).toContain(DENIED)
    expect(body).not.toHaveBeenCalled()
  })

  it('admits exactly two names and keeps a monotonic guard after business unload and reload', async () => {
    const { host } = await readyHost()
    const tools = host.tools
    const ordinary = register(tools, 'ordinary_tool')
    const nearMiss = register(tools, 'qcu_thesis_open_extra')
    for (const name of LOCAL_NAMES) register(tools, name)
    const businessPlugin = { name: 'unloadable-business', apply(ctx: Context) {
      ctx.on('tools/pre-execute', async () => ({ kind: 'allow' }), { prepend: true })
    } }
    const business = await host.plugin(businessPlugin)
    for (const action of [async () => undefined, () => business.restart(), () => business.dispose()]) {
      await action()
      for (const name of LOCAL_NAMES) expect(await execute(tools, name)).toContain('executed')
      expect(await execute(tools)).toContain(DENIED)
      expect(await execute(tools, 'qcu_thesis_open_extra')).toContain(DENIED)
      expect((await request(host)).status).toBe(403)
    }
    expect(ordinary).not.toHaveBeenCalled()
    expect(nearMiss).not.toHaveBeenCalled()
  })

  it('blocks typed attachment routes before body transfer while admitting normal text', async () => {
    const { host } = await readyHost()
    for (const url of ['/api/session/uploadFileBinary', '/api/fileUploads/start', '/api/fileUploads/chunk/1', '/api/file', '/api/%66ile?name=x']) {
      const result = await request(host, url)
      expect(result.status).toBe(403)
      expect(result.next).not.toHaveBeenCalled()
      expect(result.end).toHaveBeenCalledWith(expect.stringContaining('qcu/attachment-blocked'))
    }
    expect((await request(host, '/api/%zz')).status).toBe(400)
    for (const type of ['image', 'file', 'attachment', 'file_attachment', 'image_attachment']) {
      // Legacy attachment tags are deliberately tested at the ingress boundary.
      const content = [{ type, attachment: {} }] as ContentBlock[]
      expect((await step(host, content)).result).toEqual({ kind: 'reject' })
      await expect(stream(host, content)).rejects.toThrow('accepts text commands only')
    }
    expect((await step(host)).result.kind).toBe('enter')
    expect((await stream(host)).next).toHaveBeenCalledOnce()
  })

  it('bounds malformed nested input without recursion and still detects attachments through cycles', async () => {
    const { host } = await readyHost()
    const cyclic: Record<string, unknown> = { type: 'text', text: 'ordinary' }
    cyclic.self = cyclic
    cyclic.child = { type: 'file' }
    await expect(stream(host, [cyclic] as never)).rejects.toThrow('accepts text commands only')
    let nested: object = { type: 'text', text: 'ordinary' }
    for (let index = 0; index < 20_000; index++) nested = { child: nested }
    await expect(stream(host, [nested] as never)).rejects.toThrow('accepts text commands only')
  })

  it('closes synchronously before root disposers and retains old and new captured guards afterward', async () => {
    const { host, provider, policy } = await readyHost()
    const first = host.tools
    register(first, LOCAL_NAMES[0])
    await provider.restart()
    const second = host.tools
    register(second, LOCAL_NAMES[0])
    // A later, independent trusted listener tries to bypass pre-execute. The
    // retained monotonic guards must still deny after Host effects are gone.
    const bypass = root()
    bypass.events = host.events
    bypass.on('tools/pre-execute', async () => ({ kind: 'allow' }), { global: true, prepend: true })
    const during: Promise<unknown>[] = []
    host.effect(() => () => {
      expect(policy.status).toBe('closed')
      during.push(execute(first, LOCAL_NAMES[0]).then((result) => { expect(result).toContain(UNAVAILABLE) }))
      during.push(request(host, '/ordinary').then((result) => { expect(result.status).toBe(503) }))
    })
    await host.fiber.dispose()
    await Promise.all(during)
    expect(policy.status).toBe('closed')
    for (const tools of [first, second]) expect(await execute(tools, LOCAL_NAMES[0])).toContain(UNAVAILABLE)
    expect((await request(host)).status).toBe(503)
    expect((await step(host)).result).toEqual({ kind: 'reject' })
    await expect(stream(host)).rejects.toThrow(UNAVAILABLE)
    // Root restart is not permission to resume this process's dedicated policy.
    await host.plugin(SystemPrompt)
    await host.plugin(ToolRuntime)
    expect(policy.status).toBe('closed')
    expect((await request(host, '/ordinary')).status).toBe(503)
  })

  it('requests synchronous process exit on a guard binding failure and retains denial', async () => {
    const host = root()
    const policy = installQcuLaunchPolicy(host, { version: 1 })
    await host.plugin(SystemPrompt)
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('test process exit') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const guard = vi.spyOn(ToolRuntime.prototype, 'guard').mockImplementation(() => { throw new Error('guard binding failed') })
    await expect(async () => { await host.plugin(ToolRuntime) }).rejects.toThrow('test process exit')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(policy.status).toBe('failed')
    expect((await request(host, '/ordinary')).status).toBe(503)
    expect((await step(host)).result).toEqual({ kind: 'reject' })
    await expect(stream(host)).rejects.toThrow(UNAVAILABLE)
    guard.mockRestore()
  })

  it('terminates an isolated tools provider rather than leaving a second runtime unguarded', async () => {
    const { host, policy } = await readyHost()
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('test process exit') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const isolated = host.isolate('tools')
    await expect(async () => { await isolated.plugin(ToolRuntime) }).rejects.toThrow('test process exit')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(policy.status).toBe('failed')
    expect((await request(host, '/ordinary')).status).toBe(503)
  })

  it('terminates unsupported direct construction on an already-active root', async () => {
    const host = root()
    const policy = installQcuLaunchPolicy(host, { version: 1 })
    await host.plugin(SystemPrompt)
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('test process exit') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => new ToolRuntime(host)).toThrow('test process exit')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(policy.status).toBe('failed')
    expect((await request(host, '/ordinary')).status).toBe(503)
  })
})
