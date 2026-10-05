import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandlerDetails, SaveDialogOptions, WebContentsViewConstructorOptions } from 'electron'
import type { QcuTaskPanelController } from '../src/qcu-task-panel.ts'
import { qcuContextId, qcuBounds as qcuTaskBounds } from '../src/qcu-native-contract.ts'
let Panel: typeof QcuTaskPanelController
function createPanel(options: { ready: () => Promise<string>; onError?: (error: Error) => void }) {
  return new Panel({ available: () => true, acquireNativeTarget: async () => ({ origin: await options.ready() }) }, options.onError)
}

const native = vi.hoisted(() => ({
  create: vi.fn<(options: WebContentsViewConstructorOptions) => ReturnType<typeof fakeView>>(),
  partition: vi.fn<(name: string, options: { cache: boolean }) => ReturnType<typeof fakeSession>>(),
}))
vi.mock('electron', () => ({
  WebContentsView: vi.fn(function (options: WebContentsViewConstructorOptions) { return native.create(options) }),
  session: { fromPartition: native.partition },
}))
const origin = 'http://127.0.0.1:43819'
const report = `${origin}/reports/${'ab'.repeat(16)}`
const first = qcuContextId('first'), second = qcuContextId('second')
const bounds = { x: 100, y: 50, width: 900, height: 650 }
let nextId = 0
function fakeView() {
  let destroyed = false, url = ''
  const contents = Object.assign(new EventEmitter(), {
    id: ++nextId, mainFrame: {},
    setWindowOpenHandler: vi.fn<(handler: (details: HandlerDetails) => { action: string }) => void>(),
    getURL: vi.fn(() => url),
    isDestroyed: vi.fn(() => destroyed),
    loadURL: vi.fn(async (value: string) => { url = value }),
    print: vi.fn<(options: { silent: boolean; printBackground: boolean }, callback: (success: boolean, reason: string) => void) => void>(),
    close: vi.fn(() => { destroyed = true; contents.emit('destroyed') }),
  })
  return { webContents: contents, setVisible: vi.fn(), setBounds: vi.fn() }
}
interface RequestDetails { url: string; method: string; resourceType: string; webContentsId?: number; frame?: object | null | undefined }
function fakeSession() {
  return Object.assign(new EventEmitter(), {
    setProxy: vi.fn(async (_config: { mode: string }) => {}),
    setPermissionRequestHandler: vi.fn<(
      handler: (contents: unknown, permission: string, callback: (allowed: boolean) => void) => void,
    ) => void>(),
    setPermissionCheckHandler: vi.fn<(handler: () => boolean) => void>(),
    setDevicePermissionHandler: vi.fn<(handler: () => boolean) => void>(),
    setDisplayMediaRequestHandler: vi.fn<(handler: (request: unknown, callback: (streams: object) => void) => void) => void>(),
    webRequest: { onBeforeRequest: vi.fn<(
      handler: (details: RequestDetails, callback: (response: { cancel: boolean }) => void) => void,
    ) => void>(), onHeadersReceived: vi.fn<(
      handler: (details: { statusCode: number }, callback: (response: { cancel: boolean }) => void) => void,
    ) => void>() },
    closeAllConnections: vi.fn(async () => {}), clearStorageData: vi.fn(async () => {}),
    clearAuthCache: vi.fn(async () => {}), clearCache: vi.fn(async () => {}),
  })
}
function fakeOwner() {
  return Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { getZoomFactor: vi.fn(() => 1), isDestroyed: vi.fn(() => false) }),
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    getContentSize: vi.fn(() => [1000, 700]), isDestroyed: vi.fn(() => false),
  })
}
function fakeDownload(url = `${report}/download`) {
  return Object.assign(new EventEmitter(), {
    getURL: vi.fn(() => url), getURLChain: vi.fn(() => [url]), getMimeType: vi.fn(() => 'text/html'),
    setSaveDialogOptions: vi.fn<(options: SaveDialogOptions) => void>(), cancel: vi.fn(),
  })
}
const preventable = () => ({ preventDefault: vi.fn() })
let panel: QcuTaskPanelController
let owner: ReturnType<typeof fakeOwner>
let browserSession: ReturnType<typeof fakeSession>
let views: ReturnType<typeof fakeView>[]
beforeEach(async () => {
  vi.resetModules()
  Panel = (await import('../src/qcu-task-panel.ts')).QcuTaskPanelController
  nextId = 0; views = []; owner = fakeOwner(); browserSession = fakeSession()
  native.partition.mockReturnValue(browserSession)
  native.create.mockImplementation(() => { const view = fakeView(); views.push(view); return view })
  panel = createPanel({ ready: async () => origin })
})
afterEach(async () => { vi.useRealTimers(); await panel.dispose().catch(() => {}); vi.restoreAllMocks(); vi.clearAllMocks() })
function popup(view: ReturnType<typeof fakeView>, url: string, extra: Partial<HandlerDetails> = {}) {
  return view.webContents.setWindowOpenHandler.mock.calls[0]![0]({
    url, frameName: '', features: '', disposition: 'new-window', referrer: { url: origin, policy: 'no-referrer' }, ...extra,
  })
}
function cancelled(url: string, extras: Partial<RequestDetails> = {}) {
  const callback = vi.fn<(response: { cancel: boolean }) => void>()
  browserSession.webRequest.onBeforeRequest.mock.calls[0]![0]({
    url, method: 'GET', resourceType: 'xhr', webContentsId: views[0]!.webContents.id, frame: views[0]!.webContents.mainFrame, ...extras,
  }, callback)
  return callback.mock.calls[0]![0].cancel
}
function activate(view = views[0]!) {
  view.webContents.emit('before-mouse-event', preventable(), { type: 'mouseUp', button: 'left' })
}

