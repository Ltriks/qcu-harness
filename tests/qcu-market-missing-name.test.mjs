// Real React DOM and update flows; isolated Host fixtures, never the native app.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {updateFixture,syntheticUpdateArchive,syntheticUpdateEntry} from './support/market-update-fixture.mjs'
import {readingRaw,readingEntry,materialize,testKeys,signedFeed} from './support/reading-admission.mjs'
import {MarketUpdates} from '../hub/plugins/qcu-market/src/update-host.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'

const sdk=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const {chromium}=createRequire(resolve(process.env.QCU_BROWSER_DEPENDENCIES,'package.json'))('playwright')
const root=resolve(process.env.QCU_MISSING_MARKET_ROOT??'hub/plugins/qcu-market')
const out=resolve(process.env.QCU_MISSING_OUT??'.work/qcu-market-missing-name/rendered')

for(const boundary of ['source','compiled'])test(`${boundary}: missing catalog titles retain exact IDs, source uncertainty and explicit consent`,{timeout:60000},async t=>{
 const output=join(out,boundary);await mkdir(output,{recursive:true})
 const owned=await mkdtemp('/private/tmp/qcu-market-missing-name-')
 const available=await updateFixture(t,{id:'qcu-nameless-probe'})
 const profile=join(owned,'profile'),keys=testKeys(),requests=[]
 await materialize(readingRaw,join(profile,'node_modules/qcu-reading'))
 await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{'qcu-reading':'file:immutable-reading.4.tgz'}}))
 await writeFile(join(profile,'cordis.patch.yml'),'[]\n')
 const raw=syntheticUpdateArchive('qcu-study-coach','0.0.1-test.1')
 const envelope=signedFeed(keys,'pilot',[syntheticUpdateEntry('qcu-study-coach','0.0.1-test.1',raw)])
 const host=new MarketUpdates({profileDir:profile,root:join(owned,'cache'),runtime:'0.2.0-rc.2',policy:keys.policy,fetcher:async url=>{
  requests.push(new URL(url).pathname)
  if(url.endsWith('/updates-v3.json')||url.endsWith('/updates-v2.json'))return new Response(null,{status:404})
  assert.ok(url.endsWith('/updates.json'),'check must never download a package')
  const body=JSON.stringify(envelope);return new Response(body,{headers:{'content-length':String(Buffer.byteLength(body))}})
 }})
 const readingCheck=JSON.parse(await host.check()),reading=readingCheck.items.find(i=>i.id==='qcu-reading')
 assert.equal(reading.installedVersion,readingEntry.version);assert.equal(reading.state,'source-unknown');assert.equal(reading.sourceVerified,false)
 assert.deepEqual(requests,['/updates-v3.json','/updates-v2.json','/updates.json'])
 const calls=[],ok=value=>({ok:true,value})
 const remotes={available:available.remote,reading:{qcuMarket:{
  status:async()=>ok(JSON.stringify(marketRuntime)),updatesRecovery:async()=>ok('null'),updatesCheck:async()=>ok(JSON.stringify(readingCheck))
 }}}
 let server,context,page,origin
 const result={boundary,status:'running',native:false,syntheticProfile:true,compiledProbe:boundary==='compiled'?'only factory return instrumented to expose existing view/flow closures':null,errors:[],externalRequests:[]}
 try{
  const source=boundary==='source'?`import {createUpdateView} from ${JSON.stringify(join(root,'src/update-view.mjs'))};import {MarketUpdateFlow} from ${JSON.stringify(resolve('hub/plugins/qcu-market/src/update-flow.mjs'))};`:`const {createUpdateView,MarketUpdateFlow}=window.missingNameModule.factory(name=>{if(name!=='react')throw Error(name);return React});`
  const app=`import React from ${JSON.stringify(sdk.resolve('react'))};import {createRoot} from ${JSON.stringify(sdk.resolve('react-dom/client'))};${source}
  const scenario=new URL(location.href).searchParams.get('scenario')??'reading',calls=[],details=[],remote={};
  for(const [namespace,methods] of Object.entries({qcuMarket:['status','updatesRecovery','updatesCheck','updatesPrepare','updatesVerify','updatesCancel','updatesJournal','updatesAcknowledge'],pluginManager:['listBundles','listPlugins','inspect','installBundle','waitForInstall','cancelInstall']}))remote[namespace]=Object.fromEntries(methods.map(method=>[method,async(...args)=>{calls.push({namespace,method,args});const r=await fetch('/rpc/'+scenario,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({namespace,method,args})});const reply=await r.json();if(!r.ok)throw Error(reply.error);return reply}]));
  const flow=new MarketUpdateFlow(remote),View=createUpdateView(React),root=createRoot(document.getElementById('root'));
  function App(){const [entries,setEntries]=React.useState([]);window.setCatalog=setEntries;return React.createElement(View,{updater:flow,catalog:{entries},onDetails:id=>details.push(id)})}
  window.fixture={calls,details,snapshot:()=>flow.snapshot(),prepare:id=>flow.prepare(id),dispose:()=>{root.unmount();flow.dispose()}};root.render(React.createElement(App));`
  await sdk('esbuild').build({stdin:{contents:app,resolveDir:resolve('.')},bundle:true,outfile:join(output,'app.js')})
  let compiled=await readFile(join(root,'client.js'),'utf8')
  assert.equal(compiled.split('return createLoopPlugin(React);').length,2)
  compiled=compiled.replace('return createLoopPlugin(React);','return {createUpdateView,MarketUpdateFlow};')
  const html=`<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.__ModuleLoader__={load:m=>window.missingNameModule=m}</script>${boundary==='compiled'?'<script src="/client.js"></script>':''}<script src="/app.js"></script>`
  server=createServer(async(req,res)=>{try{
   if(req.url==='/app.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(output,'app.js')))}
   else if(req.url==='/client.js'){res.setHeader('content-type','text/javascript');res.end(compiled)}
   else if(req.url.startsWith('/rpc/')&&req.method==='POST'){
    const scenario=req.url.slice(5);let body='';for await(const b of req){body+=b;assert.ok(body.length<65536)}
    const {namespace,method,args}=JSON.parse(body);calls.push({scenario,namespace,method,args})
    assert.ok(Object.hasOwn(remotes,scenario));assert.ok(Object.hasOwn(remotes[scenario],namespace));assert.ok(Object.hasOwn(remotes[scenario][namespace],method))
    const wireArgs=args.slice(0,({updatesCheck:0,updatesPrepare:2}[method]??args.length))
    res.setHeader('content-type','application/json');res.end(JSON.stringify(await remotes[scenario][namespace][method](...wireArgs)))
   }else if(req.url==='/favicon.ico')res.writeHead(204).end()
   else if(req.url.startsWith('/?')){res.setHeader('content-type','text/html');res.end(html)}
   else res.writeHead(404).end()
  }catch(e){result.errors.push(e.stack);res.writeHead(500).end(JSON.stringify({error:e.message}))}})
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});origin='http://127.0.0.1:'+server.address().port
  const browserProfile=join(owned,'chromium')
  context=await chromium.launchPersistentContext(browserProfile,{ignoreDefaultArgs:true,args:['--headless','--user-data-dir='+browserProfile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync'],chromiumSandbox:true,headless:true,viewport:{width:1120,height:900},executablePath:'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
  context.setDefaultTimeout(8000)
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&url.origin!==origin){result.externalRequests.push(url.href);return route.abort()}return route.continue()})
  page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text())})
  const button=name=>page.getByRole('button',{name,exact:true}),noUndefined=async()=>assert.doesNotMatch(await page.locator('body').innerText(),/undefined|null/)
  await page.goto(origin+'/?scenario=reading');await button('检查全部更新').click()
  const row=page.locator('[data-update-product="qcu-reading"]')
  await button('在官方页面处理qcu-reading').waitFor();assert.equal(await row.getByRole('heading').innerText(),'qcu-reading')
  assert.match(await row.innerText(),/安装来源待核对/);assert.match(await row.innerText(),/版本来源不在已审核记录中/)
  assert.equal(await row.getByRole('button',{name:/核对.*新版/}).count(),0)
  await button('在官方页面处理qcu-reading').click();assert.deepEqual(await page.evaluate(()=>window.fixture.details),['qcu-reading'])
  const refusal=await page.evaluate(()=>window.fixture.prepare('qcu-reading').then(()=>null,e=>e.message));assert.match(refusal,/先检查更新并核对安装来源/)
  const state=await page.evaluate(()=>window.fixture.snapshot().check.items.find(i=>i.id==='qcu-reading'));assert.equal(state.sourceVerified,false);assert.equal(state.state,'source-unknown')
  assert.ok(!calls.some(c=>c.method==='updatesPrepare'||c.method==='installBundle'));await noUndefined();result.reading={...state,details:['qcu-reading'],prepareRefused:refusal}
  await page.screenshot({path:join(output,'source-unknown.png'),fullPage:true})
  await page.evaluate(()=>window.fixture.dispose());await page.goto(origin+'/?scenario=available');await button('检查全部更新').click()
  await button('核对qcu-nameless-probe新版').click();await page.getByRole('heading',{name:'qcu-nameless-probe '+available.to,exact:true}).waitFor();await noUndefined()
  // Existing wording stays exact when a catalog title exists; IDs remain the wire identity.
  await page.evaluate(()=>window.setCatalog([{id:'qcu-nameless-probe',title:'具名工具'}]))
  await button('核对具名工具新版').waitFor();await page.getByRole('heading',{name:'具名工具 '+available.to,exact:true}).waitFor()
  await page.evaluate(()=>window.setCatalog([{id:'qcu-nameless-probe'},{id:'qcu-independent-no-title'}]))
  await button('在官方页面核对qcu-independent-no-title升级').click();assert.deepEqual(await page.evaluate(()=>window.fixture.details),['qcu-independent-no-title'])
  await button('下载并查看升级确认').click();await button('确认升级 qcu-nameless-probe').waitFor()
  await page.getByRole('heading',{name:'确认升级 qcu-nameless-probe',exact:true}).waitFor();await noUndefined()
  const review=await page.evaluate(()=>window.fixture.snapshot().review);assert.equal(review.target.id,available.id);assert.equal(review.receipt.product,available.id)
  assert.equal(available.calls.filter(c=>c.name==='installBundle').length,0);assert.equal(available.installed,available.from)
  await page.screenshot({path:join(output,'review.png'),fullPage:true});await button('取消本次升级').click();assert.equal(available.calls.filter(c=>c.name==='installBundle').length,0)
  await button('下载并查看升级确认').click();await button('确认升级 qcu-nameless-probe').click();await page.getByRole('status').filter({hasText:'新版安装已返回'}).waitFor()
  assert.equal(available.installed,available.to);assert.equal(available.calls.filter(c=>c.name==='installBundle').length,1)
  assert.ok(!calls.some(c=>c.method.includes('Enabled')));await noUndefined()
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[])
  result.available={id:review.target.id,receiptProduct:review.receipt.product,automaticInstalls:0,explicitSyntheticInstalls:1,enableCalls:0,titleWordingPreserved:true};result.status='passed'
 }catch(e){result.status='failed';result.failure=e.stack;result.body=await page?.locator('body').innerText().catch(()=>null);throw e}
 finally{
  await page?.evaluate(()=>window.fixture?.dispose()).catch(()=>{});await context?.close();host.dispose()
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));await assert.rejects(fetch(origin+'/'))}
  await rm(owned,{recursive:true,force:true});result.browserClosed=true;result.ownedServerClosed=true;result.calls=calls;await writeFile(join(output,'results.json'),JSON.stringify(result,null,2)+'\n')
 }
})
