import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

const bytes = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const dom = new JSDOM('<!doctype html><div id="test-root"></div>', { url: 'http://synthetic.invalid/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
let observerCount = 0
class SyntheticResizeObserver {
  constructor(callback) { this.callback = callback }
  observe() { observerCount++ }
  disconnect() { observerCount-- }
}
globalThis.ResizeObserver = SyntheticResizeObserver
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 24, y: 140, width: 752, height: 460, top: 140, left: 24, right: 776, bottom: 600 }
}
const { act } = React
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function materialize() {
  let row
  const required = []
  dom.window.__ModuleLoader__ = { load: value => { row = value } }
  const previous = document.head.innerHTML
  new Function('window', bytes)(dom.window)
  assert.equal(row.id, 'qcu-thesis-workbench')
  assert.equal(document.head.innerHTML, previous)
  assert.deepEqual(required, [])
  const plugin = row.factory(id => { required.push(id); assert.equal(id, 'react'); return React })
  assert.deepEqual(required, ['react'])
  return plugin
}
function registration(plugin) {
  const disposers = []
  let dictionaries
  let component
  let options
  const context = {
    effect: register => { const cleanup = register(); disposers.push(cleanup); return cleanup },
    locale: { register: (namespace, value) => { assert.equal(namespace, 'qcu-thesis-workbench'); dictionaries = value; return () => { dictionaries = undefined } } },
    slots: {
      inject: (slot, effect) => { assert.equal(slot, 'conversation.session.header.actions'); disposers.push(effect()) },
      register: (value, view) => { options = value; component = view; return () => { component = undefined } },
    },
  }
  plugin.apply(context)
  assert.deepEqual(options, { name: 'conversation.session.header.actions', id: 'qcu-thesis-workbench', locale: 'qcu-thesis-workbench' })
  return { get component() { return component }, t: key => dictionaries.en[key], dispose: () => disposers.reverse().forEach(fn => fn()), get dictionaries() { return dictionaries } }
}
function bridge() {
  const calls = []
  return { calls, value: {
    protocolVersion: 1,
    available: async () => true,
    open: async (...args) => { calls.push(['open', ...args]) },
    setBounds: async (...args) => { calls.push(['setBounds', ...args]) },
    close: async (...args) => { calls.push(['close', ...args]) },
    back: async (...args) => { calls.push(['back', ...args]) },
  } }
}
async function mounted(native) {
  globalThis.dshDesktop = native === undefined ? undefined : { qcu: native }
  const registrationResult = registration(materialize())
  const root = createRoot(document.getElementById('test-root'))
  const props = {
    sessionId: 'synthetic-session-1',
    t: registrationResult.t,
    useSessionRetainInfo: selector => selector({ retainedBy: { mainView: 1 } }),
  }
  Object.defineProperty(props, 'useSession', { get() { throw new Error('QCU must not inspect Session contents') } })
  await act(async () => { root.render(React.createElement(registrationResult.component, props)) })
  return {
    ...registrationResult,
    root,
    async rerender(changes) { await act(async () => { root.render(React.createElement(registrationResult.component, { ...props, ...changes })) }) },
    async unmount() { await act(async () => { root.unmount() }); registrationResult.dispose() },
  }
}
function button(text) { return Array.from(document.querySelectorAll('button')).find(node => node.textContent === text) }
async function click(element) { assert.ok(element); await act(async () => { element.click() }) }

test('built factory is lazy and actual React entry fails closed on pure official desktop', async () => {
  const f = await mounted(undefined)
  assert.equal(button('Thesis check · not enabled').disabled, true)
  assert.match(button('Thesis check · not enabled').title, /not enabled/)
  assert.equal(button('Retry thesis check'), undefined)
  assert.equal(document.querySelector('dialog'), null)
  assert.equal(document.querySelector('input[type=file], iframe, webview'), null)
  await f.unmount()
  assert.equal(document.querySelector('[data-qcu-client-style]'), null)
  assert.equal(observerCount, 0)
})

test('unversioned, wrong-version and expanded bridges never open or offer retry', async () => {
  const old = bridge().value
  delete old.protocolVersion
  const b = bridge()
  for (const invalid of [old, { ...b.value, protocolVersion: 2 }, { ...b.value, navigate() {} }]) {
    const f = await mounted(invalid)
    assert.equal(button('Thesis check · not enabled').disabled, true)
    assert.equal(button('Retry thesis check'), undefined)
    assert.equal(document.querySelector('dialog'), null)
    await f.unmount()
  }
  assert.deepEqual(b.calls, [])
})

