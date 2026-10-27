import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {require,out} from '../scripts/build-product-polish-preview.mjs'
import {serve} from '../scripts/serve-product-polish-preview.mjs'
const evidence={boundary:'Actual new branding/market clients; official ThemeRuntime/ThemePresenter; synthetic public services and real loopback feedback/admin HTTP. No native app, models, live Hub or used Home.',cases:[],outside:[],errors:[],screenshots:[]}
let host,context,profile
const dir=join(out,'browser',process.env.QCU_BROWSER_RUN_ID??('run-'+Date.now()))
before(async()=>{
 await mkdir(dir,{recursive:true});host=await serve();profile=await mkdtemp(join(out,'chromium-disposable-'))
 const args=['--headless','--user-data-dir='+profile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync']
 context=await require('playwright').chromium.launchPersistentContext(profile,{headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args,executablePath:process.env.QCU_BROWSER_EXECUTABLE??'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
 evidence.launch={headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args}
 await context.route('**/*',route=>{const r=route.request();if([host.url,host.services.admin].includes(new URL(r.url()).origin))return route.continue();evidence.outside.push({url:r.url(),method:r.method()});return route.abort()})
})
after(async()=>{try{await context?.close()}finally{await host?.close();if(profile)await rm(profile,{recursive:true,force:true});await writeFile(join(dir,'RESULT.json'),JSON.stringify(evidence,null,2)+'\n');await writeFile(join(out,'browser/RESULT.json'),JSON.stringify(evidence,null,2)+'\n')}})
let serial=0
async function open(viewport={width:1360,height:900},panel='qcu-teacher-home'){
 const page=await context.newPage();await page.addInitScript(()=>{window.syntheticCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.syntheticCopies.push(text)}})});await page.setViewportSize(viewport);page.on('pageerror',e=>evidence.errors.push(e.message));await page.goto(host.url+'/?scope=p16-'+(++serial)+'&sidebar=off&panel='+panel);await page.locator('#panel').waitFor();await page.waitForFunction(()=>window.polishPreview);await page.evaluate(()=>window.polishPreview.ready);return page
}
async function nav(page,id){await page.getByLabel('合成宿主页面',{exact:true}).selectOption(id);await page.waitForTimeout(30)}
async function shot(page,name){const path=join(dir,name+'.png');await page.screenshot({path});const b=await readFile(path);evidence.screenshots.push({path,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length})}
function contrast(a,b){const lum=s=>{const c=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
async function clean(page){const actions=await page.evaluate(()=>window.polishPreview.actions);assert.deepEqual(actions.filter(a=>a.name.startsWith('FORBIDDEN:')),[]);return actions}

test('faithful 14/18/22 light/dark desktop/narrow/short layouts and zero initial font writes',{timeout:120000},async()=>{
 const layouts=[]
 for(const viewport of [{width:1360,height:900},{width:390,height:640},{width:1120,height:480}]){
  const page=await open(viewport)
  try{for(const theme of ['light','dark'])for(const size of [14,18,22]){
   await page.getByLabel('合成宿主主题',{exact:true}).selectOption(theme);await page.getByLabel('合成宿主字号',{exact:true}).selectOption(String(size))
   for(const id of ['qcu-teacher-home','qcu-teacher-tools','qcu-teacher-help','qcu-teacher-about','qcu-market','qcu-feedback']){
    await nav(page,id==='qcu-feedback'?'qcu-market':id)
    if(id==='qcu-teacher-help'&&await page.getByRole('button',{name:'已查看说明，继续',exact:true}).count())await page.getByRole('button',{name:'已查看说明，继续',exact:true}).click()
    if(id==='qcu-market')await page.getByRole('button',{name:'市场首页',exact:true}).click()
    if(id==='qcu-feedback')await page.getByRole('button',{name:'问题反馈',exact:true}).click()
    if(id==='qcu-market')await page.getByRole('heading',{name:'工具市场',exact:true}).waitFor()
    const geometry=await page.locator('#panel').evaluate(root=>{const parent=root.getBoundingClientRect();return {overflow:root.scrollWidth>root.clientWidth+1,buttons:[...root.querySelectorAll('button')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,left:r.left,right:r.right,width:r.width,height:r.height,top:r.top,bottom:r.bottom,clipped:e.scrollWidth>e.clientWidth+1}}),parent:{left:parent.left,right:parent.right},font:getComputedStyle(root.querySelector('.qcu-home,.qcu-market')).fontSize}})
    assert.equal(geometry.overflow,false,id+' '+size);assert.equal(parseFloat(geometry.font),size)
    for(const b of geometry.buttons){assert.ok(b.left>=geometry.parent.left-1&&b.right<=geometry.parent.right+1,id+': '+b.text+' spills');assert.ok(!b.clipped,id+': '+b.text+' clipped')}
    for(let i=0;i<geometry.buttons.length;i++)for(let j=i+1;j<geometry.buttons.length;j++){const a=geometry.buttons[i],b=geometry.buttons[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=2||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=2,id+': overlapping buttons '+a.text+' / '+b.text)}
    const primaries=page.locator('#panel button.primary,#panel button.qcu-primary');for(let k=0;k<await primaries.count();k++){const primary=primaries.nth(k);if(!await primary.isVisible())continue;await primary.scrollIntoViewIfNeeded();const box=await primary.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height+1,id+': primary action unreachable');if(await primary.isEnabled()){for(const hover of [false,true]){if(hover)await primary.hover();else await page.mouse.move(0,0);const c=await primary.evaluate(e=>({ink:getComputedStyle(e).color,fill:getComputedStyle(e).backgroundColor}));assert.ok(contrast(c.ink,c.fill)>=4.5,id+': primary contrast '+JSON.stringify(c))}}}
    layouts.push({viewport,theme,size,id,...geometry})
    if((viewport.width===390&&size===22)||(viewport.width===1360&&size===14&&theme==='light')||(viewport.height===480&&size===22&&theme==='dark'))await shot(page,[id,viewport.width,viewport.height,theme,size].join('-'))
   }
  }
  const actions=await clean(page);assert.equal(actions.filter(a=>a.name==='session-create'||a.name==='feedbackSubmit').length,0)
  }finally{await page.close()}
 }
 evidence.cases.push({name:'layout-matrix',passed:true,layouts})
})

