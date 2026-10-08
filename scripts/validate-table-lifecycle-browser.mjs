/** Real official Web/Chrome flow with an explicitly selected synthetic fixture. */
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.QCU_TEST_PLAYWRIGHT).href)
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const area = pathToFileURL(process.env.QCU_CSV_TEST_DIR.replace(/\/$/, '') + '/')
const fixture = new URL('user-fixtures/synthetic-user.csv', area)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const before = hash(await readFile(fixture))
const authenticated = (await readFile(new URL('official-web.private.log', area), 'utf8')).match(/http:\/\/127\.0\.0\.1:19389\/\S+/)?.[0]
assert(authenticated)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, chromiumSandbox: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })
const mode = process.argv[2]
const facts={mode,pageErrors:[],nativeOsDialogsTested:false}
let page
try {
 await context.route('**/*',route=> {const u=new URL(route.request().url());return ['data:','blob:'].includes(u.protocol)||u.origin==='http://127.0.0.1:19389'?route.continue():route.abort()})
 page=await context.newPage();page.on('pageerror',e=>facts.pageErrors.push(e.name))
 const response=await page.goto(authenticated,{waitUntil:'domcontentloaded',timeout:15000});assert.equal(response.status(),200)
 await page.getByRole('button',{name:'Plugins',exact:true}).waitFor({timeout:15000})
 for(let i=0;i<3;i++) {
  const bs=['Continue','Configure later'].map(name=>page.getByRole('button',{name,exact:true}));const vs=await Promise.all(bs.map(b=>b.waitFor({state:'visible',timeout:1000}).then(()=>true,()=>false)))
  const next=bs[vs.findIndex(Boolean)];if(!next)break;await next.click();await next.waitFor({state:'hidden'})
 }
 facts.style=await page.evaluate(()=>({preference:document.documentElement.dataset.dsThemeSource,dark:document.body.hasAttribute('data-ds-dark-theme'),fontSize:document.body.style.getPropertyValue('--dsh-content-font-size')}))
 assert.deepEqual(facts.style,{preference:'dark',dark:true,fontSize:'15px'})
 const entry=page.getByRole('button',{name:/CSV 只读诊断/})
 if(mode==='toggle-off'||mode==='toggle-on') {
  await page.getByRole('button',{name:'Plugins',exact:true}).click()
  const toggle=page.getByRole('switch',{name:'Enable qcu-table-audit',exact:true});await toggle.waitFor({timeout:10000})
  const wanted=mode==='toggle-on'?'true':'false';facts.switchBefore=await toggle.getAttribute('aria-checked')
  assert.notEqual(facts.switchBefore,wanted);await toggle.click()
  await page.waitForFunction(wanted=>document.querySelector('[role=switch][aria-label="Enable qcu-table-audit"]')?.getAttribute('aria-checked')===wanted,wanted,{timeout:10000})
  facts.switchAfter=await toggle.getAttribute('aria-checked');facts.restartNoticeVisible=await page.getByText('The change takes effect at the next start',{exact:true}).isVisible()
  facts.entryBeforeRestart=await entry.isVisible()
  facts.taskHttpBeforeRestart=await page.evaluate(async()=> (await fetch('/api/qcu-csv-task',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'open'})})).status)
 } else if(mode==='probe-off') {
  facts.entryVisible=await entry.isVisible();facts.taskHttpStatus=await page.evaluate(async()=> (await fetch('/api/qcu-csv-task',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'open'})})).status)
  assert.equal(facts.entryVisible,false);assert.equal(facts.taskHttpStatus,404)
 } else if(mode==='probe-guide') {
  await entry.click();await page.getByRole('status').filter({hasText:'等待选择文件'}).waitFor({timeout:10000})
  const guide=page.getByText('若插件页提示“下次启动生效”，关闭开关不会立即撤销当前任务。停止使用请先“取消并撤销”，再正常退出并重启；重启后确认入口消失。',{exact:true})
  facts.restartGuidanceVisible=await guide.isVisible();assert(facts.restartGuidanceVisible)
  await page.getByRole('button',{name:'Plugins',exact:true}).click()
 } else if(mode==='probe-on') {
  await entry.click();await page.getByRole('status').filter({hasText:'等待选择文件'}).waitFor({timeout:10000})
  const pending=page.waitForEvent('filechooser');await page.locator('input[type=file]').click();await (await pending).setFiles(fileURLToPath(fixture))
  await page.getByRole('status').filter({hasText:'等待逐文件授权'}).waitFor()
  await page.getByRole('combobox').selectOption('personal');await page.getByRole('textbox',{name:'个人规则 JSON',exact:true}).fill(await readFile(new URL('user-fixtures/synthetic-personal-rules.json',area),'utf8'))
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'授权本次文件',exact:true}).click();await page.getByRole('status').filter({hasText:'可以检查'}).waitFor()
  await page.getByRole('button',{name:'检查 / 再次检查',exact:true}).click();await page.getByRole('status').filter({hasText:'检查完成'}).waitFor({timeout:15000})
  assert((await page.locator('section').innerText()).includes('记录：4；问题：7'));facts.personalRulesDiagnosis={rows:4,issues:7}
  await page.getByRole('button',{name:'取消并撤销',exact:true}).click();await page.getByRole('status').filter({hasText:'等待选择文件'}).waitFor();await page.getByRole('button',{name:'Plugins',exact:true}).click()
  facts.entryVisible=true;facts.taskHttpStatus=200
 } else throw new Error('Unknown test mode')
 assert.deepEqual(await readdir(new URL('work',area)),[]);facts.ownedWorkEmpty=true;facts.sourceCsvUnchanged=before===hash(await readFile(fixture));assert(facts.sourceCsvUnchanged);assert.deepEqual(facts.pageErrors,[]);facts.completed=true
} catch(e) {facts.completed=false;facts.errorType=e.name;await page?.screenshot({path:fileURLToPath(new URL('lifecycle-failed.png',area))});process.exitCode=1}
finally {await writeFile(new URL('lifecycle-'+mode+'-results.json',area),JSON.stringify(facts,null,2)+'\n');console.log(JSON.stringify(facts));await context.close();await browser.close()}
