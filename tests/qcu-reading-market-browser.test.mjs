// Exact compiled Client and packaged Host, actual signed loopback publications/feeds.
// Official rc2 RPC transport is real; manager business effects and model are synthetic.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,cp,symlink,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {createServer} from 'node:http'
import {admissionOut,readingEntry,readingRaw,hash,materialize,prepareAdmissionFeeds,signedFeed} from './support/reading-admission.mjs'
import {publishedReading} from './support/reading-publication.mjs'
import {syntheticUpdateArchive,syntheticUpdateEntry} from './support/market-update-fixture.mjs'
const deps=process.env.QCU_OFFICIAL_DEPENDENCIES,browserDeps=process.env.QCU_BROWSER_DEPENDENCIES
const req=createRequire(resolve(deps,'package.json')),browserReq=createRequire(resolve(browserDeps,'package.json'))
const {chromium}=browserReq('playwright'),out=resolve(process.env.QCU_ADMISSION_BROWSER_OUT??join(admissionOut,'browser')),exact=join(admissionOut,'exact/package')
test('exact candidate browser: signed reading discovery, disabled install consent and signed update/restart states', {timeout:90000},async()=>{
 await mkdir(out,{recursive:true});const result={status:'running',compiledClient:'exact candidate bytes',host:'exact candidate with audited dependency link',modelCalls:0,realCredentialAccess:0,nativeInstall:false,production:false,errors:[],externalRequests:[],screenshots:[],metrics:[],updatesRequests:[]}
 let publication,owned,host,ui,context,page
 try{
  publication=await publishedReading(join(out,'publication'))
  owned=await mkdtemp('/private/tmp/qcu-reading-browser-');const runtime=join(owned,'market'),profile=join(owned,'profile'),local=join(profile,'node_modules/qcu-reading');await cp(exact,runtime,{recursive:true});await symlink(join(deps,'node_modules'),join(runtime,'node_modules'));await mkdir(profile,{recursive:true});await writeFile(join(profile,'package.json'),'{"dependencies":{}}');const patch='[{"id":"qcu-reading","config":{"teacherChoice":"keep"}}]\n';await writeFile(join(profile,'cordis.patch.yml'),patch)
  const f=await prepareAdmissionFeeds(join(out,'updates'))
  const previous=syntheticUpdateArchive('qcu-reading','0.1.0-pilot.3',{peers:readingEntry.peers}),old=syntheticUpdateEntry('qcu-reading','0.1.0-pilot.3',previous,'tools'),now=Date.now(),v3=signedFeed(f.keys,'pilot-reading',[old,...JSON.parse(f.envelopes.v3.payload).entries],8,now)
  await writeFile(join(out,'updates/feeds/updates-v3.json'),JSON.stringify(v3));const feeds={...f.envelopes,v3},entry=publication.entry
  const {startHost}=await import('./support/market-http-fixture.mjs')
  let installState='idle',finishInstall,downloads=0
  const inventory=(version,enabled=false)=>{
   host.state.bundles=[{name:'qcu-reading',version,installed:true,enabled,optional:false,removable:true,rows:[{rowId:'qcu-reading',moduleName:'qcu-reading',entryId:'row:reading'}],overrides:[]}]
   host.state.rows=[{moduleName:'qcu-reading',entryId:'row:reading',patchId:'qcu-reading',enabled,fiberPhase:enabled?'active':null}]
  }
  host=await startHost({marketDir:runtime,backend:{async install(state,path,options){
   assert.equal(options.enabled,false);assert.equal(hash(await readFile(path)),readingEntry.sha256)
   if(installState==='pending')await new Promise(r=>finishInstall=r)
   const enabled=state.bundles[0]?.enabled??false;await materialize(readingRaw,local);await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'qcu-reading':'file:'+readingEntry.file},dsh:{profile:{bundles:enabled?['qcu-reading']:[]}}}));inventory(readingEntry.version,enabled)
   return {changed:true,application:enabled?'restart-required':'applied',stage:'enable',target:'qcu-reading',bundle:'qcu-reading',enabled:false}
  }}})
  const packages=host.host.get('qcuMarket').packages,{fetchPinned,verifyFile}=await import(pathToFileURL(join(runtime,'src/host-core.mjs'))),{MarketUpdates}=await import(pathToFileURL(join(runtime,'src/update-host.mjs')))
  packages.authority=publication.authority
  packages.download=opts=>fetchPinned({...opts,root:join(owned,'downloads'),validate:e=>packages.releaseUrl(e),fetcher:async(...args)=>{downloads++;assert.ok(args[0].startsWith(publication.fixture.public+'/plugins/'));return fetch(...args)}})
  packages.verifyBytes=(path,e)=>verifyFile(path,e,v=>packages.releaseUrl(v))
  let origin
  const updateOptions={profileDir:profile,root:join(owned,'updates-cache'),runtime:'0.2.0-rc.2',policy:f.keys.policy,inventory:async()=>({bundles:host.state.bundles,rows:host.state.rows}),fetcher:async(url,opts)=>{
   assert.ok(url.startsWith('http://192.168.1.68:8080/'));const path=new URL(url).pathname;assert.ok(['/updates-v3.json','/updates-v2.json','/updates.json','/plugins/'+readingEntry.file].includes(path));result.updatesRequests.push(path)
   const response=await fetch(origin+path,opts);return new Response(response.body,{status:response.status,headers:response.headers})
  }}
  let updater=new MarketUpdates({...updateOptions,bootId:'browser-before'});host.host.get('qcuMarket').updates=updater
  const methods={status:[],refresh:[],updatesRecovery:[],prepare:['id','releaseKey'],verify:['id'],cancel:['id'],listBundles:[],listPlugins:[],inspect:['spec','options'],installBundle:['spec','options'],setBundleEnabled:['name','enabled'],setPluginEnabled:['id','enabled'],cancelInstall:['requestId'],waitForInstall:['requestId'],updatesCheck:[],updatesPrepare:['id','releaseKey'],updatesVerify:['id'],updatesCancel:['id'],updatesJournal:['id','requestId'],updatesAcknowledge:['requestId','state']}
  const app=`import React from ${JSON.stringify(req.resolve('react'))};import {createRoot} from ${JSON.stringify(req.resolve('react-dom/client'))};
  const names=${JSON.stringify(methods)},service=namespace=>Object.fromEntries(Object.entries(names).map(([method,fields])=>[method,async(...values)=>{const r=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({namespace,method,args:Object.fromEntries(fields.map((f,i)=>[f,values[i]]))})});const value=await r.json();if(!r.ok)throw Error(value.error);return value}]));
  const remote={qcuMarket:service('qcuMarket'),pluginManager:service('pluginManager'),$mount:async()=>async()=>{}},tasks=[],cleanups=[];let main;
  const ctx={remote,layout:{selectPanel(){}},pluginNavigation:{openBundle(){}},effect(fn){cleanups.push(fn())},on(){return()=>{}},inject(keys,fn){const p=Promise.resolve().then(()=>fn(ctx));tasks.push(p);return {dispose:async()=>{await p}}},slots:{inject(_name,fn){return fn()},register(options,component){if(options.name==='main')main={options,component};return()=>{}}}};
  const plugin=window.acceptanceModule.factory(name=>{if(name!=='react')throw Error('Unexpected external '+name);return React});plugin.apply(ctx);const root=createRoot(document.getElementById('panel'));root.render(React.createElement(main.component,main.options.inject()));window.acceptance={snapshot:()=>main.options.inject().availability.snapshot(),remote};document.getElementById('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';`
  await req('esbuild').build({stdin:{contents:app,resolveDir:resolve('.')},bundle:true,outfile:join(out,'app.js')})
  const html=(await readFile('hub/plugins/qcu-market/preview.html','utf8')).replace('<script src="app.js"></script>','<script>window.__ModuleLoader__={load:m=>window.acceptanceModule=m}</script><script src="/client.js"></script><script src="/app.js"></script>')
  assert.ok(html.includes('/client.js'))
  ui=createServer(async(r,s)=>{try{
   const staticFile=r.url==='/'?null:r.url==='/app.js'?join(out,'app.js'):r.url==='/client.js'?join(exact,'client.js'):null
   if(r.url==='/'){s.setHeader('content-type','text/html');s.end(html)}else if(staticFile){s.setHeader('content-type','text/javascript');s.end(await readFile(staticFile))}
   else if(['/updates.json','/updates-v2.json','/updates-v3.json'].includes(r.url)){const p=r.url==='/updates.json'?'legacy':r.url==='/updates-v2.json'?'v2':'v3',raw=Buffer.from(JSON.stringify(feeds[p]));s.writeHead(200,{'content-type':'application/json','cache-control':'no-store','content-length':raw.length});s.end(raw)}
   else if(r.url==='/plugins/'+readingEntry.file){s.writeHead(200,{'content-length':readingRaw.length});s.end(readingRaw)}
   else if(r.url==='/rpc'&&r.method==='POST'){
    let raw='';for await(const b of r){raw+=b;assert.ok(raw.length<1048576)}const input=JSON.parse(raw);assert.ok(Object.hasOwn(methods,input.method));assert.ok(['qcuMarket','pluginManager'].includes(input.namespace));const answer=await host.raw(input.namespace+'/'+input.method,input.args);const body=await answer.json();s.writeHead(answer.status,{'content-type':'application/json'});s.end(JSON.stringify(body.result??body))
   }else if(r.url==='/favicon.ico')s.writeHead(204).end();else s.writeHead(404).end()
  }catch(e){result.errors.push(e.stack);s.writeHead(500).end(JSON.stringify({error:e.message}))}})
  await new Promise((r,j)=>{ui.once('error',j);ui.listen(0,'127.0.0.1',r)});origin='http://127.0.0.1:'+ui.address().port;result.ownedOrigins=[origin,host.origin,publication.fixture.admin,publication.fixture.public]
  const browserProfile=join(owned,'chromium'),args=['--headless','--user-data-dir='+browserProfile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync']
  context=await chromium.launchPersistentContext(browserProfile,{ignoreDefaultArgs:true,args,chromiumSandbox:true,headless:true,viewport:{width:1120,height:900},executablePath:'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&url.origin!==origin){result.externalRequests.push(url.origin+url.pathname);return route.abort()}return route.continue()})
  page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text())})
  const b=name=>page.getByRole('button',{name,exact:true}),shot=async name=>{
   const geometry=await page.evaluate(()=>({width:innerWidth,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('.qcu-market').scrollWidth>document.querySelector('.qcu-market').clientWidth}));assert.equal(geometry.overflow,false);result.metrics.push({name,...geometry})
   await page.locator('.qcu-market').evaluate(el=>el.style.height='auto');try{const path=join(out,name+'.png');await page.screenshot({path,fullPage:true});result.screenshots.push(path)}finally{await page.locator('.qcu-market').evaluate(el=>el.style.removeProperty('height'))}
  }
  await page.goto(origin);await b('查看'+entry.title).waitFor();assert.equal(downloads,0);assert.equal(host.state.mutations.length,0);assert.equal(result.updatesRequests.length,0)
  for(const theme of ['light','dark'])for(const width of [1120,390]){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await shot('card-'+theme+'-'+width);await b('查看'+entry.title).click()
   const text=await page.locator('.qcu-detail').innerText();assert.match(text,/0.1.0-pilot.4/);assert.match(text,/0.2.0-rc.2/);assert.match(text,/本地工作区/);assert.match(text,/source2a|2a157b356f6af7a9c8d467ddf7c55701fbc33bff/);assert.ok(text.includes(publication.fixture.public));assert.doesNotMatch(text,/只读工具：qcu_feishu/);await shot('detail-'+theme+'-'+width);await b('← 返回列表').click()
  }
  assert.equal(host.state.mutations.length,0);await b('查看'+entry.title).click();await b('下载并查看安装确认').click();await b('确认安装（保持未启用）').waitFor();await shot('install-review-dark-390');assert.equal(downloads,1);assert.equal(host.state.mutations.length,0);await b('拒绝／不安装').click();assert.equal(host.state.mutations.length,0)
  await b('下载并查看安装确认').click();await b('确认安装（保持未启用）').click();await b('查看启用确认').waitFor();assert.equal(host.state.bundles[0].enabled,false);assert.equal(host.state.mutations.length,1);await shot('installed-disabled-dark-390')
  // Explicit synthetic predecessor for upgrade scenarios; not a real pilot.3 profile.
  await b('← 返回列表').click();await materialize(previous,local);await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'qcu-reading':'file:synthetic-old.tgz'},dsh:{profile:{bundles:['qcu-reading']}}}));inventory(old.version,true)
  await b('版本管理').click();assert.equal(result.updatesRequests.length,0);await b('检查全部更新').click();await b('核对'+entry.title+'新版').waitFor();assert.equal(host.state.mutations.length,1);assert.deepEqual(result.updatesRequests,['/updates-v3.json']);await shot('update-available-dark-390')
  await b('核对'+entry.title+'新版').click();await b('下载并查看升级确认').click();await b('取消本次升级').waitFor();await shot('update-review-dark-390');await b('取消本次升级').click();assert.equal(host.state.mutations.length,1)
  await b('下载并查看升级确认').click();await b('取消本次升级').waitFor();await writeFile(join(profile,'cordis.patch.yml'),patch+' ');await b('确认升级 '+entry.title).click();await page.getByText(/已安装内容或配置变化/).waitFor();assert.equal(host.state.mutations.length,1);await writeFile(join(profile,'cordis.patch.yml'),patch)
  await b('检查全部更新').click();await b('核对'+entry.title+'新版').click();await b('下载并查看升级确认').click();await b('取消本次升级').waitFor();installState='pending';await b('确认升级 '+entry.title).click();await page.getByText(/正在升级；保留原启用状态/).waitFor();await shot('update-pending-dark-390');assert.equal(host.state.mutations.length,2);finishInstall();await page.getByText(/新版安装已返回/).waitFor();await shot('update-restart-dark-390')
  assert.equal(await readFile(join(profile,'cordis.patch.yml'),'utf8'),patch);assert.equal(host.state.bundles[0].enabled,true)
  updater.dispose();updater=new MarketUpdates({...updateOptions,bootId:'browser-after'});host.host.get('qcuMarket').updates=updater;await b('检查全部更新').click();await page.getByText(/已在新进程核对目标版本/).waitFor();await shot('update-complete-dark-390');assert.equal(JSON.parse(await updater.recovery()).state,'verified')
  assert.equal(host.state.mutations.length,2);assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[])
  result.status='passed';result.counts={downloads,simulatedInstalls:2,automaticInstalls:0,simulatedEnables:0};result.configurationPreserved=true;result.restart='new disposable Host; native restart untested';result.previousReading='synthetic fixture, not native pilot.3';result.archive=readingEntry.sha256
 }catch(e){result.status='failed';result.failure=e.stack;result.body=await page?.locator('body').innerText().catch(()=>null);await page?.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e}
 finally{
  await context?.close();result.browserClosed=true;host?.host.get('qcuMarket')?.updates?.dispose?.();await host?.close();if(ui){ui.closeAllConnections();await new Promise(r=>ui.close(r))}await publication?.close();for(const origin of result.ownedOrigins??[])await assert.rejects(fetch(origin+'/'));if(owned)await rm(owned,{recursive:true,force:true});result.temporaryServersStopped=true;result.closedOriginsConnectionRefused=true;await writeFile(join(out,'results.json'),JSON.stringify(result,null,2))
 }
})
