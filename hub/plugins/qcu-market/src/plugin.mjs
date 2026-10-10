import { loadMarket, copyExample } from './catalog.mjs'
import { iconPaths, sceneIcon } from './icons.mjs'
import { marketStyles } from './styles.mjs'

export function createMarketPlugin(React, source, clipboard) {
  const h = React.createElement
  const PANEL = 'qcu-market'
  const status = { draft: '开发中 · 纯Skill草案', 'not-installed': '尚未提供安装 · 未验证', 'builtin-unverified': '官方内置能力 · 本实例未验证' }
  function Icon({ kind = 'market', size = 20 }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
      ...iconPaths[kind].map((d,i) => h('path', { key: i, d })))
  }
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
    const official = e.kind === 'builtin-guidance'
    return h('article', { className: 'qcu-card', 'aria-labelledby': `qcu-title-${e.id}` },
      h('div', { className: 'qcu-card-top' },
        h('span', { className: 'qcu-icon-tile' }, h(Icon, { kind: sceneIcon(e.category), size: 24 })),
        h('span', { className: 'qcu-badge' }, e.source)),
      h('h2', { id: `qcu-title-${e.id}` }, e.name),
      h('span', { className: 'qcu-status' }, status[e.status]),
      h('p', { className: 'qcu-summary' }, e.summary),
      h('details', { className: 'qcu-guide', 'data-official': String(official) },
        h('summary', { 'aria-label': `${official ? '查看用法' : '了解草案'}：${e.name}` }, official ? '查看用法' : '了解草案'),
        h('div', null,
          h('p', null, official ? '先在当前实例确认官方技能可用，再手动使用下方示例。这里不会安装新包或发送对话。' : '本项仍在开发中。当前仅展示设计说明与示例，未随市场注册或安装；审核、打包与模型效果验证尚未完成。'),
          h('pre', { tabIndex: 0, 'aria-label': `${e.name}的示例` }, e.example),
          h('button', { type: 'button', className: 'qcu-control', onClick: copy, 'aria-disabled': busy, 'aria-busy': busy }, busy ? '正在复制…' : '复制示例'),
          h('p', { role: 'status', 'aria-live': 'polite' }, feedback))),
      h('details', { className: 'qcu-meta' }, h('summary', null, '版本、前提与来源'),
        h('dl', null, ...[
          ['标识', `${e.id} @ ${e.version}`], ['适用版本', e.dshVersions.join(', ')],
          ['前提', e.prerequisites], ['测试状态', e.testStatus], ['权限与风险', e.risk],
          ['来源', e.origin], ['许可', e.license],
        ].flatMap(([label,value]) => [h('dt', { key: label }, label), h('dd', { key: label+'value' }, value)]))))
  }
  function Market({ onBack }) {
    const [category, setCategory] = React.useState('全部')
    const result = loadMarket(source)
    const entries = result.state === 'ready' ? result.catalog.skills : []
    const shown = entries.filter(e => category === '全部' || e.category === category)
    return h('section', { className: 'qcu-market', 'aria-label': 'QCU市场' },
      h('style', null, marketStyles),
      h('div', { className: 'qcu-content' },
        h('button', { type: 'button', className: 'qcu-control', onClick: onBack }, '返回对话'),
        h('header', { className: 'qcu-head' },
          h('div', null, h('div', { className: 'qcu-wordmark' }, h(Icon, { size: 30 }), h('h1', null, 'QCU市场')),
            h('p', { className: 'qcu-intro' }, '从教学场景出发，找到合适的能力与方法。')),
          h('span', { className: 'qcu-badge' }, '教学内容预览 · p2')),
        h('p', { className: 'qcu-note' }, '官方能力可查看用法；QCU自有内容仍在开发中。本页提供说明与示例，暂不提供安装。'),
        result.state === 'offline' ? h('p', { className: 'qcu-error', role: 'alert' }, result.message) : h(React.Fragment, null,
          h('nav', { className: 'qcu-filters', 'aria-label': '教学场景' },
            ...['全部', ...new Set(entries.map(e => e.category))].map(c => h('button', { key: c, type: 'button', className: 'qcu-control', 'aria-pressed': category === c, onClick: () => setCategory(c) }, h(Icon, { kind: sceneIcon(c), size: 16 }), c))),
          h('p', { className: 'qcu-count', role: 'status', 'aria-live': 'polite' }, `${category} · ${shown.length} 项内容`),
          h('div', { className: 'qcu-grid' }, ...shown.map(e => h(Card, { key: e.id, entry: e }))),
          h('p', { className: 'qcu-foot' }, result.catalog.compatible_dsh)),
        h('details', { className: 'qcu-foot' }, h('summary', null, '关于权限与数据'),
          h('p', null, '此Client插件只展示随包目录，不探测安装状态、不读取聊天或密钥。仅点击复制时写入剪贴板；代码运行于Client，并非零风险。远程目录未接通；失败显示离线，不执行远程HTML。'))))
  }
  return {
    inject: ['slots', 'layout'],
    apply(ctx) {
      if (!ctx.slots || !ctx.layout) throw new Error('QCU市场需要官方slots和layout服务')
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, inject: () => ({ onBack: () => ctx.layout.selectPanel(null) }) }, Market))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 30, label: 'QCU市场' }, Icon))
    },
  }
}
