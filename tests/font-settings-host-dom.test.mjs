// Supplemental DOM simulation, NOT browser font/layout/screenshot acceptance.
// Exercises the generated preview bundle, official theme runtime/presenter and synthetic services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {require,out} from '../scripts/build-font-settings-preview.mjs';
const {Window}=await import(require.resolve('happy-dom'));
const records=[];
const settle=()=>new Promise(r=>setTimeout(r,30));
async function fixture(params={},baseline=false,persisted=[]){
 const window=new Window({url:'http://127.0.0.1:1/?'+new URLSearchParams({scope:'dom-only',...params}),settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true,enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 window.document.body.innerHTML='<div id="toolbar"></div><div id="host"></div>';
 for(const[key,value]of persisted)window.localStorage.setItem(key,value);
 const errors=[];window.addEventListener('error',e=>errors.push(e.message));
 window.eval(await readFile(join(out,'preview',baseline?'before-app.js':'app.js'),'utf8'));
 await window.fontPreview.ready;await settle();
 return{window,document:window.document,api:window.fontPreview,errors,close:async()=>{await window.fontPreview.cleanup();await window.happyDOM.close();}};
}
test.after(async()=>{await writeFile(join(out,'dom-results.json'),JSON.stringify({boundary:'Happy DOM simulation only: no real browser, computed-font, geometry or screenshot claim.',records},null,2)+'\n');});

for(const size of [14,16,20])for(const stale of [false,true])test(`generated clients: ${size}px preserved, legacy flag=${stale}, live settings, owned disposal`,async()=>{
 const f=await fixture({size:String(size),init:'no',...(stale?{stale:'large'}:{})});
 try{
  assert.equal(f.api.theme.getTheme().fontSize,size);assert.equal(f.api.actions.filter(a=>a.name==='setting-write').length,0);assert.equal(JSON.stringify(f.api.actions.filter(a=>a.name==='locale-write').map(a=>a.args)),'[["zh"]]');
  assert.equal(f.window.localStorage.getItem('qcu.teacher.readability.v1'),stale?'large':null);assert.equal(f.window.localStorage.getItem('qcu.teacher.initialized.v1'),'yes');
  const readsBefore=JSON.stringify(f.api.marketCalls),actionsBefore=JSON.stringify(f.api.actions);
  const live=[];
  for(const n of [14,16,20,22,14]){
   f.api.theme.setFontSize(n);await settle();assert.equal(f.document.body.style.getPropertyValue('--dsh-content-font-size'),n+'px');
   const toggle=[...f.document.querySelectorAll('.qcu-home button')].find(b=>b.textContent=== (n>=18?'使用普通字号':'使用大字模式'));assert.ok(toggle);assert.equal(toggle.getAttribute('aria-pressed'),String(n>=18));live.push({setting:n,bodyToken:f.document.body.style.getPropertyValue('--dsh-content-font-size')});
  }
  assert.equal(JSON.stringify(f.api.marketCalls),readsBefore);assert.equal(JSON.stringify(f.api.actions.filter(a=>a.name!=='setting-write')),actionsBefore);
  let toggle=[...f.document.querySelectorAll('.qcu-home button')].find(b=>b.textContent==='使用大字模式');toggle.click();await settle();assert.equal(f.api.theme.getTheme().fontSize,18);
  f.api.theme.setFontSize(20);await settle();toggle=[...f.document.querySelectorAll('.qcu-home button')].find(b=>b.textContent==='使用普通字号');toggle.click();await settle();assert.equal(f.api.theme.getTheme().fontSize,14);
  f.api.theme.setTheme('dark');f.api.theme.setFontSize(20);await settle();assert.ok(f.document.body.hasAttribute('data-ds-dark-theme'));
  const disposed=await f.api.cleanupBranding();assert.equal(disposed.fontSize,20);assert.equal(disposed.tokens['--synthetic-foreign'],'kept');assert.ok(!Object.keys(disposed.tokens).some(k=>k.startsWith('--qcu-')));assert.equal(disposed.foreign,'kept');assert.equal(disposed.events['theme/change'],1);assert.equal(disposed.styles.length,0);assert.ok(!disposed.slots.some(k=>k.startsWith('main:qcu-teacher')||k==='sidebar:'));
  const persisted=Array.from({length:f.window.localStorage.length},(_,i)=>{const key=f.window.localStorage.key(i);return[key,f.window.localStorage.getItem(key)];});
  const reloaded=await fixture({},false,persisted);
  try{assert.equal(reloaded.api.theme.getTheme().fontSize,20);assert.equal(reloaded.api.theme.getTheme().preference,'dark');assert.equal(reloaded.api.actions.filter(a=>a.name==='setting-write'||a.name==='locale-write').length,0);assert.equal(reloaded.document.body.style.getPropertyValue('--dsh-content-font-size'),'20px');}finally{await reloaded.close();}
  assert.deepEqual(f.errors,[]);records.push({size,stale,live,disposed,firstMount:{fontWrites:0,localeWrites:['zh'],initialized:'yes'},simulatedReload:{fontSize:20,preference:'dark',fontWrites:0,localeWrites:0},passed:true});
 }finally{await f.close();}
});

test('fixture resets legacy flags for a new scope and preserves them on same-scope reload',async()=>{
 const source=await fixture({scope:'legacy-source',stale:'large',init:'no'});
 const capture=f=>Array.from({length:f.window.localStorage.length},(_,i)=>{const key=f.window.localStorage.key(i);return[key,f.window.localStorage.getItem(key)];});
 let persisted;
 try{assert.equal(source.window.localStorage.getItem('qcu.teacher.readability.v1'),'large');persisted=capture(source);}finally{await source.close();}
 const target=await fixture({scope:'legacy-target'},false,persisted);
 try{
  assert.equal(target.window.localStorage.getItem('qcu.teacher.readability.v1'),null);assert.equal(target.window.localStorage.getItem('qcu.teacher.initialized.v1'),'yes');assert.equal(target.api.actions.filter(a=>a.name==='locale-write'||a.name==='setting-write').length,0);
  target.window.localStorage.setItem('qcu.teacher.readability.v1','large');persisted=capture(target);
 }finally{await target.close();}
 const reloaded=await fixture({scope:'legacy-target'},false,persisted);
 try{assert.equal(reloaded.window.localStorage.getItem('qcu.teacher.readability.v1'),'large');assert.equal(reloaded.window.localStorage.getItem('qcu.teacher.initialized.v1'),'yes');assert.equal(reloaded.api.theme.getTheme().fontSize,14);assert.equal(reloaded.api.actions.filter(a=>a.name==='locale-write'||a.name==='setting-write').length,0);records.push({fixtureLegacyIsolation:true,sameScopeReloadPreservesFlags:true,passed:true});}finally{await reloaded.close();}
});

test('generated course/market/expert panels mount through synthetic read-only services',async()=>{
 const f=await fixture();const views=[];
 try{
  for(const id of ['qcu-teacher-tools','qcu-teacher-help','qcu-teacher-about','qcu-course-workbench','qcu-market','qcu-expert-teams']){
   f.api.panel.set({activePanelId:id});await settle();const text=f.document.getElementById('panel').innerText;assert.ok(text.length>30,id);views.push({id,textPrefix:text.slice(0,80)});
   if(id==='qcu-course-workbench'){
    const select=f.document.querySelector('.qcu-course aside select');select.value='synthetic';select.dispatchEvent(new f.window.Event('change',{bubbles:true}));await settle();assert.ok(f.document.querySelector('.qcu-course .form-grid input'));assert.match(f.document.querySelector('.qcu-course .course-list').textContent,/自编合成课程/);
   }
   if(id==='qcu-market'){
    assert.ok(f.document.querySelectorAll('.qcu-product').length>=8);
    [...f.document.querySelectorAll('.qcu-card-link')].find(b=>b.getAttribute('aria-label')==='查看QCU学习方法教练').click();await settle();assert.ok(f.document.querySelector('.qcu-detail h1'));assert.ok(f.document.querySelector('.qcu-detail dt'));
   }
   for(const size of [14,16,20,22,14]){f.api.theme.setFontSize(size);await settle();assert.equal(f.document.body.style.getPropertyValue('--dsh-content-font-size'),size+'px');}
  }
  assert.equal(f.api.actions.filter(a=>a.name.startsWith('FORBIDDEN:')||a.name==='locale-write').length,0);assert.ok(f.api.actions.filter(a=>a.name==='course-read').every(a=>['workspaces','model','snapshot'].includes(a.args[0])));assert.ok(f.api.marketCalls.every(c=>['status','refresh','updatesRecovery'].includes(c.name)));assert.deepEqual(f.errors,[]);records.push({views,actions:f.api.actions,marketCalls:f.api.marketCalls,passed:true});
 }finally{await f.close();}
});

test('base generated branding reproduces unsolicited startup 16→18 in DOM simulation',async()=>{
 const f=await fixture({size:'16',init:'no'},true);
 try{assert.equal(f.window.localStorage.getItem('qcu.teacher.readability.v1'),null);assert.equal(f.window.localStorage.getItem('qcu.teacher.initialized.v1'),'yes');assert.equal(JSON.stringify(f.api.actions.filter(a=>a.name==='locale-write').map(a=>a.args)),'[["zh"]]');assert.equal(f.api.theme.getTheme().fontSize,18);assert.ok(f.api.actions.some(a=>a.name==='setting-write'&&a.args[0]==='fontSize'&&a.args[1]===18));records.push({baselineStartup:{initial:16,actual:f.api.theme.getTheme().fontSize,actions:f.api.actions},passed:true});}finally{await f.close();}
});
