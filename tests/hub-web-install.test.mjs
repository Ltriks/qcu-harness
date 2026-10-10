import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const runtime = process.env.QCU_HUB_TEST_RUNTIME
const require = createRequire(runtime || import.meta.url)
const { JSDOM, VirtualConsole } = require('jsdom')
const html = await readFile(new URL('../hub/web/index.html', import.meta.url), 'utf8')
const published = JSON.parse(await readFile(new URL('../hub/release/study-coach-lan.catalog.json', import.meta.url), 'utf8'))
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function page(t, { clipboard, catalog = structuredClone(published), httpOk = true } = {}) {
  const errors = [], fetches = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', e => errors.push(e.message))
  const dom = new JSDOM(html, {
    url: 'http://192.168.1.68:8080/', runScripts: 'dangerously', virtualConsole,
    beforeParse(window) {
      window.fetch = async (path, options) => {
        fetches.push({ path, options })
        return { ok: httpOk, status: httpOk ? 200 : 503, json: async () => catalog }
      }
      if (clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: clipboard })
    }
  })
  t.after(() => dom.window.close())
  await tick()
  const document = dom.window.document
  const coach = [...document.querySelectorAll('article')].find(x => x.querySelector('h2')?.textContent.includes('学习方法教练'))
  return { dom, document, coach, errors, fetches }
}
const group = (card, type) => card.querySelector(`[data-copy="${type}"]`)

test('real page code shows pinned package and starts on available plugin tab', async t => {
  const { document, coach, errors, fetches } = await page(t)
  assert.equal(document.querySelector('#tab-plugins').getAttribute('aria-pressed'), 'true')
  assert.equal(document.querySelector('#pluginCount').textContent, '2')
  assert.ok(coach.textContent.includes('v0.1.0-pilot.1'))
  assert.equal(group(coach, 'hash').querySelector('textarea').value, published.plugins[1].sha256)
  assert.equal(coach.querySelector('a').href, 'http://192.168.1.68:8080/plugins/' + published.plugins[1].file)
  assert.equal(coach.querySelectorAll('ol li').length, 6)
  assert.match(coach.textContent, /下载完成不代表已安装/)
  assert.deepEqual(errors, [])
  assert.deepEqual(JSON.parse(JSON.stringify(fetches)), [{ path: './catalog.json', options: { cache: 'no-store' } }])
})

test('no invented Downloads path or URL target; explicit path is quoted and never uploaded', async t => {
  const { dom, coach, fetches } = await page(t)
  const input = coach.querySelector('input'), output = group(coach, 'install').querySelector('textarea')
  assert.match(output.value, /找不到请问我，不猜下载目录/)
  assert.match(output.value, /只有实际文件哈希和版本一致/)
  assert.match(output.value, /真实审批/)
  assert.match(output.value, /不要把 URL 直接传作安装目标/)
  assert.doesNotMatch(output.value, /~\/Downloads|curl|wget/)
  const path = '/Users/test/Downloads/学习教练 "copy" $(echo no).tgz'
  input.value = path
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.ok(output.value.includes('target=' + JSON.stringify(path)))
  assert.ok(output.value.includes(published.plugins[1].sha256))
  assert.equal(fetches.length, 1)
  assert.equal(dom.window.localStorage.length, 0)
})

test('HTTP clipboard absent selects persistent manual text with truthful feedback', async t => {
  const { document, coach, errors } = await page(t)
  const copy = group(coach, 'install'), text = copy.querySelector('textarea')
  copy.querySelector('button').click()
  await tick()
  assert.equal(document.activeElement, text)
  assert.equal(text.selectionStart, 0)
  assert.equal(text.selectionEnd, text.value.length)
  assert.match(copy.querySelector('[role=status]').textContent, /自动复制不可用.*手动复制/)
  assert.doesNotMatch(copy.querySelector('[role=status]').textContent, /已复制/)
  assert.deepEqual(errors, [])
})

