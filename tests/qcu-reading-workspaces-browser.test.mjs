// Real Chromium + shared reading UI/controller + isolated disk stores. No native DSH or real model.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

assert.ok(process.env.QCU_OFFICIAL_DEPENDENCIES && process.env.QCU_BROWSER_DEPENDENCIES, 'Use the existing audited dependencies; no installs')
const sdk = createRequire(join(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES), 'package.json'))
const {chromium} = createRequire(join(resolve(process.env.QCU_BROWSER_DEPENDENCIES), 'package.json'))('playwright')
const packageRoot = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(resolve(process.env.QCU_READING_PACKAGE_ROOT) + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', packageRoot))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', packageRoot))
const {VERSION, PROTOCOL, OUTPUT_BUDGET} = await import(new URL('src/protocol.mjs', packageRoot))

test('actual refresh UI discovers B without remount, preserves A/consent/drafts, retries failure, requires reselection and isolates stores at 360px', {timeout:60000}, async t => {
  const out = resolve(process.env.QCU_READING_WORKSPACES_BROWSER_OUT ?? '.work/qcu-reading-workspace-refresh/refresh-browser')
  await mkdir(out, {recursive:true})
  const runOut = await mkdtemp(join(out, 'run-')), profile = join(runOut, 'chromium-disposable'), stores = new Map()
  const A = {id:'A', title:'自编工作区 A'}, B = {id:'B', title:'自编工作区 B'}, registry = [A]
  const evidence = {syntheticOnly:true, realModel:false, nativeDSH:false, nativeFileChooser:false, packageRoot:fileURLToPath(packageRoot), node:process.version, arch:process.arch, screenshots:[], checks:[], external:[], errors:[], requests:[], modelCalls:0, serverClosed:false}
  const store = async id => {
    if (!stores.has(id)) {
      const directory = join(runOut, 'workspaces', id); await mkdir(directory, {recursive:true})
      stores.set(id, await new ReadingStore(directory, {
        model:async () => ({provider:'synthetic', model:'本地合成测试', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:OUTPUT_BUDGET}}),
        generate:async () => { evidence.modelCalls++; assert.fail('No generation is authorized in the discovery browser test') }
      }).init())
    }
    return stores.get(id)
  }
  const a = await store('A')
  await a.importDocument({name:'自编反馈 A.md', content:'反馈帮助学生调整学习方法。\n\n有效反馈要及时提供。'})
  const here = fileURLToPath(packageRoot)
  const entry = `import React from ${JSON.stringify(sdk.resolve('react'))};import {createRoot} from ${JSON.stringify(sdk.resolve('react-dom/client'))};import {createReadingViews} from ${JSON.stringify(join(here, 'src/view.mjs'))};import {ReadingController} from ${JSON.stringify(join(here, 'src/controller.mjs'))};const c=new ReadingController({dispatch:async payload=>(await fetch('/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:payload})).text()});const {Page}=createReadingViews(React);createRoot(document.getElementById('panel')).render(React.createElement(Page,{controller:c}));c.boot();`
  await sdk('esbuild').build({stdin:{contents:entry, resolveDir:here}, bundle:true, outfile:join(runOut, 'app.js')})
  let gate, failList = false, context
  const server = createServer(async (req, res) => {
    try {
      assert.equal(req.headers.host, '127.0.0.1:' + server.address().port)
      res.setHeader('cache-control', 'no-store')
      res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'")
      if (req.method === 'POST' && req.url === '/dispatch') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk)
        const request = JSON.parse(Buffer.concat(chunks).toString()); evidence.requests.push(request)
        let value
        if (request.action === 'workspaces') {
          const list = structuredClone(registry), wait = gate
          if (wait) await wait
          if (failList) throw Error('synthetic registry failure')
          value = list
        } else {
          assert.ok(registry.some(w => w.id === request.workspaceId))
          value = await dispatchStore(await store(request.workspaceId), request, new AbortController().signal)
        }
        res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:true, version:VERSION, protocol:PROTOCOL, value})); return
      }
      if (req.method === 'GET' && req.url === '/app.js') { res.setHeader('content-type', 'text/javascript'); res.end(await readFile(join(runOut, 'app.js'))); return }
      if (req.method === 'GET' && req.url === '/') {
        res.setHeader('content-type', 'text/html;charset=utf-8')
        res.end('<!doctype html><html lang="zh-CN" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工作区刷新 · 合成测试</title><style>html,body,#panel{height:100%;margin:0;font-family:system-ui}</style><div id="panel"></div><script src="/app.js"></script></html>'); return
      }
      res.writeHead(404).end()
    } catch (e) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:false, error:e.code ?? 'operation-failed'})) }
  })
  t.after(async () => {
    await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
    for (const s of stores.values()) await s.dispose()
    evidence.serverClosed = !server.listening
    await writeFile(join(runOut, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2) + '\n')
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const url = 'http://127.0.0.1:' + server.address().port; evidence.url = url; evidence.serverPid = process.pid
  const executablePath = process.env.QCU_READING_CHROMIUM ?? '/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
  context = await chromium.launchPersistentContext(profile, {ignoreDefaultArgs:true, args:['--headless', '--user-data-dir=' + profile, '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync'], executablePath, headless:true, chromiumSandbox:true, viewport:{width:1280, height:920}})
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== url) { evidence.external.push(route.request().url()); return route.abort() }
    return route.continue()
  })
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message))
  const button = name => page.getByRole('button', {name, exact:true}), picker = page.getByRole('combobox', {name:'工作区', exact:true})
  const original = page.getByRole('main', {name:'原文'}), confirmation = page.getByRole('region', {name:'发送前确认'})
  const shot = async name => { const path = join(runOut, name + '.png'); await page.screenshot({path}); evidence.screenshots.push(path) }
  await page.goto(url); await original.getByRole('heading', {name:'自编反馈 A.md'}).waitFor()
  await page.getByRole('button', {name:'选择段落 p0001', exact:true}).click()
  await page.getByLabel('我的笔记', {exact:true}).fill('已保存的 A 笔记'); await button('保存摘录').click()
  await page.getByText('摘录已保存，重新打开仍会保留。', {exact:true}).waitFor()
  await page.getByLabel('我的笔记', {exact:true}).fill('尚未保存的 A 草稿')
  await page.getByLabel('问题', {exact:true}).fill('反馈如何帮助学生'); await button('准备问答').click()
  await confirmation.getByRole('checkbox').check()
  const beforeConfirmation = await confirmation.innerText(), beforeDisk = await readFile(join(runOut, 'workspaces/A/.qcu-reading/state.json'))
  registry.push(B)
  assert.equal(await picker.locator('option[value=B]').count(), 0); assert.equal(stores.has('B'), false)
  await shot('before-refresh-1280')
  let release; gate = new Promise(resolve => release = resolve)
  const at = evidence.requests.length
  await picker.focus(); await page.keyboard.press('Tab')
  assert.equal(await button('刷新工作区列表').evaluate(el => el === document.activeElement), true)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('button[aria-label="刷新工作区列表"]').getAttribute('aria-busy') === 'true')
  assert.equal(await button('刷新工作区列表').isDisabled(), true); await shot('refreshing-1280')
  gate = undefined; release()
  await page.getByText('工作区列表已刷新。', {exact:true}).waitFor()
  assert.equal(await picker.locator('option[value=B]').count(), 1); assert.equal(await picker.inputValue(), 'A')
  assert.equal(await page.getByLabel('问题', {exact:true}).inputValue(), '反馈如何帮助学生')
  assert.equal(await page.getByLabel('我的笔记', {exact:true}).inputValue(), '尚未保存的 A 草稿')
  assert.equal(await confirmation.innerText(), beforeConfirmation); assert.equal(await confirmation.getByRole('checkbox').isChecked(), true)
  assert.deepEqual(evidence.requests.slice(at), [{action:'workspaces'}]); assert.equal(stores.has('B'), false)
  assert.deepEqual(await readFile(join(runOut, 'workspaces/A/.qcu-reading/state.json')), beforeDisk)
  await shot('refreshed-consent-1280')
  evidence.checks.push('keyboard refresh after registry addition, busy state, B visible without remount, A document/notes/question/unsaved draft/prepared consent unchanged, discovery-only RPC, no B store opened')

  await page.setViewportSize({width:360, height:920}); await button('问答').click()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
    const geometry = await page.locator('.qr-workspaces').evaluate(el => { const r = el.getBoundingClientRect(); return {left:r.left, right:r.right, viewport:innerWidth, overflow:document.documentElement.scrollWidth > innerWidth} })
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport); assert.equal(geometry.overflow, false)
    assert.equal(await button('刷新工作区列表').isVisible(), true); await shot('refreshed-consent-360-' + theme)
  }
  failList = true; await button('刷新工作区列表').click(); await page.getByRole('alert').filter({hasText:'刷新工作区失败'}).waitFor()
  assert.equal(await confirmation.getByRole('checkbox').isChecked(), true); assert.equal(await picker.inputValue(), 'A'); await shot('refresh-failure-360')
  failList = false; await button('刷新工作区列表').click(); await page.getByText('工作区列表已刷新。', {exact:true}).waitFor()
  assert.equal(await page.getByRole('alert').count(), 0); assert.equal(await confirmation.getByRole('checkbox').isChecked(), true)
  registry.splice(0, 1); await button('刷新工作区列表').click()
  await page.getByRole('alert').filter({hasText:'当前工作区已不可用'}).waitFor()
  assert.equal(await picker.inputValue(), ''); assert.equal(await confirmation.count(), 0); assert.equal(stores.has('B'), false)
  await page.getByRole('heading', {name:'先选择一个工作区'}).waitFor(); await shot('missing-reselection-360')
  assert.deepEqual(await readFile(join(runOut, 'workspaces/A/.qcu-reading/state.json')), beforeDisk)
  evidence.checks.push('360px light/dark layout and focusable refresh, registry failure preserves consent and retries, missing A requires explicit selection and invalidates confirmation without deleting data')

  await picker.selectOption('B'); await button('原文').click(); await page.getByText('把材料放在手边', {exact:true}).waitFor()
  assert.equal(await page.locator('.qr-docs li').count(), 0); assert.equal(await page.getByLabel('问题', {exact:true}).inputValue(), '')
  await page.getByLabel('选择 TXT、Markdown、PDF 或 DOCX 文件').setInputFiles({name:'自编 B.md', mimeType:'text/markdown', buffer:Buffer.from('B 工作区独立材料。')})
  await button('原文').click(); await original.getByRole('heading', {name:'自编 B.md'}).waitFor()
  assert.equal((await stores.get('B').snapshot()).notes.length, 0)
  registry.unshift(A); await button('刷新工作区列表').click(); await page.getByText('工作区列表已刷新。', {exact:true}).waitFor()
  assert.equal(await picker.inputValue(), 'B'); await picker.selectOption('A')
  await original.getByRole('heading', {name:'自编反馈 A.md'}).waitFor()
  await original.getByText('已保存摘录（1）', {exact:true}).click(); await original.getByText('已保存的 A 笔记', {exact:true}).waitFor()
  assert.equal(await page.locator('.qr-docs li').count(), 1)
  assert.deepEqual(await readFile(join(runOut, 'workspaces/A/.qcu-reading/state.json')), beforeDisk)
  assert.equal(evidence.modelCalls, 0); assert.deepEqual(evidence.external, []); assert.deepEqual(evidence.errors, [])
  assert.equal(evidence.requests.filter(r => ['start', 'cancel'].includes(r.action)).length, 0)
  evidence.checks.push('explicit B selection opens its isolated empty store, B import stays separate, explicit A return retains saved note and original state bytes; zero model calls/start/cancel/external requests/page errors')
})
