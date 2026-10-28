// Generated official lazy-CJS Client; shared host React only.
window.__ModuleLoader__.load({id:'qcu-course-workbench',factory(require){
const React=require('react');
// Shared, dependency-free contract. Never accepts a filesystem path or executable model output.
const VERSION='0.1.0-pilot.1.3.font.1'
const PROTOCOL=3
const OUTPUT_BUDGET=12000
// Detached, bounded capability facts only; provider descriptions never cross this boundary.
function parsePolicy(raw){
 exact(raw,['effort','supportedEfforts','defaultEffort','outputBudget'])
 const effortId=v=>{check(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v),'invalid-model-policy');return v}
 check(['low','off','default'].includes(raw.effort)&&raw.outputBudget===OUTPUT_BUDGET,'invalid-model-policy')
 check(Array.isArray(raw.supportedEfforts)&&raw.supportedEfforts.length<=32&&new Set(raw.supportedEfforts).size===raw.supportedEfforts.length,'invalid-model-policy')
 const supportedEfforts=raw.supportedEfforts.map(effortId).sort(),defaultEffort=raw.defaultEffort===null?null:effortId(raw.defaultEffort)
 check(defaultEffort===null||supportedEfforts.includes(defaultEffort),'invalid-model-policy')
 const effort=supportedEfforts.includes('low')?'low':supportedEfforts.includes('off')?'off':'default'
 check(raw.effort===effort,'invalid-model-policy')
 return {effort,supportedEfforts,defaultEffort,outputBudget:OUTPUT_BUDGET}
}
function policyFor(info){return parsePolicy({effort:info.reasoning?.efforts.some(e=>e.id==='low')?'low':info.reasoning?.efforts.some(e=>e.id==='off')?'off':'default',supportedEfforts:info.reasoning?.efforts.map(e=>e.id)??[],defaultEffort:info.reasoning?.defaultEffort??null,outputBudget:OUTPUT_BUDGET})}
function parseRoute(raw,requirePolicy=false){
 exact(raw,['provider','model','policy'])
 const route={provider:text(raw.provider,200,true),model:text(raw.model,200,true)}
 check(!requirePolicy||raw.policy!==undefined,'model-policy-unavailable')
 return {...route,...(raw.policy===undefined?{}:{policy:parsePolicy(raw.policy)})}
}
const sameRoute=(a,b)=>{try{return JSON.stringify(parseRoute(a,true))===JSON.stringify(parseRoute(b,true))}catch{return false}}
const policyLabel=(policy,lang='en')=>{
 try{const p=parsePolicy(policy);return p.effort==='low'?(lang==='zh'?'低推理（low）':'Low reasoning (low)'):p.effort==='off'?(lang==='zh'?'关闭推理（off）':'Reasoning off (off)'):(lang==='zh'?'适配器默认推理策略':'Adapter default reasoning policy')+(p.defaultEffort?' ('+p.defaultEffort+')':lang==='zh'?'（强度未声明）':' (effort unspecified)')}catch{return lang==='zh'?'推理策略不可用，请重新连接':'Reasoning policy unavailable; reconnect'}
}
const DIAGNOSTIC_COUNTER_MAX=1000000000
const MODEL_FAILURES=Object.freeze(['model-max-tokens','model-provider-error','model-provider-aborted','model-missing-finish','model-unknown-finish','model-unexpected-blocks','invalid-model-json','output-too-large','model-stream-failed'])
// Exact provider-neutral codes audited in official transport/error/adapter normalization.
const FAILURE_CODES=Object.freeze(['AUTH','QUOTA','RATE_LIMIT','INVALID_REQUEST','SERVER','CONTEXT_WINDOW_EXCEEDED','ABORTED','UNKNOWN'])
const safeFailureCode=value=>FAILURE_CODES.includes(value)?value:undefined
// Shared persistence/transport/render boundary: copy only fixed enums and bounded integers.
function safeDiagnostic(value){
 if(!value||typeof value!=='object'||!['stream','assembly','json'].includes(value.stage)||!MODEL_FAILURES.includes(value.reason)||!['stop','tool-calls','max-tokens','aborted','error','missing','unknown'].includes(value.finishKind)||value.outputBudget!==OUTPUT_BUDGET)return
 const result={stage:value.stage,reason:value.reason,finishKind:value.finishKind,outputBudget:OUTPUT_BUDGET}
 for(const key of ['chunks','textChars','reasoningChars','streamChars']){const n=value[key];if(!Number.isSafeInteger(n)||n<0||n>DIAGNOSTIC_COUNTER_MAX)return;result[key]=n}
 const failureCode=safeFailureCode(value.failureCode)
 if(failureCode&&((value.reason==='model-provider-error'&&value.finishKind==='error')||(value.reason==='model-provider-aborted'&&value.finishKind==='aborted')||value.reason==='model-stream-failed'))result.failureCode=failureCode
 return result
}
const targetTitles={stage:'Stage · 学段',pathway:'Pathway · 课程路径',alignment_framework:'Alignment framework · 对标框架',competency_tags:'Competencies · 能力维度',bloom_level:'Bloom level · 布鲁姆层级',big_idea:'Big idea · 核心概念',think_skill:'Thinking tool · 思维工具',values_focus:'Values · 价值品格',real_world_link:'Real-world link · 真实情境',career_link:'Career link · 生涯关联',assessment_evidence:'Assessment evidence · 评价证据'}
const targetValue=v=>({concept:'Conceptual understanding · 概念理解',skill:'Skills · 技能操作',thinking:'Thinking · 思维素养',language:'Academic language · 学术表达',values:'Values · 价值品格',career:'Career awareness · 生涯认知',igcse:'IGCSE','a-level':'A-Level',ib:'IB',ap:'AP',mcaa:'MCAA'}[v]??String(v).replaceAll('-',' '))
const COMPONENTS=Object.freeze([
 ['ppt','PPT Courseware','PPT 教学课件','pptx',false],['html','HTML Flipbook','HTML 翻页课件','html',false],
 ['inter','Interactive Quiz','互动课件','html',false],['geo','Interactive Geometry','交互几何演示','html',true],
 ['func','Function Graph','函数图像演示','html',true],['cards','Revision Cards','复习卡片','html',false],
 ['guide','Student Worksheet','导学案','docx',false],['board','Board Plan','板书设计图','html',true],
 ['mind','Mind Map','思维导图','html',false],['micro','Micro-lesson Script','微课脚本','docx',true],
 ['hw','Differentiated Homework','分层作业','docx',false],['ticket','Exit Ticket','退出检测单','docx',false],
 ['mistake','Common Mistakes','易错点提示卡','html',true],['culture','Maths in Context','数学文化素材','docx',true],
].map(([id,en,zh,format,experimental])=>Object.freeze({id,en,zh,format,experimental})))
const FRAMEWORK=Object.freeze({
 stage:['lower-secondary','igcse','a-level','foundation'],pathway:['general','igcse','a-level','ib','ap','mcaa'],
 alignment_framework:['school','cambridge','ib','ap','portfolio'],competency_tags:['concept','skill','thinking','language','values','career'],
 bloom_level:['remember','understand','apply','analyse','evaluate','create'],
 think_skill:['compare','classify','sequence','cause-effect','part-whole','analogy','evidence','perspectives','decision','reflection'],
 values_focus:['respect','integrity','responsibility','kindness','courage','curiosity','resilience','collaboration','empathy','fairness','inclusion','service','independence','humility','creativity','excellence','sustainability'],
 assessment_evidence:['observation','dialogue','written','performance','self-assessment','portfolio'],
})
const check=(ok,code='invalid-input')=>{if(!ok){const e=Error(code);e.code=code;throw e}}
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
function exact(v,keys){check(record(v)&&Object.keys(v).every(k=>keys.includes(k)),'invalid-fields');return v}
function text(v,max=1000,required=false){check(typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)&&(!required||v.trim().length),'invalid-text');return v.trim()}
function id(v,prefix){check(typeof v==='string'&&new RegExp('^'+prefix+'_[a-f0-9]{32}$').test(v),'invalid-id');return v}
const one=(v,values)=>{check(values.includes(v),'invalid-enum');return v}
const many=(v,values,max=20)=>{check(Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length,'invalid-list');return v.map(x=>one(x,values))}
function profile(raw={}){
 exact(raw,['school','stages','pathways','alignments','competencies','careerLinkRequired'])
 const result={school:text(raw.school??'Course Design Studio',120,true),careerLinkRequired:raw.careerLinkRequired??false}
 check(typeof result.careerLinkRequired==='boolean')
 for(const [key,source] of [['stages','stage'],['pathways','pathway'],['alignments','alignment_framework'],['competencies','competency_tags']]){
  result[key]=many(raw[key]??(key==='pathways'?FRAMEWORK[source].filter(v=>!['ap','mcaa'].includes(v)):key==='alignments'?FRAMEWORK[source].filter(v=>!['ap','portfolio'].includes(v)):FRAMEWORK[source]),FRAMEWORK[source])
  check(result[key].length>0,'empty-profile')
 }
 return result
}
function parseInput(raw,p=profile()){
 const keys=['topic','context','minutes','language','components','notes',...Object.keys(FRAMEWORK),'big_idea','real_world_link','career_link']
 exact(raw,keys)
 const value={topic:text(raw.topic,160,true),context:text(raw.context,2000),minutes:raw.minutes,language:one(raw.language,['en','zh','bilingual']),components:many(raw.components,COMPONENTS.map(c=>c.id),14),notes:text(raw.notes,2000)}
 check(Number.isInteger(value.minutes)&&value.minutes>=10&&value.minutes<=240&&value.components.length>0,'invalid-lesson')
 for(const [key,values] of Object.entries(FRAMEWORK))value[key]=Array.isArray(raw[key])?many(raw[key],values):one(raw[key],values)
 for(const key of ['competency_tags','values_focus','assessment_evidence'])check(Array.isArray(value[key])&&value[key].length>0,'missing-targets')
 for(const key of ['stage','pathway','alignment_framework','bloom_level','think_skill'])check(typeof value[key]==='string','invalid-target')
 check(p.stages.includes(value.stage)&&p.pathways.includes(value.pathway)&&p.alignments.includes(value.alignment_framework)&&value.competency_tags.every(v=>p.competencies.includes(v)),'disabled-target')
 for(const key of ['big_idea','real_world_link','career_link'])value[key]=text(raw[key],300,key==='big_idea'||(key==='career_link'&&p.careerLinkRequired))
 return value
}
function parseDraft(raw,input){
 exact(raw,['title','intentions','criteria','vocabulary','sequence','components','quiz','graph','geometry'])
 const strings=(v,max=20)=>{check(Array.isArray(v)&&v.length>0&&v.length<=max,'invalid-draft');return v.map(s=>text(s,2000,true))}
 const d={title:text(raw.title,240,true),intentions:strings(raw.intentions),criteria:strings(raw.criteria),vocabulary:strings(raw.vocabulary),sequence:[] ,components:[]}
 check(Array.isArray(raw.sequence)&&raw.sequence.length>0&&raw.sequence.length<=12,'invalid-sequence')
 d.sequence=raw.sequence.map(s=>{exact(s,['title','minutes','teacher','student','evidence']);check(Number.isInteger(s.minutes)&&s.minutes>0&&s.minutes<=240);return {title:text(s.title,240,true),minutes:s.minutes,teacher:text(s.teacher,2000,true),student:text(s.student,2000,true),evidence:text(s.evidence,1000,true)}})
 check(d.sequence.reduce((n,s)=>n+s.minutes,0)===input.minutes,'invalid-timing')
 check(Array.isArray(raw.components)&&raw.components.length===input.components.length,'missing-components')
 const seen=new Set()
 d.components=raw.components.map(c=>{exact(c,['id','title','sections']);one(c.id,input.components);check(!seen.has(c.id),'duplicate-component');seen.add(c.id);check(Array.isArray(c.sections)&&c.sections.length>0&&c.sections.length<=12);return {id:c.id,title:text(c.title,240,true),sections:c.sections.map(s=>{exact(s,['heading','body']);return {heading:text(s.heading,240,true),body:text(s.body,6000,true)}})}})
 if(input.components.includes('inter')){
  check(Array.isArray(raw.quiz)&&raw.quiz.length>0&&raw.quiz.length<=10,'missing-quiz')
  d.quiz=raw.quiz.map(q=>{exact(q,['question','options','answer','explanation']);check(Array.isArray(q.options)&&q.options.length===4&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);return {question:text(q.question,1500,true),options:q.options.map(o=>text(o,500,true)),answer:q.answer,explanation:text(q.explanation,1500,true)}})
 }
 if(input.components.includes('func')){exact(raw.graph,['a','b','c','caption']);for(const k of ['a','b','c'])check(Number.isFinite(raw.graph[k])&&Math.abs(raw.graph[k])<=10);d.graph={a:raw.graph.a,b:raw.graph.b,c:raw.graph.c,caption:text(raw.graph.caption,600,true)}}
 if(input.components.includes('geo')){exact(raw.geometry,['points','caption']);check(Array.isArray(raw.geometry.points)&&raw.geometry.points.length===3);check(raw.geometry.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=5&&n<=95)));d.geometry={points:raw.geometry.points,caption:text(raw.geometry.caption,600,true)}}
 check(JSON.stringify(d).length<=180000,'draft-too-large');return d
}
const codec=(symbol,max)=>({mode:'strict',typeSymbol:'qcu-course-workbench#'+symbol,create:()=>({parse(value){check(typeof value==='string'&&value.length<=max,'wire-size');JSON.parse(value);return value}})})
const remoteContribution={package:'qcu-course-workbench',descriptors:[{id:'qcu-course-workbench#qcuCourse/dispatch',service:'qcuCourse',namespace:'qcuCourse',method:'dispatch',invocation:{kind:'direct'},parameters:[{name:'payload',wire:'payload',source:'json',codec:codec('Request',12000000)}],cancellation:{parameter:'signal'},result:codec('Reply',1500000)}]}

