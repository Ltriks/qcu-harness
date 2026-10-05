import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {apply} from '../plugin/index.js';

test('real tool/Python/panel handoff preserves chronology, discards stale refresh and rejects unauthorized results', {timeout:15000}, async () => {
  const home = await mkdtemp(join(tmpdir(), 'qcu-handoff-'));
  const child = spawn(process.env.QCU_PYTHON || 'python3', [fileURLToPath(new URL('../runtime/server.py', import.meta.url)), '--home', home], {stdio:['ignore','pipe','pipe']});
  let dispose; const pages = [];
  try {
    await once(child.stdout, 'data');
    const bridgePath = join(home, 'bridge.json');
    const bridge = JSON.parse(await readFile(bridgePath, 'utf8'));
    const response = await fetch(bridge.base_url + '/task');
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const scope = name => createHash('sha256').update(name).digest('hex');
    const agent = name => ({agent:{session:{id:name}}});
    const a = 'synthetic-conversation-a', b = 'synthetic-conversation-b';
    const request = (route, options = {}, tag = scope(a)) => fetch(bridge.base_url + route, {...options, headers:{Cookie:cookie, Origin:bridge.base_url, 'X-QCU-Task-Session':tag, ...options.headers}});
    const docx = await readFile(process.env.QCU_SYNTHETIC_DOCX || new URL('../../../tests/fixtures/01-demo-match.docx', import.meta.url));
    const upload = async (local, allowed) => (await request(local ? '/api/task/upload' : '/api/upload', {method:'POST',headers:{'Content-Type':'application/octet-stream','X-QCU-Chat-Allowed':String(allowed)},body:docx})).json();
    const rules = await (await request('/api/rules')).json();
    const rule = rules.find(value => value.source === 'demo').id;
    const local = await upload(true, false);
    const old = await (await request('/api/task/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document_id:local.document_id, rule_id:rule,local_authorized:true})})).json();
    const oldSummary = {counts:old.counts,reportPath:old.report_url,ruleSource:old.rule_source,completedAt:old.completed_at};
    const html = await readFile(new URL('../web/task-panel.html',import.meta.url),'utf8');
    const js = await readFile(new URL('../web/task-panel.js',import.meta.url),'utf8');
    function panel(tag, restored) {
      const dom = new JSDOM(html,{url:bridge.base_url+'/task',runScripts:'outside-only'}); pages.push(dom);
      dom.window.fetch = (route, options) => request(route, options, tag);
      dom.window.AbortController = globalThis.AbortController;
      if (restored) dom.window.sessionStorage.setItem('qcu-local-task-summary-v1',JSON.stringify(restored));
      dom.window.eval(js);
      return dom.window;
    }
    async function until(predicate) {
      for (let i=0;i<100;i++) {if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}
      assert.fail('bounded panel transition did not complete');
    }
    const current = panel(scope(a),oldSummary);
    await until(()=>current.document.getElementById('task-report').getAttribute('href')===old.report_url);
    const rows = new Map();
    dispose=apply({tools:{guard:()=>()=>{},register:row=>{rows.set(row.name,row);return ()=>rows.delete(row.name);}},on:()=>()=>{}},{bridgePath});
    const shared = await upload(false,true);
    const args={document_id:shared.document_id,rule_id:rule};
    const output=await rows.get('qcu_thesis_check').execute(args,agent(a));
    assert.equal(output.status,'completed');
    assert.doesNotMatch(JSON.stringify(output), /https?:|\/reports\/|document_id|session_tag/);
    const latest = await (await request('/api/task/latest')).json();
    assert.equal(latest.status,'completed');assert.notEqual(latest.report_url,old.report_url);
    current.document.getElementById('refresh-result').click();
    await until(()=>current.document.getElementById('task-report').getAttribute('href')===latest.report_url);
    assert.equal(current.document.getElementById('task-download').getAttribute('href'),latest.report_url);
    const reopened=panel(scope(a),oldSummary);
    await until(()=>reopened.document.getElementById('task-report').getAttribute('href')===latest.report_url);
    const report=await request(latest.report_url);assert.equal(report.status,200);
    assert.match(await report.text(), /保存 HTML 报告/);
    for(let i=0;i<2;i++)assert.equal((await request(latest.report_url+'/download')).status,200);
    assert.equal((await request(latest.report_url,{},scope(b))).status,403);
    assert.equal((await request(latest.report_url+'/download',{},scope(b))).status,403);
    assert.deepEqual(await (await request('/api/task/latest',{},scope(b))).json(),{status:'empty'});
    assert.equal((await rows.get('qcu_thesis_check').execute(args,agent(b))).status,'unavailable');
    assert.equal((await rows.get('qcu_thesis_check').execute({document_id:local.document_id,rule_id:rule},agent(a))).status,'unavailable');
    // Delay an old conversation refresh until a newly authorized local check has completed.
    await until(()=>current.document.getElementById('task-rule').disabled===false);
    const input=current.document.getElementById('task-document');
    Object.defineProperty(input,'files',{configurable:true,value:[Object.assign(Buffer.from(docx),{name:'synthetic.docx',size:docx.length})]});
    input.dispatchEvent(new current.Event('change'));
    current.document.getElementById('local-authorized').checked=true;
    current.document.getElementById('local-authorized').dispatchEvent(new current.Event('change'));
    const liveFetch=current.fetch;let release,requested=false;
    current.fetch=async(route,options)=>{
      const response=await liveFetch(route,options);
      if(route==='/api/task/latest'){requested=true;return new Promise(resolve=>{release=()=>resolve(response);});}
      return response;
    };
    current.document.getElementById('refresh-result').click();await until(()=>requested);
    await current.document.getElementById('task-form').onsubmit({preventDefault(){}});
    const newer=JSON.parse(current.sessionStorage.getItem('qcu-local-task-summary-v1'));
    assert.ok(newer.completedAt>latest.completed_at);
    assert.notEqual(newer.reportPath,latest.report_url);
    release();await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(current.document.getElementById('task-report').getAttribute('href'),newer.reportPath);
    current.fetch=liveFetch;
    // Entering or explicitly refreshing must also preserve the newer local result.
    const newerPanel=panel(scope(a),newer);
    await until(()=>newerPanel.document.getElementById('task-report').getAttribute('href')===newer.reportPath);
    await until(()=>!newerPanel.document.getElementById('refresh-result').disabled && !newerPanel.document.getElementById('task-rule').disabled);
    newerPanel.document.getElementById('task-notice').textContent='';
    newerPanel.document.getElementById('refresh-result').click();
    await until(()=>newerPanel.document.getElementById('task-notice').textContent.includes('保留更新'));
    assert.equal(newerPanel.document.getElementById('task-report').getAttribute('href'),newer.reportPath);
    // A malformed/older response without completion order must not bypass freshness checks.
    await until(()=>!newerPanel.document.getElementById('refresh-result').disabled);
    newerPanel.fetch=async()=>new Response(JSON.stringify({...latest,completed_at:undefined}),{status:200,headers:{'Content-Type':'application/json'}});
    newerPanel.document.getElementById('refresh-result').click();
    await until(()=>newerPanel.document.getElementById('task-notice').textContent.includes('无法读取'));
    assert.equal(newerPanel.document.getElementById('task-report').getAttribute('href'),newer.reportPath);
    const grantPath=join(home,'documents',shared.document_id+'.json');
    const grant=JSON.parse(await readFile(grantPath,'utf8'));grant.expires=0;await writeFile(grantPath,JSON.stringify(grant));
    assert.deepEqual(await (await request('/api/task/latest')).json(),{status:'empty'});
    assert.equal((await request(latest.report_url)).status,403);
    reopened.document.getElementById('refresh-result').click();
    await until(()=>reopened.document.getElementById('task-result').hidden);
  } finally {
    dispose?.();for(const dom of pages)dom.window.close();
    child.kill('SIGTERM');await once(child,'close');await rm(home,{recursive:true,force:true});
  }
});