test('clipboard rejection falls back while fulfilled clipboard reports actual copied text', async t => {
  const failed = await page(t, { clipboard: { writeText: async () => { throw Error('denied') } } })
  group(failed.coach, 'hash').querySelector('button').click()
  await tick()
  assert.match(group(failed.coach, 'hash').querySelector('[role=status]').textContent, /手动复制/)
  let copied
  const success = await page(t, { clipboard: { writeText: async text => { copied = text } } })
  group(success.coach, 'install').querySelector('button').click()
  await tick()
  assert.equal(copied, group(success.coach, 'install').querySelector('textarea').value)
  assert.match(group(success.coach, 'install').querySelector('[role=status]').textContent, /^已复制/)
})

test('path changed during clipboard wait does not claim current instruction copied', async t => {
  let resolve
  const { dom, coach } = await page(t, { clipboard: { writeText: () => new Promise(r => { resolve = r }) } })
  const copy = group(coach, 'install'), input = coach.querySelector('input')
  copy.querySelector('button').click()
  input.value = '/Users/test/new.tgz'
  input.dispatchEvent(new dom.window.Event('input'))
  resolve()
  await tick()
  assert.match(copy.querySelector('[role=status]').textContent, /指令已更新，请重新复制/)
})

test('invalid target cannot copy a stale path; clear restores gated discovery', async t => {
  const { dom, coach } = await page(t)
  const input = coach.querySelector('input'), copy = group(coach, 'install')
  for (const path of ['~/Downloads/file.tgz', 'file.tgz', 'https://example.test/file.tgz', '//server/file.tgz', '/tmp/a\u0000b']) {
    input.value = path
    input.dispatchEvent(new dom.window.Event('input'))
    assert.equal(copy.querySelector('button').disabled, true)
    assert.equal(copy.querySelector('textarea').value, '')
  }
  input.value = ''
  input.dispatchEvent(new dom.window.Event('input'))
  assert.equal(copy.querySelector('button').disabled, false)
  assert.match(copy.querySelector('textarea').value, /先取得.*真实本机绝对路径/)
  input.value = 'C:\\Users\\Test\\Downloaded coach.tgz'
  input.dispatchEvent(new dom.window.Event('input'))
  assert.equal(copy.querySelector('button').disabled, false)
  assert.ok(copy.querySelector('textarea').value.includes(JSON.stringify(input.value)))
})

test('malformed/unreviewed package metadata never generates install or download action', async t => {
  for (const mutation of [{ sha256: 'missing' }, { file: '../evil.tgz' }, { review: 'pending' }, { version: 'latest' }, { defaultDisabled: false }, { dshVersions: ['*'] }, { dshVersions: '*' }]) {
    const catalog = structuredClone(published)
    Object.assign(catalog.plugins[1], mutation)
    const { coach, errors } = await page(t, { catalog })
    assert.equal(coach.querySelector('.install-guide'), null)
    assert.equal(coach.querySelector('a'), null)
    assert.match(coach.textContent, /暂不提供安装指令/)
    assert.deepEqual(errors, [])
  }
})

test('restart then actual row/skill instructions retain approval, reject and evidence gates', async t => {
  const { coach } = await page(t)
  const enable = group(coach, 'enable').querySelector('textarea').value
  assert.match(enable, /正常重启后/)
  assert.match(enable, /真实返回的完整 entryId/)
  assert.match(enable, /真实审批/)
  assert.match(enable, /拒绝就停止/)
  assert.match(enable, /再次重启/)
  const call = group(coach, 'call').querySelector('textarea').value
  assert.match(call, /官方 Skill 工具真实调用 chengyuan-study-coach/)
  assert.match(call, /展开工具结果/)
  assert.match(call, /缺失就报告未生效/)
})

test('catalog error is shown; labels are text and cannot execute catalog HTML', async t => {
  const failed = await page(t, { httpOk: false })
  assert.match(failed.document.querySelector('#hint').textContent, /HTTP 503/)
  assert.equal(failed.document.querySelectorAll('article').length, 0)
  const catalog = structuredClone(published)
  catalog.plugins[1].category = '<img src=x onerror="window.injected=true">'
  const safe = await page(t, { catalog })
  assert.equal(safe.dom.window.injected, undefined)
  assert.equal(safe.coach.querySelectorAll('img').length, 0)
})
