import {createHash} from 'node:crypto'
import {binaryImport, check, exact, text, LIMITS, warningLabels} from './protocol.mjs'
export const hash = value => createHash('sha256').update(value).digest('hex')
export function binaryBytes(raw) {
  const parsed = binaryImport(raw), bytes = Buffer.from(parsed.base64, 'base64')
  check(bytes.length <= LIMITS.binaryBytes, 'binary-too-large')
  check(bytes.toString('base64') === parsed.base64, 'invalid-binary')
  return {...parsed, bytes}
}
const positive = n => Number.isInteger(n) && n > 0 && n <= LIMITS.paragraphs
export function validateExtraction(d) {
  const ok = condition => check(condition, 'invalid-store')
  text(d.content, LIMITS.extractedBytes); ok(Buffer.byteLength(d.content) <= LIMITS.extractedBytes)
  ok(Array.isArray(d.paragraphs) && d.paragraphs.length > 0 && d.paragraphs.length <= LIMITS.paragraphs)
  const e = exact(d.extraction, ['parser', 'warnings', 'pages'])
  ok(e.parser === (d.format === 'pdf' ? 'pdfjs-dist@6.3.289' : 'saxes@6.0.0/zip@1'))
  const pdf = d.format === 'pdf', counts = new Map(), ids = new Set()
  if (pdf) {
    ok(Array.isArray(e.pages) && e.pages.length > 0 && e.pages.length <= LIMITS.pages)
    e.pages.forEach((p, i) => { exact(p, ['number', 'units']); ok(p.number === i + 1 && Number.isInteger(p.units) && p.units >= 0 && p.units <= LIMITS.paragraphs) })
  } else ok(e.pages === undefined)
  let at = 0, lastPage = 0, lastParagraph = 0
  for (const p of d.paragraphs) {
    exact(p, ['locator', 'start', 'end', 'text', 'location'])
    text(p.text, LIMITS.extractedBytes)
    ok(p.start === at && p.end === at + p.text.length && d.content.slice(p.start, p.end) === p.text && !ids.has(p.locator)); ids.add(p.locator)
    const l = p.location
    if (pdf) {
      exact(l, ['format', 'page', 'paragraph'])
      ok(l.format === 'pdf' && positive(l.page) && l.page <= e.pages.length && l.page >= lastPage)
      const n = (counts.get(l.page) ?? 0) + 1; counts.set(l.page, n)
      ok(l.paragraph === n && p.locator === 'pdf-' + l.page + '-p' + n); lastPage = l.page
    } else {
      exact(l, ['format', 'paragraph', 'section', 'table'])
      ok(l.format === 'docx' && positive(l.paragraph) && l.paragraph > lastParagraph && Array.isArray(l.section) && l.section.length <= 9)
      l.section.forEach(s => text(s, 180)); lastParagraph = l.paragraph
      let locator = 'docx-p' + l.paragraph
      if (l.table) { exact(l.table, ['index', 'row', 'cell', 'paragraph']); ok(Object.values(l.table).every(positive)); const t = l.table; locator = 'docx-t' + t.index + '-r' + t.row + '-c' + t.cell + '-p' + t.paragraph }
      ok(p.locator === locator)
    }
    at = p.end + 2
  }
  ok(at - 2 === d.content.length && d.paragraphs.map(p => p.text).join('\n\n') === d.content)
  if (pdf) e.pages.forEach(p => ok(p.units === (counts.get(p.number) ?? 0)))
  ok(Array.isArray(e.warnings) && e.warnings.length > 0 && e.warnings.length <= 1000 && e.warnings[0].code === (pdf ? 'pdf-review' : 'docx-review'))
  const seen = new Set()
  for (const w of e.warnings) {
    exact(w, ['code', 'page', 'locator']); ok(Object.hasOwn(warningLabels, w.code))
    ok(w.page === undefined || pdf && positive(w.page) && w.page <= e.pages.length)
    ok(w.locator === undefined || ids.has(w.locator))
    const key = JSON.stringify(w); ok(!seen.has(key)); seen.add(key)
  }
  if (pdf) for (const p of e.pages) if (!p.units) ok(e.warnings.some(w => w.code === 'page-no-text' && w.page === p.number))
  return d
}
export function validateBinaryDocument(d) {
  exact(d, ['id', 'name', 'format', 'identity', 'base64', 'contentHash', 'content', 'paragraphs', 'extraction', 'createdAt'])
  const b = binaryBytes({name:d.name, base64:d.base64})
  check(d.format === b.format && d.identity === 'original-bytes-sha256' && d.id === hash(b.bytes) && d.contentHash === hash(d.content), 'invalid-store')
  return validateExtraction(d)
}
export function documentMeta(d) {
  return {id:d.id, name:d.name, createdAt:d.createdAt, ...(d.format ? {format:d.format, identity:d.identity, contentHash:d.contentHash, extraction:d.extraction} : {})}
}
