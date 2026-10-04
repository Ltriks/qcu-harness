/** Owns the private QCU loopback service without exposing its bridge credential to renderers or logs. */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { constants, type Stats } from 'node:fs'
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { request } from 'node:http'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/** Paths and deadlines for one Host-owned QCU service. */
export interface QcuServiceOptions {
  readonly python: string
  readonly server: string
  readonly home: string
  readonly environment?: NodeJS.ProcessEnv
  readonly startupTimeoutMs?: number
  readonly shutdownTimeoutMs?: number
  readonly terminateTimeoutMs?: number
  readonly killTimeoutMs?: number
  /** Reports the first unexpected failure after readiness; startup failures reject start instead. */
  readonly onFailure?: (error: Error) => void
}

/** Private local endpoint for the owning Host and admitted native main process only. */
export interface QcuServiceReady {
  readonly url: string
}

/** Process creation adapter; HTTP and credential validation always use their real implementations. */
export interface QcuServiceDependencies {
  readonly spawn?: (executable: string, args: readonly string[], options: SpawnOptions) => ChildProcess
}

interface Bridge {
  readonly base_url: string
  readonly token: string
  readonly pid: number
}

interface Run {
  readonly abort: AbortController
  child?: ChildProcess
  home?: string
  closed: Promise<void>
  exited: boolean
  ready: boolean
  reported: boolean
  bridge?: Bridge
  lock?: Stats
  startup?: Promise<QcuServiceReady>
  start?: Promise<QcuServiceReady>
  stop?: Promise<void> | undefined
}

const MAX_RECORD_BYTES = 4096

class ServiceError extends Error {}

function failure(message: string): ServiceError {
  return new ServiceError(`QCU service: ${message}`)
}

function deadline(value: number | undefined, fallback: number): number {
  const milliseconds = value ?? fallback
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw failure('invalid deadline')
  return milliseconds
}

function origin(value: unknown): value is string {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(value)) return false
  try {
    const url = new URL(value)
    return url.origin === value && Number(url.port) <= 65535
  } catch (_error) {
    // Invalid child output is refused without including it in an error.
    return false
  }
}

function environment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([name]) =>
    !/KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTHORIZATION/i.test(name)
    && !/^(PYTHON|LD_|DYLD_|NODE_|ELECTRON_|DSH_|QCU_)/i.test(name)))
}

function privateFile(stat: Stats): boolean {
  return stat.isFile() && stat.nlink === 1 && (process.platform === 'win32'
    || ((stat.mode & 0o077) === 0 && stat.uid === process.getuid?.()))
}

async function readPrivateRecord(path: string): Promise<{ value: unknown; stat: Stats }> {
  // O_NOFOLLOW also closes the lstat/open symlink race on platforms that implement it.
  if (!(await lstat(path)).isFile()) throw failure('bridge is not a private regular file')
  const handle = await open(path, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW))
  try {
    const stat = await handle.stat()
    if (!privateFile(stat) || stat.size > MAX_RECORD_BYTES) throw failure('bridge is not a private regular file')
    const buffer = Buffer.alloc(MAX_RECORD_BYTES + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead > MAX_RECORD_BYTES) throw failure('bridge record is too large')
    const value: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'))
    return { value, stat }
  } finally {
    await handle.close()
  }
}

async function readBridge(path: string, pid: number | undefined): Promise<Bridge> {
  const { value } = await readPrivateRecord(path)
  if (typeof value !== 'object' || value === null || !('base_url' in value) || !origin(value.base_url)
    || !('pid' in value) || typeof value.pid !== 'number' || value.pid !== pid || !Number.isSafeInteger(pid)
    || !('token' in value) || typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(value.token)) {
    throw failure('bridge does not belong to the child')
  }
  return { base_url: value.base_url, token: value.token, pid: value.pid }
}

async function readLock(path: string, pid: number | undefined): Promise<Stats> {
  const { value, stat } = await readPrivateRecord(path)
  if (typeof value !== 'object' || value === null || !('pid' in value) || typeof value.pid !== 'number' || value.pid !== pid || !Number.isSafeInteger(pid)) {
    throw failure('lock does not belong to the child')
  }
  return stat
}

function sameFile(first: Stats, second: Stats): boolean {
  return first.ino === second.ino && first.dev === second.dev && first.mtimeMs === second.mtimeMs && first.size === second.size
}

function missing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

