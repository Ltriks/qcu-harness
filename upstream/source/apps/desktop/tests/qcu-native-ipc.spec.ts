import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron'
import { installQcuNativeIpc } from '../src/qcu-native-ipc.ts'
import { QCU_NATIVE_IPC } from '../src/qcu-native-contract.ts'

function fixture() {
  const frame = { url: 'dsh-app://app/' } as WebFrameMain
  const sender = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: () => false }) as WebContents
  const owner = Object.assign(new EventEmitter(), { webContents: sender, isDestroyed: () => false }) as BrowserWindow
  let current: BrowserWindow | undefined = owner
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'> = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    removeHandler: (channel) => { handlers.delete(channel) },
  }
  const panel = {
    available: vi.fn(() => true), open: vi.fn(async () => {}), setBounds: vi.fn(() => {}),
    close: vi.fn(async () => {}), back: vi.fn(async () => {}),
  }
  const dispose = installQcuNativeIpc({ ipcMain, owner: () => current, panel })
  const invoke = (operation: keyof typeof QCU_NATIVE_IPC, args: readonly unknown[] = [],
    overrides: Partial<IpcMainInvokeEvent> = {}) => {
    const event = { sender, senderFrame: frame, ...overrides } as IpcMainInvokeEvent
    return Promise.resolve(handlers.get(QCU_NATIVE_IPC[operation])!(event, ...args))
  }
  return { frame, sender, owner, panel, handlers, invoke, dispose, setOwner(value: BrowserWindow | undefined) { current = value } }
}
const bounds = { x: 1, y: 2, width: 3, height: 4 }

describe('fixed QCU native IPC', () => {
  it('registers exactly the v1 channels and sends only current owner plus validated arguments', async () => {
    const f = fixture()
    expect([...f.handlers.keys()]).toEqual(Object.values(QCU_NATIVE_IPC))
    expect(await f.invoke('available')).toBe(true)
    expect(await f.invoke('open', ['opaque', bounds])).toBeUndefined()
    expect(f.panel.open).toHaveBeenCalledExactlyOnceWith(f.owner, 'opaque', bounds)
    expect(await f.invoke('setBounds', ['opaque', bounds])).toBeUndefined()
    expect(f.panel.setBounds).toHaveBeenCalledExactlyOnceWith(f.owner, 'opaque', bounds)
    expect(await f.invoke('close', ['opaque'])).toBeUndefined()
    expect(f.panel.close).toHaveBeenCalledExactlyOnceWith(f.owner, 'opaque')
    expect(await f.invoke('back', ['opaque'])).toBeUndefined()
    expect(f.panel.back).toHaveBeenCalledExactlyOnceWith(f.owner, 'opaque')
    f.dispose()
    expect(f.handlers.size).toBe(0)
  })

  it('rejects foreign windows, same-URL subframes, missing frames, and replaced owners before dispatch', async () => {
    const f = fixture(), other = fixture()
    for (const overrides of [
      { sender: other.sender }, { senderFrame: other.frame }, { senderFrame: null },
    ]) await expect(f.invoke('available', [], overrides)).rejects.toThrow('QCU sender is not authorized')
    f.setOwner(other.owner)
    await expect(f.invoke('available')).rejects.toThrow('QCU sender is not authorized')
    f.setOwner(undefined)
    await expect(f.invoke('open', ['opaque', bounds])).rejects.toThrow('QCU sender is not authorized')
    expect(f.panel.available).not.toHaveBeenCalled()
    expect(f.panel.open).not.toHaveBeenCalled()
  })

  it.each([
    'https://example.com/', 'dsh-app://welcome/', 'dsh-app://app.evil/', 'dsh-app://app@evil/',
    'dsh-app://user@app/', 'dsh-app://app:80/', 'dsh-app://app/task', 'dsh-app://app/?target=http://127.0.0.1:1',
    'dsh-app://app//', 'dsh-app://app/../', 'dsh-app://APP/', 'garbage',
  ])('rejects an untrusted application document URL: %s', async (url) => {
    const f = fixture()
    Object.defineProperty(f.frame, 'url', { value: url })
    await expect(f.invoke('open', ['opaque', bounds])).rejects.toThrow('QCU sender is not authorized')
    expect(f.panel.open).not.toHaveBeenCalled()
  })

  it('allows app fragment navigation while keeping the top-frame object identity exact', async () => {
    const f = fixture()
    Object.defineProperty(f.frame, 'url', { value: 'dsh-app://app/#conversation' })
    expect(await f.invoke('available')).toBe(true)
  })

  it('rejects destroyed owner windows and renderers', async () => {
    const f = fixture()
    vi.spyOn(f.owner, 'isDestroyed').mockReturnValue(true)
    await expect(f.invoke('available')).rejects.toThrow('QCU sender is not authorized')
    vi.spyOn(f.owner, 'isDestroyed').mockReturnValue(false)
    vi.spyOn(f.sender, 'isDestroyed').mockReturnValue(true)
    await expect(f.invoke('available')).rejects.toThrow('QCU sender is not authorized')
  })

  it('validates exact argument counts, opaque occurrence syntax, and exact finite bounds', async () => {
    const f = fixture()
    for (const [operation, args] of [
      ['available', [1]], ['open', ['opaque']], ['open', ['opaque', bounds, 'private-target']],
      ['open', ['../report', bounds]], ['open', ['opaque', { ...bounds, url: 'http://127.0.0.1:1' }]],
      ['setBounds', ['opaque', { ...bounds, width: NaN }]], ['setBounds', ['opaque', bounds, 1]],
      ['close', []], ['close', ['opaque', 'second']], ['back', ['opaque', '/bridge/register']],
    ] as const) await expect(f.invoke(operation, args)).rejects.toThrow('Invalid QCU request')
    for (const method of Object.values(f.panel)) expect(method).not.toHaveBeenCalled()
  })

  it('never returns private callback values or exception messages to the application renderer', async () => {
    const f = fixture()
    // Electron callback stubs intentionally return unexpected values to test output omission.
    f.panel.open.mockImplementation(async () => { return 'private-origin-and-document' as never })
    expect(await f.invoke('open', ['opaque', bounds])).toBeUndefined()
    f.panel.available.mockImplementation(() => { return 'private-origin' as never })
    expect(await f.invoke('available')).toBe(false)
    for (const operation of ['available', 'open', 'setBounds', 'close', 'back'] as const) {
      f.panel[operation].mockImplementation(() => { throw new Error('private origin, filename and report body') })
      const args = operation === 'available' ? [] : operation === 'open' || operation === 'setBounds' ? ['opaque', bounds] : ['opaque']
      await expect(f.invoke(operation, args)).rejects.toThrow(/^QCU task operation failed$/u)
    }
  })
})
