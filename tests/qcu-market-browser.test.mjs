// Real Chromium + the shared P6 UI/state machine. Backend is synthetic, never DSH.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
const deps=process.env.QCU_BROWSER_DEPENDENCIES||process.env.QCU_OFFICIAL_DEPENDENCIES
const require=createRequire(resolve(deps,'package.json'))
const {chromium}=require('playwright')
const out=process.env.QCU_MARKET_PREVIEW_OUT
if(!out)throw Error('QCU_MARKET_PREVIEW_OUT required; first build preview.mjs')
test('shared market UI in Chromium: browsing, consent, navigation, themes and narrow panel',async t=>{
 const server=createServer(async(req,res)=>{try{const name=req.url==='/'?'index.html':req.url==='/app.js'?'app.js':null;if(!name){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(resolve(out,name)))}catch{res.writeHead(500).end()}})
 const filePreview=process.env.QCU_BROWSER_FILE_PREVIEW==='1'
 if(!filePreview){await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});t.after(()=>new Promise(r=>server.close(r)))}
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close())
 const page=await browser.newPage({viewport:{width:1120,height:900}}),errors=[],outside=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(filePreview?![pathToFileURL(resolve(out,'index.html')).href,pathToFileURL(resolve(out,'app.js')).href].includes(url.href):url.hostname!=='127.0.0.1'){outside.push(route.request().url());return route.abort()}return route.continue()})
 const url=filePreview?pathToFileURL(resolve(out,'index.html')).href:`http://127.0.0.1:${server.address().port}`
 const button=name=>page.getByRole('button',{name,exact:true})
 const calls=()=>page.evaluate(()=>window.qcuPreview.calls)
 const mutations=async()=> (await calls()).filter(x=>['installBundle','setBundleEnabled','setPluginEnabled'].includes(x.name))
 const open=()=>button('查看QCU学习方法教练').click()
 const ready=()=>button('下载并查看安装确认').click()
 const waitText=async text=>{await page.getByText(text,{exact:true}).first().waitFor()}
 const screenshots=resolve(out,'../screenshots');await mkdir(screenshots,{recursive:true})
 const shot=async name=>{await page.locator('.qcu-market').evaluate(el=>el.style.height='auto');await page.screenshot({path:resolve(screenshots,name+'.png'),fullPage:true})}
 await page.goto(url)
 await t.test('home has eight real cards, folded diagnostics, no startup requests',async()=>{
  await button('查看QCU学习方法教练').waitFor();assert.equal(await page.locator('article').count(),9);assert.equal(await page.locator('details[open]').count(),0);assert.deepEqual(await calls(),[]);assert.equal(await button('下载并查看安装确认').count(),0);await shot('01-list-light')
 })
 await t.test('six packaged skills and two plugins have distinct categories and accurate search',async()=>{
  await button('技能').click();assert.equal(await page.locator('article').count(),6);assert.equal(await button('查看QCU学习方法教练').count(),0);await page.getByRole('searchbox').fill('分层');assert.equal(await page.locator('article').count(),1);await button('查看分层练习设计').waitFor();await page.getByRole('searchbox').fill('');await shot('02-skills');await button('插件').click();await page.getByRole('searchbox').fill('不存在');await waitText('没有找到匹配项目');await button('清除搜索').click();await page.getByRole('searchbox').fill('复习');assert.equal(await page.locator('article').count(),1)
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
 await t.test('external Skill search, source/license, independent status and one activation; navigation never mutates',async()=>{
  const before=(await mutations()).length;
  await button('← 返回列表').click();await button('技能').click();await page.getByRole('searchbox').fill('教研');assert.equal(await page.locator('article').count(),1);
  await button('查看教研简报与工作总结').click();const facts=await page.locator('.qcu-facts').innerText();for(const text of ['第三方改编','Anthropic','Apache-2.0','dbd4588f9e1033efb41dad4bef2f7947c8993d44'])assert.ok(facts.includes(text));
  assert.equal((await mutations()).length,before);assert.equal(await page.locator('.qcu-instructions').count(),0);await shot('10-external-detail');
  await button('← 返回列表').click();assert.equal(await page.getByRole('searchbox').inputValue(),'教研');await button('查看教研简报与工作总结').click();assert.equal((await mutations()).length,before);
  await ready();await button('确认安装（保持未启用）').waitFor();assert.equal((await mutations()).length,before);await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();
  await button('查看启用确认').click();await button('确认启用').waitFor();assert.equal((await mutations()).length,before+1);await shot('11-external-activation-review');await button('确认启用').click();await waitText('组件已加载');assert.equal((await mutations()).length,before+3);
  const states=await page.evaluate(()=>window.qcuPreview.flows.map(f=>({id:f.entry.id,status:f.state.status?.state,phase:f.state.phase})));assert.equal(states.find(s=>s.id==='qcu-team-briefing').status,'component-active');assert.equal(states.find(s=>s.id==='qcu-lesson-planning').status,'installed-disabled');assert.equal(states.find(s=>s.id==='qcu-note-organizer').status,undefined);assert.equal(states.find(s=>s.id==='qcu-note-organizer').phase,'idle');
  const done=(await mutations()).length;await button('← 返回列表').click();await button('查看教研简报与工作总结').click();await button('← 返回列表').click();assert.equal((await mutations()).length,done);await page.getByRole('searchbox').fill('');await button('插件').click();await open();
 })
 await t.test('tool-only plugin search/details use official config and natural request, zero browsing mutations',async()=>{
  const before=(await mutations()).length;await button('← 返回列表').click();await button('插件').click();await page.getByRole('searchbox').fill('');assert.equal(await page.locator('article').count(),2)
  await page.getByRole('searchbox').fill('飞书');assert.equal(await page.locator('article').count(),1);await button('查看飞书文档只读').click()
  const detail=await page.locator('.qcu-detail').innerText();for(const text of ['qcu_feishu_outline','qcu_feishu_section','官方插件设置','基础链接','开发机授权不会转移','cc54be21d20b37491ea32805b6d58ac36048f1f8','MIT','版本快照','仍待确认'])assert.ok(detail.includes(text),text)
  assert.doesNotMatch(detail,/启用并确认技能可用后|技能发现与调用|提供方只注册静态说明/)
  assert.equal(await page.getByRole('textbox',{name:'工具请求示例'}).inputValue(),'先列出已配置文档的目录，等我选择章节后再读取。');await button('复制工具请求示例').waitFor();assert.equal((await mutations()).length,before);await shot('12-tools-detail-light')
  await button('← 返回列表').click();assert.equal(await page.getByRole('searchbox').inputValue(),'飞书');assert.equal(await button('查看飞书文档只读').evaluate(el=>el===document.activeElement),true);assert.equal((await mutations()).length,before)
  await button('查看飞书文档只读').click();await ready();await button('确认安装（保持未启用）').waitFor();const review=await page.locator('.qcu-review').innerText();for(const text of ['两个只读工具','原生 CLI 子进程','当前模型/会话','enabled=false'])assert.ok(review.includes(text),text)
  assert.doesNotMatch(review,/注册静态说明/);assert.equal((await mutations()).length,before);await shot('13-tools-install-review')
  await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();assert.equal((await mutations()).length,before+1)
  await button('查看启用确认').click();await button('确认启用').waitFor();assert.equal((await mutations()).length,before+1);await shot('14-tools-activation-review')
  await button('确认启用').click();await waitText('组件已加载');await waitText('组件已加载；请在官方插件设置完成配置，再在目标会话验证工具发现和读取。加载状态不证明已配置、已授权或可读。');assert.equal((await mutations()).length,before+3)
  const states=await page.evaluate(()=>window.qcuPreview.flows.map(f=>({id:f.entry.id,status:f.state.status?.state,phase:f.state.phase})));assert.equal(states.find(s=>s.id==='qcu-feishu-readonly').status,'component-active');assert.equal(states.find(s=>s.id==='qcu-lesson-planning').status,'installed-disabled');assert.equal(states.find(s=>s.id==='qcu-note-organizer').phase,'idle')
  await button('← 返回列表').click();await page.getByRole('searchbox').fill('');await open()
 })
 await t.test('unknown outcome remains blocked and reconciliation stays available',async()=>{
  await page.evaluate(()=>{const f=window.qcuPreview.flows[0];f.request={id:'synthetic-unknown'};f.set({phase:'unconfirmed',message:'Synthetic reply loss'})});assert.equal(await button('下载并查看安装确认').count(),0);const before=(await mutations()).length;await button('核对官方任务结果').click();await waitText('结果待核对');assert.equal((await mutations()).length,before);await button('← 返回列表').click();await button('技能').click();await button('查看课堂笔记与复习').click();await ready();await page.getByRole('alert').filter({hasText:'其他条目'}).waitFor();assert.equal((await mutations()).length,before)
 })
 await t.test('dark and narrow detail/list fit 360px with readable controls',async()=>{
  await page.goto(url);await button('切换明暗').click();await shot('05-list-dark');await page.setViewportSize({width:360,height:900});await button('技能').click();await button('查看引用与写作自查').click();await shot('06-detail-dark-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await button('← 返回列表').click();await shot('07-list-dark-narrow');await button('切换明暗').click();await shot('08-list-light-narrow');await button('查看引用与写作自查').click();await shot('09-detail-light-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 })
 await t.test('tools 360px light/dark detail and new confirmations fit without horizontal overflow',async()=>{
  await page.goto(url);await button('插件').click();await button('查看飞书文档只读').click();await shot('15-tools-light-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await ready();await button('确认安装（保持未启用）').waitFor();await shot('16-tools-install-light-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor();await button('查看启用确认').click();await button('确认启用').waitFor();await shot('17-tools-activation-light-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await button('拒绝／不启用').click();await button('切换明暗').click();await shot('18-tools-dark-narrow');await button('查看启用确认').click();await button('确认启用').waitFor();await shot('19-tools-activation-dark-narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await button('拒绝／不启用').click();await button('← 返回列表').click();await shot('20-plugins-dark-narrow')
 })
 await t.test('tools parent failure stops before row enable and row failure stops without retry',async()=>{
  for(const stage of ['bundle','row']){
   await page.goto(url);await button('插件').click();await button('查看飞书文档只读').click();await ready();await button('确认安装（保持未启用）').click();await button('查看启用确认').waitFor()
   await page.evaluate(stage=>{const remote=window.qcuPreview.remote,method=stage==='bundle'?'setBundleEnabled':'setPluginEnabled';remote.pluginManager[method]=async(id,enabled)=>{window.qcuPreview.calls.push({name:method,args:[id,enabled]});return {ok:true,value:{application:'failed',stage:'enable',target:id,enabled:true}}}},stage)
   await button('查看启用确认').click();await button('确认启用').waitFor();await button('确认启用').click();await waitText('启用部分完成 · 需核对')
   const writes=await mutations();assert.deepEqual(writes.map(c=>c.name),stage==='bundle'?['installBundle','setBundleEnabled']:['installBundle','setBundleEnabled','setPluginEnabled']);assert.equal(await button('确认启用').count(),0)
  }
 })
 await t.test('no external requests or React/runtime errors',()=>{assert.deepEqual(outside,[]);assert.deepEqual(errors,[])})
})
