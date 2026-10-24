// Local simulated operator review of the actual frozen expert handoff. No real approval/deployment.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:http'
import {readFile,mkdir,writeFile,cp,symlink,mkdtemp,rm,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {CatalogAuthority} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
import {bundledCatalog} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
const deps=process.env.QCU_OFFICIAL_DEPENDENCIES,req=createRequire(resolve(deps,'package.json')),{chromium}=req('playwright')
const out=resolve('.work/suite-integration-a/browser'),handoff='/Users/mcq/Artifacts/qcu-harness/0.2.0-expert-library.2/handoff',expert=bundledCatalog.entries.find(e=>e.id==='qcu-expert-teams')
test('actual frozen expert upload/review/publication -> signed HTTP -> authority -> market consent',async()=>{
 await mkdir(out,{recursive:true});const result={status:'running',operatorReview:'simulation-only',nativeDSH:'untested',model:'not-called',production:'untouched',checks:[],screenshots:[],errors:[],externalRequests:[]}
 let child,context,ui,host,owned,page,adminPage
 try{
  child=spawn('python3',['tests/support/hub-publication-fixture.py'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
  let log='';child.stderr.on('data',b=>log+=b)
  const fixture=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('fixture timeout: '+log)),15000);child.stdout.once('data',b=>{clearTimeout(timer);try{r(JSON.parse(b.toString().trim()))}catch(e){j(e)}});child.once('exit',c=>{clearTimeout(timer);j(Error('fixture exit '+c+log))})})
  owned=await mkdtemp('/private/tmp/qcu-suite-browser-');const runtime=join(owned,'market'),preparedHandoff=join(owned,'handoff')
  // Existing admin policy accepts text attachments, not Python helpers or PNGs.
  // Project only those explicitly identified extras; preserve every retained byte.
  const omit=new Set(['source/pack.py','preview/cleanup-confirmation-desktop-light.png','preview/partial-opinion-desktop-light.png','preview/partial-opinion-360-dark.png','preview/partial-opinion-desktop-dark.png','preview/cleanup-confirmation-360-light.png','preview/partial-report-desktop-light.png','preview/cleanup-preview.png','preview/partial-report-360-light.png','preview/partial-report-desktop-dark.png','preview/partial-opinion-360-light.png','preview/cleanup-confirmation-desktop-dark.png','preview/partial-report-360-dark.png','preview/cleanup-confirmation-360-dark.png'])
  const projection={source:handoff,retained:[],omitted:[],frozenPackageUnchanged:true,reason:'Existing admin text attachment policy; original extras retained at frozen source.'}
  const copy=async dir=>{for(const row of await readdir(join(handoff,dir),{withFileTypes:true})){
   const name=dir?dir+'/'+row.name:row.name;if(row.isDirectory()){await copy(name);continue}assert.ok(row.isFile()&&!row.isSymbolicLink());const bytes=await readFile(join(handoff,name)),entry={path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
   if(omit.has(name)){projection.omitted.push(entry);continue}await mkdir(join(preparedHandoff,name,'..'),{recursive:true});await writeFile(join(preparedHandoff,name),bytes);projection.retained.push(entry)
  }};await copy('');assert.equal(projection.retained.length,33);assert.equal(projection.omitted.length,14);await writeFile(join(out,'handoff-projection.json'),JSON.stringify(projection,null,2));result.handoffProjection={retained:33,omitted:14,originalUnchanged:true,manifest:join(out,'handoff-projection.json')}
  await cp(resolve('hub/plugins/qcu-market'),runtime,{recursive:true});await symlink(join(deps,'node_modules'),join(runtime,'node_modules'))
  const {startHost}=await import('./support/market-http-fixture.mjs')
  host=await startHost({marketDir:runtime,backend:{async install(state,path,options){
   assert.ok(path.endsWith(expert.release.file));assert.equal(options.enabled,false)
   state.bundles=[{name:expert.id,version:expert.release.version,installed:true,enabled:false,optional:false,removable:true,rows:[{rowId:expert.id,moduleName:expert.id,entryId:'fixture:'+expert.id}],overrides:[]}]
   state.rows=[{moduleName:expert.id,entryId:'fixture:'+expert.id,patchId:expert.id,enabled:false,fiberPhase:null}]
   return {changed:true,application:'applied',stage:'enable',target:expert.id,bundle:expert.id,enabled:false}
  }}})
  const packages=host.host.get('qcuMarket').packages,{fetchPinned,verifyFile}=await import(pathToFileURL(join(runtime,'src/host-core.mjs')))
  packages.authority=new CatalogAuthority(fixture.trust,{test:true,root:join(owned,'authority')})
  let downloads=0;packages.download=opts=>fetchPinned({...opts,root:join(owned,'cache'),validate:e=>packages.releaseUrl(e),fetcher:async(...args)=>{downloads++;return fetch(...args)}})
  packages.verifyBytes=(path,e)=>verifyFile(path,e,v=>packages.releaseUrl(v))
  const entry=`import React from ${JSON.stringify(req.resolve('react'))};import {createRoot} from ${JSON.stringify(req.resolve('react-dom/client'))};import {createMarketViews} from ${JSON.stringify(resolve('hub/plugins/qcu-market/src/market-view.mjs'))};import {CatalogRuntime} from ${JSON.stringify(resolve('hub/plugins/qcu-market/src/catalog-runtime.mjs'))};
  const names={status:[],refresh:[],updatesRecovery:[],prepare:['id','releaseKey'],verify:['id'],cancel:['id'],listBundles:[],listPlugins:[],inspect:['spec','options'],installBundle:['spec','options'],setBundleEnabled:['name','enabled'],setPluginEnabled:['id','enabled'],cancelInstall:['requestId'],waitForInstall:['requestId']};
  const service=namespace=>Object.fromEntries(Object.entries(names).map(([method,fields])=>[method,async(...values)=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({namespace,method,args:Object.fromEntries(fields.map((f,i)=>[f,values[i]]))})});if(!r.ok)throw Error('RPC '+r.status);return r.json()}]));
  let state={catalog:{entries:[]},onDetails:()=>{}};const listeners=new Set(),update=patch=>{state={...state,...patch};for(const fn of listeners)fn()};const runtime=new CatalogRuntime({qcuMarket:service('qcuMarket'),pluginManager:service('pluginManager')},update);state.refresh=()=>runtime.refresh();window.acceptance={runtime,snapshot:()=>state};const availability={snapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};const {MarketPage}=createMarketViews(React);createRoot(document.getElementById('panel')).render(React.createElement(MarketPage,{availability,onBack(){}}));void runtime.refresh();`
  await req('esbuild').build({stdin:{contents:entry,resolveDir:resolve('.')},bundle:true,outfile:join(out,'app.js')})
  const style=(await readFile('hub/plugins/qcu-market/preview.html','utf8')).match(/<style>([\s\S]*?)<\/style>/)[1]
  const html='<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>'+style+'</style><div id="panel"></div><script src="/app.js"></script></html>'
  const allowed=new Set(['qcuMarket/status','qcuMarket/refresh','qcuMarket/updatesRecovery','qcuMarket/prepare','qcuMarket/verify','qcuMarket/cancel','pluginManager/listBundles','pluginManager/listPlugins','pluginManager/inspect','pluginManager/installBundle','pluginManager/setBundleEnabled','pluginManager/setPluginEnabled','pluginManager/cancelInstall','pluginManager/waitForInstall'])
  ui=createServer(async(r,s)=>{try{
   if(r.url==='/'){s.setHeader('content-type','text/html');s.end(html)}else if(r.url==='/app.js'){s.setHeader('content-type','text/javascript');s.end(await readFile(join(out,'app.js')))}else if(r.url==='/rpc'&&r.method==='POST'){
    let text='';for await(const b of r){text+=b;assert.ok(text.length<1048576)}const input=JSON.parse(text);assert.ok(allowed.has(input.namespace+'/'+input.method));const response=await host.raw(input.namespace+'/'+input.method,input.args);assert.equal(response.status,200);s.setHeader('content-type','application/json');s.end(JSON.stringify((await response.json()).result))
   }else s.writeHead(404).end()
  }catch(e){result.errors.push(e.stack);s.writeHead(500).end()}})
  await new Promise(r=>ui.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+ui.address().port
  const profile=join(owned,'chromium'),args=['--headless','--user-data-dir='+profile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync']
  result.launch={chromiumSandbox:true,ignoreDefaultArgs:true,args}
  context=await chromium.launchPersistentContext(profile,{ignoreDefaultArgs:true,args,executablePath:process.env.QCU_SUITE_CHROMIUM??'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,chromiumSandbox:true,viewport:{width:1120,height:900}})
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&![origin,fixture.admin].includes(url.origin)){result.externalRequests.push(url.origin+url.pathname);return route.abort()}return route.continue()})
  await context.route('**/favicon.ico',route=>route.fulfill({status:204}))
  page=await context.newPage();adminPage=await context.newPage();for(const p of [page,adminPage])p.on('pageerror',e=>result.errors.push(e.message))
  const ab=name=>adminPage.getByRole('button',{name,exact:true}),mb=name=>page.getByRole('button',{name,exact:true})
  const shot=async(p,name)=>{const panel=p.locator('.qcu-market');if(await panel.count())await panel.evaluate(el=>el.style.height='auto');try{await p.evaluate(()=>window.scrollTo(0,0));const path=join(out,name+'.png');await p.screenshot({path,fullPage:true});result.screenshots.push(path)}finally{if(await panel.count())await panel.evaluate(el=>el.style.removeProperty('height'))}}
  await adminPage.goto(fixture.admin);await adminPage.getByLabel('密码',{exact:true}).fill('Synthetic-only-admin-2026!');await ab('进入工作区').click();await adminPage.locator('#workspace').waitFor()
  await adminPage.locator('#folder').setInputFiles(preparedHandoff);const [upload]=await Promise.all([adminPage.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST'),ab('上传并检查').click()]);result.uploadStatus=upload.status();if(!upload.ok())throw Error('upload '+upload.status()+' '+await upload.text());const uploaded=await upload.json();assert.equal(uploaded.status,'in-review',JSON.stringify(uploaded.report));await adminPage.locator('#detail > .status').filter({hasText:'待人工审核'}).waitFor()
  await adminPage.getByText('市场说明（审核前保存，批准后冻结）',{exact:true}).click()
  const values={'用途':expert.purpose,'适用场景':expert.scenario,'使用前提':expert.prerequisites,'使用步骤或示例':expert.example,'权限与影响':expert.risk,'已测与未测边界':'本机模拟操作员审核及签名发布测试，不代表真实人工批准或生产上架。'+expert.testStatus,'作者':expert.provenance.author,'上游来源':expert.provenance.upstreamSource,'修改说明':expert.provenance.modifications}
  for(const [label,value] of Object.entries(values))await adminPage.getByLabel(label,{exact:true}).fill(value)
  await ab('保存市场说明并预览').click();await adminPage.locator('#message').filter({hasText:'市场说明已保存'}).waitFor()
  await adminPage.getByLabel('审核理由与核验范围').fill('SIMULATION ONLY: frozen archive/source/license/permissions inspected for local integration. No human approval, native/model/business/production acceptance.')
  for(const key of ['source','license','permissions','evidenceBoundaries'])await adminPage.locator('#check-'+key).check()
  await ab('批准本机准备').click();await adminPage.locator('#detail > .status').filter({hasText:'已批准本机准备'}).waitFor()
  await ab('查看发布候选确认').click();await adminPage.locator('#confirm-candidate').check();await ab('生成发布候选').click();await adminPage.locator('#detail > .status').filter({hasText:'本机候选已生成'}).waitFor()
  await ab('预览公开发布').click();await adminPage.locator('#confirm-publish').waitFor({state:'visible'});assert.equal(packages.authority.snapshot().catalog.entries.length,0);await shot(adminPage,'simulated-publication-preview')
  await adminPage.locator('#confirm-publish').check();await ab('确认公开发布').click();await adminPage.locator('#message').filter({hasText:'HTTP下载复核通过'}).waitFor()
  await page.goto(origin);await page.getByRole('button',{name:'查看'+expert.title,exact:true}).waitFor();assert.equal(downloads,0);assert.equal(host.state.mutations.length,0)
  const published=packages.authority.snapshot().catalog.entries[0];assert.deepEqual(published.capabilities,['tools']);assert.equal(published.release.sha256,expert.release.sha256);assert.equal(published.release.bytes,57940);assert.equal(published.release.skill,null);assert.match(published.testStatus,/模拟操作员/)
  result.checks.push('actual frozen handoff admitted by existing P10/publication; simulated operator review; independent candidate and local publish; live signed HTTP CatalogAuthority admission')
  await page.getByRole('button',{name:'查看'+expert.title,exact:true}).click();await page.getByRole('heading',{name:expert.title,exact:true}).waitFor();assert.equal(downloads,0)
  const text=await page.locator('.qcu-detail').innerText();assert.match(text,/专家协作插件；Host\/Client RPC 面板；无 DSH 工具、无 Skill/);assert.doesNotMatch(text,/本插件注册两个只读工具|只读工具：qcu_feishu/)
  await shot(page,'expert-market-detail')
  await mb('下载并查看安装确认').click();await mb('确认安装（保持未启用）').waitFor();assert.equal(downloads,1);assert.equal(host.state.mutations.length,0);await shot(page,'expert-install-preview')
  await mb('拒绝／不安装').click();assert.equal(host.state.mutations.length,0)
  await mb('下载并查看安装确认').click();await mb('确认安装（保持未启用）').waitFor();await mb('确认安装（保持未启用）').click();await mb('查看启用确认').waitFor();assert.equal(host.state.bundles[0].enabled,false);assert.equal(host.state.mutations.length,1)
  await mb('查看启用确认').click();await mb('确认启用').waitFor();await shot(page,'expert-activation-preview');await mb('拒绝／不启用').click();assert.equal(host.state.mutations.length,1)
  await mb('查看启用确认').click();await mb('确认启用').click();await page.getByText('组件已加载',{exact:true}).first().waitFor()
  assert.deepEqual(host.state.mutations.map(m=>m.method),['installBundle','setBundleEnabled','setPluginEnabled']);assert.equal(host.state.rows[0].moduleName,expert.id)
  result.counts={downloads,simulatedInstalls:1,simulatedEnables:2};result.checks.push('browse zero downloads/mutations; actual frozen TGZ hash/size verification; cancel zero installs; explicit disabled install; decline enable zero effects; separate single-component consent via official rc2 Gateway')
  await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.qcu-market').scrollWidth>document.querySelector('.qcu-market').clientWidth),false);await shot(page,'expert-market-390')
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[]);result.status='passed'
 }catch(e){result.status='failed';result.failure=e.stack;result.adminText=await adminPage?.locator('body').innerText().catch(()=>null);await adminPage?.screenshot({path:join(out,'failure-admin.png'),fullPage:true}).catch(()=>{});await page?.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e}
 finally{
  await context?.close();result.browserClosed=true;await host?.close();if(ui){ui.closeAllConnections();await new Promise(r=>ui.close(r))}if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit')}if(owned)await rm(owned,{recursive:true,force:true});result.temporaryServersStopped=true;await writeFile(join(out,'results.json'),JSON.stringify(result,null,2))
 }
})
