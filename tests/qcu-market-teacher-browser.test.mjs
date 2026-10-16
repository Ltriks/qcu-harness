// Actual shared React/Chromium, invented data and synthetic backend only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
const require=createRequire(resolve(process.env.QCU_BROWSER_DEPENDENCIES,'package.json'))
const {chromium}=require('playwright'),out=process.env.QCU_MARKET_PREVIEW_OUT
test('P9 shared React teacher flows in real Chromium',async t=>{
 const server=createServer(async(req,res)=>{const file=req.url==='/'?'index.html':req.url==='/app.js'?'app.js':null;if(!file){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(resolve(out,file)))})
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});t.after(()=>new Promise(r=>server.close(r)))
 const url=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});t.after(()=>browser.close())
 const context=await browser.newContext({viewport:{width:1120,height:900}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:url})
 const page=await context.newPage(),errors=[],outside=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.route('**/*',r=>{if(![url+'/',url+'/app.js'].includes(r.request().url())){outside.push(r.request().url());return r.abort()}return r.continue()})
 const button=name=>page.getByRole('button',{name,exact:true}),box=name=>page.getByRole('textbox',{name,exact:true}),calls=()=>page.evaluate(()=>window.qcuPreview.calls)
 const screenshots=resolve(out,'../screenshots');await mkdir(screenshots,{recursive:true})
 const shot=async name=>{await page.locator('.qcu-market').evaluate(el=>el.style.height='auto');await page.screenshot({path:resolve(screenshots,'p9-'+name+'.png'),fullPage:true})}
 const fit=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.goto(url);await button('开始浏览引导').waitFor()
 await t.test('optional guide Next/Back/skip/reentry/completion/focus never detects readiness or calls RPC',async()=>{
  assert.equal(await page.getByRole('heading',{name:'新手指引',exact:true}).count(),0);await button('开始浏览引导').click();assert.equal(await page.getByRole('heading',{name:'新手指引',exact:true}).evaluate(el=>el===document.activeElement),true)
  assert.equal(await button('上一步').isDisabled(),true);await shot('guide-light');await button('下一步').click();await page.getByRole('heading',{name:'准备自己的模型账号',exact:true}).waitFor();await button('上一步').click();await button('下一步').click();await button('稍后再看').click();assert.equal(await button('新手指引').evaluate(el=>el===document.activeElement),true);await button('新手指引').click();await page.getByRole('heading',{name:'准备自己的模型账号',exact:true}).waitFor()
  assert.doesNotMatch(await page.locator('.qcu-aux-page').innerText(),/系统级锚定|库存|页面内存|持久化|待部署|P9下载/)
  for(let i=0;i<3;i++)await button('下一步').click();await button('完成引导').click();await page.getByText('已浏览引导（不代表已验收）；可随时从“新手指引”再看。',{exact:true}).waitFor();assert.deepEqual(await calls(),[])
 })
 await t.test('all three bounded forms, synthetic examples, current output, editing and real detail mapping',async()=>{
  await button('常用任务').click()
  for(const [title,skill,detail] of [['备课教案','qcu-lesson-planning','备课教案与课堂活动'],['分层练习','qcu-tiered-practice','分层练习设计'],['教研简报','qcu-team-briefing','教研简报与工作总结']]){
   await button(title).click();await button('生成任务文本').click();assert.ok(await page.getByRole('alert').count()>0);await button('填入完整合成示例').click();await shot('form-'+skill);await button('生成任务文本').click();assert.ok((await box('任务文本').inputValue()).includes('/'+skill));await shot('output-'+skill)
   const field=page.locator('form textarea').first();await field.fill('更新的匿名要求');assert.equal(await box('任务文本').count(),0);await button('生成任务文本').click();assert.ok((await box('任务文本').inputValue()).includes('更新的匿名要求'))
   await box('任务文本').fill('教师编辑 '+skill);await button('复制任务文本').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'教师编辑 '+skill)
   await button('查看对应技能详情').click();await page.getByRole('heading',{name:detail,exact:true}).waitFor();assert.equal((await calls()).length,0);await button('← 返回列表').click();assert.equal(await box('任务文本').inputValue(),'教师编辑 '+skill)
   assert.equal(await field.getAttribute('maxlength'),'120');await field.fill('字'.repeat(120));await page.keyboard.type('更多');assert.equal((await field.inputValue()).length,120);await button('生成任务文本').click();await box('任务文本').fill('教师编辑 '+skill)
  }
  await button('备课教案').click();assert.ok((await box('任务文本').inputValue()).includes('qcu-lesson-planning'));assert.deepEqual(await calls(),[])
 })
 await t.test('clipboard unavailability keeps selectable editable task text and requires manual send',async()=>{
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await button('复制任务文本').click();await page.getByText('剪贴板不可用，请手动选中下方任务文本复制。',{exact:true}).waitFor();await box('任务文本').selectText();assert.equal(await box('任务文本').evaluate(el=>el.selectionEnd-el.selectionStart), (await box('任务文本').inputValue()).length)
 })
 await t.test('feedback gate/redaction/version/manual submission, editing invalidates acknowledgment and preview',async()=>{
  await button('问题反馈').click();await button('生成反馈记录').click();assert.equal(await page.getByRole('alert').count(),4)
  await box('场景与阶段').fill('合成示例：新手指引');await box('期望行为').fill('可以点击下一步');await box('实际行为').fill('虚构 sk-syntheticOnly123456 APIKey=madeUpOnly token=pretendToken Authorization: Bearer pretendBearer Authorization: Basic pretendBasic123== teacher@example.invalid /Users/fictional/demo https://fiction.invalid/docx/demo');await box('复现步骤（匿名）').fill('打开指引，点击下一步。')
  await button('生成反馈记录').click();const safe=await box('脱敏反馈预览').inputValue();for(const raw of ['sk-synthetic','madeUpOnly','pretendToken','pretendBearer','pretendBasic123','teacher@example.invalid','/Users/fictional','fiction.invalid'])assert.ok(!safe.includes(raw),raw)
  assert.ok(safe.includes('0.1.0-pilot.9.1'));assert.ok(safe.includes('非实际安装版本检测'));assert.equal(await button('复制反馈记录').isDisabled(),true);await shot('feedback-review')
  await page.getByRole('checkbox').check();await button('复制反馈记录').click();await page.getByText('剪贴板不可用，请手动选中脱敏反馈预览复制；尚未提交。',{exact:true}).waitFor();await box('脱敏反馈预览').selectText();assert.equal(await box('脱敏反馈预览').evaluate(el=>el.selectionEnd-el.selectionStart),safe.length)
  await box('实际行为').fill('新的匿名现象');assert.equal(await box('脱敏反馈预览').count(),0);await button('生成反馈记录').click();assert.equal(await page.getByRole('checkbox').isChecked(),false)
  await page.evaluate(()=>{delete navigator.clipboard});await page.getByRole('checkbox').check();await button('复制反馈记录').click();await page.getByText('记录已复制，尚未提交。请通过事先约定的渠道手动发送。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await box('脱敏反馈预览').inputValue())
  await button('清空反馈').click();assert.equal(await box('脱敏反馈预览').count(),0);assert.equal(await box('实际行为').inputValue(),'');assert.deepEqual(await calls(),[])
 })
 await t.test('auth/callback whole-URL redaction reaches actual manual clipboard export, gated review and benign help URL',async()=>{
  const auth='https://identity.example.invalid/oauth/authorize?code=syntheticCode&state=syntheticState',callback='https://id.example.invalid/callback?access_token=syntheticValue',benign='https://help.example.invalid/error?reason=timeout'
  for(const [name,value] of [['场景与阶段','合成：授权错误'],['期望行为','显示错误说明'],['实际行为',[auth,callback,benign].join('\n')],['复现步骤（匿名）','虚构测试，没有打开任何链接']])await box(name).fill(value)
  const detail=page.locator('.qcu-aux-page details');assert.equal(await detail.getAttribute('open'),null);await page.getByText('自动遮盖不能识别所有个人信息，请逐项检查预览再复制。',{exact:true}).waitFor();await detail.locator('summary').focus();await page.keyboard.press('Enter');assert.notEqual(await detail.getAttribute('open'),null);await page.keyboard.press('Enter')
  assert.doesNotMatch(await page.locator('.qcu-aux-page').innerText(),/页面内存|持久化|任务草稿/)
  await page.evaluate(()=>navigator.clipboard.writeText('synthetic clipboard sentinel'));await button('生成反馈记录').click();const safe=await box('脱敏反馈预览').inputValue();assert.ok(safe.includes(benign));for(const raw of [auth,callback,'identity.example.invalid','id.example.invalid','syntheticCode','syntheticState','syntheticValue'])assert.ok(!safe.includes(raw),raw)
  assert.equal(await button('复制反馈记录').isDisabled(),true);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'synthetic clipboard sentinel');await page.getByRole('checkbox').check();await button('复制反馈记录').click();await page.getByText('记录已复制，尚未提交。请通过事先约定的渠道手动发送。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),safe);await shot('feedback-auth-url-export')
  assert.deepEqual(await calls(),[]);await button('清空反馈').click()
 })
 await t.test('feedback navigation clears data; task reset/unmount/reload clear drafts truthfully',async()=>{
  await box('实际行为').fill('临时匿名反馈');await button('市场首页').click();await button('问题反馈').click();assert.equal(await box('实际行为').inputValue(),'');assert.equal(await box('脱敏反馈预览').count(),0)
  await button('常用任务').click();await button('备课教案').click();assert.ok(await box('任务文本').count());await button('清空本任务').click();assert.equal(await box('任务文本').count(),0);assert.equal(await page.locator('form textarea').first().inputValue(),'')
  await button('分层练习').click();assert.ok(await box('任务文本').count());await button('市场首页').click();await button('← 返回对话').click();await button('打开市场').click();await button('常用任务').click();await button('分层练习').click();assert.equal(await box('任务文本').count(),0);assert.equal(await page.locator('form textarea').first().inputValue(),'')
  await button('填入完整合成示例').click();await button('生成任务文本').click();await page.reload();await button('常用任务').click();await button('分层练习').click();assert.equal(await box('任务文本').count(),0)
 })
 await t.test('360px light/dark guide, all forms/output and feedback remain single column with keyboard focus',async()=>{
  await page.setViewportSize({width:360,height:900})
  for(const theme of ['light','dark']){
   if(theme==='dark')await button('切换明暗').click();await button('新手指引').click();await fit();await shot('guide-'+theme+'-360');const nextFocus=await button('上一步').isDisabled()?'下一步':'上一步';await page.keyboard.press('Tab');assert.equal(await button(nextFocus).evaluate(el=>el===document.activeElement),true)
   await button('常用任务').click();for(const title of ['备课教案','分层练习','教研简报']){await button(title).click();await button('填入完整合成示例').click();await fit();await shot('task-'+title+'-'+theme+'-360');await button('生成任务文本').click();await fit();await shot('output-'+title+'-'+theme+'-360')}
   await button('问题反馈').click();for(const [name,value] of [['场景与阶段','合成：预览'],['期望行为','下一步'],['实际行为','虚构无响应'],['复现步骤（匿名）','打开指引']])await box(name).fill(value);await button('生成反馈记录').click();await fit();await shot('feedback-'+theme+'-360')
  }
  assert.deepEqual(await calls(),[])
 })
 await t.test('auxiliary leave revokes a pending review and unknown mutation retains serial lock',async()=>{
  await page.goto(url);await button('查看备课教案与课堂活动').click();await button('下载并查看安装确认').click();await button('确认安装（保持未启用）').waitFor();await button('新手指引').click();await button('市场首页').click();await button('查看备课教案与课堂活动').click();assert.equal(await button('确认安装（保持未启用）').count(),0);assert.ok((await calls()).some(c=>c.name==='cancel'));assert.equal((await calls()).filter(c=>c.name==='installBundle').length,0)
  await page.evaluate(()=>{const f=window.qcuPreview.flows[1];f.request={id:'synthetic-unknown'};f.set({phase:'unconfirmed',message:'合成未知结果'})});await button('常用任务').click();await button('教研简报').click();await button('查看对应技能详情').click();await button('下载并查看安装确认').click();await page.getByRole('alert').filter({hasText:'其他条目'}).waitFor();assert.equal((await calls()).filter(c=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(c.name)).length,0)
 })
 await t.test('no external requests, React errors or harvested device/model data',()=>{assert.deepEqual(outside,[]);assert.deepEqual(errors,[])})
})
