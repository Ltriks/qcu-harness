// Real React server rendering supplements (and does not replace) Chromium geometry tests.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {createMarketViews} from '../hub/plugins/qcu-market/src/market-view.mjs'
import {createTeacherViews} from '../hub/plugins/qcu-market/src/teacher-view.mjs'
import {createPreviewFixture} from '../hub/plugins/qcu-market/preview-fixture.mjs'
import {guideSteps} from '../hub/plugins/qcu-market/src/teacher-tools.mjs'
const require=createRequire(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES,'package.json'))
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {Guide}=createTeacherViews(React)
const nodes=el=>!React.isValidElement(el)?[]:[el,...React.Children.toArray(el.props.children).flatMap(nodes)]
const action=(tree,text)=>nodes(tree).find(el=>el.type==='button'&&el.props.children===text).props

test('real shared home renders ten navigation-only cards, separate exit and optional guide without RPC',()=>{
 const fixture=createPreviewFixture(),ready={flows:fixture.flows,onDetails(){}}
 try{
  const {MarketPage}=createMarketViews(React)
  const html=renderToStaticMarkup(React.createElement(MarketPage,{availability:{snapshot:()=>ready,subscribe:()=>()=>{}},onBack(){}}))
  assert.equal((html.match(/class="qcu-product"/g)||[]).length,10)
  assert.equal((html.match(/← 返回对话/g)||[]).length,1)
  assert.ok(html.indexOf('← 返回对话')<html.indexOf('aria-label="教学辅助"'))
  for(const name of ['home','guide','tasks','feedback'])assert.ok(html.includes(`data-aux="${name}"`))
  assert.match(html,/首次使用指引/);assert.match(html,/开始浏览引导/)
  assert.doesNotMatch(html,/下载并查看安装确认|确认启用|aria-current="step"/)
  assert.equal((html.match(/状态待检查/g)||[]).length,10)
  assert.deepEqual(fixture.calls,[])
 }finally{fixture.flows.forEach(flow=>flow.dispose())}
})

test('each guide step renders all five labelled stages and exactly one accessible current step',()=>{
 for(let step=0;step<guideSteps.length;step++){
  const tree=Guide({state:{step,done:false},setState(){},onHome(){}}),all=nodes(tree)
  const stages=all.filter(el=>el.type==='li')
  assert.equal(stages.length,5)
  assert.equal(stages.filter(el=>el.props['aria-current']==='step').length,1)
  assert.equal(stages[step].props['aria-current'],'step')
  assert.equal(all.find(el=>el.props.id==='qcu-step-title').props.children,guideSteps[step].title)
  const html=renderToStaticMarkup(tree)
  for(const stage of guideSteps)assert.ok(html.includes(stage.title))
  assert.ok(html.includes(guideSteps[step].action))
  assert.match(html,/不代表已验收/);assert.match(html,/由你手动操作/)
  assert.equal(action(tree,'上一步').disabled,step===0)
 }
})

test('guide previous/next/skip/finish preserve browsed-only meaning and the reentry step',()=>{
 const changes=[];let exits=0
 const state={step:2,done:false},tree=Guide({state,setState:s=>changes.push(s),onHome:()=>exits++})
 action(tree,'下一步').onClick();action(tree,'上一步').onClick();action(tree,'稍后再看').onClick()
 assert.deepEqual(changes,[{step:3,done:false},{step:1,done:false}]);assert.equal(exits,1)
 const final=Guide({state:{step:4,done:false},setState:s=>changes.push(s),onHome:()=>exits++})
 action(final,'完成引导').onClick()
 assert.deepEqual(changes.at(-1),{step:4,done:true});assert.equal(exits,2)
 const revisited=Guide({state:{step:4,done:true},setState:s=>changes.push(s),onHome(){}})
 assert.match(renderToStaticMarkup(revisited),/已浏览引导（不代表已验收）/)
 action(revisited,'上一步').onClick();assert.deepEqual(changes.at(-1),{step:3,done:true})
})
