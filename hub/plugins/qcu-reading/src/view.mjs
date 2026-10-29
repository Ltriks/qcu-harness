import {LIMITS, errors} from './protocol.mjs'
import {citationParts, sourceReview, statusLabel} from './reports.mjs'

export const readingCSS = `
.qr{--qr-bg:#f7fafd;--qr-surface:#fff;--qr-ink:#17324d;--qr-muted:#48617a;--qr-accent:#174f91;--qr-line:#d9e5ee;--qr-selected:#e5effa;--qr-alert:#8a3a16;color-scheme:light;background:var(--qr-bg);color:var(--qr-ink);font-family:inherit;font-size:var(--dsh-content-font-size,14px);height:100%;min-height:300px;display:flex;flex-direction:column;text-align:left;line-height:1.55}
@media(prefers-color-scheme:dark){.qr{--qr-bg:#17212c;--qr-surface:#202e3c;--qr-ink:#e4edf6;--qr-muted:#b0c4d8;--qr-accent:#9bc7ff;--qr-line:#41576d;--qr-selected:#2c4560;--qr-alert:#ffbe98;color-scheme:dark}}
:where([data-theme=dark],.dark) .qr,.qr[data-theme=dark]{--qr-bg:#17212c;--qr-surface:#202e3c;--qr-ink:#e4edf6;--qr-muted:#b0c4d8;--qr-accent:#9bc7ff;--qr-line:#41576d;--qr-selected:#2c4560;--qr-alert:#ffbe98;color-scheme:dark}
:where([data-theme=light]) .qr,.qr[data-theme=light]{--qr-bg:#f7fafd;--qr-surface:#fff;--qr-ink:#17324d;--qr-muted:#48617a;--qr-accent:#174f91;--qr-line:#d9e5ee;--qr-selected:#e5effa;--qr-alert:#8a3a16;color-scheme:light}
.qr *{box-sizing:border-box;min-width:0}.qr button,.qr input,.qr textarea,.qr select{font:inherit;color:inherit}.qr button,.qr select,.qr input,.qr textarea{border:1px solid var(--qr-line);border-radius:5px;background:var(--qr-surface);padding:.4em .65em}.qr button{cursor:pointer;white-space:normal}.qr button:hover:not(:disabled){background:var(--qr-selected)}.qr button:disabled{opacity:.55;cursor:default}.qr :focus-visible{outline:2px solid var(--qr-accent);outline-offset:2px}.qr .qr-primary{background:var(--qr-accent);color:var(--qr-surface);border-color:var(--qr-accent)}.qr .qr-primary:hover:not(:disabled){background:var(--qr-ink);color:var(--qr-surface)}.qr button[aria-pressed=true]{background:var(--qr-selected);border-color:var(--qr-accent)}
.qr h1,.qr h2,.qr h3,.qr p{margin:0}.qr h1{font-size:1.15em}.qr h2{font-size:1.05em}.qr h3{font-size:1em}.qr small,.qr .qr-muted{color:var(--qr-muted);font-size:.88em}.qr-header{display:flex;align-items:center;gap:16px;padding:10px 14px;border-bottom:1px solid var(--qr-line);flex-wrap:wrap}.qr-header label{display:flex;align-items:center;gap:8px;margin-left:auto}.qr-header select{max-width:240px}.qr-header .qr-back{margin-right:4px}.qr-banner{padding:8px 14px;border-bottom:1px solid var(--qr-line);overflow-wrap:anywhere}.qr-error{color:var(--qr-alert)}.qr-layout{display:grid;grid-template-columns:180px minmax(0,1.15fr) minmax(285px,1fr);flex:1;min-height:0}.qr-materials,.qr-reader,.qr-qa{overflow:auto;padding:14px;overflow-wrap:anywhere}.qr-materials,.qr-reader{border-right:1px solid var(--qr-line)}.qr-materials{padding:12px 10px}.qr-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.qr-import{display:block;width:100%;margin:10px 0 6px}.qr-file{display:none}.qr-docs{list-style:none;margin:14px 0 0;padding:0}.qr-docs li+li{margin-top:4px}.qr-docs button{display:block;width:100%;text-align:left;border-color:transparent;background:transparent}.qr-docs strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500}.qr-docs small{display:block}.qr-title{margin-bottom:12px}.qr-title h2{overflow-wrap:anywhere}.qr-search{display:flex;gap:6px;margin:12px 0}.qr-search input{width:100%}.qr-results{display:grid;gap:6px;margin-bottom:16px}.qr-results button{text-align:left}.qr-paragraph{padding:10px 10px 12px;margin:4px 0;border-left:3px solid transparent;scroll-margin-top:14px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.qr-paragraph[data-selected=true]{border-left-color:var(--qr-accent);background:var(--qr-selected)}.qr-locator{display:block!important;color:var(--qr-accent)!important;font-size:.8em!important;padding:1px 6px!important;margin-bottom:5px!important;background:transparent!important}.qr-paragraph p{white-space:pre-wrap}.qr label.qr-field{display:grid;gap:6px;margin:12px 0}.qr textarea{display:block;resize:vertical;width:100%;min-height:74px;line-height:1.6}.qr-question{min-height:96px!important}.qr pre,.qr blockquote{white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;font:inherit;margin:8px 0;padding:9px 10px;border-left:2px solid var(--qr-line);background:var(--qr-bg)}.qr details{margin:14px 0}.qr summary{cursor:pointer;color:var(--qr-muted)}.qr-confirm{padding:12px 0;border-top:2px solid var(--qr-accent);margin-top:18px}.qr-confirm dl{margin:10px 0}.qr-confirm dt{color:var(--qr-muted);font-size:.88em}.qr-confirm dd{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}.qr-consent{display:flex;align-items:flex-start;gap:8px;margin:14px 0}.qr-consent input{flex:none;margin-top:5px}.qr-answer{white-space:pre-wrap;margin-top:12px;line-height:1.8}.qr-citation{display:inline;padding:0 .3em!important;color:var(--qr-accent)!important}.qr-unknown{text-decoration:underline dotted;color:var(--qr-alert)}.qr-run{margin-top:18px;padding-top:14px;border-top:1px solid var(--qr-line)}.qr-history{display:grid;gap:6px;margin-top:10px}.qr-history button{text-align:left}.qr-history small{display:block}.qr-note{border-top:1px solid var(--qr-line);padding:10px 0}.qr-empty{max-width:38em;padding:28px 14px}.qr-empty p{margin:10px 0;color:var(--qr-muted)}.qr-tabs{display:none}.qr-note-editor{border-top:1px solid var(--qr-line);margin-top:18px;padding-top:12px}.qr-identity{overflow-wrap:anywhere;user-select:all}
.qr-search button{flex:none;white-space:nowrap}
@media(max-width:960px){.qr-layout{grid-template-columns:160px minmax(0,1fr)}.qr-tabs{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--qr-line)}.qr-layout[data-pane=original] .qr-qa,.qr-layout[data-pane=qa] .qr-reader{display:none}.qr-reader{border-right:0}.qr-qa{border-right:0}.qr-header label{margin-left:0}.qr-header{gap:10px}}
@media(max-width:600px){.qr-layout{grid-template-columns:minmax(0,1fr)}.qr-materials{display:none;max-height:260px;border-right:0;border-bottom:1px solid var(--qr-line)}.qr-layout[data-materials=true] .qr-materials{display:block}.qr-layout[data-materials=true]{grid-template-rows:auto minmax(0,1fr)}.qr-header{padding:10px}.qr-header label{width:100%}.qr-header select{flex:1;max-width:100%}.qr-reader,.qr-qa{padding:12px}.qr-tabs{padding:8px 10px}.qr-paragraph{padding:8px 6px}.qr-title h2{font-size:1em}}
`

