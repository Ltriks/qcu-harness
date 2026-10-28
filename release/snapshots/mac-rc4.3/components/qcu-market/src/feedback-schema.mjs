// P16 review: shared pure contract. No IO, storage, credentials or host APIs.
export const feedbackLimit=16384
export const feedbackPreviewKeys=['category','title','steps','expected','actual','knownVersions','text']
export const feedbackCanonical=v=>v&&typeof v==='object'?Array.isArray(v)?'['+v.map(feedbackCanonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+feedbackCanonical(v[k])).join(',')+'}':JSON.stringify(v)
export const feedbackNeed=(v,code='feedback.invalid')=>{if(!v){const e=Error(code);e.code=code;throw e}}
export function feedbackExact(v,keys){feedbackNeed(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join()===keys.slice().sort().join())}
export function feedbackText(v,max,{empty=false}={}){
 feedbackNeed(typeof v==='string'&&(empty||v.trim())&&[...v].length<=max)
 for(const c of v){const n=c.codePointAt(0);feedbackNeed(n<0xd800||n>0xdfff)}
 feedbackNeed(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))
 feedbackNeed(!/\b(?:sk(?:-proj|-ant)?-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|Bearer\s+[A-Za-z0-9._~+/=-]+|Basic\s+[A-Za-z0-9+/=]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)|-----BEGIN .*PRIVATE KEY|\/(?:Users|home)\/[^\s]+|[A-Z]:[\\/]Users[\\/]|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s]*(?:[?&#](?:token|code|state|key)=|\/(?:docx|wiki|sheets|base)\/)/i.test(v),'feedback.sensitive')
 for(const m of v.matchAll(/(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|token|authorization|auth|password|密码|密钥)\s*[=:：]\s*([^\n,;，；]+)/gi))feedbackNeed(m[1].replace(/^[ \t"']+/,'').startsWith('[授权值已移除]'),'feedback.sensitive')
 return v
}
export function validateFeedbackPreview(v){
 feedbackExact(v,feedbackPreviewKeys);feedbackNeed(['ui','install','model','other'].includes(v.category))
 for(const [key,max]of [['title',160],['steps',1200],['expected',600],['actual',600],['text',6000]])feedbackText(v[key],max)
 feedbackExact(v.knownVersions,['market','runtime'])
 for(const value of Object.values(v.knownVersions))feedbackNeed(typeof value==='string'&&/^[a-zA-Z0-9.-]{1,80}$/.test(value))
 return v
}
export function feedbackPreviewOf(v){return Object.fromEntries(feedbackPreviewKeys.map(k=>[k,v[k]]))}
export function validateFeedbackSubmission(v){
 feedbackExact(v,[...feedbackPreviewKeys,'requestId','confirmed','previewSha256']);validateFeedbackPreview(feedbackPreviewOf(v))
 feedbackNeed(typeof v.requestId==='string'&&/^[a-f0-9]{64}$/.test(v.requestId)&&v.confirmed===true&&typeof v.previewSha256==='string'&&/^[a-f0-9]{64}$/.test(v.previewSha256),'feedback.preview')
 feedbackNeed(new TextEncoder().encode(feedbackCanonical(v)).length<=feedbackLimit,'feedback.limit');return v
}
export function validateFeedbackQuery(v){feedbackExact(v,['requestId']);feedbackNeed(typeof v.requestId==='string'&&/^[a-f0-9]{64}$/.test(v.requestId),'feedback.missing');return v}
