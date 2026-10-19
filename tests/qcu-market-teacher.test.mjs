import test from 'node:test'
import assert from 'node:assert/strict'
import {taskTemplates,feedbackFields,validateFields,generateTask,redactFeedback,generateFeedback,feedbackExport} from '../hub/plugins/qcu-market/src/teacher-tools.mjs'
import {bundledCatalog,catalogSha256,catalogText} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {marketRuntime} from '../hub/plugins/qcu-market/src/remote-contract.mjs'
test('three helpers map exactly to real existing Skills without new products or modified release metadata',async()=>{
 assert.deepEqual(taskTemplates.map(t=>[t.title,t.skill]),[['备课教案','qcu-lesson-planning'],['分层练习','qcu-tiered-practice'],['教研简报','qcu-team-briefing']])
 assert.equal(bundledCatalog.entries.length,9);assert.equal(bundledCatalog.entries.filter(t=>t.kind==='skill').length,6)
 for(const t of taskTemplates){const e=bundledCatalog.entries.find(e=>e.id===t.skill);assert.equal(e.release.skill,t.skill)}
 assert.equal(marketRuntime.catalogSha256,catalogSha256)
 assert.equal(marketRuntime.version,'0.1.0-pilot.13.2');assert.equal(marketRuntime.protocol,4)
 const source=JSON.parse(catalogText)
 assert.deepEqual(bundledCatalog,source)
})
for(const t of taskTemplates){
 test(t.title+' validates required fields and exact bounds before producing a fresh auditable draft',()=>{
  const missing=generateTask(t.id,{});assert.equal(Object.keys(missing.errors).length,t.fields.length);assert.equal(missing.text,'')
  for(const f of t.fields){assert.ok(validateFields(t.fields,{...t.example,[f.key]:' '})[f.key]);assert.ok(validateFields(t.fields,{...t.example,[f.key]:'合'.repeat(f.max+1)})[f.key]);assert.equal(validateFields(t.fields,{...t.example,[f.key]:'合'.repeat(f.max)})[f.key],undefined)}
  const result=generateTask(t.id,t.example);assert.deepEqual(result.errors,{});assert.match(result.text,new RegExp('/'+t.skill));assert.match(result.text,/待补充/);assert.match(result.text,/不要编造/)
  const key=t.fields[0].key,changed=generateTask(t.id,{...t.example,[key]:'新的匿名要求'});assert.ok(changed.text.includes('新的匿名要求'));assert.ok(!changed.text.includes(t.example[key]));assert.ok(changed.text.length<6000)
 })
 test(t.title+' example is complete, explicitly synthetic and has no credential/document/contact fixture',()=>{
  assert.deepEqual(validateFields(t.fields,t.example),{});const raw=JSON.stringify(t.example);assert.match(raw,/合成示例/);assert.doesNotMatch(raw,/https?:|sk-|@|\/Users\//);assert.equal(redactFeedback(raw),raw)
 })
}
test('unknown template is refused',()=>assert.throws(()=>generateTask('fake',{}),/真实/))
const clean={scene:'合成示例：新手指引',expected:'下一步可用',actual:'虚构场景：按钮没有响应',steps:'使用匿名示例，打开指引并点击下一步。'}
test('feedback validates bounds, version context and human review gate; never detects machine or actual DSH',()=>{
 assert.equal(Object.keys(generateFeedback({}).errors).length,4)
 for(const f of feedbackFields)assert.ok(generateFeedback({...clean,[f.key]:'字'.repeat(f.max+1)}).errors[f.key])
 for(const ack of [false,undefined,1,'true']){const r=feedbackExport(clean,ack);assert.equal(r.text,'');assert.ok(r.errors.review)}
 const r=feedbackExport(clean,true);assert.match(r.text,/0.1.0-pilot.13.2/);assert.match(r.text,/非实际安装版本检测/);assert.match(r.text,/尚未提交/)
 assert.equal(feedbackExport({...clean,actual:''},true).text,'')
})
test('redaction removes synthetic key, token, auth, JWT, docURL, email and home paths and is idempotent',()=>{
 const secret='sk-syntheticOnly123456';const input=[secret,'APIKey="invented-only"','access_token=made-up-token','Authorization: Bearer syntheticBearer123','Authorization: Basic syntheticBasic123==','auth: inventedAuth','eyJsynthetic.eyJinvented.signature','https://fiction.invalid/docx/invented','https://fiction.feishu.cn/wiki/invented','teacher@example.invalid','/Users/fictional/private/file','/home/fictional/file','C:\\Users\\fictional\\file'].join('\n')
 const redacted=redactFeedback(input);for(const raw of [secret,'invented-only','made-up-token','syntheticBearer123','syntheticBasic123','inventedAuth','eyJsynthetic','fiction.invalid','fiction.feishu.cn','teacher@example.invalid','fictional'])assert.ok(!redacted.includes(raw),raw)
 assert.equal(redactFeedback(redacted),redacted)
 const r=feedbackExport({...clean,actual:input},true);assert.ok(!r.text.includes(secret));assert.match(r.text,/已移除/)
 assert.equal(redactFeedback('匿名学生甲可能仍属于个人信息，必须人工审阅。'),'匿名学生甲可能仍属于个人信息，必须人工审阅。')
})
test('complete synthetic authorization/callback URLs are removed before token assignments; benign links survive',()=>{
 const hidden=[
  'https://identity.example.invalid/oauth/authorize?code=syntheticCode&state=syntheticState',
  'https://id.example.invalid/callback?access_token=syntheticValue',
  'https://identity.example.invalid/login?next=syntheticNext',
  'https://identity.example.invalid/auth',
  'https://identity.example.invalid/oauth2/v2/authorize',
  'https://identity.example.invalid/callback.html',
  'https://identity.example.invalid/sign-in',
  'https://identity.example.invalid/%63allback?plain=synthetic',
  'https://help.example.invalid/status?code=syntheticCode',
  'https://help.example.invalid/status?state=syntheticState',
  'https://help.example.invalid/status?ACCESS_TOKEN=syntheticValue',
  'https://help.example.invalid/status?%61ccess_token=syntheticValue',
  'https://help.example.invalid/status?refresh-token=syntheticValue',
  'https://help.example.invalid/status?id_token=syntheticValue',
  'https://help.example.invalid/status?apiKey=syntheticValue',
  'https://help.example.invalid/status?client_secret=syntheticValue',
  'https://help.example.invalid/status#access_token=syntheticValue&state=syntheticState'
 ]
 const benign=['https://help.example.invalid/error?reason=timeout','https://help.example.invalid/how-to?topic=models&lang=zh','https://help.example.invalid/oauth-guide#overview']
 for(const raw of hidden){assert.equal(redactFeedback(raw),'[授权链接已移除]');assert.equal(redactFeedback(redactFeedback(raw)),'[授权链接已移除]')}
 for(const raw of benign)assert.equal(redactFeedback(raw),raw)
 const input=[...hidden.slice(0,2),...benign].join('\n'),output=redactFeedback(input)
 assert.equal(redactFeedback(output),output);assert.ok(!output.includes('identity.example.invalid'));assert.ok(!output.includes('id.example.invalid'));assert.doesNotMatch(output,/syntheticCode|syntheticState|syntheticValue/)
 assert.equal(feedbackExport({...clean,actual:input},false).text,'')
 assert.equal(feedbackExport({...clean,actual:input},true).text,generateFeedback({...clean,actual:input}).text)
 for(const raw of benign)assert.ok(feedbackExport({...clean,actual:input},true).text.includes(raw))
})