describe('QCU task panel ownership', () => {
  it('embeds an unprivileged task view with fresh nonpersistent storage and no preload', async () => {
    await panel.open(owner, first, bounds)
    const view = views[0]!
    expect(owner.contentView.addChildView).toHaveBeenCalledExactlyOnceWith(view)
    expect(native.partition).toHaveBeenCalledWith(expect.stringMatching(/^qcu-task-[0-9a-f-]+$/u), { cache: false })
    const preferences = native.create.mock.calls[0]![0].webPreferences!
    expect(preferences).toEqual({ session: browserSession, nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true, webviewTag: false, devTools: false, spellcheck: false, navigateOnDragDrop: false })
    expect(browserSession.setProxy).toHaveBeenCalledExactlyOnceWith({ mode: 'direct' })
    expect(view.webContents.loadURL).toHaveBeenCalledExactlyOnceWith(`${origin}/task`)
    expect(view.setVisible.mock.calls).toEqual([[false], [true]])
    expect(view.setBounds).toHaveBeenCalledWith(bounds)
  })

  it('joins identical opens through readiness and loading, and preserves an already open report', async () => {
    const ready = Promise.withResolvers<string>(), loaded = Promise.withResolvers<undefined>()
    const view = fakeView(); native.create.mockImplementation(() => { views.push(view); return view })
    view.webContents.loadURL.mockReturnValueOnce(loaded.promise)
    panel = createPanel({ ready: () => ready.promise })
    const pending = panel.open(owner, first, bounds)
    expect(panel.open(owner, first, bounds)).toBe(pending)
    ready.resolve(origin)
    await vi.waitFor(() => { expect(view.webContents.loadURL).toHaveBeenCalledOnce() })
    expect(panel.open(owner, first, bounds)).toBe(pending)
    expect(view.setVisible).not.toHaveBeenCalledWith(true)
    loaded.resolve(undefined); await pending
    popup(view, report); await Promise.resolve()
    await panel.open(owner, first, bounds)
    expect(view.webContents.loadURL.mock.calls.map(([url]) => url)).toEqual([`${origin}/task`, report])
    expect(native.create).toHaveBeenCalledOnce()
  })

  it('clamps to content area, follows resize, and ignores old bounds and close after context replacement', async () => {
    await panel.open(owner, first, bounds)
    await panel.open(owner, second, { x: -20, y: -50, width: 2000, height: 2000 })
    const view = views[1]!
    expect(views[0]!.webContents.close).toHaveBeenCalledExactlyOnceWith({ waitForBeforeUnload: false })
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 1000, height: 700 })
    panel.setBounds(owner, first, { x: 0, y: 0, width: 0, height: 0 }); await panel.close(owner, first); await panel.back(owner, first)
    expect(view.webContents.close).not.toHaveBeenCalled()
    expect(view.webContents.loadURL).toHaveBeenCalledOnce()
    owner.getContentSize.mockReturnValue([600, 400]); owner.emit('resize')
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 600, height: 400 })
    panel.setBounds(owner, second, { x: 700, y: 500, width: 100, height: 100 })
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 600, y: 400, width: 0, height: 0 })
    expect(new Set(native.partition.mock.calls.map(([name]) => name)).size).toBe(2)
  })

  it('keeps same-document owner navigation but destroys the view and private data on owner crash', async () => {
    await panel.open(owner, first, bounds)
    owner.webContents.emit('did-start-navigation', {}, 'dsh-app://app/#same', true, true)
    owner.webContents.emit('did-start-navigation', {}, 'dsh-app://app/frame', false, false)
    expect(views[0]!.webContents.close).not.toHaveBeenCalled()
    owner.webContents.emit('render-process-gone')
    expect(views[0]!.webContents.close).toHaveBeenCalledOnce()
    await panel.dispose()
    expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
    expect(owner.listenerCount('resize')).toBe(0)
  })

  it('cleans a closed owner even when isDestroyed is already true', async () => {
    await panel.open(owner, first, bounds)
    owner.isDestroyed.mockReturnValue(true); owner.emit('closed')
    await panel.dispose()
    expect(views[0]!.webContents.close).toHaveBeenCalledOnce()
    expect(owner.contentView.removeChildView).not.toHaveBeenCalled()
    expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
  })

  it.each([null, '', 2, 'x'.repeat(257), {}])('rejects invalid IPC contexts: %s', (value) => {
    expect(() => qcuContextId(value)).toThrow('Invalid QCU context')
  })
  it('validates only opaque ID length and finite rectangle coordinates', () => {
    expect(qcuContextId('x'.repeat(256))).toHaveLength(256)
    expect(qcuTaskBounds({ x: -1.2, y: 3.8, width: 8.3, height: 9.9 })).toEqual({ x: -1.2, y: 3.8, width: 8.3, height: 9.9 })
    for (const value of [null, {}, { ...bounds, width: -1 }, { ...bounds, height: NaN },
      { ...bounds, x: Infinity }, { ...bounds, y: 100001 }]) {
      expect(() => qcuTaskBounds(value)).toThrow('Invalid QCU bounds')
    }
  })
})