// Trusted offline templates. Model data is always escaped, never executed as HTML or JavaScript.
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function artifactHtml(task,component){
 const d=task.draft,c=d.components.find(c=>c.id===component),data=JSON.stringify({quiz:d.quiz,graph:d.graph,geometry:d.geometry,mind:component==='mind'?{title:task.input.topic,branches:c.sections.map(s=>s.heading)}:null}).replaceAll('<','\\u003c')
 const sections=c?c.sections:[{heading:'Learning intentions · 学习目标',body:d.intentions.join('\n')},{heading:'Success criteria · 成功标准',body:d.criteria.join('\n')},{heading:'Vocabulary · 关键词',body:d.vocabulary.join('\n')},...d.sequence.map(s=>({heading:s.title+' · '+s.minutes+' min',body:s.teacher+'\n\n'+s.student+'\n\n'+s.evidence}))]
 const caption=component==='func'?d.graph?.caption:component==='geo'?d.geometry?.caption:''
 const script=`const data=${data};
const sections=[...document.querySelectorAll('main>section')];let page=0;
if(data.mind){const svg=document.getElementById('mind-map'),ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);svg.append(node);return node};const node=(cx,cy,label)=>{make('rect',{x:cx-88,y:cy-24,width:176,height:48,rx:12,fill:'#e4f2eb',stroke:'#35795f'});const text=make('text',{x:cx,y:cy,'text-anchor':'middle','dominant-baseline':'middle','font-size':13,fill:'#24483e'});text.textContent=label.length>24?label.slice(0,23)+'…':label};data.mind.branches.forEach((label,i)=>{const angle=2*Math.PI*i/data.mind.branches.length,cx=450+280*Math.cos(angle),cy=300+220*Math.sin(angle);make('line',{x1:450,y1:300,x2:cx,y2:cy,stroke:'#7fbca6','stroke-width':2});node(cx,cy,label)});node(450,300,data.mind.title)}
function show(){sections.forEach((s,i)=>s.hidden=i!==page);document.getElementById('counter').textContent=(page+1)+' / '+sections.length}
if(document.getElementById('next')){document.getElementById('prev').onclick=()=>{page=Math.max(0,page-1);show()};document.getElementById('next').onclick=()=>{page=Math.min(sections.length-1,page+1);show()};show()}
if(data.quiz&&document.getElementById('quiz')){const root=document.getElementById('quiz');for(const q of data.quiz){const section=document.createElement('section'),h=document.createElement('h2'),feedback=document.createElement('p');h.textContent=q.question;section.append(h);q.options.forEach((o,i)=>{const b=document.createElement('button');b.textContent=o;b.onclick=()=>{feedback.textContent=(i===q.answer?'✓ Correct · 正确: ':'Try again · 再想想: ')+q.explanation;feedback.setAttribute('role','status')};section.append(b)});section.append(feedback);root.append(section)}}
if(data.graph&&document.getElementById('graph')){const g={...data.graph},poly=document.getElementById('curve'),label=document.getElementById('equation');function draw(){let points=[];for(let px=0;px<=600;px+=2){const x=(px-300)/30,y=g.a*x*x+g.b*x+g.c;points.push(px+','+(180-y*15))}poly.setAttribute('points',points.join(' '));label.textContent='y = '+g.a+'x² + '+g.b+'x + '+g.c}for(const key of ['a','b','c']){const el=document.getElementById('coefficient-'+key);el.value=g[key];el.oninput=()=>{g[key]=Number(el.value);draw()}}draw()}
if(data.geometry&&document.getElementById('geometry')){const svg=document.getElementById('geometry'),polygon=document.getElementById('triangle'),points=data.geometry.points.map(p=>p.slice());const ns='http://www.w3.org/2000/svg';function draw(){polygon.setAttribute('points',points.map(p=>p.join(',')).join(' '));svg.querySelectorAll('circle').forEach((c,i)=>{c.setAttribute('cx',points[i][0]);c.setAttribute('cy',points[i][1])})}let active=null;for(let i=0;i<3;i++){const circle=document.createElementNS(ns,'circle');circle.setAttribute('r',3);circle.setAttribute('tabindex',0);circle.setAttribute('role','slider');circle.setAttribute('aria-label','Vertex '+(i+1));circle.onpointerdown=e=>{active=i;circle.setPointerCapture(e.pointerId)};circle.onpointermove=e=>{if(active!==i)return;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());points[i]=[Math.max(5,Math.min(95,v.x)),Math.max(5,Math.min(95,v.y))];draw()};circle.onpointerup=()=>{active=null};circle.onpointercancel=()=>{active=null};circle.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();points[i]=points[i].map((n,k)=>Math.max(5,Math.min(95,n+delta[k])));draw()}};svg.append(circle)}draw()}
`
 const visual=component==='mind'?'<svg class="visual" id="mind-map" viewBox="0 0 900 600" role="img" aria-label="Knowledge mind map · 知识思维导图"></svg>':component==='func'?`<div class="visual"><p id="equation"></p>${['a','b','c'].map(k=>`<label>${k} <input aria-label="${k}" id="coefficient-${k}" type="range" min="-10" max="10" step="0.1"></label>`).join('')}<svg id="graph" viewBox="0 0 600 360" role="img" aria-label="Quadratic graph"><path d="M0 180H600 M300 0V360" stroke="#9bafa7"/><polyline id="curve" fill="none" stroke="#3e8e74" stroke-width="3"/></svg></div>`:component==='geo'?'<svg id="geometry" viewBox="0 0 100 100" role="group" aria-label="Draggable triangle"><polygon id="triangle" fill="#a9d8c9" stroke="#35795f" stroke-width="0.7"/></svg>':''
 return `<!doctype html><html lang="${task.input.language==='zh'?'zh':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'"><title>${escape(c?.title??d.title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#fdf8f1;color:#4a3c2e;font:16px/1.7 system-ui,sans-serif}header,main,footer,.visual,#quiz{max-width:1000px;margin:0 auto;padding:24px}header{border-bottom:1px solid #e4dccc}h1{font-size:30px;line-height:1.3}h2{font-size:22px;color:#35795f}section{background:white;border:1px solid #e4dccc;border-radius:14px;padding:24px;margin:12px 0}section[hidden]{display:none}p{white-space:pre-wrap;overflow-wrap:anywhere}.draft{font-size:13px;color:#805a29}button{background:#35795f;color:white;border:0;border-radius:8px;padding:10px 18px;margin:5px;cursor:pointer;font:inherit}button:focus-visible,circle:focus-visible{outline:3px solid #d29435}nav{text-align:center}svg{display:block;max-width:100%;background:white;border-radius:12px}#geometry{width:520px;max-height:60vh;margin:20px auto;touch-action:none}circle{fill:#3e8e74;stroke:white;stroke-width:1;cursor:grab}label{display:inline-flex;gap:8px;padding:12px}footer{font-size:12px;color:#766a5b}.mind main,.board main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.cards main{max-width:500px}.cards section{min-height:420px}.board section{background:#24483e;color:white}.board h2{color:#a9d8c9}@media print{nav,button,input{display:none}section[hidden]{display:block}section{break-inside:avoid}body{background:white}}
</style></head><body class="${escape(component)}"><header><div class="draft">DRAFT · 教师审核草案</div><h1>${escape(c?.title??d.title)}</h1><p>${escape(task.input.topic)} · ${task.input.minutes} min</p><small>${escape(targetValue(task.input.stage))} / ${escape(targetValue(task.input.pathway))} · ${escape(task.input.competency_tags.map(targetValue).join(' · '))}</small></header>${visual}${caption?'<p style="max-width:950px;margin:auto;padding:20px">'+escape(caption)+'</p>':''}<main>${sections.map(s=>'<section><h2>'+escape(s.heading)+'</h2><p>'+escape(s.body)+'</p></section>').join('')}</main>${['ppt','html','cards'].includes(component)?'<nav aria-label="Pages"><button id="prev">← Previous</button><span id="counter" aria-live="polite"></span><button id="next">Next →</button></nav>':''}${component==='inter'?'<div id="quiz"></div>':''}<footer>Teacher review required: knowledge, worked answers, accessibility, curriculum alignment and source rights. 教师须核实知识、答案、适用性和来源。<br>${escape(task.input.big_idea)}</footer><script>${script}</script></body></html>`
}

