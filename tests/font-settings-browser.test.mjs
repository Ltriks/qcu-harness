// Generated clients + official ThemeRuntime/ThemePresenter; synthetic persistence and services.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {require,out} from '../scripts/build-font-settings-preview.mjs';
import {servePreview} from '../scripts/serve-font-settings-preview.mjs';
const evidence={boundary:'Headless Chromium, actual generated QCU clients and official theme classes; synthetic Host/slots/settings persistence/catalog/read-only RPC. No native DSH or production services.',cases:[],errors:[],outside:[],screenshots:[]};
let host,context,profile;
const browserOut=join(out,'browser');
before(async()=>{
 try{
 await mkdir(browserOut,{recursive:true});host=await servePreview();profile=await mkdtemp(join(out,'chromium-disposable-'));
 const args=['--headless','--user-data-dir='+profile,'--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync'];
 context=await require('playwright').chromium.launchPersistentContext(profile,{headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args,executablePath:process.env.QCU_BROWSER_EXECUTABLE??'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 evidence.launch={headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args};
 await context.route('**/*',route=>{const r=route.request();if(r.method()==='GET'&&new URL(r.url()).origin===host.url)return route.continue();evidence.outside.push({url:r.url(),method:r.method()});return route.abort();});
 }catch(e){evidence.setupError={message:e.message,code:e.code,stack:e.stack};evidence.status='blocked-before-browser-cases';throw e;}
});
after(async()=>{
  try{await context?.close();evidence.contextClosed=Boolean(context);}finally{await host?.close();evidence.serverClosed=Boolean(host);if(profile)await rm(profile,{recursive:true,force:true});await writeFile(join(browserOut,'RESULT.json'),JSON.stringify(evidence,null,2)+'\n');}
});
let serial=0;
async function open(params={},viewport={width:1360,height:900}){
 const page=await context.newPage();await page.setViewportSize(viewport);page.setDefaultTimeout(5000);
 page.on('pageerror',e=>evidence.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')evidence.errors.push(m.text());});
 await page.goto(host.url+'/?'+new URLSearchParams({scope:'case-'+(++serial),...params}));
 await page.waitForFunction(()=>window.fontPreview);await page.evaluate(()=>window.fontPreview.ready);
 await page.locator('#panel>*').waitFor();return page;
}
const state=page=>page.evaluate(()=>({font:window.fontPreview.theme.getTheme().fontSize,preference:window.fontPreview.theme.getTheme().preference,actions:window.fontPreview.actions,marketCalls:window.fontPreview.marketCalls,token:getComputedStyle(document.body).getPropertyValue('--dsh-content-font-size'),legacy:localStorage.getItem('qcu.teacher.readability.v1'),initialized:localStorage.getItem('qcu.teacher.initialized.v1')}));
const setSize=(page,size)=>page.getByLabel('合成宿主字号',{exact:true}).selectOption(String(size));
const setTheme=(page,theme)=>page.getByLabel('合成宿主主题',{exact:true}).selectOption(theme);
async function navigate(page,id){await page.evaluate(id=>window.fontPreview.panel.set({activePanelId:id}),id);await page.locator('#panel>*').waitFor();}
async function screenshot(page,name){if(evidence.screenshots.some(s=>s.name===name))return;const path=join(browserOut,name+'.png');await page.screenshot({path});evidence.screenshots.push({name,path,unmodifiedViewport:true});}
async function close(page){try{await page.evaluate(()=>window.fontPreview.cleanup());}finally{await page.close();}}
function run(name,fn){test(name,{timeout:120000},async()=>{const row={name};try{await fn(row);row.passed=true;}catch(e){row.passed=false;row.error=e.stack;throw e;}finally{evidence.cases.push(row);}});}
async function metrics(page,selectors){return page.evaluate(selectors=>{
 const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const rows={};for(const[role,selector]of Object.entries(selectors)){const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);const css=getComputedStyle(el),r=rect(el);rows[role]={selector,input:el.tagName==='INPUT',font:parseFloat(css.fontSize),family:css.fontFamily,line:css.lineHeight,color:css.color,background:css.backgroundColor,...r,container:rect(el.parentElement),panel:rect(document.querySelector('#panel')),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};}
 return{rows,overflow:document.documentElement.scrollWidth>innerWidth,documentWidth:document.documentElement.scrollWidth,width:innerWidth};
 },selectors);}
async function courseHeaderGeometry(page,width){
 const layout=await page.locator('.qcu-course header').evaluate(header=>{
  const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,lineHeight:parseFloat(getComputedStyle(el).lineHeight),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};};
  return{header:box(header),title:box(header.querySelector('h1')),subtitle:box(header.querySelector('.muted')),titleBlock:box(header.querySelector('.grow')),buttons:[...header.querySelectorAll('button')].map(el=>({...box(el),text:el.textContent}))};
 });
 assert.equal(layout.buttons.length,3,'language, reconnect and back actions remain present');
 for(const button of layout.buttons){assert.ok(button.scrollWidth<=button.clientWidth+1&&button.scrollHeight<=button.clientHeight+1,`${button.text} header text clipped`);assert.ok(button.left>=layout.header.left-1&&button.right<=layout.header.right+1,`${button.text} header box spills`);}
 if(width===390){
  // A wrapping one-character column can have no overflow. Check useful text width/line count too.
  for(const name of ['title','subtitle']){const text=layout[name];assert.ok(text.width>=layout.header.width*.75-1,`${name} squeezed to ${text.width}px in ${layout.header.width}px header`);assert.ok(text.height<=text.lineHeight*3+1,`${name} exceeds three lines`);}
  for(const button of layout.buttons)assert.ok(button.top>=layout.titleBlock.bottom-1,`${button.text} must wrap below the narrow title row`);
 }
 return layout;
}
function expectFonts(m,size,roles){assert.equal(m.overflow,false);for(const[key,defaultSize]of Object.entries(roles)){
 const value=m.rows[key];assert.ok(Math.abs(value.font-size*defaultSize/14)<.03,`${key} at ${size}: ${value.font}`);assert.match(value.family,/system|apple|Segoe|PingFang/i);
 if(value.input){
  // Single-line inputs scroll long values internally; the control itself must fit.
  assert.ok(value.width>0&&value.height>0,`${key} usable box`);
  for(const[name,bounds]of Object.entries({container:value.container,panel:value.panel}))assert.ok(value.left>=bounds.left-1&&value.right<=bounds.right+1,`${key} box exceeds ${name}`);
  assert.ok(value.top>=value.container.top-1&&value.bottom<=value.container.bottom+1,`${key} box exceeds container height`);
 }else{assert.ok(value.scrollWidth<=value.clientWidth+1,`${key} horizontal spill`);if(key!=='body')assert.ok(value.scrollHeight<=value.clientHeight+1,`${key} vertical clipping`);}
}}
function noEffects(s){assert.deepEqual(s.actions.filter(a=>a.name.startsWith('FORBIDDEN:')),[]);const localeWrites=s.actions.filter(a=>a.name==='locale-write');assert.ok(localeWrites.length<=1,'locale initialization runs at most once');for(const call of localeWrites)assert.deepEqual(call.args,['zh']);assert.deepEqual(s.marketCalls.filter(c=>!['status','refresh','updatesRecovery','listBundles','listPlugins'].includes(c.name)),[]);}

