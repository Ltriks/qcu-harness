import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const html = await readFile(new URL('../hub-request-demo.html', import.meta.url), 'utf8')
test('Hub demo creates only the four-field request and never navigates or fetches', () => {
  const nodes = new Map(['#prepare', '#request', '#handoff'].map(key => [key, { textContent: '' }]))
  let click
  nodes.get('#prepare').addEventListener = (name, handler) => {
    assert.equal(name, 'click'); click = handler
  }
  const context = vm.createContext({
    document: { querySelector: selector => nodes.get(selector) },
    crypto: { randomUUID: () => 'a3f38b66-a45b-4120-a72f-6b97e1a13d9d' }, URLSearchParams,
    fetch: () => assert.fail('No network in demo'),
    location: Object.freeze({}),
  })
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  vm.runInContext(script, context); click()
  const [json, url] = nodes.get('#request').textContent.split('\n\n')
  assert.deepEqual(Object.keys(JSON.parse(json)), ['catalogID', 'packageID', 'version', 'requestID'])
  assert.equal(new URL(url).protocol, 'qcu-install:')
  assert.match(nodes.get('#handoff').textContent, /不调用系统处理器/)
  assert.match(html, /connect-src 'none'/)
})

test('UI copy distinguishes the city protocol from official DSH and real install', () => {
  assert.match(html, /不是官方 dsh:\/\/ 安装接口/)
  assert.match(html, /不能完成实际安装/)
})
