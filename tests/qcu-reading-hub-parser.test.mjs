// Static font-table factoring must preserve Unicode and physical locations.
import test from 'node:test'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises'
import {resolve, join} from 'node:path'
import {pdfFixture} from './fixtures/qcu-reading-binary.mjs'
const root = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(process.env.QCU_READING_PACKAGE_ROOT + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {parseBinary, parserActivity} = await import(new URL('src/parser.mjs', root))
const {validateExtraction} = await import(new URL('src/source.mjs', root))

test('compressed content and CID ToUnicode streams preserve Chinese, accents, Greek and supplementary Unicode with physical page locators', async () => {
  const unicodeText = '第二页形成性评价反馈 é Ω 😀'
  const plain = await parseBinary(pdfFixture({unicodeText}), 'pdf')
  const compressed = await parseBinary(pdfFixture({unicodeText, compressed:true}), 'pdf')
  validateExtraction({...compressed, format:'pdf'})
  assert.deepEqual(compressed, plain)
  assert.ok(compressed.content.includes(unicodeText))
  assert.equal(compressed.paragraphs.find(p => p.text.includes('😀')).location.page, 2)
  assert.equal(compressed.paragraphs.at(-1).location.page, 5)
  assert.ok(compressed.paragraphs.every(p => compressed.content.slice(p.start, p.end) === p.text))
  assert.equal(parserActivity(), 0)
})

test('compressed incomplete form preserves recoverable text and visibly marks the affected physical page', async () => {
  const parsed = await parseBinary(pdfFixture({compressed:true, incompleteForm:true}), 'pdf')
  assert.match(parsed.content, /Local feedback page one/)
  assert.ok(parsed.extraction.warnings.some(w => w.code === 'page-incomplete' && w.page === 5))
  assert.deepEqual(parsed.extraction.pages.map(p => p.number), [1, 2, 3, 4, 5])
  assert.equal(parserActivity(), 0)
})

test('real PDF workers enforce synchronous and streaming per-buffer and cumulative decoder limits, then release slots on cancellation/timeout', async () => {
  const out = resolve('.work/qcu-reading-hub-package/parser')
  await mkdir(out, {recursive:true})
  const run = await mkdtemp(join(out, 'run-')), sync = join(run, 'sync-worker.mjs')
  await writeFile(sync, 'globalThis.DecompressionStream = undefined; await import(' + JSON.stringify(new URL('src/parser-worker.mjs', root).href) + ');\n')
  for (const workerURL of [undefined, pathToFileURL(sync)]) {
    await assert.rejects(parseBinary(pdfFixture({streamBomb:true}), 'pdf', {workerURL}), {code:'parse-limit'})
    // Each stream is below 8 MiB, but allocations across 40 streams exceed 64 MiB.
    await assert.rejects(parseBinary(pdfFixture({decodedBytes:1048576, pages:40}), 'pdf', {workerURL}), {code:'parse-limit'})
    assert.equal(parserActivity(), 0)
  }
  const cancel = new AbortController()
  await assert.rejects(parseBinary(pdfFixture({pages:120}), 'pdf', {signal:cancel.signal, progress:p => { if (p.stage === 'pdf') cancel.abort() }}), {code:'parse-cancelled'})
  await assert.rejects(parseBinary(pdfFixture(), 'pdf', {milliseconds:1}), {code:'parse-timeout'})
  assert.equal(parserActivity(), 0)
})