const styles=`
.qcu-course{--qcu-course-font:var(--dsh-content-font-size,14px);--bg:#fdf8f1;--card:#fff;--soft:#faf4e9;--line:rgba(90,74,58,.16);--ink:#4a3c2e;--body:#6e6052;--accent:#35795f;--mint:#e4f2eb;color:var(--ink);background:var(--bg);font:var(--qcu-course-font)/1.6 var(--dsw-font-family,system-ui,sans-serif);height:100%;min-width:0;max-width:100%;overflow:auto;container-type:inline-size}
.qcu-course *{box-sizing:border-box}.qcu-course button,.qcu-course input,.qcu-course textarea,.qcu-course select{font:inherit}.qcu-course button{cursor:pointer}.qcu-course button:disabled{opacity:.5;cursor:wait}.qcu-course :focus-visible{outline:3px solid #c39337;outline-offset:2px}.qcu-course .studio{max-width:1220px;margin:auto;padding:26px 30px 60px}.qcu-course header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-bottom:22px;border-bottom:1px solid var(--line)}.qcu-course .logo{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#7fc8ae,#3e8e74);color:white;display:grid;place-items:center;font-size:25px}.qcu-course h1{font-size:calc(var(--qcu-course-font) * 22 / 14);line-height:1.3;margin:0}.qcu-course h2{font-size:calc(var(--qcu-course-font) * 18 / 14);margin:0 0 8px}.qcu-course h3{font-size:calc(var(--qcu-course-font) * 15 / 14);margin:0 0 8px}.qcu-course p{margin:5px 0 14px}.qcu-course .muted{color:var(--body);font-size:calc(var(--qcu-course-font) * 12 / 14)}.qcu-course .grow{flex:1;min-width:0}.qcu-course .badge{color:var(--accent);border:1px solid var(--line);border-radius:20px;padding:4px 12px;background:var(--mint);font-size:calc(var(--qcu-course-font) * 12 / 14)}.qcu-course .btn{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 14px;border-radius:9px;line-height:1.5}.qcu-course .primary{background:#3e8e74;color:white;border-color:#3e8e74}.qcu-course .ghost{background:transparent}.qcu-course .btn:hover:not(:disabled){border-color:var(--accent);filter:brightness(.98)}.qcu-course .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.qcu-course .layout{display:grid;grid-template-columns:225px minmax(0,1fr);gap:24px;margin-top:24px}.qcu-course aside{min-width:0}.qcu-course .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:18px;box-shadow:0 2px 6px #5a4a3a06}.qcu-course .course-list{display:flex;flex-direction:column;gap:7px;margin:14px 0}.qcu-course .course-item{text-align:left;width:100%;overflow-wrap:anywhere}.qcu-course .selected{border-color:var(--accent);background:var(--mint);color:var(--accent)}.qcu-course .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.qcu-course .step{text-align:left;min-height:67px}.qcu-course .step small{display:block;font-size:calc(var(--qcu-course-font) * 10 / 14);letter-spacing:1px;color:var(--body)}.qcu-course .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin:18px 0}.qcu-course label.field{display:flex;flex-direction:column;gap:5px;color:var(--accent);font-size:calc(var(--qcu-course-font) * 12 / 14)}.qcu-course input:not([type=checkbox]),.qcu-course textarea,.qcu-course select{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:9px 11px;min-height:39px;font-size:var(--qcu-course-font)}.qcu-course textarea{min-height:90px;resize:vertical}.qcu-course .wide{grid-column:1/-1}.qcu-course fieldset{border:0;padding:0;margin:16px 0}.qcu-course legend{font-weight:600;margin-bottom:7px}.qcu-course .chips{display:flex;gap:7px;flex-wrap:wrap}.qcu-course .chip{display:flex;gap:7px;align-items:center;font-size:calc(var(--qcu-course-font) * 12 / 14);border:1px solid var(--line);border-radius:20px;padding:5px 10px;background:var(--soft)}.qcu-course input[type=checkbox]{accent-color:#3e8e74;width:15px;height:15px;flex-shrink:0}.qcu-course .filebox{border:1.5px dashed #7fbca6;border-radius:12px;padding:20px;background:var(--mint);margin:14px 0}.qcu-course .reference{display:flex;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding:10px 0;overflow-wrap:anywhere}.qcu-course .components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin:18px 0}.qcu-course .component{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--soft);cursor:pointer}.qcu-course .component.on{border-color:var(--accent);background:var(--mint)}.qcu-course .component strong{font-size:calc(var(--qcu-course-font) * 13 / 14)}.qcu-course .experimental{font-size:calc(var(--qcu-course-font) * 10 / 14);color:#8a5a23;background:#f8e6a6;padding:1px 6px;border-radius:5px;margin-left:5px}.qcu-course .status{border:1px solid #90bfad;background:var(--mint);padding:13px 16px;border-radius:10px;margin:14px 0;overflow-wrap:anywhere}.qcu-course .error{border-color:#d89082;background:#fae8e4;color:#873e31}.qcu-course .review-nav{display:flex;gap:7px;overflow:auto;padding:5px 0 14px}.qcu-course .review-nav button{white-space:nowrap}.qcu-course iframe{width:100%;height:550px;border:1px solid var(--line);border-radius:12px;background:white}.qcu-course details{margin:12px 0}.qcu-course summary{cursor:pointer;color:var(--accent)}.qcu-course .save-review{border:1px solid var(--accent);background:var(--soft);border-radius:12px;padding:18px;margin:16px 0;overflow-wrap:anywhere}.qcu-course code{font-size:calc(var(--qcu-course-font) * 12 / 14);overflow-wrap:anywhere;white-space:normal}.qcu-course .empty{padding:48px 24px;text-align:center}.qcu-course .empty .big{font-size:38px;margin-bottom:12px}.qcu-course .task-button{display:block;text-align:left;width:100%;margin:7px 0;font-size:calc(var(--qcu-course-font) * 12 / 14)}.qcu-course .consent{display:flex;gap:9px;align-items:flex-start;padding:14px 0}.qcu-course .footer{border-top:1px solid var(--line);padding-top:15px;color:var(--body);font-size:calc(var(--qcu-course-font) * 11 / 14);margin-top:20px}
.qcu-course .draft-editor .field{margin:10px 0}.qcu-course .editor-section{border-top:1px solid var(--line);padding:10px 0}.qcu-course .draft-editor fieldset{border:1px solid var(--line);padding:12px;border-radius:10px;min-width:0}.qcu-course .draft-editor textarea{min-height:72px}
.qcu-course .layout>main,.qcu-course .layout>aside{min-width:0;max-width:100%}.qcu-course .steps{grid-template-columns:repeat(3,minmax(0,1fr))}.qcu-course .step,.qcu-course h1,.qcu-course h2,.qcu-course p{overflow-wrap:anywhere}
body[data-ds-dark-theme] .qcu-course,html[data-theme=dark] .qcu-course,html.dark .qcu-course{--qcu-course-font:var(--dsh-content-font-size,14px);--bg:#252a27;--card:#303732;--soft:#373d35;--line:#4d594e;--ink:#f1eadc;--body:#c2bcae;--accent:#9cd5bb;--mint:#344b40}.qcu-course .error{color:#873e31}.qcu-course .experimental{color:#624514}
@container(max-width:850px){.qcu-course .studio{padding:18px}.qcu-course .layout{grid-template-columns:1fr}.qcu-course aside .card{padding:15px}.qcu-course .course-list{flex-direction:row;overflow:auto}.qcu-course .course-item{min-width:150px}}
@container(max-width:540px){.qcu-course header>.logo{flex:none}.qcu-course header>.grow{flex:1 0 calc(100% - 60px)}.qcu-course .form-grid,.qcu-course .components{grid-template-columns:1fr}.qcu-course .steps{gap:6px}.qcu-course .step{padding:8px;font-size:calc(var(--qcu-course-font) * 11 / 14)}.qcu-course h1{font-size:calc(var(--qcu-course-font) * 20 / 14)}.qcu-course .card{padding:16px}.qcu-course iframe{height:480px}}
`