export function createReadingViews(React) {
  const h = React.createElement
  const button = (label, onClick, props = {}) => h('button', {type:'button', onClick, ...props}, label)
  function download({filename, markdown}) {
    const url = URL.createObjectURL(new Blob([markdown], {type:'text/markdown;charset=utf-8'})), a = document.createElement('a')
    a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function Page({controller:c, onBack}) {
    const s = React.useSyncExternalStore(c.subscribe, c.snapshot, c.snapshot)
    const fileRef = React.useRef(null), rootRef = React.useRef(null), confirmRef = React.useRef(null), prepareRef = React.useRef(null)
    React.useEffect(() => {
      if (s.selected && s.pane === 'original') rootRef.current?.querySelector('[data-locator="' + s.selected + '"]')?.scrollIntoView({block:'nearest'})
    }, [s.selected, s.document?.id, s.pane])
    React.useEffect(() => { if (s.prepared) confirmRef.current?.focus() }, [s.prepared?.id])
    const doc = s.document, disabled = s.busy || !s.workspaceId || s.loading
    const dismiss = () => { c.forgetConfirmation(); prepareRef.current?.focus() }
    const active = s.runs.find(r => r.status === 'running')
    function runView(run) {
      const review = sourceReview(run.answer, run.sources)
      return h('section', {className:'qr-run', 'aria-label':'问答记录'},
        h('div', {className:'qr-toolbar'}, h('h3', {}, statusLabel(run.status)), button('导出 Markdown', () => void c.exportRun(run.id, download), {disabled:s.busy}), run.status === 'running' && button('取消问答', () => void c.cancel(run.id), {disabled:s.busy})),
        h('small', {}, run.document.name + ' · ' + run.document.id.slice(0, 12)),
        h('p', {}, run.question),
        run.status !== 'completed' && h('p', {className:'qr-error', role:'status'}, run.status === 'running' ? '正在生成，尚无完整回答。' : errors[run.error] ?? '本记录不完整。'),
        h('div', {className:'qr-answer'}, ...citationParts(run.answer, run.sources).map((part, i) => part.sourceId
          ? button(part.text, () => void c.cite(run, run.sources.find(source => source.id === part.sourceId)), {key:i, className:'qr-citation', 'aria-label':'定位来源 ' + part.sourceId})
          : h('span', {key:i, className:part.unknown ? 'qr-unknown' : undefined}, part.text))),
        h('p', {className:'qr-muted'}, review.needsReview ? '来源待核对：回答缺少合法引用或包含未知引用。' : '引用标记可定位到原文，内容正确性仍待教师复核。'),
        h('details', {}, h('summary', {}, '本次来源与模型'),
          h('p', {}, run.route.model + ' / ' + run.route.provider),
          ...run.sources.map(source => h('div', {key:source.id}, button('[' + source.id + '] ' + source.locator, () => void c.cite(run, source)), h('pre', {}, source.text))))
      )
    }
    return h('div', {className:'qr', ref:rootRef}, h('style', {}, readingCSS),
      h('header', {className:'qr-header'}, onBack && button('返回对话', onBack, {className:'qr-back'}), h('h1', {}, '材料伴读'),
        h('label', {}, '工作区', h('select', {value:s.workspaceId, 'aria-label':'工作区', onChange:e => void c.selectWorkspace(e.target.value)}, h('option', {value:''}, '请选择工作区'), ...s.workspaces.map(w => h('option', {value:w.id, key:w.id}, w.title))))),
      s.error && h('div', {className:'qr-banner qr-error', role:'alert'}, s.error),
      s.notice && h('div', {className:'qr-banner', role:'status'}, s.notice),
      s.loading && h('div', {className:'qr-banner', role:'status'}, '正在读取本地材料…'),
      !s.workspaceId ? h('section', {className:'qr-empty'}, h('h2', {}, '先选择一个工作区'), h('p', {}, '材料快照、摘录和问答将保存在该工作区。')) : h(React.Fragment, {},
        h('nav', {className:'qr-tabs', 'aria-label':'阅读视图'}, button('材料', () => c.set({showMaterials:!s.showMaterials}), {'aria-expanded':s.showMaterials}), button('原文', () => c.set({pane:'original'}), {'aria-pressed':s.pane === 'original'}), button('问答', () => c.set({pane:'qa'}), {'aria-pressed':s.pane === 'qa'})),
        h('div', {className:'qr-layout', 'data-pane':s.pane, 'data-materials':s.showMaterials},
          h('aside', {className:'qr-materials', 'aria-label':'材料列表'}, h('h2', {}, '本地材料'),
            button('导入材料', () => fileRef.current?.click(), {className:'qr-import qr-primary', disabled}),
            h('input', {ref:fileRef, className:'qr-file', type:'file', accept:'.txt,.md', 'aria-label':'选择 TXT 或 Markdown 文件', onChange:e => { const file = e.target.files[0]; e.target.value = ''; if (file) void c.importFile(file) }}),
            h('small', {}, 'UTF-8 TXT / Markdown · 每份最多 256 KiB'), h('details', {}, h('summary', {}, '格式说明'), h('small', {}, 'PDF、DOCX 和扫描件 OCR 尚不支持，已列入后续计划。Markdown 以纯文本显示。')),
            h('ul', {className:'qr-docs'}, ...s.documents.map(d => h('li', {key:d.id}, button(h(React.Fragment, {}, h('strong', {}, d.name), h('small', {}, d.paragraphs + ' 段 · ' + d.id.slice(0, 10))), () => void c.openDocument(d.id), {'aria-pressed':doc?.id === d.id})))),
            !s.documents.length && h('p', {className:'qr-muted'}, '导入一份材料开始阅读。')),
          h('main', {className:'qr-reader', 'aria-label':'原文'}, !doc ? h('section', {className:'qr-empty'}, h('h2', {}, '把材料放在手边'), h('p', {}, '导入 TXT 或 Markdown 后，可搜索原文、保存摘录，再选择片段提问。'), button('导入材料', () => fileRef.current?.click(), {disabled})) : h(React.Fragment, {},
            h('div', {className:'qr-title'}, h('h2', {}, doc.name), h('small', {}, doc.paragraphs.length + ' 个段落 · 已保存快照')),
            h('form', {className:'qr-search', onSubmit:e => { e.preventDefault(); void c.search() }}, h('input', {'aria-label':'原文关键词', placeholder:'搜索材料中的关键词', maxLength:LIMITS.questionChars, value:s.query, onChange:e => c.input('query', e.target.value)}), h('button', {type:'submit', disabled:disabled || !s.query.trim()}, '搜索')),
            h('small', {}, '按字词匹配：中文用相邻双字，英文用单词；不理解语义，最多显示 20 处。'),
            s.searched && h('div', {className:'qr-results', 'aria-label':'搜索结果'}, s.hits.length ? s.hits.map(hit => button(hit.locator + ' · ' + hit.text.slice(0, 90), () => c.selectParagraph(hit.locator), {key:hit.locator})) : h('p', {role:'status'}, '未找到匹配原文。请尝试材料中的其他关键词。')),
            h('article', {'aria-label':'材料段落'}, ...doc.paragraphs.map(p => h('section', {className:'qr-paragraph', key:p.locator, 'data-locator':p.locator, 'data-selected':s.selected === p.locator}, button(p.locator, () => c.selectParagraph(p.locator), {className:'qr-locator', 'aria-pressed':s.selected === p.locator, 'aria-label':'选择段落 ' + p.locator}), h('p', {}, p.text)))),
            s.selected && h('section', {className:'qr-note-editor', 'aria-label':'保存摘录'}, h('h3', {}, '摘录 ' + s.selected), h('label', {className:'qr-field'}, '摘录文字（可保留段落中的一部分）', h('textarea', {'aria-label':'摘录文字（可保留段落中的一部分）', value:s.excerpt, maxLength:4000, onChange:e => c.input('excerpt', e.target.value)})), h('label', {className:'qr-field'}, '我的笔记', h('textarea', {'aria-label':'我的笔记', value:s.comment, maxLength:2000, onChange:e => c.input('comment', e.target.value)})), button('保存摘录', () => void c.saveNote(), {disabled:disabled || !s.excerpt.trim()})),
            h('details', {}, h('summary', {}, '已保存摘录（' + s.notes.filter(n => n.documentId === doc.id).length + '）'), ...s.notes.filter(n => n.documentId === doc.id).map(n => h('section', {className:'qr-note', key:n.id}, button(n.locator, () => c.selectParagraph(n.locator)), h('blockquote', {}, n.text), h('p', {}, n.comment)))),
            h('details', {}, h('summary', {}, '文档与容量信息'), h('p', {className:'qr-identity'}, 'SHA-256：' + doc.id), h('p', {}, '身份基于规范化文本；同内容不重复导入，同名不同内容保留独立版本。'), h('p', {}, '记录仅保存在工作区 .qcu-reading；不改动原文件。'), h('p', {}, '最多 24 份材料、200 条摘录、50 次问答，共 8 MB；本版不自动清理。')))),
          h('aside', {className:'qr-qa', 'aria-label':'材料问答'}, h('h2', {}, '带着原文提问'), h('p', {className:'qr-muted'}, '先找片段，确认本次发送内容后再调用默认模型。'),
            h('label', {className:'qr-field'}, '问题', h('textarea', {'aria-label':'问题', className:'qr-question', value:s.question, maxLength:LIMITS.questionChars, disabled:!doc, placeholder:'例如：形成性评价如何提供学习反馈？', onChange:e => c.input('question', e.target.value)})),
            button('准备问答', () => void c.prepare(), {ref:prepareRef, disabled:disabled || !doc || !s.question.trim() || !!active}),
            active && (!s.run || s.run.id !== active.id) && h('p', {}, '当前工作区有问答正在生成。', button('查看当前问答', () => c.set({run:active}))),
            s.prepared && h('section', {className:'qr-confirm', 'aria-label':'发送前确认', onKeyDown:e => { if (e.key === 'Escape') { e.preventDefault(); dismiss() } }},
              h('h3', {}, '发送前确认'), h('p', {className:'qr-muted'}, '本次只发送以下问题与完整片段；使用云模型时，内容将发送给所示提供方。'),
              h('dl', {}, h('dt', {}, '模型 / 提供方'), h('dd', {}, s.prepared.route.model + ' / ' + s.prepared.route.provider), h('dt', {}, '推理策略 / 输出上限'), h('dd', {}, s.prepared.route.policy.effort + (s.prepared.route.policy.effort === 'default' ? '（宿主默认：' + (s.prepared.route.policy.defaultEffort ?? '未声明') + '）' : '') + ' / ' + s.prepared.route.policy.outputBudget + ' tokens'), h('dt', {}, '材料'), h('dd', {}, s.prepared.document.name + ' · ' + s.prepared.document.id.slice(0, 12)), h('dt', {}, '问题'), h('dd', {}, s.prepared.question)),
              h('details', {}, h('summary', {}, '模型策略详情'), h('p', {}, '支持档位：' + (s.prepared.route.policy.supportedEfforts.join(', ') || '未声明') + '；宿主默认：' + (s.prepared.route.policy.defaultEffort ?? '未声明'))),
              ...s.prepared.sources.map(source => h('section', {key:source.id}, button('[' + source.id + '] ' + source.locator + (source.clipped ? '（段落节选）' : ''), () => c.selectParagraph(source.locator)), h('pre', {}, source.text))),
              h('label', {className:'qr-consent'}, h('input', {ref:confirmRef, type:'checkbox', checked:s.consent, onChange:e => c.set({consent:e.target.checked})}), '我确认将本次问题和以上片段发送给所示模型。'),
              h('div', {className:'qr-toolbar'}, button('确认发送', () => void c.start(), {className:'qr-primary', disabled:disabled || !s.consent}), button('取消确认', dismiss, {disabled:s.busy}))),
            s.run && runView(s.run),
            h('details', {}, h('summary', {}, '问答记录（' + s.runs.length + '）'), h('div', {className:'qr-history'}, ...s.runs.map(run => button(h(React.Fragment, {}, run.question, h('small', {}, statusLabel(run.status) + ' · ' + run.document.name)), () => c.set({run, pane:'qa'}), {key:run.id, 'aria-pressed':s.run?.id === run.id})))),
            h('p', {className:'qr-muted', style:{marginTop:16}}, '回答为教师审阅草案；来源可定位不代表结论正确。')))))
  }
  function Entry({size = 20}) { return h('span', {'aria-hidden':true, style:{fontSize:size, lineHeight:1}}, '读') }
  return {Page, Entry}
}
