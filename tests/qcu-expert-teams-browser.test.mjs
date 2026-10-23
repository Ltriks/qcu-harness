// Explicit, isolated headless Chromium acceptance on disposable synthetic state. No real browser profile.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const {chromium}=require('playwright')
const out=resolve(process.env.QCU_TEAMS_BROWSER_OUT??'.work/expert-hardening/browser'),url=process.env.QCU_TEAMS_BROWSER_URL
assert.match(url??'',/^http:\/\/127\.0\.0\.1:\d+$/)
await mkdir(out,{recursive:true})
const evidence={syntheticOnly:true,realNativeUi:false,nativeFileChooser:'untested',realModel:false,screenshots:[],downloads:[],checks:[]}
const record=async(path,kind)=>{const bytes=await readFile(path),entry={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};evidence[kind].push(entry);return bytes}
const stats=async()=>fetch(url+'/preview/stats').then(r=>r.json())
test('actual React partial reports, backups, cleanup, isolation, keyboard and desktop/360px themes',async()=>{
 const profile=await mkdtemp(join(out,'chromium-disposable-'))
 const launchArgs=['--headless','--user-data-dir='+profile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync']
 evidence.launch={headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args:launchArgs,profile}
 const context=await chromium.launchPersistentContext(profile,{ignoreDefaultArgs:true,args:launchArgs,executablePath:process.env.QCU_TEAMS_CHROMIUM??'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,chromiumSandbox:true,viewport:{width:1360,height:1020},acceptDownloads:true})
 try{
  // Reject non-loopback requests, including accidental external assets.
  await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort())
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(url+'/harness');await page.bringToFront();const ui=page.frameLocator('iframe')
  await ui.getByRole('combobox',{name:'工作区',exact:true}).selectOption('synthetic-workspace')
  await ui.getByRole('tab',{name:/运行记录/}).click();await ui.getByRole('button',{name:/审阅自编教学片段.*未完成$/}).click()
  await ui.getByRole('button',{name:'下载部分报告',exact:true}).waitFor()
  assert.match(await ui.getByRole('main').innerText(),/完成 3\/4 步/)
  assert.match(await ui.getByRole('main').innerText(),/待教师复核 \/ 未完成/)
  const capture=async(prefix)=>{
   for(const size of ['desktop','360']){
    await page.getByRole('button',{name:size==='desktop'?'桌面1280px':'手机360px',exact:true}).click()
    for(const theme of ['light','dark']){
     const frame=page.frames().find(f=>f.url()===url+'/');assert.ok(frame)
     await frame.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
     const layout=await frame.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme??'light',panels:[...document.querySelectorAll('.qt-history,.qt-history .qt-list,.qt-history-tools,.qt-history-row')].map(el=>({name:el.className,width:el.clientWidth,scroll:el.scrollWidth})),titles:[...document.querySelectorAll('.qt-history-row strong')].map(el=>({height:el.clientHeight,line:parseFloat(getComputedStyle(el).lineHeight),clamp:getComputedStyle(el).webkitLineClamp}))}))
     assert.equal(layout.width,size==='desktop'?1280:360);assert.ok(layout.scroll<=layout.width);assert.equal(layout.theme,theme)
     for(const panel of layout.panels)assert.ok(panel.scroll<=panel.width+1,JSON.stringify(panel))
     for(const title of layout.titles){assert.equal(title.clamp,'3');assert.ok(title.height<=title.line*3+1,JSON.stringify(title))}
     evidence.layouts??=[];evidence.layouts.push({prefix,size,...layout})
     const path=join(out,prefix+'-'+size+'-'+theme+'.png');await page.locator('iframe').screenshot({path});await record(path,'screenshots')
     if(prefix==='partial-report'){await ui.getByRole('main').evaluate(el=>el.scrollTop=el.scrollHeight);const opinionPath=join(out,'partial-opinion-'+size+'-'+theme+'.png');await page.locator('iframe').screenshot({path:opinionPath});await record(opinionPath,'screenshots');await ui.getByRole('main').evaluate(el=>el.scrollTop=0)}
    }
   }
   await page.frames().find(f=>f.url()===url+'/').evaluate(()=>document.documentElement.dataset.theme='light')
   await page.getByRole('button',{name:'桌面1280px',exact:true}).click()
  }
  const before=await stats()
  const partial=page.waitForEvent('download');await ui.getByRole('button',{name:'下载部分报告',exact:true}).click();const reportDownload=await partial,reportPath=join(out,'download-partial.md');await reportDownload.saveAs(reportPath)
  const report=(await record(reportPath,'downloads')).toString();assert.match(report,/待教师复核 \/ 未完成/);assert.match(report,/失败 \(failed\)/);assert.match(report,/完成步骤：3\/4/);assert.match(report,/80元涨至100元/);assert.match(report,/synthetic\/合成模型/);assert.doesNotMatch(report,/SYNTHETIC_PRIVATE_ADAPTER_ERROR/)
  // Two separate terminal rows may have identical tasks; select only the failed run.
  const checks=ui.getByRole('checkbox',{name:/选择记录：/});assert.equal(await checks.count(),3);await checks.nth(1).check()
  assert.match(await ui.getByText(/已选 1 条；/).innerText(),/1/)
  const backup=page.waitForEvent('download');await ui.getByRole('button',{name:'备份所选记录',exact:true}).click();const backupDownload=await backup,backupPath=join(out,'download-backup.json');await backupDownload.saveAs(backupPath)
  const data=JSON.parse((await record(backupPath,'downloads')).toString());assert.equal(data.dataOnly,true);assert.equal(data.runs.length,1);assert.equal(data.runs[0].status,'failed');assert.equal(data.workspaceId,'synthetic-workspace');assert.doesNotMatch(JSON.stringify(data),/SYNTHETIC_PRIVATE|intentId|requestId|methods/)
  assert.equal((await stats()).calls,before.calls);evidence.checks.push('actual downloaded partial Markdown and selected data-only JSON bytes; no generation')
  await ui.getByRole('button',{name:/知识准确性专家.*已完成/}).click()
  assert.match(await ui.getByRole('main').innerText(),/80元涨至100元/)
  await capture('partial-report')
  assert.match(await ui.getByLabel('存储用量').innerText(),/KB|MB/);assert.match(await ui.getByLabel('存储用量').innerText(),/插件工作区配置/)
  // Preview, cancel by Escape, re-open, focus loop, explicit bound confirmation.
  await ui.getByRole('button',{name:'预览清理',exact:true}).click();const dialog=ui.getByRole('dialog',{name:'确认清理所选历史',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('button',{name:'确认清理 1 条记录'}).isDisabled(),true)
  const cleanupShot=join(out,'cleanup-preview.png');await page.locator('iframe').screenshot({path:cleanupShot});await record(cleanupShot,'screenshots')
  await capture('cleanup-confirmation');assert.doesNotMatch(await dialog.innerText(),new RegExp(data.runs[0].id));await dialog.getByText('技术信息',{exact:true}).click();assert.match(await dialog.innerText(),new RegExp(data.runs[0].id));await dialog.getByText('技术信息',{exact:true}).click();await dialog.getByRole('button',{name:'取消清理'}).focus();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await checks.count(),3)
  await ui.getByRole('button',{name:'预览清理',exact:true}).click();await dialog.waitFor()
  await dialog.getByRole('button',{name:'取消清理'}).focus();const focusTrail=[]
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');focusTrail.push(await dialog.evaluate(el=>({inside:el.contains(el.ownerDocument.activeElement),name:el.ownerDocument.activeElement.textContent})))}
  assert.ok(focusTrail.every(v=>v.inside),JSON.stringify(focusTrail));evidence.focusTrail=focusTrail
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'确认清理 1 条记录'}).click();await dialog.waitFor({state:'hidden'})
  await ui.getByText(/已清理 1 条本地运行记录/).waitFor();assert.equal(await checks.count(),2);assert.match(await ui.getByLabel('存储用量').innerText(),/历史 2\/50/);await ui.getByText('运行记录会保存在这里',{exact:true}).waitFor();assert.equal((await stats()).calls,before.calls)
  evidence.checks.push('cleanup preview/cancel/Escape/focus loop/explicit confirmation; removed selected pane and record; capacity and selection refreshed')
  await ui.getByRole('button',{name:/审阅自编教学片段.*已中断$/}).click();await ui.getByRole('button',{name:'下载部分报告',exact:true}).waitFor()
  evidence.checks.push('1280px/360px light/dark partial-report and cleanup screenshots; no document or inner history/control/row overflow; three-line task clamp')
  await ui.getByRole('combobox',{name:'工作区',exact:true}).selectOption('other-workspace');await ui.getByText('还没有运行记录',{exact:true}).waitFor();assert.match(await ui.getByLabel('存储用量').innerText(),/历史 0\/50/)
  await ui.getByRole('combobox',{name:'工作区',exact:true}).selectOption('synthetic-workspace');await ui.getByText(/历史 2\/50 条/).waitFor();assert.equal(await checks.count(),2)
  evidence.checks.push('workspace navigation has no cross-workspace mutation or selection leakage')
  // Existing full-completion report still downloads.
  await ui.getByRole('button',{name:/审阅自编的百分比教学片段/}).click();const complete=page.waitForEvent('download');await ui.getByRole('button',{name:'下载报告',exact:true}).click();const completeDownload=await complete,completePath=join(out,'download-complete.md');await completeDownload.saveAs(completePath);assert.match((await record(completePath,'downloads')).toString(),/最终汇总已完成/)
  evidence.checks.push('completed Markdown download retained');assert.equal((await stats()).calls,before.calls);assert.deepEqual(errors,[]);evidence.consoleErrors=errors;evidence.passed=true
 }finally{await context.close();evidence.contextClosed=true;await writeFile(join(out,'EVIDENCE.json'),JSON.stringify(evidence,null,2)+'\n')}
})