const clientId=prefix=>prefix+'_'+globalThis.crypto.randomUUID().replaceAll('-','')
class CourseController{
 constructor(remote,{sessionId=clientId('session'),lookupMs=6000}={}){this.remote=remote;this.sessionId=sessionId;this.lookupMs=lookupMs;this.listeners=new Set();this.state={phase:'idle',connection:'connecting',connectionError:'',modelStatus:'loading',workspaceId:'',courseId:'',snapshot:null,task:null,error:'',runtime:null,saveReview:null,saved:null,localEdits:false,originalSave:null};this.generation=0;this.bootGeneration=0;this.saveGeneration=0;this.pending=false;this.timer=null;this.disposed=false;this.request=null;this.saveRequest=null;this.saveResolved=false;this.confirmedModel=null}
 snapshot=()=>this.state
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 set(patch){if(this.disposed)return;if(patch.runtime&&!sameRoute(this.state.runtime?.model,patch.runtime.model))this.confirmedModel=null;this.state={...this.state,...patch};for(const fn of this.listeners)fn()}
 async call(request,workspaceId=this.state.workspaceId,signal){
  const raw=await this.remote.dispatch(JSON.stringify(workspaceId?{workspaceId,request,...(request.action==='generate'?{expectedModel:this.confirmedModel}:{})}:request),signal)
  if(!raw?.ok)throw Error('connection-unavailable')
  const result=JSON.parse(raw.value);if(!result.ok){const e=Error(result.error);e.definite=true;throw e}return Object.hasOwn(result,'value')?result.value:result
 }
 async lookup(action,signal){
  let timer,listener
  try{return await Promise.race([this.call({action},'',signal),new Promise((_,reject)=>{listener=()=>reject(Error('connection-unavailable'));signal.addEventListener('abort',listener,{once:true});timer=setTimeout(()=>reject(Error('connection-unavailable')),this.lookupMs);if(signal.aborted)listener()})])}
  finally{clearTimeout(timer);signal.removeEventListener('abort',listener)}
 }
 async boot(){
  if(this.disposed)return;this.bootAbort?.abort();const abort=new AbortController(),n=++this.bootGeneration;this.bootAbort=abort;this.confirmedModel=null
  this.set({connection:'connecting',connectionError:'',modelStatus:'loading',runtime:this.state.runtime?{...this.state.runtime,model:null,policyError:undefined}:null})
  try{
   const runtime=await this.lookup('workspaces',abort.signal);check(runtime.protocol===PROTOCOL&&runtime.version===VERSION,'runtime-mismatch')
   if(this.disposed||n!==this.bootGeneration)return
   this.set({runtime:{...runtime,model:null},connection:'ready'})
   // Independent, bounded, read-only capability lookup. Browsing is ready now.
   void this.loadModel(n,abort)
  }catch(e){abort.abort();if(n===this.bootGeneration&&!this.disposed)this.set({connection:'unavailable',connectionError:e.message,modelStatus:'unavailable'})}
 }
 async loadModel(n,abort){
  try{const result=await this.lookup('model',abort.signal);if(n!==this.bootGeneration||this.disposed)return;const model=result.model?parseRoute(result.model,true):null;this.set({runtime:{...this.state.runtime,model,policyError:result.policyError},modelStatus:model?'ready':'unavailable'})}
  catch{if(n===this.bootGeneration&&!this.disposed)this.set({runtime:{...this.state.runtime,model:null,policyError:'model-policy-unavailable'},modelStatus:'unavailable'})}
  finally{if(n===this.bootGeneration)abort.abort()}
 }
 clearSave(){++this.saveGeneration;this.set({saveReview:null,saved:null})}
 localEdit(pending=true){this.clearSave();this.set({localEdits:pending})}
 component(){this.clearSave()}
 unresolvedSave(){return !!this.saveRequest&&!this.saveResolved}
 async workspace(workspaceId){
  if(this.pending)return;this.stopPoll();const n=++this.generation;this.confirmedModel=null;this.clearSave();this.set({workspaceId,courseId:'',snapshot:null,task:null,error:'',localEdits:false,phase:workspaceId?'loading':'idle'});this.request=null
  if(!workspaceId)return
  try{const snapshot=await this.call({action:'snapshot'},workspaceId);if(n===this.generation)this.set({snapshot,courseId:snapshot.courses[0]?.id??'',phase:'idle'})}catch(e){if(n===this.generation)this.set({phase:'unavailable',error:e.message})}
 }
 async refresh(){const n=this.generation,snapshot=await this.call({action:'snapshot'});if(n===this.generation)this.set({snapshot});return snapshot}
 course(courseId){if(this.pending)return;this.stopPoll();++this.generation;this.request=null;this.confirmedModel=null;this.clearSave();this.set({courseId,task:null,localEdits:false,error:'',phase:'idle'})}
 async perform(fn){if(this.pending||this.disposed)return;this.pending=true;const n=this.generation;this.set({error:''});try{return await fn()}catch(e){if(n===this.generation)this.set({error:e.message});throw e}finally{this.pending=false}}
 async createCourse(name){return this.perform(async()=>{const n=this.generation,c=await this.call({action:'createCourse',requestId:clientId('request'),name});if(n!==this.generation)return;await this.refresh();if(n!==this.generation)return;this.stopPoll();++this.generation;this.request=null;this.confirmedModel=null;this.clearSave();this.set({courseId:c.id,task:null,localEdits:false,phase:'idle'});return c})}
 async addReference(file){return this.perform(async()=>{check(file.size<=8*1024*1024,'file-too-large');const bytes=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));const r=await this.call({action:'addReference',courseId:this.state.courseId,requestId:clientId('request'),name:file.name,base64:btoa(str)});await this.refresh();return r})}
 async removeReference(referenceId){return this.perform(async()=>{await this.call({action:'removeReference',courseId:this.state.courseId,referenceId});await this.refresh()})}
 confirmModel(consent){this.confirmedModel=consent?parseRoute(this.state.runtime?.model,true):null}
 async generate(input,referenceIds,consent){
  return this.perform(async()=>{
   check(consent===true&&sameRoute(this.confirmedModel,this.state.runtime?.model),'model-consent-required')
   this.stopPoll();const n=++this.generation
   const body={courseId:this.state.courseId,sessionId:this.sessionId,input,referenceIds,consent},fingerprint=JSON.stringify({...body,model:this.confirmedModel})
   if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,body:{action:'generate',...body,requestId:clientId('request')}}
   this.clearSave();this.set({phase:'running',task:null,localEdits:false})
   try{const task=await this.call(this.request.body);if(n!==this.generation)return;this.set({task,phase:task.state});await this.refresh();if(n===this.generation&&['running','cancelling'].includes(task.state))this.poll()}
   catch(e){if(n===this.generation)this.set({phase:e.definite?'failed':'unknown',error:e.message});throw e}
  })
 }
 async openTask(taskId){return this.perform(async()=>{this.stopPoll();const n=++this.generation;this.confirmedModel=null;this.clearSave();this.set({task:null,localEdits:false,phase:'loading'});try{const task=await this.call({action:'task',courseId:this.state.courseId,taskId});if(n!==this.generation)return;this.set({task,phase:task.state});if(['running','cancelling'].includes(task.state))this.poll()}catch(e){if(n===this.generation)this.set({phase:'unavailable',error:e.message});throw e}})}
 stopPoll(){clearTimeout(this.timer);this.timer=null}
 poll(){this.stopPoll();if(!this.disposed)this.timer=setTimeout(()=>void this.reconcile().catch(()=>{}),700)}
 async reconcile(){
  let task=this.state.task;const n=this.generation
  try{if(!task&&this.request){const snapshot=await this.refresh();if(n!==this.generation)return;task=snapshot.tasks.find(t=>t.requestId===this.request.body.requestId);check(task,'original-task-not-found')}if(!task)return;const next=await this.call({action:'task',courseId:task.courseId,taskId:task.id});if(n!==this.generation)return;this.set({task:next,phase:next.state,error:''});if(['running','cancelling'].includes(next.state))this.poll();else await this.refresh()}
  catch(e){if(n===this.generation){this.set({phase:task&&['succeeded','failed','cancelled','restart-required'].includes(task.state)?task.state:'unknown',error:e.message});this.stopPoll()}}
 }
 async cancel(){this.stopPoll();const t=this.state.task,n=this.generation;if(!t)return;try{const task=await this.call({action:'cancel',courseId:t.courseId,taskId:t.id});if(n!==this.generation)return;this.set({task,phase:task.state});if(task.state==='cancelling')this.poll()}catch(e){if(n===this.generation)this.set({phase:'unknown',error:e.message})}}
 async revise(draft){return this.perform(async()=>{check(!this.unresolvedSave(),'reconcile-save-first');const t=this.state.task,n=this.generation,valid=parseDraft(draft,t.input);const task=await this.call({action:'revise',courseId:t.courseId,taskId:t.id,draftHash:t.draftHash,draft:valid});if(n!==this.generation)return;this.clearSave();this.set({task,localEdits:false})})}
 async prepareSave(component){return this.perform(async()=>{check(!this.state.localEdits,'unapplied-edits');check(!this.unresolvedSave(),'reconcile-save-first');const t=this.state.task,n=this.generation,s=this.saveGeneration;const review=await this.call({action:'prepareSave',courseId:t.courseId,taskId:t.id,component,draftHash:t.draftHash});if(n!==this.generation||s!==this.saveGeneration)return;this.saveRequest=null;this.saveResolved=false;this.set({saveReview:{...review,component},saved:null})})}
 async save(mode){return this.perform(async()=>{check(!this.state.localEdits,'unapplied-edits');const t=this.state.task,r=this.state.saveReview,n=this.generation,s=this.saveGeneration;check(r&&r.draftHash===t.draftHash,'stale-preview');check(!this.unresolvedSave(),'reconcile-save-first');this.saveRequest={action:'save',courseId:t.courseId,taskId:t.id,component:r.component,draftHash:r.draftHash,artifactSha256:r.artifactSha256,existingSha256:r.existingSha256,mode,confirmed:true,saveId:clientId('save')};this.saveWorkspace=this.state.workspaceId;this.saveResolved=false;const saved=await this.call(this.saveRequest,this.saveWorkspace);this.saveResolved=true;if(n===this.generation&&s===this.saveGeneration)this.set({saved,saveReview:null});return saved})}
 async reconcileSave(){return this.perform(async()=>{check(this.saveRequest,'save-not-found');const request=this.saveRequest;const saved=await this.call({action:'saveStatus',courseId:request.courseId,saveId:request.saveId},this.saveWorkspace);if(this.saveRequest!==request)return saved;if(saved.status==='saved'||saved.status==='abandoned'){this.saveResolved=true;this.set({originalSave:saved,saveReview:null})}else this.set({originalSave:saved,error:'save-pending'});return saved})}
 async continueSave(){return this.perform(async()=>{const r=this.saveRequest;check(this.unresolvedSave()&&this.state.originalSave?.id===r.saveId&&this.state.originalSave.status==='pending','reconcile-save-first');check(!this.state.localEdits&&this.saveWorkspace===this.state.workspaceId&&r.taskId===this.state.task?.id&&r.draftHash===this.state.task?.draftHash,'stale-preview');const s=this.saveGeneration,n=this.generation,saved=await this.call(r,this.saveWorkspace);this.saveResolved=true;if(s===this.saveGeneration&&n===this.generation)this.set({saved,saveReview:null,originalSave:saved});return saved})}
 async cancelSave(){return this.perform(async()=>{if(this.unresolvedSave()){const result=await this.call({action:'abandonSave',courseId:this.saveRequest.courseId,saveId:this.saveRequest.saveId},this.saveWorkspace);this.set({originalSave:result});this.saveRequest=null;this.saveResolved=true}this.clearSave()})}
 invalidate(){this.confirmedModel=null;++this.bootGeneration;this.bootAbort?.abort();++this.generation;this.stopPoll();this.clearSave();this.set({connection:'unavailable',connectionError:'connection-reset',modelStatus:'unavailable',runtime:this.state.runtime?{...this.state.runtime,model:null}:null,phase:(!this.state.task&&this.request)||['running','cancelling'].includes(this.state.phase)?'unknown':this.state.task?.state??'idle'})}
 dispose(){this.disposed=true;this.bootAbort?.abort();this.stopPoll();this.listeners.clear();++this.generation;++this.bootGeneration}
}

