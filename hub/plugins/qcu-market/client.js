// Generated QCU market pilot.3.1; fixed Host command bridge, no model submission.
window.__ModuleLoader__.load({id:'qcu-market',factory(require){
const React=require('react');
class MarketFlow {
  constructor(ctx) { this.ctx = ctx; this.session = null; this.opening = null; this.busy = false; this.disposed = false; this.operation = 0 }
  async scope() {
    if (this.disposed) throw new Error('Market closed')
    if (!this.opening) this.opening = (async () => {
      const id = await this.ctx.sessions.create()
      if (this.disposed) throw new Error('Market closed')
      this.session = this.ctx.sessions.retain(id, { source: 'qcu-market' })
      return this.session.ready
    })().catch(e => { this.session?.release(); this.session = null; this.opening = null; throw e })
    return this.opening
  }
  async command(action, operation) {
    const binding = await this.scope()
    if (this.disposed || (operation !== undefined && operation !== this.operation)) throw new Error('Operation cancelled')
    const answer = await this.ctx.remote.commands.execute(binding.sessionId, `/qcu-market ${action}`, [])
    if (!answer.ok) throw new Error(answer.error?.message || 'Host unavailable')
    const result = answer.value?.result
    if (!result || result.kind !== 'success') throw new Error(result?.text || 'QCU Host command unavailable')
    return JSON.parse(result.text)
  }
  async run(action) {
    if (this.busy) throw new Error('Operation already in progress')
    this.busy = true; const operation = ++this.operation
    try {
      const result = await this.command(action, operation)
      if (this.disposed || operation !== this.operation) throw new Error('Operation cancelled')
      return result
    } finally { this.busy = false }
  }
  async draft(text) {
    const binding = await this.scope()
    if (this.disposed) throw new Error('Market closed')
    const input = this.ctx.conversation.input.for(binding.ctx)
    // This is a dedicated user-created market session; never overwrite an existing draft.
    const state = input.state.getSnapshot()
    if (state.draft || state.attachmentIds?.length || state.queue?.length || state.phase !== 'plain') throw new Error('Finish or clear the market session draft before continuing')
    input.setDraft(text)
    this.ctx.uiWorkspace.openSession(binding.sessionId)
    this.ctx.layout.selectPanel(null)
    // Deliberately no submit(): only the person can send the draft and start model work.
  }
  async cancel() {
    ++this.operation
    if (this.session) return this.command('cancel')
    return { state: 'cancelled' }
  }
  dispose() { this.disposed = true; ++this.operation; if (this.session) { if (this.busy) void this.ctx.remote.commands.execute(this.session.sessionId, '/qcu-market cancel', []).catch(() => {}); this.session.release() }; this.session = null }
}

// Original QCU line drawings, MIT. Generic learning symbols; not a school crest.
const iconPaths = {
  market: ['M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z', 'M12 6v15'],
  lesson: ['M4 4h16v12H4z', 'M8 21l4-5 4 5M8 8h8M8 12h5'],
  slides: ['M4 3h16v14H4z', 'M12 17v4M8 21h8M8 7h8M8 11h5'],
  document: ['M6 3h8l4 4v14H6z', 'M14 3v5h4M9 12h6M9 16h6'],
  data: ['M4 4h16v16H4z', 'M4 10h16M10 4v16M14 14h3M14 17h3'],
  reading: ['M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3z', 'M12 7v14M6 9h3M6 13h3M15 9h3M15 13h3'],
  integrity: ['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z', 'M8 12l3 3 5-6'],
}
function sceneIcon(category) {
  return ({'备课与课堂活动':'lesson','课件制作':'slides','教学文档':'document','匿名教学数据':'data','阅读笔记与复习':'reading','学术诚信与引用':'integrity'})[category] ?? 'market'
}

// Scoped to our slot; official rc.2 semantic tokens inherit the user's theme.
const marketStyles = `
.qcu-market { box-sizing:border-box;height:100%;overflow:auto;padding:28px clamp(20px,4vw,48px) 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit; }
.qcu-market * { box-sizing:border-box; }
.qcu-market .qcu-content { max-width:1280px;margin:0 auto; }
.qcu-market .qcu-head { display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:24px 0; }
.qcu-market .qcu-wordmark { display:flex;align-items:center;gap:12px; }
.qcu-market h1 { margin:0;font-size:24px;line-height:32px;font-weight:600; }
.qcu-market h2 { margin:0;font-size:16px;line-height:24px;font-weight:600; }
.qcu-market p { line-height:1.6; }
.qcu-market .qcu-intro { margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:14px; }
.qcu-market .qcu-note { padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);font-size:13px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-filters { display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 12px; }
.qcu-market button,.qcu-market summary { font:inherit; }
.qcu-market .qcu-control { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px;line-height:20px; }
.qcu-market .qcu-control:hover { background:var(--dsw-alias-interactive-bg-hover); }
.qcu-market .qcu-control:active { background:var(--dsw-alias-interactive-bg-active); }
.qcu-market .qcu-control[aria-pressed="true"] { background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border);color:var(--dsw-alias-brand-text); }
.qcu-market :is(button,summary,pre,input):focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px; }
.qcu-market .qcu-count { color:var(--dsw-alias-label-secondary);font-size:13px;margin:0 0 20px; }
.qcu-market .qcu-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;align-items:start; }
.qcu-market .qcu-card { min-width:0;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1); }
.qcu-market .qcu-card-top { display:flex;align-items:center;gap:12px;margin-bottom:12px; }
.qcu-market .qcu-icon-tile { display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border-radius:12px;color:var(--dsw-alias-brand-text);background:var(--dsw-alias-button-ghost-active-fill); }
.qcu-market .qcu-badge { padding:4px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px; }
.qcu-market .qcu-status { display:block;margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px; }
.qcu-market .qcu-summary { margin:0 0 18px;font-size:14px; }
.qcu-market details { margin-top:12px; }
.qcu-market summary { cursor:pointer;line-height:22px; }
.qcu-market .qcu-guide > summary { padding:9px 12px;border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-size:14px;font-weight:500; }
.qcu-market .qcu-guide[data-official="true"] > summary { color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill); }
.qcu-market .qcu-guide[data-official="true"] > summary:hover { background:var(--dsw-alias-button-primary-hover); }
.qcu-market .qcu-guide > div { padding:4px 0; }
.qcu-market .qcu-guide p { font-size:13px;color:var(--dsw-alias-label-secondary); }
.qcu-market pre { white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;padding:12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font:inherit;font-size:13px;line-height:1.6; }
.qcu-market .qcu-meta { border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;font-size:12px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-meta dt { margin-top:12px;font-weight:600; }
.qcu-market .qcu-meta dd { margin:4px 0;overflow-wrap:anywhere;line-height:1.6; }
.qcu-market .qcu-foot { margin:24px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-error { padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:12px;color:var(--dsw-alias-state-error-primary); }
 .qcu-market .qcu-search { display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:24px;font-size:13px; }
.qcu-market .qcu-search input { min-width:0;flex:1 1 220px;max-width:440px;height:38px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit; }
.qcu-market .qcu-search input::placeholder { color:var(--dsw-alias-label-secondary); }
.qcu-market .qcu-card-heading { min-width:0; }
.qcu-market .qcu-icon-tile[data-scene="data"],.qcu-market .qcu-icon-tile[data-scene="integrity"] { color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary); }
.qcu-market .qcu-icon-tile[data-scene="lesson"],.qcu-market .qcu-icon-tile[data-scene="reading"] { color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-secondary); }
@media (max-width:560px) { .qcu-market .qcu-head { flex-direction:column; } .qcu-market .qcu-card { padding:16px; } }
`

function createLoopPlugin(React) {
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

return createLoopPlugin(React);
}});