test('cold compatible bridge becomes ready by explicit retry without Session remount or implicit open', async () => {
  const b = bridge()
  const pending = deferred()
  let checks = 0
  b.value.available = () => {
    ++checks
    return checks === 1 ? Promise.resolve(false) : checks === 2 ? pending.promise : Promise.resolve(true)
  }
  const f = await mounted(b.value)
  const entry = document.querySelector('[data-qcu-entry]')
  assert.equal(button('Thesis check · not ready').disabled, true)
  assert.equal(button('Retry thesis check').disabled, false)
  assert.equal(checks, 1)
  const retry = button('Retry thesis check')
  await act(async () => { retry.click(); retry.click() })
  assert.equal(checks, 2)
  assert.equal(button('Thesis check · checking').disabled, true)
  assert.equal(document.querySelector('dialog'), null)
  await act(async () => { pending.resolve(true); await pending.promise })
  assert.equal(document.querySelector('[data-qcu-entry]'), entry)
  assert.equal(button('Thesis check').disabled, false)
  assert.equal(button('Retry thesis check'), undefined)
  assert.equal(document.querySelector('dialog'), null)
  assert.equal(document.querySelector('input[type=file], iframe, webview'), null)
  assert.deepEqual(b.calls, [])
  await click(button('Thesis check'))
  assert.equal(checks, 3)
  assert.equal(b.calls.filter(call => call[0] === 'open').length, 1)
  assert.equal(JSON.stringify(b.calls).includes('synthetic-session'), false)
  await f.unmount()
  assert.equal(observerCount, 0)
})

test('retry stays available after false or failed readiness without rendering native details', async () => {
  const b = bridge()
  let checks = 0
  b.value.available = async () => {
    if (++checks === 3) throw new Error('synthetic-private-native-details')
    return false
  }
  const f = await mounted(b.value)
  await click(button('Retry thesis check'))
  assert.equal(button('Thesis check · not ready').disabled, true)
  await click(button('Retry thesis check'))
  assert.equal(button('Retry thesis check').disabled, false)
  assert.equal(checks, 3)
  assert.equal(document.body.textContent.includes('synthetic-private'), false)
  assert.equal(document.querySelector('dialog'), null)
  assert.deepEqual(b.calls, [])
  await f.unmount()
})

test('unmount retires pending initial and retry availability without reviving the entry', async () => {
  for (const retrying of [false, true]) {
    const b = bridge()
    const pending = deferred()
    let checks = 0
    b.value.available = () => ++checks === 1 && retrying ? Promise.resolve(false) : pending.promise
    const f = await mounted(b.value)
    if (retrying) await click(button('Retry thesis check'))
    assert.equal(button('Thesis check · checking').disabled, true)
    await f.unmount()
    assert.equal(document.getElementById('test-root').innerHTML, '')
    const next = bridge()
    next.value.available = async () => false
    const replacement = await mounted(next.value)
    const entry = document.querySelector('[data-qcu-entry]')
    await act(async () => { pending.resolve(true); await pending.promise })
    assert.equal(document.querySelector('[data-qcu-entry]'), entry)
    assert.equal(button('Thesis check · not ready').disabled, true)
    assert.equal(button('Thesis check'), undefined)
    assert.equal(document.querySelector('dialog'), null)
    assert.deepEqual(b.calls, [])
    assert.deepEqual(next.calls, [])
    await replacement.unmount()
    assert.equal(document.querySelector('[data-qcu-client-style]'), null)
    assert.equal(observerCount, 0)
  }
})

test('a native close failure keeps restart-required lockout and never offers retry', async () => {
  const b = bridge()
  b.value.close = async () => { throw new Error('synthetic-private-close-details') }
  const f = await mounted(b.value)
  await click(button('Thesis check'))
  await click(button('Close panel'))
  assert.equal(button('Thesis check · not enabled').disabled, true)
  assert.equal(button('Retry thesis check'), undefined)
  assert.match(document.querySelector('[role=alert]').textContent, /Restart the desktop app/)
  assert.equal(document.body.textContent.includes('synthetic-private'), false)
  assert.equal(document.querySelector('dialog'), null)
  await f.unmount()
})

