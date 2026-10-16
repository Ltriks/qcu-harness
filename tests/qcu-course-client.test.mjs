import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {Script,createContext} from 'node:vm'
import {CourseController} from '../hub/plugins/qcu-course-workbench/src/controller.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json')),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const bundle=await readFile(new URL('../hub/plugins/qcu-course-workbench/client.js',import.meta.url),'utf8')
function load(){let result;new Script(bundle).runInContext(createContext({window:{__ModuleLoader__:{load:({id,factory})=>{assert.equal(id,'qcu-course-workbench');result=factory(name=>{assert.equal(name,'react');return React})}}},setTimeout,clearTimeout,crypto:globalThis.crypto}));return result}
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
 const controller=new CourseController(remote);controller.set({workspaceId:'ws',courseId:'course_x'})
 await assert.rejects(controller.generate({},[],true),/connection lost/);assert.equal(controller.state.phase,'unknown');assert.equal(calls.length,1);assert.equal(calls[0].request.action,'generate');controller.dispose()
})
test('controller synchronously guards double generation clicks and fences late workspace replies',async()=>{
 let resolveReply,count=0;const remote={dispatch:()=>{count++;return new Promise(resolve=>{resolveReply=resolve})}}
 const c=new CourseController(remote);c.set({workspaceId:'ws',courseId:'course_x'});const first=c.generate({},[],true);await c.generate({},[],true);assert.equal(count,1);c.invalidate();resolveReply({ok:true,value:JSON.stringify({ok:true,value:{id:'task_fake',state:'running'}})});await first;assert.equal(c.state.task,null);c.dispose()
})
test('creating a second course clears the first course preview and pending save confirmation',async()=>{
 const remote={dispatch:async payload=>{const request=JSON.parse(payload).request;return {ok:true,value:JSON.stringify({ok:true,value:request.action==='createCourse'?{id:'new-course',name:'new'}:{courses:[{id:'new-course',name:'new'}],tasks:[],references:[]}})}}}
 const c=new CourseController(remote);c.set({workspaceId:'ws',courseId:'old-course',task:{id:'old-task'},saveReview:{component:'lesson'},saved:{path:'old'}});await c.createCourse('new');assert.equal(c.state.courseId,'new-course');assert.equal(c.state.task,null);assert.equal(c.state.saveReview,null);assert.equal(c.state.saved,null);c.dispose()
})