for(const size of [14,16,20])for(const stale of [false,true])run(`startup preserves ${size}px; stale large/missing initialized=${stale}`,async row=>{
 const page=await open({size:String(size),...(stale?{stale:'large',init:'no'}:{})});
 try{
  row.state=await state(page);assert.equal(row.state.font,size);assert.equal(row.state.token,size+'px');assert.deepEqual(row.state.actions.filter(a=>a.name==='setting-write'),[]);
  assert.equal(row.state.legacy,stale?'large':null);assert.equal(row.state.initialized,'yes');assert.deepEqual(row.state.actions.filter(a=>a.name==='locale-write').map(a=>a.args),stale?[['zh']]:[]);
  row.fonts=await metrics(page,{body:'.qcu-home',menu:'.qcu-side-nav button',title:'.qcu-home h1',label:'.qcu-field>span',button:'.qcu-task-tabs button'});
  expectFonts(row.fonts,size,{body:14,menu:14,title:24,label:13,button:14});
  const toggle=page.getByRole('button',{name:size>=18?'使用普通字号':'使用大字模式',exact:true});assert.equal(await toggle.getAttribute('aria-pressed'),String(size>=18));
  await page.reload();await page.getByRole('heading',{name:'从一堂好课开始',exact:true}).waitFor();row.reloaded=await state(page);assert.equal(row.reloaded.font,size);assert.equal(row.reloaded.legacy,row.state.legacy);assert.equal(row.reloaded.initialized,'yes');assert.deepEqual(row.reloaded.actions.filter(a=>a.name==='setting-write'||a.name==='locale-write'),[]);noEffects(row.reloaded);
 }finally{await close(page);}
});

