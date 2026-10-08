/** Narrow browser carrier. The native stream hint selects an endpoint, never identity. */
import { TASK_ERROR, TASK_WS_PATH, TASK_WS_PROTOCOL } from '../task-protocol.ts'
import type { TaskTransport } from './controller.ts'

type SocketFactory = (url: string, protocol: string) => WebSocket
export function socketTransport(base: string, factory: SocketFactory = (url, protocol) => new WebSocket(url, protocol)): TaskTransport {
  const url = new URL(base)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(TASK_ERROR)
  const target = `ws://${url.host}${TASK_WS_PATH}`
  let socket: WebSocket | undefined; let connecting: Promise<WebSocket> | undefined
  let disposed = false; let sequence = 0
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; cleanup(): void }>()
  const failAll = (): void => {
    const old = socket; socket = undefined; connecting = undefined
    for (const value of pending.values()) { value.cleanup(); value.reject(new Error(TASK_ERROR)) }
    pending.clear(); old?.close()
  }
  const connect = (): Promise<WebSocket> => {
    if (disposed) return Promise.reject(new Error(TASK_ERROR))
    if (socket?.readyState === 1) return Promise.resolve(socket)
    if (connecting) return connecting
    connecting = new Promise((resolve, reject) => {
      const ws = factory(target, TASK_WS_PROTOCOL); socket = ws
      const timer = setTimeout(() => { failAll(); reject(new Error(TASK_ERROR)) }, 5000)
      ws.onopen = () => { clearTimeout(timer); connecting = undefined; resolve(ws) }
      ws.onerror = ws.onclose = () => {
        clearTimeout(timer)
        if (socket === ws) failAll()
        reject(new Error(TASK_ERROR))
      }
      ws.onmessage = event => {
        if (socket !== ws) return
        try {
          if (typeof event.data !== 'string' || event.data.length > 8192) throw new Error(TASK_ERROR)
          const value: unknown = JSON.parse(event.data)
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(TASK_ERROR)
          const reply = value as Record<string, unknown>
          const keys = Object.keys(reply).sort().join(',')
          if (!Number.isSafeInteger(reply.id) || typeof reply.ok !== 'boolean'
            || keys !== (reply.ok ? 'id,ok,value' : 'error,id,ok')) throw new Error(TASK_ERROR)
          const request = pending.get(Number(reply.id)); if (!request) throw new Error(TASK_ERROR)
          pending.delete(Number(reply.id)); request.cleanup()
          if (reply.ok) request.resolve(reply.value); else request.reject(new Error(TASK_ERROR))
        } catch (_error) { failAll() }
      }
    })
    return connecting
  }
  const api: TaskTransport = async (value, page, signal) => {
    if (signal?.aborted) throw new Error(TASK_ERROR)
    // Recovery gets a fresh carrier; a previous page/task can never migrate onto it.
    if (value.operation === 'recover') failAll()
    const ws = await connect()
    if (disposed || signal?.aborted || ws !== socket || pending.size >= 2 || sequence >= Number.MAX_SAFE_INTEGER) throw new Error(TASK_ERROR)
    const id = ++sequence
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        // Keep the entry until its bounded server response; it cannot become an unsolicited frame.
        reject(new Error(TASK_ERROR))
        try { ws.send(JSON.stringify({ abort: id })) } catch (_error) { failAll() }
      }
      const timer = setTimeout(() => { failAll() }, 15000)
      const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      pending.set(id, { resolve, reject, cleanup })
      signal?.addEventListener('abort', abort, { once: true })
      try { ws.send(JSON.stringify({ id, value, ...(page ? { page } : {}) })) } catch (_error) { failAll() }
    })
  }
  api.dispose = () => { disposed = true; failAll() }
  return api
}

export function nativeTaskTransport(): TaskTransport | undefined {
  const hooks = (globalThis as unknown as { __DSH_TRANSPORT__?: { streamBaseUrl?: unknown } }).__DSH_TRANSPORT__
  if (!hooks) return undefined
  // A native renderer must never fall back to Origin-less HTTP or a generic RPC bridge.
  if (typeof hooks.streamBaseUrl !== 'string') return Object.assign(async () => { throw new Error(TASK_ERROR) }, { dispose() {} })
  try { return socketTransport(hooks.streamBaseUrl) }
  catch (_error) { return Object.assign(async () => { throw new Error(TASK_ERROR) }, { dispose() {} }) }
}