describe('QCU task route confinement', () => {
  it('admits only task assets, read-only rules, task APIs and exact reports from the owned view', async () => {
    await panel.open(owner, first, bounds)
    for (const path of ['/task', '/task-panel.js', '/task-panel.css', '/api/rules', `/reports/${'ab'.repeat(16)}`, `/reports/${'ab'.repeat(16)}/download`]) {
      expect(cancelled(`${origin}${path}`)).toBe(false)
    }
    for (const path of ['/api/task/upload', '/api/task/run']) expect(cancelled(`${origin}${path}`, { method: 'POST' })).toBe(false)
    for (const url of [`${origin}/`, `${origin}/app.js`, `${origin}/api/task/run`, `${origin}/bridge/register`,
      `${origin}/task?x=1`, `${origin}/task#x`, `${origin}/task/../task`, `${origin}/reports/${'AB'.repeat(16)}`,
      'http://localhost:43819/task', 'http://127.0.0.1:43820/task', 'https://example.com/', 'file:///tmp/file', 'data:text/html,hello']) {
      expect(cancelled(url)).toBe(true)
    }
    for (const route of ['/api/upload', '/api/run', '/api/rules', '/task', '/bridge/register']) {
      expect(cancelled(`${origin}${route}`, { method: 'POST' })).toBe(true)
    }
    expect(cancelled(`${origin}/api/task/run`, { method: 'DELETE' })).toBe(true)
    expect(cancelled(`${origin}/task`, { resourceType: 'subFrame' })).toBe(true)
    expect(cancelled(`${origin}/task`, { webContentsId: 99999 })).toBe(true)
    await panel.close(owner, first)
    expect(cancelled(`${origin}/task`)).toBe(true)
  })

  it('denies permissions, auth, redirects, subframes and webviews', async () => {
    await panel.open(owner, first, bounds)
    const permission = vi.fn(), streams = vi.fn(), auth = vi.fn()
    browserSession.setPermissionRequestHandler.mock.calls[0]![0]({}, 'media', permission)
    expect(permission).toHaveBeenCalledWith(false)
    expect(browserSession.setPermissionCheckHandler.mock.calls[0]![0]()).toBe(false)
    expect(browserSession.setDevicePermissionHandler.mock.calls[0]![0]()).toBe(false)
    browserSession.setDisplayMediaRequestHandler.mock.calls[0]![0]({}, streams)
    expect(streams).toHaveBeenCalledWith({})
    const contents = views[0]!.webContents
    for (const eventName of ['will-redirect', 'will-attach-webview']) {
      const event = preventable(); contents.emit(eventName, event); expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    for (const [url, isMainFrame] of [[`${origin}/task`, false], ['https://example.com/', true]] as const) {
      const event = { ...preventable(), url, isMainFrame }; contents.emit('will-frame-navigate', event)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    const event = preventable(); contents.emit('login', event, {}, {}, auth)
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(auth).toHaveBeenCalledWith()
  })

  it('routes local target-blank reports in-place and returns to task without API calls or new views', async () => {
    await panel.open(owner, first, bounds)
    const view = views[0]!
    expect(popup(view, report)).toEqual({ action: 'deny' })
    await Promise.resolve()
    expect(view.webContents.loadURL).toHaveBeenLastCalledWith(report)
    await panel.back(owner, first)
    expect(view.webContents.loadURL).toHaveBeenLastCalledWith(`${origin}/task`)
    await panel.back(owner, first)
    expect(view.webContents.loadURL).toHaveBeenCalledTimes(3)
    for (const url of ['https://example.com/', 'file:///tmp/a', `${origin}/`, `${report}/download`, `${report}?token=secret`]) popup(view, url)
    popup(view, report, { postBody: { data: [], contentType: 'text/plain', boundary: '' } })
    expect(view.webContents.loadURL).toHaveBeenCalledTimes(3)
    expect(native.create).toHaveBeenCalledOnce()
    const denied = preventable(); view.webContents.emit('will-navigate', denied, `${origin}/api/rules`)
    expect(denied.preventDefault).toHaveBeenCalledOnce()
    const allowed = preventable(); view.webContents.emit('will-navigate', allowed, report)
    expect(allowed.preventDefault).not.toHaveBeenCalled()
  })

  it.each(['http://localhost:43819', 'http://127.0.0.1:0', 'http://127.0.0.1:65536', `${origin}/task`, `${origin}/?secret=x`, 'file:///tmp/a'])('rejects non-owned service readiness: %s', async (url) => {
    panel = createPanel({ ready: async () => url })
    await expect(panel.open(owner, first, bounds)).rejects.toThrow('QCU task could not be opened')
    expect(native.partition).not.toHaveBeenCalled()
  })
})

describe('QCU report save dialogs', () => {
  it('requires recent native user input and a fresh confirmation destination for a single exact HTML download', async () => {
    await panel.open(owner, first, bounds)
    popup(views[0]!, report); await Promise.resolve()
    const contents = views[0]!.webContents, automatic = preventable()
    browserSession.emit('will-download', automatic, fakeDownload(), contents)
    expect(automatic.preventDefault).toHaveBeenCalledOnce()
    activate()
    const item = fakeDownload(), event = preventable()
    browserSession.emit('will-download', event, item, contents)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(item.setSaveDialogOptions).toHaveBeenCalledExactlyOnceWith({ defaultPath: 'qcu-thesis-report.html', filters: [{ name: 'HTML', extensions: ['html'] }] })
    const repeat = preventable(); browserSession.emit('will-download', repeat, fakeDownload(), contents)
    expect(repeat.preventDefault).toHaveBeenCalledOnce()
    await panel.close(owner, first)
    expect(item.cancel).toHaveBeenCalledOnce()
  })

  it('rejects foreign, redirected, non-HTML and expired-input downloads', async () => {
    await panel.open(owner, first, bounds)
    popup(views[0]!, report); await Promise.resolve()
    const redirected = fakeDownload(); redirected.getURLChain.mockReturnValue([`${origin}/task`, `${report}/download`])
    const binary = fakeDownload(); binary.getMimeType.mockReturnValue('application/octet-stream')
    for (const item of [redirected, binary, fakeDownload(report), fakeDownload(`${report}/download?x=1`), fakeDownload('file:///tmp/a')]) {
      activate(); const event = preventable(); browserSession.emit('will-download', event, item, views[0]!.webContents)
      expect(event.preventDefault).toHaveBeenCalledOnce(); expect(item.setSaveDialogOptions).not.toHaveBeenCalled()
    }
    activate(); const foreign = preventable(); browserSession.emit('will-download', foreign, fakeDownload(), fakeView().webContents)
    expect(foreign.preventDefault).toHaveBeenCalledOnce()
    vi.spyOn(Date, 'now').mockReturnValue(100); activate(); vi.spyOn(Date, 'now').mockReturnValue(1700)
    const expired = preventable(); browserSession.emit('will-download', expired, fakeDownload(), views[0]!.webContents)
    expect(expired.preventDefault).toHaveBeenCalledOnce()
  })

  it('sanitizes download and report-load failures and suppresses completions after close', async () => {
    const onError = vi.fn<(error: Error) => void>(); panel = createPanel({ ready: async () => origin, onError })
    await panel.open(owner, first, bounds)
    views[0]!.webContents.loadURL.mockRejectedValueOnce(new Error('private report text and URL'))
    popup(views[0]!, report)
    await vi.waitFor(() => { expect(onError).toHaveBeenCalledOnce() })
    expect(onError.mock.calls[0]![0].message).toBe('QCU report could not be opened')
    await panel.back(owner, first)
    popup(views[0]!, report); await Promise.resolve()
    activate(); const item = fakeDownload(); browserSession.emit('will-download', preventable(), item, views[0]!.webContents)
    item.emit('done', {}, 'interrupted')
    expect(onError.mock.calls[1]![0].message).toBe('QCU report download failed')
    activate(); const late = fakeDownload(); browserSession.emit('will-download', preventable(), late, views[0]!.webContents)
    await panel.close(owner, first); late.emit('done', {}, 'interrupted')
    expect(onError).toHaveBeenCalledTimes(2)
  })
})

describe('QCU task cancellation and teardown races', () => {
  it.each(['close', 'navigate', 'crash', 'stop'] as const)('invalidates pending service readiness before %s and ignores its late result', async (action) => {
    const ready = Promise.withResolvers<string>(); panel = createPanel({ ready: () => ready.promise })
    const pending = panel.open(owner, first, bounds)
    if (action === 'close') await panel.close(owner, first)
    if (action === 'navigate') owner.webContents.emit('did-start-navigation', {}, 'dsh-app://app/', false, true)
    if (action === 'crash') owner.webContents.emit('render-process-gone')
    if (action === 'stop') await panel.dispose()
    ready.resolve(origin); await pending
    expect(native.create).not.toHaveBeenCalled(); expect(native.partition).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('cleans a pending proxy setup and suppresses its late %s', async (outcome) => {
    const proxy = Promise.withResolvers<undefined>(); browserSession.setProxy.mockReturnValue(proxy.promise)
    const pending = panel.open(owner, first, bounds)
    await vi.waitFor(() => { expect(browserSession.setProxy).toHaveBeenCalledOnce() })
    await panel.close(owner, first)
    if (outcome === 'resolve') proxy.resolve(undefined)
    else proxy.reject(new Error('private failure'))
    await pending
    expect(native.create).not.toHaveBeenCalled(); expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
  })

  it('replaces a pending open immediately and refuses old bounds/close without affecting the replacement', async () => {
    const ready = Promise.withResolvers<string>(); const getReady = vi.fn().mockReturnValueOnce(ready.promise).mockResolvedValue(origin)
    panel = createPanel({ ready: getReady })
    const pending = panel.open(owner, first, bounds)
    await vi.waitFor(() => { expect(getReady).toHaveBeenCalledOnce() })
    await panel.open(owner, second, bounds)
    await panel.close(owner, first); panel.setBounds(owner, first, { x: 0, y: 0, width: 0, height: 0 })
    ready.reject(new Error('old backend')); await pending
    expect(native.create).toHaveBeenCalledOnce(); expect(views[0]!.webContents.close).not.toHaveBeenCalled()
    expect(views[0]!.setBounds).toHaveBeenLastCalledWith(bounds)
  })

  it.each(['resolve', 'reject'] as const)('destroys a loading document before its late %s', async (outcome) => {
    const loaded = Promise.withResolvers<undefined>(), view = fakeView()
    view.webContents.loadURL.mockReturnValue(loaded.promise); native.create.mockReturnValue(view)
    const pending = panel.open(owner, first, bounds)
    await vi.waitFor(() => { expect(view.webContents.loadURL).toHaveBeenCalledOnce() })
    await panel.close(owner, first)
    if (outcome === 'resolve') loaded.resolve(undefined)
    else loaded.reject(new Error('private load error'))
    await pending
    expect(view.webContents.close).toHaveBeenCalledOnce(); expect(view.setVisible).not.toHaveBeenCalledWith(true)
  })

  it('awaits renderer destruction and all private cleanup even when one cleanup operation fails', async () => {
    await panel.open(owner, first, bounds)
    const contents = views[0]!.webContents, storage = Promise.withResolvers<undefined>()
    contents.close.mockImplementation(() => {})
    browserSession.closeAllConnections.mockRejectedValue(new Error('private transport error'))
    browserSession.clearStorageData.mockReturnValue(storage.promise)
    const pending = panel.dispose(); expect(panel.dispose()).toBe(pending)
    expect(cancelled(`${origin}/task`)).toBe(true)
    expect(browserSession.closeAllConnections).not.toHaveBeenCalled()
    contents.emit('destroyed')
    await vi.waitFor(() => { expect(browserSession.clearStorageData).toHaveBeenCalledOnce() })
    expect(browserSession.clearAuthCache).toHaveBeenCalledOnce(); expect(browserSession.clearCache).toHaveBeenCalledOnce()
    storage.resolve(undefined)
    await expect(pending).rejects.toThrow('QCU task session cleanup failed')
    await expect(panel.open(owner, second, bounds)).rejects.toThrow('QCU task is unavailable')
    expect(native.create).toHaveBeenCalledOnce()
  })
})


it('prints only an explicitly requested current report, deduplicates dialogs and suppresses late callbacks', async () => {
  const onError = vi.fn<(error: Error) => void>()
  panel = createPanel({ ready: async () => origin, onError })
  await panel.open(owner, first, bounds)
  const view = views[0]!
  const print = () => {
    const event = preventable()
    view.webContents.emit('before-input-event', event, { type: 'keyDown', key: 'p', control: true,
      meta: false, alt: false, shift: false, isAutoRepeat: false })
    return event
  }
  expect(print().preventDefault).toHaveBeenCalledOnce()
  expect(view.webContents.print).not.toHaveBeenCalled()
  popup(view, report); await Promise.resolve()
  print(); print()
  expect(view.webContents.print).toHaveBeenCalledOnce()
  expect(view.webContents.print.mock.calls[0]![0]).toEqual({ silent: false, printBackground: true })
  view.webContents.print.mock.calls[0]![1](false, 'Print job canceled')
  expect(onError).not.toHaveBeenCalled()
  print(); view.webContents.print.mock.calls[1]![1](false, 'private printer diagnostics')
  expect(onError.mock.calls[0]![0].message).toBe('QCU report printing failed')
  view.webContents.print.mockImplementationOnce(() => { throw new Error('private printer error') })
  print(); expect(onError).toHaveBeenCalledTimes(2)
  print(); await panel.close(owner, first)
  view.webContents.print.mock.calls[3]![1](false, 'late failure')
  expect(onError).toHaveBeenCalledTimes(2)
})

it('revokes an in-flight replacement when old cleanup fails and latches admission across backend restarts', async () => {
  const onError = vi.fn<(error: Error) => void>()
  panel = createPanel({ ready: async () => origin, onError })
  await panel.open(owner, first, bounds)
  browserSession.clearStorageData.mockRejectedValue(new Error('private storage error'))
  const nextSession = fakeSession(); native.partition.mockReturnValue(nextSession)
  await expect(panel.open(owner, second, bounds)).rejects.toThrow('QCU task session cleanup failed')
  await vi.waitFor(() => { expect(onError).toHaveBeenCalledOnce() })
  expect(onError.mock.calls[0]![0].message).toBe('QCU task session cleanup failed')
  expect(new Set(native.partition.mock.calls.map(([name]) => name)).size).toBe(1)
  expect(native.create).toHaveBeenCalledOnce()
  expect(panel.available(owner)).toBe(false)
  await expect(panel.open(owner, qcuContextId('third'), bounds)).rejects.toThrow('QCU task is unavailable')
  const replacement = createPanel({ ready: async () => origin, onError })
  expect(replacement.available(owner)).toBe(false)
  await expect(replacement.open(owner, qcuContextId('after-backend-restart'), bounds)).rejects.toThrow('QCU task is unavailable')
  await expect(replacement.dispose()).rejects.toThrow('QCU task session cleanup failed')
  await expect(panel.dispose()).rejects.toThrow('QCU task session cleanup failed')
})

it('retains only the captured WebContents during destruction and late session callbacks', async () => {
  await panel.open(owner, first, bounds)
  const view = views[0]!, contents = view.webContents
  Object.defineProperty(view, 'webContents', { get() { throw new Error('Object has been destroyed') } })
  expect(() => { contents.close() }).not.toThrow()
  const callback = vi.fn()
  browserSession.webRequest.onBeforeRequest.mock.calls[0]![0]({
    url: `${origin}/task`, method: 'GET', resourceType: 'mainFrame', webContentsId: contents.id,
  }, callback)
  expect(callback).toHaveBeenCalledWith({ cancel: true })
  const download = preventable()
  browserSession.emit('will-download', download, fakeDownload(), contents)
  expect(download.preventDefault).toHaveBeenCalledOnce()
  await panel.dispose()
  expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
})


it('notifies main and rejects explicit close cleanup failure, then keeps stale close harmless without reopening', async () => {
  const onError = vi.fn<(error: Error) => void>()
  panel = createPanel({ ready: async () => origin, onError })
  await panel.open(owner, first, bounds)
  expect(panel.available(owner)).toBe(true)
  browserSession.clearStorageData.mockRejectedValue(new Error('private local data'))
  await expect(panel.close(owner, first)).rejects.toThrow('QCU task session cleanup failed')
  expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'QCU task session cleanup failed' }))
  expect(panel.available(owner)).toBe(false)
  await expect(panel.open(owner, second, bounds)).rejects.toThrow('QCU task is unavailable')
  await expect(panel.close(owner, first)).rejects.toThrow('QCU task session cleanup failed')
  expect(panel.available(owner)).toBe(false)
  expect(native.create).toHaveBeenCalledOnce()
  expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
})

// Native bounds are integer DIP; renderer measurements retain fractional CSS viewport coordinates.
describe('QCU task viewport zoom projection', () => {
  const css = { x: 10.25, y: 20.5, width: 100.5, height: 80.25 }

  it.each([
    [0.5, { x: 6, y: 11, width: 49, height: 39 }],
    [1.25, { x: 13, y: 26, width: 125, height: 99 }],
    [2, { x: 21, y: 41, width: 200, height: 160 }],
    [3, { x: 31, y: 62, width: 301, height: 240 }],
  ] as const)('scales CSS edges by owner zoom %s before rounding inward', async (zoom, projected) => {
    owner.webContents.getZoomFactor.mockReturnValue(zoom)
    await panel.open(owner, first, qcuTaskBounds(css))
    expect(views[0]!.setBounds).toHaveBeenLastCalledWith(projected)
    expect(owner.webContents.getZoomFactor).toHaveBeenCalledOnce()
  })

  it('clips the scaled rectangle to content DIP and keeps fully clipped or zero-sized slots empty', async () => {
    owner.webContents.getZoomFactor.mockReturnValue(2)
    owner.getContentSize.mockReturnValue([240, 160])
    await panel.open(owner, first, qcuTaskBounds({ x: -10.25, y: -20.75, width: 180.5, height: 130.25 }))
    const view = views[0]!
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 240, height: 160 })
    panel.setBounds(owner, first, qcuTaskBounds({ x: -20.5, y: -40.25, width: 1, height: 2 }))
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 0, height: 0 })
    panel.setBounds(owner, first, qcuTaskBounds({ x: 120.25, y: 80.75, width: 10.5, height: 20.25 }))
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 240, y: 160, width: 0, height: 0 })
    panel.setBounds(owner, first, qcuTaskBounds({ x: 10.25, y: 20.75, width: 0, height: 0 }))
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 21, y: 42, width: 0, height: 0 })
    owner.getContentSize.mockReturnValue([0, 0]); owner.emit('resize')
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('uses current programmatic zoom on a repeated CSS measurement and same-context open without reloading', async () => {
    await panel.open(owner, first, qcuTaskBounds(css))
    const view = views[0]!
    owner.webContents.getZoomFactor.mockReturnValue(2)
    panel.setBounds(owner, first, qcuTaskBounds(css))
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 21, y: 41, width: 200, height: 160 })
    owner.webContents.getZoomFactor.mockReturnValue(0.5)
    await panel.open(owner, first, qcuTaskBounds(css))
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 6, y: 11, width: 49, height: 39 })
    expect(view.webContents.loadURL).toHaveBeenCalledOnce()
    expect(native.create).toHaveBeenCalledOnce()
  })

  it('coalesces wheel-zoom requests and resamples owner zoom after the request before clamping on resize', async () => {
    await panel.open(owner, first, qcuTaskBounds(css))
    const view = views[0]!
    view.setBounds.mockClear()
    owner.webContents.getZoomFactor.mockClear()
    owner.webContents.emit('zoom-changed', {}, 'in')
    owner.webContents.emit('zoom-changed', {}, 'in')
    owner.webContents.getZoomFactor.mockReturnValue(1.25)
    expect(view.setBounds).not.toHaveBeenCalled()
    await new Promise(resolve => setImmediate(resolve))
    expect(view.setBounds).toHaveBeenCalledExactlyOnceWith({ x: 13, y: 26, width: 125, height: 99 })
    expect(owner.webContents.getZoomFactor).toHaveBeenCalledOnce()
    owner.getContentSize.mockReturnValue([100, 80]); owner.emit('resize')
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 13, y: 26, width: 87, height: 54 })
  })

  it('uses latest zoom after pending service readiness without allocating or loading a second view', async () => {
    const ready = Promise.withResolvers<string>()
    panel = createPanel({ ready: () => ready.promise })
    const pending = panel.open(owner, first, qcuTaskBounds(css))
    owner.webContents.getZoomFactor.mockReturnValue(2)
    owner.webContents.emit('zoom-changed', {}, 'in')
    owner.getContentSize.mockReturnValue([180, 120]); owner.emit('resize')
    ready.resolve(origin)
    await pending
    expect(views[0]!.setBounds).toHaveBeenLastCalledWith({ x: 21, y: 41, width: 159, height: 79 })
    expect(native.create).toHaveBeenCalledOnce()
  })

  it.each(['close', 'replace', 'crash', 'dispose'] as const)('cancels queued zoom reprojection on %s and rejects stale resize callbacks', async (action) => {
    await panel.open(owner, first, qcuTaskBounds(css))
    const retired = views[0]!
    const resize = owner.listeners('resize')[0] as () => void
    const zoom = owner.webContents.listeners('zoom-changed')[0] as () => void
    owner.webContents.emit('zoom-changed', {}, 'in')
    if (action === 'close') await panel.close(owner, first)
    if (action === 'replace') await panel.open(owner, second, bounds)
    if (action === 'crash') owner.webContents.emit('render-process-gone')
    if (action === 'dispose') await panel.dispose()
    retired.setBounds.mockClear()
    owner.webContents.getZoomFactor.mockClear()
    resize(); zoom()
    await new Promise(resolve => setImmediate(resolve))
    expect(retired.setBounds).not.toHaveBeenCalled()
    expect(owner.webContents.getZoomFactor).not.toHaveBeenCalled()
    expect(owner.webContents.listenerCount('zoom-changed')).toBe(action === 'replace' ? 1 : 0)
  })
})