/** Recover only unchanged private records whose recorded process is provably gone. */
async function recoverStaleOwnership(home: string, signal: AbortSignal): Promise<void> {
  const lockPath = join(home, 'server.lock')
  const bridgePath = join(home, 'bridge.json')
  let lock: Awaited<ReturnType<typeof readPrivateRecord>>
  try { lock = await readPrivateRecord(lockPath) }
  catch (error) {
    if (missing(error)) {
      try { await lstat(bridgePath) }
      catch (bridgeError) { if (missing(bridgeError)) return }
    }
    throw failure('existing service ownership files require recovery')
  }
  const value = lock.value
  if (typeof value !== 'object' || value === null || !('pid' in value)
    || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 1) {
    throw failure('existing service ownership files require recovery')
  }
  const pid = value.pid
  let bridge: Awaited<ReturnType<typeof readPrivateRecord>> | undefined
  try {
    bridge = await readPrivateRecord(bridgePath)
    await readBridge(bridgePath, pid)
  } catch (error) {
    if (!missing(error)) throw failure('existing service ownership files require recovery')
  }
  signal.throwIfAborted()
  try {
    process.kill(pid, 0)
    throw failure('existing service ownership files require recovery')
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ESRCH') {
      throw failure('existing service ownership files require recovery')
    }
  }
  const currentLock = await readPrivateRecord(lockPath)
  if (!sameFile(lock.stat, currentLock.stat) || JSON.stringify(lock.value) !== JSON.stringify(currentLock.value)) {
    throw failure('service ownership changed during recovery')
  }
  if (bridge !== undefined) {
    const currentBridge = await readPrivateRecord(bridgePath)
    if (!sameFile(bridge.stat, currentBridge.stat) || JSON.stringify(bridge.value) !== JSON.stringify(currentBridge.value)) {
      throw failure('service ownership changed during recovery')
    }
  } else {
    try { await lstat(bridgePath); throw failure('service ownership changed during recovery') }
    catch (error) { if (!missing(error)) throw error }
  }
  signal.throwIfAborted()
  if (bridge !== undefined) await unlink(bridgePath)
  await unlink(lockPath)
}

function post(bridge: Bridge, route: string, signal: AbortSignal): Promise<{ status: number; body: string }> {
  return new Promise((resolveResponse, reject) => {
    let result: { status: number; body: string } | undefined
    let error: Error | undefined
    const outgoing = request(new URL(route, bridge.base_url), {
      method: 'POST', signal, agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '2', 'X-QCU-Bridge': bridge.token },
    }, (response) => {
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_RECORD_BYTES) {
          error = failure('bridge response is too large')
          outgoing.destroy()
          return
        }
        chunks.push(chunk)
      })
      response.once('error', (responseError: Error) => { error ??= responseError; outgoing.destroy() })
      response.once('end', () => { result = { status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') } })
    })
    outgoing.once('error', (requestError) => { error ??= requestError })
    // Settle only after the request socket closes, including abort and oversized-response paths.
    outgoing.once('close', () => {
      if (error !== undefined) reject(error)
      else if (result !== undefined) resolveResponse(result)
      else reject(failure('bridge connection closed before its response'))
    })
    outgoing.end('{}')
  })
}

