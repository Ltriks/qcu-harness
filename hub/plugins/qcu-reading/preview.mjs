// Loopback only. Same controller, UI, dispatch and disk store; synthetic model only.
import {createServer} from 'node:http'
import {readFile, mkdir, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
const packageRoot = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(resolve(process.env.QCU_READING_PACKAGE_ROOT) + '/') : new URL('./', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', packageRoot))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', packageRoot))
const {VERSION, PROTOCOL, OUTPUT_BUDGET, LIMITS, safeCode, check, exact} = await import(new URL('src/protocol.mjs', packageRoot))

check(process.env.QCU_OFFICIAL_DEPENDENCIES, 'invalid-input')
const require = createRequire(join(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES), 'package.json'))
const here = fileURLToPath(packageRoot), out = resolve(process.env.QCU_READING_PREVIEW_OUT ?? '.work/qcu-reading-r1b-preview')
await mkdir(out, {recursive:true})
const workspace = join(out, 'workspace'); await mkdir(workspace, {recursive:true})
const route = {provider:'synthetic', model:'合成模型（无外部请求）', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:OUTPUT_BUDGET}}
let calls = 0, aborted = 0, lastInput = null
const store = await new ReadingStore(workspace, {model:async () => route, generate:async ({question, sources}, signal) => {
  lastInput = {question, sources}
  calls++
  await new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); aborted++; reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, question.includes('[合成等待]') ? 60000 : 160)
    signal.addEventListener('abort', cancel, {once:true}); if (signal.aborted) cancel()
  })
  if (question.includes('[合成失败]')) throw Object.assign(Error('synthetic-max-tokens'), {code:'model-max-tokens', partial:'合成的未完成文字 [S1]。'})
  return '合成流程示例：依据片段，' + sources[0].text.slice(0, 220) + ' [S1]\n\n这段回答仅验证界面与来源链路，未调用真实模型。请教师核对。' + (question.includes('[未知引用]') ? ' [S99]' : '')
}}).init()

const entry = `import React from ${JSON.stringify(require.resolve('react'))};import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};import {createReadingViews} from ${JSON.stringify(join(here, 'src/view.mjs'))};import {ReadingController} from ${JSON.stringify(join(here, 'src/controller.mjs'))};const controller=new ReadingController({dispatch:async payload=>{const response=await fetch('/preview/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});return response.text()}});const {Page}=createReadingViews(React);createRoot(document.getElementById('panel')).render(React.createElement(Page,{controller,onBack:()=>{}}));controller.boot();document.getElementById('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.getElementById('font').onclick=()=>document.documentElement.style.setProperty('--dsh-content-font-size',getComputedStyle(document.documentElement).getPropertyValue('--dsh-content-font-size').trim()==='18px'?'14px':'18px');`
await require('esbuild').build({stdin:{contents:entry, resolveDir:here}, bundle:true, outfile:join(out, 'app.js'), sourcemap:false})
const html = '<!doctype html><html lang="zh-CN" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>材料伴读 · 合成预览</title><style>html,body{height:100%;margin:0;font-family:system-ui}body{display:flex;flex-direction:column}#preview{padding:6px 10px;background:#fff3c9;color:#493a16;font-size:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}#panel{flex:1;min-height:0}#preview button{font:inherit}</style><div id="preview"><span>合成预览 · 无真实模型调用 · 数据仅在本地预览工作区</span><button id="theme">切换主题</button><button id="font">切换字号</button></div><div id="panel"></div><script src="/app.js"></script></html>'
await writeFile(join(out, 'index.html'), html)
const server = createServer(async (req, res) => {
  try {
    check(req.headers.host === '127.0.0.1:' + server.address().port, 'invalid-input')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'")
    if (req.method === 'GET' && req.url === '/preview/stats') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({calls, aborted, lastInput})); return }
    if (req.method === 'POST' && req.url === '/preview/dispatch') {
      check(req.headers['content-type'] === 'application/json' && (!req.headers.origin || req.headers.origin === 'http://' + req.headers.host), 'invalid-fields')
      let size = 0; const chunks = []
      for await (const chunk of req) { size += chunk.length; check(size <= LIMITS.requestChars, 'invalid-input'); chunks.push(chunk) }
      const request = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks)))
      let value
      if (request.action === 'workspaces') { exact(request, ['action']); value = [{id:'preview-workspace', title:'本地合成工作区'}] }
      else { check(request.workspaceId === 'preview-workspace', 'workspace-not-found'); value = await dispatchStore(store, request, new AbortController().signal) }
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:true, version:VERSION, protocol:PROTOCOL, value})); return
    }
    const file = req.method === 'GET' ? req.url === '/' ? 'index.html' : req.url === '/app.js' ? 'app.js' : null : null
    if (!file) { res.writeHead(404).end(); return }
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript;charset=utf-8' : 'text/html;charset=utf-8')
    res.end(await readFile(join(out, file)))
  } catch (e) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ok:false, error:safeCode(e)})) }
})
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
const info = {pid:process.pid, url:'http://127.0.0.1:' + server.address().port, workspace, output:out, synthetic:true}
await writeFile(join(out, 'runtime.json'), JSON.stringify(info)); console.log(JSON.stringify(info))
async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await store.dispose(); process.exit(0) }
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop())
