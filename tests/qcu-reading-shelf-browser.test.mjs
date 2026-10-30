// Shared product UI, controller, RPC and real disposable stores. Synthetic history only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {pdfFixture, docxFixture} from './fixtures/qcu-reading-binary.mjs'
const sdk = createRequire(join(process.env.QCU_OFFICIAL_DEPENDENCIES, 'package.json'))
const {chromium} = createRequire(join(process.env.QCU_BROWSER_DEPENDENCIES, 'package.json'))('playwright')
const packageRoot = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(resolve(process.env.QCU_READING_PACKAGE_ROOT) + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', packageRoot))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', packageRoot))
const {VERSION, PROTOCOL, OUTPUT_BUDGET, LIMITS, safeCode, check} = await import(new URL('src/protocol.mjs', packageRoot))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

test('R2 real browser shelf/metadata/favorite sources, legacy history, full verified download, cancel/delete/refresh/workspace boundaries; zero new model calls', {timeout:120000}, async t => {
  const out = resolve(process.env.QCU_READING_SHELF_BROWSER_OUT ?? '.work/qcu-reading-r2-shelf/browser'); await mkdir(out, {recursive:true})
  const runOut = await mkdtemp(join(out, 'run-')), directory = join(runOut, 'A'); await mkdir(directory)
  const evidence = {packageRoot:fileURLToPath(packageRoot), node:process.version, syntheticSeedCalls:0, modelCalls:0, modelResolutions:0, native:false, business:false, external:[], errors:[], checks:[], screenshots:[], requests:[], browserClosed:false, serverClosed:false, passed:false}
  const options = {model:async () => { evidence.modelResolutions++; assert.fail('Browse/manage/export must not resolve a model') }, generate:async () => { evidence.modelCalls++; assert.fail('No new generation authorized') }}
  const route = {provider:'synthetic', model:'seed-only', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:OUTPUT_BUDGET}}
  const seed = await new ReadingStore(directory, {model:async () => route, generate:async () => { evidence.syntheticSeedCalls++; return '合成历史反馈 [S1]，待教师复核。' }}).init()
  const old = (await seed.importDocument({name:'自编课堂.md', content:'课堂反馈帮助学生调整学习方法。\n\n旧版稳定来源，不随别名变化。'})).document
  const p = await seed.prepare({documentId:old.id, question:'课堂反馈'}), r = await seed.start({intentId:p.id, requestId:'synthetic-history', consent:true, documentId:old.id, question:p.question, digest:p.digest}); await seed.jobs.get(r.id)?.promise
  const history = seed.run(r.id), pdf = pdfFixture(); await seed.importDocument({name:'保留原件.pdf', base64:pdf.toString('base64')})
  const originalNote = await seed.saveNote({documentId:old.id, locator:'p0001', text:'课堂反馈', comment:'升级前摘录'})
  const {library, ...legacy} = seed.state, legacyBytes = Buffer.from(JSON.stringify({...legacy, schemaVersion:2}, null, 2) + '\n')
  await seed.dispose(); const stateFile = join(directory, '.qcu-reading/state.json'); await writeFile(stateFile, legacyBytes)
  const a = await new ReadingStore(directory, options).init(), stores = new Map([['A', a]]), registry = [{id:'A', title:'合成工作区 A'}]
  assert.deepEqual(await readFile(stateFile), legacyBytes)
  let context, gate = null, releaseGate, failShelf = false, server
  t.after(async () => {
    releaseGate?.(); await context?.close(); evidence.browserClosed = !context || context.pages().length === 0
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    for (const s of stores.values()) await s.dispose()
    evidence.serverClosed = !server?.listening
    if (evidence.url) { await assert.rejects(fetch(evidence.url)); evidence.loopbackClosed = true }
    await writeFile(join(runOut, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2) + '\n')
  })
  const here = fileURLToPath(packageRoot)
  const entry = `import React from ${JSON.stringify(sdk.resolve('react'))};import {createRoot} from ${JSON.stringify(sdk.resolve('react-dom/client'))};import {createReadingViews} from ${JSON.stringify(join(here, 'src/view.mjs'))};import {ReadingController} from ${JSON.stringify(join(here, 'src/controller.mjs'))};const c=new ReadingController({dispatch:async payload=>(await fetch('/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:payload})).text()});const {Page}=createReadingViews(React);createRoot(document.getElementById('panel')).render(React.createElement(Page,{controller:c,onBack:()=>{}}));c.boot();`
  await sdk('esbuild').build({stdin:{contents:entry, resolveDir:here}, bundle:true, outfile:join(runOut, 'app.js')})
  server = createServer(async (req, res) => {
    try {
      check(req.headers.host === '127.0.0.1:' + server.address().port)
      res.setHeader('cache-control', 'no-store'); res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'")
      if (req.method === 'POST' && req.url === '/dispatch') {
        let size = 0; const chunks = []; for await (const chunk of req) { size += chunk.length; check(size <= LIMITS.requestChars); chunks.push(chunk) }
        const request = JSON.parse(Buffer.concat(chunks).toString()), {action, workspaceId} = request; evidence.requests.push({action, workspaceId})
        if (gate?.action === action) { const wait = gate; gate = null; wait.seen(); await wait.promise }
        if (action === 'shelf' && failShelf) throw Object.assign(Error('synthetic-failure'), {code:'operation-failed'})
        const value = action === 'workspaces' ? registry : await dispatchStore(stores.get(workspaceId), request)
        res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:true, version:VERSION, protocol:PROTOCOL, value})); return
      }
      if (req.method === 'GET' && req.url === '/app.js') { res.setHeader('content-type', 'text/javascript'); res.end(await readFile(join(runOut, 'app.js'))); return }
      if (req.method === 'GET' && req.url === '/') { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end('<!doctype html><html lang="zh-CN" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R2 本地合成验证</title><style>html,body,#panel{height:100%;margin:0;font-family:system-ui}</style><div id="panel"></div><script src="/app.js"></script></html>'); return }
      res.writeHead(404).end()
    } catch (e) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:false, error:safeCode(e)})) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const url = 'http://127.0.0.1:' + server.address().port; evidence.url = url
  context = await chromium.launchPersistentContext(join(runOut, 'chromium-disposable'), {ignoreDefaultArgs:true, args:['--headless', '--user-data-dir=' + join(runOut, 'chromium-disposable'), '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync'], executablePath:process.env.QCU_READING_CHROMIUM, headless:true, chromiumSandbox:true, viewport:{width:1280, height:920}, acceptDownloads:true})
  await context.route('**/*', route => { if (new URL(route.request().url()).origin !== url) { evidence.external.push(route.request().url()); return route.abort() }; return route.continue() })
  const page = await context.newPage(), downloads = []; page.on('pageerror', e => evidence.errors.push(e.message)); page.on('download', d => downloads.push(d))
  const b = name => page.getByRole('button', {name, exact:true}), reader = page.getByRole('main', {name:'原文'}), shelf = page.getByRole('complementary', {name:'材料列表'}), qa = page.getByRole('complementary', {name:'材料问答'})
  const waitAction = action => page.waitForResponse(r => r.url().endsWith('/dispatch') && r.request().postDataJSON()?.action === action)
  const click = async (name, action) => { const wait = waitAction(action); await b(name).click(); await wait; await page.waitForFunction(() => !document.querySelector('.qr [aria-label="资料架筛选"] button[type=submit]')?.disabled) }
  const shot = async name => { const path = join(runOut, name + '.png'); await page.screenshot({path}); evidence.screenshots.push(path) }
  const hold = action => { let seen; const observed = new Promise(r => seen = r), promise = new Promise(r => releaseGate = r); gate = {action, seen, promise}; return observed }
  await page.goto(url); await reader.getByRole('heading', {name:old.name, exact:true}).waitFor()
  assert.deepEqual(await readFile(stateFile), legacyBytes)
  await reader.getByText('整理与管理此版本', {exact:true}).click()
  const alias = '自编课堂反馈与课程分类显示标题'.repeat(6), course = '长中文课程分类'.repeat(7), tag = '长中文标签'.repeat(3)
  await page.getByLabel('显示标题（可选）', {exact:true}).fill(alias)
  await page.getByLabel('课程 / 分类（可选）', {exact:true}).fill(course)
  await page.getByLabel('标签（最多 8 个，用逗号分隔；每个 24 字符）', {exact:true}).fill(tag + '，反馈，反馈')
  await click('保存资料信息', 'metadata'); await reader.getByRole('heading', {name:alias, exact:true}).waitFor()
  assert.deepEqual(await readFile(join(directory, '.qcu-reading', 'state.schema2.' + sha(legacyBytes) + '.json')), legacyBytes)
  assert.deepEqual(a.run(r.id), history); assert.deepEqual(a.state.notes[0], originalNote)
  await reader.getByText('整理与管理此版本', {exact:true}).click()
  await click('收藏材料', 'metadata')
  const question = page.getByLabel('问题', {exact:true}); await question.fill('未发送的问题草稿')
  await shelf.getByLabel('课程 / 分类', {exact:true}).selectOption(course)
  await shelf.getByLabel('标签', {exact:true}).selectOption(tag)
  await shelf.getByLabel('只看收藏材料', {exact:true}).check()
  assert.equal(await shelf.locator('.qr-docs li').count(), 1)
  await shelf.getByLabel('资料架关键词', {exact:true}).fill('旧版稳定来源'); await click('检索资料架', 'shelf')
  const cross = page.getByRole('region', {name:'跨材料关键词结果'}); await cross.getByRole('button').first().click()
  await reader.locator('[data-locator="p0002"][data-selected=true]').waitFor()
  await page.getByLabel('我的笔记', {exact:true}).fill('R2 收藏摘录'); await click('保存摘录', 'note')
  await reader.getByText('已保存摘录（2）', {exact:true}).click()
  await reader.locator('.qr-note').filter({hasText:'R2 收藏摘录'}).getByRole('button', {name:'收藏摘录', exact:true}).click()
  await shelf.getByText('收藏摘录（1）', {exact:true}).click()
  await shelf.locator('.qr-favorites button').click(); await reader.locator('[data-locator="p0002"][data-selected=true]').waitFor()
  assert.equal(await question.inputValue(), '未发送的问题草稿')
  await shelf.getByLabel('资料架关键词', {exact:true}).fill('无匹配独有字串'); await click('检索资料架', 'shelf')
  await shelf.getByText('没有符合筛选的材料。可清除筛选后查看全部。', {exact:true}).waitFor(); await shot('empty-filter')
  await click('清除筛选', 'shelf'); assert.equal(await shelf.locator('.qr-docs li').count(), 2)
  failShelf = true; await click('检索资料架', 'shelf'); await page.getByRole('alert').waitFor(); await shot('search-error'); failShelf = false; await click('检索资料架', 'shelf')
  // Loading state is a held real request, not a fabricated success screen.
  const loadingSeen = hold('document'); await shelf.locator('.qr-docs button').filter({hasText:'保留原件.pdf'}).click(); await loadingSeen; await page.getByText('正在读取本地材料…', {exact:true}).waitFor(); await shot('loading'); releaseGate()
  await reader.getByRole('heading', {name:'保留原件.pdf', exact:true}).waitFor()
  // Old historical answer still navigates to old source after alias + new same-name version.
  await page.getByLabel('选择 TXT、Markdown、PDF 或 DOCX 文件').setInputFiles({name:old.name, mimeType:'text/markdown', buffer:Buffer.from('同名新版本反馈，仅供版本验证。')})
  await reader.getByRole('heading', {name:old.name, exact:true}).waitFor()
  await qa.getByText('问答记录（1）', {exact:true}).click(); await qa.locator('.qr-history button').click()
  await page.getByRole('button', {name:'定位来源 S1', exact:true}).click(); await reader.getByRole('heading', {name:alias, exact:true}).waitFor()
  assert.deepEqual(a.run(r.id), history)
  assert.match(await reader.locator('[data-selected=true]').innerText(), /课堂反馈帮助/)
  await b('刷新工作区列表').click(); assert.equal(await question.inputValue(), '未发送的问题草稿')
  // All theme/size/font combinations are actual renders with long metadata and keyboard focus.
  for (const width of [1280, 360]) for (const theme of ['light', 'dark']) for (const font of [14, 18]) {
    await page.setViewportSize({width, height:1000}); await page.evaluate(({theme, font}) => { document.documentElement.dataset.theme = theme; document.documentElement.style.setProperty('--dsh-content-font-size', font + 'px') }, {theme, font})
    if (width === 360) { await b('原文').click(); if (await shelf.isVisible() === false) await b('材料').click() }
    await b('检索资料架').focus()
    const geometry = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth, font:getComputedStyle(document.querySelector('.qr')).fontSize, panels:[...document.querySelectorAll('.qr-materials,.qr-reader,.qr-qa')].filter(el => getComputedStyle(el).display !== 'none').map(el => ({width:el.clientWidth, scroll:el.scrollWidth}))}))
    assert.equal(geometry.font, font + 'px'); assert.ok(geometry.scroll <= width && geometry.panels.every(p => p.scroll <= p.width + 1), JSON.stringify(geometry))
    const compact = await page.evaluate(() => {
      const heightInLines = el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
      const main = document.querySelector('.qr-reader'), text = main.querySelector('.qr-paragraph p').getBoundingClientRect(), box = main.getBoundingClientRect()
      const excerpt = document.querySelector('.qr-favorites small')
      return {title:heightInLines(main.querySelector('.qr-title h2')), courses:[...document.querySelectorAll('.qr-docs small')].map(heightInLines), favoriteTitle:heightInLines(document.querySelector('.qr-favorites button span')), favoriteExcerpt:heightInLines(excerpt), excerptText:excerpt.textContent, sourceVisible:text.top >= box.top && text.top + parseFloat(getComputedStyle(main.querySelector('.qr-paragraph p')).lineHeight) <= box.bottom}
    })
    // Incumbent excerpt text is bounded to 90 characters plus its intact locator;
    // this fixture uses up to four lines in the 160px sidebar at the host's 18px font.
    assert.ok(compact.title <= 3.05 && compact.courses.every(n => n <= 1.05) && compact.favoriteTitle <= 2.05 && compact.favoriteExcerpt <= 4.05, JSON.stringify(compact))
    assert.equal(compact.excerptText, 'p0002 · 旧版稳定来源，不随别名变化。')
    assert.equal(compact.sourceVisible, true, JSON.stringify(compact))
    await shot(`shelf-${width}-${theme}-${font}`)
  }
  await shelf.locator('.qr-docs').evaluate(el => el.scrollIntoView({block:'start'})); await shot('long-labels-360-dark-18')
  await page.setViewportSize({width:1280, height:1000})
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.style.setProperty('--dsh-content-font-size', '14px') })
  await shelf.getByText('本地备份', {exact:true}).click()
  const downloadWait = page.waitForEvent('download'); await b('下载完整备份 JSON').click(); const download = await downloadWait
  // Download creation is observable; persistence through a native Save dialog is not.
  const preparedNotice = page.getByRole('status').filter({hasText:'完整本地备份已准备'})
  await preparedNotice.waitFor(); assert.match(await preparedNotice.innerText(), /系统保存窗口或下载列表中确认保存/)
  assert.match(await preparedNotice.innerText(), /尚无导入恢复界面/)
  assert.doesNotMatch(await preparedNotice.innerText(), /已下载|已保存|保存成功|下载完成/)
  evidence.backupStatus = {notice:await preparedNotice.innerText(), observesSystemSave:false}
  await shot('backup-prepared-confirm-system-save')
  const backupFile = join(runOut, 'complete-backup.json'); await download.saveAs(backupFile)
  const bytes = await readFile(backupFile), backup = JSON.parse(bytes), expected = await a.backupPrepare()
  assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.digest); assert.equal(sha(JSON.stringify(backup.state)), backup.checksum.state); assert.deepEqual(backup.state, a.state)
  assert.equal(backup.state.documents.find(d => d.name === '保留原件.pdf').base64, pdf.toString('base64'))
  evidence.backup = {file:backupFile, bytes:bytes.length, sha256:sha(bytes), stateChecksum:backup.checksum.state}
  const beforeDownloads = downloads.length, cancelledSeen = hold('backupChunk')
  await b('下载完整备份 JSON').click(); await cancelledSeen; await b('取消备份').click(); releaseGate(); await b('下载完整备份 JSON').waitFor()
  assert.equal(downloads.length, beforeDownloads)
  const changedSeen = hold('backupChunk'); await b('下载完整备份 JSON').click(); await changedSeen
  await a.updateMetadata(old.id, {title:alias, course, tags:[tag, '反馈'], favorite:false}); releaseGate()
  await page.getByRole('alert').filter({hasText:/变化/}).waitFor(); assert.equal(downloads.length, beforeDownloads)
  // Workspace discovery never auto-opens B; explicit selection exposes no A data or backup.
  const otherDir = join(runOut, 'B'); await mkdir(otherDir); const other = await new ReadingStore(otherDir, options).init(); stores.set('B', other); registry.push({id:'B', title:'合成工作区 B'})
  const refreshWait = waitAction('workspaces'); await b('刷新工作区列表').click(); await refreshWait
  assert.equal(await question.inputValue(), '未发送的问题草稿'); assert.equal(await reader.getByRole('heading', {name:alias, exact:true}).count(), 1)
  await page.getByRole('combobox', {name:'工作区', exact:true}).selectOption('B'); await reader.getByRole('heading', {name:'把材料放在手边'}).waitFor()
  assert.equal(await shelf.locator('.qr-docs li').count(), 0); assert.equal(await question.inputValue(), ''); await shot('empty-library-B')
  const emptyDownloadWait = page.waitForEvent('download'); await b('下载完整备份 JSON').click(); const emptyDownload = await emptyDownloadWait, emptyFile = join(runOut, 'empty-B-backup.json'); await emptyDownload.saveAs(emptyFile)
  assert.deepEqual(JSON.parse(await readFile(emptyFile)).state.documents, [])
  await page.getByRole('combobox', {name:'工作区', exact:true}).selectOption('A'); await reader.getByRole('heading', {name:alias, exact:true}).waitFor()
  const docx = await docxFixture(); await page.getByLabel('选择 TXT、Markdown、PDF 或 DOCX 文件').setInputFiles({name:'可删除自编.docx', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer:docx})
  await reader.getByRole('heading', {name:'可删除自编.docx', exact:true}).waitFor()
  await page.getByRole('button', {name:'选择段落 docx-t1-r1-c2-p1', exact:true}).click(); await click('保存摘录', 'note')
  const targetId = a.state.documents.find(d => d.name === '可删除自编.docx').id, beforeDelete = structuredClone(a.state), originalDisk = await readFile(stateFile)
  await reader.getByText('整理与管理此版本', {exact:true}).click(); await b('预览删除此版本').click()
  const preview = page.getByRole('region', {name:'删除预览'}); await preview.waitFor(); assert.match(await preview.innerText(), /1 条摘录、0 条问答/); assert.ok((await preview.innerText()).includes(targetId))
  assert.equal(await b('取消删除').evaluate(el => el === document.activeElement), true); await shot('delete-preview-desktop'); await page.keyboard.press('Escape')
  assert.equal(await preview.count(), 0); assert.equal(await b('预览删除此版本').evaluate(el => el === document.activeElement), true); assert.deepEqual(await readFile(stateFile), originalDisk)
  await b('预览删除此版本').click(); await preview.waitFor(); await b('取消删除').click(); assert.deepEqual(await readFile(stateFile), originalDisk)
  await b('预览删除此版本').click(); await page.setViewportSize({width:360, height:1000}); await b('原文').click(); await shot('delete-preview-360'); await b('确认删除此版本及记录').click()
  await page.getByText('已删除该版本及其摘录、问答；其他材料记录保留。', {exact:true}).waitFor()
  assert.deepEqual(a.state.documents, beforeDelete.documents.filter(d => d.id !== targetId)); assert.deepEqual(a.state.notes, beforeDelete.notes.filter(n => n.documentId !== targetId)); assert.deepEqual(a.state.runs, beforeDelete.runs)
  await page.reload(); await b('原文').click(); await reader.getByRole('heading', {name:alias, exact:true}).waitFor(); assert.deepEqual(a.run(r.id), history)
  assert.equal(evidence.modelCalls, 0); assert.equal(evidence.modelResolutions, 0); assert.ok(!evidence.requests.some(r => ['prepare', 'start'].includes(r.action)))
  assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.external, [])
  evidence.checks.push('schema2 idle byte identity and exact migration backup', 'long alias/course/tags, favorite materials, metadata and bounded original-text search with exact locator', 'saved/favorite excerpt opens immutable source', 'empty filter/clear and original empty library', 'error/loading/keyboard focus and 1280/360 light/dark fonts14/18', 'old synthetic history and original citations remain unchanged after alias and new same-name version', 'actual downloaded full JSON byte count/digest/state checksum/original PDF bytes verified', 'cancel and changed-state export emit no partial download', 'workspace refresh preserves draft and explicit selection isolates backup', 'delete counts/hash/cancel button/Escape focus and byte-identical cancellation, exact cascade/unrelated history', 'reload retains shelf metadata and historical evidence; zero new model tasks')
  evidence.passed = true
})
