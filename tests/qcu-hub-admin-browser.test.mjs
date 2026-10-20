// Real Chromium, real loopback HTTP, synthetic fixtures only. No installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve,join} from 'node:path';
import {mkdir,mkdtemp,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const dependencyRoot=process.env.QCU_BROWSER_DEPENDENCIES;
if(!dependencyRoot)throw Error('Set QCU_BROWSER_DEPENDENCIES to existing local Playwright dependencies; do not install.');
const require=createRequire(resolve(dependencyRoot,'package.json')),{chromium}=require('playwright');
const repo=resolve('.'),out=resolve('.work/hub-single-admin/browser');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
async function python(args){const child=spawn('python3',args,{cwd:repo,stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>error+=b);const [code]=await once(child,'exit');assert.equal(code,0,error);}
async function start(root,initialize){
 const child=spawn('python3',['tests/support/hub-admin-fixture.py','--state-root',root,...(initialize?['--initialize']:[])],{cwd:repo,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 let url;try{url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('preview.start_timeout')),8000);child.stdout.on('data',()=>{const match=log.match(/Local preparation only: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('preview.exited_'+code));});});}catch(error){if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGINT');await exited;}throw error;}
 return {child,url,log:()=>log};
}
async function stop(server){if(!server||server.child.exitCode!==null)return;const exited=once(server.child,'exit');server.child.kill('SIGINT');await exited;assert.equal(server.child.exitCode,0);assert.throws(()=>process.kill(server.child.pid,0),{code:'ESRCH'});}

test('browser folder handoff, review, candidate, reload/restart, session expiry and layout', {timeout:120000}, async()=>{
 await mkdir(out,{recursive:true});
 const fixtureRoot=await mkdtemp(resolve('.work/hub-single-admin/fixtures-'));
 await python(['templates/qcu-submission/generate-example.py','--output',join(fixtureRoot,'examples')]);
 const pass=join(fixtureRoot,'examples/static-pass'),fail=join(fixtureRoot,'examples/reject');
 const parent=await mkdtemp('/private/tmp/qcu-hub-single-admin-browser-'),stateRoot=join(parent,'state'),clockFile=join(parent,'synthetic-clock-offset');
 await writeFile(clockFile,'0');
 let server,browser,page;
 const errors=[],outside=[],requests=[],requestFailures=[],metrics=[],checks=[],logs=[];
 const result={status:'running',stateRoot,fixtureRoot,checks,metrics,errors,outside,requests,requestFailures,serverPids:[]};
 try{
  server=await start(stateRoot,true);result.serverPids.push(server.child.pid);
  const password='Synthetic-only-admin-2026!';let observedToken='';const sessionTokens=new Set();
  browser=await chromium.launch({headless:true,executablePath:process.env.QCU_BROWSER_EXECUTABLE||'/Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
  page=await browser.newPage({viewport:{width:1120,height:900},acceptDownloads:true});page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>requestFailures.push({method:r.method(),path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  page.on('console',m=>{if(m.type()==='error'&&!/401 \(Unauthorized\)|403 \(Forbidden\)|429 \(Too Many Requests\)/.test(m.text()))errors.push(m.text());});
  await page.route('**/*',route=>{
   const request=route.request();if(!request.url().startsWith(server.url+'/')){outside.push(request.url());return route.abort();}
   const authorization=request.headers().authorization;if(/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization||'')){observedToken=authorization.slice(7);sessionTokens.add(observedToken);}
   requests.push({method:request.method(),path:new URL(request.url()).pathname});return route.continue();
  });
  const field=name=>page.getByLabel(name,{exact:true});
  const button=name=>page.getByRole('button',{name,exact:true});
  const login=async()=>{await field('账号').fill('qcu-admin');await field('密码').fill(password);await button('进入工作区').click();await page.getByText('qcu-admin · 本机管理员',{exact:true}).waitFor();assert.equal(await field('密码').inputValue(),'');await page.waitForFunction(()=>!document.getElementById('refresh').disabled);};
  const logout=async()=>{const old=observedToken;await button('退出').click();await field('密码').waitFor();const status=await page.evaluate(async token=>(await fetch('/api/session',{headers:{Authorization:'Bearer '+token}})).status,old);assert.equal(status,401);checks.push('logout invalidates server session');};
  const upload=async folder=>{await field('开发者 handoff 文件夹').setInputFiles(folder);await button('上传并检查').click();await page.getByRole('status').filter({hasText:'材料已冻结'}).waitFor();};
  const choose=async status=>{await page.locator('.record').filter({hasText:status}).first().click();await page.locator('#detail > .status').filter({hasText:status}).waitFor();};
  const expand=async name=>{const summary=page.locator('summary').filter({hasText:name});if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();};
  await page.goto(server.url);
  await field('账号').fill('qcu-admin');await field('密码').fill('Synthetic-wrong-password!');await button('进入工作区').click();await page.getByRole('status').filter({hasText:'账号或密码不正确'}).waitFor();assert.equal(await field('密码').inputValue(),'');assert.equal(await page.locator('#workspace').isVisible(),false);checks.push('failed login clears password and hides data');
  for(let attempt=0;attempt<4;attempt++){await field('密码').fill('Synthetic-wrong-password!');await button('进入工作区').click();await page.getByRole('status').filter({hasText:'账号或密码不正确'}).waitFor();await page.waitForFunction(()=>!document.querySelector('#login button').disabled);assert.equal(await field('密码').inputValue(),'');}
  await field('密码').fill(password);await button('进入工作区').click();await page.getByRole('status').filter({hasText:'请等待一分钟后重试'}).waitFor();assert.equal(await field('密码').inputValue(),'');assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(await page.getByRole('status').textContent().then(t=>t.includes('auth.throttled')),false);await writeFile(clockFile,'61');checks.push('real login throttle shows wait/retry hint, clears password and clock-window permits later login');

  for(const theme of ['light','dark'])for(const width of [390,1120]){await page.setViewportSize({width,height:900});await field('外观').selectOption(theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,`login-${theme}-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:1120,height:900});await field('外观').selectOption('light');
  await field('密码').focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'进入工作区');assert.equal(await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineWidth),'2px');checks.push('keyboard tab and visible focus on labelled login');await login();await page.getByText('暂无投稿。选择完整 handoff 文件夹开始。',{exact:true}).waitFor();await page.screenshot({path:join(out,'empty-light-1120.png'),fullPage:true});checks.push('truthful empty queue');
  await field('开发者 handoff 文件夹').setInputFiles(pass);await writeFile(clockFile,'28900');const beforeExpiry=requests.filter(r=>r.method==='POST'&&r.path==='/api/submissions').length;await button('上传并检查').click();await page.getByRole('status').filter({hasText:'操作未自动重试'}).waitFor();await field('密码').waitFor();assert.equal(await field('密码').inputValue(),'');assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/api/submissions').length,beforeExpiry+1);assert.equal(Object.keys(JSON.parse(await readFile(join(stateRoot,'state.json'),'utf8')).records).length,0);await writeFile(clockFile,'61');await login();assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/api/submissions').length,beforeExpiry+1);assert.equal(await page.locator('.record').count(),0);checks.push('real session expiry rejects upload, clears UI, re-login never resends mutation');

  await upload(fail);await page.locator('#detail > .status').filter({hasText:'需要补充材料'}).waitFor();
  assert.equal(await button('批准本机准备').count(),0);checks.push('static fail retained, no approval action');
  await upload(pass);await page.locator('#detail > .status').filter({hasText:'待人工审核'}).waitFor();
  assert.equal(await page.locator('.evidence dt').count(),4);assert.equal(await page.locator('.evidence dd').filter({hasText:'未测'}).count(),2);checks.push('four Chinese submitter-declared evidence rows preserve native/business untested');
  await upload(pass);assert.equal(await page.locator('.record').count(),2);checks.push('exact duplicate folder idempotent');
  checks.push('same administrator session imports and reviews without role switching');
  await expand('技术检查报告');assert.match(await page.locator('#detail details').filter({hasText:'技术检查报告'}).textContent(),/untested/);
  await expand('检查原始材料');
  const reportEvent=page.waitForEvent('download');await button('下载检查报告').click();const reportDownload=await reportEvent;const reportPath=join(out,'downloaded-checker-report.json');await reportDownload.saveAs(reportPath);assert.equal(JSON.parse(await readFile(reportPath,'utf8')).approval,'required');
  const materialRow=page.locator('.file-row').filter({hasText:'SOURCE.md'});const event=page.waitForEvent('download');await materialRow.getByRole('button',{name:'下载',exact:true}).click();const download=await event;const materialPath=join(out,'downloaded-source.md');await download.saveAs(materialPath);assert.deepEqual(await readFile(materialPath),await readFile(join(pass,'SOURCE.md')));checks.push('original report and source downloaded, byte integrity');
  const xssReason='Return for synthetic revision <img src=x onerror="window.injected=true">; native/business untested.';
  await field('审核理由与核验范围').fill(xssReason);await button('退回补充').click();await page.locator('#detail > .status').filter({hasText:'需要补充材料'}).waitFor();await expand('审核与操作记录');assert.match(await page.locator('#detail').textContent(),/<img src=x/);assert.equal(await page.locator('#detail img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);checks.push('return rationale stored as text, no uploaded HTML execution');
  await writeFile(join(pass,'SOURCE.md'),(await readFile(join(pass,'SOURCE.md'),'utf8'))+'\nSynthetic revision after review.\n');await upload(pass);assert.equal(await page.locator('.record').count(),3);checks.push('same TGZ, changed materials creates new review without inherited approval');
  await choose('待人工审核');
  await field('审核理由与核验范围').fill('Synthetic source/license/permissions inspected as fixture only. Source revision is a declaration; native install and business acceptance remain untested.');
  await button('批准本机准备').click();await page.getByRole('status').filter({hasText:'批准前请逐项确认'}).waitFor();assert.equal(requests.filter(r=>r.path.endsWith('/prepare')).length,0);
  for(const text of ['已人工复核来源与源码声明，并在理由中记录核验范围','已人工复核许可与分发边界','已人工复核权限、数据影响与依赖声明','已区分声明、已测与未测；本机批准不证明原生或业务验收通过'])await field(text).check();
  await button('批准本机准备').click();await page.locator('#detail > .status').filter({hasText:'已批准本机准备'}).waitFor();assert.equal(await readdir(join(stateRoot,'candidates')).then(x=>x.length),0);checks.push('approval requires checklist and does not prepare implicitly');
  await button('查看发布候选确认').click();await page.getByRole('region',{name:'发布候选确认'}).waitFor();assert.equal(requests.filter(r=>r.path.endsWith('/prepare')).length,0);assert.match(await page.locator('#candidate-confirmation').textContent(),/sourceRevision/);assert.match(await page.locator('#candidate-confirmation').textContent(),/未测/);await page.screenshot({path:join(out,'candidate-confirmation-1120.png'),fullPage:true});
  await button('生成发布候选').click();await page.getByRole('status').filter({hasText:'请确认候选的精确材料'}).waitFor();
  await field('确认以上精确字节与审核决定，仅生成本机候选，保留所有未测边界。').check();await button('生成发布候选').click();await page.locator('#detail > .status').filter({hasText:'本机候选已生成'}).waitFor();checks.push('explicit candidate confirmation and preparation');
  await expand('下载本机候选文件');const archiveRow=page.locator('.file-row').filter({hasText:'.tgz'}).last();const archiveEvent=page.waitForEvent('download');await archiveRow.getByRole('button',{name:'下载',exact:true}).click();const archiveDownload=await archiveEvent;const archivePath=join(out,'downloaded-candidate.tgz');await archiveDownload.saveAs(archivePath);const meta=JSON.parse(await readFile(join(pass,'submission.json'),'utf8'));assert.equal(hash(await readFile(archivePath)),meta.archive.sha256);checks.push('candidate exact archive SHA256 download');
  await button('查看发布候选确认').click();await field('确认以上精确字节与审核决定，仅生成本机候选，保留所有未测边界。').check();await button('生成发布候选').click();await page.getByRole('status').filter({hasText:'本机候选已生成，未发布。'}).waitFor();assert.equal((await readdir(join(stateRoot,'candidates'))).length,1);checks.push('candidate preparation retry idempotent');
  const prepared=Object.values(JSON.parse(await readFile(join(stateRoot,'state.json'),'utf8')).records).find(r=>r.status==='release-prepared');
  const preparationEvents=prepared.audit.filter(e=>e.action==='prepare');assert.deepEqual(preparationEvents.map(e=>e.result),['intent','completed']);for(const event of preparationEvents){assert.equal(event.materialsDigest,prepared.materialsDigest);assert.equal(event.proposalDigest,prepared.candidate.proposalDigest);}
  const immutableAudit=JSON.parse(await readFile(join(stateRoot,'candidates',prepared.candidate.id,'approval-audit.json'),'utf8'));assert.deepEqual(immutableAudit.audit,prepared.audit);checks.push('preparation audit result/digest/time persisted in immutable candidate');
  for(const theme of ['light','dark'])for(const width of [390,1120]){
   await page.setViewportSize({width,height:900});await field('外观').selectOption(theme);
   const metric=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.body).backgroundColor,openDetails:document.querySelectorAll('details[open]').length}));assert.equal(metric.overflow,false);assert.equal(metric.openDetails,0);metrics.push({theme,width,...metric});await page.screenshot({path:join(out,`populated-${theme}-${width}.png`),fullPage:true});
  }
  assert.notEqual(metrics[0].background,metrics[2].background);
  await field('外观').selectOption('system');await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(23, 35, 45)');checks.push('390/1120 light/dark, system theme, no horizontal overflow, technical details folded');
  await page.reload();await field('密码').waitFor();assert.equal(await field('密码').inputValue(),'');assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});await login();await choose('本机候选已生成');assert.equal(await page.locator('.record').count(),3);checks.push('reload preserves state, credentials are memory-only');
  await logout();await login();const restartToken=observedToken;logs.push(server.log());await stop(server);result.firstServerStopped=true;server=await start(stateRoot,false);result.serverPids.push(server.child.pid);await page.goto(server.url);assert.equal(await page.evaluate(async token=>(await fetch('/api/session',{headers:{Authorization:'Bearer '+token}})).status,restartToken),401);await login();await choose('本机候选已生成');assert.equal(await page.locator('.record').count(),3);checks.push('real process restart retains candidate and queue');
  await button('查看发布候选确认').click();await field('确认以上精确字节与审核决定，仅生成本机候选，保留所有未测边界。').check();await button('生成发布候选').click();await page.getByRole('status').filter({hasText:'本机候选已生成，未发布。'}).waitFor();
  const state=JSON.parse(await readFile(join(stateRoot,'state.json'),'utf8'));result.statuses=Object.values(state.records).map(r=>({id:r.id,status:r.status,materialsDigest:r.materialsDigest,candidateId:r.candidate?.id}));
  assert.deepEqual(state.records[prepared.id],prepared);checks.push('restart retry retains same candidate and exact audit, no new timestamp');
  for(const secret of [password,...sessionTokens])assert.equal(JSON.stringify({logs,requests,checks}).includes(secret),false);
  assert.equal(await page.evaluate(()=>document.cookie),'');checks.push('no passwords or sessions in evidence, browser storage or cookies');
  assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.deepEqual(requestFailures,[]);checks.push('no external requests or unexpected page/console errors');
  assert.equal((await stat(join(stateRoot,'admin-auth.json'))).mode&0o777,0o600);
  assert.equal((await stat(stateRoot)).mode&0o777,0o700);
  result.status='passed';
 }catch(error){result.status='failed';result.failure=error.message;if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{
  if(browser){await browser.close();assert.equal(browser.isConnected(),false);result.browserClosed=true;}if(server){logs.push(server.log());await stop(server);result.finalServerStopped=true;}
  await writeFile(join(out,'server.log'),logs.join('\n'));
  await writeFile(join(out,'results.json'),JSON.stringify(result,null,2));
 }
});
