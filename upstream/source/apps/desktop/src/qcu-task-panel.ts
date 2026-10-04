/** Main-owned, temporary thesis-task documents embedded in the application window. */
import { randomUUID } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import { WebContentsView, session, type DownloadItem, type Session, type View, type WebContents } from 'electron'
import type { QcuBounds, QcuContextId } from './qcu-native-contract.ts'

/** Main-owned application window surface; never supplied by renderer payload. */
export type QcuTaskOwner = Pick<EventEmitter, 'on' | 'removeListener'> & {
  webContents: Pick<EventEmitter, 'on' | 'removeListener'> & Pick<WebContents, 'getZoomFactor' | 'isDestroyed'>
  contentView: Pick<View, 'addChildView' | 'removeChildView'>
  isDestroyed(): boolean
  getContentSize(): number[]
}

interface TaskDocument {
  readonly contextId: QcuContextId
  readonly owner: QcuTaskOwner
  bounds: QcuBounds
  opening: Promise<void>
  releaseOwner: () => void
  origin?: string
  browserSession?: Session
  view?: WebContentsView
  contents?: WebContents
  loaded: boolean
  activationUntil: number
  printing: boolean
  readonly downloads: Set<DownloadItem>
}

/** Private main-process binding; its owner invokes revokeAll before acknowledging Host teardown. */
export interface QcuPrivateServiceBinding {
  /** @returns Whether the exact current Host generation has an enabled service. */
  available(): boolean
  /** @returns The private loopback origin, never exposed through renderer IPC. */
  acquireNativeTarget(): Promise<{ readonly origin: string }>
}

interface TaskPanelOptions {
  readonly ready: () => Promise<string>
  readonly available: () => boolean
  readonly onError?: (error: Error) => void
}

// This latch is deliberately outside every controller and binding instance.
const admission = { cleanupFailed: false }
const controllers = new Set<QcuTaskPanelController>()

/** Fixed QCU native authority; Host and owner revocation does not depend on Client unmount. */
export class QcuTaskPanelController {
  private readonly panels = new Map<QcuTaskOwner, NativeTaskPanel>()
  private disposed = false
  private disposal: Promise<void> | undefined

  /** @param binding - Main-only current Host binding. @param onError - Fixed sanitized diagnostics. */
  constructor(private readonly binding: QcuPrivateServiceBinding, private readonly onError?: (error: Error) => void) {
    controllers.add(this)
  }

  /** @param owner - Authenticated application window. @returns Only a boolean native capability. */
  available(owner: QcuTaskOwner): boolean {
    const available = this.capable(owner)
    if (!available) void this.revokeAll().catch(() => {})
    return available
  }

  private capable(owner: QcuTaskOwner): boolean {
    try {
      return !this.disposed && !admission.cleanupFailed && !owner.isDestroyed()
        && !owner.webContents.isDestroyed() && this.binding.available()
    } catch (_error) { return false }
  }

  /**
   * @param owner - Authenticated window.
   * @param contextId - Fresh occurrence.
   * @param bounds - CSS viewport.
   * @returns Fixed task load completion.
   */
  open(owner: QcuTaskOwner, contextId: QcuContextId, bounds: QcuBounds): Promise<void> {
    const panel = this.forOwner(owner)
    if (!this.available(owner)) {
      void panel.close(contextId).catch(() => {})
      void this.revokeAll().catch(() => {})
      return Promise.reject(new Error('QCU task is unavailable'))
    }
    try { return panel.open(owner, contextId, bounds) }
    catch (_error) { void this.revokeAll().catch(() => {}); return Promise.reject(new Error('QCU task operation failed')) }
  }

  /** @param owner - Authenticated window. @param contextId - Current occurrence. @param bounds - CSS viewport. */
  setBounds(owner: QcuTaskOwner, contextId: QcuContextId, bounds: QcuBounds): void {
    this.requireAvailable(owner)
    try { this.panels.get(owner)?.setBounds(contextId, bounds) }
    catch (_error) { void this.revokeAll().catch(() => {}); throw new Error('QCU task operation failed') }
  }

  /**
   * @param owner - Authenticated window.
   * @param contextId - Occurrence to retire, including unopened IDs.
   * @returns Private cleanup completion.
   */
  close(owner: QcuTaskOwner, contextId: QcuContextId): Promise<void> {
    return this.forOwner(owner).close(contextId)
  }

  /** @param owner - Authenticated window. @param contextId - Current occurrence. @returns Fixed task document load completion. */
  async back(owner: QcuTaskOwner, contextId: QcuContextId): Promise<void> {
    this.requireAvailable(owner)
    await this.panels.get(owner)?.back(contextId)
  }