async function exitsWithin(closed: Promise<void>, milliseconds: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([closed.then(() => true), new Promise<false>((resolveTimeout) => {
      timer = setTimeout(() => { resolveTimeout(false) }, Math.max(0, milliseconds))
    })])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Reusable owner of exactly one child; a successful stop means the child and its pipes have closed. */
export class QcuService {
  private run: Run | undefined
  private readonly startupTimeout: number
  private readonly shutdownTimeout: number
  private readonly terminateTimeout: number
  private readonly killTimeout: number
  private readonly spawnChild: NonNullable<QcuServiceDependencies['spawn']>

  /**
   * @param options - Absolute Python, server and private data paths, bounded deadlines and failure callback.
   * @param dependencies - Optional child creation adapter for protocol tests.
   */
  constructor(private readonly options: QcuServiceOptions, dependencies: QcuServiceDependencies = {}) {
    if (![options.python, options.server, options.home].every(isAbsolute)) throw failure('absolute paths are required')
    this.startupTimeout = deadline(options.startupTimeoutMs, 15_000)
    this.shutdownTimeout = deadline(options.shutdownTimeoutMs, 3_000)
    this.terminateTimeout = deadline(options.terminateTimeoutMs, 2_000)
    this.killTimeout = deadline(options.killTimeoutMs, 2_000)
    this.spawnChild = dependencies.spawn ?? spawn
  }

  /**
   * Start or join the current startup, returning only after bridge ownership and HTTP readiness are checked.
   * A start during teardown rejects; a new start after successful teardown creates a fresh child.
   * @returns The credential-free, exact loopback origin of the owned child.
   */
  start(): Promise<QcuServiceReady> {
    if (this.run?.abort.signal.aborted) return Promise.reject(failure('service is stopping'))
    if (this.run?.start !== undefined) return this.run.start
    const run: Run = { abort: new AbortController(), closed: Promise.resolve(), exited: false, ready: false, reported: false }
    this.run = run
    run.startup = this.launch(run)
    run.start = run.startup.catch(async (error: unknown) => {
      await this.stopRun(run)
      // Only errors created here are exposed; filesystem, HTTP and child diagnostics remain private.
      throw error
    })
    return run.start
  }

  /**
   * Cancel startup, suppress subsequent callbacks and await graceful shutdown or owned-child termination.
   * No unrelated process is signalled. Failure to observe close rejects and retains ownership for retry.
   * @returns Completion after all owned child I/O is quiescent.
   */
  stop(): Promise<void> {
    return this.run === undefined ? Promise.resolve() : this.stopRun(this.run)
  }

  private async launch(run: Run): Promise<QcuServiceReady> {
    const timer = setTimeout(() => { run.abort.abort(failure('startup timed out')) }, this.startupTimeout)
    try {
      const requestedHome = resolve(this.options.home)
      await mkdir(requestedHome, { recursive: true, mode: 0o700 })
      const stat = await lstat(requestedHome)
      if (!stat.isDirectory() || (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))) {
        throw failure('home must be a private owned directory')
      }
      // Python resolves parent-directory links, including macOS /var -> /private/var.
      const home = await realpath(requestedHome)
      run.home = home
      await recoverStaleOwnership(home, run.abort.signal)
      run.abort.signal.throwIfAborted()
      const child = this.spawnChild(this.options.python, ['-B', '-E', '-s', '-u', '-X', 'utf8', this.options.server, '--home', home, '--port', '0'], {
        cwd: dirname(this.options.server), env: environment(this.options.environment ?? process.env),
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false,
      })
      run.child = child
      child.stderr?.resume()
      run.closed = new Promise((resolveClosed) => {
        child.once('close', () => {
          run.exited = true
          resolveClosed()
          this.unexpected(run, failure('child exited unexpectedly'))
        })
      })
      child.on('error', () => { this.unexpected(run, failure('child process failed')) })
      const announced = await this.announcement(run, child, home)
      run.abort.signal.throwIfAborted()
      const bridge = await readBridge(join(home, 'bridge.json'), child.pid)
      if (bridge.base_url !== announced.url) throw failure('announced URL does not match owned bridge')
      const lock = await readLock(join(home, 'server.lock'), child.pid)
      run.bridge = bridge
      run.lock = lock
      run.abort.signal.throwIfAborted()
      // The existing handler authenticates before rejecting {}, so this probe cannot run a document check.
      const response = await post(bridge, '/bridge/run', run.abort.signal)
      const body: unknown = JSON.parse(response.body)
      if (response.status !== 400 || typeof body !== 'object' || body === null || !('error' in body)
        || body.error !== '仅接受文档编号和规则编号。') throw failure('bridge readiness check failed')
      run.abort.signal.throwIfAborted()
      if (run.exited) throw failure('child exited during startup')
      run.ready = true
      return { url: bridge.base_url }
    } catch (error) {
      if (run.abort.signal.aborted) throw run.abort.signal.reason
      if (error instanceof ServiceError) throw error
      throw failure('startup failed')
    } finally {
      clearTimeout(timer)
    }
  }

  private announcement(run: Run, child: ChildProcess, home: string): Promise<QcuServiceReady> {
    return new Promise((resolveReady, reject) => {
      let buffered = Buffer.alloc(0)
      const cleanup = (): void => {
        child.stdout?.off('data', onData)
        child.stdout?.resume()
        run.abort.signal.removeEventListener('abort', onAbort)
      }
      const onAbort = (): void => { cleanup(); reject(run.abort.signal.reason as Error) }
      const onData = (chunk: Buffer): void => {
        buffered = Buffer.concat([buffered, chunk])
        const newline = buffered.indexOf(10)
        if (buffered.length > MAX_RECORD_BYTES || (newline >= 0 && newline !== buffered.length - 1)) {
          cleanup(); reject(failure('invalid readiness record')); return
        }
        if (newline < 0) return
        cleanup()
        try {
          const value: unknown = JSON.parse(buffered.toString('utf8'))
          if (typeof value !== 'object' || value === null || !('url' in value) || !origin(value.url)
            || !('bridge_path' in value) || value.bridge_path !== join(home, 'bridge.json')) {
            reject(failure('invalid readiness record')); return
          }
          resolveReady({ url: value.url })
        } catch (_error) {
          // Never include potentially credential-bearing child output in diagnostics.
          reject(failure('invalid readiness record'))
        }
      }
      child.stdout?.on('data', onData)
      run.abort.signal.addEventListener('abort', onAbort, { once: true })
      if (run.abort.signal.aborted) onAbort()
    })
  }

  private unexpected(run: Run, error: Error): void {
    if (run.stop !== undefined) return
    run.abort.abort(error)
    if (!run.ready || run.reported) return
    run.reported = true
    // Stop admission before notifying the shell; callbacks may synchronously call stop().
    void this.stopRun(run).catch((_teardownError: unknown) => { /* Ownership remains retained if termination fails. */ })
    try {
      this.options.onFailure?.(error)
    } catch (_callbackError) {
      // A shell observer cannot interrupt child teardown, and its error may contain credentials.
    }
  }

  private stopRun(run: Run): Promise<void> {
    if (run.stop !== undefined) return run.stop
    run.abort.abort(failure('startup cancelled'))
    run.stop = this.teardown(run).then(() => {
      if (this.run === run) this.run = undefined
    }, (error: unknown) => {
      run.stop = undefined
      throw error
    })
    return run.stop
  }

  private async teardown(run: Run): Promise<void> {
    // launch checks cancellation after asynchronous preflight and cannot spawn after this wait.
    await run.startup?.catch(() => undefined)
    const child = run.child
    if (child === undefined) return
    if (!run.exited && run.bridge !== undefined) {
      const controller = new AbortController()
      const expires = performance.now() + this.shutdownTimeout
      const timer = setTimeout(() => { controller.abort() }, this.shutdownTimeout)
      const shutdown = post(run.bridge, '/bridge/shutdown', controller.signal)
      try {
        await Promise.race([shutdown, run.closed])
        await exitsWithin(run.closed, expires - performance.now())
      } catch (_error) {
        // A failed authenticated shutdown falls back to signalling only this child.
      } finally {
        clearTimeout(timer)
        controller.abort()
        await shutdown.catch(() => undefined)
      }
    }
    for (const [signal, timeout] of [['SIGTERM', this.terminateTimeout], ['SIGKILL', this.killTimeout]] as const) {
      if (run.exited) break
      try {
        child.kill(signal)
      } catch (_error) {
        // Observe close even if signalling raced process exit; otherwise escalate and report failure.
      }
      await exitsWithin(run.closed, timeout)
    }
    if (!run.exited) throw failure('child termination did not reach quiescence')
    await this.removeOwnedResidue(run)
  }

  private async removeOwnedResidue(run: Run): Promise<void> {
    if (run.home === undefined) return
    const bridgePath = join(run.home, 'bridge.json')
    const lockPath = join(run.home, 'server.lock')
    try {
      const lock = await readLock(lockPath, run.child?.pid)
      if (run.lock !== undefined && !sameFile(run.lock, lock)) return
      let bridge: Bridge | undefined
      try {
        bridge = await readBridge(bridgePath, run.child?.pid)
      } catch (error) {
        if (!missing(error)) return
      }
      if (bridge !== undefined && run.bridge !== undefined
        && (bridge.token !== run.bridge.token || bridge.base_url !== run.bridge.base_url)) return
      // Recheck the lock after the bridge read. Only this confirmed-dead child's unchanged files are removed.
      if (!sameFile(lock, await readLock(lockPath, run.child?.pid))) return
      if (bridge !== undefined) await unlink(bridgePath)
      await unlink(lockPath)
    } catch (_error) {
      // Normal shutdown removes these files; incomplete, unreadable or replaced records remain for recovery.
    }
  }
}
