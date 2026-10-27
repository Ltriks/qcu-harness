// Actual generated branding client + real React; only the Host/slots are synthetic.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';

const sdk=process.env.QCU_OFFICIAL_DEPENDENCIES??'/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source';
const require=createRequire(join(resolve(sdk),'package.json'));
const packageDir=resolve(process.env.QCU_THEME_PACKAGE??'.work/theme-viewport/package');
const out=resolve(process.env.QCU_THEME_BROWSER_OUT??'.work/theme-viewport/browser');
const executablePath=process.env.QCU_BROWSER_EXECUTABLE??'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const results=[],outside=[],errors=[];
let server,context,profile,url,clientHash,bundleHash,version,setupError;

const fixture=String.raw`
const h=React.createElement,actions=[],slots=new Map,events=new Map,cleanups=[];
window.actions=actions;
window.__ModuleLoader__={load:m=>window.plugin=m.factory(name=>{if(name!=='react')throw Error(name);return React;})};
CLIENT_CODE
localStorage.clear();localStorage.setItem('qcu.teacher.initialized.v1','yes');
function store(value){const listeners=new Set;return{getSnapshot:()=>value,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);},set:v=>{value=v;for(const f of listeners)f();}};}
const panel=store({activePanelId:'qcu-teacher-home'}),collapsed=store(false),themeState={preference:'light',fontSize:14};
let tokens={};
const presenter=new ThemePresenter;
function paint(){presenter.apply({...themeState,active:{colorScheme:themeState.preference,tokens:Object.fromEntries(Object.entries(tokens).map(([k,v])=>[k,v[themeState.preference]]))}});}
function forbidden(name){return()=>{actions.push([name]);throw Error('Forbidden side effect: '+name);};}
const ctx={
 effect:f=>{const cleanup=f();if(cleanup)cleanups.push(cleanup);},
 theme:{getTheme:()=>themeState,setTheme:v=>{themeState.preference=v;paint();for(const f of events.get('theme/change')??[])f();},setFontSize:v=>{themeState.fontSize=v;paint();for(const f of events.get('theme/change')??[])f();},overrideTokens:(_id,t)=>{tokens=t;paint();return()=>{tokens={};paint();};}},
 locale:{setLocale:()=>{}},on:(name,f)=>{const listeners=events.get(name)??new Set;listeners.add(f);events.set(name,listeners);return()=>listeners.delete(f);},
 layout:{panelInfo:panel,selectPanel:id=>{actions.push(['panel',id]);panel.set({activePanelId:id});},toggleSidebar:()=>{actions.push(['toggle']);collapsed.set(!collapsed.getSnapshot());}},
 workspaces:{list:store({phase:'ready',items:[{workspaceId:'synthetic',path:'自编示例工作文件夹',sessionIds:['existing']}],archivedSessionIds:[]})},
 sessions:{list:store({phase:'ready',ids:['existing'],byId:{existing:{sessionId:'existing',title:'自编示例任务',blank:false,updatedAt:1}}}),create:forbidden('create-session'),retain:forbidden('retain-session')},
 uiWorkspace:{selection:store({sessionId:'existing'}),startSession:forbidden('start-session'),openSession:forbidden('open-session')},
 conversation:{input:{for:forbidden('conversation-input')},send:forbidden('send')},
 models:{call:forbidden('model')},plugins:{install:forbidden('install')},
 slots:{subscribe:()=>()=>{},getVersion:()=>0,entries:name=>[...slots.keys()].filter(k=>k.startsWith(name+':')).map(k=>({options:{key:k.slice(name.length+1)}})),
  entriesOfSlot:()=>[{options:{id:'plugins',label:'插件管理'}},{options:{id:'qcu-course-workbench',label:'课程工作台'}},{options:{id:'qcu-market',label:'QCU市场'}},{options:{id:'qcu-expert-teams',label:'专家团'}}],
  inject:(_n,f)=>{const v=f();if(v?.[Symbol.iterator])for(const _ of v){};},register:(o,C)=>{slots.set(o.name+':'+(o.key||''),C);return()=>slots.delete(o.name+':'+(o.key||''));}}
};
plugin.apply(ctx);
const Sidebar=slots.get('sidebar:'),Header=slots.get('shell.leading:'),Settings=slots.get('settings.launcher:');
const renderSlot=name=>name==='sidebar.workspaces'
 ?h('div',{'data-slot':name},h('button',{type:'button',onClick:()=>actions.push(['workspace-picker'])},'添加工作文件夹'),h('p',null,'自编示例工作文件夹'))
 :name==='sidebar.settings'?h('div',{'data-slot':name},h(Settings,{openSettings:()=>actions.push(['settings-open'])})):null;
function Host(){
 const isCollapsed=React.useSyncExternalStore(collapsed.subscribe,collapsed.getSnapshot),info=React.useSyncExternalStore(panel.subscribe,panel.getSnapshot);
 const Panel=slots.get('main:'+info.activePanelId);
 return h(React.Fragment,null,h('div',{id:'side','data-sidebar-collapsed':isCollapsed?'':undefined,style:{width:isCollapsed?64:240}},h(Sidebar,{collapsed:isCollapsed,renderSlot})),
  h('main',null,h('header',null,h(Header)),h('section',{id:'panel'},Panel?h(Panel):h('h1',null,info.activePanelId))));
}
const root=createRoot(document.getElementById('host'));root.render(h(Host));
window.fixture={themeState,setFontSize:ctx.theme.setFontSize,cleanup:()=>{root.unmount();for(const f of cleanups.reverse())f();}};
`;