  /** @returns Cleanup acknowledgment after synchronously revoking every owned occurrence. */
  revokeAll(): Promise<void> {
    const pending = Array.from(this.panels.values(), panel => panel.revokeAll())
    return Promise.allSettled(pending).then((results) => {
      if (admission.cleanupFailed || results.some(result => result.status === 'rejected')) {
        throw new Error('QCU task session cleanup failed')
      }
    })
  }

  /** @returns Idempotent terminal native cleanup; new controllers cannot reset process admission. */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.disposed = true
    controllers.delete(this)
    this.disposal = this.revokeAll()
    return this.disposal
  }

  private forOwner(owner: QcuTaskOwner): NativeTaskPanel {
    let panel = this.panels.get(owner)
    if (panel === undefined) {
      panel = new NativeTaskPanel({
        available: () => this.capable(owner),
        ready: async () => (await this.binding.acquireNativeTarget()).origin,
        ...(this.onError === undefined ? {} : { onError: this.onError }),
      })
      this.panels.set(owner, panel)
    }
    return panel
  }

  private requireAvailable(owner: QcuTaskOwner): void {
    if (this.available(owner)) return
    void this.revokeAll().catch(() => {})
    throw new Error('QCU task is unavailable')
  }
}

const REPORT = /^\/reports\/[0-9a-f]{32}$/u
const DOWNLOAD = /^\/reports\/[0-9a-f]{32}\/download$/u
const CLEANUP_DEADLINE_MS = 4_000

function serviceOrigin(value: string): string {
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/?$/u.exec(value)
  if (match === null || Number(match[1]) > 65_535) throw new Error('Invalid QCU service origin')
  return new URL(value).origin
}

function path(document: TaskDocument, value: string): string | undefined {
  if (document.origin === undefined || !value.startsWith(`${document.origin}/`) || !URL.canParse(value)) return undefined
  const url = new URL(value)
  return url.origin === document.origin && url.username === '' && url.password === ''
    && url.search === '' && url.hash === '' && url.href === value ? url.pathname : undefined
}

/** A context replacement revokes the old renderer before any readiness or cleanup await. */
class NativeTaskPanel {
  private active: TaskDocument | undefined
  private readonly cleanup = new Set<Promise<Error | undefined>>()
  private readonly retired = new Set<QcuContextId>()

  /** @param options - Main-owned service readiness; no service URL reaches the application renderer. */
  constructor(private readonly options: TaskPanelOptions) {}

  /** @returns Whether this process can admit tasks without an unresolved private-session cleanup failure. */
  available(): boolean { return !admission.cleanupFailed && this.options.available() }

  /**
   * Open one task occurrence; duplicate opens join readiness and preserve its current document.
   * @param owner - Application BrowserWindow that owns the native view.
   * @param contextId - Validated renderer occurrence, never a business identifier.
   * @param bounds - Validated, fractional CSS viewport rectangle, without device-pixel scaling.
   * @returns Completion of the first task load, or silent completion when superseded.
   */
  open(owner: QcuTaskOwner, contextId: QcuContextId, bounds: QcuBounds): Promise<void> {
    if (admission.cleanupFailed) return Promise.reject(new Error('QCU task is unavailable until app restart'))
    if (!this.available() || owner.isDestroyed()) return Promise.reject(new Error('QCU task is unavailable'))
    if (this.retired.has(contextId)) return Promise.reject(new Error('QCU context is retired'))
    const previous = this.active
    if (previous?.contextId === contextId && previous.owner === owner) {
      this.setBounds(contextId, bounds)
      return previous.opening
    }
    void this.revoke()
    const document: TaskDocument = {
      contextId, owner, bounds, opening: Promise.resolve(), releaseOwner: () => {},
      loaded: false, activationUntil: 0, printing: false, downloads: new Set(),
    }
    this.active = document
    const close = () => { if (this.active === document) void this.revoke() }
    const navigate = (_event: Electron.Event, _url: string, inPlace: boolean, mainFrame: boolean) => {
      if (mainFrame && !inPlace) close()
    }
    const resize = () => {
      try { this.applyBounds(document) }
      catch (_error) { this.notifyFailure('QCU task operation failed'); void this.revoke() }
    }
    let zoomUpdate: NodeJS.Immediate | undefined
    // zoom-changed reports a wheel request; renderer bounds updates also cover programmatic zoom.
    const zoom = () => {
      if (!this.current(document) || zoomUpdate !== undefined) return
      zoomUpdate = setImmediate(() => { zoomUpdate = undefined; resize() })
    }
    owner.webContents.on('did-start-navigation', navigate)
    owner.webContents.on('render-process-gone', close)
    owner.webContents.on('destroyed', close)
    owner.webContents.on('zoom-changed', zoom)
    owner.on('closed', close)
    owner.on('resize', resize)
    document.releaseOwner = () => {
      owner.webContents.removeListener('did-start-navigation', navigate)
      owner.webContents.removeListener('render-process-gone', close)
      owner.webContents.removeListener('destroyed', close)
      owner.webContents.removeListener('zoom-changed', zoom)
      if (zoomUpdate !== undefined) clearImmediate(zoomUpdate)
      owner.removeListener('closed', close)
      owner.removeListener('resize', resize)
    }
    document.opening = this.loadTask(document).catch(async () => {
      if (!this.current(document)) {
        if (admission.cleanupFailed) throw new Error('QCU task session cleanup failed')
        return
      }
      await this.revoke()
      throw new Error('QCU task could not be opened')
    })
    return document.opening
  }