test('actual first task draft, navigation preservation, self-report and keyboard no-send',{timeout:30000},async()=>{
 const page=await open()
 try{
  assert.equal((await clean(page)).filter(a=>a.name==='setting-write').length,0)
  await page.getByLabel('任务要求',{exact:true}).fill('合成匿名要求：保留我的编辑')
  await nav(page,'qcu-teacher-tools');assert.equal(await page.locator('.qcu-tool-list li').count(),7)
  await nav(page,'qcu-teacher-home');assert.equal(await page.getByLabel('任务要求',{exact:true}).inputValue(),'合成匿名要求：保留我的编辑')
  await page.getByRole('button',{name:'开始首次任务指引',exact:true}).click();await page.getByRole('button',{name:'重置指引进度',exact:true}).click();await page.getByRole('button',{name:'已查看说明，继续',exact:true}).click()
  await page.getByLabel('工作文件夹',{exact:true}).selectOption('synthetic');await page.getByRole('button',{name:'填入匿名示例（替换当前任务要求）',exact:true}).click()
  const draft=await page.getByLabel('任务要求',{exact:true}).inputValue();await page.getByRole('button',{name:'在对话中继续',exact:true}).click();await page.getByRole('heading',{name:'合成对话草稿（未发送）',exact:true}).waitFor()
  assert.equal(await page.getByLabel('合成对话草稿',{exact:true}).inputValue(),draft)
  await nav(page,'qcu-teacher-help');await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'我已发送并审阅首次任务',exact:true}).focus();await page.keyboard.press('Enter');await page.getByText('你已确认完成首次任务',{exact:false}).waitFor()
  const draftCalls=await clean(page);assert.deepEqual(draftCalls.filter(a=>['session-create','session-retain','draft-set','session-open','session-release'].includes(a.name)).map(a=>a.name),['session-create','session-retain','draft-set','session-open','session-release']);
  await nav(page,'qcu-teacher-home');assert.equal(await page.getByRole('button',{name:'回看首次任务步骤',exact:true}).count(),1);assert.equal(await page.getByText('第一次使用？',{exact:true}).count(),0);await page.reload();await page.waitForFunction(()=>window.polishPreview);await page.getByRole('button',{name:'回看首次任务步骤',exact:true}).waitFor();await nav(page,'qcu-teacher-help');await page.getByText('你已确认完成首次任务',{exact:false}).waitFor();await page.getByRole('button',{name:'重置指引进度',exact:true}).click();await page.getByRole('heading',{name:'查看模型设置',exact:true}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.qcu-first-guide button').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s')
  await shot(page,'guide-progress-reset')
  const calls=await clean(page);assert.equal(calls.filter(a=>a.name==='session-create').length,0)
  assert.equal(calls.filter(a=>a.name==='setting-write').length,0);const persisted=await page.evaluate(()=>localStorage.getItem('qcu.teacher.first-task.v2'));assert.ok(persisted.length<512);assert.ok(!persisted.includes('合成匿名要求'));assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/feedback/.test(k))),false)
  evidence.cases.push({name:'first-task-draft-no-send',passed:true,calls})
 }finally{await page.close()}
})