it('retires close-before-open IDs and never lets old commands act on a newer occurrence', async () => {
  await panel.close(owner, first)
  await expect(panel.open(owner, first, bounds)).rejects.toThrow('QCU context is retired')
  await panel.open(owner, second, bounds)
  await panel.close(owner, first)
  await panel.back(owner, first)
  panel.setBounds(owner, first, { x: 0, y: 0, width: 0, height: 0 })
  expect(native.create).toHaveBeenCalledOnce()
  expect(views[0]!.webContents.close).not.toHaveBeenCalled()
  await panel.close(owner, second)
  await expect(panel.open(owner, second, bounds)).rejects.toThrow('QCU context is retired')
})

it('keeps owner identities separate even when their opaque context strings match', async () => {
  const other = fakeOwner()
  await panel.open(owner, first, bounds)
  await panel.close(other, first)
  panel.setBounds(other, first, { x: 0, y: 0, width: 0, height: 0 })
  await panel.back(other, first)
  expect(views[0]!.webContents.close).not.toHaveBeenCalled()
  expect(views[0]!.setBounds).toHaveBeenLastCalledWith(bounds)
  await expect(panel.open(other, first, bounds)).rejects.toThrow('QCU context is retired')
  await panel.open(other, second, bounds)
  await panel.close(owner, first)
  expect(views[1]!.webContents.close).not.toHaveBeenCalled()
})

