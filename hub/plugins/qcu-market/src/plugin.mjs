import { loadMarket, copyExample } from './catalog.mjs'

export function createMarketPlugin(React, source, clipboard) {
  const h = React.createElement
  const PANEL = 'qcu-market'
  const status = { draft: '仅草案', 'not-installed': '待安装（未接通）', 'builtin-unverified': '官方内置能力 · 本实例未验证' }
  const box = { border: '1px solid currentColor', borderRadius: 12, padding: 16, minWidth: 0 }
  function Card({ entry: e }) {
    const [feedback, setFeedback] = React.useState('')
    const [busy, setBusy] = React.useState(false)
    const live = React.useRef(true)
    const pending = React.useRef(false)
    React.useEffect(() => { live.current = true; return () => { live.current = false } }, [])
    async function copy() {
      if (pending.current) return
      pending.current = true
      setBusy(true)
      const result = await copyExample(e.example, clipboard)
      pending.current = false
      if (live.current) { setFeedback(result); setBusy(false) }
    }
    return h('article', { style: box },
      h('small', null, `${e.source} · ${status[e.status]}`),
      h('h3', null, e.name), h('p', null, e.summary),
      h('dl', null, ...[
        ['标识', `${e.id} @ ${e.version}`], ['适用版本', e.dshVersions.join(', ')],
        ['前提', e.prerequisites], ['测试状态', e.testStatus], ['权限与风险', e.risk],
        ['来源', e.origin], ['许可', e.license],
      ].flatMap(([label,value]) => [h('dt', { key: label, style: { fontWeight: 600 } }, label), h('dd', { key: label+'value', style: { margin: '0 0 8px', overflowWrap: 'anywhere' } }, value)])),
      h('p', null, e.kind === 'builtin-guidance' ? '使用指导：先在当前实例确认官方能力，无需从本市场下载新包。' : '草案需教师审核及独立安装验收后才能使用。'),
      h('details', null, h('summary', null, '使用示例'),
        h('pre', { style: { whiteSpace: 'pre-wrap', userSelect: 'text' }, tabIndex: 0 }, e.example),
        h('button', { type: 'button', onClick: copy, disabled: busy }, busy ? '正在复制…' : '复制示例'),
        h('p', { role: 'status' }, feedback)),
      h('button', { type: 'button', disabled: true }, '安装 / 启用 / 升级：未接通'))
  }
  function Market({ onBack }) {
    const [category, setCategory] = React.useState('全部')
    const result = loadMarket(source)
    return h('section', { 'aria-label': 'QCU市场', style: { padding: 24, height: '100%', overflow: 'auto', boxSizing: 'border-box', color: 'inherit', background: 'inherit' } },
      h('button', { type: 'button', onClick: onBack }, '返回对话'),
      h('h1', null, 'QCU市场'),
      h('p', null, '教学内容与能力指南 · 本地浏览原型'),
      h('p', null, '此Client插件只展示随包目录；不探测安装状态、不读取聊天或密钥。复制仅在点击后写入剪贴板。UI代码仍运行于Client，不等于无风险。'),
      result.state === 'offline' ? h('p', { role: 'alert' }, result.message) : h(React.Fragment, null,
        h('p', null, result.catalog.compatible_dsh),
        h('nav', { 'aria-label': '教学场景', style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 } },
          ...['全部', ...new Set(result.catalog.skills.map(e => e.category))].map(c => h('button', { key: c, type: 'button', 'aria-pressed': category === c, onClick: () => setCategory(c) }, c))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 } },
          ...result.catalog.skills.filter(e => category === '全部' || e.category === category).map(e => h(Card, { key: e.id, entry: e }))),
        h('p', null, '远程入口尚未接通；未来仅接审核固定的Hub来源与版本哈希，失败显示离线，不执行远程HTML。')))
  }
  function Icon({ size = 18 }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'aria-hidden': true },
      h('path', { d: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16' }))
  }
  return {
    inject: ['slots', 'layout'],
    apply(ctx) {
      if (!ctx.slots || !ctx.layout) throw new Error('QCU市场需要官方slots和layout服务')
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, inject: () => ({ onBack: () => ctx.layout.selectPanel(null) }) }, Market))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 30, label: 'QCU市场' }, Icon))
      // slots.inject owns each registration's returned disposer, as in the official template.
    },
  }
}
