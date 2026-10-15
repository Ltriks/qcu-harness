import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

// Reuse the same audited runtime as hub-web-install; never install dependencies.
const require = createRequire(process.env.QCU_HUB_TEST_RUNTIME || import.meta.url)
const { JSDOM, VirtualConsole } = require('jsdom')
const html = await readFile(new URL('../hub/web/index.html', import.meta.url), 'utf8')
const published = JSON.parse(await readFile(new URL('../hub/release/study-coach-lan.catalog.json', import.meta.url), 'utf8'))
const pin = 'http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz'
const release = 'https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2'
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

async function page(t, { clipboard, fetchImpl, url = 'http://192.168.1.68:8080/', stored, scripts = true } = {}) {
  const errors = [], requests = [], opens = [], timers = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error.message))
  const dom = new JSDOM(html, {
    url, referrer: 'https://untrusted.example/other.tgz', virtualConsole,
    ...(scripts ? { runScripts: 'dangerously' } : {}),
    beforeParse(window) {
      window.fetch = async (...args) => {
        requests.push(args)
        return fetchImpl ? fetchImpl(...args) : { ok: true, json: async () => structuredClone(published) }
      }
      window.open = (...args) => opens.push(args)
      window.setTimeout = (...args) => { timers.push(args); return 1 }
      if (clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: clipboard })
      for (const [key, value] of Object.entries(stored || {})) window.localStorage.setItem(key, value)
    }
  })
  t.after(() => dom.window.close())
  await tick()
  const document = dom.window.document
  const entry = document.querySelector('#qcu-teacher-entry')
  assert.ok(entry, 'teacher entry must exist independently of catalog')
  return {
    dom, document, entry, errors, requests, opens, timers,
    output: entry.querySelector('#qcu-market-url'),
    copy: entry.querySelector('#qcu-copy-market'),
    status: entry.querySelector('#qcu-copy-status')
  }
}

function assertPin(p) {
  assert.equal(p.output.value, pin)
  assert.equal(p.entry.querySelector('#qcu-market-download').getAttribute('href'), pin)
  const launch = p.entry.querySelector('#qcu-open-dsh')
  assert.equal(launch.getAttribute('href'), 'dsh://open')
  assert.equal(launch.textContent.trim(), '打开 DSH')
}