run('live official settings and shortcut reflect actual size; reload and owned disposal',async row=>{
 const page=await open({size:'16',stale:'large',init:'no'});row.live=[];
 try{
  assert.deepEqual((await state(page)).actions.filter(a=>a.name==='locale-write').map(a=>a.args),[['zh']]);
  const counts=await page.evaluate(()=>window.fontPreview.eventCounts());
  for(const size of [14,16,20,22,14]){
   await setSize(page,size);const s=await state(page);assert.equal(s.font,size);
   const toggle=page.getByRole('button',{name:size>=18?'使用普通字号':'使用大字模式',exact:true});assert.equal(await toggle.getAttribute('aria-pressed'),String(size>=18));
   const m=await metrics(page,{body:'.qcu-home',menu:'.qcu-side-nav button',title:'.qcu-home h1',label:'.qcu-field>span',button:'.qcu-task-tabs button'});expectFonts(m,size,{body:14,menu:14,title:24,label:13,button:14});row.live.push({size,...m});
  }
  await page.getByRole('button',{name:'使用大字模式',exact:true}).click();assert.equal((await state(page)).font,18);
  await setSize(page,20);await page.getByRole('button',{name:'使用普通字号',exact:true}).click();assert.equal((await state(page)).font,14);
  await setSize(page,20);await setTheme(page,'dark');await page.reload();await page.getByRole('heading',{name:'从一堂好课开始',exact:true}).waitFor();assert.equal((await state(page)).font,20);assert.equal((await state(page)).preference,'dark');assert.deepEqual((await state(page)).actions.filter(a=>a.name==='setting-write'),[]);
  row.dispose=await page.evaluate(()=>window.fontPreview.cleanupBranding());assert.equal(row.dispose.fontSize,20);assert.equal(row.dispose.tokens['--synthetic-foreign'],'kept');assert.ok(!Object.keys(row.dispose.tokens).some(k=>k.startsWith('--qcu-')));assert.equal(row.dispose.foreign,'kept');assert.deepEqual(row.dispose.styles,[]);assert.ok(!row.dispose.slots.some(k=>k.includes('qcu-teacher')||k==='sidebar:'));
  // Runtime presenter listener survives; preference and React listeners are gone.
  assert.equal(row.dispose.events['theme/change'],1);assert.ok(counts['theme/change']>1);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--qcu-font')),'');
  noEffects(await state(page));
 }finally{await close(page);}
});

