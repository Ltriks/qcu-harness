// Shared, dependency-free contract. Never accepts a filesystem path or executable model output.
export const VERSION='0.1.0-pilot.1.0'
export const PROTOCOL=1
export const targetTitles={stage:'Stage · 学段',pathway:'Pathway · 课程路径',alignment_framework:'Alignment framework · 对标框架',competency_tags:'Competencies · 能力维度',bloom_level:'Bloom level · 布鲁姆层级',big_idea:'Big idea · 核心概念',think_skill:'Thinking tool · 思维工具',values_focus:'Values · 价值品格',real_world_link:'Real-world link · 真实情境',career_link:'Career link · 生涯关联',assessment_evidence:'Assessment evidence · 评价证据'}
export const targetValue=v=>({concept:'Conceptual understanding · 概念理解',skill:'Skills · 技能操作',thinking:'Thinking · 思维素养',language:'Academic language · 学术表达',values:'Values · 价值品格',career:'Career awareness · 生涯认知',igcse:'IGCSE','a-level':'A-Level',ib:'IB',ap:'AP',mcaa:'MCAA'}[v]??String(v).replaceAll('-',' '))
export const COMPONENTS=Object.freeze([
 ['ppt','PPT Courseware','PPT 教学课件','pptx',false],['html','HTML Flipbook','HTML 翻页课件','html',false],
 ['inter','Interactive Quiz','互动课件','html',false],['geo','Interactive Geometry','交互几何演示','html',true],
 ['func','Function Graph','函数图像演示','html',true],['cards','Revision Cards','复习卡片','html',false],
 ['guide','Student Worksheet','导学案','docx',false],['board','Board Plan','板书设计图','html',true],
 ['mind','Mind Map','思维导图','html',false],['micro','Micro-lesson Script','微课脚本','docx',true],
 ['hw','Differentiated Homework','分层作业','docx',false],['ticket','Exit Ticket','退出检测单','docx',false],
 ['mistake','Common Mistakes','易错点提示卡','html',true],['culture','Maths in Context','数学文化素材','docx',true],
].map(([id,en,zh,format,experimental])=>Object.freeze({id,en,zh,format,experimental})))
export const FRAMEWORK=Object.freeze({
 stage:['lower-secondary','igcse','a-level','foundation'],pathway:['general','igcse','a-level','ib','ap','mcaa'],
 alignment_framework:['school','cambridge','ib','ap','portfolio'],competency_tags:['concept','skill','thinking','language','values','career'],
 bloom_level:['remember','understand','apply','analyse','evaluate','create'],
 think_skill:['compare','classify','sequence','cause-effect','part-whole','analogy','evidence','perspectives','decision','reflection'],
 values_focus:['respect','integrity','responsibility','kindness','courage','curiosity','resilience','collaboration','empathy','fairness','inclusion','service','independence','humility','creativity','excellence','sustainability'],
 assessment_evidence:['observation','dialogue','written','performance','self-assessment','portfolio'],
})
export const check=(ok,code='invalid-input')=>{if(!ok){const e=Error(code);e.code=code;throw e}}
export const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
export function exact(v,keys){check(record(v)&&Object.keys(v).every(k=>keys.includes(k)),'invalid-fields');return v}
export function text(v,max=1000,required=false){check(typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)&&(!required||v.trim().length),'invalid-text');return v.trim()}
export function id(v,prefix){check(typeof v==='string'&&new RegExp('^'+prefix+'_[a-f0-9]{32}$').test(v),'invalid-id');return v}
const one=(v,values)=>{check(values.includes(v),'invalid-enum');return v}
const many=(v,values,max=20)=>{check(Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length,'invalid-list');return v.map(x=>one(x,values))}
export function profile(raw={}){
 exact(raw,['school','stages','pathways','alignments','competencies','careerLinkRequired'])
 const result={school:text(raw.school??'Course Design Studio',120,true),careerLinkRequired:raw.careerLinkRequired??false}
 check(typeof result.careerLinkRequired==='boolean')
 for(const [key,source] of [['stages','stage'],['pathways','pathway'],['alignments','alignment_framework'],['competencies','competency_tags']]){
  result[key]=many(raw[key]??(key==='pathways'?FRAMEWORK[source].filter(v=>!['ap','mcaa'].includes(v)):key==='alignments'?FRAMEWORK[source].filter(v=>!['ap','portfolio'].includes(v)):FRAMEWORK[source]),FRAMEWORK[source])
  check(result[key].length>0,'empty-profile')
 }
 return result
}
export function parseInput(raw,p=profile()){
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
export function parseDraft(raw,input){
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
export const remoteContribution={package:'qcu-course-workbench',descriptors:[{id:'qcu-course-workbench#qcuCourse/dispatch',service:'qcuCourse',namespace:'qcuCourse',method:'dispatch',invocation:{kind:'direct'},parameters:[{name:'payload',wire:'payload',source:'json',codec:codec('Request',12000000)}],cancellation:{parameter:'signal'},result:codec('Reply',1500000)}]}
