import { describe, expect, it, vi } from 'vitest'
import { qcuContextId } from '../src/native-contract.ts'
import { QcuNativeReferenceDispatcher, type QcuReferenceLease, type QcuReferenceNativeAdapter } from './support/native-adapter-reference.ts'
import type { QcuPrivateServiceBinding } from '../src/host/local-owner.ts'

const bounds = { x: 10, y: 20, width: 800, height: 600 }
const first = qcuContextId('first'), second = qcuContextId('second')
const origin = 'http://127.0.0.1:43819'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture(options: { nativeMissing?: boolean; serviceMissing?: boolean; version?: number } = {}) {
  const owner = {}, admission = { cleanupFailed: false }, revoked = new Set<() => void>()
  let serviceAvailable = true
  const service: QcuPrivateServiceBinding = {
    available: () => serviceAvailable,
    acquireNativeTarget: vi.fn(async () => ({ origin })),
    onRevoked: listener => { revoked.add(listener); return () => { revoked.delete(listener) } },
  }
  const native: QcuReferenceNativeAdapter = {
    protocolVersion: options.version ?? 1,
    available: vi.fn(() => true), open: vi.fn(async () => {}), setBounds: vi.fn(),
    back: vi.fn(async () => {}), close: vi.fn(async () => {}),
  }
  const dispatcher = new QcuNativeReferenceDispatcher({
    owner, admission, native: options.nativeMissing ? undefined : native, service: options.serviceMissing ? undefined : service,
  })
  return {
    owner, admission, service, native, dispatcher,
    dispatch: (operation: unknown, ...args: readonly unknown[]) => dispatcher.dispatch(owner, operation, ...args),
    revokeService() { serviceAvailable = false; for (const listener of [...revoked]) listener() },
  }
}

