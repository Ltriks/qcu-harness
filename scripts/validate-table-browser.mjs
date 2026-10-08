/** Real official Web/Chrome flow with an explicitly selected synthetic fixture. */
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.QCU_TEST_PLAYWRIGHT).href)
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const area = pathToFileURL(process.env.QCU_CSV_TEST_DIR.replace(/\/$/, '') + '/')
const fixture = new URL('../skills/qcu-table-audit/examples/input.csv', import.meta.url)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const before = hash(await readFile(fixture))
const authenticated = (await readFile(new URL('official-web.private.log', area), 'utf8')).match(/http:\/\/127\.0\.0\.1:19389\/\S+/)?.[0]
assert(authenticated)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, chromiumSandbox: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })
const facts = { environment: 'real Chrome and unmodified official Web runtime; synthetic CSV only', steps: [], operations: [], pageErrors: [], nativeOsDialogsTested: false }
facts.csvHttpStatuses = []
let page
let step = 'load'
const record = async name => { facts.steps.push(name); await writeFile(new URL('browser-workflow-results.json', area), JSON.stringify(facts, null, 2) + '\n') }
try {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['data:', 'blob:'].includes(url.protocol) || url.origin === 'http://127.0.0.1:19389' ? route.continue() : route.abort()
  })
  page = await context.newPage()
  page.on('pageerror', error => facts.pageErrors.push(error.name))
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/qcu-csv-task') facts.csvHttpStatuses.push(response.status())
  })
  page.on('request', request => {
    if (new URL(request.url()).pathname !== '/api/qcu-csv-task' || request.method() !== 'POST') return
    try { facts.operations.push(JSON.parse(request.postData() ?? '{}').operation) } catch { /* Metadata only; never log bodies. */ }
  })
  const response = await page.goto(authenticated, { waitUntil: 'domcontentloaded', timeout: 15000 })
  assert.equal(response.status(), 200)
  const notice = page.getByRole('button', { name: 'Continue', exact: true })
  const configureLater = page.getByRole('button', { name: 'Configure later', exact: true })
  await page.getByRole('button', { name: /CSV 只读诊断/ }).waitFor({ state: 'visible', timeout: 15000 })
  for (let i = 0; i < 3; i++) {
    const visible = await Promise.all([notice, configureLater].map(button => button
      .waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)))
    const button = visible[0] ? notice : visible[1] ? configureLater : undefined
    if (!button) break
    await button.click(); await button.waitFor({ state: 'hidden' })
  }
  await record('official first-run dialogs handled if present; no model credentials supplied')
  step = 'global-entry'
  await page.getByRole('button', { name: /CSV 只读诊断/ }).click({ timeout: 15000 })
  await page.getByRole('status').filter({ hasText: '等待选择文件' }).waitFor({ timeout: 15000 })
  await record('root task entry opened without creating a Session')
  const picker = page.locator('input[type=file]')
  step = 'chooser-cancel'
  let chooserPromise = page.waitForEvent('filechooser'); await picker.click(); let chooser = await chooserPromise
  await chooser.setFiles([])
  assert.equal(await picker.inputValue(), '')
  await record('browser file-chooser empty selection leaves task idle')
  step = 'explicit-file-authority'
  chooserPromise = page.waitForEvent('filechooser'); await picker.click(); chooser = await chooserPromise
  await chooser.setFiles(fileURLToPath(fixture))
  await page.getByRole('status').filter({ hasText: '等待逐文件授权' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '授权本次文件', exact: true }).isEnabled(), false)
  assert(!facts.operations.includes('authorize'))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '授权本次文件', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '可以检查' }).waitFor()
  await record('synthetic bytes admitted only after explicit per-file consent')
  step = 'diagnose-demo'
  await page.getByRole('button', { name: '检查 / 再次检查', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '检查完成' }).waitFor({ timeout: 15000 })
  assert((await page.locator('section').innerText()).includes('记录：4；问题：7'))
  await record('demo diagnosis returned four rows and seven issues')
  step = 'cancel-download'
  let pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出仅计数摘要', exact: true }).click()
  let download = await pending; await download.cancel(); facts.downloadCancelResult = await download.failure()
  await record('download cancel requested; actual failure result recorded separately')
  step = 'export-counts'
  pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出仅计数摘要', exact: true }).click()
  download = await pending; const output = new URL('synthetic-count-summary.json', area); await download.saveAs(fileURLToPath(output))
  const summary = JSON.parse(await readFile(output, 'utf8'))
  assert.deepEqual(Object.keys(summary).sort(), ['counts', 'issues', 'rows', 'status'])
  assert.equal(summary.rows, 4); assert.equal(summary.issues, 7)
  assert.equal(download.suggestedFilename(), 'qcu-csv-count-summary.json')
  await record('second export saved safe count-only JSON')
  step = 'cancel-reselect'
  await page.getByRole('button', { name: '取消并撤销', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '等待选择文件' }).waitFor()
  assert.equal(await picker.inputValue(), '')
  chooserPromise = page.waitForEvent('filechooser'); await picker.click(); chooser = await chooserPromise
  await chooser.setFiles(fileURLToPath(fixture))
  await page.getByRole('status').filter({ hasText: '等待逐文件授权' }).waitFor()
  await page.getByRole('combobox').selectOption('personal')
  step = 'personal-rule-fixture';
  const ruleText = await readFile(new URL('../skills/qcu-table-audit/examples/rules.json', import.meta.url), 'utf8');
  step = 'personal-rule-fill';
  await page.getByRole('textbox', { name: '个人规则 JSON', exact: true }).fill(ruleText)
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '授权本次文件', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '可以检查' }).waitFor()
  await page.getByRole('button', { name: '检查 / 再次检查', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '检查完成' }).waitFor({ timeout: 15000 })
  await record('same-file reselection and explicit personal rules diagnosed successfully')
  await page.getByRole('button', { name: '检查 / 再次检查', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '检查完成' }).waitFor({ timeout: 15000 })
  await record('repeated check completed')
  await page.screenshot({ path: fileURLToPath(new URL('csv-real-browser-complete.png', area)) })
  step = 'cleanup'
  await page.getByRole('button', { name: '取消并撤销', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '等待选择文件' }).waitFor()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await page.waitForTimeout(250)
  assert.deepEqual(await readdir(new URL('work', area)), [])
  facts.sourceCsvHashUnchanged = before === hash(await readFile(fixture))
  assert(facts.sourceCsvHashUnchanged); assert.deepEqual(facts.pageErrors, [])
  facts.completed = true
  await record('navigation unmounted task, revoked authority and left no owned temporary directories')
  console.log(JSON.stringify({ completed: true, steps: facts.steps, downloadCancelResult: facts.downloadCancelResult }))
} catch (error) {
  facts.completed = false; facts.failedStep = step; facts.errorType = error.name; facts.errorCode = error.code ?? null; facts.safeCause = /ENOENT/.test(error.message) ? 'missing synthetic fixture' : /strict mode violation/.test(error.message) ? 'ambiguous test locator' : error.name === 'AssertionError' ? 'assertion failed' : 'unclassified'
  await page?.screenshot({ path: fileURLToPath(new URL('csv-workflow-failed.png', area)) })
  await writeFile(new URL('browser-workflow-results.json', area), JSON.stringify(facts, null, 2) + '\n')
  console.log(JSON.stringify({ completed: false, failedStep: step, errorType: error.name }))
  process.exitCode = 1
} finally { await context.close(); await browser.close() }