async function feedbackPage(page){
 await nav(page,'qcu-market');await page.getByRole('button',{name:'问题反馈',exact:true}).click();await page.locator('[data-feedback-history-ready="true"]').waitFor()
 const another=page.getByRole('button',{name:'另建一条反馈（保留原回执）',exact:true});if(await another.count())await another.click()
 await page.getByLabel('场景与阶段',{exact:true}).fill('合成匿名反馈');await page.getByLabel('期望行为',{exact:true}).fill('按钮完整显示');await page.getByLabel('实际行为',{exact:true}).fill('合成按钮换行');await page.getByLabel('复现步骤（匿名）',{exact:true}).fill('打开工具市场并查看合成页面');await page.getByRole('button',{name:'生成反馈记录',exact:true}).click();await page.getByRole('checkbox',{name:'我已检查全部预览，确认没有密钥、学生资料或其他敏感信息。',exact:true}).waitFor()
}
async function consent(page){await page.getByRole('checkbox',{name:'我已检查全部预览，确认没有密钥、学生资料或其他敏感信息。',exact:true}).check();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='确认提交到校内 Hub'&&!b.disabled))}
const mainStatus=page=>page.locator('[data-feedback-history-ready] > p[role="status"]').last()
test('exact preview consent, real HTTP admin/status closure, navigation/reset, rejected/unreachable/unknown',{timeout:60000},async()=>{
 const page=await open({width:390,height:640},'qcu-market'),admin=await context.newPage()
 try{
  await feedbackPage(page);const submit=page.getByRole('button',{name:'确认提交到校内 Hub',exact:true});assert.equal(await submit.isDisabled(),true)
  await consent(page);await page.getByLabel('实际行为',{exact:true}).fill('修改后的合成按钮换行');assert.equal(await submit.count(),0)
  await page.getByRole('button',{name:'生成反馈记录',exact:true}).click();await consent(page);await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).click();await page.getByText('反馈已收到。以后可在本地回执中主动查询进度。',{exact:false}).waitFor()
  await page.getByRole('button',{name:'复制回执编号',exact:true}).click();assert.match((await page.evaluate(()=>window.syntheticCopies)).at(-1),/^[a-f0-9]{64}$/);await page.getByRole('heading',{name:'本地回执',exact:true}).scrollIntoViewIfNeeded();await shot(page,'feedback-received-narrow')
  await admin.goto(host.services.admin);await admin.getByLabel('密码',{exact:true}).fill('synthetic-preview-password');await admin.getByRole('button',{name:'进入工作区',exact:true}).click();await admin.getByRole('button',{name:/合成匿名反馈 · 已收到/}).first().click();await admin.getByLabel('公开处理说明（不含私人资料）',{exact:true}).fill('合成修正已准备，请自行复核');await shot(admin,'admin-feedback-inbox');await admin.getByRole('button',{name:'标记已处理',exact:true}).click()
  await page.getByRole('button',{name:'查询这条反馈',exact:true}).click();await page.getByText('维护者已处理',{exact:true}).waitFor();await page.getByRole('heading',{name:'本地回执',exact:true}).scrollIntoViewIfNeeded();await shot(page,'feedback-resolved-narrow')
  await admin.getByRole('button',{name:'只读刷新公开状态',exact:true}).click();await admin.getByText('仅解析（未验证签名）',{exact:true}).first().waitFor();await shot(admin,'admin-maintenance')
  await feedbackPage(page);await consent(page);await page.getByRole('button',{name:'市场首页',exact:true}).click();await page.getByRole('button',{name:'问题反馈',exact:true}).click();await page.locator('[data-feedback-history-ready="true"]').waitFor();assert.equal(await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).count(),0)
  await feedbackPage(page);await consent(page);await page.evaluate(()=>window.polishPreview.resetConnection());assert.equal(await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).isDisabled(),true)
  for(const mode of ['rejected','unreachable','unknown']){
   host.setMode(mode);await feedbackPage(page);await consent(page);await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).click()
   if(mode==='rejected')await page.getByText('预览已变化，请重新生成、检查并确认。',{exact:false}).waitFor();else await page.getByText('提交结果暂不确定。',{exact:false}).waitFor()
   assert.ok(!(await mainStatus(page).textContent()).includes('feedback.'))
   const before=host.feedbackCalls().filter(c=>c.method==='submit').length;host.setMode('normal');await page.getByRole('button',{name:'查询这条反馈',exact:true}).click();await page.waitForTimeout(100);assert.equal(host.feedbackCalls().filter(c=>c.method==='submit').length,before)
   if(mode==='unknown')await page.getByText('已收到',{exact:true}).waitFor()
  }
  evidence.cases.push({name:'feedback-http-consent-admin-status-and-failures',passed:true,actions:await clean(page)})
 }finally{host.setMode('normal');await admin.close();await page.close()}
})
test('unknown write survives fresh Host and Client; reopen restores only local receipts and explicit new choice keeps old history',{timeout:30000},async()=>{
 const page=await open({width:1360,height:900},'qcu-market')
 try{
  host.setMode('unknown');await feedbackPage(page);await consent(page);await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).click();await page.getByText('提交结果暂不确定。',{exact:false}).waitFor()
  await page.getByRole('button',{name:'复制回执编号',exact:true}).click();const old=(await page.evaluate(()=>window.syntheticCopies)).at(-1),before=host.feedbackCalls().length,submitsBefore=host.feedbackCalls().filter(c=>c.method==='submit').length
  assert.equal(await page.getByRole('button',{name:'生成反馈记录',exact:true}).isDisabled(),true)
  host.restartHost();host.setMode('normal');await page.reload();await page.waitForFunction(()=>window.polishPreview);await page.getByRole('button',{name:'问题反馈',exact:true}).click();await page.locator('[data-feedback-history-ready="true"]').waitFor()
  assert.equal(host.feedbackCalls().length,before);assert.ok(await page.getByRole('button',{name:'查询回执 '+old.slice(0,8)+' · 待查询',exact:true}).count());await shot(page,'feedback-history-restored')
  await page.getByRole('button',{name:'查询这条反馈',exact:true}).click();await page.getByText('已收到',{exact:true}).waitFor();assert.equal(host.feedbackCalls().filter(c=>c.method==='submit').length,submitsBefore)
  const count=await page.locator('.qcu-receipt-list li').count()
  await page.getByRole('button',{name:'另建一条反馈（保留原回执）',exact:true}).click();await page.getByLabel('场景与阶段',{exact:true}).fill('重新打开后的另一条合成反馈');await page.getByLabel('期望行为',{exact:true}).fill('可查询原回执');await page.getByLabel('实际行为',{exact:true}).fill('本地历史仍可见');await page.getByLabel('复现步骤（匿名）',{exact:true}).fill('打开历史，再明确另建反馈');await page.getByRole('button',{name:'生成反馈记录',exact:true}).click();await consent(page);await page.getByRole('button',{name:'确认提交到校内 Hub',exact:true}).click();await page.getByText('反馈已收到。以后可在本地回执中主动查询进度。',{exact:false}).waitFor()
  assert.equal(await page.locator('.qcu-receipt-list li').count(),count+1);assert.equal(await page.getByRole('button',{name:'查询回执 '+old.slice(0,8)+' · 已收到',exact:true}).count(),1);await page.getByRole('heading',{name:'本地回执',exact:true}).scrollIntoViewIfNeeded();await shot(page,'feedback-history-new-and-old')
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/feedback/.test(k))),false);evidence.cases.push({name:'fresh-host-client-history-unknown-and-explicit-new',passed:true,oldReceiptPrefix:old.slice(0,8),receiptCount:count+1,actions:await clean(page)})
 }finally{host.setMode('normal');await page.close()}
})
test('standalone market keeps P9/manual guide, exact official settings path and no side effects',{timeout:20000},async()=>{
 const page=await open({width:390,height:640},'qcu-market')
 try{
  const url=new URL(page.url());url.searchParams.set('branding','off');await page.goto(url.href);await page.getByRole('button',{name:'新手指引',exact:true}).click();await page.getByRole('button',{name:'进入首次任务指引',exact:true}).click();await page.getByText('当前未提供教学主题指引。',{exact:false}).waitFor();await page.getByRole('heading',{name:'新手指引',exact:true}).waitFor();assert.equal(await page.getByText('设置 → 模型',{exact:false}).count()>0,true);await shot(page,'standalone-manual-guide');const actions=await clean(page);assert.equal(actions.filter(a=>['session-create','feedbackSubmit','feedbackStatus'].includes(a.name)).length,0);evidence.cases.push({name:'standalone-market-manual-guide',passed:true,actions})
 }finally{await page.close()}
})
test('problem-specific folded help is reachable and has no network/model/install effects',{timeout:20000},async()=>{
 const page=await open({width:390,height:640},'qcu-teacher-help')
 try{
  await page.getByLabel('合成宿主主题',{exact:true}).selectOption('dark');await page.getByLabel('合成宿主字号',{exact:true}).selectOption('22')
  const before=await clean(page),requests=[],calls=host.feedbackCalls().length;page.on('request',r=>requests.push(r.url()))
  const help=page.getByRole('region',{name:'按问题查看帮助',exact:true});await help.getByRole('heading',{name:'遇到问题',exact:true}).scrollIntoViewIfNeeded()
  assert.equal(await help.locator('details').count(),6)
  for(const title of ['网络或校内 Hub 无法连接','提示缺少或无效的 API Key','服务繁忙或请求限流','服务明确提示额度或余额不足','无法访问工作文件夹','安装结果不确定']){
   const summary=help.locator('summary').filter({hasText:title});await summary.click();const topic=summary.locator('..');assert.equal(await topic.getAttribute('open'),'');const paragraph=topic.locator('p');await paragraph.scrollIntoViewIfNeeded();const box=await paragraph.boundingBox(),panel=await page.locator('#panel').boundingBox();assert.ok(box.y>=panel.y-1&&box.y+box.height<=640&&box.x>=panel.x&&box.x+box.width<=390);await summary.click()
  }
  await help.locator('summary').filter({hasText:'服务繁忙或请求限流'}).click();await help.getByText('等待一段时间后，再由你决定是否重试。繁忙、容量不足或限流不代表余额耗尽；若持续出现，请查看服务商公告或联系维护者。',{exact:true}).scrollIntoViewIfNeeded();await shot(page,'help-busy-dark-narrow-22')
  await help.locator('summary').filter({hasText:'服务繁忙或请求限流'}).click();const install=help.locator('summary').filter({hasText:'安装结果不确定'});await install.click();await install.locator('..').locator('p').scrollIntoViewIfNeeded();await shot(page,'help-install-dark-narrow-22')
  const helpActions=await clean(page);assert.deepEqual(helpActions,before);assert.deepEqual(requests,[]);assert.equal(host.feedbackCalls().length,calls)
  await page.setViewportSize({width:1360,height:900});await page.getByLabel('合成宿主主题',{exact:true}).selectOption('light');await page.getByLabel('合成宿主字号',{exact:true}).selectOption('14');await help.scrollIntoViewIfNeeded();await shot(page,'help-topics-desktop')
  assert.equal(await page.getByText('模型没有响应时，检查网络、API Key 和服务额度。',{exact:false}).count(),0)
  evidence.cases.push({name:'problem-help-no-effects',passed:true,topics:6,requests,actionsBeforeHelp:before,actionsAfterHelp:helpActions})
 }finally{await page.close()}
})
test('zero external requests and unexpected React errors',()=>{assert.deepEqual(evidence.outside,[]);assert.deepEqual(evidence.errors,[]);evidence.cases.push({name:'network-and-react',passed:true})})