it('awaits old private cleanup before allocating or acquiring the replacement', async () => {
  const ready = vi.fn(async () => origin)
  panel = createPanel({ ready })
  await panel.open(owner, first, bounds)
  const cleared = Promise.withResolvers<undefined>()
  browserSession.clearStorageData.mockReturnValue(cleared.promise)
  const pending = panel.open(owner, second, bounds)
  await vi.waitFor(() => { expect(browserSession.clearStorageData).toHaveBeenCalledOnce() })
  expect(native.create).toHaveBeenCalledOnce()
  expect(ready).toHaveBeenCalledOnce()
  cleared.resolve(undefined)
  await pending
  expect(ready).toHaveBeenCalledTimes(2)
  expect(native.create).toHaveBeenCalledTimes(2)
})

it('denies every request without the exact isolated top-frame identity', async () => {
  await panel.open(owner, first, bounds)
  for (const frame of [undefined, null, {}]) {
    expect(cancelled(`${origin}/api/rules`, { frame, resourceType: 'xhr' })).toBe(true)
    expect(cancelled(`${origin}/task`, { frame, resourceType: 'mainFrame' })).toBe(true)
  }
  expect(cancelled(`${origin}/api/rules`)).toBe(false)
})

it('requires the exact current loaded report ID and rejects modified or repeated native activation', async () => {
  await panel.open(owner, first, bounds)
  const contents = views[0]!.webContents
  activate()
  const task = preventable()
  browserSession.emit('will-download', task, fakeDownload(), contents)
  expect(task.preventDefault).toHaveBeenCalledOnce()
  popup(views[0]!, report); await Promise.resolve()
  activate()
  const other = preventable()
  browserSession.emit('will-download', other, fakeDownload(`${origin}/reports/${'cd'.repeat(16)}/download`), contents)
  expect(other.preventDefault).toHaveBeenCalledOnce()
  for (const input of [
    { key: 'Enter', shift: true }, { key: ' ', control: true }, { key: 'Enter', meta: true },
    { key: 'Enter', alt: true }, { key: 'Enter', isAutoRepeat: true },
  ]) {
    contents.emit('before-input-event', preventable(), { type: 'keyDown', ...input })
    const event = preventable()
    browserSession.emit('will-download', event, fakeDownload(), contents)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  }
  contents.emit('before-input-event', preventable(), { type: 'keyDown', key: 'Enter' })
  const event = preventable(), item = fakeDownload()
  browserSession.emit('will-download', event, item, contents)
  expect(event.preventDefault).not.toHaveBeenCalled()
  expect(item.setSaveDialogOptions).toHaveBeenCalledOnce()
})

