export const VERSION = '0.1.0-pilot.1', PROTOCOL = 1, OUTPUT_BUDGET = 2000
export const LIMITS = Object.freeze({fileBytes:262144, documents:24, paragraphs:2000, notes:200, runs:50, storeBytes:8000000, answerChars:24000, questionChars:2000, snippetChars:1800, sources:4})
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
  return searchDocument(document, question, LIMITS.sources).map((p, i) => {
    const first = Math.min(...p.matched.map(t => p.text.toLowerCase().indexOf(t)))
    let offset = Math.max(0, first - 100)
    if (offset && /[\udc00-\udfff]/.test(p.text[offset])) offset--
    let end = Math.min(p.text.length, offset + LIMITS.snippetChars)
    if (end < p.text.length && /[\udc00-\udfff]/.test(p.text[end])) end--
    return {id:'S' + (i + 1), locator:p.locator, start:p.start + offset, end:p.start + end, text:p.text.slice(offset, end), clipped:offset > 0 || end < p.text.length}
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
  'unsupported-format':'本版仅支持 UTF-8 TXT 和 Markdown；PDF、DOCX 与 OCR 已列入后续计划。',
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
export const remoteContribution = {package:'qcu-reading', descriptors:[{id:'qcu-reading#qcuReading/dispatch', service:'qcuReading', namespace:'qcuReading', method:'dispatch', invocation:{kind:'direct'}, parameters:[{name:'payload', wire:'payload', source:'json', codec:codec('request', 600000)}], cancellation:{parameter:'signal'}, result:codec('reply', 10000000)}]}
