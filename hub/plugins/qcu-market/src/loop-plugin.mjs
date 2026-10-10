import { MarketFlow } from './flow.mjs'
import { iconPaths } from './icons.mjs'
import { marketStyles } from './styles.mjs'
export function createLoopPlugin(React) {
  const h = React.createElement
  function Icon() { return h('svg', { width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true }, ...iconPaths.market.map((d,i)=>h('path',{key:i,d}))) }
  const labels = { unknown:'尚未检查', 'not-installed':'未安装', prepared:'已校验包；尚未安装', 'installed-disabled':'已安装，尚未启用', 'activation-required':'需要启用组件或重启', 'skill-unavailable':'组件已启用，技能尚不可用', ready:'已核验技能可用', conflict:'存在同名或版本冲突', failed:'加载失败', cancelled:'准备已取消' }
  function Market({flow,onBack,onDetails,available}) {
    const [tab,setTab]=React.useState('market'),[result,setResult]=React.useState({state:'unknown'}),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false)
    const alive=React.useRef(true),generation=React.useRef(0)
    React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;if(flow?.busy)void flow.cancel().catch(()=>{})}},[])
    async function action(fn) {
      const n=++generation.current;setBusy(true);setError('')
      try { const value=await fn();if(alive.current&&n===generation.current&&value)setResult(value) }
      catch(e){if(alive.current&&n===generation.current){setResult({state:'unknown'});setError(e.message)}}
      finally{if(alive.current&&n===generation.current)setBusy(false)}
    }
    return h('section',{className:'qcu-market','aria-label':'QCU市场'},h('style',null,marketStyles),h('div',{className:'qcu-content'},
      h('button',{className:'qcu-control',onClick:onBack},'返回对话'),
      h('header',{className:'qcu-head'},h('div',{className:'qcu-wordmark'},h(Icon),h('h1',null,'QCU市场')),h('span',{className:'qcu-badge'},'对话桥接 · 临时原型')),
      h('nav',{className:'qcu-filters','aria-label':'市场与帮助'},h('button',{className:'qcu-control','aria-pressed':tab==='market',onClick:()=>setTab('market')},'可安装内容'),h('button',{className:'qcu-control','aria-pressed':tab==='help',onClick:()=>setTab('help')},'使用帮助')),
      tab==='help'?h('div',{className:'qcu-note'},h('h2',null,'官方 Office 能力'),h('p',null,'office-pptx、office-docx、office-xlsx 是官方提供的能力，是否可用需在当前实例确认。它们不是 QCU 市场安装的新包。'),h('p',null,'安装与启用由官方逐次审批。遇到拒绝、取消、未知结果或重启要求时停止并按官方提示处理；不要重复安装。')):
      h('article',{className:'qcu-card'},h('h2',null,'学习方法教练'),h('p',null,'QCU · qcu-study-coach 0.1.0-pilot.2 · DSH 0.2.0-rc.2 · MIT'),h('p',{className:'qcu-summary'},'拆解任务、安排合理学习节奏、复盘错题。不代写应交作业。'),
        h('p',{role:'status','aria-live':'polite'},labels[result.state]||'未知状态'),
        result.reason?h('p',null,result.reason):null,
        h('p',{className:'qcu-note'},'首次操作创建专用会话，不发送消息、不消耗模型。准备包后，这是临时对话桥接，不是点击直接安装：安装请求会预填到对话中，需要已配置可用模型（及其所需凭据），需你发送并可能消耗模型额度，再由本机用户逐次批准；没有远程官方审核。当前包仅为本地候选，校内 Hub 尚未发布，下载可能失败。真实模型效果仍待合成任务验收。'),
        !available?h('p',{role:'alert'},'缺少官方命令、会话或输入服务；当前不能安装。'):null,
        h('button',{className:'qcu-control',disabled:busy||!available,onClick:()=>action(()=>flow.run('status'))},'检查本实例状态'),
        result.state==='not-installed'?h('button',{className:'qcu-control',disabled:busy,onClick:()=>action(()=>flow.run('prepare'))},'准备安装请求'):null,
        result.state==='prepared'?h('button',{className:'qcu-control',disabled:busy,onClick:()=>action(async()=>{await flow.draft(result.prompt);return result})},'将安装请求填入对话'):null,
        ['installed-disabled','activation-required','skill-unavailable','conflict','failed'].includes(result.state)?h('button',{className:'qcu-control',onClick:()=>action(async()=>{await onDetails()})},'打开官方插件详情'):null,
        result.state==='ready'?h('button',{className:'qcu-control',disabled:busy,onClick:()=>action(async()=>{const latest=await flow.run('status');if(latest.state!=='ready')return latest;await flow.draft('/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。');return latest})},'开始学习（预填任务）'):null,
        busy?h('button',{className:'qcu-control',onClick:()=>{generation.current++;void flow.cancel().then(()=>{if(alive.current){setResult({state:'cancelled'});setBusy(false)}}).catch(e=>{if(alive.current){setError(e.message);setBusy(false)}})}},'取消准备'):null,
        error?h('p',{className:'qcu-error',role:'alert'},error):null,
        h('details',{className:'qcu-meta'},h('summary',null,'权限与来源'),h('p',null,'固定校内源：192.168.1.68:8080。Host仅在请求后下载这一版本，校验大小和SHA256后保存专用缓存；不接受任意URL，不安装或启用。只查询本包状态与目标会话的同名技能正文校验，不读取聊天或密钥。安装本身由官方工具审批，代码运行于Host，非零风险。')))))
  }
  return {inject:['slots','layout'],apply(ctx){
    const available=Boolean(ctx.get('sessions')&&ctx.get('remote')?.commands&&ctx.get('conversation')&&ctx.get('uiWorkspace'))
    const flow=available?new MarketFlow(ctx):null
    ctx.effect(()=>()=>flow?.dispose())
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-market',inject:()=>({flow,available,onBack:()=>ctx.layout.selectPanel(null),onDetails:()=>{const navigation=ctx.get('pluginNavigation');if(navigation)navigation.openBundle('qcu-study-coach');else throw new Error('官方插件详情服务不可用')}})},Market))
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-market',order:30,label:'QCU市场'},Icon))
  }}
}
