export const VERSION = '0.1.0-pilot.4', PROTOCOL = 2, OUTPUT_BUDGET = 2000
export const LIMITS = Object.freeze({fileBytes:262144, binaryBytes:2097152, requestChars:3000000, extractedBytes:524288, pages:120, items:40000, zipEntries:256, zipEntryBytes:2097152, zipTotalBytes:8388608, zipRatio:100, parseMilliseconds:15000, documents:24, paragraphs:2000, notes:200, runs:50, storeBytes:8000000, answerChars:24000, questionChars:2000, snippetChars:1800, sources:4})
export function check(ok, code = 'invalid-input') {
  if (!ok) throw Object.assign(Error(code), {code})
}
export function exact(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k)), 'invalid-fields')
  return value
}
export function text(value, max, required = true) {
  check(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(value) && (!required || value.trim()), 'invalid-text')
  return value
}
export function parseImport(raw) {
  exact(raw, ['name', 'content'])
  const name = text(raw.name, 180)
  check(!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name) && name.trim() === name && !name.startsWith('.'), 'invalid-name')
  check(/\.(txt|md)$/i.test(name), 'unsupported-format')
  const content = text(raw.content, LIMITS.fileBytes).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n')
  check(new TextEncoder().encode(content).length <= LIMITS.fileBytes, 'file-too-large')
  return {name, content}
}
export function binaryImport(raw) {
  exact(raw, ['name', 'base64'])
  const name = text(raw.name, 180)
  check(!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name) && name.trim() === name && !name.startsWith('.'), 'invalid-name')
  check(/\.(pdf|docx)$/i.test(name), 'unsupported-format')
  check(typeof raw.base64 === 'string' && raw.base64.length > 0 && raw.base64.length <= 4 * Math.ceil(LIMITS.binaryBytes / 3), 'binary-too-large')
  check(raw.base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(raw.base64), 'invalid-binary')
  return {name, base64:raw.base64, format:name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}
}
export const formatOf = d => d.format ?? (d.name?.toLowerCase().endsWith('.md') ? 'md' : 'txt')
export function sourceLabel(source) {
  const l = source.location
  if (l?.format === 'pdf') return 'PDF 第 ' + l.page + ' 页 · 段落 ' + l.paragraph
  if (l?.format === 'docx') return (l.section.length ? l.section.join(' / ') + ' · ' : '') + (l.table ? '表 ' + l.table.index + ' · 第 ' + l.table.row + ' 行 · 第 ' + l.table.cell + ' 格 · 段落 ' + l.table.paragraph : '段落 ' + l.paragraph)
  return source.locator
}
export const warningLabels = {
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
export function extractionNotices(extraction) {
  const groups = new Map()
  for (const w of extraction?.warnings ?? []) {
    if (!groups.has(w.code)) groups.set(w.code, [])
    if (w.page) groups.get(w.code).push(w.page)
  }
  return [...groups].map(([code, pages]) => (pages.length ? '第 ' + [...new Set(pages)].join('、') + ' 页：' : '') + warningLabels[code])
}
export function paragraphsFor(content) {
  const paragraphs = []
  // Blank lines delimit paragraphs; offsets refer to the immutable normalized text.
  for (const match of content.matchAll(/[^\n]+(?:\n(?![\t ]*\n)[^\n]+)*/g)) {
    if (!match[0].trim()) continue
    paragraphs.push({locator:'p' + String(paragraphs.length + 1).padStart(4, '0'), start:match.index, end:match.index + match[0].length, text:match[0]})
  }
  check(paragraphs.length > 0 && paragraphs.length <= LIMITS.paragraphs, 'paragraph-limit')
  return paragraphs
}
export function searchTerms(query) {
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
export function searchDocument(document, query, limit = 20) {
  const terms = searchTerms(query)
  return document.paragraphs.map(p => {
    const lower = p.text.toLowerCase(), matched = terms.filter(t => lower.includes(t))
    return {...p, score:matched.length, matched}
  }).filter(p => p.score).sort((a, b) => b.score - a.score || a.start - b.start).slice(0, limit)
}
export function evidenceFor(document, question) {
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
export function parseRoute(raw) {
  exact(raw, ['provider', 'model', 'policy'])
  text(raw.provider, 200); text(raw.model, 200)
  const p = exact(raw.policy, ['effort', 'supportedEfforts', 'defaultEffort', 'outputBudget'])
  check(Array.isArray(p.supportedEfforts) && p.supportedEfforts.length <= 32 && p.supportedEfforts.every(e => typeof e === 'string' && /^[\w-]{1,80}$/.test(e)) && new Set(p.supportedEfforts).size === p.supportedEfforts.length, 'invalid-model-policy')
  const supportedEfforts = [...p.supportedEfforts].sort()
  const effort = supportedEfforts.includes('low') ? 'low' : supportedEfforts.includes('off') ? 'off' : 'default'
  check(p.effort === effort && (p.defaultEffort === null || supportedEfforts.includes(p.defaultEffort)) && p.outputBudget === OUTPUT_BUDGET, 'invalid-model-policy')
  return {provider:raw.provider, model:raw.model, policy:{effort, supportedEfforts, defaultEffort:p.defaultEffort, outputBudget:OUTPUT_BUDGET}}
}
export function policyFor(info) {
  const supportedEfforts = info.reasoning?.efforts?.map(e => e.id) ?? []
  return parseRoute({provider:'policy', model:'policy', policy:{effort:supportedEfforts.includes('low') ? 'low' : supportedEfforts.includes('off') ? 'off' : 'default', supportedEfforts, defaultEffort:info.reasoning?.defaultEffort ?? null, outputBudget:OUTPUT_BUDGET}}).policy
}
export const sameRoute = (a, b) => JSON.stringify(parseRoute(a)) === JSON.stringify(parseRoute(b))
export const errors = {
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
export const safeCode = e => Object.hasOwn(errors, e?.code) ? e.code : 'operation-failed'
const codec = (symbol, max) => ({mode:'strict', typeSymbol:'qcu-reading#' + symbol, create:() => ({parse(value) { check(typeof value === 'string' && value.length <= max, 'invalid-fields'); JSON.parse(value); return value }})})
export const remoteContribution = {package:'qcu-reading', descriptors:[{id:'qcu-reading#qcuReading/dispatch', service:'qcuReading', namespace:'qcuReading', method:'dispatch', invocation:{kind:'direct'}, parameters:[{name:'payload', wire:'payload', source:'json', codec:codec('request', LIMITS.requestChars)}], cancellation:{parameter:'signal'}, result:codec('reply', 10000000)}]}
