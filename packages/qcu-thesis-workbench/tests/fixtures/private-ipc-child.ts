/** Synthetic IPC child: no Python, Electron, profiles, browser, credentials, or model. */
import { QcuDesktopBinding } from '../../src/host/desktop-binding.ts'
import type { QcuPrivateServiceBinding } from '../../src/host/local-owner.ts'
let live = true
const listeners = new Set<() => void | Promise<void>>()
const owner: QcuPrivateServiceBinding = {
  available: () => live,
  acquireNativeTarget: async () => { if (!live) throw new Error('closed'); return { origin: 'http://127.0.0.1:34567' } },
  onRevoked: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
}
const binding = new QcuDesktopBinding(owner, process, 1000)
process.on('message', message => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return
  if (message.type === 'fixture:start') binding.serviceReady()
  if (message.type === 'fixture:stop') {
    live = false
    void Promise.all([...listeners].map(listener => listener())).then(() => {
      binding.dispose()
      process.send?.({ type: 'fixture:stopped' }, () => { process.disconnect() })
    }, () => {
      binding.dispose()
      process.send?.({ type: 'fixture:failed' }, () => { process.disconnect() })
    })
  }
})
process.send?.({ type: 'fixture:installed' })
