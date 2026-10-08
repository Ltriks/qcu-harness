/** Optional dedicated CSV carrier; no Operator, Session or generic RPC access. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WebSocketServer, WebSocket } from 'ws'
import type { CsvTaskOwner, TaskConfig, TaskExecute } from './task-owner.ts'
import { dispatch, exact } from './task-dispatch.ts'
import { TASK_ERROR, TASK_WS_PATH, TASK_WS_PROTOCOL } from './task-protocol.ts'
import type { OpenedPage } from './task-protocol.ts'

export function registerTaskSocket(ctx: Context, config: Omit<TaskConfig, 'demoRules'>, owner: CsvTaskOwner,
  execute: TaskExecute, lifetime: AbortSignal): { stop(): void; release(): Promise<void> } {
  const server = ctx.get('webServer')
  if (!server || server.host !== '127.0.0.1') throw new Error(TASK_ERROR)
  const maxPayload = Math.ceil(config.maxInputBytes / 3) * 4 + config.maxRuleBytes * 6 + 4096
  const wss = new WebSocketServer({ noServer: true, maxPayload, perMessageDeflate: false,
    handleProtocols: protocols => protocols.has(TASK_WS_PROTOCOL) ? TASK_WS_PROTOCOL : false })
  const clients = new Map<WebSocket, () => Promise<void>>()
  const cleanups = new Set<Promise<void>>()
  let stopped = false
  const track = (work: Promise<void>): void => {
    cleanups.add(work)
    // Owner retains failed cleanup for the root HTTP recovery route.
    void work.catch(() => {}).finally(() => { cleanups.delete(work) })
  }
  const unregister = server.registerUpgrade({ path: TASK_WS_PATH, handler: (request, socket, head) => {
    const reject = (status: number): void => {
      socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
      const deadline = setTimeout(() => socket.destroy(), 250); deadline.unref?.()
      socket.once('close', () => clearTimeout(deadline))
    }
    const origin = request.headers.origin
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (stopped || lifetime.aborted || owner.stopped) return reject(503)
    if (request.method !== 'GET' || url.pathname !== TASK_WS_PATH || url.search
      || typeof origin !== 'string' || !URL.canParse(origin)) return reject(403)
    const browser = new URL(origin)
    if (!['http:', 'https:'].includes(browser.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(browser.hostname)
      || browser.origin !== origin || browser.host !== request.headers.host
      || Number(browser.port || (browser.protocol === 'https:' ? 443 : 80)) !== server.port
      || request.headers['sec-websocket-protocol'] !== TASK_WS_PROTOCOL
      || ctx.connection.requestRejection(request) !== undefined) return reject(403)
    if (wss.clients.size >= config.maxPages) return reject(503)
    wss.handleUpgrade(request, socket, head, ws => {
      ws.on('error', () => { ws.terminate() })
      const binding = Object.freeze({})
      let page: OpenedPage | undefined
      try { page = owner.open(binding) } catch (_error) { ws.terminate(); return }
      let opened = false; let lastId = 0; let frames = 0; let closed = false
      const pending = new Map<number, AbortController>()
      const teardown = (): Promise<void> => {
        if (closed) return Promise.resolve()
        closed = true; clearTimeout(timer); clearInterval(authTimer)
        for (const abort of pending.values()) abort.abort()
        const key = page?.page; page = undefined
        const work = (key ? owner.disconnect(key, binding) : Promise.resolve())
          .finally(() => { clients.delete(ws) })
        track(work); return work
      }
      const timer = setTimeout(() => { track(teardown()); ws.terminate() }, config.grantMs)
      timer.unref?.()
      clients.set(ws, teardown)
      const drop = (code: number): void => {
        track(teardown()); ws.close(code)
        const deadline = setTimeout(() => ws.terminate(), 250); deadline.unref?.()
        ws.once('close', () => clearTimeout(deadline))
      }
      const authenticated = (): boolean => {
        try { return ctx.connection.requestRejection(request) === undefined } catch (_error) { return false }
      }
      // The handshake cookie is reverified through the current official service:
      // task TTL is never a substitute for browser authentication lifetime.
      const authTimer = setInterval(() => { if (!closed && !authenticated()) drop(1008) }, 1000)
      authTimer.unref?.()
      ws.on('error', () => { track(teardown()); ws.terminate() })
      ws.on('close', () => { track(teardown()) })
      const send = (value: unknown): void => {
        if (closed || ws.readyState !== WebSocket.OPEN) return
        if (!authenticated()) { drop(1008); return }
        if (ws.bufferedAmount > 8192) { drop(1013); return }
        ws.send(JSON.stringify(value), error => { if (error) { track(teardown()); ws.terminate() } })
      }
      ws.on('message', (bytes, binary) => {
        if (closed) return
        if (!authenticated()) { drop(1008); return }
        if (binary || ++frames > 256) { drop(1008); return }
        let frame: Record<string, unknown>
        try {
          const parsed: unknown = JSON.parse(bytes.toString())
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(TASK_ERROR)
          frame = parsed as Record<string, unknown>
          if (frame.abort !== undefined) {
            exact(frame, ['abort'])
            if (!Number.isSafeInteger(frame.abort) || !pending.has(Number(frame.abort))) throw new Error(TASK_ERROR)
            pending.get(Number(frame.abort))!.abort(); return
          }
          exact(frame, frame.page === undefined ? ['id', 'value'] : ['id', 'page', 'value'])
          if (!Number.isSafeInteger(frame.id) || Number(frame.id) <= lastId
            || !frame.value || typeof frame.value !== 'object' || Array.isArray(frame.value)) throw new Error(TASK_ERROR)
          if (pending.size >= 2) { drop(1013); return }
          lastId = Number(frame.id)
        } catch (_error) { drop(1008); return }
        const id = Number(frame.id); const abort = new AbortController(); pending.set(id, abort)
        const value = frame.value as Record<string, unknown>
        const run = async (): Promise<unknown> => {
          if (value.operation === 'open') {
            exact(value, ['operation'])
            if (frame.page !== undefined || opened) throw new Error(TASK_ERROR)
            if (!page) page = owner.open(binding)
            opened = true; return page
          }
          if (value.operation === 'recover') {
            exact(value, ['operation'])
            if (frame.page !== undefined || opened) throw new Error(TASK_ERROR)
            await owner.recover(); return { recovered: true }
          }
          if (!opened || !page || frame.page !== page.page) throw new Error(TASK_ERROR)
          const result = await dispatch(owner, value, page.page, AbortSignal.any([abort.signal, lifetime]), execute, binding)
          if (value.operation === 'close' || value.operation === 'retry') { page = undefined; opened = false }
          return result
        }
        void run().then(result => {
          if (!abort.signal.aborted) send({ id, ok: true, value: result })
          else send({ id, ok: false, error: TASK_ERROR })
        }, () => { send({ id, ok: false, error: TASK_ERROR }) }).finally(() => { pending.delete(id) })
      })
    })
  } })
  return {
    stop() {
      stopped = true
      for (const [ws, teardown] of clients) { track(teardown()); ws.terminate() }
    },
    async release() {
      unregister()
      for (const ws of wss.clients) ws.terminate()
      await Promise.allSettled([...cleanups])
      await new Promise<void>(resolve => { wss.close(() => { resolve() }) })
    },
  }
}
