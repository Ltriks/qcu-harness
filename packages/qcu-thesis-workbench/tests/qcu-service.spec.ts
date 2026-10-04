import { spawn, ChildProcess, type SpawnOptions } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QcuService, type QcuServiceOptions } from '../src/host/qcu-service.ts'

const roots: string[] = []
const services: QcuService[] = []

// A real process and loopback HTTP fixture. Only creation translates the Python argv to Node;
// credential files, framing, authentication, cancellation, signals and close all remain real.
const SERVER = String.raw`
import { createServer } from 'node:http'
import { mkdirSync, openSync, closeSync, writeFileSync, unlinkSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
const options = OPTIONS
const home = process.argv[process.argv.indexOf('--home') + 1]
const lock = join(home, 'server.lock')
const bridgePath = join(home, 'bridge.json')
const token = 'synthetic-private-token-never-log-1234567890'
mkdirSync(home, { recursive: true, mode: 0o700 })
const lockFd = openSync(lock, 'wx', 0o600)
writeFileSync(lockFd, JSON.stringify({ pid: process.pid }))
closeSync(lockFd)
writeFileSync(join(home, 'spawned'), String(process.pid))
if (options.ignoreTerm) process.on('SIGTERM', () => {})
if (options.noReady) {
  setInterval(() => {}, 1000)
} else {
  const server = createServer((request, response) => {
    request.resume()
    if (request.url === '/observations') {
      response.end(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), env: process.env }))
      return
    }
    if (request.url === '/crash') {
      response.end('crashing', () => { process.stderr.write(token, () => process.exit(7)) })
      return
    }
    if (request.headers['x-qcu-bridge'] !== token) {
      response.writeHead(403); response.end('{}'); return
    }
    if (request.url === '/bridge/run') {
      writeFileSync(join(home, 'probe-entered'), '')
      if (options.hangProbe) return
      if (options.badProbe) { response.writeHead(200); response.end('{}'); return }
      if (options.redirectProbe) { response.writeHead(302, { Location: 'https://example.invalid/' }); response.end(); return }
      if (options.largeProbe) { response.writeHead(400); response.end('x'.repeat(5000)); return }
      response.writeHead(400); response.end(JSON.stringify({ error: '仅接受文档编号和规则编号。' })); return
    }
    if (request.url === '/bridge/shutdown') {
      writeFileSync(join(home, 'shutdown-entered'), '')
      if (options.hangShutdown) return
      response.end(JSON.stringify({ status: 'stopping' }), () => {
        server.close(() => {
          unlinkSync(bridgePath); unlinkSync(lock)
          writeFileSync(join(home, 'stopped'), '')
        })
        server.closeAllConnections()
      })
      return
    }
    response.writeHead(404); response.end('{}')
  })
  server.listen(0, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port
    const bridge = { base_url: url, token: options.badToken ? token + 'different' : token, pid: options.badPid ? process.pid + 1 : process.pid }
    const bridgeContent = options.corruptBridge ? token : JSON.stringify(bridge)
    if (options.symlinkBridge) {
      writeFileSync(join(home, 'target'), bridgeContent, { mode: 0o600 })
      symlinkSync(join(home, 'target'), bridgePath)
    } else writeFileSync(bridgePath, bridgeContent, { mode: options.publicBridge ? 0o644 : 0o600 })
    const record = { url: options.url ?? url, bridge_path: options.wrongPath ? join(home, 'different.json') : bridgePath }
    const line = options.invalidRecord ? token : options.largeRecord ? 'x'.repeat(5000) : JSON.stringify(record)
    process.stdout.write(line + '\n')
    process.stderr.write(token)
  })
}
`

interface Fixture {
  readonly service: QcuService
  readonly home: string
  readonly server: string
  readonly children: ChildProcess[]
  readonly launches: { executable: string; args: readonly string[]; options: SpawnOptions }[]
}

