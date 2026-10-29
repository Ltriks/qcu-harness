// Generated official lazy-CJS Client; shared host React only.
window.__ModuleLoader__.load({id:'qcu-reading',factory(require){
const React=require('react');
const VERSION = '0.1.0-pilot.3', PROTOCOL = 2, OUTPUT_BUDGET = 2000
const LIMITS = Object.freeze({fileBytes:262144, binaryBytes:2097152, requestChars:3000000, extractedBytes:524288, pages:120, items:40000, zipEntries:256, zipEntryBytes:2097152, zipTotalBytes:8388608, zipRatio:100, parseMilliseconds:15000, documents:24, paragraphs:2000, notes:200, runs:50, storeBytes:8000000, answerChars:24000, questionChars:2000, snippetChars:1800, sources:4})
function check(ok, code = 'invalid-input') {
  if (!ok) throw Object.assign(Error(code), {code})
}
function exact(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k)), 'invalid-fields')
  return value
}
function text(value, max, required = true) {
  check(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(value) && (!required || value.trim()), 'invalid-text')
  return value
}
function parseImport(raw) {
  exact(raw, ['name', 'content'])
  const name = text(raw.name, 180)
  check(!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name) && name.trim() === name && !name.startsWith('.'), 'invalid-name')
  check(/\.(txt|md)$/i.test(name), 'unsupported-format')
  const content = text(raw.content, LIMITS.fileBytes).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n')
  check(new TextEncoder().encode(content).length <= LIMITS.fileBytes, 'file-too-large')
  return {name, content}
}
function binaryImport(raw) {
  exact(raw, ['name', 'base64'])
  const name = text(raw.name, 180)
  check(!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name) && name.trim() === name && !name.startsWith('.'), 'invalid-name')
  check(/\.(pdf|docx)$/i.test(name), 'unsupported-format')
  check(typeof raw.base64 === 'string' && raw.base64.length > 0 && raw.base64.length <= 4 * Math.ceil(LIMITS.binaryBytes / 3), 'binary-too-large')
  check(raw.base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(raw.base64), 'invalid-binary')
  return {name, base64:raw.base64, format:name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}
}
const formatOf = d => d.format ?? (d.name?.toLowerCase().endsWith('.md') ? 'md' : 'txt')
function sourceLabel(source) {
  const l = source.location
  if (l?.format === 'pdf') return 'PDF 第 ' + l.page + ' 页 · 段落 ' + l.paragraph
  if (l?.format === 'docx') return (l.section.length ? l.section.join(' / ') + ' · ' : '') + (l.table ? '表 ' + l.table.index + ' · 第 ' + l.table.row + ' 行 · 第 ' + l.table.cell + ' 格 · 段落 ' + l.table.paragraph : '段落 ' + l.paragraph)
  return source.locator
}
const warningLabels = {
  'pdf-review':'PDF 显示提取文本；阅读顺序、分栏、表格与公式请对照原件复核。',
  'page-no-text':'本页未提取到文字（空白或扫描页），如有内容请先做 OCR。',
  'images-omitted':'图片未转写，请对照原件核对。', 'math-review':'公式可能不完整，请对照原件核对。',
  'layout-review':'检测到分栏或表格布局，文字顺序需核对。', 'encoding-review':'字体或编码资源未完整解析，本页文字可能缺失。',
  'page-incomplete':'本页存在未完整解析的内容，请对照原件核对。',
  'docx-review':'Word 按正文结构定位，不提供固定页码；表格位置按源 XML 行列标记。',
  'equations-omitted':'Word 公式未转写，请对照原件核对。',
  'comments-omitted':'批注未导入。', 'footnotes-omitted':'脚注或尾注未导入。', 'headers-omitted':'页眉或页脚未导入。',
  'objects-omitted':'嵌入对象、文本框或不支持的正文未导入，请对照原件核对。',
  'table-merge-review':'表格含合并单元格，行列位置按源结构标记，请核对。',
  'external-labels-only':'外部链接只保留正文标签，未访问链接。', 'revisions-review':'修订按接受变更后的正文提取：保留插入/移入，略去删除/移出，请对照原件核对。'
}
function extractionNotices(extraction) {
  const groups = new Map()
  for (const w of extraction?.warnings ?? []) {
    if (!groups.has(w.code)) groups.set(w.code, [])
    if (w.page) groups.get(w.code).push(w.page)
  }
  return [...groups].map(([code, pages]) => (pages.length ? '第 ' + [...new Set(pages)].join('、') + ' 页：' : '') + warningLabels[code])
}
function paragraphsFor(content) {
  const paragraphs = []
  // Blank lines delimit paragraphs; offsets refer to the immutable normalized text.
  for (const match of content.matchAll(/[^\n]+(?:\n(?![\t ]*\n)[^\n]+)*/g)) {
    if (!match[0].trim()) continue
    paragraphs.push({locator:'p' + String(paragraphs.length + 1).padStart(4, '0'), start:match.index, end:match.index + match[0].length, text:match[0]})
  }
  check(paragraphs.length > 0 && paragraphs.length <= LIMITS.paragraphs, 'paragraph-limit')
  return paragraphs
}
function searchTerms(query) {
  text(query, LIMITS.questionChars)
  const terms = []
  for (const match of query.toLowerCase().matchAll(/[\p{Script=Han}]+|[\p{L}\p{N}_]+/gu)) {
    const word = match[0]
    if (/^\p{Script=Han}+$/u.test(word) && word.length > 2) {
      for (let i = 0; i < word.length - 1; i++) terms.push(word.slice(i, i + 2))
    } else terms.push(word)
  }
  return [...new Set(terms)].slice(0, 128)
}
function searchDocument(document, query, limit = 20) {
  const terms = searchTerms(query)
  return document.paragraphs.map(p => {
    const lower = p.text.toLowerCase(), matched = terms.filter(t => lower.includes(t))
    return {...p, score:matched.length, matched}
  }).filter(p => p.score).sort((a, b) => b.score - a.score || a.start - b.start).slice(0, limit)
}
function evidenceFor(document, question) {
  let selected = searchDocument(document, question, LIMITS.sources)
  if (document.format === 'docx') {
    const expanded = [], seen = new Set(), rows = new Set()
    const add = p => { if (p && !seen.has(p.locator) && expanded.length < LIMITS.sources) { expanded.push(p); seen.add(p.locator) } }
    for (const hit of selected) {
      add(hit)
      const table = hit.location?.table
      if (!table) continue
      const key = table.index + ':' + table.row
      if (rows.has(key)) continue
      rows.add(key)
      // One nearest same-row cell per matched row, before unrelated hits. Every cell remains
      // a separate exact source, visible in confirmation; no concatenated or hidden value text.
      const peer = document.paragraphs.filter(p => p.location?.table?.index === table.index && p.location.table.row === table.row && p.location.table.cell !== table.cell && !seen.has(p.locator)).sort((a, b) => Math.abs(a.location.table.cell - table.cell) - Math.abs(b.location.table.cell - table.cell) || a.start - b.start)[0]
      if (peer) add({...peer, matched:[]})
    }
    selected = expanded
  }
  return selected.map((p, i) => {
    const first = p.matched.length ? Math.min(...p.matched.map(t => p.text.toLowerCase().indexOf(t))) : 0
    let offset = Math.max(0, first - 100)
    if (offset && /[\udc00-\udfff]/.test(p.text[offset])) offset--
    let end = Math.min(p.text.length, offset + LIMITS.snippetChars)
    if (end < p.text.length && /[\udc00-\udfff]/.test(p.text[end])) end--
    return {id:'S' + (i + 1), locator:p.locator, start:p.start + offset, end:p.start + end, text:p.text.slice(offset, end), clipped:offset > 0 || end < p.text.length, ...(p.location ? {format:document.format, location:p.location} : {})}
  })
}
function parseRoute(raw) {
  exact(raw, ['provider', 'model', 'policy'])
  text(raw.provider, 200); text(raw.model, 200)
  const p = exact(raw.policy, ['effort', 'supportedEfforts', 'defaultEffort', 'outputBudget'])
  check(Array.isArray(p.supportedEfforts) && p.supportedEfforts.length <= 32 && p.supportedEfforts.every(e => typeof e === 'string' && /^[\w-]{1,80}$/.test(e)) && new Set(p.supportedEfforts).size === p.supportedEfforts.length, 'invalid-model-policy')
  const supportedEfforts = [...p.supportedEfforts].sort()
  const effort = supportedEfforts.includes('low') ? 'low' : supportedEfforts.includes('off') ? 'off' : 'default'
  check(p.effort === effort && (p.defaultEffort === null || supportedEfforts.includes(p.defaultEffort)) && p.outputBudget === OUTPUT_BUDGET, 'invalid-model-policy')
  return {provider:raw.provider, model:raw.model, policy:{effort, supportedEfforts, defaultEffort:p.defaultEffort, outputBudget:OUTPUT_BUDGET}}
}
function policyFor(info) {
  const supportedEfforts = info.reasoning?.efforts?.map(e => e.id) ?? []
  return parseRoute({provider:'policy', model:'policy', policy:{effort:supportedEfforts.includes('low') ? 'low' : supportedEfforts.includes('off') ? 'off' : 'default', supportedEfforts, defaultEffort:info.reasoning?.defaultEffort ?? null, outputBudget:OUTPUT_BUDGET}}).policy
}
const sameRoute = (a, b) => JSON.stringify(parseRoute(a)) === JSON.stringify(parseRoute(b))
const errors = {
  'invalid-input':'输入无效，请检查后重试。', 'invalid-fields':'请求包含不支持的字段。',
  'invalid-text':'文字为空、过长或包含无效字符。', 'invalid-name':'文件名无效，请使用不含路径的普通文件名。',
  'unsupported-format':'请选择 UTF-8 TXT、Markdown、文字型 PDF 或 DOCX；不支持 DOC、DOCM 或扫描件 OCR。',
  'binary-too-large':'PDF / DOCX 每份最多 2 MiB，请拆分后导入。', 'invalid-binary':'文件字节编码无效，请重新选择原文件。',
  'invalid-pdf':'PDF 损坏或结构不受支持，请重新导出文字型 PDF。', 'encrypted-pdf':'不支持加密或密码保护的 PDF，请先导出未加密副本。',
  'ocr-needed':'PDF 未提取到文字；扫描件请先做 OCR，再导入文字型 PDF。', 'empty-docx':'DOCX 未提取到正文文字，请检查是否只有图片或嵌入对象。',
  'pdf-encoding':'PDF 字体或编码资源不足，未能提取文字，未保存材料；请重新导出含可复制文字的 PDF，扫描件请先做 OCR。',
  'invalid-docx':'DOCX ZIP 或 XML 损坏、不安全或结构不受支持，请重新另存为 DOCX。',
  'unsafe-docx':'不支持含宏或加密内容的 Word 文件，请另存为普通 DOCX。',
  'parse-limit':'文件页数、结构、解压大小或提取文本超过本版上限，请拆分后导入。',
  'parse-busy':'当前已有材料在解析，请稍后再导入。', 'parse-cancelled':'已取消解析，未保存材料。',
  'parse-timeout':'解析超时，已停止且未保存材料；请拆分或重新导出文件。', 'parse-worker-failed':'解析进程停止，未保存材料；请拆分或重新导出文件。',
  'invalid-utf8':'文件不是有效的 UTF-8 文本，请先转存为 UTF-8。', 'file-too-large':'单个文件最多 256 KiB，请拆分后导入。',
  'paragraph-limit':'材料需包含 1–2000 个非空段落，请拆分长材料。', 'document-not-found':'材料不存在，请重新选择。',
  'note-invalid':'摘录须为所选段落中实际存在的文字，最多 4000 字符。', 'run-not-found':'问答记录不存在。',
  'no-evidence':'未找到匹配原文。请改用材料中的关键词；本次未调用模型。',
  'consent-required':'请核对问题、模型与完整片段，并勾选本次发送。', 'prepare-expired':'确认已失效或内容已变化，请重新准备。',
  'idempotency-conflict':'请求标识已用于其他问答，请重新准备。', 'run-busy':'该工作区已有问答在运行，请等待或取消。',
  'model-not-configured':'请先在 DSH 设置中配置默认模型。', 'model-policy-unavailable':'无法读取模型能力，请检查设置后重新准备。',
  'model-policy-changed':'默认模型或推理策略已变化，请重新准备并确认。', 'invalid-model-policy':'模型能力信息无效。',
  'model-failed':'模型未正常完成，本记录不完整；未自动重试。', 'model-max-tokens':'输出达到模型上限，本记录不完整；未自动重试。',
  'output-too-large':'模型输出超过本版容量，本记录不完整。', 'model-unexpected-blocks':'模型返回了不支持的工具请求，本次已停止。',
  'cancelled':'本次问答已取消，未自动重试。', 'call-timeout':'本次问答超时，已停止且未自动重试。',
  'interrupted':'应用或插件已退出，本次问答中断且不会自动恢复。', 'plugin-stopped':'伴读插件已停用。',
  'workspace-not-found':'请选择有效工作区。', 'workspace-changed':'工作区路径已变化，请重启插件后重新选择。', 'workspace-limit':'打开的工作区过多，请重启插件。',
  'unsafe-store':'本地存储路径含符号链接或无效位置，请保留文件并联系维护者。', 'invalid-store':'本地记录损坏或格式不受支持，请保留文件并联系维护者。',
  'state-write-failed':'本地记录保存失败，已停止继续调用模型。请检查磁盘和权限。',
  'store-limit':'本地容量已满（24 份材料、200 条摘录、50 次问答、共 8 MB）；请另选工作区。本版不会自动清理。',
  'operation-failed':'操作未完成，请刷新核对本地记录。'
}
const safeCode = e => Object.hasOwn(errors, e?.code) ? e.code : 'operation-failed'
const codec = (symbol, max) => ({mode:'strict', typeSymbol:'qcu-reading#' + symbol, create:() => ({parse(value) { check(typeof value === 'string' && value.length <= max, 'invalid-fields'); JSON.parse(value); return value }})})
const remoteContribution = {package:'qcu-reading', descriptors:[{id:'qcu-reading#qcuReading/dispatch', service:'qcuReading', namespace:'qcuReading', method:'dispatch', invocation:{kind:'direct'}, parameters:[{name:'payload', wire:'payload', source:'json', codec:codec('request', LIMITS.requestChars)}], cancellation:{parameter:'signal'}, result:codec('reply', 10000000)}]}