test('real artifact requires an explicit click, suppresses duplicates, and sends no Session identifier', async () => {
  const b = bridge()
  const f = await mounted(b.value)
  assert.deepEqual(b.calls, [])
  await act(async () => { button('Thesis check').click(); button('Thesis check').click() })
  assert.equal(b.calls.filter(call => call[0] === 'open').length, 1)
  const open = b.calls[0]
  assert.match(open[1], /^[0-9a-f-]{36}$/)
  assert.deepEqual(open[2], { x: 24, y: 140, width: 752, height: 460 })
  assert.equal(JSON.stringify(b.calls).includes('synthetic-session'), false)
  assert.equal(document.querySelector('[data-qcu-native-placeholder]').textContent, '')
  assert.match(document.querySelector('.qcu-panel-note').textContent, /does not stop/)
  await click(button('Back'))
  assert.equal(b.calls.at(-1)[0], 'back')
  await click(button('Close panel'))
  assert.equal(b.calls.at(-1)[0], 'close')
  assert.equal(document.querySelector('dialog'), null)
  await f.unmount()
  assert.equal(observerCount, 0)
})

test('cancel, Session changes and unmount retire pending and open occurrences', async () => {
  const b = bridge()
  const pending = deferred()
  b.value.open = (...args) => { b.calls.push(['open', ...args]); return pending.promise }
  const f = await mounted(b.value)
  await click(button('Thesis check'))
  await click(button('Cancel opening'))
  assert.equal(document.querySelector('dialog'), null)
  await act(async () => { pending.resolve(); await pending.promise })
  assert.equal(document.querySelector('dialog'), null)
  b.value.open = async (...args) => { b.calls.push(['open', ...args]) }
  await click(button('Thesis check'))
  const second = b.calls.findLast(call => call[0] === 'open')[1]
  await f.rerender({ sessionId: 'synthetic-session-2' })
  assert.equal(document.querySelector('dialog'), null)
  assert.ok(b.calls.some(call => call[0] === 'close' && call[1] === second))
  await click(button('Thesis check'))
  const third = b.calls.findLast(call => call[0] === 'open')[1]
  await f.unmount()
  assert.ok(b.calls.some(call => call[0] === 'close' && call[1] === third))
  assert.equal(observerCount, 0)
})

test('main-view retain loss closes the view even if the Session remains retained', async () => {
  const b = bridge()
  const f = await mounted(b.value)
  await click(button('Thesis check'))
  await f.rerender({ useSessionRetainInfo: selector => selector({ retainedBy: { mainView: 0, background: 1 } }) })
  assert.equal(document.querySelector('[data-qcu-entry]'), null)
  assert.equal(b.calls.at(-1)[0], 'close')
  await f.unmount()
})

test('Escape-style cancel event closes the native occurrence and local dialog', async () => {
  const b = bridge()
  const f = await mounted(b.value)
  await click(button('Thesis check'))
  await act(async () => { document.querySelector('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true, bubbles: true })) })
  assert.equal(document.querySelector('dialog'), null)
  assert.equal(b.calls.at(-1)[0], 'close')
  await f.unmount()
})

test('a missing native-dialog browser primitive fails before opening and removes its observer', async () => {
  const original = dom.window.HTMLDialogElement.prototype.showModal
  dom.window.HTMLDialogElement.prototype.showModal = function () { throw new Error('synthetic unavailable dialog') }
  const b = bridge()
  const f = await mounted(b.value)
  try {
    await click(button('Thesis check'))
    assert.equal(document.querySelector('dialog'), null)
    assert.match(document.querySelector('[role=alert]').textContent, /could not be opened/)
    assert.deepEqual(b.calls, [])
    assert.equal(observerCount, 0)
  } finally {
    dom.window.HTMLDialogElement.prototype.showModal = original
    await f.unmount()
  }
})


test('one Tools selector names the business and opening the selector never opens a native task', async () => {
  const b = bridge(); const f = await mounted(b.value);
  const menu = document.querySelector('details.qcu-tools');
  assert.equal(document.querySelectorAll('summary').length, 1);
  assert.equal(menu.querySelector('summary').textContent, 'Tools');
  assert.equal(menu.open, false);
  await act(async () => { menu.open = true; menu.dispatchEvent(new dom.window.Event('toggle')); });
  assert.deepEqual(b.calls, []);
  assert.equal(document.querySelector('dialog'), null);
  await click(button('Thesis check'));
  assert.equal(menu.open, false);
  assert.equal(b.calls.filter(call => call[0] === 'open').length, 1);
  await f.unmount();
});