it.each(['cancel', 'hide', 'detach', 'close', 'connections', 'storage', 'cache', 'auth'] as const)(
  'attempts every remaining teardown step after a synchronous %s failure and poisons all controllers', async (step) => {
    const onError = vi.fn<(error: Error) => void>()
    panel = createPanel({ ready: async () => origin, onError })
    await panel.open(owner, first, bounds)
    popup(views[0]!, report); await Promise.resolve()
    activate()
    const download = fakeDownload()
    browserSession.emit('will-download', preventable(), download, views[0]!.webContents)
    const fail = () => { throw new Error('private native failure') }
    if (step === 'cancel') download.cancel.mockImplementation(fail)
    if (step === 'hide') views[0]!.setVisible.mockImplementation(fail)
    if (step === 'detach') owner.contentView.removeChildView.mockImplementation(fail)
    if (step === 'close') views[0]!.webContents.close.mockImplementation(fail)
    if (step === 'connections') browserSession.closeAllConnections.mockImplementation(fail)
    if (step === 'storage') browserSession.clearStorageData.mockImplementation(fail)
    if (step === 'cache') browserSession.clearCache.mockImplementation(fail)
    if (step === 'auth') browserSession.clearAuthCache.mockImplementation(fail)
    await expect(panel.close(owner, first)).rejects.toThrow('QCU task session cleanup failed')
    expect(download.cancel).toHaveBeenCalledOnce()
    expect(owner.contentView.removeChildView).toHaveBeenCalledOnce()
    expect(views[0]!.webContents.close).toHaveBeenCalledOnce()
    expect(browserSession.closeAllConnections).toHaveBeenCalledOnce()
    expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
    expect(browserSession.clearCache).toHaveBeenCalledOnce()
    expect(browserSession.clearAuthCache).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'QCU task session cleanup failed' }))
    const replacement = createPanel({ ready: async () => origin, onError })
    expect(replacement.available(owner)).toBe(false)
    await expect(replacement.open(owner, second, bounds)).rejects.toThrow('QCU task is unavailable')
    await expect(replacement.dispose()).rejects.toThrow('QCU task session cleanup failed')
  },
)

