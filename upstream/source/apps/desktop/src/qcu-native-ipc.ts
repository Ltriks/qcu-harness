/** Five fixed QCU IPC handlers authenticated against the current owning application top frame. */
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron'
import { parseQcuNativeRequest, QCU_NATIVE_IPC } from './qcu-native-contract.ts'
import type { QcuTaskPanelController } from './qcu-task-panel.ts'

interface NativeIpcOptions {
  readonly ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  readonly owner: () => BrowserWindow | undefined
  readonly panel: Pick<QcuTaskPanelController, 'available' | 'open' | 'setBounds' | 'close' | 'back'>
}

function ownedWindow(event: IpcMainInvokeEvent, getOwner: NativeIpcOptions['owner']): BrowserWindow {
  const owner = getOwner(), frame = event.senderFrame
  if (owner === undefined || owner.isDestroyed() || owner.webContents.isDestroyed()
    || event.sender !== owner.webContents || frame === null || frame !== owner.webContents.mainFrame) {
    throw new Error('QCU sender is not authorized')
  }
  const url = new URL(frame.url)
  if (!frame.url.startsWith('dsh-app://app/') || url.protocol !== 'dsh-app:' || url.hostname !== 'app'
    || url.port !== '' || url.username !== '' || url.password !== '' || url.pathname !== '/'
    || url.search !== '' || url.href !== frame.url) throw new Error('QCU sender is not authorized')
  return owner
}

/**
 * Install only the versioned fixed QCU operations; renderer payloads cannot select owners or targets.
 * @param options - Main-owned Electron registration, current application window, and fixed panel.
 * @returns A disposer that removes exactly these five handlers.
 */
export function installQcuNativeIpc(options: NativeIpcOptions): () => void {
  for (const operation of ['available', 'open', 'setBounds', 'close', 'back'] as const) {
    options.ipcMain.handle(QCU_NATIVE_IPC[operation], async (event, ...args: unknown[]): Promise<boolean | void> => {
      let owner: BrowserWindow
      try { owner = ownedWindow(event, options.owner) }
      catch (_error) { throw new Error('QCU sender is not authorized') }
      let request: ReturnType<typeof parseQcuNativeRequest>
      try { request = parseQcuNativeRequest(operation, args) }
      catch (_error) { throw new Error('Invalid QCU request') }
      try {
        switch (request.operation) {
          case 'available': {
            const available: unknown = options.panel.available(owner)
            return available === true
          }
          case 'open': await options.panel.open(owner, request.contextId, request.bounds); return
          case 'setBounds': options.panel.setBounds(owner, request.contextId, request.bounds); return
          case 'close': await options.panel.close(owner, request.contextId); return
          case 'back': await options.panel.back(owner, request.contextId); return
        }
      } catch (_error) {
        // Electron serializes errors to the renderer: private native/service diagnostics never cross.
        throw new Error('QCU task operation failed')
      }
    })
  }
  return () => {
    for (const channel of Object.values(QCU_NATIVE_IPC)) options.ipcMain.removeHandler(channel)
  }
}
