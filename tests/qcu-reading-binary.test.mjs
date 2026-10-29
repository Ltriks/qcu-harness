import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {pdfFixture, docxFixture, accountingFixture} from './fixtures/qcu-reading-binary.mjs'
const root = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(process.env.QCU_READING_PACKAGE_ROOT + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', root))
const {parseBinary, parserActivity} = await import(new URL('src/parser.mjs', root))
const {hash, validateExtraction} = await import(new URL('src/source.mjs', root))
const {LIMITS, sourceLabel, evidenceFor, VERSION, PROTOCOL} = await import(new URL('src/protocol.mjs', root))
const {ReadingController} = await import(new URL('src/controller.mjs', root))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', root))
const {zipEntries} = await import(new URL('src/zip.mjs', root))
const code = c => e => e.code === c
const file = (name, bytes) => ({name, base64:bytes.toString('base64')})
const route = () => ({provider:'synthetic', model:'local-fixture', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:2000}})
async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'qcu-reading-binary-')), calls = []
  const store = await new ReadingStore(directory, {model:async () => route(), generate:async input => { calls.push(input); return '自编结论 [S1] [S99]' }, ...options}).init()
  t.after(async () => { await store.dispose(); await rm(directory, {recursive:true, force:true}) })
  return {directory, store, calls}
}
test('actual PDF bytes: Chinese, physical page gaps, images/formulas/layout warnings, bounded progress, offsets and no JS execution', async () => {
  const progress = [], parsed = await parseBinary(pdfFixture(), 'pdf', {progress:p => progress.push(p)})
  validateExtraction({...parsed, format:'pdf'})
  assert.match(parsed.content, /Local feedback page one/); assert.match(parsed.content, /第二页形成性评价反馈/)
  assert.deepEqual(parsed.extraction.pages, [{number:1, units:1}, {number:2, units:3}, {number:3, units:0}, {number:4, units:0}, {number:5, units:1}])
  for (const [code, page] of [['page-no-text', 3], ['page-no-text', 4], ['images-omitted', 3], ['math-review', 2], ['layout-review', 2]]) assert.ok(parsed.extraction.warnings.some(w => w.code === code && w.page === page), code)
  assert.equal(parsed.paragraphs.at(-1).location.page, 5)
  for (const p of parsed.paragraphs) assert.equal(parsed.content.slice(p.start, p.end), p.text)
  assert.ok(progress.some(p => p.stage === 'pdf' && p.done === 5)); assert.equal(parserActivity(), 0)
  assert.equal(globalThis.QCU_PDF_EXECUTED, undefined); assert.equal(globalThis.DOMMatrix, undefined)
})
test('PDF refuses malformed, repaired/truncated, password, scan-only and excess physical pages', async () => {
  for (const [bytes, expected] of [[Buffer.from('not PDF'), 'invalid-pdf'], [pdfFixture().subarray(0, -12), 'invalid-pdf'], [pdfFixture({encrypted:true}), 'encrypted-pdf'], [pdfFixture({scanOnly:true}), 'ocr-needed'], [pdfFixture({pages:121}), 'parse-limit']]) await assert.rejects(parseBinary(bytes, 'pdf'), code(expected))
  const broken = Buffer.from(pdfFixture().toString('latin1').replace(/startxref\n\d+/, 'startxref\n1'), 'latin1')
  await assert.rejects(parseBinary(broken, 'pdf'), code('invalid-pdf'))
  await assert.rejects(parseBinary(pdfFixture({streamBomb:true}), 'pdf'), code('parse-limit'))
  assert.equal(parserActivity(), 0)
})
test('actual DOCX: Chinese section breadcrumb, paragraphs and table cells, link label, omission signals, no invented pages', async () => {
  const parsed = await parseBinary(await docxFixture(), 'docx'); validateExtraction({...parsed, format:'docx'})
  const cell = parsed.paragraphs.find(p => p.text === '表格反馈建议')
  assert.deepEqual(cell.location, {format:'docx', paragraph:4, section:['自编反馈章节'], table:{index:1, row:1, cell:2, paragraph:1}})
  assert.equal(cell.locator, 'docx-t1-r1-c2-p1'); assert.match(sourceLabel(cell), /第 1 行 · 第 2 格/)
  assert.match(parsed.content, /外部参考标签/); assert.match(parsed.content, /<script>ignored\(\)<\/script>/)
  assert.doesNotMatch(parsed.content, /x=2|未导入页眉|example.invalid/)
  for (const c of ['images-omitted', 'equations-omitted', 'headers-omitted', 'footnotes-omitted', 'comments-omitted', 'external-labels-only']) assert.ok(parsed.extraction.warnings.some(w => w.code === c), c)
  assert.ok(parsed.paragraphs.every(p => !Object.hasOwn(p.location, 'page')))
})
test('DOCX deterministic row evidence includes label/value before unrelated hits, deduplicates rows and preserves exact cell positions in prompt/export', async t => {
  const f = await setup(t), d = (await f.store.importDocument(file('自编会计.docx', await accountingFixture()))).document
  const p = await f.store.prepare({documentId:d.id, question:'盈亏平衡销量是多少？'})
  assert.deepEqual(p.sources.map(s => s.text), ['盈亏平衡销量', '250件', '目标利润销量', '400件'])
  assert.deepEqual(p.sources.map(s => [s.location.table.row, s.location.table.cell]), [[2, 1], [2, 2], [3, 1], [3, 2]])
  for (const source of p.sources) assert.equal(source.text, d.content.slice(source.start, source.end))
  const both = evidenceFor(d, '盈亏平衡销量 250件 目标利润销量')
  assert.ok(both.some(s => s.text === '250件')); assert.ok(both.some(s => s.text === '400件'))
  assert.equal(new Set(both.map(s => s.locator)).size, both.length); assert.ok(both.length <= LIMITS.sources)
  const run = await f.store.start({intentId:p.id, requestId:'table-row', consent:true, documentId:d.id, question:p.question, digest:p.digest})
  await f.store.jobs.get(run.id)?.promise
  assert.deepEqual(f.calls[0].sources, p.sources); assert.match(f.store.export(run.id), /第 2 行 · 第 2 格/); assert.match(f.store.export(run.id), /250件/)
})
test('DOCX moved-from/deleted text is omitted, moved-to/inserted current text is retained with a revision warning', async () => {
  const body = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:moveFrom><w:r><w:t>过时移出文本</w:t></w:r></w:moveFrom><w:moveTo><w:r><w:t>当前移入文本</w:t></w:r></w:moveTo><w:del><w:r><w:t>删除文本</w:t></w:r></w:del><w:ins><w:r><w:t>当前插入文本</w:t></w:r></w:ins></w:p></w:body></w:document>'
  const d = await parseBinary(await docxFixture({replace:{'word/document.xml':body}}), 'docx')
  assert.doesNotMatch(d.content, /过时|删除/); assert.match(d.content, /当前移入文本当前插入文本/)
  assert.ok(d.extraction.warnings.some(w => w.code === 'revisions-review'))
})
test('untrusted DOCX section breadcrumbs stay literal in exported location text, including HTML and embedded Markdown fences', async t => {
  const f = await setup(t), body = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="QCUHeading"/></w:pPr><w:r><w:t>反馈 &lt;img src="https://example.invalid/never"&gt;\n```\n# 原文标题</w:t></w:r></w:p></w:body></w:document>'
  const d = (await f.store.importDocument(file('literal.docx', await docxFixture({replace:{'word/document.xml':body}})))).document
  const p = await f.store.prepare({documentId:d.id, question:'反馈'})
  const run = await f.store.start({intentId:p.id, requestId:'literal-heading', consent:true, documentId:d.id, question:p.question, digest:p.digest}); await f.store.jobs.get(run.id)?.promise
  const markdown = f.store.export(run.id)
  assert.ok(markdown.includes('位置：\n````text\n' + sourceLabel(p.sources[0]) + '\n````'))
  assert.doesNotMatch(markdown, /^### .*<img/m)
})
test('DOCX refuses corrupt/encrypted ZIP, traversal, duplicates, unsupported macro package, count/size/ratio bombs before extraction', async () => {
  const normal = await docxFixture({compression:'STORE'})
  const mutate = edit => { const b = Buffer.from(normal); edit(b); return b }
  const central = normal.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  for (const [bytes, expected] of [
    [Buffer.from('not ZIP'), 'invalid-docx'], [normal.subarray(0, -1), 'invalid-docx'],
    [mutate(b => b[b.indexOf(Buffer.from('<Types'))] ^= 1), 'invalid-docx'],
    [mutate(b => b.writeUInt16LE(b.readUInt16LE(central + 8) | 1, central + 8)), 'unsafe-docx'],
    [mutate(b => b.writeUInt32LE(LIMITS.zipEntryBytes + 1, central + 24)), 'parse-limit'],
    [await docxFixture({extra:{'../escape.xml':'<x/>'}}), 'invalid-docx'],
    [await docxFixture({extra:{'word/vbaProject.bin':'macro bytes'}}), 'unsafe-docx'],
    [await docxFixture({extra:{'word/bomb.xml':'<x>' + 'a'.repeat(300000) + '</x>'}}), 'parse-limit'],
    [await docxFixture({extra:Object.fromEntries(Array.from({length:260}, (_, i) => ['x' + i, 'x']))}), 'parse-limit'],
    [await docxFixture({extra:{'word/DOCUMENT.xml':'<x/>'}}), 'invalid-docx']
  ]) await assert.rejects(parseBinary(bytes, 'docx'), code(expected))
  // Forge small declared size over a real deflate bomb; maxOutputLength still stops actual expansion.
  const bomb = await docxFixture({extra:{'word/z.xml':'x'.repeat(20000)}})
  const forged = Buffer.from(bomb), entry = zipEntries(await docxFixture()).length
  let pos = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  while (pos >= 0) {
    const name = forged.subarray(pos + 46, pos + 46 + forged.readUInt16LE(pos + 28)).toString()
    if (name === 'word/z.xml') { const local = forged.readUInt32LE(pos + 42); forged.writeUInt32LE(10, pos + 24); forged.writeUInt32LE(10, local + 22); break }
    pos = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), pos + 4)
  }
  assert.ok(entry); await assert.rejects(parseBinary(forged, 'docx'), code('parse-limit'))
})
test('DOCX proper XML parser refuses DTD/entities, malformed XML, excessive nesting, text, unsafe content types and missing body', async () => {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  for (const [xml, expected] of [
    ['<!DOCTYPE w:document [<!ENTITY x SYSTEM "file:///never-read">]><w:document xmlns:w="' + W + '"><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>', 'invalid-docx'],
    ['<w:document xmlns:w="' + W + '"><w:body><w:p></w:body></w:document>', 'invalid-docx'],
    ['<x>'.repeat(70) + '</x>'.repeat(70), 'parse-limit'],
    ['<w:document xmlns:w="' + W + '"/>', 'invalid-docx']
  ]) await assert.rejects(parseBinary(await docxFixture({replace:{'word/document.xml':xml}}), 'docx'), code(expected))
  const macro = '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>'
  await assert.rejects(parseBinary(await docxFixture({replace:{'[Content_Types].xml':macro}}), 'docx'), code('unsafe-docx'))
  for (const body of ['<w:p><w:r><w:t>' + '文本'.repeat(100000) + '</w:t></w:r></w:p>', '<w:p><w:r><w:t>x</w:t></w:r></w:p>'.repeat(2001), '<w:tbl>' + '<w:tr/>'.repeat(2001) + '</w:tbl>']) {
    const document = '<w:document xmlns:w="' + W + '"><w:body>' + body + '</w:body></w:document>'
    await assert.rejects(parseBinary(await docxFixture({replace:{'word/document.xml':document}, compression:'STORE'}), 'docx'), code('parse-limit'))
  }
})
test('binary import computes original hash, canonical base64, deduplicates original bytes and preserves changed names/versions, immutable source snapshots', async t => {
  const f = await setup(t), bytes = pdfFixture(), result = await f.store.importDocument(file('自编.pdf', bytes)), d = result.document
  assert.equal(d.id, hash(bytes)); assert.equal(d.contentHash, hash(d.content)); assert.equal(d.identity, 'original-bytes-sha256')
  assert.equal(Object.hasOwn(d, 'base64'), false); assert.equal(JSON.stringify(f.store.snapshot()).includes(bytes.toString('base64')), false)
  assert.equal((await f.store.importDocument(file('改名.pdf', bytes))).duplicate, true)
  assert.equal(f.store.state.documents[0].base64, bytes.toString('base64'))
  const changed = await f.store.importDocument(file('自编.pdf', pdfFixture({pages:4})))
  assert.notEqual(changed.document.id, d.id); assert.equal(f.store.snapshot().documents.length, 2)
  const prepared = await f.store.prepare({documentId:d.id, question:'final feedback'})
  assert.equal(prepared.sources[0].location.page, 5)
  const r = await f.store.start({intentId:prepared.id, requestId:'binary-run', consent:true, documentId:d.id, question:prepared.question, digest:prepared.digest})
  await f.store.jobs.get(r.id)?.promise
  assert.deepEqual(f.calls[0].sources, prepared.sources)
  assert.equal(Object.hasOwn(f.calls[0], 'base64'), false)
  assert.equal(Object.hasOwn(f.calls[0], 'document'), false)
  const markdown = f.store.export(r.id)
  assert.match(markdown, /PDF 第 5 页/); assert.match(markdown, /原始文件字节/); assert.match(markdown, /第 3、4 页/); assert.match(markdown, /来源待核对/)
  await assert.rejects(f.store.importDocument({...file('a.pdf', bytes), paragraphs:[]}), code('invalid-fields'))
  for (const base64 of ['A===', 'AB==', 'abcd\n', bytes.toString('base64') + ' ']) await assert.rejects(f.store.importDocument({name:'a.pdf', base64}))
  await assert.rejects(f.store.importDocument({name:'a.docm', base64:'YWJj'}), code('unsupported-format'))
  await f.store.dispose()
  const reopen = await new ReadingStore(f.directory, {}).init(); t.after(() => reopen.dispose())
  assert.deepEqual(reopen.document(d.id), d); assert.equal(reopen.export(r.id), markdown)
  assert.equal(reopen.state.documents[0].base64, bytes.toString('base64'))
  const stateFile = join(f.directory, '.qcu-reading/state.json'), state = JSON.parse(await readFile(stateFile))
  state.documents[0].base64 = Buffer.from('forged original').toString('base64'); await writeFile(stateFile, JSON.stringify(state))
  await assert.rejects(new ReadingStore(f.directory, {}).init(), code('invalid-store'))
})
test('schema1 byte-exact safe backup before first write; notes/runs/IDs remain intact, reopen idempotent, invalid states never reset', async t => {
  const f = await setup(t), d = (await f.store.importDocument({name:'首版.md', content:'反馈保留首版证据。'})).document
  await f.store.saveNote({documentId:d.id, locator:'p0001', text:'首版证据', comment:'保留'})
  const p = await f.store.prepare({documentId:d.id, question:'反馈'})
  const run = await f.store.start({intentId:p.id, requestId:'v1-run', consent:true, documentId:d.id, question:p.question, digest:p.digest}); await f.store.jobs.get(run.id)?.promise
  const old = {...f.store.state, schemaVersion:1}, bytes = Buffer.from(JSON.stringify(old, null, 2) + '\n'), state = join(f.directory, '.qcu-reading/state.json')
  await f.store.dispose(); await writeFile(state, bytes)
  const reopen = await new ReadingStore(f.directory, {}).init(); t.after(() => reopen.dispose())
  assert.deepEqual(reopen.state.notes, old.notes); assert.deepEqual(reopen.state.runs, old.runs); assert.deepEqual(reopen.document(d.id), d)
  assert.deepEqual(await readFile(state), bytes, 'no write during idle reopen')
  await reopen.importDocument(file('结构.docx', await docxFixture()))
  const backup = join(f.directory, '.qcu-reading/state.schema1.' + hash(bytes) + '.json')
  assert.deepEqual(await readFile(backup), bytes); assert.equal(JSON.parse(await readFile(state)).schemaVersion, 2)
  await reopen.saveNote({documentId:d.id, locator:'p0001', text:'首版证据', comment:'再写'})
  const again = await new ReadingStore(f.directory, {}).init(); t.after(() => again.dispose())
  assert.deepEqual(again.state.runs, old.runs); assert.equal((await readdir(join(f.directory, '.qcu-reading'))).filter(f => f.startsWith('state.schema1.')).length, 1)
  const bad = JSON.parse(await readFile(state)); bad.documents.find(d => d.format).paragraphs[0].location.paragraph = 99
  const invalid = JSON.stringify(bad); await writeFile(state, invalid)
  await assert.rejects(new ReadingStore(f.directory, {}).init(), code('invalid-store')); assert.equal(await readFile(state, 'utf8'), invalid)
})
test('migration refuses unsafe or mismatched preexisting backup without modifying the schema1 state or target', async t => {
  for (const mode of ['mismatch', 'symlink']) await t.test(mode, async t => {
    const f = await setup(t), v1 = Buffer.from(JSON.stringify({schemaVersion:1, documents:[], notes:[], runs:[]})), state = join(f.directory, '.qcu-reading/state.json')
    await f.store.dispose(); await writeFile(state, v1)
    const backup = join(f.directory, '.qcu-reading/state.schema1.' + hash(v1) + '.json')
    if (mode === 'mismatch') await writeFile(backup, 'DO NOT TOUCH')
    else { const target = join(f.directory, 'marker'); await writeFile(target, 'DO NOT TOUCH'); await symlink(target, backup) }
    const s = await new ReadingStore(f.directory, {}).init(); t.after(() => s.dispose())
    await assert.rejects(s.importDocument({name:'a.txt', content:'新材料'}))
    assert.deepEqual(await readFile(state), v1); assert.equal(await readFile(backup, 'utf8'), 'DO NOT TOUCH')
  })
})
test('worker cancellation, timeout, crash, dispose, bounded concurrency release every slot and leave no imported record', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'qcu-reading-worker-')); t.after(() => rm(dir, {recursive:true, force:true}))
  const path = join(dir, 'wait.mjs'); await writeFile(path, 'while (true) {}\n')
  const workerURL = pathToFileURL(path), signal = new AbortController()
  const a = parseBinary(pdfFixture(), 'pdf', {workerURL, signal:signal.signal}), b = parseBinary(pdfFixture(), 'pdf', {workerURL, milliseconds:100})
  assert.equal(parserActivity(), 2); await assert.rejects(parseBinary(pdfFixture(), 'pdf', {workerURL}), code('parse-busy'))
  signal.abort(); await assert.rejects(a, code('parse-cancelled')); await assert.rejects(b, code('parse-timeout')); assert.equal(parserActivity(), 0)
  const f = await setup(t, {parseOptions:{workerURL}}), pending = f.store.importDocument(file('等待.pdf', pdfFixture()), undefined, 'waiting')
  assert.equal(f.store.importStatus('waiting').stage, 'opening')
  await f.store.cancelImport('waiting'); await assert.rejects(pending, code('parse-cancelled')); assert.equal(f.store.snapshot().documents.length, 0)
  const another = f.store.importDocument(file('等待.pdf', pdfFixture()))
  await f.store.dispose(); await assert.rejects(another, code('parse-cancelled')); assert.equal(parserActivity(), 0)
  const crash = join(dir, 'crash.mjs'); await writeFile(crash, 'throw Error("synthetic crash")')
  await assert.rejects(parseBinary(pdfFixture(), 'pdf', {workerURL:pathToFileURL(crash)}), code('parse-worker-failed')); assert.equal(parserActivity(), 0)
})
test('cancellation arriving before upload or before atomic replace never commits a late document', async t => {
  const f = await setup(t)
  await f.store.cancelImport('late')
  await assert.rejects(f.store.importDocument(file('late.pdf', pdfFixture()), undefined, 'late'), code('parse-cancelled'))
  await assert.rejects(f.store.importDocument({name:'late.txt', content:'迟到'}, undefined, 'late'), code('parse-cancelled'))
  let enter, release
  const entered = new Promise(r => enter = r), held = new Promise(r => release = r), persist = f.store.persist.bind(f.store)
  f.store.persist = async (state, signal) => { enter(); await held; return persist(state, signal) }
  const pending = f.store.importDocument(file('slow.pdf', pdfFixture()), undefined, 'slow')
  await entered
  const cancelled = f.store.cancelImport('slow'); release()
  await assert.rejects(pending, code('parse-cancelled')); await cancelled
  assert.equal(f.store.state.documents.length, 0); assert.equal(parserActivity(), 0)
  assert.equal((await readdir(join(f.directory, '.qcu-reading'))).filter(n => n === 'state.json' || n.endsWith('.tmp')).length, 0)
})
test('controller sends bounded bytes only, cancels decoding/import and invalidates confirmation; DOCX sources survive citation and export', async t => {
  const f = await setup(t), c = new ReadingController({dispatch:async payload => {
    const r = JSON.parse(payload)
    try { return {ok:true, version:VERSION, protocol:PROTOCOL, value:r.action === 'workspaces' ? [{id:'w', title:'合成'}] : await dispatchStore(f.store, r, new AbortController().signal)} }
    catch (e) { return {ok:false, error:e.code} }
  }}, {storage:null}); t.after(() => c.dispose())
  await c.boot(); const bytes = await docxFixture()
  await c.importFile({name:'表格.docx', size:bytes.length, arrayBuffer:async () => bytes})
  assert.match(c.state.document.content, /表格反馈建议/); assert.equal(f.calls.length, 0)
  c.input('question', '表格反馈建议'); await c.prepare(); assert.ok(c.state.prepared.sources.some(s => s.location.table))
  const p = c.state.prepared; await c.cite({document:p.document}, p.sources[0]); assert.ok(c.state.selected)
  c.input('question', '下一步练习'); assert.equal(c.state.prepared, null)
  const d = c.state.document, sources = evidenceFor(d, '下一步练习'); assert.match(sourceLabel(sources[0]), /第 2 行 · 第 2 格/)
  let release; const wait = new Promise(r => release = r)
  const pending = c.importFile({name:'cancel.pdf', size:100, arrayBuffer:async () => { await wait; return pdfFixture() }})
  c.cancelImport(); release(); await pending
  assert.equal(f.store.snapshot().documents.length, 1); assert.equal(parserActivity(), 0)
})