  /**
   * Resize only the current occurrence and constrain it to the owner's content area.
   * @param contextId - Validated renderer occurrence.
   * @param bounds - CSS viewport rectangle; stale occurrences are ignored and current owner zoom is sampled.
   */
  setBounds(contextId: QcuContextId, bounds: QcuBounds): void {
    const document = this.active
    if (document?.contextId !== contextId) return
    document.bounds = bounds
    this.applyBounds(document)
  }

  /**
   * Dismiss a task document and erase private browser data; server computation is not cancelled.
   * @param contextId - Only this occurrence may be dismissed.
   * @returns Completion of this occurrence's teardown; stale closes are harmless.
   */
  async close(contextId: QcuContextId): Promise<void> {
    this.retired.add(contextId)
    if (this.active?.contextId === contextId) void this.revoke()
    await this.waitCleanup()
  }

  /**
   * Return to the fixed task route; the task page restores state without starting another check.
   * @param contextId - Current occurrence; stale calls are ignored.
   * @returns Completion of the local document load, without returning task data.
   */
  async back(contextId: QcuContextId): Promise<void> {
    const document = this.active
    if (document?.contextId !== contextId || document.contents === undefined) return
    if (document.loaded && path(document, document.contents.getURL()) === '/task') return
    await this.navigate(document, `${document.origin}/task`)
  }

  /** Revoke immediately and acknowledge all cleanup already in progress. */
  revokeAll(): Promise<void> {
    void this.revoke()
    return this.waitCleanup()
  }

  private async waitCleanup(): Promise<void> {
    const errors = await Promise.all(this.cleanup)
    if (admission.cleanupFailed || errors.some(error => error !== undefined)) throw new Error('QCU task session cleanup failed')
  }

  private current(document: TaskDocument): boolean {
    return this.available() && this.active === document && !document.owner.isDestroyed()
  }

  private async loadTask(document: TaskDocument): Promise<void> {
    await this.waitCleanup()
    if (!this.current(document)) return
    const value = await this.options.ready()
    if (!this.current(document)) return
    document.origin = serviceOrigin(value)
    const browserSession = session.fromPartition(`qcu-task-${randomUUID()}`, { cache: false })
    document.browserSession = browserSession
    this.configureSession(document, browserSession)
    await browserSession.setProxy({ mode: 'direct' })
    if (!this.current(document)) return
    const view = new WebContentsView({ webPreferences: {
      session: browserSession, nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false, devTools: false, spellcheck: false, navigateOnDragDrop: false,
    } })
    document.view = view
    document.contents = view.webContents
    view.setVisible(false)
    this.configureContents(document, view)
    document.owner.contentView.addChildView(view)
    this.applyBounds(document)
    await view.webContents.loadURL(`${document.origin}/task`)
    if (!this.current(document)) return
    document.loaded = true
    view.setVisible(true)
  }

