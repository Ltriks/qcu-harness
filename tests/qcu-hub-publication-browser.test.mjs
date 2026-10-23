// Actual Web -> signed live HTTP -> official rc2 Host gateway -> shared React flow.
// Only manager business effects are counted simulations; no real profile or model.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:http'
import {readFile,mkdir,writeFile,cp,symlink,mkdtemp,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {updateFixture} from './support/market-update-fixture.mjs'
import {CatalogAuthority} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
const deps=process.env.QCU_OFFICIAL_DEPENDENCIES,req=createRequire(resolve(deps,'package.json'))
const browserReq=createRequire(resolve(process.env.QCU_BROWSER_DEPENDENCIES,'package.json')),{chromium}=browserReq('playwright')
const out=resolve(process.env.QCU_P15_BROWSER_OUT||'.work/hub-market-publication/browser'),repo=resolve('.')
test('publication and market actual browser acceptance, synthetic official manager only',async t=>{
 await mkdir(out,{recursive:true});const results={status:'running',nativeDSH:'untested',deployment:'not-run',checks:[],metrics:[],screenshots:[],errors:[],requestFailures:[],externalRequests:[],httpFailures:[]}
 let child,browser,ui,host,owned,market,adminPage
 try{
  child=spawn('python3',['tests/support/hub-publication-fixture.py'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
  let log='';child.stderr.on('data',b=>log+=b)
  const fixture=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('fixture timeout: '+log)),15000);child.stdout.once('data',b=>{clearTimeout(timer);try{r(JSON.parse(b.toString().trim()))}catch(e){j(e)}});child.once('exit',c=>{clearTimeout(timer);j(Error('fixture exit '+c+log))})})
  owned=await mkdtemp('/private/tmp/qcu-publication-browser-')
  const runtime=join(out,'host-package');await rm(runtime,{recursive:true,force:true});await cp(resolve('hub/plugins/qcu-market'),runtime,{recursive:true});await symlink(join(deps,'node_modules'),join(runtime,'node_modules'))
  const {startHost}=await import('./support/market-http-fixture.mjs')
  let installing=false,holdInstall=false,releaseInstall,installs=0,enables=0
  const backend={async install(state,path,options){
   installs++;assert.equal(options.enabled,false);assert.deepEqual(Object.keys(options).sort(),['enabled','registry','requestId']);installing=true
   if(holdInstall)await new Promise(r=>releaseInstall=r)
   const item=host.host.get('qcuMarket').packages.catalog.entries.find(e=>path.endsWith('/'+e.release.file));assert.ok(item)
   state.bundles=[{name:item.id,version:item.release.version,installed:true,enabled:false,optional:false,removable:true,rows:[{rowId:item.id,moduleName:item.id,entryId:'fixture:'+item.id}],overrides:[]}]
   state.rows=[{moduleName:item.id,entryId:'fixture:'+item.id,patchId:item.id,enabled:false,fiberPhase:null}];installing=false
   return {changed:true,application:'applied',stage:'enable',target:item.id,bundle:item.id,enabled:false}
  }}
  host=await startHost({marketDir:runtime,backend})
  const update=await updateFixture(t);host.host.get('qcuMarket').updates=update.host
  let holdUpdates=false,releaseUpdates,checkingUpdates=false
  const checkUpdates=update.host.check.bind(update.host);update.host.check=async(...args)=>{checkingUpdates=true;if(holdUpdates)await new Promise(r=>releaseUpdates=r);return checkUpdates(...args)}
  const packages=host.host.get('qcuMarket').packages,{fetchPinned,verifyFile}=await import(pathToFileURL(join(runtime,'src/host-core.mjs')))
  packages.authority=new CatalogAuthority(fixture.trust,{test:true,root:join(owned,'authority')})
  let downloads=0;packages.download=opts=>fetchPinned({...opts,root:join(owned,'cache'),validate:e=>packages.releaseUrl(e),fetcher:async(...args)=>{downloads++;return fetch(...args)}})
  packages.verifyBytes=(path,e)=>verifyFile(path,e,v=>packages.releaseUrl(v))
  const entry=`import React from ${JSON.stringify(req.resolve('react'))};import {createRoot} from ${JSON.stringify(req.resolve('react-dom/client'))};import {createMarketViews} from ${JSON.stringify(resolve('hub/plugins/qcu-market/src/market-view.mjs'))};import {CatalogRuntime} from ${JSON.stringify(resolve('hub/plugins/qcu-market/src/catalog-runtime.mjs'))};
  const names={status:[],refresh:[],updatesRecovery:[],updatesCheck:[],prepare:['id','releaseKey'],verify:['id'],cancel:['id'],listBundles:[],listPlugins:[],inspect:['spec','options'],installBundle:['spec','options'],setBundleEnabled:['name','enabled'],setPluginEnabled:['id','enabled'],cancelInstall:['requestId'],waitForInstall:['requestId']};
  const service=namespace=>Object.fromEntries(Object.entries(names).map(([method,fields])=>[method,async(...values)=>{const response=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({namespace,method,args:Object.fromEntries(fields.map((f,i)=>[f,values[i]]))})});if(!response.ok)throw Error('RPC '+response.status);return response.json()}]));
  const remote={qcuMarket:service('qcuMarket'),pluginManager:service('pluginManager')};let state={catalog:{entries:[]},onDetails:()=>{}};const listeners=new Set();const update=patch=>{state={...state,...patch};for(const fn of listeners)fn()};const runtime=new CatalogRuntime(remote,update);state.refresh=()=>runtime.refresh();window.acceptance={runtime,snapshot:()=>state};const availability={snapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};const {MarketPage}=createMarketViews(React);createRoot(document.getElementById('panel')).render(React.createElement(MarketPage,{availability,onBack(){}}));void runtime.refresh();`
  await req('esbuild').build({stdin:{contents:entry,resolveDir:repo},bundle:true,outfile:join(out,'app.js')})
  const themeStyle=(await readFile('hub/plugins/qcu-market/preview.html','utf8')).match(/<style>([\s\S]*?)<\/style>/)[1];
  const html='<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>'+themeStyle+'</style><div id="panel"></div><script src="/app.js"></script></html>'
  const allowed=new Set(['qcuMarket/status','qcuMarket/refresh','qcuMarket/updatesRecovery','qcuMarket/updatesCheck','qcuMarket/prepare','qcuMarket/verify','qcuMarket/cancel','pluginManager/listBundles','pluginManager/listPlugins','pluginManager/inspect','pluginManager/installBundle','pluginManager/setBundleEnabled','pluginManager/setPluginEnabled','pluginManager/cancelInstall','pluginManager/waitForInstall'])
  ui=createServer(async(r,s)=>{try{if(r.url==='/'&&r.method==='GET'){s.setHeader('content-type','text/html');s.end(html)}else if(r.url==='/app.js'){s.setHeader('content-type','text/javascript');s.end(await readFile(join(out,'app.js')))}else if(r.url==='/rpc'&&r.method==='POST'){let text='';for await(const b of r){text+=b;assert.ok(text.length<1048576)}const input=JSON.parse(text),method=input.namespace+'/'+input.method;assert.ok(allowed.has(method));const answer=await host.raw(method,input.args);assert.equal(answer.status,200);const reply=await answer.json();s.setHeader('content-type','application/json');s.end(JSON.stringify(reply.result))}else{s.writeHead(404).end()}}catch(e){results.errors.push(e.message);s.writeHead(500).end()}})
  await new Promise(r=>ui.listen(0,'127.0.0.1',r));const uiOrigin='http://127.0.0.1:'+ui.address().port
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1120,height:900}});adminPage=await context.newPage();market=await context.newPage()
  for(const page of [adminPage,market]){page.on('pageerror',e=>results.errors.push(e.message));page.on('response',response=>{if(response.status()>=400)results.httpFailures.push({path:new URL(response.url()).pathname,status:response.status()})});page.on('requestfailed',r=>results.requestFailures.push({url:new URL(r.url()).pathname,error:r.failure()?.errorText}));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))results.errors.push(m.text())})}
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&![uiOrigin,fixture.admin].includes(url.origin)){results.externalRequests.push(url.origin+url.pathname);return route.abort()}return route.continue()});
  await context.route('**/favicon.ico',route=>route.fulfill({status:204}));
  const ab=name=>adminPage.getByRole('button',{name,exact:true}),mb=name=>market.getByRole('button',{name,exact:true})
  const shot=async(page,name)=>{const panel=page.locator('.qcu-market');if(await panel.count())await panel.evaluate(el=>el.style.height='auto');try{await page.screenshot({path:join(out,name+'.png'),fullPage:true});results.screenshots.push(name+'.png')}finally{if(await panel.count())await panel.evaluate(el=>el.style.removeProperty('height'))}}
  await market.goto(uiOrigin);await market.getByText(/签名目录不可用/).first().waitFor();assert.equal(downloads,0)
  await adminPage.goto(fixture.admin);await adminPage.getByLabel('密码',{exact:true}).fill('Synthetic-only-admin-2026!');await ab('进入工作区').click();await adminPage.locator('#workspace').waitFor()
  await adminPage.locator('#folder').setInputFiles(fixture.handoff);await ab('上传并检查').click();await adminPage.locator('#detail > .status').filter({hasText:'待人工审核'}).waitFor()
  await adminPage.getByText('市场说明（审核前保存，批准后冻结）',{exact:true}).click()
  const values={'用途':'合成验收：验证动态市场发布与独立安装确认。','适用场景':'通用工具','使用前提':'仅隔离合成管理器；原生DSH未测。','使用步骤或示例':'查看合成结果并人工复核；不调用模型。','权限与影响':'惰性合成插件，无运行时权限；不接入真实资料。','已测与未测边界':'本机合成链路验收；原生安装和教师业务未测。','作者':'Synthetic fixture authors','上游来源':'Trusted repository fixture generator','修改说明':'Synthetic acceptance only'}
  for(const [label,value] of Object.entries(values))await adminPage.getByLabel(label,{exact:true}).fill(value)
  await ab('保存市场说明并预览').click();await adminPage.locator('#message').filter({hasText:'市场说明已保存'}).waitFor()
  await adminPage.getByLabel('审核理由与核验范围').fill('Synthetic source, license and permissions reviewed. Native and business remain untested.')
  for(const key of ['source','license','permissions','evidenceBoundaries'])await adminPage.locator('#check-'+key).check()
  await ab('批准本机准备').click();await adminPage.locator('#detail > .status').filter({hasText:'已批准本机准备'}).waitFor();assert.equal(packages.authority.snapshot().catalog.entries.length,0)
  await ab('查看发布候选确认').click();await adminPage.locator('#confirm-candidate').check();await ab('生成发布候选').click();await adminPage.locator('#detail > .status').filter({hasText:'本机候选已生成'}).waitFor()
  await ab('预览公开发布').click();await adminPage.locator('#confirm-publish').waitFor({state:'visible'});await ab('确认公开发布').waitFor();await shot(adminPage,'web-publication-confirmation');await adminPage.locator('#publish-confirmation').screenshot({path:join(out,'web-publication-confirmation-panel.png')});results.screenshots.push('web-publication-confirmation-panel.png');assert.equal(downloads,0)
  await adminPage.locator('#confirm-publish').check();await ab('确认公开发布').click();await adminPage.locator('#message').filter({hasText:'HTTP下载复核通过'}).waitFor();results.checks.push('real upload, frozen metadata, approval, candidate, independent publish, signed HTTP self-check')
  await mb('刷新市场').click();await market.getByRole('button',{name:/查看Synthetic checker/}).waitFor();assert.equal(downloads,0);await shot(market,'market-main')
  await mb('版本管理').click();holdUpdates=true;await mb('检查全部更新').click()
  for(let i=0;i<100&&!checkingUpdates;i++)await new Promise(r=>setTimeout(r,10));assert.ok(checkingUpdates)
  await mb('刷新市场').click();await market.getByText(/已有安装、确认或待核对任务/).waitFor();assert.equal(installs,0);assert.equal(downloads,0)
  releaseUpdates();holdUpdates=false;await market.locator('[data-update-product="qcu-study-coach"]').waitFor();await market.getByText('独立发布产品；升级需在官方页面单独核对。',{exact:true}).waitFor();assert.doesNotMatch(await market.locator('.qcu-updates').innerText(),/undefined/);assert.equal(await mb('核对QCU学习方法教练新版').count(),1)
  assert.equal(update.calls.filter(c=>c.name==='installBundle').length,0);results.checks.push('actual signed update inventory through public Typert gateway; active update check blocks refresh; dynamic upgrades labelled official-only')
  await mb('市场首页').click()
  const open=()=>market.getByRole('button',{name:/查看Synthetic checker/}).click()
  await open();await mb('下载并查看安装确认').click();await mb('确认安装（保持未启用）').waitFor();assert.equal(downloads,1);assert.equal(installs,0);await shot(market,'market-install-confirmation');const updateChecks=update.calls.filter(c=>c.name==='fetch').length;assert.match(await market.evaluate(async()=>{try{await window.acceptance.runtime.updates.check();return 'unexpected'}catch(e){return e.message}}),/其他产品/);assert.equal(update.calls.filter(c=>c.name==='fetch').length,updateChecks)
  await mb('刷新市场').click();await market.getByText(/已有安装、确认或待核对任务/).waitFor();assert.equal(installs,0)
  await mb('拒绝／不安装').click();assert.equal(installs,0);results.checks.push('browse zero downloads; exact TGZ download/hash/official inspect; decline zero installs; review blocks refresh')
  await mb('下载并查看安装确认').click();await mb('确认安装（保持未启用）').waitFor()
  await ab('预览撤回').click();await adminPage.locator('#confirm-publish').check();await ab('确认撤回').click();await adminPage.locator('#message').filter({hasText:'HTTP下载复核通过'}).waitFor()
  await mb('确认安装（保持未启用）').click();await market.getByRole('alert').filter({hasText:/操作尚未确认/}).waitFor();assert.equal(installs,0);results.checks.push('withdrawal before confirmation invalidates cached receipt, no install')
  await mb('← 返回列表').click();await mb('刷新市场').click();await market.getByText('暂无可安装的技能',{exact:true}).waitFor()
  await ab('预览恢复此版本').click();await adminPage.locator('#confirm-publish').check();await ab('确认恢复此版本').click();await adminPage.locator('#message').filter({hasText:'HTTP下载复核通过'}).waitFor()
  await mb('刷新市场').click();await open();await mb('下载并查看安装确认').click();await mb('确认安装（保持未启用）').waitFor()
  holdInstall=true;await mb('确认安装（保持未启用）').click();await market.getByText('正在安装',{exact:true}).waitFor();assert.equal(installing,true);await mb('刷新市场').click();await market.getByText(/已有安装、确认或待核对任务/).waitFor();releaseInstall();await mb('查看启用确认').waitFor();assert.equal(installs,1);assert.equal(host.state.bundles[0].enabled,false);assert.equal(enables,0)
  await mb('查看启用确认').click();await mb('确认启用').waitFor();await shot(market,'market-activation-confirmation');assert.equal(host.state.bundles[0].enabled,false)
  await mb('确认启用').click();await market.getByText('组件已加载',{exact:true}).first().waitFor();enables=host.state.mutations.filter(m=>['setBundleEnabled','setPluginEnabled'].includes(m.method)).length;assert.equal(enables,2);results.checks.push('one counted simulated install enabled:false; separate activation consent and exact bundle/row mutations; real rc2 typed Gateway transport')
  for(const theme of ['light','dark'])for(const width of [390,1120]){
   for(const page of [adminPage,market]){await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)}
   await adminPage.getByLabel('外观',{exact:true}).selectOption(theme)
   for(const [page,name] of [[adminPage,'web'],[market,'market-detail']]){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.qcu-market')].some(e=>e.scrollWidth>e.clientWidth));assert.equal(overflow,false,`${name} ${theme} ${width}`);const background=await page.evaluate(()=>getComputedStyle(document.querySelector('.qcu-market')||document.body).backgroundColor);assert.notEqual(background,'rgba(0, 0, 0, 0)');if(name==='market-detail')assert.equal(background,theme==='dark'?'rgb(21, 29, 44)':'rgb(243, 246, 251)');const color=await page.evaluate(()=>getComputedStyle(document.querySelector('.qcu-market')||document.body).color);if(name==='market-detail')assert.equal(color,theme==='dark'?'rgb(228, 234, 228)':'rgb(36, 51, 77)');results.metrics.push({name,theme,width,overflow,background,color});await shot(page,`${name}-${theme}-${width}`)}
   await mb('← 返回列表').click();const main=await market.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('.qcu-market').scrollWidth>document.querySelector('.qcu-market').clientWidth,background:getComputedStyle(document.querySelector('.qcu-market')).backgroundColor,groups:[...document.querySelector('.qcu-app-header').children].map(e=>({right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left})),controls:[...document.querySelectorAll('.qcu-app-header > button')].map(e=>({text:e.textContent,right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left}))}));assert.equal(main.overflow,false);assert.equal(main.background,theme==='dark'?'rgb(21, 29, 44)':'rgb(243, 246, 251)');assert.equal(main.groups.length,3);assert.ok(main.groups.every(g=>g.left>=0&&g.right<=width));assert.equal(main.controls.length,2);assert.ok(main.controls.every(c=>c.left>=0&&c.right<=width));results.metrics.push({name:'market-main',theme,width,...main});await shot(market,`market-main-${theme}-${width}`);await mb('版本管理').click();await market.locator('.qcu-updates').waitFor();assert.equal(await market.evaluate(()=>document.querySelector('.qcu-market').scrollWidth>document.querySelector('.qcu-market').clientWidth),false);await shot(market,`market-updates-${theme}-${width}`);await mb('市场首页').click();await open()
  }
  assert.deepEqual(results.errors,[]);assert.deepEqual(results.requestFailures,[]);assert.deepEqual(results.externalRequests,[]);assert.deepEqual(results.httpFailures,[]);results.status='passed';results.counts={installs,enables,downloads};results.checks.push('390/1120 light/dark main/detail/updates, no horizontal overflow; no page or request failures')
 }catch(e){results.status='failed';results.failure=e.stack;results.flow=await market?.evaluate(()=>window.acceptance?.snapshot().flows?.map(f=>({phase:f.state.phase,message:f.state.message}))).catch(()=>null);await market?.screenshot({path:join(out,'failure-market.png'),fullPage:true}).catch(()=>{});throw e}
 finally{
  await browser?.close();results.browserClosed=!browser?.isConnected();await host?.close();if(ui){ui.closeAllConnections();await new Promise(r=>ui.close(r))}if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit')}if(owned)await rm(owned,{recursive:true,force:true});results.ownedProcessesStopped=true;await writeFile(join(out,'results.json'),JSON.stringify(results,null,2))
 }
})