function fixture(
  behavior: Record<string, unknown> = {}, options: Partial<QcuServiceOptions> = {},
): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'qcu-desktop-service-'))
  roots.push(root)
  const server = join(root, 'synthetic service 校内.mjs')
  const home = join(root, 'private home 中文')
  writeFileSync(server, SERVER.replace('OPTIONS', JSON.stringify(behavior)))
  const children: ChildProcess[] = []
  const launches: Fixture['launches'] = []
  const service = new QcuService({
    python: process.execPath, server, home, startupTimeoutMs: 5_000,
    shutdownTimeoutMs: 300, terminateTimeoutMs: 300, killTimeoutMs: 2_000, ...options,
  }, {
    spawn: (executable, args, spawnOptions) => {
      launches.push({ executable, args, options: spawnOptions })
      const child = spawn(process.execPath, [server, ...args.slice(7)], spawnOptions)
      children.push(child)
      return child
    },
  })
  services.push(service)
  return { service, home, server, children, launches }
}

function get(url: string): Promise<void> {
  return new Promise((resolveResponse, reject) => {
    const outgoing = request(url, { agent: false, signal: AbortSignal.timeout(1_000) }, (response) => {
      response.resume()
      response.once('end', resolveResponse)
      response.once('error', reject)
    })
    outgoing.once('error', reject)
    outgoing.end()
  })
}

function expectClosed(children: readonly ChildProcess[]): void {
  expect(children.length).toBeGreaterThan(0)
  for (const child of children) expect(child.exitCode !== null || child.signalCode !== null).toBe(true)
}

async function exitedPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', ''])
  await new Promise<void>((resolveClosed, reject) => {
    child.once('error', reject)
    child.once('close', () => resolveClosed())
  })
  if (child.pid === undefined) throw new Error('fixture process has no PID')
  return child.pid
}

function staleRecords(home: string, pid: number, bridgePid = pid): void {
  mkdirSync(home, { mode: 0o700 })
  writeFileSync(join(home, 'server.lock'), JSON.stringify({ pid }), { mode: 0o600 })
  writeFileSync(join(home, 'bridge.json'), JSON.stringify({
    pid: bridgePid, base_url: 'http://127.0.0.1:12345', token: 'synthetic-stale-bridge-private-token-12345',
  }), { mode: 0o600 })
}

afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.stop()))
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('QCU desktop service', () => {
  it('coalesces starts, authenticates readiness, uses exact paths and returns no credential', async () => {
    const failure = vi.fn()
    const { service, home, server, launches, children } = fixture({}, { onFailure: failure })
    const first = service.start()
    expect(service.start()).toBe(first)
    const ready = await first
    expect(Object.keys(ready)).toEqual(['url'])
    expect(ready.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(launches).toHaveLength(1)
    expect(launches[0]).toMatchObject({
      executable: process.execPath, args: ['-B', '-E', '-s', '-u', '-X', 'utf8', server, '--home', realpathSync(home), '--port', '0', '--parent-stdin'],
      options: { cwd: resolve(server, '..'), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
    })
    expect(existsSync(join(home, 'probe-entered'))).toBe(true)
    const stopping = service.stop()
    expect(service.stop()).toBe(stopping)
    await stopping
    expectClosed(children)
    expect(existsSync(join(home, 'stopped'))).toBe(true)
    expect(existsSync(join(home, 'bridge.json'))).toBe(false)
    expect(existsSync(join(home, 'server.lock'))).toBe(false)
    await expect(get(ready.url)).rejects.toThrow()
    expect(failure).not.toHaveBeenCalled()
    await service.stop()
  })

  it('restarts only after teardown with a fresh child', async () => {
    const { service, home, children } = fixture()
    await service.start()
    const firstBridge: unknown = JSON.parse(readFileSync(join(home, 'bridge.json'), 'utf8'))
    await service.stop()
    await service.start()
    const secondBridge: unknown = JSON.parse(readFileSync(join(home, 'bridge.json'), 'utf8'))
    expect(secondBridge).not.toEqual(firstBridge)
    expect(children).toHaveLength(2)
    await service.stop()
    expectClosed(children)
  })

  it('scrubs inherited credentials and Python/Node injection variables', async () => {
    const { service, launches } = fixture({}, { environment: {
      ...process.env, DEEPSEEK_API_KEY: 'hidden', accessToken: 'hidden', PASSWORD: 'hidden',
      AWS_SECRET_ACCESS_KEY: 'hidden', PYTHONPATH: '/unsafe', LD_PRELOAD: '/unsafe',
      DYLD_INSERT_LIBRARIES: '/unsafe', NODE_OPTIONS: '--invalid-option', DSH_HOME: '/other-profile',
      QCU_BRIDGE: 'hidden', KEEP_ORDINARY_VALUE: 'retained',
    } })
    await service.start()
    const env = launches[0]?.options.env
    expect(env?.KEEP_ORDINARY_VALUE).toBe('retained')
    for (const key of ['DEEPSEEK_API_KEY', 'accessToken', 'PASSWORD', 'AWS_SECRET_ACCESS_KEY', 'PYTHONPATH',
      'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'NODE_OPTIONS', 'DSH_HOME', 'QCU_BRIDGE']) expect(Object.keys(env ?? {})).not.toContain(key)
  })

  it('cancels before asynchronous preflight can spawn and permits a later start', async () => {
    const { service, children } = fixture()
    const started = service.start()
    const rejected = expect(started).rejects.toThrow('startup cancelled')
    await service.stop()
    await rejected
    expect(children).toHaveLength(0)
    await service.start()
    await service.stop()
    expectClosed(children)
  })

  it('cancels a pending HTTP readiness probe and suppresses failure callbacks', async () => {
    const failure = vi.fn()
    const { service, home, children } = fixture({ hangProbe: true }, { onFailure: failure })
    const started = service.start()
    const rejected = expect(started).rejects.toThrow('startup cancelled')
    await expect.poll(() => existsSync(join(home, 'probe-entered'))).toBe(true)
    const stopped = service.stop()
    await expect(service.start()).rejects.toThrow('service is stopping')
    await stopped
    await rejected
    expectClosed(children)
    expect(failure).not.toHaveBeenCalled()
  })

  it('bounds an unresponsive startup and awaits child exit before rejecting', async () => {
    const { service, home, children } = fixture({ noReady: true }, { startupTimeoutMs: 500 })
    await expect(service.start()).rejects.toThrow('startup timed out')
    expectClosed(children)
    expect(existsSync(join(home, 'server.lock'))).toBe(false)
  })

  it('bounds a readiness request that accepts the connection but never responds', async () => {
    const { service, children } = fixture({ hangProbe: true }, { startupTimeoutMs: 500 })
    await expect(service.start()).rejects.toThrow('startup timed out')
    expectClosed(children)
  })

  it.each([
    [{ url: 'https://127.0.0.1:3456' }, 'invalid readiness record'],
    [{ url: 'http://localhost:3456' }, 'invalid readiness record'],
    [{ url: 'http://127.0.0.1:3456/?token=private' }, 'invalid readiness record'],
    [{ url: 'http://127.0.0.1:3456@evil.example' }, 'invalid readiness record'],
    [{ url: 'http://127.0.0.1:65536' }, 'invalid readiness record'],
    [{ url: 'http://127.0.0.1:1' }, 'does not match owned bridge'],
    [{ wrongPath: true }, 'invalid readiness record'],
    [{ invalidRecord: true }, 'invalid readiness record'],
    [{ largeRecord: true }, 'invalid readiness record'],
    [{ corruptBridge: true }, 'startup failed'],
    [{ badPid: true }, 'does not belong to the child'],
    [{ badToken: true }, 'bridge readiness check failed'],
    [{ badProbe: true }, 'bridge readiness check failed'],
    [{ redirectProbe: true }, 'startup failed'],
    [{ largeProbe: true }, 'bridge response is too large'],
  ])('rejects untrusted readiness %j and keeps diagnostics credential-free', async (behavior, message) => {
    const { service, children } = fixture(behavior)
    const error = await service.start().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain(message)
    expect(String(error)).not.toContain('synthetic-private-token')
    expectClosed(children)
  })

  it.skipIf(process.platform === 'win32')('rejects a bridge readable by other users', async () => {
    const { service, children } = fixture({ publicBridge: true })
    await expect(service.start()).rejects.toThrow('private regular file')
    expectClosed(children)
  })

  it.skipIf(process.platform === 'win32')('rejects a symlink bridge and preserves its target', async () => {
    const { service, home, children } = fixture({ symlinkBridge: true })
    await expect(service.start()).rejects.toThrow('private regular file')
    expectClosed(children)
    expect(existsSync(join(home, 'target'))).toBe(true)
  })

  it('never adopts or deletes unverified pre-existing ownership records', async () => {
    const { service, home, children } = fixture()
    mkdirSync(home, { mode: 0o700 })
    writeFileSync(join(home, 'server.lock'), 'someone else', { mode: 0o600 })
    await expect(service.start()).rejects.toThrow('existing service ownership files')
    expect(children).toHaveLength(0)
    expect(readFileSync(join(home, 'server.lock'), 'utf8')).toBe('someone else')
  })

  it('recovers verified records of a dead process and preserves other data', async () => {
    const { service, home } = fixture()
    staleRecords(home, await exitedPid())
    writeFileSync(join(home, 'personal-data'), 'retained')
    await service.start()
    expect(readFileSync(join(home, 'personal-data'), 'utf8')).toBe('retained')
    await service.stop()
    expect(existsSync(join(home, 'server.lock'))).toBe(false)
    expect(existsSync(join(home, 'bridge.json'))).toBe(false)
  })

  it('recovers a dead-process lock left before bridge creation', async () => {
    const { service, home } = fixture()
    mkdirSync(home, { mode: 0o700 })
    writeFileSync(join(home, 'server.lock'), JSON.stringify({ pid: await exitedPid() }), { mode: 0o600 })
    await service.start()
    await service.stop()
  })

  it('preserves records of a live process without adopting or signalling it', async () => {
    const { service, home, children } = fixture()
    staleRecords(home, process.pid)
    const before = readFileSync(join(home, 'bridge.json'), 'utf8')
    await expect(service.start()).rejects.toThrow('existing service ownership files')
    expect(children).toHaveLength(0)
    expect(readFileSync(join(home, 'bridge.json'), 'utf8')).toBe(before)
    expect(existsSync(join(home, 'server.lock'))).toBe(true)
  })

  it('preserves a dead-process lock paired with a different bridge owner', async () => {
    const { service, home, children } = fixture()
    const pid = await exitedPid()
    staleRecords(home, pid, pid + 1)
    await expect(service.start()).rejects.toThrow('existing service ownership files')
    expect(children).toHaveLength(0)
    expect(existsSync(join(home, 'bridge.json'))).toBe(true)
    expect(existsSync(join(home, 'server.lock'))).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('preserves publicly readable stale credentials', async () => {
    const { service, home, children } = fixture()
    staleRecords(home, await exitedPid())
    chmodSync(join(home, 'bridge.json'), 0o644)
    await expect(service.start()).rejects.toThrow('existing service ownership files')
    expect(children).toHaveLength(0)
    expect(existsSync(join(home, 'server.lock'))).toBe(true)
  })

  it('preserves records replaced during recovery and sanitizes the failure', async () => {
    const { service, home, children } = fixture()
    const pid = await exitedPid()
    staleRecords(home, pid)
    const original = process.kill.bind(process)
    const probe = vi.spyOn(process, 'kill').mockImplementation((target, signal) => {
      if (target === pid && signal === 0) {
        writeFileSync(join(home, 'bridge.json'), JSON.stringify({ pid, base_url: 'http://127.0.0.1:12345', token: 'replacement-private-token-never-log-12345' }))
      }
      return original(target, signal)
    })
    try {
      await expect(service.start()).rejects.toThrow('ownership changed during recovery')
      expect(children).toHaveLength(0)
      expect(readFileSync(join(home, 'bridge.json'), 'utf8')).toContain('replacement-private-token')
      expect(existsSync(join(home, 'server.lock'))).toBe(true)
    } finally { probe.mockRestore() }
  })

  it.skipIf(process.platform === 'win32')('refuses a shared home instead of relaxing permissions', async () => {
    const { service, home, children } = fixture()
    mkdirSync(home)
    chmodSync(home, 0o755)
    await expect(service.start()).rejects.toThrow('private owned directory')
    expect(children).toHaveLength(0)
  })

  it('uses TERM after failed shutdown and cleans only its verified residue', async () => {
    const { service, home, children } = fixture({ hangShutdown: true })
    await service.start()
    await service.stop()
    expectClosed(children)
    expect(existsSync(join(home, 'shutdown-entered'))).toBe(true)
    expect(existsSync(join(home, 'bridge.json'))).toBe(false)
    expect(existsSync(join(home, 'server.lock'))).toBe(false)
    await service.start()
    await service.stop()
  })

  it.skipIf(process.platform === 'win32')('escalates an ignored TERM to KILL and awaits closed pipes', async () => {
    const { service, home, children } = fixture({ hangShutdown: true, ignoreTerm: true })
    await service.start()
    await service.stop()
    expect(children[0]?.signalCode).toBe('SIGKILL')
    expect(existsSync(join(home, 'server.lock'))).toBe(false)
  })

  it('leaves replaced ownership files intact after forced shutdown', async () => {
    const { service, home, children } = fixture({ hangShutdown: true })
    await service.start()
    const bridgePath = join(home, 'bridge.json')
    const bridge = JSON.parse(readFileSync(bridgePath, 'utf8')) as Record<string, unknown>
    bridge.token = 'replacement-private-token-with-new-owner-12345'
    writeFileSync(bridgePath, JSON.stringify(bridge))
    await service.stop()
    expectClosed(children)
    expect(JSON.parse(readFileSync(bridgePath, 'utf8'))).toEqual(bridge)
    expect(existsSync(join(home, 'server.lock'))).toBe(true)
  })

  it('reports unexpected exit once without child diagnostics and contains observer exceptions', async () => {
    const failure = vi.fn(() => { throw new Error('observer failed') })
    const { service, children } = fixture({}, { onFailure: failure })
    const { url } = await service.start()
    await get(new URL('/crash', url).href).catch(() => undefined)
    await expect.poll(() => failure.mock.calls.length).toBe(1)
    await service.stop()
    expectClosed(children)
    expect(failure).toHaveBeenCalledWith(new Error('QCU service: child exited unexpectedly'))
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('contains lifetime-pipe errors, revokes readiness and stops only its owned child', async () => {
    const failure = vi.fn()
    const { service, children } = fixture({}, { onFailure: failure })
    await service.start()
    expect(children[0]?.stdin).not.toBeNull()
    children[0]?.stdin?.emit('error', new Error('synthetic-private-token-never-log'))
    await service.stop()
    expectClosed(children)
    expect(failure).toHaveBeenCalledExactlyOnceWith(new Error('QCU service: parent lifetime pipe failed'))
    children[0]?.stdin?.emit('error', new Error('late private diagnostic'))
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('cancels startup on lifetime-pipe failure without a readiness callback', async () => {
    const failure = vi.fn()
    const { service, home, children } = fixture({ hangProbe: true }, { onFailure: failure })
    const started = service.start()
    const rejected = expect(started).rejects.toThrow('QCU service: parent lifetime pipe failed')
    await expect.poll(() => existsSync(join(home, 'probe-entered'))).toBe(true)
    children[0]?.stdin?.emit('error', new Error('synthetic-private-token-never-log'))
    await rejected
    expectClosed(children)
    expect(failure).not.toHaveBeenCalled()
  })

  it('settles spawn failures with sanitized errors and repeatable stop', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-desktop-spawn-failure-'))
    roots.push(root)
    const service = new QcuService({ python: join(root, 'missing-python'), server: join(root, 'server.py'), home: join(root, 'home') })
    services.push(service)
    await expect(service.start()).rejects.toThrow('child process failed')
    await service.stop()
    await service.stop()
  })

  it('retains a child when termination cannot be confirmed and allows a later stop retry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-desktop-unconfirmed-exit-'))
    roots.push(root)
    const child = new ChildProcess()
    const kill = vi.spyOn(child, 'kill').mockReturnValue(false)
    const service = new QcuService({
      python: process.execPath, server: join(root, 'unused.py'), home: join(root, 'home'),
      startupTimeoutMs: 30, terminateTimeoutMs: 20, killTimeoutMs: 20,
    }, { spawn: () => child })
    services.push(service)
    await expect(service.start()).rejects.toThrow('termination did not reach quiescence')
    expect(kill.mock.calls.map(call => call[0])).toEqual(['SIGTERM', 'SIGKILL'])
    await expect(service.start()).rejects.toThrow('service is stopping')
    kill.mockImplementation(() => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true })
    const stopped = service.stop()
    expect(service.stop()).toBe(stopped)
    await stopped
    expect(kill).toHaveBeenCalledTimes(3)
  })

  it.skipIf(process.platform === 'win32')('canonicalizes a linked parent while refusing a linked home', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-desktop-parent-link-'))
    roots.push(root)
    const real = join(root, 'real')
    const link = join(root, 'link')
    mkdirSync(real, { mode: 0o700 })
    symlinkSync(real, link)
    const { service, launches } = fixture({}, { home: join(link, 'home') })
    await service.start()
    expect(launches[0]?.args).toContain(realpathSync(join(real, 'home')))
    await service.stop()
    const linkedHome = fixture({}, { home: link })
    await expect(linkedHome.service.start()).rejects.toThrow('private owned directory')
    expect(linkedHome.children).toHaveLength(0)
  })

  // QCU assets and Python are separately provisioned; this opt-in exercises the shipping server without bundling it here.
  it.skipIf(process.env.QCU_SERVICE_REAL_SERVER === undefined || process.env.QCU_SERVICE_PYTHON === undefined)(
    'starts, authenticates, stops and restarts the real QCU Python server with Chinese and spaced paths', async () => {
      const server = process.env.QCU_SERVICE_REAL_SERVER
      const python = process.env.QCU_SERVICE_PYTHON
      if (server === undefined || python === undefined) throw new Error('Real QCU smoke requires explicit server and Python paths')
      const root = mkdtempSync(join(tmpdir(), 'qcu-real-python-'))
      roots.push(root)
      const home = join(root, '校内 中文 home')
      const children: ChildProcess[] = []
      for (let cycle = 0; cycle < 2; cycle++) {
        const service = new QcuService({
          python, server, home, environment: { ...process.env, DEEPSEEK_API_KEY: 'synthetic-secret', PYTHONPATH: '/invalid' },
        }, { spawn: (executable, args, options) => {
          expect(Object.keys(options.env ?? {})).not.toContain('DEEPSEEK_API_KEY')
          expect(Object.keys(options.env ?? {})).not.toContain('PYTHONPATH')
          const child = spawn(executable, args, options)
          children.push(child)
          return child
        } })
        services.push(service)
        const ready = await service.start()
        expect(Object.keys(ready)).toEqual(['url'])
        await new Promise<void>((resolveResponse, reject) => {
          const outgoing = request(ready.url, { agent: false, signal: AbortSignal.timeout(1_000) }, (response) => {
            try {
              expect(response.statusCode).toBe(200)
              expect(response.headers['content-type']).toContain('text/html')
              expect(response.headers['set-cookie']?.[0]?.includes('HttpOnly; SameSite=Strict')).toBe(true)
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Unexpected non-error assertion failure'))
            }
            response.resume()
            response.once('end', resolveResponse)
            response.once('error', reject)
          })
          outgoing.once('error', reject)
          outgoing.end()
        })
        await service.stop()
        expect(children.at(-1)?.exitCode).toBe(0)
        expect(existsSync(join(home, 'server.lock'))).toBe(false)
        expect(existsSync(join(home, 'bridge.json'))).toBe(false)
      }
      expect(children).toHaveLength(2)
    },
  )

  it('requires absolute paths and positive finite deadlines', () => {
    const options = { python: process.execPath, server: resolve('server.py'), home: resolve('private-home') }
    expect(() => new QcuService({ ...options, python: 'python' })).toThrow('absolute paths')
    expect(() => new QcuService({ ...options, startupTimeoutMs: 0 })).toThrow('invalid deadline')
    expect(() => new QcuService({ ...options, killTimeoutMs: Infinity })).toThrow('invalid deadline')
  })
})
