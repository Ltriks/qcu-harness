// Real Chromium + the shared P6 UI/state machine. Backend is synthetic, never DSH.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
const deps=process.env.QCU_BROWSER_DEPENDENCIES||process.env.QCU_OFFICIAL_DEPENDENCIES
const require=createRequire(resolve(deps,'package.json'))
const {chromium}=require('playwright')
const out=process.env.QCU_MARKET_PREVIEW_OUT
if(!out)throw Error('QCU_MARKET_PREVIEW_OUT required; first build preview.mjs')
test('shared market UI in Chromium: browsing, consent, navigation, themes and narrow panel',async t=>{
 const server=createServer(async(req,res)=>{try{const name=req.url==='/'?'index.html':req.url==='/app.js'?'app.js':null;if(!name){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(resolve(out,name)))}catch{res.writeHead(500).end()}})
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});t.after(()=>new Promise(r=>server.close(r)))
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close())
 const page=await browser.newPage({viewport:{width:1120,height:900}}),errors=[],outside=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){outside.push(route.request().url());return route.abort()}return route.continue()})
 const url=`http://127.0.0.1:${server.address().port}`
 const button=name=>page.getByRole('button',{name,exact:true})
 const calls=()=>page.evaluate(()=>window.qcuPreview.calls)
 const mutations=async()=> (await calls()).filter(x=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(x.name))
 const open=()=>button('查看QCU学习方法教练').click()
 const ready=()=>button('下载并查看安装确认').click()
 const waitText=async text=>{await page.getByText(text,{exact:true}).first().waitFor()}
 const screenshots=resolve(out,'../screenshots');await mkdir(screenshots,{recursive:true})
 const shot=async name=>{await page.locator('.qcu-market').evaluate(el=>el.style.height='auto');await page.screenshot({path:resolve(screenshots,name+'.png'),fullPage:true})}
 await page.goto(url)
 await t.test('home has six real cards, folded diagnostics, no startup requests',async()=>{
  await button('查看QCU学习方法教练').waitFor();assert.equal(await page.locator('article').count(),6);assert.equal(await page.locator('details[open]').count(),0);assert.deepEqual(await calls(),[]);assert.equal(await button('下载并查看安装确认').count(),0);await shot('01-list-light')
 })
 await t.test('five packaged skills and one plugin have distinct categories and accurate search',async()=>{
  await button('技能').click();assert.equal(await page.locator('article').count(),5);assert.equal(await button('查看QCU学习方法教练').count(),0);await page.getByRole('searchbox').fill('分层');assert.equal(await page.locator('article').count(),1);await button('查看分层练习设计').waitFor();await page.getByRole('searchbox').fill('');await shot('02-skills');await button('插件').click();await page.getByRole('searchbox').fill('不存在');await waitText('没有找到匹配项目');await button('清除搜索').click();await page.getByRole('searchbox').fill('复习');assert.equal(await page.locator('article').count(),1)
 })
 await t.test('open/back preserves filters and focus without RPC or consent',async()=>{
  await open();await button('← 返回列表').click();assert.equal(await page.getByRole('searchbox').inputValue(),'复习');assert.equal(await button('插件').getAttribute('aria-pressed'),'true');assert.equal(await button('查看QCU学习方法教练').evaluate(el=>el===document.activeElement),true);assert.deepEqual(await calls(),[]);await open();await shot('03-detail-light')
 })
 await t.test('preparation shows identity, hash and permissions with zero mutations',async()=>{
  await ready();await button('确认安装（保持未启用）').waitFor();const review=await page.locator('.qcu-review').innerText();for(const text of ['SHA256','192.168.1.68:8080','不受工作区沙箱','enabled=false','0.1.0-pilot.2'])assert.ok(review.includes(text));assert.equal((await mutations()).length,0);await shot('04-confirmation')
 })
 await t.test('return revokes pending review and reentry never carries consent',async()=>{
  await button('← 返回列表').click();await open();assert.equal(await button('确认安装（保持未启用）').count(),0);assert.ok((await calls()).some(c=>c.name==='cancel'));assert.equal((await mutations()).length,0)
 })
 await t.test('decline never installs',async()=>{
  await ready();await button('拒绝／不安装').click();await waitText('未授权操作');assert.equal((await mutations()).length,0)
 })
 await t.test('install stays disabled and one separate confirmation covers bundle and exact component',async()=>{
  await ready();await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();assert.equal((await mutations()).length,1);await button('查看启用确认').click();await button('确认启用').waitFor();assert.equal((await mutations()).length,1);const review=await page.locator('.qcu-review').innerText();for(const text of ['qcu-study-coach','唯一组件','profile','应用用户权限'])assert.ok(review.includes(text));await button('确认启用').click();await waitText('组件已加载');assert.equal((await mutations()).length,3);await waitText('组件已加载；目标会话的技能发现与调用仍需验证。')
 })
 await t.test('bounded Skill metadata, provenance, cross-entry review lock and independent activation',async()=>{
  await button('← 返回列表').click();await button('技能').click();await page.getByRole('searchbox').fill('');
  await button('查看备课教案与课堂活动').click();assert.equal(await page.getByText('Skill正文（随包静态说明）',{exact:true}).count(),0);assert.equal(await page.locator('.qcu-instructions').count(),0);assert.ok((await page.locator('.qcu-facts').innerText()).includes('固定修订'));
  await ready();await button('确认安装（保持未启用）').waitFor();const review=await page.locator('.qcu-review').innerText();assert.ok(review.includes('仅在明确启用后'));assert.equal(review.includes('教练运行时'),false);
  const before=(await mutations()).length;
  const blocked=await page.evaluate(async()=>{try{await window.qcuPreview.flows[2].prepare();return false}catch(e){return e.message.includes('其他条目')}});assert.equal(blocked,true);assert.equal((await mutations()).length,before);
  await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();
  await button('← 返回列表').click();await button('查看分层练习设计').click();await ready();await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();
  await button('查看启用确认').click();await button('确认启用').waitFor();const activation=await page.locator('.qcu-review').innerText();assert.ok(activation.includes('qcu-tiered-practice'));assert.ok(activation.includes('唯一组件'));await button('确认启用').click();await waitText('组件已加载');
  const states=await page.evaluate(async()=>({bundles:(await window.qcuPreview.remote.pluginManager.listBundles()).value,rows:(await window.qcuPreview.remote.pluginManager.listPlugins()).value}));
  assert.equal(states.bundles.find(b=>b.name==='qcu-lesson-planning').enabled,false);assert.equal(states.rows.find(r=>r.moduleName==='qcu-lesson-planning').enabled,false);assert.equal(states.rows.find(r=>r.moduleName==='qcu-tiered-practice').enabled,true);assert.equal(states.rows.find(r=>r.moduleName==='qcu-study-coach').enabled,true);
  await shot('05-skill-detail');await button('← 返回列表').click();await button('插件').click();await open();
 });
 await t.test('unknown outcome remains blocked and reconciliation stays available',async()=>{
  await page.evaluate(()=>{const f=window.qcuPreview.flows[0];f.request={id:'synthetic-unknown'};f.set({phase:'unconfirmed',message:'Synthetic reply loss'})});assert.equal(await button('下载并查看安装确认').count(),0);const before=(await mutations()).length;await button('核对官方任务结果').click();await waitText('结果待核对');assert.equal((await mutations()).length,before);await button('← 返回列表').click();await button('技能').click();await button('查看课堂笔记与复习').click();await ready();await page.getByRole('alert').filter({hasText:'其他条目'}).waitFor();assert.equal((await mutations()).length,before)
 })
 await t.test('dark and narrow detail/list fit 360px with readable controls',async()=>{
  await page.goto(url);await button('切换明暗').click();await shot('05-list-dark');await page.setViewportSize({width:360,height:900});await button('技能').click();await button('查看引用与写作自查').click();await shot('06-detail-dark-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await button('← 返回列表').click();await shot('07-list-dark-narrow');await button('切换明暗').click();await shot('08-list-light-narrow');await button('查看引用与写作自查').click();await shot('09-detail-light-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 })
 await t.test('no external requests or React/runtime errors',()=>{assert.deepEqual(outside,[]);assert.deepEqual(errors,[])})
})