run('home, tools, help and about live scaling in dark/light narrow and desktop short windows',async row=>{
 row.layouts=[];
 for(const viewport of [{width:1360,height:900},{width:390,height:600},{width:1120,height:480}]){
  const page=await open({sidebar:viewport.width===390?'off':'on'},viewport);
  try{for(const theme of ['light','dark']){await setTheme(page,theme);for(const id of ['qcu-teacher-home','qcu-teacher-tools','qcu-teacher-help','qcu-teacher-about']){
   await navigate(page,id);for(const size of [14,16,20,22,14]){await setSize(page,size);const m=await metrics(page,{body:'.qcu-home',title:'.qcu-home h1'});expectFonts(m,size,{body:14,title:24});row.layouts.push({viewport,theme,id,size,...m});}
  }}
  await navigate(page,'qcu-teacher-home');await setSize(page,14);await setTheme(page,'light');if(viewport.width===1360)await screenshot(page,'desktop-home-14-after');
  noEffects(await state(page));
  }finally{await close(page);}
 }
});

run('actual course Client empty/populated forms scale live with and without branding; narrow screenshots',async row=>{
 row.layouts=[];
 for(const branding of ['on','off'])for(const viewport of [{width:1120,height:600},{width:390,height:600}]){
  const page=await open({panel:'qcu-course-workbench',sidebar:'off',branding},viewport);
  try{
   await page.getByRole('button',{name:'中文',exact:true}).click();
   for(const theme of ['light','dark']){await setTheme(page,theme);for(const size of [14,16,20,22,14]){
    await setSize(page,size);const m=await metrics(page,{body:'.qcu-course',title:'.qcu-course h1',button:'.qcu-course header button',secondary:'.qcu-course header .muted'});expectFonts(m,size,{body:14,title:viewport.width===390?20:22,button:14,secondary:12});if(branding==='on')assert.equal(m.rows.body.background,theme==='dark'?'rgb(17, 27, 39)':'rgb(247, 250, 253)','branded course canvas '+theme+' '+size+'px');row.layouts.push({branding,viewport,theme,size,empty:true,...m,headerLayout:await courseHeaderGeometry(page,viewport.width)});
   }}
   await page.getByLabel('DSH 工作区',{exact:true}).selectOption('synthetic');await page.getByLabel('本课主题',{exact:true}).fill('自编合成示例：二次函数与跨学科课堂中的长中文名称');
   for(const theme of ['light','dark']){await setTheme(page,theme);for(const size of [14,16,20,22,14]){
    await setSize(page,size);const m=await metrics(page,{body:'.qcu-course',title:'.qcu-course h1',heading:'.qcu-course .layout>main h2',label:'.qcu-course .form-grid label',input:'.qcu-course .form-grid input',button:'.qcu-course header button'});expectFonts(m,size,{body:14,title:viewport.width===390?20:22,heading:18,label:12,input:14,button:14});if(branding==='on')assert.equal(m.rows.body.background,theme==='dark'?'rgb(17, 27, 39)':'rgb(247, 250, 253)','branded course canvas '+theme+' '+size+'px');row.layouts.push({branding,viewport,theme,size,empty:false,...m,headerLayout:await courseHeaderGeometry(page,viewport.width)});
    if(branding==='on'&&viewport.width===390&&[14,20].includes(size)&&theme==='light')await screenshot(page,`narrow-course-${size}`);
   }}
   assert.equal(await page.getByLabel('本课主题',{exact:true}).inputValue(),'自编合成示例：二次函数与跨学科课堂中的长中文名称');noEffects(await state(page));
  }finally{await close(page);}
 }
});

