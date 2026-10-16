import {taskTemplates,feedbackFields,validateFields,generateTask,generateFeedback,feedbackExport,guideSteps} from './teacher-tools.mjs'
export function createTeacherViews(React){
 const h=React.createElement
 const button=(text,onClick,disabled=false,primary=false)=>h('button',{type:'button',className:'qcu-control'+(primary?' qcu-primary':''),onClick,disabled},text)
 const heading=text=>h('h1',{tabIndex:-1,'data-page-heading':true},text)
 const taskLifetime=h('p',{className:'qcu-hint'},'切换任务或查看技能再返回，草稿会保留。点击“清空本任务”、重新加载或正常退出 DSH 后清除。请只填匿名或示例材料。')
 const feedbackLifetime=h('p',{className:'qcu-hint'},'返回市场内其他页面、点击“清空反馈”、重新加载或正常退出 DSH 后，反馈会清除。')
 function Fields({fields,values,errors,onChange,prefix}){return fields.map(f=>h('div',{key:f.key,className:'qcu-field'},h('label',{htmlFor:prefix+f.key},f.label),h('textarea',{id:prefix+f.key,value:values[f.key]||'',maxLength:f.max,rows:f.max>600?4:2,'aria-invalid':Boolean(errors[f.key]),'aria-describedby':prefix+f.key+'-help',onChange:e=>onChange(f.key,e.target.value)}),h('p',{id:prefix+f.key+'-help',className:'qcu-hint'},`${(values[f.key]||'').length}/${f.max}字 · 必填`,errors[f.key]?h('span',{role:'alert'},' · '+errors[f.key]):null)))}
 function Guide({state,setState,onHome}){
  const step=guideSteps[state.step]
  return h('div',{className:'qcu-aux-page qcu-guide-page'},heading('新手指引'),
   h('p',{role:'status',className:'qcu-guide-status'},`第 ${state.step+1} / ${guideSteps.length} 步 · ${state.done?'已浏览引导':'尚未浏览完成'}（不代表已验收）`),
   h('ol',{className:'qcu-progress','aria-label':'指引步骤'},...guideSteps.map((s,i)=>h('li',{key:s.title,'aria-current':state.step===i?'step':undefined},h('span',{className:'qcu-step-number','aria-hidden':true},String(i+1).padStart(2,'0')),h('span',null,s.title)))),
   h('section',{className:'qcu-guide-body','aria-labelledby':'qcu-step-title'},h('span',{className:'qcu-eyebrow'},`步骤 ${String(state.step+1).padStart(2,'0')}`),h('h2',{id:'qcu-step-title'},step.title),h('p',null,step.text),h('p',{className:'qcu-note'},'下一步：'+step.action)),
   h('p',{className:'qcu-hint'},'设置、安装和发送都由你手动操作，请按页面提示检查结果。浏览完指引不代表设置或任务已成功。'),
   h('div',{className:'qcu-guide-controls'},h('div',{className:'qcu-button-row'},button('上一步',()=>setState({...state,step:state.step-1}),state.step===0),state.step<guideSteps.length-1?button('下一步',()=>setState({...state,step:state.step+1}),false,true):button('完成引导',()=>{setState({...state,done:true});onHome()},false,true)),button('稍后再看',onHome)))
 }
 function Tasks({drafts,setDrafts,selected,setSelected,onDetail}){
  const [errors,setErrors]=React.useState({}),[message,setMessage]=React.useState('')
  const template=taskTemplates.find(t=>t.id===selected),draft=drafts[selected]||{values:{},text:''}
  const save=next=>setDrafts({...drafts,[selected]:next})
  const change=(key,value)=>{save({values:{...draft.values,[key]:value},text:''});setErrors({});setMessage('输入已更改，请重新生成任务文本。')}
  const copy=async()=>{if(!draft.text||draft.text.length>6000){setMessage('请生成或删减任务文本至6000字内。');return}try{if(!globalThis.navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(draft.text);setMessage('已复制，请在新对话选择对应 Skill，粘贴并自行发送。')}catch{setMessage('剪贴板不可用，请手动选中下方任务文本复制。')}}
  return h('div',{className:'qcu-aux-page'},heading('常用任务'),taskLifetime,
   h('nav',{'aria-label':'任务模板',className:'qcu-button-row'},...taskTemplates.map(t=>h('button',{key:t.id,type:'button',className:'qcu-control','aria-pressed':selected===t.id,onClick:()=>{setSelected(t.id);setErrors({});setMessage('')}},t.title))),
   template?h(React.Fragment,null,h('h2',null,template.title),h('p',null,`对应真实 Skill：/${template.skill}；必须由你在新对话选择、粘贴并发送。`),h('div',{className:'qcu-button-row'},button('填入完整合成示例',()=>{save({values:{...template.example},text:''});setErrors({});setMessage('已填入虚构示例，请生成任务文本。')}),button('清空本任务',()=>{save({values:{},text:''});setErrors({});setMessage('本任务草稿已清空。')}),button('查看对应技能详情',()=>onDetail(template.skill))),
   h('form',{noValidate:true,onSubmit:e=>{e.preventDefault();const result=generateTask(selected,draft.values);setErrors(result.errors);save({...draft,text:result.text});setMessage(result.text?'任务文本已生成，尚未发送。':'请按提示补全或删减输入。')}},h(Fields,{fields:template.fields,values:draft.values,errors,onChange:change,prefix:'qcu-task-'}),h('button',{type:'submit',className:'qcu-control qcu-primary'},'生成任务文本')),
   draft.text?h('section',{className:'qcu-section'},h('h2',null,'可编辑任务文本'),h('textarea',{'aria-label':'任务文本',value:draft.text,maxLength:6000,rows:9,onChange:e=>{save({...draft,text:e.target.value});setMessage('任务文本已编辑，尚未发送。')}}),button('复制任务文本',copy,!draft.text.trim()),h('p',{className:'qcu-hint'},'仅复制本页文本；不创建会话、不调用模型、不增添工具或安装动作。')):null,
   h('p',{role:'status','aria-live':'polite'},message)):h('p',null,'请选择一项任务，再填写匿名材料。'))
 }
 function Feedback(){
  const [values,setValues]=React.useState({}),[text,setText]=React.useState(''),[errors,setErrors]=React.useState({}),[ack,setAck]=React.useState(false),[message,setMessage]=React.useState('')
  const reset=()=>{setValues({});setText('');setErrors({});setAck(false);setMessage('反馈已清空，尚未提交。')}
  const change=(key,value)=>{setValues({...values,[key]:value});setText('');setErrors({});setAck(false);setMessage('输入已更改，请重新生成并审阅。')}
  const copy=async()=>{const safe=feedbackExport(values,ack);setErrors(safe.errors);if(!safe.text)return;setText(safe.text);try{if(!globalThis.navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(safe.text);setMessage('记录已复制，尚未提交。请通过事先约定的渠道手动发送。')}catch{setMessage('剪贴板不可用，请手动选中脱敏反馈预览复制；尚未提交。')}}
  return h('div',{className:'qcu-aux-page'},heading('问题反馈'),feedbackLifetime,h('p',null,'这里只整理记录，不会自动提交工单、邮件或飞书消息。请勿粘贴 Key、聊天、日志、真实文档、姓名、学号或联系方式。'),h('p',{className:'qcu-note'},'自动遮盖不能识别所有个人信息，请逐项检查预览再复制。'),h('details',null,h('summary',null,'隐私提醒与脱敏说明'),h('p',null,'可识别的密钥、授权或回调链接、文档链接、邮箱和个人目录会被遮盖。其他学生资料、个人信息仍须你手动删除。输入原文只暂留当前表单，清空后移除。')),
   h('form',{noValidate:true,onSubmit:e=>{e.preventDefault();const result=generateFeedback(values);setErrors(result.errors);setText(result.text);setAck(false);setMessage(result.text?'记录已生成，尚未提交。请先检查下方脱敏预览。':'请按提示补全或删减输入。')}},h(Fields,{fields:feedbackFields,values,errors,onChange:change,prefix:'qcu-feedback-'}),h('div',{className:'qcu-button-row'},h('button',{type:'submit',className:'qcu-control qcu-primary'},'生成反馈记录'),button('清空反馈',reset))),
   text?h('section',{className:'qcu-section'},h('h2',null,'脱敏反馈预览'),h('textarea',{'aria-label':'脱敏反馈预览',readOnly:true,value:text,rows:10}),h('label',{className:'qcu-ack'},h('input',{type:'checkbox',checked:ack,onChange:e=>{setAck(e.target.checked);setMessage('')}}),'我已检查脱敏预览，确认没有密钥、学生资料或其他敏感信息。'),button('复制反馈记录',copy,!ack),errors.review?h('p',{role:'alert'},errors.review):null):null,
   h('p',{role:'status','aria-live':'polite'},message))
 }
 return {Guide,Tasks,Feedback}
}