test('static entry works without JavaScript or catalog; fixed links, labelled selectable address and collapsed details', async t => {
  const p = await page(t, { scripts: false })
  assertPin(p)
  assert.ok(p.output.readOnly)
  assert.ok(p.entry.querySelector(`label[for="${p.output.id}"]`))
  assert.equal(p.entry.querySelector('a[href="' + release + '"]').getAttribute('rel'), 'noopener noreferrer')
  assert.equal(p.entry.querySelectorAll('.qcu-steps > li').length, 3)
  for (const details of p.entry.querySelectorAll('details')) assert.equal(details.open, false)
  assert.ok(p.entry.compareDocumentPosition(p.document.querySelector('.meta')) & p.dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
})

test('load makes only existing catalog request, never clipboard writes, custom-scheme launches or install requests', async t => {
  const writes = []
  const p = await page(t, { clipboard: { writeText: async text => writes.push(text) } })
  assertPin(p)
  assert.deepEqual(writes, [])
  assert.deepEqual(p.opens, [])
  assert.deepEqual(p.timers, [])
  assert.deepEqual(JSON.parse(JSON.stringify(p.requests)), [['./catalog.json', { cache: 'no-store' }]])
  assert.equal(p.dom.window.localStorage.length, 0)
  assert.deepEqual(p.errors, [])
})

test('fulfilled Clipboard promise copies exact pin and then announces success', async t => {
  const writes = []
  const p = await page(t, { clipboard: { writeText: async text => writes.push(text) } })
  p.copy.click()
  await tick()
  assert.deepEqual(writes, [pin])
  assert.match(p.status.textContent, /^已复制/)
  assert.equal(p.status.getAttribute('role'), 'status')
  assert.equal(p.status.getAttribute('aria-live'), 'polite')
  assert.equal(p.copy.disabled, false)
  assert.equal(p.requests.length, 1)
})

for (const mode of ['absent', 'rejected']) {
  test(`HTTP Clipboard ${mode} selects complete visible URL and announces manual copy`, async t => {
    const p = await page(t, { clipboard: mode === 'rejected' ? { writeText: async () => { throw Error('denied') } } : undefined })
    p.copy.click()
    await tick()
    assert.equal(p.document.activeElement, p.output)
    assert.equal(p.output.selectionStart, 0)
    assert.equal(p.output.selectionEnd, pin.length)
    assert.match(p.status.textContent, /自动复制不可用，请按 ⌘C \/ Ctrl\+C/)
    assert.doesNotMatch(p.status.textContent, /已复制/)
    assert.equal(p.copy.disabled, false)
    assert.deepEqual(p.errors, [])
  })
}

test('deferred copy cannot report success early, repeat click is gated, and a later failure clears stale success', async t => {
  let resolve, reject, count = 0
  const p = await page(t, { clipboard: { writeText: () => {
    count++
    return new Promise((yes, no) => { resolve = yes; reject = no })
  } } })
  p.copy.click()
  p.copy.click()
  assert.equal(count, 1)
  assert.equal(p.copy.disabled, true)
  assert.doesNotMatch(p.status.textContent, /已复制/)
  resolve()
  await tick()
  assert.match(p.status.textContent, /^已复制/)
  p.copy.click()
  assert.doesNotMatch(p.status.textContent, /已复制/)
  reject(Error('later denied'))
  await tick()
  assert.match(p.status.textContent, /自动复制不可用/)
  assertPin(p)
})

for (const mode of ['offline', '503', 'invalid-json', 'malformed']) {
  test(`catalog ${mode} cannot prevent bootstrap copy or remove fixed actions`, async t => {
    let copied
    const p = await page(t, {
      clipboard: { writeText: async text => { copied = text } },
      fetchImpl: async () => {
        if (mode === 'offline') throw Error('offline')
        return { ok: mode !== '503', status: 503, json: async () => {
          if (mode === 'invalid-json') throw Error('invalid JSON')
          return { plugins: [null] }
        } }
      }
    })
    assert.match(p.document.querySelector('#hint').textContent, /无法加载 catalog.json/)
    assertPin(p)
    p.copy.click()
    await tick()
    assert.equal(copied, pin)
    assert.deepEqual(p.errors, [])
  })
}

test('foreign origin, query/hash, storage, referrer and malicious catalog do not control bootstrap target', async t => {
  const catalog = structuredClone(published)
  catalog.title = '<img src=x onerror="window.injected=true">'
  Object.assign(catalog.plugins[0], { id: 'qcu-market', version: 'latest', file: 'https://untrusted.example/evil.tgz', sha256: 'bad' })
  let copied
  const p = await page(t, {
    url: 'http://127.0.0.1:9999/?url=https://untrusted.example/evil.tgz#dsh://install',
    stored: { 'qcu-market-url': 'https://untrusted.example/evil.tgz', 'chengyuan-catalog-theme': 'neobrutal' },
    fetchImpl: async () => ({ ok: true, json: async () => catalog }),
    clipboard: { writeText: async text => { copied = text } }
  })
  assert.equal(p.document.documentElement.dataset.theme, 'neobrutal')
  assertPin(p)
  assert.equal(p.dom.window.injected, undefined)
  assert.equal(p.entry.querySelector('img'), null)
  p.copy.click()
  await tick()
  assert.equal(copied, pin)
  assert.deepEqual(p.opens, [])
  assert.equal(p.requests.length, 1)
})

test('bootstrap is usable while catalog request is still pending; selectable text is never the copy authority', async t => {
  let copied
  const p = await page(t, {
    fetchImpl: () => new Promise(() => {}),
    clipboard: { writeText: async text => { copied = text } }
  })
  assertPin(p)
  p.output.value = 'https://untrusted.example/evil.tgz'
  p.copy.click()
  await tick()
  assert.equal(copied, pin)
  assertPin(p)
  assert.equal(p.requests.length, 1)
})

test('launch stays an explicit plain anchor with no custom-scheme code or external script', () => {
  const dom = new JSDOM(html)
  try {
    const scripts = [...dom.window.document.querySelectorAll('script')]
    assert.ok(scripts.every(script => !script.src))
    assert.ok(scripts.every(script => !script.textContent.includes('dsh://')))
    assert.equal(dom.window.document.querySelectorAll('a[href^="dsh:"]').length, 1)
  } finally { dom.window.close() }
})

test('fallback preserves actual-path and cache-error boundaries; metadata does not claim browser verification', async t => {
  const p = await page(t)
  const fallback = p.entry.querySelector('#qcu-file-fallback')
  assert.match(fallback.querySelector('summary').textContent, /下载文件安装（备选）/)
  assert.match(fallback.textContent, /无需解压/)
  assert.match(fallback.textContent, /⌥⌘C/)
  assert.match(fallback.textContent, /长期保留/)
  assert.match(fallback.textContent, /网页无法读取.*绝对路径/)
  assert.doesNotMatch(fallback.textContent, /\/Users\/|~\/Downloads/)
  const metadata = p.entry.querySelector('#qcu-package-details')
  assert.match(metadata.textContent, /43446/)
  assert.match(metadata.textContent, /bb1e5c80a01f26f1ab147717cbd9f79b57b198e3/)
  assert.match(metadata.textContent, /未.*校验.*SHA256/)
  assert.match(metadata.textContent, /不.*独立.*认证/)
  assert.match(p.entry.textContent, /缺失 integrity.*停止.*维护者/)
  assert.match(p.entry.textContent, /新机器.*首次.*尚未.*验收/)
  assert.doesNotMatch(p.entry.textContent, /已安装|已启用|已检测|一键安装|已打开成功/)
  assert.equal(p.entry.querySelectorAll('[onclick]').length, 0)
})

test('existing plugin tab, filters and legacy install instructions still function alongside teacher entry', async t => {
  const p = await page(t)
  assert.equal(p.document.querySelector('#tab-plugins').getAttribute('aria-pressed'), 'true')
  const coach = [...p.document.querySelectorAll('article')].find(x => x.querySelector('h2')?.textContent.includes('学习方法教练'))
  assert.ok(coach.querySelector('[data-copy="install"] textarea').value.includes(published.plugins[1].sha256))
  p.document.querySelector('#tab-skills').click()
  assert.equal(p.document.querySelector('#tab-skills').getAttribute('aria-pressed'), 'true')
  p.document.querySelector('#tab-plugins').click()
  assert.equal(p.document.querySelectorAll('#list article').length, published.plugins.length)
  p.document.querySelector('#filters button').click()
  assertPin(p)
  assert.deepEqual(p.errors, [])
})
