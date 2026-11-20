'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const [kit,home,out]=process.argv.slice(2),resources=process.platform==='darwin'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');
 const exe=process.platform==='darwin'?path.join(kit,'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'):path.join(kit,'program/DeepSeek Harness.exe');
 const electronHome=path.join(home,'electron-gui-test-'+Date.now());fs.mkdirSync(electronHome,{recursive:true});
 const env={...process.env,DSH_HOME:home,DSH_AGENTS_HOME:path.join(home,'agents'),QCU_TEACHER_TEST_HOME:home,QCU_SUITE_SUPPORT:path.join(kit,'support')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const error=fs.openSync(out+'.stderr','a'),child=cp.spawn(exe,['--user-data-dir='+electronHome,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1'],{env,cwd:path.join(home,'workspace'),stdio:['ignore','ignore',error]});fs.writeFileSync(out+'.process.json',JSON.stringify({pid:child.pid}));let ws;
 try{
  let port;const portFile=path.join(electronHome,'DevToolsActivePort');
  for(let i=0;i<160;i++){if(fs.existsSync(portFile)){port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);break}if(child.exitCode!==null)throw Error('candidate GUI exited');await sleep(250)}
  if(!port)throw Error('no isolated GUI debugging endpoint');
  let target;for(let i=0;i<120;i++){const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=targets.find(target=>target.type==='page'&&target.webSocketDebuggerUrl&&!target.url.includes('welcome.html')&&target.url!=='about:blank');if(target)break;await sleep(250)}
  if(!target)throw Error('no candidate page');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})});
  let id=0;const pending=new Map();ws.addEventListener('message',event=>{const reply=JSON.parse(event.data);if(reply.id&&pending.has(reply.id)){pending.get(reply.id)(reply);pending.delete(reply.id)}});
  async function send(method,params={}){const next=++id;const reply=await new Promise((yes,no)=>{const timer=setTimeout(()=>{pending.delete(next);no(Error('CDP timeout: '+method))},10000);pending.set(next,value=>{clearTimeout(timer);yes(value)});ws.send(JSON.stringify({id:next,method,params}))});if(reply.error)throw Error('CDP rejected '+method);return reply.result}
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  async function focusMain(){if(process.platform==='darwin'){const helper=path.join(path.dirname(out),'activate-mac');if(fs.existsSync(helper))cp.spawnSync(helper,[String(child.pid)],{timeout:5000,stdio:'ignore'})}await send('Page.bringToFront');await sleep(300)}
  async function capture(file){try{const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(shot.data,'base64'));return true}catch{return false}}
  try{const window=await send('Browser.getWindowForTarget',{targetId:target.id});fs.writeFileSync(out+'.window.json',JSON.stringify(window));await send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{windowState:'normal'}});await send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{left:40,top:40,width:1200,height:850}})}catch{}
  await send('Page.bringToFront');
  let snapshot;for(let i=0;i<100;i++){snapshot=await evaluate("({text:document.body?.innerText??'',buttons:Array.from(document.querySelectorAll('button')).map(b=>({text:b.innerText,label:b.getAttribute('aria-label')})),notice:!!document.querySelector('[aria-label=\"基础故障上报告知\"]')})");if(snapshot?.text?.includes('首页')||snapshot?.text?.includes('模型'))break;await sleep(300)}
  // A fresh Windows account has a separate official welcome window. Use its
  // documented "Set up later" path; never fabricate or borrow credentials.
  async function passOfficialWelcome(){
  const welcomeTargets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const welcome=welcomeTargets.find(value=>value.type==='page'&&value.url.includes('welcome.html'));
  if(welcome){
   const welcomeSocket=new WebSocket(welcome.webSocketDebuggerUrl);
   await new Promise((yes,no)=>{welcomeSocket.addEventListener('open',yes,{once:true});welcomeSocket.addEventListener('error',no,{once:true})});
   let welcomeId=0;
   const choose=expression=>new Promise((yes,no)=>{const next=++welcomeId,timer=setTimeout(()=>{welcomeSocket.removeEventListener('message',handler);no(Error('welcome timeout'))},10000);const handler=event=>{const reply=JSON.parse(event.data);if(reply.id===next){clearTimeout(timer);welcomeSocket.removeEventListener('message',handler);yes(reply.result?.result?.value)}};welcomeSocket.addEventListener('message',handler);welcomeSocket.send(JSON.stringify({id:next,method:'Runtime.evaluate',params:{expression,returnByValue:true}}))});
   try{
    for(let i=0;i<100;i++){if(await choose("!!document.querySelector('#api-key')"))break;await sleep(100)}
    const welcomeState=JSON.parse(await choose("JSON.stringify({text:document.body.innerText,brand:document.querySelector('img.brand')?.alt,loaded:document.querySelector('img.brand')?.naturalWidth>0})"));
    assert.equal(welcomeState.brand,'QCU Buddy');assert.equal(welcomeState.loaded,true);
    fs.writeFileSync(out+'.welcome.json',JSON.stringify(welcomeState,null,2));
    await choose("document.querySelector('#api-key').click()");
    let skipped=false;for(let i=0;i<100;i++){if(await choose("(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>/稍后配置|Set up later/.test(b.innerText));if(b){setTimeout(()=>b.click(),100);return true}return false})()")){skipped=true;break}await sleep(100)}
    assert.equal(skipped,true,'official welcome must offer Set up later');
   }finally{welcomeSocket.close()}
   await send('Page.bringToFront');
  }
  }
  await sleep(1500);await passOfficialWelcome();
  const firstUse=process.argv.includes('--first-use'),restart=process.argv.includes('--restart');
  const inspect=()=>evaluate("({text:document.body?.innerText??'',buttons:Array.from(document.querySelectorAll('button')).map(b=>({text:b.innerText,label:b.getAttribute('aria-label')})),notice:!!document.querySelector('[aria-label=\"基础故障上报告知\"]')})");
  async function until(check,label){for(let i=0;i<180;i++){const value=await inspect();if(value&&check(value))return value;await sleep(500)}const snapshot=await inspect();fs.writeFileSync(out+'.failed.json',JSON.stringify({label,snapshot,visibility:await evaluate('document.visibilityState')},null,2));await capture(out+'.failed.png');throw Error('GUI acceptance timed out: '+label)}
  if(firstUse){
   snapshot=await until(value=>value.notice&&value.text.includes('基础故障上报已开启。'),'first-use default');
   await capture(out+'.notice.png');
   await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.innerText==='关闭自动上报').click()");
   snapshot=await until(value=>value.text.includes('自动上报已关闭，故障记录仅保存在本机。'),'direct disable');
  }else{await sleep(2500);await passOfficialWelcome();await sleep(2500);snapshot=await inspect();if(restart)assert.equal(snapshot.notice,false,'explicit off must not display first-use notice again')}
  await passOfficialWelcome();await focusMain();
  for(let i=0;i<80&&await evaluate('document.visibilityState')!=='visible';i++)await sleep(250);
  assert.equal(await evaluate('document.visibilityState'),'visible','test controls must be on the visible main window');
  const setting=JSON.parse(fs.readFileSync(path.join(path.dirname(home),'diagnostics/reporting-settings.json')));assert.equal(setting.autoReport,false);assert.equal(setting.source,'user');
  await evaluate("Array.from(document.querySelectorAll('summary')).find(b=>b.innerText.trim()==='更多').click()");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()==='使用指南').click()");
  await until(value=>value.text.includes('问题与维护'),'help navigation');
  await evaluate("Array.from(document.querySelectorAll('summary')).find(b=>b.innerText.trim()==='诊断与上报').click()");
  snapshot=await until(value=>value.text.includes('自动上报：已关闭'),'real diagnostic status');
  await evaluate("Array.from(document.querySelectorAll('summary')).find(b=>b.innerText.trim()==='关于 QCU Buddy').click()");
  snapshot=await until(value=>value.text.includes('界面组件 0.3.0-pilot.8'),'about brand');
  const logo=await evaluate("(()=>{const img=document.querySelector('.qcu-side-brand img');const name=document.querySelector('.qcu-brand-name strong');const toggle=document.querySelector('.qcu-side-brand button');const a=name.getBoundingClientRect(),b=toggle.getBoundingClientRect();return {loaded:img.complete&&img.naturalWidth>0,text:name.innerText,noOverlap:a.right<=b.left,schoolNameInLogo:img.alt.includes('青岛城市学院')}})()");
  assert.equal(logo.loaded,true);assert.equal(logo.text,'QCU Buddy');assert.equal(logo.noOverlap,true);
  assert.equal(await evaluate('document.title'),'QCU Buddy');
  await focusMain();
  const screenshotAvailable=await capture(out+'.png');
  assert.ok(snapshot.text.includes('QCU Buddy'),'QCU Buddy brand must be visible');
  assert.ok(!snapshot.text.includes('青岛城市学院'),'school name must not be shown in brand UI');
  const proof={passed:true,brandName:'QCU Buddy',schoolNameShown:false,logoVerified:true,aboutVerified:true,windowTitleVerified:true,screenshotAvailable,visibility:await evaluate('document.visibilityState'),platform:process.platform,guiLoaded:true,firstUse,restart,directDisableVerified:firstUse,explicitOffPersisted:true,diagnosticsDisplayed:true,snapshot,modelCalls:0};
  fs.writeFileSync(out,JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,snapshot:undefined}));
 }finally{ws?.close();child.kill();await sleep(1500);if(child.exitCode===null)child.kill('SIGKILL');fs.closeSync(error)}
})().catch(error=>{console.error(error);process.exitCode=1});
