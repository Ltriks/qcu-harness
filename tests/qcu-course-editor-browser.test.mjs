// Real shared React UI + controller + Host store/exports. Preview generator is synthetic only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve,join} from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
import {lessonInput} from './support/course-fixture.mjs'
import {newId} from '../hub/plugins/qcu-course-workbench/src/store.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json')),{chromium}=require('playwright')
const url=process.env.QCU_COURSE_PREVIEW_URL,out=resolve('.work/review-stability/browser')
if(!url)throw Error('Start the synthetic preview and set QCU_COURSE_PREVIEW_URL')
async function dispatch(request){const response=await fetch(url+'/preview/dispatch',{method:'POST',body:JSON.stringify(request)}),result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));return result.value??result}
const send=request=>dispatch({workspaceId:'synthetic-workspace',request})
test('real editor: bilingual item boundaries, full phase/quiz edits, invalid inputs, apply/discard, hash/save invalidation and responsive themes',async t=>{
 const course=await send({action:'createCourse',requestId:newId('request'),name:'Synthetic review '+newId('course').slice(-8)})
 const input=lessonInput({topic:'Quadratic functions · 二次函数',components:['ppt','guide','ticket','inter']})
 const ref=await send({action:'addReference',courseId:course.id,requestId:newId('request'),name:'self-authored.txt',base64:Buffer.from('Self-authored anonymous quadratic example: y=x²−4x+3.').toString('base64')})
 const {model}=await dispatch({action:'model'})
 let task=await dispatch({workspaceId:'synthetic-workspace',request:{action:'generate',courseId:course.id,requestId:newId('request'),sessionId:newId('session'),input,referenceIds:[ref.id],consent:true},expectedModel:model})
 for(let n=0;n<50&&task.state==='running';n++){await new Promise(r=>setTimeout(r,20));task=await send({action:'task',courseId:course.id,taskId:task.id})}
 assert.equal(task.state,'succeeded');const original=structuredClone(task)
 const browser=await chromium.launch({headless:true,...(process.env.QCU_BROWSER_EXECUTABLE?{executablePath:process.env.QCU_BROWSER_EXECUTABLE}:{})});t.after(()=>browser.close());await mkdir(out,{recursive:true})
 const page=await browser.newPage({viewport:{width:1120,height:900}}),errors=[],outside=[],actions=[];page.setDefaultTimeout(8000)
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.route('**/*',route=>{const request=route.request();if(!request.url().startsWith(url+'/')){outside.push(request.url());return route.abort()}if(request.method()==='POST'){const raw=request.postDataJSON();actions.push(raw.request?.action??raw.action)}return route.continue()})
 const button=name=>page.getByRole('button',{name,exact:true}),field=name=>page.getByLabel(name,{exact:true})
 const expand=async name=>{const summary=page.locator('summary').filter({hasText:new RegExp('^'+name+'$')});if(!await summary.evaluate(el=>el.parentElement.open))await summary.click()}
 const state=()=>page.evaluate(()=>window.qcuCoursePreview.state)
 await page.goto(url);await page.getByText('Choose a workspace to browse existing drafts.',{exact:true}).waitFor();assert.equal(await page.getByText(/generation timed out/).count(),0)
 await field('DSH workspace').selectOption('synthetic-workspace');await button(course.name).click();await page.locator('.task-button').first().click()
 t.diagnostic('Opened stored synthetic draft');await button('Review save location').waitFor();assert.equal((await state()).task.id,task.id)
 await expand('Edit draft content');await field('Lesson title').fill('Reviewed quadratics · 已审阅二次函数')
 await expand('Learning intentions');const bilingual='Explain the vertex in English.\n用中文解释顶点。';await field('Learning intentions 1').fill(bilingual)
 await expand('Success criteria');await field('Success criteria 1').fill('Justify the vertex.\n说明顶点依据。')
 await expand('Vocabulary');await field('Vocabulary 1').fill('Vertex — turning point.\n顶点：抛物线的转折点。')
 await expand('Lesson sequence');await field('Phase 1 title').fill('Starter Q1 · 导入 Q1');await field('Phase 1 teacher actions').fill('Ask Q1, y at x=0; answer 3.\n提问 Q1：x=0 时 y=3。');await field('Phase 1 student actions').fill('Substitute and explain.\n代入并解释。');await field('Phase 1 evidence').fill('Correct substitution.\n代入正确。')
 await field('Phase 1 minutes').fill('');assert.equal(await field('Phase 1 minutes').inputValue(),'');assert.equal(await button('Apply edits').isDisabled(),true);assert.equal(await button('Review save location').isDisabled(),true);await page.getByRole('alert').filter({hasText:'Each phase needs positive whole minutes'}).waitFor()
 await field('Phase 1 minutes').fill('6');await page.getByRole('alert').filter({hasText:'must sum'}).waitFor();assert.equal(await button('Apply edits').isDisabled(),true)
 await field('Phase 1 minutes').fill('5');assert.equal(await button('Apply edits').isDisabled(),false)
 t.diagnostic('Validated blank and incorrect phase timing');
 // Pending edits are shared across tabs; question/phase/component counts stay fixed.
 await button('Interactive Quiz').click();await field('Component title').fill('Reviewed quiz · 已审阅测验');await expand('Section 1');await field('Section 1 heading').fill('Quiz instructions · 测验说明');await field('Section 1 body').fill('Answer Q1 and explain.\n回答 Q1 并解释。')
 await expand('Quiz question 1');await field('Question 1').fill('Q1. Vertex of (x−2)²−1?\n顶点是？');await field('Question 1 option A').fill('(0,−1)');await field('Question 1 option B').fill('(2,−1)');await field('Question 1 option C').fill('(−2,−1)');await field('Question 1 option D').fill('(2,1)');await field('Question 1 correct answer').selectOption('1');await field('Question 1 explanation').fill('At x=2 the square is zero, so y=−1.\nx=2 时平方为零。')
 const quiz=page.frameLocator('iframe');await quiz.getByRole('heading',{name:'Q1. Vertex of (x−2)²−1? 顶点是？'}).waitFor();await quiz.getByRole('button',{name:'(2,−1)',exact:true}).click();await quiz.getByRole('status').filter({hasText:'Correct'}).waitFor()
 await button('Lesson plan').click();assert.equal(await field('Learning intentions 1').inputValue(),bilingual);assert.equal(await field('Phase 1 title').inputValue(),'Starter Q1 · 导入 Q1')
 const beforeApply=(await state()).task.draftHash;await button('Apply edits').click();await page.waitForFunction(hash=>window.qcuCoursePreview.state.task.draftHash!==hash,beforeApply)
 const committed=(await state()).task;assert.notEqual(committed.draftHash,original.draftHash);assert.equal(committed.draft.intentions.length,original.draft.intentions.length);assert.equal(committed.draft.intentions[0],bilingual);assert.equal(committed.draft.sequence.length,original.draft.sequence.length);assert.equal(committed.draft.quiz.length,original.draft.quiz.length);assert.deepEqual(committed.draft.components.map(c=>c.id),original.draft.components.map(c=>c.id));assert.equal(committed.draft.quiz[0].answer,1)
 await button('Review save location').click();await page.getByRole('dialog',{name:'Confirm save'}).waitFor();await button('Interactive Quiz').click();assert.equal(await page.getByRole('dialog').count(),0)
 await button('Review save location').click();await button('Save new version').click();await page.locator('.status').filter({hasText:'Saved and verified:'}).waitFor()
 await field('Component title').fill('Discard this temporary title');assert.equal(await page.locator('.status').filter({hasText:'Saved and verified:'}).count(),0);assert.equal(await button('Review save location').isDisabled(),true)
 await button('Discard edits').click();assert.equal(await field('Component title').inputValue(),'Reviewed quiz · 已审阅测验');assert.equal((await state()).task.draftHash,committed.draftHash)
 await button('Review save location').click();await field('Component title').fill('Another unsaved title');assert.equal(await page.getByRole('dialog').count(),0);await button('Discard edits').click()
 const metrics=[]
 for(const theme of ['light','dark'])for(const width of [360,1120]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
  const fit=await page.locator('.qcu-course').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,docOverflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(el).backgroundColor}));assert.equal(fit.overflow,false);assert.equal(fit.docOverflow,false);metrics.push({theme,width,...fit})
  await expand('Quiz question 1');await page.frameLocator('iframe').getByRole('heading',{level:1}).waitFor();await page.locator('.qcu-course').evaluate(el=>el.style.height='auto');await page.locator('iframe').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,`editor-${theme}-${width}.png`),fullPage:true});await page.locator('.qcu-course').evaluate(el=>el.style.removeProperty('height'))
 }
 await button('中文').click();await field('组件标题').waitFor();await page.locator('summary').filter({hasText:'测验题 1'}).waitFor();await button('课堂活动草案').click();await field('课堂标题').waitFor();assert.equal(await field('学习目标 1').inputValue(),bilingual)
 assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.equal(actions.filter(a=>a==='generate').length,0);assert.equal(actions.filter(a=>a==='revise').length,1);assert.equal(actions.filter(a=>a==='save').length,1)
 await writeFile(join(out,'results.json'),JSON.stringify({metrics,actions,errors,outside,taskId:committed.id,originalHash:original.draftHash,revisedHash:committed.draftHash},null,2))
})
