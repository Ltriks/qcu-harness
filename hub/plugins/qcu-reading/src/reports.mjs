import {errors} from './protocol.mjs'
export const statusLabel = status => ({running:'生成中', completed:'已生成草案', failed:'失败 · 不完整', cancelled:'已取消 · 不完整', interrupted:'已中断 · 不完整'}[status] ?? '不完整')
export function citationParts(answer, sources) {
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
export function sourceReview(answer, sources) {
  const references = citationParts(answer, sources), known = references.filter(r => r.sourceId)
  return {needsReview:!known.length || references.some(r => r.unknown), known:[...new Set(known.map(r => r.sourceId))], unknown:references.filter(r => r.unknown).map(r => r.text)}
}
// Keep exact data in a fence longer than any backtick run in it. Imported HTML,
// links and even embedded fences stay literal when the export is rendered.
function quoted(value) {
  const data = String(value), longest = Math.max(0, ...[...data.matchAll(/`+/g)].map(match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return fence + 'text\n' + data + '\n' + fence
}
export function exportRun(run) {
  const review = sourceReview(run.answer, run.sources)
  return [
    '# 教师审阅草案 · QCU 伴读',
    '模型输出与材料均待教师复核；来源可定位不代表推理正确。',
    '状态：' + statusLabel(run.status),
    run.status === 'completed' ? '' : '本记录不完整。' + (errors[run.error] ?? ''),
    '文档名称：\n' + quoted(run.document.name),
    '文档身份 / 版本：SHA-256 ' + run.document.id + '（规范化 UTF-8 文本，版本由内容确定）',
    '记录：' + run.id + '\n\n时间：' + new Date(run.createdAt).toISOString(),
    '模型 / 提供方：\n' + quoted(run.route.model + ' / ' + run.route.provider),
    '推理策略：' + run.route.policy.effort + '；宿主默认：' + (run.route.policy.defaultEffort ?? '未声明') + '；支持档位：' + (run.route.policy.supportedEfforts.join(', ') || '未声明') + '；输出上限：' + run.route.policy.outputBudget,
    '## 问题\n\n' + quoted(run.question),
    '## 本次确认的完整来源片段',
    ...run.sources.map(s => '### [' + s.id + '] ' + s.locator + '（字符 ' + s.start + '–' + s.end + (s.clipped ? '，段落节选' : '') + '）\n\n' + quoted(s.text)),
    '## 模型草案\n\n' + quoted(run.answer || '（无完整回答）'),
    review.needsReview ? '来源待核对：回答缺少合法引用或包含未知引用。' : '引用标记可定位到上述片段；内容正确性仍待教师复核。'
  ].filter(Boolean).join('\n\n') + '\n'
}