const statusLabel = status => ({running:'生成中', completed:'已生成草案', failed:'失败 · 不完整', cancelled:'已取消 · 不完整', interrupted:'已中断 · 不完整'}[status] ?? '不完整')
function citationParts(answer, sources) {
  const valid = new Set(sources.map(s => s.id)), result = []
  let last = 0
  for (const match of answer.matchAll(/\[S\d+\]/g)) {
    if (match.index > last) result.push({text:answer.slice(last, match.index)})
    const id = match[0].slice(1, -1)
    result.push({text:match[0], ...(valid.has(id) ? {sourceId:id} : {unknown:true})})
    last = match.index + match[0].length
  }
  if (last < answer.length) result.push({text:answer.slice(last)})
  return result
}
function sourceReview(answer, sources) {
  const references = citationParts(answer, sources), known = references.filter(r => r.sourceId)
  return {needsReview:!known.length || references.some(r => r.unknown), known:[...new Set(known.map(r => r.sourceId))], unknown:references.filter(r => r.unknown).map(r => r.text)}
}
// Keep exact data in a fence longer than any backtick run in it. Imported HTML,
// links and even embedded fences stay literal when the is rendered.
function quoted(value) {
  const data = String(value), longest = Math.max(0, ...[...data.matchAll(/`+/g)].map(match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return fence + 'text\n' + data + '\n' + fence
}
function exportRun(run) {
  const review = sourceReview(run.answer, run.sources)
  return [
    '# 教师审阅草案 · QCU 伴读',
    '模型输出与材料均待教师复核；来源可定位不代表推理正确。',
    '状态：' + statusLabel(run.status),
    run.status === 'completed' ? '' : '本记录不完整。' + (errors[run.error] ?? ''),
    '文档名称：\n' + quoted(run.document.name),
    '文档格式：' + formatOf(run.document).toUpperCase(),
    '文档身份 / 版本：SHA-256 ' + run.document.id + (run.document.identity === 'original-bytes-sha256' ? '（原始文件字节，版本由原始字节确定）' : '（规范化 UTF-8 文本，版本由内容确定）'),
    ...(run.document.contentHash ? ['提取文本 SHA-256：' + run.document.contentHash, '解析器：' + run.document.extraction.parser, '提取内容待核对：\n' + extractionNotices(run.document.extraction).join('\n')] : []),
    '记录：' + run.id + '\n\n时间：' + new Date(run.createdAt).toISOString(),
    '模型 / 提供方：\n' + quoted(run.route.model + ' / ' + run.route.provider),
    '推理策略：' + run.route.policy.effort + '；宿主默认：' + (run.route.policy.defaultEffort ?? '未声明') + '；支持档位：' + (run.route.policy.supportedEfforts.join(', ') || '未声明') + '；输出上限：' + run.route.policy.outputBudget,
    '## 问题\n\n' + quoted(run.question),
    '## 本次确认的完整来源片段',
    ...run.sources.map(s => '### [' + s.id + '] ' + (s.format ? s.format.toUpperCase() + ' · ' : '') + s.locator + '（字符 ' + s.start + '–' + s.end + (s.clipped ? '，段落节选' : '') + '）\n\n' + (s.format ? '位置：\n' + quoted(sourceLabel(s)) + '\n\n' : '') + quoted(s.text)),
    '## 模型草案\n\n' + quoted(run.answer || '（无完整回答）'),
    review.needsReview ? '来源待核对：回答缺少合法引用或包含未知引用。' : '引用标记可定位到上述片段；内容正确性仍待教师复核。'
  ].filter(Boolean).join('\n\n') + '\n'
}


class ReadingController {
  constructor(remote, {storage = globalThis.localStorage} = {}) {
    this.remote = remote; this.storage = storage; this.listeners = new Set(); this.epoch = 0; this.pollEpoch = 0; this.workspacesEpoch = 0
    this.state = {workspaces:[], workspaceId:'', refreshingWorkspaces:false, workspacesError:'', workspacesNotice:'', workspaceMissing:false, documents:[], notes:[], runs:[], document:null, selected:'', query:'', hits:[], searched:false, question:'', prepared:null, consent:false, run:null, excerpt:'', comment:'', busy:false, parsing:null, loading:true, error:'', notice:'', pane:'original', showMaterials:false}
  }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  snapshot = () => this.state
  set(patch) { if (this.closed) return; this.state = {...this.state, ...patch}; for (const fn of this.listeners) fn() }
  async call(payload) {
    const reply = await this.remote.dispatch(JSON.stringify(payload))
    const wire = typeof reply === 'string' ? JSON.parse(reply) : reply.ok && typeof reply.value === 'string' ? JSON.parse(reply.value) : reply
    if (!wire.ok) throw Object.assign(Error(wire.error), {code:wire.error})
    check(wire.version === VERSION && wire.protocol === PROTOCOL, 'operation-failed')
    return wire.value
  }
  message(e) { return errors[e?.code] ?? errors['operation-failed'] }
  async action(fn) {
    if (this.state.busy || !this.state.workspaceId || this.closed) return false
    const epoch = this.epoch
    this.set({busy:true, error:'', notice:''})
    try { await fn(epoch); return epoch === this.epoch }
    catch (e) { if (epoch === this.epoch) this.set({error:this.message(e), notice:''}); return false }
    finally { if (epoch === this.epoch) this.set({busy:false}) }
  }
  forgetConfirmation() {
    const s = this.state
    if (s.prepared) void this.call({action:'dismiss', workspaceId:s.workspaceId, intentId:s.prepared.id}).catch(() => {})
    this.set({prepared:null, consent:false})
  }
  invalidate() { this.forgetConfirmation(); this.stopImport(); this.epoch++; this.set({busy:false, parsing:null, error:'', notice:''}) }
  setWorkspaces(workspaces) {
    if (this.state.workspaceId && !workspaces.some(w => w.id === this.state.workspaceId)) {
      // Invalidate local sends/replies and observation only. Never cancel a Host job or erase its saved data.
      ++this.epoch; ++this.pollEpoch; clearTimeout(this.timer); clearTimeout(this.importTask?.timer)
      this.set({workspaces, workspaceId:'', workspaceMissing:true, prepared:null, consent:false, busy:false, loading:false, parsing:null})
    } else this.set({workspaces})
  }
  async refreshWorkspaces() {
    if (this.closed) return
    const token = ++this.workspacesEpoch
    this.set({refreshingWorkspaces:true, workspacesError:'', workspacesNotice:''})
    try {
      const workspaces = await this.call({action:'workspaces'})
      if (token !== this.workspacesEpoch || this.closed) return
      this.setWorkspaces(workspaces)
      this.set({workspacesNotice:'工作区列表已刷新。'})
    } catch (e) { if (token === this.workspacesEpoch && !this.closed) this.set({workspacesError:'刷新工作区失败：' + this.message(e)}) }
    finally { if (token === this.workspacesEpoch && !this.closed) this.set({refreshingWorkspaces:false}) }
  }
  async boot() {
    if (this.closed) return
    const epoch = ++this.epoch, token = ++this.workspacesEpoch
    this.set({loading:false, refreshingWorkspaces:true, workspacesError:'', workspacesNotice:''})
    try {
      const workspaces = await this.call({action:'workspaces'})
      if (token !== this.workspacesEpoch || this.closed) return
      this.setWorkspaces(workspaces)
      if (epoch !== this.epoch) return
      let remembered
      try { remembered = this.storage?.getItem('qcu-reading.workspace') } catch {}
      const chosen = this.state.workspaceMissing ? null : workspaces.find(w => w.id === this.state.workspaceId) ?? workspaces.find(w => w.id === remembered) ?? (!this.state.workspaceId && !remembered && workspaces.length === 1 ? workspaces[0] : null)
      if (chosen) await this.selectWorkspace(chosen.id)
      else if (remembered && !this.state.workspaceId) this.set({workspaceMissing:true})
    } catch (e) { if (token === this.workspacesEpoch && !this.closed) this.set({workspacesError:'读取工作区失败：' + this.message(e)}) }
    finally { if (token === this.workspacesEpoch && !this.closed) this.set({refreshingWorkspaces:false}) }
  }
  async selectWorkspace(id) {
    if (this.closed || (id && !this.state.workspaces.some(w => w.id === id))) return
    this.invalidate(); clearTimeout(this.timer); const token = ++this.pollEpoch, epoch = this.epoch
    this.set({workspaceId:id, workspaceMissing:false, documents:[], notes:[], runs:[], document:null, selected:'', question:'', query:'', hits:[], searched:false, run:null, loading:!!id, excerpt:'', comment:''})
    if (!id) return
    try {
      const data = await this.call({action:'catalog', workspaceId:id})
      if (epoch !== this.epoch || this.closed) return
      this.set({...data, loading:false})
      try { this.storage?.setItem('qcu-reading.workspace', id) } catch {}
      if (data.documents.length) await this.openDocument(data.documents[0].id)
      const active = data.runs.find(r => r.status === 'running')
      if (active && token === this.pollEpoch) { this.set({run:active}); this.poll(active.id, token) }
    } catch (e) { if (epoch === this.epoch) this.set({loading:false, error:this.message(e)}) }
  }
  async openDocument(id, locator = '') {
    if (!this.state.workspaceId || this.closed) return
    this.invalidate(); const epoch = this.epoch, workspaceId = this.state.workspaceId
    this.set({loading:true, query:'', hits:[], searched:false, excerpt:'', comment:'', selected:'', showMaterials:false})
    try {
      const document = await this.call({action:'document', workspaceId, documentId:id})
      if (epoch !== this.epoch || this.closed) return
      this.set({document, loading:false})
      if (locator) this.selectParagraph(locator)
    } catch (e) { if (epoch === this.epoch) this.set({loading:false, error:this.message(e)}) }
  }
  input(key, value) {
    if (key === 'question') this.invalidate()
    if (key === 'query') this.set({searched:false, hits:[]})
    this.set({[key]:value})
  }
  async refresh(epoch = this.epoch) {
    const data = await this.call({action:'catalog', workspaceId:this.state.workspaceId})
    if (epoch === this.epoch) this.set(data)
  }
  async importFile(file) {
    const workspaceId = this.state.workspaceId
    this.forgetConfirmation()
    await this.action(async epoch => {
      check(file && /\.(txt|md|pdf|docx)$/i.test(file.name), 'unsupported-format')
      const binary = /\.(pdf|docx)$/i.test(file.name)
      check(file.size <= (binary ? LIMITS.binaryBytes : LIMITS.fileBytes), binary ? 'binary-too-large' : 'file-too-large')
      const importId = crypto.randomUUID(), task = {id:importId, workspaceId, cancelled:false}
      this.importTask = task; this.set({parsing:{stage:'opening', done:0, total:0}})
      let input
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        check(bytes.length <= (binary ? LIMITS.binaryBytes : LIMITS.fileBytes), binary ? 'binary-too-large' : 'file-too-large')
        if (binary) {
          let ascii = ''; for (let i = 0; i < bytes.length; i += 8192) ascii += String.fromCharCode(...bytes.subarray(i, i + 8192))
          input = {name:file.name, base64:btoa(ascii)}
        } else {
          let content
          try { content = new TextDecoder('utf-8', {fatal:true}).decode(bytes) } catch { check(false, 'invalid-utf8') }
          input = {name:file.name, content}
        }
      // Navigation during file decoding never imports into the newly selected workspace.
      if (epoch !== this.epoch) return
      check(!task.cancelled, 'parse-cancelled')
      if (binary) this.pollImport(task, epoch)
      const result = await this.call({action:'import', workspaceId, importId, file:input})
      if (epoch !== this.epoch) return
      await this.refresh(epoch)
      if (epoch !== this.epoch) return
      this.forgetConfirmation()
      this.set({document:result.document, selected:'', excerpt:'', comment:'', query:'', hits:[], searched:false, showMaterials:false, notice:result.duplicate ? '相同内容已存在，已打开原快照。' : '材料已保存为本地快照。'})
      } finally {
        clearTimeout(task.timer)
        if (this.importTask === task) { this.importTask = null; this.set({parsing:null}) }
      }
    })
  }
  pollImport(task, epoch) {
    task.timer = setTimeout(async () => {
      if (this.importTask !== task || epoch !== this.epoch) return
      try {
        const progress = await this.call({action:'importStatus', workspaceId:task.workspaceId, importId:task.id})
        if (this.importTask === task && epoch === this.epoch) { if (progress.stage !== 'idle') this.set({parsing:progress}); this.pollImport(task, epoch) }
      } catch {}
    }, 200)
  }
  stopImport() {
    const task = this.importTask; if (!task) return
    task.cancelled = true; clearTimeout(task.timer)
    void this.call({action:'cancelImport', workspaceId:task.workspaceId, importId:task.id}).catch(() => {})
  }
  cancelImport() { this.stopImport(); this.set({notice:'正在停止解析…'}) }
  async search() {
    await this.action(async epoch => {
      const s = this.state, query = s.query
      const hits = await this.call({action:'search', workspaceId:s.workspaceId, documentId:s.document.id, query})
      if (epoch === this.epoch && query === this.state.query) this.set({hits, searched:true})
    })
  }
  selectParagraph(locator) {
    const p = this.state.document?.paragraphs.find(p => p.locator === locator)
    if (p) this.set({selected:locator, excerpt:p.text.slice(0, 4000), comment:'', pane:'original'})
  }
  async cite(run, source) {
    if (this.state.document?.id !== run.document.id) await this.openDocument(run.document.id, source.locator)
    else this.selectParagraph(source.locator)
  }
  async saveNote() {
    await this.action(async epoch => {
      const s = this.state
      await this.call({action:'note', workspaceId:s.workspaceId, note:{documentId:s.document.id, locator:s.selected, text:s.excerpt, comment:s.comment}})
      if (epoch === this.epoch) { await this.refresh(epoch); if (epoch === this.epoch) this.set({notice:'摘录已保存，重新打开仍会保留。'}) }
    })
  }
  async prepare() {
    this.forgetConfirmation()
    await this.action(async epoch => {
      const s = this.state, prepared = await this.call({action:'prepare', workspaceId:s.workspaceId, documentId:s.document.id, question:s.question})
      if (epoch !== this.epoch) { if (prepared.id) void this.call({action:'dismiss', workspaceId:s.workspaceId, intentId:prepared.id}).catch(() => {}); return }
      if (prepared.status === 'no-evidence') this.set({notice:errors['no-evidence'], pane:'qa'})
      else this.set({prepared, consent:false, pane:'qa'})
    })
  }
  async start() {
    const p = this.state.prepared
    if (!p || !this.state.consent) return
    await this.action(async epoch => {
      const workspaceId = this.state.workspaceId
      const run = await this.call({action:'start', workspaceId, intentId:p.id, requestId:crypto.randomUUID(), consent:true, documentId:this.state.document.id, question:this.state.question, digest:p.digest})
      if (epoch !== this.epoch) return
      this.set({prepared:null, consent:false, run, pane:'qa'})
      await this.refresh(epoch)
      if (epoch === this.epoch) this.poll(run.id, ++this.pollEpoch)
    })
  }
  poll(id, token) {
    clearTimeout(this.timer)
    const workspaceId = this.state.workspaceId
    this.timer = setTimeout(async () => {
      try {
        const run = await this.call({action:'run', workspaceId, runId:id})
        if (token !== this.pollEpoch || this.closed || workspaceId !== this.state.workspaceId) return
        this.set({...(this.state.run?.id === id ? {run} : {}), runs:this.state.runs.map(r => r.id === id ? run : r)})
        if (run.status === 'running') this.poll(id, token)
      } catch (e) { if (token === this.pollEpoch) this.set({error:this.message(e)}) }
    }, 300)
  }
  async cancel(id) {
    await this.action(async epoch => {
      const run = await this.call({action:'cancel', workspaceId:this.state.workspaceId, runId:id})
      if (epoch === this.epoch) { if (this.state.run?.id === id) this.set({run}); await this.refresh(epoch) }
    })
  }
  async exportRun(id, deliver) {
    await this.action(async epoch => {
      const result = await this.call({action:'export', workspaceId:this.state.workspaceId, runId:id})
      if (epoch === this.epoch) deliver(result)
    })
  }
  async reconnect() { if (this.closed) return; this.invalidate(); clearTimeout(this.timer); ++this.pollEpoch; await this.boot() }
  dispose() { this.forgetConfirmation(); this.stopImport(); clearTimeout(this.timer); ++this.epoch; ++this.pollEpoch; ++this.workspacesEpoch; this.closed = true; this.listeners.clear() }
}


const readingCSS = `
.qr{--qr-bg:#f7fafd;--qr-surface:#fff;--qr-ink:#17324d;--qr-muted:#48617a;--qr-accent:#174f91;--qr-line:#d9e5ee;--qr-selected:#e5effa;--qr-alert:#8a3a16;color-scheme:light;background:var(--qr-bg);color:var(--qr-ink);font-family:inherit;font-size:var(--dsh-content-font-size,14px);height:100%;min-height:300px;display:flex;flex-direction:column;text-align:left;line-height:1.55}
@media(prefers-color-scheme:dark){.qr{--qr-bg:#17212c;--qr-surface:#202e3c;--qr-ink:#e4edf6;--qr-muted:#b0c4d8;--qr-accent:#9bc7ff;--qr-line:#41576d;--qr-selected:#2c4560;--qr-alert:#ffbe98;color-scheme:dark}}
:where([data-theme=dark],.dark) .qr,.qr[data-theme=dark]{--qr-bg:#17212c;--qr-surface:#202e3c;--qr-ink:#e4edf6;--qr-muted:#b0c4d8;--qr-accent:#9bc7ff;--qr-line:#41576d;--qr-selected:#2c4560;--qr-alert:#ffbe98;color-scheme:dark}
:where([data-theme=light]) .qr,.qr[data-theme=light]{--qr-bg:#f7fafd;--qr-surface:#fff;--qr-ink:#17324d;--qr-muted:#48617a;--qr-accent:#174f91;--qr-line:#d9e5ee;--qr-selected:#e5effa;--qr-alert:#8a3a16;color-scheme:light}
.qr *{box-sizing:border-box;min-width:0}.qr button,.qr input,.qr textarea,.qr select{font:inherit;color:inherit}.qr button,.qr select,.qr input,.qr textarea{border:1px solid var(--qr-line);border-radius:5px;background:var(--qr-surface);padding:.4em .65em}.qr button{cursor:pointer;white-space:normal}.qr button:hover:not(:disabled){background:var(--qr-selected)}.qr button:disabled{opacity:.55;cursor:default}.qr :focus-visible{outline:2px solid var(--qr-accent);outline-offset:2px}.qr .qr-primary{background:var(--qr-accent);color:var(--qr-surface);border-color:var(--qr-accent)}.qr .qr-primary:hover:not(:disabled){background:var(--qr-ink);color:var(--qr-surface)}.qr button[aria-pressed=true]{background:var(--qr-selected);border-color:var(--qr-accent)}
.qr h1,.qr h2,.qr h3,.qr p{margin:0}.qr h1{font-size:1.15em}.qr h2{font-size:1.05em}.qr h3{font-size:1em}.qr small,.qr .qr-muted{color:var(--qr-muted);font-size:.88em}.qr-header{display:flex;align-items:center;gap:16px;padding:10px 14px;border-bottom:1px solid var(--qr-line);flex-wrap:wrap}.qr-header label{display:flex;align-items:center;gap:8px;margin-left:auto}.qr-header select{max-width:240px}.qr-header .qr-back{margin-right:4px}.qr-banner{padding:8px 14px;border-bottom:1px solid var(--qr-line);overflow-wrap:anywhere}.qr-error{color:var(--qr-alert)}.qr-layout{display:grid;grid-template-columns:180px minmax(0,1.15fr) minmax(285px,1fr);flex:1;min-height:0}.qr-materials,.qr-reader,.qr-qa{overflow:auto;padding:14px;overflow-wrap:anywhere}.qr-materials,.qr-reader{border-right:1px solid var(--qr-line)}.qr-materials{padding:12px 10px}.qr-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.qr-import{display:block;width:100%;margin:10px 0 6px}.qr-file{display:none}.qr-docs{list-style:none;margin:14px 0 0;padding:0}.qr-docs li+li{margin-top:4px}.qr-docs button{display:block;width:100%;text-align:left;border-color:transparent;background:transparent}.qr-docs strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500}.qr-docs small{display:block}.qr-title{margin-bottom:12px}.qr-title h2{overflow-wrap:anywhere}.qr-search{display:flex;gap:6px;margin:12px 0}.qr-search input{width:100%}.qr-results{display:grid;gap:6px;margin-bottom:16px}.qr-results button{text-align:left}.qr-paragraph{padding:10px 10px 12px;margin:4px 0;border-left:3px solid transparent;scroll-margin-top:14px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.qr-paragraph[data-selected=true]{border-left-color:var(--qr-accent);background:var(--qr-selected)}.qr-locator{display:block!important;color:var(--qr-accent)!important;font-size:.8em!important;padding:1px 6px!important;margin-bottom:5px!important;background:transparent!important}.qr-paragraph p{white-space:pre-wrap}.qr label.qr-field{display:grid;gap:6px;margin:12px 0}.qr textarea{display:block;resize:vertical;width:100%;min-height:74px;line-height:1.6}.qr-question{min-height:96px!important}.qr pre,.qr blockquote{white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;font:inherit;margin:8px 0;padding:9px 10px;border-left:2px solid var(--qr-line);background:var(--qr-bg)}.qr details{margin:14px 0}.qr summary{cursor:pointer;color:var(--qr-muted)}.qr-confirm{padding:12px 0;border-top:2px solid var(--qr-accent);margin-top:18px}.qr-confirm dl{margin:10px 0}.qr-confirm dt{color:var(--qr-muted);font-size:.88em}.qr-confirm dd{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}.qr-consent{display:flex;align-items:flex-start;gap:8px;margin:14px 0}.qr-consent input{flex:none;margin-top:5px}.qr-answer{white-space:pre-wrap;margin-top:12px;line-height:1.8}.qr-citation{display:inline;padding:0 .3em!important;color:var(--qr-accent)!important}.qr-unknown{text-decoration:underline dotted;color:var(--qr-alert)}.qr-run{margin-top:18px;padding-top:14px;border-top:1px solid var(--qr-line)}.qr-history{display:grid;gap:6px;margin-top:10px}.qr-history button{text-align:left}.qr-history small{display:block}.qr-note{border-top:1px solid var(--qr-line);padding:10px 0}.qr-empty{max-width:38em;padding:28px 14px}.qr-empty p{margin:10px 0;color:var(--qr-muted)}.qr-tabs{display:none}.qr-note-editor{border-top:1px solid var(--qr-line);margin-top:18px;padding-top:12px}.qr-identity{overflow-wrap:anywhere;user-select:all}
.qr-search button{flex:none;white-space:nowrap}
.qr-workspaces{display:flex;align-items:center;gap:8px;margin-left:auto;max-width:100%}.qr-header .qr-workspaces label{margin-left:0}.qr-workspaces button{flex:none}.qr-workspaces select{min-width:0}@media(max-width:600px){.qr-workspaces{width:100%;margin-left:0}.qr-header .qr-workspaces label{flex:1;width:auto}}
.qr-extraction{margin:8px 0 12px;color:var(--qr-muted);font-size:.88em}.qr .qr-extraction details{margin:4px 0 0}.qr .qr-extraction summary{color:var(--qr-accent)}.qr-extraction ul{margin:8px 0 0;padding-left:1.3em}.qr-extraction li+li{margin-top:4px}
@media(max-width:960px){.qr-layout{grid-template-columns:160px minmax(0,1fr)}.qr-tabs{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--qr-line)}.qr-layout[data-pane=original] .qr-qa,.qr-layout[data-pane=qa] .qr-reader{display:none}.qr-reader{border-right:0}.qr-qa{border-right:0}.qr-header label{margin-left:0}.qr-header{gap:10px}}
@media(max-width:600px){.qr-layout{grid-template-columns:minmax(0,1fr)}.qr-materials{display:none;max-height:260px;border-right:0;border-bottom:1px solid var(--qr-line)}.qr-layout[data-materials=true] .qr-materials{display:block}.qr-layout[data-materials=true]{grid-template-rows:auto minmax(0,1fr)}.qr-header{padding:10px}.qr-header label{width:100%}.qr-header select{flex:1;max-width:100%}.qr-reader,.qr-qa{padding:12px}.qr-tabs{padding:8px 10px}.qr-paragraph{padding:8px 6px}.qr-title h2{font-size:1em}}
`

function createReadingViews(React) {
  const h = React.createElement
  const button = (label, onClick, props = {}) => h('button', {type:'button', onClick, ...props}, label)
  function ExtractionNotice({extraction}) {
    const notices = extractionNotices(extraction), codes = new Set(extraction.warnings.map(w => w.code))
    const omitted = [['images-omitted', '图片'], ['equations-omitted', '公式'], ['objects-omitted', '嵌入内容'], ['comments-omitted', '批注'], ['footnotes-omitted', '脚注/尾注'], ['headers-omitted', '页眉/页脚']].filter(([code]) => codes.has(code)).map(([, label]) => label)
    const emptyPages = new Set(extraction.warnings.filter(w => w.code === 'page-no-text').map(w => w.page)).size
    const missingText = codes.has('encoding-review') || codes.has('page-incomplete')
    const summary = omitted.length ? '未提取：' + omitted.slice(0, 2).join('、') + (omitted.length > 2 ? '等 ' + omitted.length + ' 类' : '') + '；' + (emptyPages ? '另有 ' + emptyPages + ' 页无文字，' : '') + '请核对原件。'
      : emptyPages ? emptyPages + ' 页未提取到文字；如有内容请先做 OCR。'
      : missingText ? '部分文字可能缺失，请对照原件核对。'
      : codes.size > 1 ? '提取内容需核对，请对照原件。'
      : codes.has('pdf-review') ? 'PDF 为提取文本，版式需核对。' : 'Word 按正文结构定位，无固定页码。'
    return h('section', {className:'qr-extraction', 'aria-label':'提取内容待核对'},
      h('p', {className:omitted.length || emptyPages || missingText ? 'qr-error' : undefined}, summary),
      h('details', {}, h('summary', {}, '完整提取说明（' + notices.length + ' 项）'), h('ul', {}, ...notices.map((notice, i) => h('li', {key:i}, notice)))))
  }
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
    const paragraphView = p => h('section', {className:'qr-paragraph', key:p.locator, 'data-locator':p.locator, 'data-selected':s.selected === p.locator}, button(sourceLabel(p), () => c.selectParagraph(p.locator), {className:'qr-locator', 'aria-pressed':s.selected === p.locator, 'aria-label':'选择段落 ' + p.locator}), h('p', {}, p.text))
    function runView(run) {
      const review = sourceReview(run.answer, run.sources)
      return h('section', {className:'qr-run', 'aria-label':'问答记录'},
        h('div', {className:'qr-toolbar'}, h('h3', {}, statusLabel(run.status)), button('导出 Markdown', () => void c.exportRun(run.id, download), {disabled:s.busy}), run.status === 'running' && button('取消问答', () => void c.cancel(run.id), {disabled:s.busy})),
        h('small', {}, run.document.name + ' · ' + formatOf(run.document).toUpperCase()),
        h('p', {}, run.question),
        run.status !== 'completed' && h('p', {className:'qr-error', role:'status'}, run.status === 'running' ? '正在生成，尚无完整回答。' : errors[run.error] ?? '本记录不完整。'),
        h('div', {className:'qr-answer'}, ...citationParts(run.answer, run.sources).map((part, i) => part.sourceId
          ? button(part.text, () => void c.cite(run, run.sources.find(source => source.id === part.sourceId)), {key:i, className:'qr-citation', 'aria-label':'定位来源 ' + part.sourceId})
          : h('span', {key:i, className:part.unknown ? 'qr-unknown' : undefined}, part.text))),
        h('p', {className:'qr-muted'}, review.needsReview ? '来源待核对：回答缺少合法引用或包含未知引用。' : '引用标记可定位到原文，内容正确性仍待教师复核。'),
        h('details', {}, h('summary', {}, '本次来源与模型'),
          h('p', {}, run.route.model + ' / ' + run.route.provider), h('p', {className:'qr-identity'}, 'SHA-256：' + run.document.id),
          ...extractionNotices(run.document.extraction).map((notice, i) => h('p', {key:'w' + i}, notice)),
          ...run.sources.map(source => h('div', {key:source.id}, button('[' + source.id + '] ' + sourceLabel(source), () => void c.cite(run, source)), h('pre', {}, source.text))))
      )
    }
    return h('div', {className:'qr', ref:rootRef}, h('style', {}, readingCSS),
      h('header', {className:'qr-header'}, onBack && button('返回对话', onBack, {className:'qr-back'}), h('h1', {}, '材料伴读'),
        h('div', {className:'qr-workspaces'}, h('label', {}, '工作区', h('select', {value:s.workspaceId, 'aria-label':'工作区', onChange:e => void c.selectWorkspace(e.target.value)}, h('option', {value:''}, '请选择工作区'), ...s.workspaces.map(w => h('option', {value:w.id, key:w.id}, w.title)))), button(s.refreshingWorkspaces ? '刷新中…' : '刷新', () => void c.refreshWorkspaces(), {'aria-label':'刷新工作区列表', 'aria-busy':s.refreshingWorkspaces, disabled:s.refreshingWorkspaces}))),
      s.workspaceMissing && h('div', {className:'qr-banner qr-error', role:'alert'}, '当前工作区已不可用，请重新选择工作区。已保存的材料、摘录和问答记录不会删除。'),
      s.workspacesError && h('div', {className:'qr-banner qr-error', role:'alert'}, s.workspacesError),
      s.workspacesNotice && h('div', {className:'qr-banner', role:'status'}, s.workspacesNotice),
      s.error && h('div', {className:'qr-banner qr-error', role:'alert'}, s.error),
      s.notice && h('div', {className:'qr-banner', role:'status'}, s.notice),
      s.loading && h('div', {className:'qr-banner', role:'status'}, '正在读取本地材料…'),
      s.parsing && h('div', {className:'qr-banner qr-toolbar', role:'status'}, h('span', {}, '正在本机解析…' + (s.parsing.stage === 'pdf' ? ' PDF 页 ' : s.parsing.stage === 'docx' ? ' Word 结构 ' : '') + (s.parsing.total ? s.parsing.done + ' / ' + s.parsing.total : '')), button('取消导入', () => c.cancelImport())),
      !s.workspaceId ? h('section', {className:'qr-empty'}, h('h2', {}, '先选择一个工作区'), h('p', {}, '材料快照、摘录和问答将保存在该工作区。')) : h(React.Fragment, {},
        h('nav', {className:'qr-tabs', 'aria-label':'阅读视图'}, button('材料', () => c.set({showMaterials:!s.showMaterials}), {'aria-expanded':s.showMaterials}), button('原文', () => c.set({pane:'original'}), {'aria-pressed':s.pane === 'original'}), button('问答', () => c.set({pane:'qa'}), {'aria-pressed':s.pane === 'qa'})),
        h('div', {className:'qr-layout', 'data-pane':s.pane, 'data-materials':s.showMaterials},
          h('aside', {className:'qr-materials', 'aria-label':'材料列表'}, h('h2', {}, '本地材料'),
            button('导入材料', () => fileRef.current?.click(), {className:'qr-import qr-primary', disabled}),
            h('input', {ref:fileRef, className:'qr-file', type:'file', accept:'.txt,.md,.pdf,.docx', 'aria-label':'选择 TXT、Markdown、PDF 或 DOCX 文件', onChange:e => { const file = e.target.files[0]; e.target.value = ''; if (file) void c.importFile(file) }}),
            h('small', {}, 'TXT / MD ≤ 256 KiB；PDF / DOCX ≤ 2 MiB'), h('details', {}, h('summary', {}, '格式说明'), h('small', {}, '仅本机解析；PDF 为提取文本，扫描件需先 OCR。Word 按章节、段落及表格行列定位。Markdown 以纯文本显示。')),
            h('ul', {className:'qr-docs'}, ...s.documents.map(d => h('li', {key:d.id}, button(h(React.Fragment, {}, h('strong', {}, d.name), h('small', {}, formatOf(d).toUpperCase() + ' · ' + d.paragraphs + ' 段')), () => void c.openDocument(d.id), {'aria-pressed':doc?.id === d.id})))),
            !s.documents.length && h('p', {className:'qr-muted'}, '导入一份材料开始阅读。')),
          h('main', {className:'qr-reader', 'aria-label':'原文'}, !doc ? h('section', {className:'qr-empty'}, h('h2', {}, '把材料放在手边'), h('p', {}, '导入 TXT、Markdown、PDF 或 DOCX 后，可搜索材料、保存摘录，再选择片段提问。'), button('导入材料', () => fileRef.current?.click(), {disabled})) : h(React.Fragment, {},
            h('div', {className:'qr-title'}, h('h2', {}, doc.name), h('small', {}, doc.paragraphs.length + ' 个段落 · 已保存快照')),
            doc.extraction && h(ExtractionNotice, {key:doc.id, extraction:doc.extraction}),
            h('form', {className:'qr-search', onSubmit:e => { e.preventDefault(); void c.search() }}, h('input', {'aria-label':'原文关键词', placeholder:'搜索材料中的关键词', maxLength:LIMITS.questionChars, value:s.query, onChange:e => c.input('query', e.target.value)}), h('button', {type:'submit', disabled:disabled || !s.query.trim()}, '搜索')),
            h('small', {}, '按字词匹配：中文用相邻双字，英文用单词；不理解语义，最多显示 20 处。'),
            s.searched && h('div', {className:'qr-results', 'aria-label':'搜索结果'}, s.hits.length ? s.hits.map(hit => button(sourceLabel(hit) + ' · ' + hit.text.slice(0, 90), () => c.selectParagraph(hit.locator), {key:hit.locator})) : h('p', {role:'status'}, '未找到匹配原文。请尝试材料中的其他关键词。')),
            h('article', {'aria-label':'材料段落'}, ...(doc.format === 'pdf' ? doc.extraction.pages.map(page => h('section', {key:page.number, 'data-page':page.number}, h('h3', {}, 'PDF 第 ' + page.number + ' 页'), ...doc.paragraphs.filter(p => p.location.page === page.number).map(paragraphView), !page.units && h('p', {className:'qr-error'}, '本页未提取到文字；如有内容请先做 OCR。'))) : doc.paragraphs.map(paragraphView))),
            s.selected && h('section', {className:'qr-note-editor', 'aria-label':'保存摘录'}, h('h3', {}, '摘录 · ' + sourceLabel(doc.paragraphs.find(p => p.locator === s.selected))), h('label', {className:'qr-field'}, '摘录文字（可保留段落中的一部分）', h('textarea', {'aria-label':'摘录文字（可保留段落中的一部分）', value:s.excerpt, maxLength:4000, onChange:e => c.input('excerpt', e.target.value)})), h('label', {className:'qr-field'}, '我的笔记', h('textarea', {'aria-label':'我的笔记', value:s.comment, maxLength:2000, onChange:e => c.input('comment', e.target.value)})), button('保存摘录', () => void c.saveNote(), {disabled:disabled || !s.excerpt.trim()})),
            h('details', {}, h('summary', {}, '已保存摘录（' + s.notes.filter(n => n.documentId === doc.id).length + '）'), ...s.notes.filter(n => n.documentId === doc.id).map(n => h('section', {className:'qr-note', key:n.id}, button(sourceLabel(doc.paragraphs.find(p => p.locator === n.locator)), () => c.selectParagraph(n.locator)), h('blockquote', {}, n.text), h('p', {}, n.comment)))),
            h('details', {}, h('summary', {}, '文档与容量信息'), h('p', {className:'qr-identity'}, 'SHA-256：' + doc.id), h('p', {}, doc.format ? '身份基于原始文件字节，原始字节保存在本地快照；提取文本另有校验。' : '身份基于规范化文本；同内容不重复导入，同名不同内容保留独立版本。'), doc.contentHash && h('p', {className:'qr-identity'}, '提取文本 SHA-256：' + doc.contentHash), h('p', {}, '记录仅保存在工作区 .qcu-reading；不改动原文件。'), h('p', {}, '最多 24 份材料、200 条摘录、50 次问答，共 8 MB（含原始字节）；本版不自动清理。')))),
          h('aside', {className:'qr-qa', 'aria-label':'材料问答'}, h('h2', {}, '带着原文提问'), h('p', {className:'qr-muted'}, '先找片段，确认本次发送内容后再调用默认模型。'),
            h('label', {className:'qr-field'}, '问题', h('textarea', {'aria-label':'问题', className:'qr-question', value:s.question, maxLength:LIMITS.questionChars, disabled:!doc, placeholder:'例如：形成性评价如何提供学习反馈？', onChange:e => c.input('question', e.target.value)})),
            button('准备问答', () => void c.prepare(), {ref:prepareRef, disabled:disabled || !doc || !s.question.trim() || !!active}),
            active && (!s.run || s.run.id !== active.id) && h('p', {}, '当前工作区有问答正在生成。', button('查看当前问答', () => c.set({run:active}))),
            s.prepared && h('section', {className:'qr-confirm', 'aria-label':'发送前确认', onKeyDown:e => { if (e.key === 'Escape') { e.preventDefault(); dismiss() } }},
              h('h3', {}, '发送前确认'), h('p', {className:'qr-muted'}, '本次只发送以下问题与完整片段；使用云模型时，内容将发送给所示提供方。'),
              h('dl', {}, h('dt', {}, '模型 / 提供方'), h('dd', {}, s.prepared.route.model + ' / ' + s.prepared.route.provider), h('dt', {}, '推理策略 / 输出上限'), h('dd', {}, s.prepared.route.policy.effort + (s.prepared.route.policy.effort === 'default' ? '（宿主默认：' + (s.prepared.route.policy.defaultEffort ?? '未声明') + '）' : '') + ' / ' + s.prepared.route.policy.outputBudget + ' tokens'), h('dt', {}, '材料'), h('dd', {}, s.prepared.document.name + ' · ' + formatOf(s.prepared.document).toUpperCase()), h('dt', {}, '问题'), h('dd', {}, s.prepared.question)),
              h('details', {}, h('summary', {}, '模型策略详情'), h('p', {className:'qr-identity'}, 'SHA-256：' + s.prepared.document.id), h('p', {}, '支持档位：' + (s.prepared.route.policy.supportedEfforts.join(', ') || '未声明') + '；宿主默认：' + (s.prepared.route.policy.defaultEffort ?? '未声明'))),
              s.prepared.document.extraction && h(ExtractionNotice, {key:s.prepared.id, extraction:s.prepared.document.extraction}),
              ...s.prepared.sources.map(source => h('section', {key:source.id}, button('[' + source.id + '] ' + sourceLabel(source) + (source.clipped ? '（段落节选）' : ''), () => c.selectParagraph(source.locator)), h('pre', {}, source.text))),
              h('label', {className:'qr-consent'}, h('input', {ref:confirmRef, type:'checkbox', checked:s.consent, onChange:e => c.set({consent:e.target.checked})}), '我确认将本次问题和以上片段发送给所示模型。'),
              h('div', {className:'qr-toolbar'}, button('确认发送', () => void c.start(), {className:'qr-primary', disabled:disabled || !s.consent}), button('取消确认', dismiss, {disabled:s.busy}))),
            s.run && runView(s.run),
            h('details', {}, h('summary', {}, '问答记录（' + s.runs.length + '）'), h('div', {className:'qr-history'}, ...s.runs.map(run => button(h(React.Fragment, {}, run.question, h('small', {}, statusLabel(run.status) + ' · ' + run.document.name)), () => c.set({run, pane:'qa'}), {key:run.id, 'aria-pressed':s.run?.id === run.id})))),
            h('p', {className:'qr-muted', style:{marginTop:16}}, '回答为教师审阅草案；来源可定位不代表结论正确。')))))
  }
  function Entry({size = 20}) { return h('span', {'aria-hidden':true, style:{fontSize:size, lineHeight:1}}, '读') }
  return {Page, Entry}
}


function createPlugin(React) {
  const {Page, Entry} = createReadingViews(React), h = React.createElement
  return {inject:['slots', 'layout'], apply(ctx) {
    let current = null
    const listeners = new Set(), subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }, snapshot = () => current
    const update = value => { current = value; for (const fn of listeners) fn() }
    function Panel() {
      const controller = React.useSyncExternalStore(subscribe, snapshot, snapshot)
      return controller ? h(Page, {controller, onBack:() => ctx.layout.selectPanel(null)}) : h('p', {style:{padding:16}}, '材料伴读正在连接；请确认插件已启用。')
    }
    ctx.effect(() => () => listeners.clear())
    ctx.inject(['remote'], async service => {
      let consumer, unmount
      try {
        unmount = await service.remote.$mount(remoteContribution)
        consumer = service.inject(['remote.qcuReading'], inner => {
          const controller = new ReadingController(inner.remote.qcuReading)
          update(controller); void controller.boot()
          inner.on('connection/reset', () => void controller.reconnect())
          inner.effect(() => () => { controller.dispose(); update(null) })
        })
      } catch { await consumer?.dispose(); await unmount?.(); return }
      service.effect(() => async () => { await consumer.dispose(); await unmount() })
    })
    ctx.slots.inject('main', () => ctx.slots.register({name:'main', key:'qcu-reading'}, Panel))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({name:'sidebar.panellist', id:'qcu-reading', order:34, label:'材料伴读'}, Entry))
  }}
}

return createPlugin(React);
}});
