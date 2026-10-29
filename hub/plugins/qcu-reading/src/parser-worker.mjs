import {parentPort, workerData} from 'node:worker_threads'
import {check, text, LIMITS} from './protocol.mjs'
import {zipEntries} from './zip.mjs'
import xml from '../vendor/xml.mjs'

// Local bytes only. This is lifecycle isolation, not an OS security sandbox.
globalThis.fetch = async () => { throw Error('Remote resources disabled in local parser') }
const {data, format} = workerData
const bound = ok => check(ok, 'parse-limit')
const progress = (stage, done, total) => parentPort.postMessage({progress:{stage, done, total}})
const clean = value => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n')
function builder(parser, firstWarning) {
  const result = {content:'', paragraphs:[], extraction:{parser, warnings:[{code:firstWarning}]}}
  let size = 0
  return {
    result,
    warn(code, detail = {}) {
      const w = {code, ...detail}
      if (!result.extraction.warnings.some(x => JSON.stringify(x) === JSON.stringify(w))) {
        bound(result.extraction.warnings.length < 1000); result.extraction.warnings.push(w)
      }
    },
    add(value, locator, location) {
      value = clean(value).trim(); if (!value) return
      bound(value.length <= LIMITS.extractedBytes && result.paragraphs.length < LIMITS.paragraphs)
      text(value, LIMITS.extractedBytes)
      size += Buffer.byteLength(value) + (result.content ? 2 : 0); bound(size <= LIMITS.extractedBytes)
      if (result.content) result.content += '\n\n'
      const start = result.content.length; result.content += value
      const p = {locator, start, end:result.content.length, text:value, location}
      result.paragraphs.push(p); return p
    }
  }
}
async function pdf() {
  const b = Buffer.from(data)
  check(b.subarray(0, 8).toString('ascii').match(/^%PDF-\d\.\d/) && /%%EOF\s*$/.test(b.subarray(-1024).toString('latin1')), 'invalid-pdf')
  const {default:DOMMatrix} = await import('../vendor/dommatrix.mjs')
  globalThis.DOMMatrix = DOMMatrix
  const api = await import('../vendor/pdf.mjs')
  api.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href
  const out = builder('pdfjs-dist@6.3.289', 'pdf-review'), pages = []
  let pageNumber = 0, repaired = false, items = 0
  // PDF.js logs recoverable omissions. Convert those to visible page-specific limitations.
  const diagnostic = (...args) => {
    const message = args.join(' ').slice(0, 2000)
    if (/Indexing all PDF objects|Invalid XRef|bad XRef/i.test(message)) repaired = true
    if (!pageNumber) return
    if (/Image exceeded|image|jpeg|jpx/i.test(message)) out.warn('images-omitted', {page:pageNumber})
    else if (/font|cmap|encoding|glyph|unicode/i.test(message)) out.warn('encoding-review', {page:pageNumber})
    else out.warn('page-incomplete', {page:pageNumber})
  }
  console.log = diagnostic; console.warn = diagnostic; console.error = diagnostic
  class NoResourceFactory {
    async fetch() { if (pageNumber) out.warn('encoding-review', {page:pageNumber}); throw Error('External font/CMap/wasm resources disabled') }
  }
  const task = api.getDocument({data:Uint8Array.from(data), isEvalSupported:false, enableXfa:false, enableScripting:false, stopAtErrors:true, useSystemFonts:false, disableFontFace:true, useWorkerFetch:false, disableAutoFetch:true, disableStream:true, disableRange:true, isOffscreenCanvasSupported:false, isImageDecoderSupported:false, useWasm:false, maxImageSize:0, canvasMaxAreaInBytes:0, BinaryDataFactory:NoResourceFactory, verbosity:1})
  let passwordDetected = false
  task.onPassword = () => { passwordDetected = true; void task.destroy() }
  let doc
  try {
    doc = await task.promise
    bound(!globalThis.__qcuPDFDecodeLimit)
    check(!repaired, 'invalid-pdf'); check(await doc.getPermissions() === null, 'encrypted-pdf')
    bound(doc.numPages > 0 && doc.numPages <= LIMITS.pages)
    out.result.extraction.pages = pages
    for (let n = 1; n <= doc.numPages; n++) {
      pageNumber = n; progress('pdf', n - 1, doc.numPages)
      const page = await doc.getPage(n), before = out.result.paragraphs.length
      let line = '', previous, unit = 0
      const flush = () => { if (line.trim()) out.add(line, 'pdf-' + n + '-p' + (++unit), {format:'pdf', page:n, paragraph:unit}); line = ''; previous = undefined }
      try {
        for await (const chunk of page.streamTextContent()) for (const item of chunk.items) {
          bound(++items <= LIMITS.items)
          if (typeof item.str !== 'string') continue
          if (previous && Math.abs(item.transform[5] - previous.transform[5]) > Math.max(2, Math.abs(item.height) * .5)) flush()
          if (previous && item.transform[4] - (previous.transform[4] + previous.width) > 50) {
            out.warn('layout-review', {page:n}); line += '\t'
          } else if (line && !/\s$/.test(line) && item.str && !/^\s/.test(item.str) && previous && item.transform[4] - (previous.transform[4] + previous.width) > 1) line += ' '
          line += item.str; bound(line.length <= LIMITS.extractedBytes)
          if (/[=∑√∫±≤≥]/u.test(item.str)) out.warn('math-review', {page:n})
          previous = item; if (item.hasEOL) flush()
        }
        flush()
      } catch (e) {
        if (e.code === 'parse-limit') throw e
        flush(); out.warn('page-incomplete', {page:n})
      }
      try {
        const ops = await page.getOperatorList({annotationMode:api.AnnotationMode.DISABLE})
        bound(ops.fnArray.length <= LIMITS.items)
        if (out.result.paragraphs.length > before && !ops.fnArray.length) out.warn('page-incomplete', {page:n})
        if (ops.fnArray.some((fn, i) => fn === api.OPS.moveText && Math.abs(ops.argsArray[i][0]) > 80 && ops.argsArray[i][1] === 0)) out.warn('layout-review', {page:n})
        if (ops.fnArray.some(fn => [api.OPS.paintImageXObject, api.OPS.paintInlineImageXObject, api.OPS.paintImageMaskXObject, api.OPS.paintImageXObjectRepeat, api.OPS.paintImageMaskXObjectRepeat].includes(fn))) out.warn('images-omitted', {page:n})
      } catch (e) { if (e.code === 'parse-limit') throw e; out.warn('page-incomplete', {page:n}) }
      const units = out.result.paragraphs.length - before
      bound(!globalThis.__qcuPDFDecodeLimit)
      if (!units) out.warn('page-no-text', {page:n})
      pages.push({number:n, units})
      page.cleanup(); progress('pdf', n, doc.numPages)
    }
    check(!repaired, 'invalid-pdf'); check(out.result.paragraphs.length, out.result.extraction.warnings.some(w => w.code === 'encoding-review') ? 'pdf-encoding' : 'ocr-needed')
    return out.result
  } catch (e) {
    bound(!globalThis.__qcuPDFDecodeLimit)
    if (passwordDetected || e.name === 'PasswordException') check(false, 'encrypted-pdf')
    if (['parse-limit', 'encrypted-pdf', 'ocr-needed', 'pdf-encoding', 'invalid-pdf'].includes(e.code)) throw e
    check(false, 'invalid-pdf')
  } finally { await task.destroy() }
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const attr = (node, name, uri = W) => Object.values(node.attributes).find(a => a.local === name && a.uri === uri)?.value
function parseXML(bytes, hooks = {}) {
  let value
  try {
    const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe
    value = new TextDecoder(utf16 ? 'utf-16le' : 'utf-8', {fatal:true}).decode(bytes)
  } catch { check(false, 'invalid-docx') }
  const parser = new xml.SaxesParser({xmlns:true}), stack = []
  let chars = 0, nodes = 0
  parser.on('error', () => check(false, 'invalid-docx'))
  parser.on('doctype', () => check(false, 'invalid-docx'))
  parser.on('processinginstruction', () => check(false, 'invalid-docx'))
  parser.on('opentag', node => {
    bound(++nodes <= 80000 && stack.length < 64 && Object.keys(node.attributes).length <= 64)
    for (const a of Object.values(node.attributes)) bound(a.value.length <= 4096)
    stack.push(node); hooks.open?.(node, stack)
  })
  parser.on('closetag', node => { hooks.close?.(node, stack); stack.pop() })
  const content = v => { chars += v.length; bound(chars <= LIMITS.zipEntryBytes); hooks.text?.(v, stack) }
  parser.on('text', content); parser.on('cdata', content)
  try { for (let i = 0; i < value.length; i += 8192) parser.write(value.slice(i, i + 8192)); parser.close() }
  catch (e) { if (['parse-limit', 'unsafe-docx'].includes(e.code)) throw e; check(false, 'invalid-docx') }
}
async function docx() {
  const entries = zipEntries(data), files = new Map(), out = builder('saxes@6.0.0/zip@1', 'docx-review')
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i], bytes = e.read(); progress('docx', i + 1, entries.length)
    if (/\.xml$|\.rels$/i.test(e.name)) {
      parseXML(bytes)
      if (['word/document.xml', 'word/styles.xml', '[Content_Types].xml'].includes(e.name)) files.set(e.name, bytes)
      if (/\.rels$/.test(e.name)) parseXML(bytes, {open(n) { if (n.local === 'Relationship' && attr(n, 'TargetMode', '') === 'External') out.warn('external-labels-only') }})
    }
    if (/^word\/media\//.test(e.name)) out.warn('images-omitted')
    if (/^word\/(footnotes|endnotes)\.xml$/.test(e.name)) out.warn('footnotes-omitted')
    if (/^word\/comments/.test(e.name)) out.warn('comments-omitted')
    if (/^word\/(header|footer)\d*\.xml$/.test(e.name)) out.warn('headers-omitted')
  }
  check(files.has('word/document.xml') && files.has('[Content_Types].xml'), 'invalid-docx')
  let main = false
  parseXML(files.get('[Content_Types].xml'), {open(n) {
    const type = attr(n, 'ContentType', '') ?? ''
    check(!/macroEnabled|vbaProject/i.test(type), 'unsafe-docx')
    if (attr(n, 'PartName', '') === '/word/document.xml' && type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') main = true
  }})
  check(main, 'invalid-docx')
  const styles = new Map()
  let style
  if (files.has('word/styles.xml')) parseXML(files.get('word/styles.xml'), {
    open(n) {
      if (n.uri !== W) return
      if (n.local === 'style') style = {id:attr(n, 'styleId'), level:0}
      if (style && n.local === 'outlineLvl' && /^[0-8]$/.test(attr(n, 'val'))) style.level = Number(attr(n, 'val')) + 1
      if (style && n.local === 'name') { const m = /^(?:heading\s*|标题\s*)([1-9])$/i.exec(attr(n, 'val') ?? ''); if (m) style.level ||= Number(m[1]) }
    },
    close(n) { if (n.uri === W && n.local === 'style') { if (style?.level) styles.set(style.id, style.level); style = undefined } }
  })
  let p, para = 0, tableIndex = 0, table, breadcrumb = [], body = false, bodySeen = false
  parseXML(files.get('word/document.xml'), {
    open(n, stack) {
      if (stack.length === 1) check(n.uri === W && n.local === 'document', 'invalid-docx')
      if (n.uri === W && n.local === 'body') { check(!bodySeen, 'invalid-docx'); body = bodySeen = true }
      if (!body) return
      const hidden = stack.some(s => s.uri === W && ['drawing', 'pict', 'object', 'txbxContent', 'del', 'moveFrom'].includes(s.local) || s.uri === M)
      if (n.uri === M) out.warn('equations-omitted')
      if (n.uri === W && ['drawing', 'pict'].includes(n.local)) out.warn('images-omitted')
      if (n.uri === W && ['object', 'altChunk', 'txbxContent', 'sym', 'fldSimple'].includes(n.local)) out.warn('objects-omitted')
      if (n.uri === W && ['del', 'ins', 'moveFrom', 'moveTo'].includes(n.local)) out.warn('revisions-review')
      if (hidden || n.uri !== W) return
      if (n.local === 'tbl') { check(!table, 'invalid-docx'); bound(++tableIndex <= LIMITS.paragraphs); table = {index:tableIndex, row:0, cell:0, paragraph:0} }
      if (n.local === 'tr' && table) { bound(++table.row <= LIMITS.paragraphs); table.cell = 0 }
      if (n.local === 'tc' && table) { bound(++table.cell <= LIMITS.paragraphs); table.paragraph = 0 }
      if (['gridSpan', 'vMerge', 'hMerge'].includes(n.local)) out.warn('table-merge-review')
      if (n.local === 'p') { check(!p, 'invalid-docx'); bound(++para <= LIMITS.paragraphs); if (table) table.paragraph++; p = {value:'', paragraph:para, level:0, table:table ? {...table} : undefined} }
      if (!p) return
      if (n.local === 'pStyle') p.level = styles.get(attr(n, 'val')) ?? Number(/^Heading([1-9])$/i.exec(attr(n, 'val') ?? '')?.[1] ?? 0)
      if (n.local === 'outlineLvl' && /^[0-8]$/.test(attr(n, 'val'))) p.level = Number(attr(n, 'val')) + 1
      if (['tab', 'br', 'cr'].includes(n.local)) p.value += n.local === 'tab' ? '\t' : '\n'
      if (['footnoteReference', 'endnoteReference'].includes(n.local)) out.warn('footnotes-omitted')
    },
    text(value, stack) {
      if (p && stack.at(-1)?.uri === W && stack.at(-1).local === 't' && !stack.some(s => s.uri === W && ['drawing', 'pict', 'object', 'txbxContent', 'del', 'moveFrom'].includes(s.local) || s.uri === M)) { p.value += value; bound(p.value.length <= LIMITS.extractedBytes) }
    },
    close(n, stack) {
      if (n.uri !== W) return
      const hidden = stack.slice(0, -1).some(s => s.uri === W && ['drawing', 'pict', 'object', 'txbxContent', 'del', 'moveFrom'].includes(s.local) || s.uri === M)
      if (hidden) return
      if (n.local === 'p' && p) {
        if (p.level && p.value.trim()) { breadcrumb.length = p.level - 1; breadcrumb[p.level - 1] = clean(p.value).trim().slice(0, 180).replace(/[\ud800-\udbff]$/, '') }
        const location = {format:'docx', paragraph:p.paragraph, section:breadcrumb.filter(Boolean), ...(p.table ? {table:p.table} : {})}
        const locator = p.table ? 'docx-t' + p.table.index + '-r' + p.table.row + '-c' + p.table.cell + '-p' + p.table.paragraph : 'docx-p' + p.paragraph
        out.add(p.value, locator, location); p = undefined
      }
      if (n.local === 'tbl') table = undefined
      if (n.local === 'body') body = false
    }
  })
  check(bodySeen, 'invalid-docx'); check(out.result.paragraphs.length, 'empty-docx')
  return out.result
}
try {
  bound(data instanceof Uint8Array && data.length <= LIMITS.binaryBytes)
  progress('opening', 0, 0)
  check(['pdf', 'docx'].includes(format), 'invalid-docx')
  parentPort.postMessage(await (format === 'pdf' ? pdf() : docx()))
} catch (e) { parentPort.postMessage({error:e?.code ?? (format === 'pdf' ? 'invalid-pdf' : 'invalid-docx')}) }
finally { parentPort.close() }
