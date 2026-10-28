// Same built UI components; explicitly synthetic host. Never calls a model or reads user data.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=join(root,'.work/qcu-teacher-theme');
const reactRoot=join(root,'.work/brand-test-runtime/node_modules');
const html=`<!doctype html><html lang="zh-CN" data-platform="web"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QCU清蓝教师主题预览</title>
<style>html,body,#root{height:100%;margin:0}#preview-notice{padding:7px 16px;background:#dfeefa;color:#17324d;font:13px/1.5 system-ui}#frame{display:grid;grid-template-columns:240px minmax(0,1fr);height:calc(100% - 34px)}#main{min-width:0;min-height:0}#sidebar{min-width:0;min-height:0}@media(max-width:700px){#frame{grid-template-columns:66px minmax(0,1fr)}}</style>
<div id="root"><div id="preview-notice">主题预览 · 示例工作文件夹，无真实模型连接，不生成或保存教学成果</div><div id="frame"><div id="sidebar"></div><main id="main"></main></div></div>
<script src="/react.js"></script><script src="/react-dom.js"></script><script>window.__ModuleLoader__={load:m=>window.qcuPreviewPlugin=m.factory(()=>React)};</script><script src="/client.js"></script><script src="/preview.js"></script></html>`;
const preview=`const h=React.createElement;
function store(initial){let value=initial;const listeners=new Set();return{getSnapshot:()=>value,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)},set:v=>{value=v;for(const f of listeners)f()}}}
const slots=new Map(),listeners=new Map(),events=new Map(),root=ReactDOM.createRoot(document.getElementById('main')),side=ReactDOM.createRoot(document.getElementById('sidebar'));
let tokens={},preference=localStorage.getItem('qcu.preview.mode')||'light',fontSize=18;
function publish(){document.body.toggleAttribute('data-ds-dark-theme',preference==='dark');for(const[k,v]of Object.entries(tokens))document.body.style.setProperty(k,v[preference==='dark'?'dark':'light']);for(const f of events.get('theme/change')||[])f()}
function render(){const C=slots.get('main:'+panel.getSnapshot().activePanelId);root.render(C?h(C):h('section',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},h('h1',null,'预览操作已记录'),h('p',null,'客户端接入时将打开对应宿主界面；预览不创建任务，也不调用模型。'),h('button',{className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-home')},'返回教学首页'))));const S=slots.get('sidebar:');if(S)side.render(h(S,{collapsed:innerWidth<700,toggleSidebar:()=>{},renderSlot:(name)=>name==='sidebar.settings'?h('div',{className:'qcu-muted',style:{padding:'12px'}},'更多 · 示例设置入口'):name==='sidebar.workspaces'?h('div',{className:'qcu-muted',style:{padding:'12px'}},'示例工作文件夹'):null}))}
const panel=store({activePanelId:'qcu-teacher-home'});
const theme={overrideTokens(_id,v){tokens=v;publish();return()=>{}},getTheme:()=>({preference,fontSize}),setTheme:v=>{preference=v;localStorage.setItem('qcu.preview.mode',v);publish()},setFontSize:v=>{fontSize=v;publish()}};
const ctx={theme,locale:{setLocale:()=>{}},effect:f=>f(),on:(name,f)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(f);return()=>events.get(name).delete(f)},layout:{panelInfo:panel,selectPanel:id=>{panel.set({activePanelId:id});render()},toggleSidebar:()=>{}},workspaces:{list:store({phase:'ready',items:[{workspaceId:'example',path:'示例工作文件夹',sessionIds:[]}],archivedSessionIds:[]})},sessions:{list:store({phase:'ready',ids:[],byId:{}}),create:async()=>{throw Error('这是视觉预览，请在客户端中验证任务草稿。')}},conversation:{},uiWorkspace:{selection:store({sessionId:'preview-pending'}),startSession:()=>ctx.layout.selectPanel('conversation'),openSession:()=>ctx.layout.selectPanel('conversation')},slots:{entries:name=>[...slots.keys()].filter(k=>k.startsWith(name+':')).map(k=>({options:{key:k.slice(name.length+1)}})),subscribe:()=>()=>{},getVersion:()=>0,entriesOfSlot:()=>[],inject:(_name,f)=>{const result=f();if(result&&result[Symbol.iterator])for(const _ of result){}},register:(o,C)=>{slots.set(o.name+':'+(o.key||''),C);return()=>{}}}};
qcuPreviewPlugin.apply(ctx);render();addEventListener('resize',render);`;
const routes=new Map([
 ['/',{type:'text/html; charset=utf-8',text:html}],
 ['/preview.js',{type:'text/javascript; charset=utf-8',text:preview}],
 ['/client.js',{type:'text/javascript; charset=utf-8',file:join(out,'qcu-branding/client.js')}],
 ['/react.js',{type:'text/javascript',file:join(reactRoot,'react/umd/react.development.js')}],
 ['/react-dom.js',{type:'text/javascript',file:join(reactRoot,'react-dom/umd/react-dom.development.js')}]
]);
const server=createServer(async(req,res)=>{const route=routes.get(req.url);if(!route){res.writeHead(404).end();return;}try{res.writeHead(200,{'content-type':route.type,'cache-control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'"});res.end(route.text??await readFile(route.file));}catch{res.writeHead(500).end('Preview unavailable');}});
await new Promise(r=>server.listen(Number(process.env.QCU_THEME_PREVIEW_PORT??0),'127.0.0.1',r));
await mkdir(out,{recursive:true});const info={url:'http://127.0.0.1:'+server.address().port,synthetic:true,modelCalls:0};await writeFile(join(out,'preview-runtime.json'),JSON.stringify(info));console.log(JSON.stringify(info));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));process.on('SIGINT',()=>server.close(()=>process.exit(0)));