before(async()=>{
 try{
 await mkdir(out,{recursive:true});
 const client=await readFile(join(packageDir,'client.js'),'utf8');clientHash=sha256(client);
 version=JSON.parse(await readFile(join(packageDir,'package.json'),'utf8')).version;
 const entry='import {ThemePresenter} from '+JSON.stringify(join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-layout/src/client/theme-presenter.ts'))+';import React from '+JSON.stringify(require.resolve('react'))+';import {createRoot} from '+JSON.stringify(require.resolve('react-dom/client'))+';'+fixture.replace('CLIENT_CODE',()=>client);
 const bundle=await require('esbuild').build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,write:false});
 const javascript=bundle.outputFiles[0].contents;bundleHash=sha256(javascript);
 await writeFile(join(out,'app.js'),javascript);
 // Host geometry only: all sidebar/layout/scroll rules come from client.js.
 const officialCss=(await Promise.all(['base','design-platform'].map(n=>readFile(join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-theme/src/styles',n+'.css'),'utf8')))).join('\n');
 const html='<!doctype html><html lang="zh-CN" data-platform="darwin"><meta charset="utf-8"><style>'+officialCss+'body{font:14px/1.5 var(--dsw-font-family);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}button,input,select,textarea{font:inherit}html,body,#host{height:100%;margin:0}#host{display:flex}#side{height:100%;flex:none}main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--qcu-canvas)}main>header{flex:none;padding:8px}#panel{flex:1;min-height:0;display:flex}</style><div id="host"></div><script src="/app.js"></script></html>';
 server=createServer((req,res)=>{
  if(req.url==='/')res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html);
  else if(req.url==='/app.js')res.writeHead(200,{'content-type':'text/javascript'}).end(javascript);
  else res.writeHead(404).end();
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});url='http://127.0.0.1:'+server.address().port;
 profile=await mkdtemp(join(out,'chromium-disposable-'));
 context=await require('playwright').chromium.launchPersistentContext(profile,{executablePath,headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,timeout:15000,
  args:['--headless','--user-data-dir='+profile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync']});
 await context.route('**/*',route=>{
  const request=route.request(),allowed=request.method()==='GET'&&[url+'/',url+'/app.js'].includes(request.url());
  if(!allowed)outside.push({url:request.url(),method:request.method()});
  return allowed?route.continue():route.abort();
 });
 }catch(e){setupError={message:e.message,code:e.code};throw e;}
},{timeout:30000});

after(async()=>{
 try{await context?.close();}finally{
  try{if(server?.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}}finally{
   if(profile)await rm(profile,{recursive:true,force:true});
   await writeFile(join(out,'RESULT.json'),JSON.stringify({syntheticHost:true,realReact:true,nativeDsh:false,version,packageDir,clientSha256:clientHash,bundleSha256:bundleHash,
    chromiumSandbox:true,status:setupError?'blocked-before-browser-cases':'executed',setupError,externalRequests:outside,errors,cases:results.length,passed:results.filter(r=>r.passed).length,results},null,2)+'\n');
  }
 }
});

async function geometry(page){return page.evaluate(()=>{
 const row=selector=>{const n=document.querySelector(selector),r=n.getBoundingClientRect();return{height:r.height,width:r.width,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,scrollTop:n.scrollTop};};
 return{sidebar:row('.qcu-side'),work:row('.qcu-side-work'),footer:row('.qcu-side-foot'),document:{width:innerWidth,scrollWidth:document.documentElement.scrollWidth},fontSize:getComputedStyle(document.querySelector('.qcu-side')).fontSize,background:getComputedStyle(document.querySelector('.qcu-side')).backgroundColor};
});}

for(const theme of ['light','dark'])for(const font of [14,18,22])for(const mode of ['wide','collapsed'])for(const height of [900,700,600,480]){
 test(`sidebar ${theme} ${font} ${mode} ${height}`,{timeout:30000},async()=>{
  const page=await context.newPage(),id=`${theme}-${font}-${mode}-${height}`,result={id,height,theme,font,mode,clicks:[]};
  page.setDefaultTimeout(3000);page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const side=page.getByRole('complementary',{name:'QCU导航',exact:true});
  const button=name=>side.getByRole('button',{name,exact:true});
  const back=async()=>{await page.locator('main>header').getByRole('button',{name:'教学首页',exact:true}).click();await page.getByRole('heading',{name:'从一堂好课开始',exact:true}).waitFor();};
  const click=async(name,trial=false)=>{
   try{await button(name).click({timeout:1500,...(trial?{trial:true}:{})});result.clicks.push({name,trial,clicked:true});}
   catch(e){result.clicks.push({name,trial,clicked:false,error:e.message.split('\n')[0]});}
  };
  try{
   await page.setViewportSize({width:1024,height});await page.goto(url);await button('专家团').waitFor();
   await page.evaluate(n=>window.fixture.setFontSize(n),font);
   if(theme==='dark'){await page.locator('.qcu-home summary').click();await page.getByRole('button',{name:'深色',exact:true}).click();}
   if(mode==='collapsed')await button('收起导航').click();
   result.geometry=await geometry(page);
   assert.equal(result.geometry.fontSize,font+'px');
   assert.equal(result.geometry.background,theme==='dark'?'rgb(20, 32, 45)':'rgb(240, 245, 250)');
   assert.equal(await side.locator('.qcu-side-nav>button').count(),6);
   assert.equal(await side.locator('.qcu-maintenance').getByRole('button',{name:'插件市场',exact:true}).count(),0);
   // Free conversation is an explicit session action: check hit testing without activating it.
   await click('自由对话',true);
   for(const [name,panel]of [['教学首页','qcu-teacher-home'],['课程工作台','qcu-course-workbench'],['教学工具','qcu-teacher-tools'],['插件市场','qcu-market'],['专家团','qcu-expert-teams']]){
    await click(name);assert.equal(await page.evaluate(()=>window.actions.filter(a=>a[0]==='panel').at(-1)?.[1]),panel);await back();
   }
   await click('设置');
   if(mode==='collapsed'){
    assert.equal(await button('添加工作文件夹').count(),0);await click('展开导航');
   }
   result.expandedGeometry=await geometry(page);
   await click('添加工作文件夹');
   if(height===480&&mode==='wide')await page.screenshot({path:join(out,id+'-workspace.png')});
   for(const [name,panel]of [['使用指南','qcu-teacher-help'],['套件版本说明','qcu-teacher-about']]){
    await click(name);assert.equal(await page.evaluate(()=>window.actions.filter(a=>a[0]==='panel').at(-1)?.[1]),panel);
    if(panel==='qcu-teacher-about')await page.getByText('QCU清蓝 '+version,{exact:true}).waitFor();
    await back();
   }
   await side.locator('.qcu-maintenance>summary').click();await click('插件管理');
   assert.equal(await page.evaluate(()=>window.actions.filter(a=>a[0]==='panel').at(-1)?.[1]),'plugins');await back();
   await side.locator('.qcu-maintenance>summary').click();
   if(height===480&&mode==='wide')await page.screenshot({path:join(out,id+'-footer.png')});
   await click('收起导航');assert.equal(await side.evaluate(el=>el.classList.contains('collapsed')),true);
   await click('展开导航');assert.equal(await side.evaluate(el=>el.classList.contains('collapsed')),false);
   if(mode==='collapsed')await click('收起导航');
   result.actions=await page.evaluate(()=>window.actions);
   result.finalGeometry=await geometry(page);
   assert.ok(result.expandedGeometry.work.height>=44,'workspace viewport must fit an action');
   assert.ok(result.expandedGeometry.footer.height>=44,'footer must keep usable height');
   for(const state of [result.geometry,result.expandedGeometry,result.finalGeometry]){
    assert.ok(state.sidebar.scrollWidth<=state.sidebar.clientWidth,'no sidebar horizontal spill');
    assert.ok(state.work.scrollWidth<=state.work.clientWidth,'no workspace horizontal spill');
    assert.ok(state.footer.scrollWidth<=state.footer.clientWidth,'no footer horizontal spill');
    assert.ok(state.document.scrollWidth<=state.document.width,'no document horizontal spill');
   }
   assert.deepEqual(result.clicks.filter(c=>!c.clicked),[],'all ordinary/trial clicks must be reachable');
   assert.equal(result.actions.filter(a=>a[0]==='workspace-picker').length,1);
   assert.equal(result.actions.filter(a=>a[0]==='settings-open').length,1);
   assert.deepEqual(result.actions.filter(a=>!['panel','toggle','workspace-picker','settings-open'].includes(a[0])),[],'navigation must not touch sessions, models or installation');
   assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
   result.passed=true;
  }catch(e){result.passed=false;result.error=e.message;throw e;}
  finally{
   try{
    result.finalGeometry??=await geometry(page);
    result.actions??=await page.evaluate(()=>window.actions);
    // Reset only scroll position for the overview; never inject layout CSS or force clicks.
    await side.evaluate(el=>el.scrollTop=0);await page.screenshot({path:join(out,id+'.png')});
    await page.evaluate(()=>window.fixture.cleanup());
   }finally{results.push(result);await page.close();}
  }
 });
}