it.each(['destroyed', 'connections', 'storage'] as const)(
  'bounds an unresolved %s teardown and suppresses any late success', async (step) => {
    const onError = vi.fn<(error: Error) => void>()
    panel = createPanel({ ready: async () => origin, onError })
    await panel.open(owner, first, bounds)
    const hung = Promise.withResolvers<undefined>()
    if (step === 'destroyed') views[0]!.webContents.close.mockImplementation(() => {})
    if (step === 'connections') browserSession.closeAllConnections.mockReturnValue(hung.promise)
    if (step === 'storage') browserSession.clearStorageData.mockReturnValue(hung.promise)
    vi.useFakeTimers()
    const closing = panel.close(owner, first)
    const failure = expect(closing).rejects.toThrow('QCU task session cleanup failed')
    await vi.advanceTimersByTimeAsync(4_000)
    await failure
    expect(browserSession.closeAllConnections).toHaveBeenCalledOnce()
    expect(browserSession.clearStorageData).toHaveBeenCalledOnce()
    expect(browserSession.clearCache).toHaveBeenCalledOnce()
    expect(browserSession.clearAuthCache).toHaveBeenCalledOnce()
    hung.resolve(undefined)
    views[0]!.webContents.emit('destroyed')
    await Promise.resolve()
    expect(panel.available(owner)).toBe(false)
    await expect(panel.open(owner, second, bounds)).rejects.toThrow('QCU task is unavailable')
    vi.useRealTimers()
  },
)

