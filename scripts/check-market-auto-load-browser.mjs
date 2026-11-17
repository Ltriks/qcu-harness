import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
const require=createRequire('/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source/package.json')
const {chromium}=require('playwright'),esbuild=require('esbuild'),out=resolve('.work/market-auto-load')
await mkdir(out,{recursive:true})
const source=(await readFile('hub/plugins/qcu-market/client.js','utf8')).replace('return createLoopPlugin(React);','return {createMarketViews,bundledCatalog};')
const code=`import React from ${JSON.stringify(require.resolve('react'))};import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
let definition;window.__ModuleLoader__={load:v=>{definition=v}};
${source}
const {createMarketViews,bundledCatalog}=definition.factory(()=>React),{MarketPage}=createMarketViews(React),root=createRoot(document.getElementById('root')),listeners=new Set();let ready={catalog:{entries:[]},refreshMessage:'等待连接'},calls=0,fail=false;
const update=patch=>{ready={...ready,...patch};for(const fn of listeners)fn()},availability={snapshot:()=>ready,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
const refresh=async()=>{calls++;window.calls=calls;update({refreshing:true,unavailable:'',refreshMessage:'正在验证目录…'});await new Promise(r=>setTimeout(r,150));update(fail?{refreshing:false,unavailable:'[QCU-MKT-OFFLINE] 测试网络不可达',refreshMessage:'测试网络不可达'}:{refreshing:false,catalog:bundledCatalog,refreshMessage:'目录已验证',unavailable:''})};
window.enter=()=>root.render(React.createElement(MarketPage,{availability,onBack:()=>root.render(null)}));window.connect=()=>update({refresh});window.failNext=()=>{fail=true;update({catalog:{entries:[]}})};window.calls=0;window.enter();`
const built=await esbuild.build({stdin:{contents:code,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',platform:'browser'})
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?built.outputFiles[0].text:'<meta charset="utf-8"><div id="root"></div><script src="/app.js"></script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true})
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);assert.equal(await page.evaluate(()=>window.calls),0)
 await page.evaluate(()=>connect());await page.getByRole('heading',{name:'正在加载工具市场…'}).waitFor();await page.locator('.qcu-grid .qcu-product').first().waitFor();assert.equal(await page.evaluate(()=>window.calls),1)
 await page.getByRole('button',{name:'← 返回对话'}).click();await page.evaluate(()=>enter());await page.waitForFunction(()=>window.calls===2);await page.waitForFunction(()=>document.querySelector('[role="status"]').textContent.includes('目录已验证'))
 await page.getByRole('button',{name:'← 返回对话'}).click();await page.evaluate(()=>{failNext();enter()});await page.getByRole('heading',{name:'工具市场暂未加载成功'}).waitFor();assert.equal(await page.evaluate(()=>window.calls),3);assert.deepEqual(errors,[])
 await page.screenshot({path:out+'/load-error.png',fullPage:true});await writeFile(out+'/browser-result.json',JSON.stringify({passed:true,realReact:true,syntheticServices:true,modelCalls:0,checks:['late-service-auto-load','first-entry-no-refresh-click','reentry-auto-load','loading-distinct-from-empty','error-distinct-from-empty']},null,2));console.log('PASS: market auto-load browser checks')
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
