/** Built Client DOM proof; does not certify OS chooser/save dialogs. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { expect, it, vi } from 'vitest'
import { TaskPage, apply } from '../lib/client.js'
it('contributes a root task panel instead of a Session-header entry', () => {
  const seats = []
  const ctx = { slots: { inject: (name, factory) => { seats.push(name); factory() }, register: () => () => {} } }
  apply(ctx)
  expect(seats).toEqual(['main', 'sidebar.panellist'])
})
it('renders a no-Session chooser under StrictMode, confirms before reading, and clears selection on cancel', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1/' })
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const calls = []
  let counter = 0
  let failCheck = false
  vi.stubGlobal('fetch', async (_path, init) => {
    const body = JSON.parse(init.body); calls.push(body)
    if (body.operation === 'open') return Response.json({ page: (++counter).toString(16).padStart(32, '0'), limits: { maxInputBytes: 1000, maxRuleBytes: 1000 } })
    if (body.operation === 'authorize') return Response.json({ taskId: '2'.repeat(32), expiresAt: Date.now() + 60000 })
    if (body.operation === 'check' && failCheck) return Response.json({ error: 'synthetic failure' }, { status: 400 })
    return Response.json({ cleared: true })
  })
  const root = createRoot(document.getElementById('root'))
  try {
    await React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(TaskPage))) })
    const picker = document.querySelector('input[type="file"]')
    expect(picker.disabled).toBe(false)
    const read = vi.fn(async () => new TextEncoder().encode('id\n0001\n').buffer)
    Object.defineProperty(picker, 'files', { configurable: true, value: [{ name: 'synthetic.csv', size: 8, arrayBuffer: read }] })
    // JSDOM does not populate a real chooser value. This nonempty synthetic
    // sentinel makes deletion of the retry-reset code fail the regression.
    Object.defineProperty(picker, 'value', { configurable: true, writable: true, value: 'synthetic-selected.csv' })
    await React.act(async () => { picker.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
    expect(read).not.toHaveBeenCalled()
    const authorize = [...document.querySelectorAll('button')].find(button => button.textContent === '授权本次文件')
    expect(authorize.disabled).toBe(true)
    await React.act(async () => { document.querySelector('input[type="checkbox"]').click() })
    expect(authorize.disabled).toBe(false)
    await React.act(async () => { authorize.click() })
    expect(read).toHaveBeenCalledOnce()
    failCheck = true
    await React.act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === '检查 / 再次检查').click() })
    await React.act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === '重试清理').click() })
    expect(picker.value).toBe('')
    expect(document.body.textContent).toContain('等待选择文件')
    picker.value = 'synthetic-selected-again.csv'
    await React.act(async () => { picker.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
    expect(document.body.textContent).toContain('等待逐文件授权')
    await React.act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === '取消并撤销').click() })
    expect(picker.value).toBe('')
    expect(document.body.textContent).toContain('等待选择文件')
    expect(calls.some(call => call.operation === 'authorize' && call.consent === true)).toBe(true)
  } finally {
    await React.act(async () => { root.unmount() })
    vi.unstubAllGlobals(); dom.window.close()
  }
})