const messages={
 'connection-unavailable':['The local workbench connection is unavailable. Reconnect to check it.','本地工作台连接不可用，请重新连接核对。'],'runtime-mismatch':['Host and Client versions differ. Reload the local candidate together.','Host 与 Client 版本不一致，请同时重新加载本地候选。'],
 'reference-required':['Select at least one reference.','请至少选择一份参考资料。'],'reference-expired-or-course-mismatch':['Reference expired or belongs to another course. Please select it again.','资料已过期、已使用或属于其他课程，请重新选择。'],
 'task-busy':['Another draft is still running. Wait or cancel it first.','另一个草案仍在生成，请等待或先取消。'],'stale-preview':['The draft changed. Review the latest version before saving.','草案已变化，请审阅最新版再保存。'],
 'file-changed':['The existing file changed. Review the save destination again.','目标文件已变化，请重新查看保存确认。'],'unsupported-file-use-text':['Use TXT, Markdown, CSV, DOCX or PPTX. For PDF, paste verified excerpts as text.','支持 TXT、Markdown、CSV、DOCX、PPTX；PDF 请先提供经核对的文字摘录。'],
 'unknown':['Connection or generation timed out. Check the original task; do not generate again automatically.','连接或生成超时，请核对原任务，不会自动重试。'],'restart-required':['Host restarted before confirmation. Original task will not resume. Select references again to start a new task.','Host 在结果确认前退出，原任务不会自动恢复；重新选择资料后可发起新任务。'],
 'model-not-configured':['Configure your default model in DSH Settings → Models.','请先在 DSH 设置 → 模型中配置默认模型。'],
 'model-policy-unavailable':['Reasoning capabilities are unavailable. Reconnect before confirming a new generation.','推理能力元数据不可用，请重新连接后再确认生成。'],
 'model-policy-changed':['Reasoning policy or budget changed. Reconnect, review and confirm again.','推理策略或预算已变化，请重新连接、核对并再次确认。'],
 'invalid-model-policy':['Invalid generation policy. Reconnect and confirm again.','生成策略无效，请重新连接并再次确认。'],
 'model-selection-changed':['The default model changed. Reconnect, check the displayed route and confirm generation again.','默认模型已变化，请重新连接，核对模型后再确认生成。'],
 'state-write-failed':['The local task state could not be saved. Check workspace permissions; the task is unconfirmed.','本地任务状态写入失败，请核对工作区权限；任务结果未确认。'],
 'generation-failed':['Generation failed or returned an invalid draft. Review inputs and reselect references for a new task.','生成失败或输出未通过校验；核对输入、重新选择资料后发起新任务。'],
 'model-incomplete':['This older task failed, but its exact cause was not recorded.','此历史任务生成失败，具体原因未记录。'],
 'cause-not-recorded':['Generation failed; the exact cause was not recorded.','生成失败，具体原因未记录。'],
 'model-max-tokens':['The model reported reaching its output token limit. No draft was accepted.','模型报告已达到输出令牌上限，未接受为草案。'],
 'model-provider-error':['The model service reported an error. Its underlying cause is unknown. No draft was accepted.','模型服务报告错误，底层原因尚不明确，未接受为草案。'],
 'model-provider-aborted':['The model service reported an abort without local cancellation. No draft was accepted.','模型服务报告中止，本地未发起取消，未接受为草案。'],
 'model-missing-finish':['The model stream ended without a finish record. No draft was accepted.','模型流结束时缺少结束记录，未接受为草案。'],
 'model-unknown-finish':['The model reported an unrecognized finish reason. No draft was accepted.','模型返回了未知结束原因，未接受为草案。'],
 'model-unexpected-blocks':['The model returned tools or unsupported content blocks. No draft was accepted.','模型返回了工具或不支持的内容块，未接受为草案。'],
 'invalid-model-json':['The model response was not valid JSON. No draft was accepted.','模型响应不是有效 JSON，未接受为草案。'],
 'output-too-large':['The response exceeded the local output size cap. No draft was accepted.','响应超过本地输出大小上限，未接受为草案。'],
 'model-stream-failed':['Reading or processing the model stream failed. Its underlying cause is unknown. No draft was accepted.','读取或处理模型流失败，底层原因尚不明确，未接受为草案。'],
 'invalid-timing':['Lesson stage minutes must sum to the lesson duration.','各教学环节时长之和须等于课时总长。'],
 'operation-failed':['Operation failed. Check workspace access and retry only after checking the original result.','操作失败，请核对工作区读写权限及原结果后再处理。'],
 'reconcile-save-first':['Check the original save result before preparing a different save.','请先核对原保存结果，再准备其他保存操作。'],
 'save-pending':['The save is pending. Check the original confirmation and explicitly continue the same save if needed.','原保存仍未完成，请核对原确认，必要时明确继续同一保存。'],
 'connection-reset':['Connection changed. Reconnect to check the local workbench.','连接已变化，请重新连接核对本地工作台。'],
}
const initialInput=()=>({topic:'',context:'',minutes:45,language:'bilingual',components:['guide','ticket'],notes:'',stage:'igcse',pathway:'igcse',alignment_framework:'cambridge',competency_tags:['concept','thinking'],bloom_level:'apply',big_idea:'',think_skill:'evidence',values_focus:['curiosity'],real_world_link:'',career_link:'',assessment_evidence:['written']})
const labelMap={concept:['Conceptual understanding','概念理解'],skill:['Skills','技能操作'],thinking:['Thinking','思维素养'],language:['Academic language','学术表达'],values:['Values','价值品格'],career:['Career awareness','生涯认知'], 'lower-secondary':['Lower secondary','初中'],igcse:['IGCSE','IGCSE'], 'a-level':['A-Level','A-Level'],foundation:['Foundation','预科'],general:['General','通用'],school:['School framework','学校框架'],cambridge:['Cambridge','剑桥'],ib:['IB','IB'],ap:['AP (confirm locally)','AP（需校方确认）'],mcaa:['MCAA (confirm locally)','MCAA（需校方确认）'],portfolio:['Portfolio (confirm locally)','档案袋（需校方确认）'],remember:['Remember','记忆'],understand:['Understand','理解'],apply:['Apply','应用'],analyse:['Analyse','分析'],evaluate:['Evaluate','评价'],create:['Create','创造']}
Object.assign(labelMap,{
 en:['English','英文'],zh:['Chinese','中文'],bilingual:['English + Chinese','英中双语'],compare:['Compare','比较'],classify:['Classify','分类'],sequence:['Sequence','排序'],'cause-effect':['Cause and effect','因果'],'part-whole':['Part and whole','部分与整体'],analogy:['Analogy','类比'],evidence:['Evidence','证据'],perspectives:['Perspectives','多重视角'],decision:['Decision making','决策'],reflection:['Reflection','反思'],respect:['Respect','尊重'],integrity:['Integrity','诚信'],responsibility:['Responsibility','责任'],kindness:['Kindness','友善'],courage:['Courage','勇气'],curiosity:['Curiosity','好奇'],resilience:['Resilience','韧性'],collaboration:['Collaboration','合作'],empathy:['Empathy','共情'],fairness:['Fairness','公平'],inclusion:['Inclusion','包容'],service:['Service','服务'],independence:['Independence','独立'],humility:['Humility','谦逊'],creativity:['Creativity','创造力'],excellence:['Excellence','卓越'],sustainability:['Sustainability','可持续发展'],observation:['Observation','观察'],dialogue:['Dialogue','对话'],written:['Written work','书面成果'],performance:['Performance','表现性任务'],'self-assessment':['Self-assessment','自我评价'],
})
function createCourseViews(React){
 const h=React.createElement
 function DraftEditor({draft,component,onChange,L}){
  const change=(path,value)=>{const next=structuredClone(draft);let node=next;for(const key of path.slice(0,-1))node=node[key];node[path.at(-1)]=value;onChange(next)}
  const field=(path,en,zh,max=2000,number=false)=>{let value=draft;for(const key of path)value=value[key];return h('label',{className:'field',key:path.join('.')},L(en,zh),h(number?'input':'textarea',{'aria-label':L(en,zh),type:number?'number':undefined,value,maxLength:number?undefined:max,min:number?1:undefined,max:number?240:undefined,step:number?1:undefined,onChange:e=>change(path,number&&/^\d+$/.test(e.target.value)?Number(e.target.value):e.target.value)}))}
  const details=(key,en,zh,children)=>h('details',{key,className:'editor-section'},h('summary',null,L(en,zh)),...children)
  const current=draft.components.findIndex(c=>c.id===component)
  return h('div',{className:'draft-editor'},...(component==='lesson'?[
   field(['title'],'Lesson title','课堂标题',240),
   ...[['intentions','Learning intentions','学习目标'],['criteria','Success criteria','成功标准'],['vocabulary','Vocabulary','词汇']].map(([key,en,zh])=>details(key,en,zh,draft[key].map((_,i)=>field([key,i],en+' '+(i+1),zh+' '+(i+1))))),
   details('sequence','Lesson sequence','教学流程',draft.sequence.map((phase,i)=>h('fieldset',{key:i},h('legend',null,L('Phase '+(i+1),'环节 '+(i+1))),field(['sequence',i,'title'],'Phase '+(i+1)+' title','环节 '+(i+1)+' 标题',240),field(['sequence',i,'minutes'],'Phase '+(i+1)+' minutes','环节 '+(i+1)+' 分钟',0,true),...['teacher','student','evidence'].map((key,j)=>field(['sequence',i,key],'Phase '+(i+1)+' '+['teacher actions','student actions','evidence'][j],'环节 '+(i+1)+' '+['教师活动','学生活动','评价证据'][j],key==='evidence'?1000:2000)))))
  ]:current>=0?[
   field(['components',current,'title'],'Component title','组件标题',240),
   ...draft.components[current].sections.map((section,i)=>details('section'+i,'Section '+(i+1),'小节 '+(i+1),[field(['components',current,'sections',i,'heading'],'Section '+(i+1)+' heading','小节 '+(i+1)+' 标题',240),field(['components',current,'sections',i,'body'],'Section '+(i+1)+' body','小节 '+(i+1)+' 正文',6000)])),
   ...(component==='inter'?(draft.quiz??[]).map((q,i)=>details('quiz'+i,'Quiz question '+(i+1),'测验题 '+(i+1),[
    field(['quiz',i,'question'],'Question '+(i+1),'题目 '+(i+1),1500),
    ...q.options.map((_,j)=>field(['quiz',i,'options',j],'Question '+(i+1)+' option '+String.fromCharCode(65+j),'题目 '+(i+1)+' 选项 '+String.fromCharCode(65+j),500)),
    h('label',{className:'field',key:'answer'},L('Question '+(i+1)+' correct answer','题目 '+(i+1)+' 正确答案'),h('select',{'aria-label':L('Question '+(i+1)+' correct answer','题目 '+(i+1)+' 正确答案'),value:q.answer,onChange:e=>change(['quiz',i,'answer'],Number(e.target.value))},q.options.map((_,j)=>h('option',{key:j,value:j},String.fromCharCode(65+j))))),
    field(['quiz',i,'explanation'],'Question '+(i+1)+' explanation','题目 '+(i+1)+' 解析',1500)
   ])):[])
  ]:[]))
 }
 function Page({controller,onBack}){
  const state=React.useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot)
  const [lang,setLang]=React.useState('en'),[step,setStep]=React.useState(0),[courseName,setCourseName]=React.useState(''),[input,setInput]=React.useState(initialInput),[references,setReferences]=React.useState([]),[consent,setConsent]=React.useState(null),[paste,setPaste]=React.useState(''),[component,setComponent]=React.useState('lesson'),[editing,setEditing]=React.useState(null),[busy,setBusy]=React.useState(false)
  const L=(en,zh)=>lang==='zh'?zh:en,read=v=>labelMap[v]?L(...labelMap[v]):v.replaceAll('-',' ')
  const msg=code=>Object.hasOwn(messages,code)?L(...messages[code]):L('Please check the input or workspace.','请检查输入或工作区。')+' ('+code+')'
  React.useEffect(()=>{void controller.boot()},[controller])
  React.useEffect(()=>{setReferences([]);setConsent(null);controller.confirmModel(false);setStep(0);setEditing(null)},[state.courseId,state.workspaceId])
  const consentKey=JSON.stringify({input,references,model:state.runtime?.model,workspace:state.workspaceId,course:state.courseId})
  const policyAvailable=(()=>{try{parseRoute(state.runtime?.model,true);return true}catch{return false}})()
  const confirmed=policyAvailable&&consent===consentKey&&sameRoute(controller.confirmedModel,state.runtime?.model)
  React.useEffect(()=>{setConsent(null);controller.confirmModel(false)},[consentKey])
  React.useEffect(()=>{if(state.task?.state==='succeeded'){setStep(2);setEditing(null)}},[state.task?.id,state.task?.draftHash,state.task?.state])
  React.useEffect(()=>{if(!state.snapshot)return;const p=state.snapshot.profile;setInput(old=>({...old,stage:p.stages.includes(old.stage)?old.stage:p.stages[0],pathway:p.pathways.includes(old.pathway)?old.pathway:p.pathways[0],alignment_framework:p.alignments.includes(old.alignment_framework)?old.alignment_framework:p.alignments[0],competency_tags:old.competency_tags.filter(v=>p.competencies.includes(v)).length?old.competency_tags.filter(v=>p.competencies.includes(v)):[p.competencies[0]]}))},[state.snapshot?.profile.school,state.workspaceId])
  const act=fn=>async()=>{setBusy(true);try{await fn()}catch{}finally{setBusy(false)}}
  const btn=(en,zh,fn,primary=false,disabled=false,props={})=>h('button',{type:'button',className:'btn'+(primary?' primary':''),onClick:act(fn),disabled:busy||disabled,...props},L(en,zh))
  const field=(key,en,zh,kind='text',options=null)=>h('label',{className:'field',key},L(en,zh),options?h('select',{value:input[key],onChange:e=>setInput({...input,[key]:e.target.value})},options.map(v=>h('option',{key:v,value:v},read(v)))):h(kind==='textarea'?'textarea':'input',{type:kind==='textarea'?undefined:kind,value:input[key],min:kind==='number'?10:undefined,max:kind==='number'?240:undefined,maxLength:['context','notes'].includes(key)?2000:['big_idea','career_link','real_world_link'].includes(key)?300:160,onChange:e=>setInput({...input,[key]:kind==='number'?Number(e.target.value):e.target.value})}))
  const toggle=(list,value)=>list.includes(value)?list.filter(v=>v!==value):[...list,value]
  const choices=(key,en,zh,values)=>h('fieldset',{key},h('legend',null,L(en,zh)),h('div',{className:'chips'},values.map(v=>h('label',{className:'chip',key:v},h('input',{type:'checkbox',checked:input[key].includes(v),onChange:()=>setInput({...input,[key]:toggle(input[key],v)})}),read(v)))))
  const selectedCourse=state.snapshot?.courses.find(c=>c.id===state.courseId),task=state.task,draft=editing??task?.draft
  const diagnostic=task?.state==='failed'&&task.diagnostic?.reason===task.message?safeDiagnostic(task.diagnostic):undefined
  const activeRefs=state.snapshot?.references.filter(r=>r.courseId===state.courseId)??[]
  const available=!!state.snapshot&&!!selectedCourse
  const inFlight=['running','cancelling'].includes(state.phase)
  const taskName=t=>L({running:'Generating',succeeded:'Ready to review',failed:'Failed',cancelled:'Cancelled',cancelling:'Cancelling',unknown:'Unconfirmed','restart-required':'Restart required'}[t]??t,{running:'生成中',succeeded:'待教师审核',failed:'失败',cancelled:'已取消',cancelling:'取消中',unknown:'结果未确认','restart-required':'需要重新开始'}[t]??t)
  const referencePanel=h('div',{className:'card'},h('h2',null,L('References & lesson goals','参考资料与本课目标')),h('p',{className:'muted'},L('Choose only materials you are entitled to use. No student names, grades or rosters. Files stay local until you confirm generation.','只选择有权使用的资料，不包含学生姓名、成绩或名单；确认生成前资料仅在本地。')),
   h('div',{className:'filebox'},h('label',{className:'field'},L('Choose references','选择参考资料'),h('input',{type:'file',accept:'.txt,.md,.csv,.docx,.pptx',multiple:true,disabled:busy||inFlight,onChange:async e=>{const files=[...e.target.files];e.target.value='';setBusy(true);try{for(const file of files){const r=await controller.addReference(file);setReferences(old=>[...old,r.id])}}catch{}finally{setBusy(false)}}})),h('p',{className:'muted'},L('TXT / MD / CSV / DOCX / PPTX · up to 8 MB per file, 60,000 extracted characters. PDF: use verified text excerpts. References expire after 30 minutes and are consumed by a task.','TXT / MD / CSV / DOCX / PPTX；单文件最多 8 MB、提取文字最多 6 万字。PDF 请提供经核对的文字摘录。资料 30 分钟有效，任务使用后失效。')),
    activeRefs.map(r=>h('div',{className:'reference',key:r.id},h('input',{type:'checkbox','aria-label':r.name,checked:references.includes(r.id),onChange:()=>setReferences(toggle(references,r.id))}),h('div',{className:'grow'},h('strong',null,r.name),h('div',{className:'muted'},Math.ceil(r.bytes/1024)+' KB · '+L('expires','有效至')+' '+new Date(r.expiresAt).toLocaleTimeString())),btn('Remove','移除',async()=>{await controller.removeReference(r.id);setReferences(old=>old.filter(v=>v!==r.id))},false,inFlight))),
    h('details',null,h('summary',null,L('Paste a verified text excerpt','粘贴经核对的资料摘录')),h('label',{className:'field'},L('Reference text (local)','参考文字（本地）'),h('textarea',{value:paste,maxLength:60000,onChange:e=>setPaste(e.target.value)})),btn('Add excerpt','加入摘录',async()=>{const file=new File([paste],'reference-excerpt.txt',{type:'text/plain'});const r=await controller.addReference(file);setReferences(old=>[...old,r.id]);setPaste('')},false,!paste.trim()||inFlight))),
   h('div',{className:'form-grid'},field('topic','Lesson topic','本课主题'),field('minutes','Duration (minutes)','课时总长（分钟）','number'),field('context','Learner context (anonymous)','学情（匿名）','textarea'),field('big_idea','Big idea (required)','核心概念（必填）','textarea'),field('stage','Stage','学段','text',state.snapshot?.profile.stages??FRAMEWORK.stage),field('pathway','Pathway','课程路径','text',state.snapshot?.profile.pathways??FRAMEWORK.pathway),field('alignment_framework','Alignment framework','对标框架','text',state.snapshot?.profile.alignments??FRAMEWORK.alignment_framework),field('bloom_level','Bloom level','布鲁姆层级','text',FRAMEWORK.bloom_level),field('think_skill','Thinking tool','思维工具','text',FRAMEWORK.think_skill),field('language','Output language','成果语言','text',['en','zh','bilingual']),field('real_world_link','Real-world link','真实情境关联','textarea'),field('career_link',state.snapshot?.profile.careerLinkRequired?'Career link (required)':'Career link (optional)',state.snapshot?.profile.careerLinkRequired?'生涯关联（必填）':'生涯关联（可选）','textarea')),
   choices('competency_tags','Competencies','能力维度',state.snapshot?.profile.competencies??FRAMEWORK.competency_tags),choices('values_focus','Values','价值品格',FRAMEWORK.values_focus),choices('assessment_evidence','Assessment evidence','评价证据',FRAMEWORK.assessment_evidence),btn('Choose components →','选择教学组件 →',async()=>setStep(1),true,!input.topic.trim()||!input.big_idea.trim()||!references.length))
  const componentsPanel=h('div',{className:'card'},h('h2',null,L('Build your classroom toolkit','选择课堂教学组件')),h('p',{className:'muted'},L('All 14 formats share one reviewed lesson draft. Start with 2–4 components; larger sets may need fewer selections to fit one complete response. Six creative formats are experimental.','14 种格式共用一份课堂活动草案，建议先选 2–4 项；较多组件可能需要减少选择才能容纳完整输出。六项创意组件为实验性。')),
   h('div',{className:'components'},COMPONENTS.map(c=>h('label',{className:'component'+(input.components.includes(c.id)?' on':''),key:c.id},h('input',{type:'checkbox',checked:input.components.includes(c.id),onChange:()=>setInput({...input,components:toggle(input.components,c.id)})}),h('div',null,h('strong',null,L(c.en,c.zh)),c.experimental?h('span',{className:'experimental'},L('Experimental','实验性')):null,h('div',{className:'muted'},c.format.toUpperCase()+(c.id==='func'?L(' · quadratic sliders',' · 二次函数滑杆'):c.id==='geo'?L(' · draggable triangle',' · 可拖动三角形'):'')))))),field('notes','Additional teaching requirements','补充教学要求','textarea'),
   h('div',{className:'status'},L('Model','模型')+': '+(state.runtime?.model?state.runtime.model.provider+' / '+state.runtime.model.model:L('Unavailable; reconnect','不可用，请重新连接')),h('p',null,L('Reasoning policy: ','推理策略：')+policyLabel(state.runtime?.model?.policy,lang)),h('p',null,L('Output token budget: ','输出令牌预算：')+OUTPUT_BUDGET),h('p',{className:'muted'},L('Generation uses your DSH default model and may incur charges. Selected reference content and lesson goals are sent to that provider. Drafts remain local; no conversation is created.','生成使用你的 DSH 默认模型，可能产生费用。所选资料内容与教学目标会发送给该模型提供方；草案在本地保存，不创建会话。'))),
   h('label',{className:'consent'},h('input',{type:'checkbox',checked:confirmed,disabled:!policyAvailable,onChange:e=>{controller.confirmModel(e.target.checked);setConsent(e.target.checked?consentKey:null)}}),h('span',null,L('I am entitled to use these materials and agree to send the selected content to my configured model for this draft.','我有权使用这些资料，同意将所选内容发送给已配置模型，用于本次草案。'))),h('div',{className:'row'},btn('← Goals','← 返回目标',async()=>setStep(0)),btn(inFlight?'Generating…':'Generate draft',inFlight?'生成中…':'生成课堂活动草案',async()=>{await controller.generate(input,references,confirmed);setReferences([])},true,inFlight||!confirmed||!references.length||!input.components.length||!policyAvailable)))
  const editError=(()=>{if(!editing)return '';try{parseDraft(editing,task.input);return ''}catch(e){return e.code??'invalid-draft'}})()
  const editMessage=code=>code==='invalid-timing'?msg(code):code==='invalid-input'?L('Each phase needs positive whole minutes; the total must match the lesson. Each quiz needs four options and a correct answer A–D.','每个环节须填正整数分钟，总和须等于课时；测验须有四个选项及 A–D 正确答案。'):L('Complete each labelled field within its length limit. Keep all phases, questions and selected components.','请完整填写各字段并遵守字数限制，保留全部环节、题目及所选组件。')
  const selectComponent=value=>{controller.component();setComponent(value)}
  const reviewPanel=h('div',{className:'card'},h('h2',null,L('Review before saving','先审阅，再保存')),draft?h(React.Fragment,null,h('p',{className:'muted'},L('Check curriculum alignment, mathematical correctness, answers and source rights. Edit content below; apply edits before saving.','请核实课程目标、数学知识、答案及来源权利。可在下方修订，应用修改后再保存。')),
   h('div',{className:'review-nav'},btn('Lesson plan','课堂活动草案',async()=>selectComponent('lesson'),false,false,{'aria-pressed':component==='lesson'}),...draft.components.map(c=>btn(L(COMPONENTS.find(v=>v.id===c.id).en,''),L('',COMPONENTS.find(v=>v.id===c.id).zh),async()=>selectComponent(c.id),false,false,{key:c.id,'aria-pressed':component===c.id}))),
   h('iframe',{title:L('Teaching draft preview','教学草案预览'),sandbox:'allow-scripts',srcDoc:artifactHtml({...task,draft},component)}),
   h('details',null,h('summary',null,L('Edit draft content','修订草案内容')),h('p',{className:'muted'},L('Edits are local until applied. Changing a preview does not overwrite exported files.','应用修改前仅是本地编辑；修改预览不会覆盖已保存的文件。')),
    h(DraftEditor,{draft,component,L,onChange:next=>{controller.localEdit();setEditing(next)}}),
    editError?h('p',{className:'status error',role:'alert'},editMessage(editError)):null,
    h('div',{className:'row'},btn('Apply edits','应用修改',async()=>{await controller.revise(editing);setEditing(null)},true,!editing||!!editError||controller.unresolvedSave()),btn('Discard edits','放弃修改',async()=>{setEditing(null);controller.localEdit(false)},false,!editing))),
   btn('Review save location','查看保存位置',async()=>controller.prepareSave(component),true,!!editing||controller.unresolvedSave()),
   !editing&&state.saveReview?h('div',{className:'save-review',role:'dialog','aria-label':L('Confirm save','确认保存')},h('h3',null,L('Save this reviewed artifact?','保存这份已审阅成果？')),h('p',null,h('code',null,state.saveReview.directory+'/'+state.saveReview.name)),h('p',{className:'muted'},state.saveReview.bytes+' bytes · SHA256 '+state.saveReview.artifactSha256),state.saveReview.existingSha256?h('p',null,L('A file with this name exists. Choose a new version or explicitly overwrite the reviewed file.','已有同名文件，请另存新版本，或明确覆盖已核对的文件。')):null,h('div',{className:'row'},btn('Save new version','另存为新版本',async()=>controller.save('new-version'),true),state.saveReview.existingSha256?btn('Overwrite existing file','覆盖现有文件',async()=>controller.save('overwrite')):null,btn('Cancel','取消',async()=>controller.cancelSave()))):null,
   !editing&&state.saved?h('div',{className:'status',role:'status'},L('Saved and verified: ','已保存并核对：'),h('code',null,state.saved.path),h('div',{className:'muted'},state.saved.bytes+' bytes · SHA256 '+state.saved.sha256)):null):h('div',{className:'empty'},h('div',{className:'big'},'▤'),h('p',null,L('Generate a draft or open a previous task to begin review.','生成草案，或打开已有任务后开始审阅。'))))
  return h('div',{className:'qcu-course'},h('style',null,styles),h('div',{className:'studio'},h('header',null,h('div',{className:'logo','aria-hidden':true},'∑'),h('div',{className:'grow'},h('h1',null,L('Course Design Studio','课程设计工作台')),h('div',{className:'muted'},state.snapshot?.profile.school??L('A thoughtful classroom, one lesson at a time','让每一课都有清晰的目标'))),h('span',{className:'badge'},L('Teacher-reviewed drafts','教师审阅草案')),btn(lang==='en'?'中文':'English',lang==='en'?'中文':'English',async()=>setLang(lang==='en'?'zh':'en')),
   btn('Reconnect','重新连接',()=>controller.boot(),false,inFlight),btn('Back to conversation','返回对话',onBack)),
   state.error?h('div',{className:'status error',role:'alert'},msg(state.error)):null,
   state.connection!=='ready'?h('div',{className:'status',role:'status'},state.connection==='connecting'?L('Connecting to the local workbench…','正在连接本地工作台…'):msg(state.connectionError||'connection-unavailable')):!state.workspaceId?h('div',{className:'status',role:'status'},L('Choose a workspace to browse existing drafts.','选择工作区后可浏览已有草案。')):null,
   state.modelStatus==='loading'?h('p',{className:'muted',role:'status'},L('Checking model policy; existing drafts remain available.','正在查询模型策略，已有草案仍可使用。')):state.runtime?.policyError?h('p',{className:'muted',role:'status'},msg(state.runtime.policyError)):null,
   controller.unresolvedSave()?h('div',{className:'status'},L('The original save is unconfirmed. Check it before applying edits or saving again.','原保存结果未确认，请先核对，再应用修改或重新保存。'),btn('Check original save','核对原保存结果',()=>controller.reconcileSave()),state.originalSave?.id===controller.saveRequest?.saveId&&state.originalSave?.status==='pending'?btn('Continue original save','继续原保存',()=>controller.continueSave(),false,!!editing):null,btn('Close original save intent','结束原保存意图',()=>controller.cancelSave())):null,
   state.originalSave?h('p',{className:'muted',role:'status'},L('Original save result: ','原保存结果：')+state.originalSave.status+(state.originalSave.path?' · '+state.originalSave.path:'')):null,
   state.phase==='unknown'&&!task?h('div',{className:'status',role:'status'},msg('unknown'),btn('Check original task','核对原任务',()=>controller.reconcile())):null,
   h('div',{className:'layout'},h('aside',null,h('div',{className:'card'},h('h3',null,L('Your workspace','你的工作区')),h('label',{className:'field'},L('DSH workspace','DSH 工作区'),h('select',{'aria-label':L('DSH workspace','DSH 工作区'),value:state.workspaceId,disabled:busy||inFlight,onChange:e=>void controller.workspace(e.target.value)},h('option',{value:''},L('Select a workspace','选择工作区')),...(state.runtime?.workspaces??[]).map(w=>h('option',{key:w.id,value:w.id},w.title)))),state.connection==='ready'&&!state.runtime?.workspaces?.length?h('p',{className:'muted'},L('Create a workspace in DSH first, then reconnect.','请先在 DSH 创建工作区，再重新连接。')):null,
   h('div',{className:'course-list'},state.snapshot?.courses.map(c=>h('button',{type:'button',className:'btn course-item'+(state.courseId===c.id?' selected':''),key:c.id,disabled:busy||inFlight,onClick:()=>controller.course(c.id)},c.name))),state.snapshot?h('form',{onSubmit:act(async()=>{await controller.createCourse(courseName);setCourseName('')})},h('label',{className:'field'},L('New course name','新课程名称'),h('input',{value:courseName,maxLength:120,onChange:e=>setCourseName(e.target.value)})),h('button',{className:'btn',type:'button',disabled:busy||!courseName.trim()||inFlight,onClick:act(async()=>{await controller.createCourse(courseName);setCourseName('')})},L('+ Create course','+ 创建课程'))):null),
   h('div',{className:'card recent-tasks'},h('h3',null,L('Previous drafts','历史草案')),...(state.snapshot?.tasks??[]).filter(t=>t.courseId===state.courseId).slice().reverse().slice(0,12).map(t=>h('button',{type:'button',className:'btn task-button',key:t.id,disabled:busy||inFlight,onClick:act(async()=>{setComponent('lesson');await controller.openTask(t.id);setStep(2)})},t.topic,h('div',{className:'muted'},taskName(t.state)))),!(state.snapshot?.tasks??[]).some(t=>t.courseId===state.courseId)?h('p',{className:'muted'},L('No drafts yet','还没有草案')):null)),
   h('main',null,available?h(React.Fragment,null,h('div',{className:'row',style:{marginBottom:14}},h('h2',{className:'grow'},selectedCourse.name),h('span',{className:'muted'},L('One course · one coherent lesson','一门课程 · 一份完整草案'))),h('nav',{className:'steps','aria-label':L('Draft steps','草案步骤')},[['References & goals','资料与目标'],['Teaching components','教学组件'],['Review & save','审阅与保存']].map((names,i)=>h('button',{type:'button',key:i,className:'btn step'+(step===i?' selected':''),'aria-current':step===i?'step':undefined,onClick:()=>setStep(i)},h('small',null,'STEP 0'+(i+1)),L(...names)))),
   task?h('div',{className:'status',role:'status'},taskName(state.phase),['unknown','failed','restart-required'].includes(state.phase)?h('p',null,msg(task.message==='generation-timeout'?'unknown':Object.hasOwn(messages,task.message)?task.message:'cause-not-recorded')):null,diagnostic?h('details',null,h('summary',null,L('Technical diagnostics','技术诊断')),h('p',{className:'muted'},L('Character counts include received deltas and block-end text; the same text may be counted twice. These are not token usage.','字符数包含接收的增量和结束块文字，同一文字可能重复计数；不代表实际令牌用量。')),h('dl',null,[
    [L('Stage','阶段'),diagnostic.stage],[L('Reason','原因码'),diagnostic.reason],[L('Finish kind','结束类型'),diagnostic.finishKind],
    ...(diagnostic.failureCode?[[L('Normalized failure code (classification only)','标准失败码（仅分类）'),diagnostic.failureCode]]:[]),
    [L('Received chunks','接收块数'),diagnostic.chunks],[L('Received text characters','接收文字字符数'),diagnostic.textChars],[L('Received reasoning characters','接收推理字符数'),diagnostic.reasoningChars],
    [L('Serialized stream characters','序列化流字符数'),diagnostic.streamChars],[L('Configured token budget','配置令牌预算'),diagnostic.outputBudget],
   ].map(([key,value])=>h('div',{key},h('dt',null,key),h('dd',null,value))))):null,h('div',{className:'row'},inFlight?btn('Cancel generation','取消生成',()=>controller.cancel()):null,state.phase==='unknown'?btn('Check original task','核对原任务',()=>controller.reconcile()):null)):null,
   step===0?referencePanel:step===1?componentsPanel:reviewPanel):h('div',{className:'card empty'},h('div',{className:'big'},'✦'),h('h2',null,L('Start with your course','从你的一门课开始')),h('p',null,L('Choose a DSH workspace and create a course. Add references, set learning goals, then prepare a draft for review.','选择 DSH 工作区并创建课程，加入资料、设定学习目标，再生成可审阅的课堂活动草案。')),btn('Reconnect','重新连接',()=>controller.boot())))),
   h('div',{className:'footer'},'QCU · '+L('Course Studio 0.1 · Drafts require teacher review. Browsing, preview and do not call a model.','课程设计工作台 0.1 · 草案须经教师审核；浏览、预览和导出不调用模型。'))))
 }
 // The official sidebar owns the row button, selection and selector hook.
 function Entry({size=18,active=false}){return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:active?2:1.6,'aria-hidden':true},h('path',{d:'M18 4H6l7 8-7 8h12M5 4h14M5 20h14'}))}
 return {Page,Entry}
}

