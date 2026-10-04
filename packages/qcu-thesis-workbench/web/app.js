'use strict';
const $ = id => document.getElementById(id);
let rules = [], documentId = null, busy = false;
const pageFields = {width_mm:'纸张宽度',height_mm:'纸张高度',top_mm:'上页边距',bottom_mm:'下页边距',left_mm:'左页边距',right_mm:'右页边距'};
const styleFields = {font_east_asia:'中文字体',font_latin:'西文字体',size_pt:'字号（磅）',line_multiple:'行距（倍）',first_line_mm:'首行缩进（毫米）'};
function status(text, error=false){$('status').textContent=text;$('status').className=error?'error':'';}
function reveal(element){element.focus({preventScroll:true});const reduce=!window.matchMedia||window.matchMedia('(prefers-reduced-motion: reduce)').matches;element.scrollIntoView?.({behavior:reduce?'auto':'smooth',block:'start'});}
function setBusy(value){busy=value;$('run').disabled=value||!documentId;$('document').disabled=value;$('chat-allowed').disabled=value;$('edit-rule').disabled=value;$('rule-select').disabled=value;}
async function api(path, options={}){
  const response=await fetch(path,options);const data=await response.json();
  if(!response.ok)throw new Error(data.error||'操作未完成。');return data;
}
const jsonPost = data => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function selected(){return rules.find(r=>r.id===$('rule-select').value);}
function showRule(){const r=selected();$('rule-meta').textContent=r?`来源：${{demo:'演示规则',personal:'个人规则',center:'中心规则'}[r.source]} · 版本 ${r.version} · 编号 ${r.id}`:'';$('result').hidden=true;status('');}
async function loadRules(id){rules=await api('/api/rules');$('rule-select').replaceChildren(...rules.map(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.name;return o;}));if(id)$('rule-select').value=id;showRule();}
function field(key,label,value){const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement('input');input.dataset.field=key;input.type=key.startsWith('font_')?'text':'number';if(input.type==='number')input.step='0.01';input.value=value??'';wrapper.append(input);return wrapper;}
function addStyle(sid='',spec={}){
  const row=document.createElement('div');row.className='style-row';
  const head=document.createElement('div');head.className='style-head';
  const label=document.createElement('label');label.textContent='Word 样式编号';
  const input=document.createElement('input');input.className='style-id';input.setAttribute('list','style-options');input.value=sid;input.required=true;label.append(input);
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='移除规则';remove.onclick=()=>row.remove();head.append(label,remove);
  const fields=document.createElement('div');fields.className='field-grid';for(const [k,v] of Object.entries(styleFields))fields.append(field(k,v,spec[k]));
  row.append(head,fields);$('style-fields').append(row);
}
function values(container){const result={};for(const input of container.querySelectorAll('[data-field]')){if(input.value!=='')result[input.dataset.field]=input.type==='number'?Number(input.value):input.value;}return result;}
$('document').onchange=async()=>{
  documentId=null;$('result').hidden=true;$('document-info').hidden=true;
  const file=$('document').files[0];if(!file){$('file-state').textContent='还没有选择文件。';status('');setBusy(false);return;}
  if(!file.name.toLowerCase().endsWith('.docx')||file.size>20*1024*1024){$('file-state').textContent='文件未载入，请重新选择。';status('请选择不超过 20 MB 的 DOCX 文件。',true);setBusy(false);return;}
  setBusy(true);status('正在本机读取文档格式…');
  try{const r=await api('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-QCU-Chat-Allowed':String($('chat-allowed').checked)},body:file});documentId=r.document_id;
    $('file-state').textContent=file.name;$('document-info').hidden=false;$('document-id').textContent=documentId;
    $('overview').textContent=`${r.overview.paragraphs} 个非空段落 · ${r.overview.sections} 节`;
    $('styles-list').replaceChildren(...r.overview.styles.map(s=>{const el=document.createElement('span');el.textContent=`${s.id} · ${s.paragraphs} 段`;return el;}));
    $('style-options').replaceChildren(...r.overview.styles.map(s=>{const el=document.createElement('option');el.value=s.id;el.label=s.name;return el;}));status('文档已在本机准备好。');
  }catch(e){status(e.message,true);$('file-state').textContent='文件未载入，请重新选择。';}finally{setBusy(false);}
};
$('chat-allowed').onchange=()=>{if(documentId){documentId=null;$('document-info').hidden=true;$('result').hidden=true;$('document').value='';$('file-state').textContent='授权选项已改变，请重新选择文件。';status('请重新选择文件后再检查。');setBusy(false);}};
$('rule-select').onchange=showRule;
$('edit-rule').onclick=()=>{const r=selected();if(!r)return;$('editor').hidden=false;$('rule-name').value=r.source==='personal'?r.name+'（副本）':'我的论文检查规则';$('page-fields').replaceChildren(...Object.entries(pageFields).map(([k,v])=>field(k,v,r.page[k])));$('style-fields').replaceChildren();for(const [sid,spec] of Object.entries(r.styles))addStyle(sid,spec);};
$('add-style').onclick=()=>addStyle();$('cancel-edit').onclick=()=>{$('editor').hidden=true;};
$('rule-form').onsubmit=async event=>{event.preventDefault();if(busy)return;const styles={};for(const row of $('style-fields').children){const sid=row.querySelector('.style-id').value.trim();if(!sid||Object.hasOwn(styles,sid)){status('样式编号不能为空或重复。',true);return;}styles[sid]=values(row);}
  const r={id:'new',name:$('rule-name').value.trim(),version:'1',source:'personal',page:values($('page-fields')),styles};
  setBusy(true);try{const saved=await api('/api/rules',jsonPost(r));await loadRules(saved.id);$('editor').hidden=true;status('已另存为个人规则，原规则保持不变。');}catch(e){status(e.message,true);}finally{setBusy(false);}
};
$('run').onclick=async()=>{if(!documentId||busy)return;setBusy(true);$('run').textContent='正在检查…';$('run').setAttribute('aria-busy','true');$('result').hidden=true;$('counts').replaceChildren();$('open-report').removeAttribute('href');$('download-report').removeAttribute('href');status('正在按所选规则检查，请稍候…');
  try{const r=await api('/api/run',jsonPost({document_id:documentId,rule_id:$('rule-select').value}));$('counts').replaceChildren(...Object.entries({passed:'符合所选规则',failed:'不符合所选规则',unknown:'需人工确认'}).map(([key,label])=>{const card=document.createElement('div');card.className='metric';const count=document.createElement('strong');count.textContent=r.counts[key];const text=document.createElement('span');text.textContent=label;card.append(count,text);return card;}));$('open-report').href=r.report_url;$('download-report').href=r.report_url+'/download';$('result').hidden=false;status('检查完成，报告已生成。请查看下方结果及未检查范围。');reveal($('result'));}catch(e){status('检查未完成：'+e.message+' 请重试。',true);reveal($('status'));}finally{$('run').textContent='开始检查';$('run').setAttribute('aria-busy','false');setBusy(false);}
};
loadRules().catch(e=>status(e.message,true));