  private applyBounds(document: TaskDocument): void {
    if (!this.current(document) || document.view === undefined) return
    const [width = 0, height = 0] = document.owner.getContentSize()
    const requested = document.bounds, zoom = document.owner.webContents.getZoomFactor()
    // Native View bounds are DIP, not physical screen pixels: do not multiply by devicePixelRatio.
    // Round inward after scaling both edges so the native surface cannot cover adjacent HTML controls.
    const x = Math.min(width, Math.max(0, Math.ceil(requested.x * zoom)))
    const y = Math.min(height, Math.max(0, Math.ceil(requested.y * zoom)))
    const right = Math.min(width, Math.floor((requested.x + requested.width) * zoom))
    const bottom = Math.min(height, Math.floor((requested.y + requested.height) * zoom))
    document.view.setBounds({ x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) })
  }

  private configureContents(document: TaskDocument, view: WebContentsView): void {
    const contents = view.webContents
    const allowed = (value: string): boolean => {
      const route = path(document, value)
      return this.current(document) && route !== undefined && (route === '/task' || REPORT.test(route) || DOWNLOAD.test(route))
    }
    contents.setWindowOpenHandler(({ url, postBody }) => {
      if (postBody === undefined && allowed(url) && !DOWNLOAD.test(path(document, url) ?? '')) {
        void this.navigate(document, url).catch(() => { this.reportFailure(document, 'QCU report could not be opened') })
      }
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!allowed(url)) event.preventDefault()
      else if (!DOWNLOAD.test(path(document, url) ?? '')) { document.loaded = false; document.activationUntil = 0 }
    })
    contents.on('did-finish-load', () => {
      const route = path(document, contents.getURL())
      if (this.current(document) && (route === '/task' || REPORT.test(route ?? ''))) document.loaded = true
    })
    contents.on('will-frame-navigate', (event) => { if (!event.isMainFrame || !allowed(event.url)) event.preventDefault() })
    contents.on('will-redirect', (event) => { event.preventDefault() })
    contents.on('will-attach-webview', (event) => { event.preventDefault() })
    contents.on('login', (event, _details, _authInfo, callback) => { event.preventDefault(); callback() })
    contents.on('render-process-gone', () => { if (this.current(document)) void this.revoke() })
    contents.on('destroyed', () => { if (this.current(document)) void this.revoke() })
    // Only native input arms a single save dialog; script-triggered downloads are otherwise denied.
    const activate = () => { if (this.current(document) && document.loaded) document.activationUntil = Date.now() + 1500 }
    contents.on('before-mouse-event', (_event, input) => { if (input.type === 'mouseUp' && input.button === 'left') activate() })
    contents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key.toLowerCase() === 'p' && (input.control || input.meta)
        && !input.alt && !input.shift && !input.isAutoRepeat) {
        event.preventDefault()
        if (!this.current(document) || !document.loaded || document.printing || !REPORT.test(path(document, contents.getURL()) ?? '')) return
        document.printing = true
        try {
          contents.print({ silent: false, printBackground: true }, (success, reason) => {
            if (!document.printing) return
            document.printing = false
            if (!success && reason !== 'Print job canceled') this.reportFailure(document, 'QCU report printing failed')
          })
        } catch (_error) {
          document.printing = false
          this.reportFailure(document, 'QCU report printing failed')
        }
        return
      }
      if (input.type === 'keyDown' && ['Enter', ' '].includes(input.key) && !input.isAutoRepeat
        && !input.control && !input.meta && !input.alt && !input.shift) activate()
    })
  }

  private async navigate(document: TaskDocument, url: string): Promise<void> {
    if (!this.current(document) || document.contents === undefined) return
    document.loaded = false
    document.activationUntil = 0
    try { await document.contents.loadURL(url) }
    catch (_error) { if (this.current(document)) throw new Error('QCU document could not be opened') }
    if (this.current(document)) document.loaded = true
  }

  private configureSession(document: TaskDocument, browserSession: Session): void {
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
    browserSession.setPermissionCheckHandler(() => false)
    browserSession.setDevicePermissionHandler(() => false)
    browserSession.setDisplayMediaRequestHandler((_request, callback) => { callback({}) })
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      const route = path(document, details.url)
      const owned = document.contents !== undefined && !document.contents.isDestroyed()
        && document.contents.id === details.webContentsId && details.frame === document.contents.mainFrame
      const allowed = route !== undefined && (details.method === 'GET'
        ? ['/task', '/task-panel.js', '/task-panel.css', '/api/rules'].includes(route) || REPORT.test(route) || DOWNLOAD.test(route)
        : details.method === 'POST' && ['/api/task/upload', '/api/task/run'].includes(route))
      callback({ cancel: !this.current(document) || !owned || !allowed || details.resourceType === 'subFrame' })
    })
    browserSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ cancel: !this.current(document) || (details.statusCode >= 300 && details.statusCode < 400) })
    })
    browserSession.on('will-download', (event, item, contents) => {
      const url = item.getURL()
      const reportRoute = document.contents === undefined || document.contents.isDestroyed()
        ? undefined : path(document, document.contents.getURL())
      const activated = document.activationUntil > Date.now()
      document.activationUntil = 0
      if (!this.current(document) || !document.loaded || document.contents !== contents || !activated
        || !REPORT.test(reportRoute ?? '') || path(document, url) !== `${reportRoute}/download`
        || !DOWNLOAD.test(path(document, url) ?? '') || item.getMimeType() !== 'text/html'
        || item.getURLChain().length === 0 || !item.getURLChain().every(value => value === url)) {
        event.preventDefault()
        return
      }
      // No save path is supplied; the user must choose the destination and confirm the native dialog.
      try { item.setSaveDialogOptions({ defaultPath: 'qcu-thesis-report.html', filters: [{ name: 'HTML', extensions: ['html'] }] }) }
      catch (_error) { event.preventDefault(); this.reportFailure(document, 'QCU report download failed'); return }
      document.downloads.add(item)
      item.once('done', (_event, state) => {
        if (document.downloads.delete(item) && state === 'interrupted') this.reportFailure(document, 'QCU report download failed')
      })
    })
  }

  private revoke(): Promise<Error | undefined> {
    const document = this.active
    this.active = undefined
    if (document === undefined) return Promise.resolve(undefined)
    this.retired.add(document.contextId)
    document.activationUntil = 0
    let failed = false
    const attempt = (action: () => void): void => {
      try { action() } catch (_error) { failed = true; this.cleanupFailure() }
    }
    attempt(document.releaseOwner)
    document.printing = false
    for (const item of document.downloads) { document.downloads.delete(item); attempt(() => { item.cancel() }) }
    const view = document.view, contents = document.contents
    let destroyed = Promise.resolve()
    if (view !== undefined && contents !== undefined) {
      attempt(() => { view.setVisible(false) })
      attempt(() => { if (!document.owner.isDestroyed()) document.owner.contentView.removeChildView(view) })
      destroyed = new Promise<void>((resolve) => {
        if (contents.isDestroyed()) resolve()
        else {
          contents.once('destroyed', resolve)
          try { contents.close({ waitForBeforeUnload: false }) }
          catch (_error) { failed = true; this.cleanupFailure(); resolve() }
        }
      })
    }
    const cleanup = this.clearSession(document.browserSession, destroyed).then(() => {
      if (failed) throw new Error('QCU task session cleanup failed')
    }).then(() => undefined, () => {
      const error = new Error('QCU task session cleanup failed')
      this.cleanupFailure()
      return error
    })
    this.cleanup.add(cleanup)
    void cleanup.then((error) => {
      if (error === undefined) this.cleanup.delete(cleanup)
    })
    return cleanup
  }

  private async clearSession(browserSession: Session | undefined, destroyed: Promise<void>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('QCU task session cleanup failed')) }, CLEANUP_DEADLINE_MS)
    })
    const bounded = <T>(operation: Promise<T>): Promise<T> => Promise.race([operation, deadline]).catch(() => {
      this.cleanupFailure()
      throw new Error('QCU task session cleanup failed')
    })
    try {
      const destruction = await Promise.allSettled([bounded(destroyed)])
      if (browserSession === undefined) {
        if (destruction.some(result => result.status === 'rejected')) throw new Error('QCU task session cleanup failed')
        return
      }
      // Even timed-out destruction or connections cannot skip the remaining erasure attempts.
      const connections = await Promise.allSettled([bounded(Promise.resolve().then(() => browserSession.closeAllConnections()))])
      const results = [...destruction, ...connections, ...await Promise.allSettled([
        bounded(Promise.resolve().then(() => browserSession.clearStorageData())),
        bounded(Promise.resolve().then(() => browserSession.clearCache())),
        bounded(Promise.resolve().then(() => browserSession.clearAuthCache())),
      ])]
      if (results.some(result => result.status === 'rejected')) throw new Error('QCU task session cleanup failed')
    } finally { clearTimeout(timer) }
  }

  private cleanupFailure(): void {
    if (admission.cleanupFailed) return
    admission.cleanupFailed = true
    for (const controller of controllers) void controller.revokeAll().catch(() => {})
    this.notifyFailure('QCU task session cleanup failed')
  }

  private reportFailure(document: TaskDocument, message: string): void {
    if (!this.current(document)) return
    this.notifyFailure(message)
  }

  private notifyFailure(message: string): void {
    const error = new Error(message)
    if (this.options.onError === undefined) { console.error(error); return }
    try { this.options.onError(error) }
    catch (_error) { console.error('QCU task error handler failed') }
  }
}
