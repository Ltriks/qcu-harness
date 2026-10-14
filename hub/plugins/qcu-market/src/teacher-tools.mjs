// Pure, bounded teacher helpers. No storage, transport, installer or model access.
import {marketRuntime} from './remote-contract.mjs'
const field=(key,label,max)=>Object.freeze({key,label,max})
export const taskTemplates=Object.freeze([
 Object.freeze({id:'lesson',title:'备课教案',skill:'qcu-lesson-planning',fields:Object.freeze([field('course','课程与对象（匿名）',120),field('topic','本课主题',160),field('goal','学习目标与课时',500),field('material','匿名材料与约束',1800)]),example:Object.freeze({course:'合成示例：虚构大学一年级通识课',topic:'合成示例：辨别论点与证据',goal:'合成设定：45分钟；能区分论点与支持证据，并解释理由。',material:'虚构材料：两段自编短文，一段含论点与理由，一段仅含观点。全班匿名讨论；不引用真实学生资料。'})}),
 Object.freeze({id:'practice',title:'分层练习',skill:'qcu-tiered-practice',fields:Object.freeze([field('course','课程与对象（匿名）',120),field('topic','知识点',160),field('levels','层次与练习要求',500),field('material','匿名材料与约束',1800)]),example:Object.freeze({course:'合成示例：虚构大学基础数学课',topic:'合成示例：一次函数的斜率',levels:'合成设定：基础层识别斜率；提高层解释变化；挑战层比较两条直线。每层2题，附答案及理由。',material:'只用自编数据，数值均为练习假设；不包含真实成绩、姓名或学号。'})}),
 Object.freeze({id:'briefing',title:'教研简报',skill:'qcu-team-briefing',fields:Object.freeze([field('audience','读者与目的',120),field('period','时段（未知请写待补充）',160),field('facts','已知事实（匿名）',1800),field('unknowns','待确认事项与格式要求',500)]),example:Object.freeze({audience:'合成示例：虚构教研组内部复盘',period:'合成示例：演示周期，具体日期待补充',facts:'虚构事实：完成一次匿名课堂活动设计讨论；尚未收集效果数据。没有真实会议或统计依据。',unknowns:'真实日期、参与人数与教学效果均未知；请标为待补充，不编造。输出一页草稿，区分事实、建议和待确认。'})})
])
export const feedbackFields=Object.freeze([field('scene','场景与阶段',160),field('expected','期望行为',600),field('actual','实际行为',600),field('steps','复现步骤（匿名）',1200)])
export function validateFields(fields,values){
 const errors={}
 for(const f of fields){const v=values?.[f.key];if(typeof v!=='string'||!v.trim())errors[f.key]=`请填写${f.label}；未知内容请写“待补充”。`;else if(v.length>f.max)errors[f.key]=`${f.label}最多${f.max}字，请删减后再生成。`}
 return errors
}
export function generateTask(id,values){
 const template=taskTemplates.find(t=>t.id===id)
 if(!template)throw Error('请选择真实任务模板。')
 const errors=validateFields(template.fields,values)
 if(Object.keys(errors).length)return {errors,text:''}
 const text=[`请使用 /${template.skill}，协助完成${template.title}。`,...template.fields.map(f=>`${f.label}：${values[f.key].trim()}`),'请仅依据以上材料生成教师可审阅的草稿。缺失的日期、人数、数据、来源与结论标为“待补充”，不要编造；区分已知事实、假设和建议。','不要请求真实学生资料，不扩展工具或安装权限。由教师核实知识、答案、来源及适用性后再使用。'].join('\n\n')
 return {errors:{},text}
}
export function redactFeedback(text){
 return text
 // Classify the original complete URL before inline assignments can split it.
 .replace(/https?:\/\/[^\s<>"'，；）)]+/gi,raw=>{
  const authPath=/(?:^|\/)(?:oauth2?|oidc|auth|authenticate|authentication|authorization|authorize|authorise|callback|oauth-callback|auth-callback|signin|sign-in|sign_in|login|log-in|sso)(?:\/|\.(?:html?|php)|$)/i
  try{
   const url=new URL(raw)
   let path=url.pathname;try{path=decodeURIComponent(path)}catch{}
   const sensitive=new Set(['code','state','token','accesstoken','refreshtoken','idtoken','apikey','auth','authorization','clientsecret','codeverifier','codechallenge','sessiontoken','oauthtoken','oauthverifier','assertion','ticket'])
   const keys=[...url.searchParams.keys(),...new URLSearchParams(url.hash.slice(1)).keys()]
   return authPath.test(path)||keys.some(key=>sensitive.has(key.toLowerCase().replace(/[-_ ]/g,'')))||url.username||url.password?'[授权链接已移除]':raw
  }catch{return authPath.test(raw)?'[授权链接已移除]':raw}
 })
 .replace(/\b(?:sk|sk-proj|sk-ant)-[A-Za-z0-9_-]{8,}/gi,'[密钥已移除]')
 .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi,'$1 [授权值已移除]')
 .replace(/(["']?(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|token|authorization|auth|密钥|令牌)["']?\s*[:=：]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;，；\n]+)/gi,'$1[授权值已移除]')
 .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[令牌已移除]')
 .replace(/https?:\/\/[^\s<>"']*(?:\/(?:docx?|wiki|sheets|base|file|document)\/)[^\s<>"']*/gi,'[文档链接已移除]')
 .replace(/https?:\/\/(?:[^\s/]+\.)?(?:feishu\.cn|larksuite\.com|doubao\.com)\/[^\s<>"']*/gi,'[文档链接已移除]')
 .replace(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已移除]')
 .replace(/\/(?:Users|home)\/[^\s<>"'，；）)]+/g,'[个人目录已移除]')
 .replace(/[A-Z]:[\\/]Users[\\/][^\s<>"'，；）)]+/gi,'[个人目录已移除]')
}
export function generateFeedback(values){
 const errors=validateFields(feedbackFields,values)
 if(Object.keys(errors).length)return {errors,text:''}
 return {errors:{},text:redactFeedback([`QCU问题反馈记录（尚未提交）`,`市场版本：${marketRuntime.version}`,`DSH支持基线：0.2.0-rc.2（非实际安装版本检测）`,...feedbackFields.map(f=>`${f.label}：${values[f.key].trim()}`),'未自动收集设备、账号、路径、日志、配置、聊天或截图；请手动核实实际DSH版本。'].join('\n\n'))}
}
export function feedbackExport(values,acknowledged){
 const result=generateFeedback(values)
 if(Object.keys(result.errors).length)return result
 if(acknowledged!==true)return {errors:{review:'请先检查预览并确认已删除敏感信息。'},text:''}
 return result
}
export const guideSteps=Object.freeze([
 Object.freeze({title:'从一项教学任务开始',text:'这份指引会带你选技能、准备任务并自己发送。可以随时跳过，也可以回来继续。',action:'点击“下一步”。如果还没安装 DSH 或市场，请先看《安装指引》，也可转给需要帮助的同事。'}),
 Object.freeze({title:'准备自己的模型账号',text:'使用自己的模型账号，调用可能产生费用。Key 只填写在官方设置中。',action:'手动打开“设置 → 模型”，填写自己的 API 密钥并选择模型；不要在这里或反馈中粘贴 Key。'}),
 Object.freeze({title:'选择教学技能',text:'在“常用任务”选择备课教案、分层练习或教研简报。浏览和复制不会安装技能。',action:'点击“查看对应技能详情”，阅读用途、来源和权限后，再决定是否安装。'}),
 Object.freeze({title:'安装与启用分开确认',text:'先确认安装，技能暂不启用。安装完成后，再确认启用该技能及其组件。',action:'按详情页操作。取消或返回会撤销尚未使用的确认；结果不明先核对，需要重启时请正常退出再打开 DSH。'}),
 Object.freeze({title:'自己发送，教师审阅',text:'生成和复制只是准备文本，不会替你发送。模型输出需要教师审阅。',action:'新建对话，选择对应 /qcu-… 技能，粘贴并发送。核对知识、答案、数字和来源，未知内容保留“待补充”。'})
])
