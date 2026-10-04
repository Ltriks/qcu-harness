import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const demo=JSON.parse(readFileSync(new URL('../rules/demo.json',import.meta.url),'utf8'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function page(overrides={}){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:12345',runScripts:'outside-only'});
 const w=dom.window, calls=[], scrolls=[], rules=[structuredClone(demo)];
 w.matchMedia=query=>({matches:Boolean(overrides.reducedMotion),media:query});
 w.HTMLElement.prototype.scrollIntoView=function(options){scrolls.push({id:this.id,...options});};
 let report=0;
 w.fetch=async(path,options={})=>{
  calls.push({path,options});
  const custom=overrides[path];if(custom)return custom(options);
  let value;
  if(path==='/api/rules'&&options.method==='POST'){
   value={...JSON.parse(options.body),id:'personal-synthetic',source:'personal'};rules.push(value);
  }else if(path==='/api/rules')value=rules;
  else if(path==='/api/upload')value={document_id:'a'.repeat(32),overview:{paragraphs:1,sections:1,styles:[]}};
  else if(path==='/api/run')value={counts:{passed:11,failed:0,unknown:0},report_url:`http://127.0.0.1:12345/reports/${String(++report).padStart(32,'0')}`};
  else throw new Error('unexpected request');
  return {ok:true,json:async()=>structuredClone(value)};
 };
 w.eval(script);
 const el=id=>w.document.getElementById(id);
 const select=async(file)=>{
  Object.defineProperty(el('document'),'files',{value:file?[file]:[],configurable:true});
  await el('document').onchange();
 };
 const file=()=>new w.File(['synthetic fixture'],'合成 文档.docx');
 return {dom,w,el,calls,scrolls,rules,select,file};
}
test('upload freezes permission changes until the captured upload completes',async()=>{
 let release;
 const p=page({'/api/upload':options=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({document_id:'a'.repeat(32),overview:{paragraphs:1,sections:1,styles:[]},chat_allowed:options.headers['X-QCU-Chat-Allowed']==='true'})});})});
 try{
  await settle();p.el('chat-allowed').checked=true;
  const pending=p.select(p.file());
  assert.equal(p.el('chat-allowed').disabled,true);assert.equal(p.el('document').disabled,true);
  assert.equal(p.calls.at(-1).options.headers['X-QCU-Chat-Allowed'],'true');
  release();await pending;
  assert.equal(p.el('chat-allowed').disabled,false);assert.equal(p.el('run').disabled,false);
 }finally{p.dom.window.close();}
});
test('permission change hides the previous result and requires a new selection',async()=>{
 const p=page();try{
  await settle();await p.select(p.file());await p.el('run').onclick();
  assert.equal(p.el('result').hidden,false);
  p.el('chat-allowed').checked=true;p.el('chat-allowed').onchange();
  assert.equal(p.el('result').hidden,true);assert.equal(p.el('document-info').hidden,true);
  assert.equal(p.el('run').disabled,true);assert.match(p.el('status').textContent,/重新选择/);
 }finally{p.dom.window.close();}
});
test('clearing or rejecting a selection cannot leave the old filename or enable checks',async()=>{
 const p=page();try{
  await settle();await p.select(p.file());await p.select(null);
  assert.equal(p.el('file-state').textContent,'还没有选择文件。');assert.equal(p.el('run').disabled,true);
  await p.select(new p.w.File(['x'],'wrong.txt'));
  assert.match(p.el('file-state').textContent,/未载入/);assert.match(p.el('status').textContent,/DOCX/);
  assert.equal(p.el('run').disabled,true);await p.select(p.file());assert.equal(p.el('run').disabled,false);
 }finally{p.dom.window.close();}
});
test('rule editing cancel performs no write and restores no modified center rule',async()=>{
 const p=page();try{
  await settle();p.el('edit-rule').onclick();p.el('rule-name').value='discarded edit';
  p.el('cancel-edit').onclick();p.el('cancel-edit').onclick();
  assert.equal(p.el('editor').hidden,true);assert.equal(p.rules.length,1);
  assert.equal(p.calls.filter(x=>x.options.method==='POST').length,0);
  assert.deepEqual(p.rules[0],demo);
 }finally{p.dom.window.close();}
});
test('demo edits save a personal copy and check with that selected version',async()=>{
 const p=page();try{
  await settle();await p.select(p.file());p.el('edit-rule').onclick();
  p.el('rule-name').value='个人合成验收规则（非正式规范）';
  await p.el('rule-form').onsubmit({preventDefault(){}});
  assert.equal(p.el('rule-select').value,'personal-synthetic');assert.match(p.el('rule-meta').textContent,/个人规则/);
  assert.deepEqual(p.rules[0],demo);assert.equal(p.rules[1].source,'personal');
  await p.el('run').onclick();
  assert.equal(JSON.parse(p.calls.at(-1).options.body).rule_id,'personal-synthetic');
  assert.equal(p.el('result').hidden,false);assert.equal(p.el('download-report').href,p.el('open-report').href+'/download');
 }finally{p.dom.window.close();}
});
test('pending check prevents duplicate submits but allows a later repeated check',async()=>{
 let release,count=0;
 const p=page({'/api/run':()=>{count++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({counts:{passed:11,failed:0,unknown:0},report_url:'http://127.0.0.1:12345/reports/'+String(count).padStart(32,'0')})});});}});
 try{
  await settle();await p.select(p.file());const pending=p.el('run').onclick();await p.el('run').onclick();
  assert.equal(count,1);assert.equal(p.el('run').disabled,true);release();await pending;
  const first=p.el('open-report').href;const repeated=p.el('run').onclick();
  assert.equal(p.el('run').textContent,'正在检查…');assert.equal(p.el('run').getAttribute('aria-busy'),'true');
  assert.match(p.el('status').textContent,/正在.*检查/);assert.equal(p.el('status').parentElement,p.el('run').closest('section'));
  assert.equal(p.el('result').hidden,true);assert.equal(p.el('counts').children.length,0);
  assert.equal(p.el('open-report').getAttribute('href'),null);assert.equal(p.el('download-report').getAttribute('href'),null);
  await p.el('run').onclick();assert.equal(count,2);release();await repeated;
  assert.equal(count,2);assert.notEqual(p.el('open-report').href,first);assert.equal(p.el('run').disabled,false);
  assert.equal(p.el('run').textContent,'开始检查');assert.equal(p.el('run').getAttribute('aria-busy'),'false');
  assert.equal(p.w.document.activeElement,p.el('result'));assert.match(p.el('status').textContent,/报告已生成/);
 }finally{p.dom.window.close();}
});
test('selecting another rule clears the previous completion feedback',async()=>{
 const p=page();try{
  await settle();await p.select(p.file());await p.el('run').onclick();assert.match(p.el('status').textContent,/检查完成/);
  p.el('rule-select').onchange();assert.equal(p.el('result').hidden,true);assert.equal(p.el('status').textContent,'');
 }finally{p.dom.window.close();}
});
for(const reducedMotion of [false,true])test(`completed results receive focus and respect reduced motion: ${reducedMotion}`,async()=>{
 const p=page({reducedMotion});try{
  await settle();await p.select(p.file());await p.el('run').onclick();
  assert.equal(p.el('result').hidden,false);assert.equal(p.el('counts').children.length,3);
  assert.equal(p.w.document.activeElement,p.el('result'));
  assert.deepEqual(p.scrolls.map(x=>({...x})),[{id:'result',behavior:reducedMotion?'auto':'smooth',block:'start'}]);
  assert.equal(p.el('status').getAttribute('aria-live'),'polite');assert.match(p.el('result-title').textContent,/检查完成/);
 }finally{p.dom.window.close();}
});
for(const failure of ['server','network'])test(`failed repeated check exposes an error, clears stale results and can retry: ${failure}`,async()=>{
 let count=0;const p=page({reducedMotion:true,'/api/run':async()=>{
  count++;if(count===2){if(failure==='network')throw new Error('合成连接中断');return {ok:false,json:async()=>({error:'合成检查失败'})};}
  return {ok:true,json:async()=>({counts:{passed:count,failed:0,unknown:0},report_url:`http://127.0.0.1:12345/reports/${String(count).padStart(32,'0')}`})};
 }});try{
  await settle();await p.select(p.file());await p.el('run').onclick();const first=p.el('open-report').href;
  await p.el('run').onclick();
  assert.match(p.el('status').textContent,/检查未完成.*合成.*请重试/);assert.equal(p.el('status').className,'error');
  assert.equal(p.w.document.activeElement,p.el('status'));assert.equal(p.scrolls.at(-1).id,'status');assert.equal(p.scrolls.at(-1).behavior,'auto');
  assert.equal(p.el('result').hidden,true);assert.equal(p.el('counts').children.length,0);assert.equal(p.el('open-report').getAttribute('href'),null);
  assert.equal(p.el('run').disabled,false);assert.equal(p.el('document').disabled,false);assert.equal(p.el('run').getAttribute('aria-busy'),'false');
  await p.el('run').onclick();assert.equal(count,3);assert.equal(p.el('result').hidden,false);assert.notEqual(p.el('open-report').href,first);
  assert.equal(p.el('status').className,'');assert.equal(p.w.document.activeElement,p.el('result'));
 }finally{p.dom.window.close();}
});
