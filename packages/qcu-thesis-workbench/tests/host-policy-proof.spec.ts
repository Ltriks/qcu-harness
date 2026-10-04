/** Synthetic proof only: detached launch-policy ownership using public Cordis APIs. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'

const DENIED = 'Synthetic launch policy permits only the two local thesis tools.'
const LOCAL_NAMES = ['qcu_thesis_open', 'qcu_thesis_check'] as const
const contexts: Context[] = []

function root(): Context {
  const ctx = new Context()
  contexts.push(ctx)
  return ctx
}

afterEach(async () => {
  // This is test-process cleanup, not a production policy-release API.
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
})

/** Deliberately independent of host/plugin fibers; no private-field mutations. */
function launchPolicy(host: Context) {
  const owner = root()
  owner.events = host.events
  const attached = new Set<object>()
  let bindings = 0
  const attach = (identity: object, tools: ToolRuntime): void => {
    if (attached.has(identity)) return
    if (owner.get('tools')) owner.set('tools', tools)
    else owner.provide('tools', tools)
    owner.tools.guard(exec => LOCAL_NAMES.some(name => name === exec.name) ? undefined : DENIED)
    attached.add(identity)
    bindings++
  }
  // Install before config-tree plugins, and ignore the owner's mirrored provision.
  owner.on('internal/service', function (name, value) {
    if (name !== 'tools' || this.root !== host || !value) return
    const tools = host.get('tools')
    if (tools) attach(value, tools)
  }, { global: true, prepend: true })
  const existing = host.get('tools')
  if (existing) attach(existing, existing)
  owner.on('connection/request', async (request, response, next) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (path === '/api/session/uploadFileBinary' || path.startsWith('/api/fileUploads/') || path === '/api/file') {
      response.writeHead(403)
      response.end('synthetic attachment denial')
      return
    }
    await next()
  }, { global: true, prepend: true })
  return { get bindings() { return bindings } }
}

function register(tools: ToolRuntime, name: string, body = vi.fn(async () => 'executed')) {
  tools.register({
    name, description: 'Synthetic proof fixture', parameters: {},
    output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'executed' }] },
    execute: body,
  })
  return body
}

async function execute(tools: ToolRuntime, name = 'ordinary_tool'): Promise<string> {
  const result = await tools.execute({
    name, arguments: {}, signal: new AbortController().signal,
    callId: ToolCallId('synthetic-policy-proof'),
  })
  return JSON.stringify(result.content)
}

/** Real Cordis waterfall, inert HTTP records: no listener, filesystem, or model. */
async function request(host: Context, url = '/api/session/uploadFileBinary') {
  let status = 200
  const next = vi.fn(async () => undefined)
  const response = {
    writeHead: (value: number) => { status = value },
    end: vi.fn(),
  }
  await host.waterfall('connection/request', { url } as never, response as never, next)
  return { status, next, response }
}

describe('detached launch-policy public-API proof', () => {
  it('keeps exact two-name guard and late HTTP denial after business and host root disposal', async () => {
    const host = root()
    await host.plugin(SystemPrompt)
    await host.plugin(ToolRuntime)
    const captured = host.tools
    const ordinary = register(captured, 'ordinary_tool')
    for (const name of LOCAL_NAMES) register(captured, name)
    const nearMiss = register(captured, 'qcu_thesis_open_extra')
    expect(await execute(captured)).toContain('executed')
    ordinary.mockClear()

    const policy = launchPolicy(host)
    const business = await host.plugin({ name: 'synthetic-business', apply(ctx: Context) {
      ctx.on('connection/request', async (_request, _response, next) => next())
    } })
    const lateRequest = () => request(host)
    expect(policy.bindings).toBe(1)
    for (const name of LOCAL_NAMES) expect(await execute(captured, name)).toContain('executed')
    expect(await execute(captured, 'qcu_thesis_open_extra')).toContain(DENIED)
    expect(nearMiss).not.toHaveBeenCalled()

    for (const dispose of [async () => undefined, () => business.dispose(), () => host.fiber.dispose()]) {
      await dispose()
      expect(await execute(captured)).toContain(DENIED)
      const result = await lateRequest()
      expect(result.status).toBe(403)
      expect(result.next).not.toHaveBeenCalled()
      expect(ordinary).not.toHaveBeenCalled()
    }
    const normal = await request(host, '/synthetic-health')
    expect(normal.status).toBe(200)
    expect(normal.next).toHaveBeenCalledOnce()
  })

  it('binds before official injected consumers on initial load, actual-fiber restart, and replacement', async () => {
    const host = root()
    const policy = launchPolicy(host)
    const results: string[] = []
    const captured: ToolRuntime[] = []
    const ordinary = vi.fn(async () => 'executed')
    const consumer = host.plugin({
      name: 'synthetic-immediate-consumer', inject: ['tools'],
      async apply(ctx: Context) {
        captured.push(ctx.tools)
        register(ctx.tools, 'ordinary_tool', ordinary)
        // No artificial delay between injection and the first ordinary execution.
        results.push(await execute(ctx.tools))
      },
    })
    await host.plugin(SystemPrompt)
    // Await resolves the actual Fiber used by official Loader/HMR (.ctx.fiber).
    const tools = await host.plugin(ToolRuntime)
    await consumer.await()
    expect(results).toHaveLength(1)
    expect(results[0]).toContain(DENIED)
    expect(policy.bindings).toBe(1)

    await tools.restart()
    await consumer.await()
    expect(results).toHaveLength(2)
    expect(results[1]).toContain(DENIED)
    expect(policy.bindings).toBe(2)

    await tools.dispose()
    await host.plugin(ToolRuntime)
    await consumer.await()
    expect(results).toHaveLength(3)
    expect(results[2]).toContain(DENIED)
    expect(policy.bindings).toBe(3)
    await host.fiber.dispose()
    for (const retained of captured) expect(await execute(retained)).toContain(DENIED)
    expect((await request(host)).status).toBe(403)
    expect(ordinary).not.toHaveBeenCalled()
  })

  it('documents the raw active-root constructor limit: service notification precedes runtime fields', async () => {
    const host = root()
    launchPolicy(host)
    await host.plugin(SystemPrompt)
    // Direct construction is not the official config-tree class-plugin path.
    // super() publishes before ToolRuntime.layers exists, so the hook cannot bind.
    expect(() => new ToolRuntime(host)).toThrow(TypeError)
  })

  it('documents the trusted-provider limit: self-execution before async provider activation is unguarded', async () => {
    const host = root()
    const policy = launchPolicy(host)
    await host.plugin(SystemPrompt)
    let beforeActivation = ''
    const ordinary = vi.fn(async () => 'executed')
    await host.plugin({
      name: 'synthetic-self-executing-provider', inject: ['systemPrompt'],
      async apply(ctx: Context) {
        await Promise.resolve()
        new ToolRuntime(ctx)
        register(ctx.tools, 'ordinary_tool', ordinary)
        beforeActivation = await execute(ctx.tools)
        expect(policy.bindings).toBe(0)
      },
    })
    expect(beforeActivation).toContain('executed')
    expect(ordinary).toHaveBeenCalledOnce()
    expect(policy.bindings).toBe(1)
    expect(await execute(host.tools)).toContain(DENIED)
  })
})
