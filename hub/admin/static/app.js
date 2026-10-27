'use strict';
const $ = id => document.getElementById(id);
const statuses = {'checking':'静态检查中','needs-changes':'需要补充材料','in-review':'待人工审核','approved':'已批准本机准备','preparing':'准备候选中','release-prepared':'本机候选已生成','recoverable-failure':'操作中断，需人工核对'};
const next = {'needs-changes':'查看报告及退回理由，修改材料后重新投稿。','in-review':'维护者检查原始材料，记录证据边界后作出审核决定。','approved':'检查候选预览，再单独确认生成本机候选。','release-prepared':'下载并复核本机候选；真实发布与市场目录关联尚未实现。','recoverable-failure':'维护者核对私有状态目录中的中断记录；不要沿用未知写入，修改材料后创建新修订。'};
const checklist = {source:'已人工复核来源与源码声明，并在理由中记录核验范围',license:'已人工复核许可与分发边界',permissions:'已人工复核权限、数据影响与依赖声明',evidenceBoundaries:'已区分声明、已测与未测；本机批准不证明原生或业务验收通过'};
let token = '', records = [], selected = '', busy = false, publication = null;
function el(tag, text, cls) { const n = document.createElement(tag); if(['button','input','textarea','select'].includes(tag))n.disabled=busy; if(text !== undefined) n.textContent = text; if(cls) n.className = cls; return n; }
function message(text) { $('message').textContent = text; }
function jsonDetails(title, value) { const d = el('details'); d.append(el('summary',title),el('pre',JSON.stringify(value,null,2))); return d; }
function button(text, fn, cls) { const b = el('button',text,cls); b.type='button'; b.disabled=busy; b.addEventListener('click',()=>run(fn)); return b; }
function setBusy(value) { busy=value; document.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=value); if(!value) $('upload').disabled=!$('folder').files.length; }
async function run(fn) { if(busy)return;setBusy(true);message('');try{await fn();}catch(e){message(e.message);}finally{setBusy(false);} }
async function api(path, body) {
 const response = await fetch(path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/vnd.qcu.submission+json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
 if(response.status===401){clearSession();throw Error(path==='/api/login'?'账号或密码不正确，请重试。':'登录已失效，请重新登录。操作未自动重试。');}
 if(response.status===429&&path==='/api/login')throw Error('登录尝试过多，请等待一分钟后重试。');
 if(!response.ok){let code='request.failed';try{code=(await response.json()).error;}catch{}throw Error('操作未完成：'+code);}
 return response.json();
}
async function download(path) {
 const response=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 if(response.status===401){clearSession();throw Error('登录已失效，请重新登录。操作未自动重试。');}
 if(!response.ok)throw Error('下载未完成：'+(await response.json()).error);
 const blob=await response.blob(),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'material.bin';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function refresh() {
 records=await api('/api/submissions');publication=await api('/api/publication');
 const status=$('publication-status');status.replaceChildren(el('h2','公开市场'),el('p',publication.message||'尚无公开发行。'));
 if(publication.configured){status.append(el('p',`当前修订：${publication.current.revision} · ${publication.state}`));if(publication.current.revision)status.append(button('重新核对公开下载',async()=>{await api('/api/publication/recheck',{});await refresh();}));}
 await refreshMaintenance();await refreshFeedback();
 renderQueue();if(selected){const r=records.find(r=>r.id===selected);if(r)renderDetail(r);}
}
function renderQueue() {
 const queue=$('queue');queue.replaceChildren();
 if(!records.length){queue.append(el('p','暂无投稿。选择完整 handoff 文件夹开始。','muted'));return;}
 for(const r of [...records].reverse()){
  const b=button('',async()=>{selected=r.id;renderQueue();renderDetail(await api('/api/submissions/'+r.id));},'record');
  b.setAttribute('aria-pressed',String(selected===r.id));b.append(el('strong',r.metadata.title||'材料待修正'),el('small',(r.metadata.id||'身份未通过')+' / '+(r.metadata.version||'版本待核对')),el('span',statuses[r.status]||r.status,'status'));queue.append(b);
 }
}
function fields(parent, rows, cls) { const dl=el('dl',undefined,cls);for(const [name,value] of rows){dl.append(el('dt',name),el('dd',typeof value==='string'?value:JSON.stringify(value)));}parent.append(dl); }
function evidenceRows(evidence) {
 const stages={source:'源代码检查',preview:'界面预览',liveInstall:'原生安装',businessAcceptance:'教师业务验收'},states={passed:'声明通过，待核验',failed:'声明失败',untested:'未测',missing:'缺失'};
 return Object.entries(stages).map(([key,label])=>[label,states[typeof evidence?.[key]==='string'?evidence[key]:evidence?.[key]?.status]||'缺失']);
}
function evidenceDescription(evidence) { return evidenceRows(evidence).map(row=>row.join('：')).join('；'); }
function localTime(value) { return new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）'; }
function attachments(parent, rows, base) { rows.forEach((row,i)=>{const line=el('div',undefined,'file-row');line.append(el('span',row.path+' · '+row.bytes+' 字节'),button('下载',()=>download(base+'/'+i),'quiet'));parent.append(line);}); }
function renderDetail(r) {
 const d=$('detail'),m=r.metadata,base='/api/submissions/'+r.id;d.replaceChildren(el('h2',m.title||'未通过静态检查的投稿'),el('p',statuses[r.status]||r.status,'status'),el('p',r.status==='release-prepared'&&publication?.configured?'本机候选已准备。请预览并单独确认公开发布。':next[r.status]||'检查任务状态。','next'));
 fields(d,[['产品 / 版本',(m.id||'待核对')+' / '+(m.version||'待核对')],['投稿编号',r.id],['接收时间',localTime(r.createdAt)]]);
 const report=r.report;
 if(report){
  d.append(el('h3','材料与证据'),el('p',report.staticChecksPassed?'静态检查通过，仍需人工核验。模式扫描不构成无密钥或安全认证。':'静态检查未通过，不能批准或生成候选。'));
  d.append(el('p','阶段证据（提交者声明）','muted'));fields(d,evidenceRows(report.evidence),'evidence');
  fields(d,[['人工复核项',report.reviewRequirements.length+' 项'],['安装与发布权限','候选流程不授予教师安装或启用权限；公开发布须另行确认']]);
  d.append(jsonDetails('技术检查报告',report));
 }
 d.append(jsonDetails('材料摘要与字节清单',{materialsDigest:r.materialsDigest,inventory:r.inventory}));
 {
  const material=el('details');material.append(el('summary','检查原始材料（仅下载，不执行）'),button('下载检查报告',()=>download(base+'/report'),'quiet'));attachments(material,r.inventory,base+'/materials');d.append(material);
 }
 d.append(jsonDetails('审核与操作记录',r.audit));
 if(r.status==='in-review'){
  if(publication?.configured)renderEntryForm(d,r);
  d.append(el('h3','人工审核决定'));
  const label=el('label','审核理由与核验范围');label.htmlFor='reason';const reason=el('textarea');reason.id='reason';reason.maxLength=2000;d.append(label,reason);
  for(const [key,text] of Object.entries(checklist)){const l=el('label',undefined,'check'),input=el('input');input.type='checkbox';input.id='check-'+key;l.append(input,el('span',text));d.append(l);}
  const actions=el('div',undefined,'actions');
  for(const [action,title] of [['return','退回补充'],['approve','批准本机准备']])actions.append(button(title,async()=>{
   const checks=Object.fromEntries(Object.keys(checklist).map(key=>[key,$('check-'+key).checked]));
   if(!reason.value.trim())throw Error('请填写审核理由与核验范围。');
   if(action==='approve'&&!Object.values(checks).every(Boolean))throw Error('批准前请逐项确认人工复核清单。');
   await api(base+'/review',{action,reason:reason.value,materialsDigest:r.materialsDigest,checklist:checks});await refresh();message(action==='approve'?'已批准本机准备。仍需单独确认生成候选。':'已退回，请修改后重新投稿。');
  }));d.append(actions);
 }
 if(['approved','release-prepared'].includes(r.status)){
  d.append(button('查看发布候选确认',async()=>renderConfirmation(r,await api(base+'/preview'))));
 }
 if(r.candidate){const files=el('details');files.append(el('summary','下载本机候选文件'));attachments(files,r.candidate.inventory,base+'/candidate');d.append(files);}
 if(r.status==='release-prepared'&&publication?.configured){
  if(r.marketEntry){d.append(el('h3','独立公开发布'),el('p','发布只更新签名目录与固定归档，不安装或启用教师设备。撤回不卸载、不删除教师数据。'));
   for(const [operation,text] of [['publish','预览公开发布'],['withdraw','预览撤回'],['rollback','预览恢复此版本']])d.append(button(text,async()=>renderPublishConfirmation(r,operation,await api(base+'/publication-preview',{operation}))));
  }else d.append(el('p','未在审核前附加市场说明。本候选不能发布；请以新投稿重新提交市场说明并审核。'));
 }
}
function renderEntryForm(parent,r){
 const box=el('details');box.append(el('summary','市场说明（审核前保存，批准后冻结）'),el('p','仅支持包名相同的唯一组件：静态 Skill 提供方或工具插件。多组件须先拆成受支持的单组件交付，不会猜测用途。'));
 const labels={purpose:'用途',scenario:'适用场景',prerequisites:'使用前提',example:'使用步骤或示例',risk:'权限与影响',testStatus:'已测与未测边界',author:'作者',upstreamSource:'上游来源',modifications:'修改说明'};
 for(const [key,text] of Object.entries(labels)){const label=el('label',text),input=el('textarea');input.id='entry-'+key;input.maxLength=2000;input.rows=2;input.value=r.marketAttachment?.[key]||r.marketAttachment?.provenance?.[key]||'';label.htmlFor=input.id;box.append(label,input);}
 const label=el('label','来源归属'),select=el('select');select.id='entry-ownership';for(const [value,text] of [['qcu','QCU自有'],['third-party','第三方改编']]){const o=el('option',text);o.value=value;select.append(o);}select.value=r.marketEntry?.provenance?.ownership||'qcu';label.htmlFor=select.id;box.append(label,select);
 box.append(button('保存市场说明并预览',async()=>{const entry={};for(const key of ['purpose','scenario','prerequisites','example','risk','testStatus'])entry[key]=$('entry-'+key).value;entry.provenance={ownership:select.value,author:$('entry-author').value,upstreamSource:$('entry-upstreamSource').value,modifications:$('entry-modifications').value,pinnedRevision:r.metadata.sourceRevision,license:r.metadata.license};await api('/api/submissions/'+r.id+'/market-entry',{materialsDigest:r.materialsDigest,entry});await refresh();message('市场说明已保存；批准时将绑定此说明，需要重新完成审核清单。');}));
 if(r.marketEntry)box.append(jsonDetails('冻结前市场条目预览',r.marketEntry));parent.append(box);
}
function renderPublishConfirmation(r,operation,preview){
 $('publish-confirmation')?.remove();const box=el('section',undefined,'confirm');box.id='publish-confirmation';box.setAttribute('aria-label','公开发布确认');
 const label={publish:'公开发布',withdraw:'撤回',rollback:'恢复此版本'}[operation];
 box.append(el('h3',label+'前确认'),el('p','仅签名目录和精确TGZ会进入公开服务。发布后支持动态信任的新市场可刷新获取；旧固定目录客户端需先更新。回退同样创建更高修订，不重写历史。'),el('p',`${r.metadata.id} / ${r.metadata.version}；当前修订 ${preview.proposal.previous.revision}`),jsonDetails('精确发布提案',preview.proposal));
 const l=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.id='confirm-publish';l.append(check,el('span','确认本次'+label+'及精确材料；不授予教师安装或启用权限。'));box.append(l,button('确认'+label,async()=>{if(!check.checked)throw Error('请先确认公开发布提案。');const result=await api('/api/submissions/'+r.id+'/publish',{operation,previewDigest:preview.previewDigest,confirm:true});await refresh();message(result.state==='verified'?'公开指针已生效，HTTP下载复核通过。':'公开指针已生效，但下载验证未通过。请重新核对公开下载，不重复发布。');}));$('detail').append(box);box.scrollIntoView({block:'start'});
}
function renderConfirmation(r, preview) {
 document.getElementById('candidate-confirmation')?.remove();
 const box=el('section',undefined,'confirm');box.id='candidate-confirmation';box.setAttribute('aria-label','发布候选确认');const p=preview.proposal,m=p.metadata;
 box.append(el('h3','生成发布候选前确认'),el('p','这只生成不可变本机候选。不会发布 Hub、更新市场目录或安装到 DSH。','next'));
 fields(box,[['产品 / 固定版本',m.id+' / '+m.version],['TGZ',m.archive.file],['归档字节',m.archive.bytes],['归档 SHA256',m.archive.sha256],['sourceRevision（声明）',m.sourceRevision],['许可（声明）',m.license],['权限（声明）',m.permissionSummary.join('；')],['证据（声明）',evidenceDescription(m.testEvidence)],['已知限制',m.knownLimits.join('；')],['材料摘要',p.materialsDigest],['审核决定','维护者于'+localTime(p.approval.time)+'批准本机准备；'+p.approval.reason],['候选提案摘要',preview.proposalDigest],['市场兼容边界',p.marketplaceCaveat]]);
 box.append(jsonDetails('完整候选提案',p));const label=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.id='confirm-candidate';label.append(check,el('span','确认以上精确字节与审核决定，仅生成本机候选，保留所有未测边界。'));box.append(label,button('生成发布候选',async()=>{
  if(!check.checked)throw Error('请确认候选的精确材料及本机准备边界。');
  await api('/api/submissions/'+r.id+'/prepare',{materialsDigest:r.materialsDigest,proposalDigest:preview.proposalDigest,confirm:true});await refresh();message('本机候选已生成，未发布。');
 }));$('detail').append(box);box.scrollIntoView({block:'start'});
}
function clearSession() {
 token='';records=[];selected='';$('password').value='';$('folder').value='';$('selection').textContent='尚未选择文件夹';$('queue').replaceChildren();$('detail').replaceChildren();$('maintenance').replaceChildren();$('feedback-inbox').replaceChildren();$('workspace').hidden=true;$('access').hidden=false;
}
$('login').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 const body={account:$('account').value,password:$('password').value};$('password').value='';
 try{token=(await api('/api/login',body)).token;}finally{body.password='';$('password').value='';}
 $('access').hidden=true;$('workspace').hidden=false;$('role').textContent='qcu-admin · 本机管理员';await refresh();
});});
$('logout').addEventListener('click',()=>run(async()=>{
 try{await api('/api/logout',{});}finally{clearSession();message('已退出。会话仅保留在当前页面内存，刷新后需重新登录。');}
}));
$('refresh').addEventListener('click',()=>run(refresh));$('theme').addEventListener('change',()=>{if($('theme').value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=$('theme').value;});
$('folder').addEventListener('change',()=>{$('selection').textContent=$('folder').files.length+' 个文件待上传';$('upload').disabled=!$('folder').files.length;});
$('upload').addEventListener('click',()=>run(async()=>{
 const files=Array.from($('folder').files);if(!files.length||files.length>64)throw Error('请选择包含1至64个文件的 handoff 文件夹。');
 const paths=files.map(f=>f.webkitRelativePath||f.name),prefix=paths[0].split('/')[0];
 if(!paths.every(p=>p.startsWith(prefix+'/')))throw Error('请选择一个共同根文件夹。');
 let total=0;const rows=[];
 for(let i=0;i<files.length;i++){
  const path=paths[i].slice(prefix.length+1),file=files[i];total+=file.size;
  if(file.size>(path.toLowerCase().endsWith('.json')?262144:1048576)||total>10485760)throw Error('文件超过本机接收上限。');
  const raw=new Uint8Array(await file.arrayBuffer());let binary='';for(let offset=0;offset<raw.length;offset+=8192)binary+=String.fromCharCode(...raw.subarray(offset,offset+8192));rows.push({path,base64:btoa(binary)});
 }
 const r=await api('/api/submissions',{files:rows});selected=r.id;await refresh();message('材料已冻结：'+statuses[r.status]+'。');
}));

async function refreshMaintenance(){
 const m=await api('/api/maintenance'),box=$('maintenance');box.replaceChildren(el('h2','维护检查'),el('p',m.message));
 if(m.configured){box.append(button('只读刷新公开状态',async()=>{await api('/api/maintenance/refresh',{});await refreshMaintenance();}));
  if(m.lastCheck){const r=m.lastCheck;fields(box,[['检查时间',r.checkedAt],['目录签名',maintenanceLabel(r.catalog.verification)],['目录有效期',r.catalog.expiresAt||'未观察'],['目录时效',maintenanceLabel(r.catalog.freshness)],['产品数量',r.catalog.productCount??'未观察'],['目录归档 / HTTP',maintenanceLabel(r.catalog.integrity)+' / '+maintenanceLabel(r.catalog.http)],['旧更新源签名与完整性',maintenanceLabel(r.updates.verification)],['旧更新源有效期',r.updates.expiresAt||'未观察'],['旧更新源时效',maintenanceLabel(r.updates.freshness)],['专家更新源',maintenanceLabel(r.expertFeed.state)]]);if(r.coverage){box.append(el('h3','初装与更新覆盖'),el('p',r.coverage.gaps.length?'发现 '+r.coverage.gaps.length+' 项覆盖缺口。签名有效不代表已覆盖最新目录版本。':'已核对目录与更新源的版本覆盖。'));for(const row of r.coverage.gaps)box.append(el('p',(row.title||row.id)+'：目录 '+(row.catalogVersion||'未列出')+'，更新源 '+(row.effectiveLatest||'未覆盖')+'。'+row.action));}box.append(jsonDetails('技术信息与完整检查结果',r));}
 }
}
async function refreshFeedback(){
 const result=await api('/api/feedback'),box=$('feedback-inbox');box.replaceChildren(el('h2','反馈收件箱'));
 if(!result.configured){box.append(el('p','未配置独立反馈目录；公开 Hub 保持只读。'));return;}
 if(!result.records.length)box.append(el('p','暂无反馈。'));
 for(const row of result.records)box.append(button(row.title+' · '+feedbackLabel(row.state),async()=>renderFeedback(await api('/api/feedback/'+row.receiptId))));
}
function feedbackLabel(s){return {'received':'已收到','in-progress':'处理中','resolved':'维护者已标记完成'}[s]||s;}
function renderFeedback(r){
 $('feedback-detail')?.remove();const box=el('section',undefined,'confirm');box.id='feedback-detail';box.setAttribute('aria-label','反馈详情');box.append(el('h3',r.payload.title),el('p',feedbackLabel(r.state)),el('pre',r.payload.text),el('p','标记完成仅表示维护者处理，不代表教师确认有效。'));
 const label=el('label','公开处理说明（不含私人资料）'),input=el('textarea');input.id='feedback-message';input.maxLength=300;input.value=r.message;label.htmlFor=input.id;box.append(label,input);
 for(const state of ['received','in-progress','resolved'])box.append(button({received:'标记为已收到','in-progress':'标记为处理中',resolved:'标记已处理'}[state],async()=>{await api('/api/feedback/'+r.receiptId+'/status',{revision:r.revision,state,message:input.value});await refreshFeedback();message('状态已更新；教师可主动查询回执。');}));
 box.append(button('关闭反馈详情',async()=>box.remove()),jsonDetails('有限操作记录',r.audit));$('feedback-inbox').append(box);box.scrollIntoView({block:'start'});
}

function maintenanceLabel(value){return {'signature-verified':'签名已验证','signature-and-integrity-verified':'签名与完整性已验证','parsed-only':'仅解析（未验证签名）','unavailable':'不可用','unobserved':'未观察','verified':'已验证','failed':'未通过','not-checked':'未检查','fresh':'有效','near-expiry':'不足72小时即将过期','expired':'已过期','future':'尚未生效','supported-legacy-fallback':'支持回退旧更新源','invalid':'验证失败'}[value]||'未观察';}