it('revokes synchronously when service admission disappears and suppresses pending readiness', async () => {
  const ready = Promise.withResolvers<{ origin: string }>()
  let available = true
  panel = new Panel({ available: () => available, acquireNativeTarget: () => ready.promise })
  const opening = panel.open(owner, first, bounds)
  available = false
  expect(panel.available(owner)).toBe(false)
  ready.resolve({ origin })
  await opening
  expect(native.create).not.toHaveBeenCalled()
  available = true
  await expect(panel.open(owner, first, bounds)).rejects.toThrow('QCU context is retired')
})

it('denies HTTP redirect responses in the isolated session, including asset and XHR redirects', async () => {
  await panel.open(owner, first, bounds)
  const callback = vi.fn<(response: { cancel: boolean }) => void>()
  const response = browserSession.webRequest.onHeadersReceived.mock.calls[0]![0]
  for (const statusCode of [300, 301, 302, 303, 305, 307, 308]) {
    response({ statusCode }, callback)
    expect(callback).toHaveBeenLastCalledWith({ cancel: true })
  }
  response({ statusCode: 200 }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: false })
  await panel.close(owner, first)
  response({ statusCode: 200 }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: true })
})

it('closes process-wide admission synchronously when native detach fails, before slow erasure completes', async () => {
  const onError = vi.fn<(error: Error) => void>()
  panel = createPanel({ ready: async () => origin, onError })
  await panel.open(owner, first, bounds)
  const storage = Promise.withResolvers<undefined>()
  browserSession.clearStorageData.mockReturnValue(storage.promise)
  owner.contentView.removeChildView.mockImplementation(() => { throw new Error('private native failure') })
  const closing = panel.close(owner, first)
  const failure = expect(closing).rejects.toThrow('QCU task session cleanup failed')
  const replacement = createPanel({ ready: async () => origin, onError })
  expect(replacement.available(owner)).toBe(false)
  await expect(replacement.open(owner, second, bounds)).rejects.toThrow('QCU task is unavailable')
  storage.resolve(undefined)
  await failure
  await expect(replacement.dispose()).rejects.toThrow('QCU task session cleanup failed')
})

it('does not carry an earlier native activation into another report document', async () => {
  await panel.open(owner, first, bounds)
  popup(views[0]!, report); await Promise.resolve()
  activate()
  const otherReport = `${origin}/reports/${'cd'.repeat(16)}`
  views[0]!.webContents.emit('will-navigate', preventable(), otherReport)
  await views[0]!.webContents.loadURL(otherReport)
  views[0]!.webContents.emit('did-finish-load')
  const event = preventable()
  browserSession.emit('will-download', event, fakeDownload(`${otherReport}/download`), views[0]!.webContents)
  expect(event.preventDefault).toHaveBeenCalledOnce()
})

it('prevents the download and emits only a fixed error when native save-dialog setup throws', async () => {
  const onError = vi.fn<(error: Error) => void>()
  panel = createPanel({ ready: async () => origin, onError })
  await panel.open(owner, first, bounds)
  popup(views[0]!, report); await Promise.resolve()
  activate()
  const item = fakeDownload(), event = preventable()
  item.setSaveDialogOptions.mockImplementation(() => { throw new Error('private file destination') })
  expect(() => { browserSession.emit('will-download', event, item, views[0]!.webContents) }).not.toThrow()
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'QCU report download failed' }))
})


describe('QCU cancelled-save retry', () => {
  it('keeps the report loaded after cancel and requires a fresh click for every new save dialog', async () => {
    const onError = vi.fn<(error: Error) => void>(); panel = createPanel({ ready: async () => origin, onError });
    await panel.open(owner, first, bounds);
    popup(views[0]!, report); await Promise.resolve();
    const contents = views[0]!.webContents;
    activate(); const firstSave = fakeDownload();
    browserSession.emit('will-download', preventable(), firstSave, contents);
    firstSave.emit('done', {}, 'cancelled');
    expect(onError).not.toHaveBeenCalled();
    expect(contents.getURL()).toBe(report);
    const scriptedRetry = preventable(); browserSession.emit('will-download', scriptedRetry, fakeDownload(), contents);
    expect(scriptedRetry.preventDefault).toHaveBeenCalledOnce();
    activate(); const retry = fakeDownload(), confirmedRetry = preventable();
    browserSession.emit('will-download', confirmedRetry, retry, contents);
    expect(confirmedRetry.preventDefault).not.toHaveBeenCalled();
    expect(retry.setSaveDialogOptions).toHaveBeenCalledOnce();
    retry.emit('done', {}, 'completed');
    expect(onError).not.toHaveBeenCalled();
    await panel.close(owner, first);
    expect(firstSave.cancel).not.toHaveBeenCalled(); expect(retry.cancel).not.toHaveBeenCalled();
  });
});