function createPlugin(React){
 const {Page,Entry}=createCourseViews(React),h=React.createElement
 return {inject:['slots','layout'],apply(ctx){
  let current=null,pendingSave=null;const listeners=new Set(),availability={snapshot:()=>current,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}}
  const update=value=>{current=value;for(const fn of listeners)fn()}
  function Panel(){const controller=React.useSyncExternalStore(availability.subscribe,availability.snapshot,availability.snapshot);return controller?h(Page,{controller,onBack:()=>ctx.layout.selectPanel(null)}):h('div',{style:{padding:30}},h('h2',null,'Course Design Studio · 课程设计工作台'),h('p',null,'Connecting to the local workbench… / 正在连接本地工作台…'))}
  ctx.effect(()=>()=>listeners.clear())
  ctx.inject(['remote'],async service=>{
   let consumer,unmount
   try{
    unmount=await service.remote.$mount(remoteContribution)
    consumer=service.inject(['remote.qcuCourse'],inner=>{
     const controller=new CourseController(inner.remote.qcuCourse)
     if(pendingSave){controller.saveRequest={...pendingSave.request};controller.saveWorkspace=pendingSave.workspaceId;controller.set({originalSave:pendingSave.result})}
     update(controller)
     inner.on('connection/reset',()=>{controller.invalidate();void controller.boot()})
     inner.effect(()=>()=>{pendingSave=controller.unresolvedSave()?{request:{...controller.saveRequest},workspaceId:controller.saveWorkspace,result:controller.state.originalSave}:null;controller.dispose();update(null)})
    })
   }catch{await consumer?.dispose();await unmount?.();return}
   service.effect(()=>async()=>{await consumer.dispose();await unmount()})
  })
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-course-workbench'},Panel))
  ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-course-workbench',order:31,label:'Course Studio'},Entry))
 }}
}

return createPlugin(React);
}});