describe('synthetic fixed-QCU native admission', () => {
  it.each([{ nativeMissing: true }, { serviceMissing: true }, { version: 0 }, { version: 2 }])(
    'fails closed for a missing or incompatible native/service capability (%#)', async options => {
      const f = fixture(options)
      expect(await f.dispatch('available')).toBe(false)
      await expect(f.dispatch('open', first, bounds)).rejects.toThrow('QCU task is unavailable')
      expect(f.native.open).not.toHaveBeenCalled()
    },
  )

  it('does not expose origin, private data, or callback return values', async () => {
    const f = fixture()
    vi.mocked(f.native.open).mockResolvedValue({ origin, body: 'secret', filename: 'paper.docx', documentId: 'hidden' } as never)
    vi.mocked(f.native.back).mockResolvedValue({ body: 'secret' } as never)
    expect(await f.dispatch('available')).toBe(true)
    expect(await f.dispatch('open', first, bounds)).toBeUndefined()
    expect(await f.dispatch('back', first)).toBeUndefined()
    expect(await f.dispatch('setBounds', first, bounds)).toBeUndefined()
    expect(await f.dispatch('close', first)).toBeUndefined()
  })

  it('rejects foreign senders, including a foreign close of the active panel', async () => {
    const f = fixture()
    await f.dispatch('open', first, bounds)
    await expect(f.dispatcher.dispatch({}, 'close', first)).rejects.toThrow('QCU sender is not authorized')
    await expect(f.dispatcher.dispatch({}, 'available')).rejects.toThrow('QCU sender is not authorized')
    expect(f.native.close).not.toHaveBeenCalled()
  })

  it('treats native availability exceptions as unavailable without returning private errors', async () => {
    const f = fixture()
    vi.mocked(f.native.available).mockImplementation(() => { throw new Error('private endpoint') })
    expect(await f.dispatch('available')).toBe(false)
    await expect(f.dispatch('open', first, bounds)).rejects.toThrow(/^QCU task is unavailable$/u)
  })

  it('rejects extra operations and payloads before invoking any native operation', async () => {
    const f = fixture()
    await expect(f.dispatch('register', 'provider')).rejects.toThrow('Invalid QCU request')
    await expect(f.dispatch('open', first, { ...bounds, url: '/task' })).rejects.toThrow('Invalid QCU bounds')
    await expect(f.dispatch('open', first, bounds, { command: 'run' })).rejects.toThrow('Invalid QCU request')
    expect(f.native.open).not.toHaveBeenCalled()
    expect(f.service.acquireNativeTarget).not.toHaveBeenCalled()
  })

  it('joins a duplicate active open and cannot reopen a retired occurrence', async () => {
    const f = fixture()
    await f.dispatch('open', first, bounds)
    await f.dispatch('open', first, { ...bounds, width: 700 })
    expect(f.native.open).toHaveBeenCalledTimes(1)
    expect(f.native.setBounds).toHaveBeenCalledWith(first, { ...bounds, width: 700 })
    await f.dispatch('open', second, bounds)
    await expect(f.dispatch('open', first, bounds)).rejects.toThrow('QCU context is retired')
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
  })

  it('ignores stale bounds/back/close without retiring the newer context', async () => {
    const f = fixture()
    await f.dispatch('open', first, bounds)
    await f.dispatch('open', second, bounds)
    await f.dispatch('setBounds', first, { ...bounds, width: 1 })
    await f.dispatch('back', first)
    await f.dispatch('close', first)
    expect(f.native.setBounds).not.toHaveBeenCalled()
    expect(f.native.back).not.toHaveBeenCalled()
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
    await f.dispatch('back', second)
    expect(f.native.back).toHaveBeenCalledExactlyOnceWith(second)
  })

  it('tombstones close-before-open and rejected disabled opens', async () => {
    const f = fixture()
    await f.dispatch('close', first)
    await expect(f.dispatch('open', first, bounds)).rejects.toThrow('QCU context is retired')
    await f.dispatcher.setEnabled(false)
    expect(await f.dispatch('available')).toBe(false)
    await expect(f.dispatch('open', second, bounds)).rejects.toThrow('QCU task is unavailable')
    await f.dispatcher.setEnabled(true)
    await expect(f.dispatch('open', second, bounds)).rejects.toThrow('QCU context is retired')
    expect(f.native.open).not.toHaveBeenCalled()
  })

  it.each(['close', 'disable', 'unbind', 'service-loss', 'dispose'])('revokes pending service readiness before %s teardown awaits', async operation => {
    const f = fixture(), target = deferred<{ origin: string }>()
    vi.mocked(f.service.acquireNativeTarget).mockReturnValue(target.promise)
    const opening = f.dispatch('open', first, bounds)
    await vi.waitFor(() => expect(f.service.acquireNativeTarget).toHaveBeenCalledTimes(1))
    if (operation === 'close') await f.dispatch('close', first)
    if (operation === 'disable') await f.dispatcher.setEnabled(false)
    if (operation === 'unbind') await f.dispatcher.unbindService()
    if (operation === 'service-loss') f.revokeService()
    if (operation === 'dispose') await f.dispatcher.dispose()
    target.resolve({ origin })
    await opening
    expect(f.native.open).not.toHaveBeenCalled()
    expect(f.native.close).not.toHaveBeenCalled()
  })

  it('aborts an in-progress native lease synchronously without waiting for open', async () => {
    const f = fixture(), load = deferred<void>(), cleanup = deferred<void>()
    let lease: QcuReferenceLease | undefined, lateViewCreated = false
    vi.mocked(f.native.open).mockImplementation(async (_context, _bounds, _origin, value) => {
      lease = value
      await load.promise
      if (value.current()) lateViewCreated = true
    })
    vi.mocked(f.native.close).mockReturnValue(cleanup.promise)
    const opening = f.dispatch('open', first, bounds)
    await vi.waitFor(() => expect(lease).toBeDefined())
    const closing = f.dispatcher.dispose()
    expect(lease!.signal.aborted).toBe(true)
    expect(lease!.current()).toBe(false)
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
    load.resolve()
    await opening
    expect(lateViewCreated).toBe(false)
    cleanup.resolve()
    await closing
  })

  it.each(['disable', 'unbind', 'service-loss', 'dispose'])('revokes an already opened native lease through trusted %s authority', async operation => {
    const f = fixture(), cleanup = deferred<void>()
    await f.dispatch('open', first, bounds)
    const lease = vi.mocked(f.native.open).mock.calls[0]![3]
    vi.mocked(f.native.close).mockReturnValue(cleanup.promise)
    let pending: Promise<void> | undefined
    if (operation === 'disable') pending = f.dispatcher.setEnabled(false)
    if (operation === 'unbind') pending = f.dispatcher.unbindService()
    if (operation === 'service-loss') f.revokeService()
    if (operation === 'dispose') pending = f.dispatcher.dispose()
    expect(lease.signal.aborted).toBe(true)
    expect(lease.current()).toBe(false)
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
    expect(await f.dispatch('available')).toBe(false)
    cleanup.resolve()
    await pending
  })

  it('waits for old private cleanup before creating the replacement panel', async () => {
    const f = fixture(), cleanup = deferred<void>()
    await f.dispatch('open', first, bounds)
    vi.mocked(f.native.close).mockReturnValue(cleanup.promise)
    const next = f.dispatch('open', second, bounds)
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
    await Promise.resolve()
    expect(f.native.open).toHaveBeenCalledTimes(1)
    cleanup.resolve()
    await next
    expect(f.native.open).toHaveBeenCalledTimes(2)
  })

  it('permanently closes shared process admission after cleanup failure', async () => {
    const f = fixture()
    await f.dispatch('open', first, bounds)
    vi.mocked(f.native.close).mockRejectedValue(new Error('private cleanup path'))
    await expect(f.dispatch('close', first)).rejects.toThrow('QCU task session cleanup failed')
    expect(f.admission.cleanupFailed).toBe(true)
    expect(await f.dispatch('available')).toBe(false)
    await expect(f.dispatch('open', second, bounds)).rejects.toThrow('QCU task is unavailable')
    const replacement = new QcuNativeReferenceDispatcher({ owner: f.owner, admission: f.admission, native: f.native, service: f.service })
    expect(await replacement.dispatch(f.owner, 'available')).toBe(false)
  })

  it('sanitizes native operation failures', async () => {
    const f = fixture()
    vi.mocked(f.native.open).mockRejectedValue(new Error('file /tmp/private.docx token=secret'))
    await expect(f.dispatch('open', first, bounds)).rejects.toThrow(/^QCU task could not be opened$/u)
    expect(f.native.close).toHaveBeenCalledExactlyOnceWith(first)
  })

  it.each(['https://127.0.0.1:43819', 'http://localhost:43819', 'http://127.0.0.1:65536',
    `${origin}/task`, `${origin}?secret=value`, `http://user:pass@127.0.0.1:43819`, 'https://example.com']) (
    'rejects a private binding that returns a nonexact loopback target (%#)', async invalid => {
      const f = fixture()
      vi.mocked(f.service.acquireNativeTarget).mockResolvedValue({ origin: invalid })
      await expect(f.dispatch('open', first, bounds)).rejects.toThrow(/^QCU task could not be opened$/u)
      expect(f.native.open).not.toHaveBeenCalled()
    },
  )
})
