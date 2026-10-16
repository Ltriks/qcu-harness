// Development-only preview: real UI, Host store and exports; explicitly synthetic LLM.
import {createServer} from 'node:http'
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {CourseStore} from './src/store.mjs'
import {VERSION,PROTOCOL} from './src/protocol.mjs'
import {fixtureDraft} from '../../../tests/support/course-fixture.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const here=fileURLToPath(new URL('./',import.meta.url)),out=resolve(here,'../../../.work/course-preview')
await mkdir(out,{recursive:true})
const previous=process.argv.includes('--reuse-synthetic')?JSON.parse(await readFile(join(out,'runtime.json'),'utf8')):null
const workspace=previous?.workspace??await mkdtemp(join(tmpdir(),'qcu-course-preview-'))
const store=await new CourseStore(workspace,{generate:async input=>{await new Promise(r=>setTimeout(r,150));return fixtureDraft(input)}}).init()
const entry=`import React from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {createCourseViews} from ${JSON.stringify(join(here,'src/view.mjs'))};
import {CourseController} from ${JSON.stringify(join(here,'src/controller.mjs'))};
const remote={dispatch:async payload=>{const r=await fetch('/preview/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});return {ok:true,value:await r.text()}}};
const controller=new CourseController(remote);window.qcuCoursePreview=controller;
const {Page}=createCourseViews(React);createRoot(document.getElementById('panel')).render(React.createElement(Page,{controller,onBack:()=>{document.getElementById('notice').textContent='Returned to synthetic preview shell / 已返回预览外壳'}}));
document.getElementById('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'};
`
await require('esbuild').build({stdin:{contents:entry,resolveDir:here},bundle:true,outfile:join(out,'app.js')})
const html='<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Course Studio · Synthetic Preview</title><style>html,body{margin:0;height:100%;font-family:system-ui}body{display:flex;flex-direction:column}#notice-bar{padding:8px 16px;background:#f8e6a6;display:flex;justify-content:space-between;font-size:12px}#panel{min-height:0;flex:1}</style><div id="notice-bar"><span id="notice">SYNTHETIC PREVIEW · 合成示例；无模型调用，文件只写临时工作区</span><button id="theme">Theme / 主题</button></div><div id="panel"></div><script src="/app.js"></script></html>'
await writeFile(join(out,'index.html'),html)
const server=createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url==='/preview/dispatch'){
   let body='';for await(const chunk of req){body+=chunk; if(body.length>12000000)throw Error('body-too-large')}
   const v=JSON.parse(body);let result
   if(v.action==='workspaces')result={ok:true,protocol:PROTOCOL,version:VERSION,workspaces:[{id:'synthetic-workspace',title:'Synthetic workspace · 合成工作区',path:workspace}],model:{provider:'synthetic',model:'SYNTHETIC / 合成模型'}}
   else{if(v.workspaceId!=='synthetic-workspace')throw Error('workspace');result={ok:true,value:await store.dispatch(v.request)}}
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(result));return
  }
  const path=req.url==='/'?'index.html':req.url==='/app.js'?'app.js':null
  if(!path){res.writeHead(404).end();return}
  res.writeHead(200,{'content-type':path.endsWith('.js')?'text/javascript':'text/html','cache-control':'no-store'}).end(await readFile(join(out,path)))
 }catch(e){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({ok:false,error:e.code??'operation-failed'}))}
})
const port=Number(process.env.QCU_COURSE_PREVIEW_PORT??0)
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))
const info={url:'http://127.0.0.1:'+server.address().port,workspace,output:out}
await writeFile(join(out,'runtime.json'),JSON.stringify(info));console.log(JSON.stringify(info))
async function stop(){server.closeAllConnections();await new Promise(r=>server.close(r));await store.dispose();process.exit(0)}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop())
