// Disposable prototype: real store, scheduler, controller and React; no cloud model.
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import assert from 'node:assert/strict'
import {UnifiedTeamStore} from '../hub/plugins/qcu-expert-teams/src/unified-store.mjs'
import {TeamStore} from '../hub/plugins/qcu-expert-teams/src/store.mjs'
import {discoverInstalledTeams} from '../hub/plugins/qcu-expert-teams/src/installed-teams.mjs'
import {deepResearchTemplate,blankUnifiedTeam,legacyToUnified} from '../hub/plugins/qcu-expert-teams/src/unified-model.mjs'
import {VERSION,PROTOCOL,safeCode} from '../hub/plugins/qcu-expert-teams/src/protocol.mjs'
import {randomUUID} from 'node:crypto'
const deps=process.env.QCU_OFFICIAL_DEPENDENCIES||'/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source'
const require=createRequire(join(deps,'package.json')),out=resolve('.work/unified-team-preview');await mkdir(out,{recursive:true})
const root=await mkdtemp(join(tmpdir(),'qcu-unified-preview-')),route={provider:'synthetic',model:'无模型预览',policy:{effort:'default',supportedEfforts:[],defaultEffort:null,outputBudget:6000}}
let modelCalls=0
const legacy=await new TeamStore(root,{model:async()=>route,skills:async()=>undefined,generate:async()=>{modelCalls++;throw Error('模型在预览中禁用')}}).init()
const unified=await new UnifiedTeamStore(root,{model:async()=>{throw Error('预览未配置模型')},info:()=>({ready:false,tools:['web_search','web_fetch'],model:null}),generate:async()=>{modelCalls++;throw Error('预览禁用真实执行')}}).init()
const installed=await discoverInstalledTeams({list:async()=>[{name:'qcu-deep-research'},{name:'qcu-ket-prep'}],get:async name=>({name,description:'已安装模板 · 原包保留，工作副本可编辑',resourceBase:{kind:'directory',path:resolve('packages',name)}})},root)
const entry=`import React from ${JSON.stringify(require.resolve('react'))};import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {createTeamsViews} from ${JSON.stringify(resolve('hub/plugins/qcu-expert-teams/src/view.mjs'))};
import {TeamsController} from ${JSON.stringify(resolve('hub/plugins/qcu-expert-teams/src/controller.mjs'))};
const remote={dispatch:async payload=>{const reply=await fetch('/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});return reply.text()}};
const c=new TeamsController(remote,{storage:{getItem:()=>null,setItem(){}}});window.previewController=c;const {Page}=createTeamsViews(React);
createRoot(document.getElementById('root')).render(React.createElement(Page,{controller:c}));void c.boot();`
await require('esbuild').build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,outfile:out+'/app.js'})
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>统一团队模型 · 样板预览</title><style>html,body{height:100%;margin:0;font:14px system-ui}body{display:flex;flex-direction:column}#notice{padding:8px 16px;background:#fff4ce;color:#463b16;font-size:12px}#root{flex:1;min-height:0}</style><div id="notice">本地样板预览 · 无模型/工具调用 · 数据只保存在临时工作区</div><div id="root"></div><script src="/app.js"></script></html>'
await writeFile(out+'/index.html',html)
const server=createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url==='/dispatch'){
   if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)throw Error('Origin refused')
   let payload='';for await(const chunk of req){payload+=chunk;if(payload.length>500000)throw Error('Payload too large')}
   const r=JSON.parse(payload);let value
   if(r.action==='workspaces')value=[{id:'example',title:'样板临时工作区'}]
   else{
    if(r.workspaceId!=='example')throw Error('Unknown workspace')
    if(r.action==='catalog')value={...legacy.snapshot(),...unified.snapshot(),installedTeams:installed,skills:[]}
    else if(r.action==='history'){const s=legacy.snapshot();value={runs:s.runs,capacity:s.capacity}}
    else if(r.action==='unifiedCreate')value=await unified.create(r.source==='template'?deepResearchTemplate(installed.find(t=>t.id===r.id),'team-'+randomUUID()):r.source==='legacy'?legacyToUnified(legacy.resolvedTeam(legacy.state.teams.find(t=>t.team.id===r.id)).team,'team-'+randomUUID()):blankUnifiedTeam('team-'+randomUUID()))
    else if(r.action==='unifiedSave')value=await unified.save(r.definition,r.revision)
    else if(r.action==='unifiedPrepare')value=await unified.prepare(r,new AbortController().signal)
    else if(r.action==='unifiedStart')value=await unified.start(r)
    else if(r.action==='unifiedRun')value=unified.run(r.runId)
    else if(r.action==='unifiedCancel')value=await unified.cancel(r.runId)
    else if(r.action==='unifiedReport')value=unified.report(r.runId)
    else throw Error('Unsupported preview action')
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,version:VERSION,protocol:PROTOCOL,value}));return
  }
  if(req.url==='/stats'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({modelCalls,teams:unified.state.teams.length,runs:unified.state.runs.map(r=>({id:r.id,status:r.status,mode:r.mode,budget:r.budget}))}));return}
  const file=req.url==='/'?'index.html':req.url==='/app.js'?'app.js':null;if(!file){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(join(out,file)))
 }catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:safeCode(e),...(e.public?{detail:e.message}:{})}))}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