run('actual market Client list/detail and expert UI follow live settings without actions',async row=>{
 row.layouts=[];
 for(const branding of ['on','off'])for(const viewport of [{width:1120,height:600},{width:390,height:600}]){
  const page=await open({panel:'qcu-market',sidebar:'off',branding},viewport);
  try{
   await page.getByRole('button',{name:'查看QCU学习方法教练',exact:true}).waitFor();
   for(const theme of ['light','dark']){await setTheme(page,theme);for(const size of [14,16,20,22,14]){
    await setSize(page,size);const m=await metrics(page,{body:'.qcu-market',heading:'.qcu-card-title h2',secondary:'.qcu-count',button:'.qcu-page-nav button',input:'.qcu-search input'});expectFonts(m,size,{body:14,heading:15,secondary:12,button:13,input:13});row.layouts.push({branding,viewport,theme,size,view:'list',...m});
    if(branding==='on'&&viewport.width===390&&[14,20].includes(size)&&theme==='light')await screenshot(page,`market-list-${size}`);
   }}
   await page.getByRole('button',{name:'查看QCU学习方法教练',exact:true}).click();
   for(const theme of ['light','dark']){await setTheme(page,theme);for(const size of [14,16,20,22,14]){
    await setSize(page,size);const m=await metrics(page,{body:'.qcu-market',heading:'.qcu-detail h1',button:'.qcu-detail .qcu-control',label:'.qcu-detail dt'});expectFonts(m,size,{body:14,heading:viewport.width===390?22:24,button:13,label:14});row.layouts.push({branding,viewport,theme,size,view:'detail',...m});
    if(branding==='on'&&viewport.width===390&&[14,20].includes(size)&&theme==='light')await screenshot(page,`market-detail-${size}`);
   }}
   await navigate(page,'qcu-expert-teams');await page.locator('.qt h1').waitFor();
   for(const size of [14,16,20,22,14]){await setSize(page,size);const m=await metrics(page,{body:'.qt',heading:'.qt h1',button:'.qt-tab'});expectFonts(m,size,{body:14,heading:16,button:14});row.layouts.push({branding,viewport,size,view:'expert',...m});}
   noEffects(await state(page));
  }finally{await close(page);}
 }
});

run('baseline reproduction at official 14px and faithful before/after capture',async row=>{
 const page=await open({baseline:'1',size:'14'});
 try{
  row.state=await state(page);row.fonts=await metrics(page,{body:'.qcu-home',menu:'.qcu-side-nav button',title:'.qcu-home h1'});
  assert.equal(row.state.font,14);assert.equal(row.state.legacy,null);assert.equal(row.fonts.rows.body.font,18);assert.equal(row.fonts.rows.menu.font,16);assert.equal(row.fonts.rows.title.font,30);
  await screenshot(page,'desktop-home-14-before');
 }finally{await close(page);}
 // Missing initial marker also demonstrates the baseline's unsolicited 18px write.
 const fresh=await open({baseline:'1',size:'16',init:'no'});
 try{row.baselineStartup=await state(fresh);assert.equal(row.baselineStartup.legacy,null);assert.equal(row.baselineStartup.initialized,'yes');assert.deepEqual(row.baselineStartup.actions.filter(a=>a.name==='locale-write').map(a=>a.args),[['zh']]);assert.equal(row.baselineStartup.font,18);assert.ok(row.baselineStartup.actions.some(a=>a.name==='setting-write'&&a.args[0]==='fontSize'&&a.args[1]===18));}finally{await close(fresh);}
});

run('short 22px sidebar retains reachable workspace/settings/help/about/collapse',async row=>{
 const page=await open({size:'22'},{width:1120,height:480});row.clicks=[];
 try{
  const side=page.getByRole('complementary',{name:'QCU导航',exact:true});
  for(const name of ['添加工作文件夹','设置','使用指南','套件版本说明','收起导航','展开导航']){await side.getByRole('button',{name,exact:true}).click();row.clicks.push(name);}
  await navigate(page,'qcu-teacher-home');await side.evaluate(el=>el.scrollTop=0);await screenshot(page,'short-sidebar-22');
  row.metrics=await metrics(page,{body:'.qcu-side',button:'.qcu-side-nav button'});expectFonts(row.metrics,22,{body:14,button:14});noEffects(await state(page));
 }finally{await close(page);}
});

run('no external requests or unexpected React errors',async()=>{assert.deepEqual(evidence.outside,[]);assert.deepEqual(evidence.errors,[]);});
