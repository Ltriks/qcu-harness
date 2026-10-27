import {marketRuntime} from './remote-contract.mjs'
import {taskTemplates,feedbackFields,validateFields,generateTask,generateFeedback,guideSteps,redactFeedback} from './teacher-tools.mjs'
export function createTeacherViews(React){
 const h=React.createElement
 const button=(text,onClick,disabled=false,primary=false)=>h('button',{type:'button',className:'qcu-control'+(primary?' qcu-primary':''),onClick,disabled},text)
 const heading=text=>h('h1',{tabIndex:-1,'data-page-heading':true},text)
 const taskLifetime=h('p',{className:'qcu-hint'},'切换任务或查看技能再返回，草稿会保留。点击“清空本任务”、重新加载或正常退出 DSH 后清除。请只填匿名或示例材料。')
 function Fields({fields,values,errors,onChange,prefix}){return fields.map(f=>h('div',{key:f.key,className:'qcu-field'},h('label',{htmlFor:prefix+f.key},f.label),h('textarea',{id:prefix+f.key,value:values[f.key]||'',maxLength:f.max,rows:f.max>600?4:2,'aria-invalid':Boolean(errors[f.key]),'aria-describedby':prefix+f.key+'-help',onChange:e=>onChange(f.key,e.target.value)}),h('p',{id:prefix+f.key+'-help',className:'qcu-hint'},`${(values[f.key]||'').length}/${f.max}字 · 必填`,errors[f.key]?h('span',{role:'alert'},' · '+errors[f.key]):null)))}
 function Guide({state,setState,onHome,onLaunch}){
  const step=guideSteps[state.step], [launchMessage,setLaunchMessage]=React.useState('')
  return h('div',{className:'qcu-aux-page qcu-guide-page'},heading('新手指引'),h('p',null,'实际首次任务指引会在教学首页复用现有工作文件夹和会话草稿。此处浏览记录不表示模型或首次任务完成。'),onLaunch&&button('进入首次任务指引',()=>{if(onLaunch()===false)setLaunchMessage('当前未提供教学主题指引。请打开“设置 → 模型”配置，再在“常用任务”准备匿名文本，进入对话自行核对并发送。')},false,true),launchMessage&&h('p',{role:'status'},launchMessage),
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
 function Feedback({flow}){
  const empty=React.useMemo(()=>({phase:'unavailable',ack:false,preview:null,history:[],historyReady:true,selected:null,needsNew:false,busy:false,message:'',code:''}),[])
  const state=React.useSyncExternalStore(flow?.subscribe||(()=>()=>{}),flow?.snapshot||(()=>empty))
  const [category,setCategory]=React.useState('ui'),[values,setValues]=React.useState({}),[text,setText]=React.useState(''),[errors,setErrors]=React.useState({}),[ack,setAck]=React.useState(false),[message,setMessage]=React.useState('')
  React.useEffect(()=>{void flow?.restore();return()=>flow?.invalidate()},[flow])
  const labels={ui:'界面与操作',install:'安装与更新',model:'模型设置',other:'其他'}
  const selected=state.history.find(r=>r.requestId===state.selected)
  const stateLabel=row=>row.last?({'received':'已收到','in-progress':'处理中','resolved':'维护者已处理'}[row.last.state]):'待查询'
  const clear=()=>{flow?.invalidate();setValues({});setText('');setErrors({});setAck(false);setMessage('表单已清空，已有回执仍保留。')}
  const change=(key,value)=>{flow?.invalidate();setValues({...values,[key]:value});setText('');setErrors({});setAck(false);setMessage('内容已更改，请重新生成并检查。')}
  const fail=e=>setMessage(e?.code==='feedback.new-required'?'请先查询原回执，或点击“另建一条反馈（保留原回执）”。':e?.code==='feedback.sensitive'?'记录中仍可能有敏感资料，请删除后重新生成预览。':e?.code==='feedback.limit'?'整条反馈较长，请删减后重新生成预览；本次没有发送。':'确认已失效，请重新生成并检查预览。')
  const copy=async()=>{if(!ack||!text)return;try{await navigator.clipboard.writeText(text);setMessage('反馈记录已复制，复制不会提交。')}catch{setMessage('无法复制，请手动选中脱敏预览。')}}
  const newRecord=()=>{try{flow.startNew();setText('');setAck(false);setErrors({});setMessage('原回执已保留。请编辑新内容，再生成并检查。')}catch{setMessage('请先等待当前操作结束或返回取消，再另建反馈。')}}
  const generate=async e=>{
   e.preventDefault();if(state.needsNew){setMessage('请先查询原回执，或点击“另建一条反馈（保留原回执）”。');return}
   const safe=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,redactFeedback(v.trim())])),result=generateFeedback(safe)
   setErrors(result.errors);setText(result.text);setAck(false);flow?.invalidate()
   if(result.text){try{await flow?.preview({category,title:safe.scene,steps:safe.steps,expected:safe.expected,actual:safe.actual,knownVersions:{market:marketRuntime.version,runtime:'unobserved'},text:result.text})}catch(e){fail(e);return}}
   setMessage(result.text?'记录已生成，尚未提交。请检查下方全部预览。':'请按提示补全或删减。')
  }
  return h('div',{className:'qcu-aux-page','data-feedback-history-ready':String(state.historyReady)},heading('问题反馈'),!state.historyReady&&h('p',{role:'status'},'正在读取本地回执…'),
   h('p',{className:'qcu-hint'},'输入只留当前表单；已提交的查询凭据保存在本机，重新打开后仍可查询。不会自动提交或查询 Hub。'),
   h('p',null,'先检查脱敏预览，再单独确认提交到校内 Hub。请勿粘贴 Key、聊天、日志、真实文档或学生资料。无法提交时仍可复制记录。'),
   h('details',null,h('summary',null,'隐私提醒'),h('p',null,'自动遮盖不能识别所有私人信息。请删除姓名、学号、联系方式等资料。本机只保存随机回执凭据、时间和版本，不保存反馈原文。')),
   state.history.length>0&&h('section',{className:'qcu-section','aria-label':'本地回执历史'},h('h2',null,'本地回执'),
    h('p',{className:'qcu-hint'},'“待查询”表示已保存查询凭据，不表示 Hub 已收到。点击一条回执才会联网查询。'),
    h('ul',{className:'qcu-receipt-list'},...state.history.map(row=>h('li',{key:row.requestId},button('查询回执 '+row.receiptId.slice(0,8)+' · '+stateLabel(row),()=>{void flow.check(row.requestId)},state.busy)))),
    selected&&h('div',{'aria-label':'反馈回执'},h('h3',null,'回执 '+selected.receiptId.slice(0,8)),h('p',null,stateLabel(selected)),
     selected.last?.message&&h('p',null,selected.last.message),
     h('div',{className:'qcu-button-row'},button('查询这条反馈',()=>{void flow.check(selected.requestId)},state.busy),button('复制回执编号',async()=>{try{await navigator.clipboard.writeText(selected.receiptId);setMessage('回执编号已复制，可向维护者说明问题。')}catch{setMessage('暂时无法复制回执编号，请稍后再试。')}})),
     h('p',{className:'qcu-hint'},'维护者标记处理后，请你检查问题是否解决。')),
    button('另建一条反馈（保留原回执）',newRecord,state.busy)),
   h('form',{noValidate:true,onSubmit:e=>{void generate(e)}},
    h('label',null,'问题类别',h('select',{'aria-label':'问题类别',value:category,onChange:e=>{setCategory(e.target.value);setText('');setAck(false);flow?.invalidate()}},...Object.entries(labels).map(([value,label])=>h('option',{key:value,value},label)))),
    h(Fields,{fields:feedbackFields,values,errors,onChange:change,prefix:'qcu-feedback-'}),
    h('div',{className:'qcu-button-row'},h('button',{type:'submit',className:'qcu-control qcu-primary',disabled:state.busy||state.needsNew},'生成反馈记录'),button('清空反馈',clear))),
   text&&h('section',{className:'qcu-section'},h('h2',null,'脱敏反馈预览'),h('p',null,'问题类别：'+labels[category]+'；市场版本：'+marketRuntime.version+'；实际运行时：未观察。'),
    h('textarea',{'aria-label':'脱敏反馈预览',readOnly:true,value:text,rows:10}),
    h('label',{className:'qcu-ack'},h('input',{type:'checkbox',checked:ack,onChange:e=>{setAck(e.target.checked);flow?.acknowledge(e.target.checked);setMessage('')}}),'我已检查全部预览，确认没有密钥、学生资料或其他敏感信息。'),
    h('div',{className:'qcu-button-row'},button('复制反馈记录',copy,!ack),button(state.phase==='submitting'?'正在提交…':'确认提交到校内 Hub',()=>{void flow?.submit().catch(fail)},!flow||!state.ack||!state.preview||state.busy||state.needsNew,true))),
   !flow&&h('p',{className:'qcu-note'},'当前客户端未提供反馈服务，请复制记录并联系维护者。'),
   flow&&button('重新读取本地回执',()=>{void flow.restore()},state.busy),
   state.storeBlocked&&h('p',null,'本地回执有正在写入或中断的预留。已有回执仍可查询；新提交遇到阻塞时请联系维护者核对。'),
   h('p',{role:'status','aria-live':'polite'},message+' '+state.message),
   state.code&&h('details',null,h('summary',null,'技术信息'),h('code',null,state.code)))
 }

 return {Guide,Tasks,Feedback}
}