const runtime={url,root,pid:process.pid,scope:'disposable-demo-only'};await writeFile(out+'/runtime.json',JSON.stringify(runtime,null,2));console.log(JSON.stringify(runtime))
async function close(){await unified.dispose();await legacy.dispose();server.closeAllConnections();await new Promise(r=>server.close(r))}
if(process.argv.includes('--serve')){process.on('SIGTERM',()=>void close().then(()=>process.exit(0)));process.on('SIGINT',()=>void close().then(()=>process.exit(0)))}
else{
 let browser
 try{
  browser=await require('playwright').chromium.launch({executablePath:process.env.QCU_CHROMIUM||'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,chromiumSandbox:true})
  const page=await browser.newPage({viewport:{width:1280,height:960},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url)
  assert.equal(await page.getByRole('button',{name:/已安装模板/}).count(),0)
  await page.getByRole('button',{name:'团队模板',exact:true}).click();await page.getByRole('button',{name:/深度研究团队 已安装模板/}).click();await page.getByRole('button',{name:'创建我的团队',exact:true}).click()
  await page.getByLabel('成员名称：研究主理人',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'我的团队',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:/已安装模板/}).count(),0)
  await page.getByLabel('成员名称：研究主理人',{exact:true}).fill('教研主理人');await page.getByLabel('角色身份：教研主理人',{exact:true}).fill('校内教研协调人')
  await page.getByText('1. 明确研究范围',{exact:false}).click();await page.getByLabel('步骤名称：明确研究范围',{exact:true}).fill('确认教学研究范围')
  await page.getByRole('button',{name:'开始任务',exact:true}).click();await page.getByRole('dialog',{name:'保留当前更改？',exact:true}).waitFor();await page.getByRole('button',{name:'继续编辑',exact:true}).click();await page.getByLabel('步骤名称：确认教学研究范围',{exact:true}).waitFor()
  await page.getByRole('button',{name:'保存团队配置',exact:true}).click();await page.getByText('团队配置已保存',{exact:true}).waitFor()
  await page.locator('.qt-detail').evaluate(el=>{el.scrollTop=0});await page.screenshot({path:out+'/configuration-desktop.png',fullPage:true})
  await page.reload();await page.getByRole('button',{name:/深度研究团队 · 我的团队/}).click()
  assert.equal(await page.getByLabel('角色身份：教研主理人',{exact:true}).inputValue(),'校内教研协调人')
  await page.getByRole('button',{name:'查看来源模板',exact:true}).click();await page.getByRole('heading',{name:'由此模板创建的团队',exact:true}).waitFor();await page.getByRole('button',{name:'深度研究团队 · 我的团队',exact:true}).click();await page.getByLabel('角色身份：教研主理人',{exact:true}).waitFor()
  await page.getByRole('tab',{name:/专家库/}).click();await page.getByRole('button',{name:/教研主理人/}).click();await page.getByRole('button',{name:'编辑所属团队配置',exact:true}).click();
  await page.getByRole('button',{name:'开始任务',exact:true}).click();await page.getByLabel('研究任务',{exact:true}).fill('对比两种教材知识点组织方式（流程演示）');await page.getByLabel('参考资料',{exact:true}).fill('合成资料，无真实教材或学生数据。')
  await page.getByLabel('运行方式',{exact:true}).selectOption('live');assert.equal(await page.getByRole('button',{name:'预览本次运行',exact:true}).isDisabled(),true);await page.getByLabel('运行方式',{exact:true}).selectOption('demo')
  await page.getByRole('button',{name:'预览本次运行',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.textContent==='确认本次运行');await page.screenshot({path:out+'/preview-desktop.png',fullPage:true});await page.setViewportSize({width:360,height:900});await page.screenshot({path:out+'/preview-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1280,height:960});await page.getByLabel('我了解这是无模型流程演示',{exact:true}).check();await page.getByRole('button',{name:'开始流程演示',exact:true}).click()
  await page.getByText(/6\/6主步骤完成/).waitFor({timeout:10000});await page.getByRole('button',{name:/独立审核与修订 · 已完成/}).click()
  assert.equal(await page.getByText(/内容修订员 · 已完成/).count(),1)
  await page.screenshot({path:out+'/run-desktop.png',fullPage:true})
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下载本次报告',exact:true}).click();const file=await pending;await file.saveAs(out+'/demo-report.md');assert.match(await readFile(out+'/demo-report.md','utf8'),/未调用模型或工具/)
  await page.getByRole('tab',{name:/运行记录/}).click();await page.getByRole('button',{name:/对比两种教材知识点组织方式/}).click();await page.getByText(/6\/6主步骤完成/).waitFor()
  await page.setViewportSize({width:360,height:900});await page.screenshot({path:out+'/run-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  assert.deepEqual(errors,[]);const stats=await fetch(url+'/stats').then(r=>r.json());assert.equal(stats.modelCalls,0);assert.equal(stats.runs[0].budget.modelSteps,0)
  const result={passed:true,realReact:true,realPersistenceAndScheduler:true,realCloudModel:false,checks:['template-copy','editable-role-identity','editable-workflow','persist-after-reload','bounded-review-revision','studio-progress','global-run-history','demo-report-download','360px-layout'],stats};await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 }finally{await browser?.close();await close()}
}
