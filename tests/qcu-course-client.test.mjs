import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {Script,createContext} from 'node:vm'
import {CourseController} from '../hub/plugins/qcu-course-workbench/src/controller.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json')),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
import {VERSION,PROTOCOL,profile,policyFor} from '../hub/plugins/qcu-course-workbench/src/protocol.mjs'
const bundle=await readFile(new URL('../hub/plugins/qcu-course-workbench/client.js',import.meta.url),'utf8')
function load(react=React){let result;new Script(bundle).runInContext(createContext({window:{__ModuleLoader__:{load:({id,factory})=>{assert.equal(id,'qcu-course-workbench');result=factory(name=>{assert.equal(name,'react');return react})}}},setTimeout,clearTimeout,crypto:globalThis.crypto}));return result}
function register(plugin){const slots=[],effects=[];plugin.apply({slots:{inject:(_s,fn)=>fn(),register:(opts,component)=>{slots.push({opts,component})}},layout:{selectPanel(){}},effect:fn=>effects.push(fn()),inject(){}});return {slots,effects}}
test('actual lazy-CJS artifact executes, sidebar is an icon in official row, main renders while services connect',()=>{
 const p=load();assert.deepEqual([...p.inject],['slots','layout']);const {slots}=register(p);assert.equal(slots.length,2)
 const sidebar=slots.find(s=>s.opts.name==='sidebar.panellist');assert.equal(sidebar.opts.id,'qcu-course-workbench')
 const icon=renderToStaticMarkup(React.createElement(sidebar.component,{size:18,active:true,usePanelInfo:selector=>{assert.equal(typeof selector,'function');return selector({activePanelId:null})}}));assert.match(icon,/<svg/);assert.doesNotMatch(icon,/<button/)
 const main=slots.find(s=>s.opts.name==='main');assert.equal(main.opts.key,'qcu-course-workbench');assert.match(renderToStaticMarkup(React.createElement(main.component)),/Connecting to the local workbench/)
 assert.doesNotMatch(bundle,/^import |^export /m);assert.equal((bundle.match(/require\(/g)||[]).length,1)
})
test('controller treats lost generation reply as unknown and never resubmits during reconciliation',async()=>{
 const calls=[],remote={dispatch:async payload=>{const raw=JSON.parse(payload);calls.push(raw);if(raw.request?.action==='generate')throw Error('connection lost');if(raw.request?.action==='task')return {ok:true,value:JSON.stringify({ok:true,value:{id:'task_1',state:'succeeded'}})};return {ok:true,value:JSON.stringify({ok:true,value:{courses:[],tasks:[],references:[]}})}}}
 const controller=new CourseController(remote);controller.set({workspaceId:'ws',courseId:'course_x',runtime:{model:{provider:'fixture',model:'fixture',policy:policyFor({})}}});controller.confirmModel(true)
 await assert.rejects(controller.generate({},[],true),/connection lost/);assert.equal(controller.state.phase,'unknown');assert.equal(calls.length,1);assert.equal(calls[0].request.action,'generate');controller.dispose()
})
test('controller synchronously guards double generation clicks and fences late workspace replies',async()=>{
 let resolveReply,count=0;const remote={dispatch:()=>{count++;return new Promise(resolve=>{resolveReply=resolve})}}
 const c=new CourseController(remote);c.set({workspaceId:'ws',courseId:'course_x',runtime:{model:{provider:'fixture',model:'fixture',policy:policyFor({})}}});c.confirmModel(true);const first=c.generate({},[],true);await c.generate({},[],true);assert.equal(count,1);c.invalidate();resolveReply({ok:true,value:JSON.stringify({ok:true,value:{id:'task_fake',state:'running'}})});await first;assert.equal(c.state.task,null);c.dispose()
})
test('creating a second course clears the first course preview and pending save confirmation',async()=>{
 const remote={dispatch:async payload=>{const request=JSON.parse(payload).request;return {ok:true,value:JSON.stringify({ok:true,value:request.action==='createCourse'?{id:'new-course',name:'new'}:{courses:[{id:'new-course',name:'new'}],tasks:[],references:[]}})}}}
 const c=new CourseController(remote);c.set({workspaceId:'ws',courseId:'old-course',task:{id:'old-task'},saveReview:{component:'lesson'},saved:{path:'old'}});await c.createCourse('new');assert.equal(c.state.courseId,'new-course');assert.equal(c.state.task,null);assert.equal(c.state.saveReview,null);assert.equal(c.state.saved,null);c.dispose()
})

test('built Client renders accurate bilingual failures and collapsed allowlisted details without sensitive payloads',()=>{
 const secret='SENSITIVE_UI_DIAGNOSTIC'
 const diagnostic={stage:'stream',reason:'model-provider-error',finishKind:'error',chunks:3,textChars:10,reasoningChars:20,streamChars:200,outputBudget:12000,message:secret,failure:{code:secret},replayState:secret}
 const cases=[
  ['model-incomplete','exact cause was not recorded','具体原因未记录'],
  ['model-max-tokens','output token limit','输出令牌上限'],
  ['model-provider-error','underlying cause is unknown','底层原因尚不明确'],
  ['model-provider-error','underlying cause is unknown','底层原因尚不明确','AUTH'],
  ['model-provider-error','underlying cause is unknown','底层原因尚不明确',secret],
  ['model-provider-aborted','without local cancellation','本地未发起取消'],
  ['model-missing-finish','without a finish record','缺少结束记录'],
  ['model-unknown-finish','unrecognized finish reason','未知结束原因'],
  ['model-unexpected-blocks','tools or unsupported content blocks','工具或不支持的内容块'],
  ['invalid-model-json','not valid JSON','不是有效 JSON'],
  ['output-too-large','local output size cap','本地输出大小上限'],
  ['model-stream-failed','Reading or processing the model stream failed','读取或处理模型流失败'],
  [secret,'exact cause was not recorded','具体原因未记录'],
  ['constructor','exact cause was not recorded','具体原因未记录'],
 ]
 for(const lang of ['en','zh'])for(const [message,en,zh,failureCode] of cases){
  const c=new CourseController({dispatch:()=>assert.fail('render must not invoke remote')})
  c.set({workspaceId:'ws',courseId:'course_fixture',phase:'failed',snapshot:{profile:profile(),courses:[{id:'course_fixture',name:'Synthetic course'}],tasks:[],references:[]},task:{id:'task_fixture',state:'failed',message,diagnostic:message==='model-provider-error'?{...diagnostic,failureCode}:undefined}})
  const react={...React,useState:initial=>React.useState(initial==='en'?lang:initial),useSyncExternalStore:(subscribe,snapshot,server)=>{const value=React.useSyncExternalStore(subscribe,snapshot,server);return value===null?c:value}}
  const {slots}=register(load(react)),main=slots.find(s=>s.opts.name==='main'),html=renderToStaticMarkup(React.createElement(main.component))
  assert.ok(html.includes(lang==='en'?en:zh),message+' '+lang);assert.ok(!html.includes(secret));assert.doesNotMatch(html,/Reduce selected components|请减少组件/)
  if(message==='model-provider-error'){
   assert.match(html,/<details><summary>(Technical diagnostics|技术诊断)<\/summary>/);assert.doesNotMatch(html,/<details[^>]*open/);assert.match(html,/12000/);assert.match(html,/model-provider-error/);assert.doesNotMatch(html,/replayState|<pre/);assert.equal(html.includes(lang==='en'?'Normalized failure code (classification only)':'标准失败码（仅分类）'),failureCode==='AUTH');assert.equal(html.includes('<dd>AUTH</dd>'),failureCode==='AUTH')
  }else assert.doesNotMatch(html,/Technical diagnostics|技术诊断/)
  c.dispose()
 }
})

test('failed task browsing, reconnect and reconciliation are read-only and preserve diagnostics',async()=>{
 const calls=[],diagnostic={stage:'stream',reason:'model-max-tokens',finishKind:'max-tokens',chunks:2,textChars:12,reasoningChars:0,streamChars:150,outputBudget:12000}
 const task={id:'task_fixture',courseId:'course_fixture',state:'failed',message:'model-max-tokens',diagnostic},snapshot={profile:profile(),courses:[{id:'course_fixture',name:'Fixture'}],tasks:[task],references:[]}
 const c=new CourseController({dispatch:async payload=>{
  const raw=JSON.parse(payload),action=raw.request?.action??raw.action;calls.push(action)
  assert.ok(['workspaces','model','snapshot','task'].includes(action))
  const value=action==='workspaces'?{version:VERSION,protocol:PROTOCOL,workspaces:[{id:'ws'}],model:{provider:'fixture',model:'fixture'}}:action==='task'?task:snapshot
  return {ok:true,value:JSON.stringify({ok:true,...(action==='workspaces'?value:{value})})}
 }})
 try{
  await c.boot();await c.workspace('ws');c.course('course_fixture');await c.openTask(task.id);assert.deepEqual(c.state.task.diagnostic,diagnostic)
  c.invalidate();await c.boot();await c.reconcile();await c.refresh();c.course('course_fixture');await c.openTask(task.id)
  assert.equal(c.state.phase,'failed');assert.deepEqual(c.state.task.diagnostic,diagnostic);assert.equal(c.timer,null);assert.ok(calls.includes('task'));assert.ok(!calls.includes('generate'))
 }finally{c.dispose()}
})

test('built Client displays bilingual effective policy and budget before consent; route/policy changes immediately invalidate consent',async()=>{
 const defaultPolicy=policyFor({reasoning:{efforts:[{id:'high'}],defaultEffort:'high'}})
 for(const [policy,en,zh] of [[policyFor({reasoning:{efforts:[{id:'low'}]}}),'Low reasoning (low)','低推理（low）'],[policyFor({reasoning:{efforts:[{id:'off'}]}}),'Reasoning off (off)','关闭推理（off）'],[defaultPolicy,'Adapter default reasoning policy (high)','适配器默认推理策略 (high)'],[policyFor({}),'effort unspecified','强度未声明']])for(const lang of ['en','zh']){
  const calls=[],c=new CourseController({dispatch:()=>{calls.push('unexpected');assert.fail('render/reconfirm must not call remote')}})
  const route={provider:'fixture-provider',model:'fixture-model',policy}
  c.set({runtime:{model:route},workspaceId:'ws',courseId:'course_fixture',phase:'idle',snapshot:{profile:profile(),courses:[{id:'course_fixture',name:'Synthetic'}],tasks:[],references:[{id:'ref_fixture',courseId:'course_fixture',name:'Anonymous',bytes:20,expiresAt:Date.now()+10000}]}})
  const values=[];let cursor=0
  const react={...React,useState:initial=>{const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value}]},useEffect:()=>{},useSyncExternalStore:(_subscribe,snapshot)=>snapshot()??c}
  const {slots}=register(load(react)),panel=slots.find(s=>s.opts.name==='main').component
  const render=()=>{cursor=0;const element=panel();return element.type(element.props)}
  render();values[0]=lang;values[1]=1;values[4]=['ref_fixture']
  const walk=(node,predicate)=>{if(!node||typeof node!=='object')return; if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const match=walk(child,predicate);if(match)return match}}
  const checkbox=tree=>walk(tree,n=>n.props?.className==='consent').props.children[0]
  const generate=tree=>walk(tree,n=>n.type==='button'&&['Generate draft','生成课堂活动草案'].includes(n.props.children))
  let tree=render(),html=renderToStaticMarkup(tree)
  assert.ok(html.includes(lang==='en'?en:zh));assert.match(html,/12000/);assert.match(html,/fixture-provider \/ fixture-model/)
  assert.ok(html.indexOf(lang==='en'?'Output token budget':'输出令牌预算')<html.indexOf('class="consent"'));assert.equal(generate(tree).props.disabled,true)
  checkbox(tree).props.onChange({target:{checked:true}});tree=render();assert.equal(checkbox(tree).props.checked,true);assert.equal(generate(tree).props.disabled,false)
  for(const next of [{...route,provider:'other-provider'},{...route,model:'other-model'},{...route,policy:defaultPolicy},null]){
   if(JSON.stringify(next)===JSON.stringify(route))continue
   c.set({runtime:{model:next}});tree=render();assert.equal(checkbox(tree).props.checked,false);assert.equal(generate(tree).props.disabled,true)
   await assert.rejects(c.generate({},[],true),/model-consent-required/)
   c.set({runtime:{model:route}});tree=render();checkbox(tree).props.onChange({target:{checked:true}})
  }
  c.invalidate();tree=render();assert.equal(checkbox(tree).props.checked,false);assert.equal(generate(tree).props.disabled,true);assert.deepEqual(calls,[]);c.dispose()
 }
})
