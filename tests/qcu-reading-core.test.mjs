import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, writeFile, mkdir, symlink, link, rm, lstat, rename} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const packageRoot = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(process.env.QCU_READING_PACKAGE_ROOT + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', packageRoot))
const {parseImport, paragraphsFor, searchDocument, evidenceFor, LIMITS, OUTPUT_BUDGET, VERSION, PROTOCOL} = await import(new URL('src/protocol.mjs', packageRoot))
const {citationParts, sourceReview} = await import(new URL('src/reports.mjs', packageRoot))
const {ReadingController} = await import(new URL('src/controller.mjs', packageRoot))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', packageRoot))

const material = await readFile(new URL('./fixtures/qcu-reading-material.md', import.meta.url), 'utf8')
const signal = () => new AbortController().signal
const route = () => ({provider:'synthetic', model:'no-network', policy:{effort:'low', supportedEfforts:['high', 'low'], defaultEffort:'high', outputBudget:OUTPUT_BUDGET}})
const code = expected => e => e.code === expected
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'qcu-reading-core-')), calls = [], selection = route()
  t.after(() => rm(root, {recursive:true, force:true}))
  const store = await new ReadingStore(root, {...options, model:options.model ?? (async () => structuredClone(selection)), generate:async (input, abort) => {
    calls.push(input)
    const disk = JSON.parse(await readFile(join(root, '.qcu-reading/state.json'), 'utf8'))
    assert.equal(disk.runs[0].status, 'running', 'paid call must start after durable pending record')
    return options.generate ? options.generate(input, abort) : '形成性评价需要及时反馈 [S1]。'
  }}).init()
  t.after(() => store.dispose())
  const d = (await store.importDocument({name:'自编课堂.md', content:material})).document
  return {root, store, calls, selection, d}
}
const prepare = f => f.store.prepare({documentId:f.d.id, question:'形成性评价如何提供反馈'}, signal())
const request = p => ({intentId:p.id, requestId:crypto.randomUUID(), consent:true, documentId:p.document.id, question:p.question, digest:p.digest})
async function finish(f, p) {
  const r = await f.store.start(request(p), signal())
  await f.store.jobs.get(r.id)?.promise
  return f.store.run(r.id)
}

test('real IO: content identity, same-name versions, stable paragraph offsets, exact Chinese snippets and notes survive reopen', async t => {
  const f = await fixture(t)
  assert.equal(f.d.id, createHash('sha256').update(material).digest('hex'))
  for (const p of f.d.paragraphs) assert.equal(f.d.content.slice(p.start, p.end), p.text)
  assert.deepEqual(f.d.paragraphs.map(p => p.locator), ['p0001', 'p0002', 'p0003', 'p0004', 'p0005'])
  assert.equal((await f.store.importDocument({name:'改名.txt', content:material})).duplicate, true)
  const version = await f.store.importDocument({name:f.d.name, content:material + '\n\n不同的版本。'})
  assert.notEqual(version.document.id, f.d.id); assert.equal(f.store.snapshot().documents.length, 2)
  const hits = f.store.search(f.d.id, '形成性评价'); assert.deepEqual(hits.map(h => h.locator), ['p0001', 'p0002', 'p0004'])
  const sources = evidenceFor(f.d, '反馈')
  for (const source of sources) assert.equal(f.d.content.slice(source.start, source.end), source.text)
  const p = f.d.paragraphs[1]
  await f.store.saveNote({documentId:f.d.id, locator:p.locator, text:'及时提供反馈', comment:'自编笔记'})
  await f.store.dispose()
  const reopened = await new ReadingStore(f.root, {model:async () => route(), generate:async () => assert.fail('no auto call')}).init()
  t.after(() => reopened.dispose())
  assert.equal(reopened.snapshot().notes[0].text, '及时提供反馈'); assert.deepEqual(reopened.document(f.d.id), f.d)
  assert.ok((await lstat(join(f.root, '.qcu-reading/state.json'))).isFile())
  assert.equal(f.calls.length, 0)
})

test('input boundary rejects unsupported paths, formats, control bytes, invalid UTF-8 and oversized data; HTML stays literal', async t => {
  for (const name of ['a.pdf', 'b.docx', '../a.txt', '/tmp/a.txt', 'C:\\a.md', '.hidden.md', ' a.txt', 'x\u202etxt.md', 'x\ny.md']) {
    assert.throws(() => parseImport({name, content:'自编材料'}))
  }
  for (const content of ['', '\0bad', '\u0001', '\ud800']) assert.throws(() => parseImport({name:'x.txt', content}))
  assert.throws(() => parseImport({name:'x.txt', content:'中'.repeat(LIMITS.fileBytes / 3 + 1)}), code('file-too-large'))
  assert.throws(() => paragraphsFor('段落\n\n'.repeat(LIMITS.paragraphs + 1)), code('paragraph-limit'))
  const f = await fixture(t)
  await assert.rejects(f.store.importDocument({name:'x.md', content:'x', path:'/etc/passwd'}), code('invalid-fields'))
  await assert.rejects(f.store.saveNote({documentId:f.d.id, locator:'p0002', text:'不存在的引文', comment:''}), code('note-invalid'))
  assert.match(f.d.paragraphs.at(-1).text, /<script>/)
  const c = new ReadingController({dispatch:async () => assert.fail('invalid UTF-8 must not reach host')}, {storage:null})
  c.set({workspaceId:'fake'})
  await c.importFile({name:'bad.txt', size:2, arrayBuffer:async () => Uint8Array.from([0xc3, 0x28]).buffer})
  assert.match(c.state.error, /UTF-8/)
  c.dispose()
})

test('workspace and symlink IO boundaries: reject store/root/file links, hard links, oversized and corrupt stores without touching targets', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'qcu-reading-links-')); t.after(() => rm(parent, {recursive:true, force:true}))
  const target = join(parent, 'outside'); await mkdir(target)
  const marker = join(target, 'state.json'); await writeFile(marker, 'DO NOT TOUCH')
  for (const mode of ['directory', 'file', 'hardlink', 'root']) await t.test(mode, async () => {
    const root = join(parent, mode); await mkdir(root)
    if (mode === 'root') { await symlink(target, root + '-link'); await assert.rejects(new ReadingStore(root + '-link', {}).init(), code('unsafe-store')); return }
    if (mode === 'directory') await symlink(target, join(root, '.qcu-reading'))
    else { await mkdir(join(root, '.qcu-reading')); if (mode === 'file') await symlink(marker, join(root, '.qcu-reading/state.json')); else await link(marker, join(root, '.qcu-reading/state.json')) }
    await assert.rejects(new ReadingStore(root, {}).init(), code('unsafe-store'))
    assert.equal(await readFile(marker, 'utf8'), 'DO NOT TOUCH')
  })
  for (const [name, content] of [['oversize', 'x'.repeat(LIMITS.storeBytes + 1)], ['corrupt', '{bad'], ['schema', JSON.stringify({schemaVersion:1, documents:[], notes:[], runs:[{}]})]]) {
    const root = join(parent, name); await mkdir(join(root, '.qcu-reading'), {recursive:true}); await writeFile(join(root, '.qcu-reading/state.json'), content)
    await assert.rejects(new ReadingStore(root, {}).init())
  }
  const f = await fixture(t), other = await fixture(t)
  await assert.rejects(other.store.prepare({documentId:'f'.repeat(64), question:'反馈'}, signal()), code('document-not-found'))
  await f.store.saveNote({documentId:f.d.id, locator:'p0002', text:'及时提供反馈', comment:''})
  assert.equal(other.store.snapshot().notes.length, 0)
  await rename(join(f.root, '.qcu-reading'), join(f.root, 'saved'))
  await symlink(target, join(f.root, '.qcu-reading'))
  await assert.rejects(f.store.importDocument({name:'new.md', content:'new'}), code('unsafe-store'))
  assert.equal(await readFile(marker, 'utf8'), 'DO NOT TOUCH')
})

test('no-hit retrieval does not resolve model or generate; source retrieval is bounded with accurate long-paragraph offsets', async t => {
  const f = await fixture(t, {model:async () => assert.fail('no-hit must not resolve model')})
  assert.equal((await f.store.prepare({documentId:f.d.id, question:'量子纠缠'}, signal())).status, 'no-evidence')
  assert.equal(f.calls.length, 0); assert.equal(f.store.snapshot().runs.length, 0)
  const d = {content:'甲'.repeat(4000) + '反馈' + '乙'.repeat(4000)}; d.paragraphs = paragraphsFor(d.content)
  const source = evidenceFor(d, '反馈')[0]
  assert.ok(source.clipped); assert.ok(source.text.length <= LIMITS.snippetChars)
  assert.equal(source.text, d.content.slice(source.start, source.end)); assert.match(source.text, /反馈/)
  assert.equal(searchDocument(f.d, 'NONEXISTENT').length, 0)
})

test('confirmation binds immutable document/evidence/question/model, expires, rejects stale route, replays exactly once and never sends full text', async t => {
  const f = await fixture(t), p = await prepare(f), initial = structuredClone(p)
  p.sources[0].text = 'client tamper'
  for (const change of [{question:'changed'}, {documentId:'a'.repeat(64)}, {digest:'b'.repeat(64)}, {consent:false}]) {
    await assert.rejects(f.store.start({...request(p), ...change}, signal()))
  }
  f.selection.model = 'changed'
  await assert.rejects(f.store.start(request(p), signal()), code('model-policy-changed')); assert.equal(f.calls.length, 0)
  f.selection.model = 'no-network'
  f.selection.policy.defaultEffort = 'low'
  await assert.rejects(f.store.start(request(p), signal()), code('model-policy-changed')); assert.equal(f.calls.length, 0)
  f.selection.policy.defaultEffort = 'high'
  const req = request(p), results = await Promise.all([f.store.start(req, signal()), f.store.start(req, signal())])
  assert.equal(results[0].id, results[1].id)
  await f.store.jobs.get(results[0].id)?.promise
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.calls[0].sources, initial.sources); assert.equal(Object.hasOwn(f.calls[0], 'content'), false)
  assert.equal(f.store.run(results[0].id).status, 'completed')
  assert.equal((await f.store.start(req, signal())).id, results[0].id)
  assert.equal((await f.store.start(Object.fromEntries(Object.entries(req).reverse()), signal())).id, results[0].id)
  await assert.rejects(f.store.start({...req, question:'different'}, signal()), code('idempotency-conflict'))
  await assert.rejects(f.store.start({...req, requestId:'new-replay'}, signal()), code('prepare-expired'))
  const second = await prepare(f); f.store.now = () => second.createdAt + 600001
  await assert.rejects(f.store.start(request(second), signal()), code('prepare-expired')); assert.equal(f.calls.length, 1)
})

test('only one workspace call; cancellation and timeout abort signal and persist incomplete terminal states without retry', async t => {
  for (const mode of ['cancel', 'timeout', 'dispose']) await t.test(mode, async t => {
    let began, wasAborted = false
    const started = new Promise(resolve => began = resolve)
    const f = await fixture(t, {callTimeout:mode === 'timeout' ? 30 : 10000, generate:async (_, s) => { began(); return new Promise((_, reject) => { s.addEventListener('abort', () => { wasAborted = true; reject(s.reason) }, {once:true}) }) }})
    const first = await prepare(f), other = await prepare(f), r = await f.store.start(request(first), signal())
    await started
    await assert.rejects(f.store.start(request(other), signal()), code('run-busy'))
    const job = f.store.jobs.get(r.id)
    if (mode === 'cancel') await f.store.cancel(r.id)
    else if (mode === 'dispose') await f.store.dispose()
    await job.promise
    assert.ok(wasAborted)
    assert.equal(f.store.run(r.id).status, mode === 'cancel' ? 'cancelled' : mode === 'dispose' ? 'interrupted' : 'failed')
    if (mode === 'timeout') assert.equal(f.store.run(r.id).error, 'call-timeout')
    assert.equal(f.calls.length, 1); assert.match(f.store.export(r.id), /不完整/)
    assert.equal(JSON.parse(await readFile(join(f.root, '.qcu-reading/state.json'), 'utf8')).runs[0].status, f.store.run(r.id).status)
  })
})

test('pending records reopen as interrupted without retry; source validation catches tampering; capacity and failed writes prevent calls', async t => {
  const f = await fixture(t), run = await finish(f, await prepare(f))
  const file = join(f.root, '.qcu-reading/state.json'), persisted = JSON.parse(await readFile(file, 'utf8'))
  persisted.runs[0].status = 'running'; await writeFile(file, JSON.stringify(persisted))
  const reopened = await new ReadingStore(f.root, {generate:async () => assert.fail('never retry')}).init(); t.after(() => reopened.dispose())
  assert.equal(reopened.run(run.id).status, 'interrupted')
  persisted.runs[0].sources[0].text = 'forged'; await writeFile(file, JSON.stringify(persisted))
  await assert.rejects(new ReadingStore(f.root, {}).init(), code('invalid-store'))
  const fail = await fixture(t), p = await prepare(fail)
  fail.store.persist = async () => { throw Object.assign(Error('synthetic disk failure'), {code:'state-write-failed'}) }
  await assert.rejects(fail.store.start(request(p), signal()), code('state-write-failed')); assert.equal(fail.calls.length, 0); assert.equal(fail.store.snapshot().runs.length, 0)
  const cap = await fixture(t)
  for (let i = 1; i < LIMITS.documents; i++) await cap.store.importDocument({name:'x.txt', content:'自编 ' + i})
  await assert.rejects(cap.store.importDocument({name:'x.txt', content:'overflow'}), code('store-limit'))
  assert.equal((await cap.store.importDocument({name:'rename.md', content:material})).duplicate, true)
})

test('terminal write failure prevents further paid calls; saved pending record reopens interrupted; note and run limits fail without deletion', async t => {
  const f = await fixture(t), p = await prepare(f), persist = f.store.persist.bind(f.store)
  let writes = 0
  f.store.persist = async state => {
    if (++writes > 1) throw Object.assign(Error('synthetic terminal write failure'), {code:'state-write-failed'})
    return persist(state)
  }
  const run = await f.store.start(request(p), signal())
  await assert.rejects(f.store.jobs.get(run.id).promise, code('state-write-failed'))
  assert.equal(f.store.run(run.id).status, 'failed'); assert.equal(f.calls.length, 1)
  await assert.rejects(f.store.prepare({documentId:f.d.id, question:'反馈'}, signal()), code('state-write-failed'))
  const reopened = await new ReadingStore(f.root, {}).init(); t.after(() => reopened.dispose())
  assert.equal(reopened.run(run.id).status, 'interrupted')
  const cap = await fixture(t)
  for (let i = 0; i < LIMITS.notes; i++) await cap.store.saveNote({documentId:cap.d.id, locator:'p0002', text:'及时提供反馈', comment:String(i)})
  await assert.rejects(cap.store.saveNote({documentId:cap.d.id, locator:'p0002', text:'及时提供反馈', comment:'overflow'}), code('store-limit'))
  assert.equal(cap.store.snapshot().notes.length, LIMITS.notes)
  // Fill persisted history through normal starts, then verify the next call is rejected.
  for (let i = 0; i < LIMITS.runs; i++) await finish(cap, await prepare(cap))
  await assert.rejects(cap.store.start(request(await prepare(cap)), signal()), code('store-limit'))
  assert.equal(cap.calls.length, LIMITS.runs); assert.equal(cap.store.snapshot().runs.length, LIMITS.runs)
})

test('immutable history/export maps only confirmed source IDs and labels unknown, missing and failed answers for review', async t => {
  const f = await fixture(t), r = await finish(f, await prepare(f)), markdown = f.store.export(r.id)
  assert.match(markdown, /教师审阅草案/); assert.match(markdown, new RegExp(f.d.id)); assert.match(markdown, /推理策略：low/)
  for (const source of r.sources) assert.ok(markdown.includes(source.text))
  assert.ok(citationParts('实际 [S1]，未知 [S99]', r.sources).find(p => p.sourceId === 'S1'))
  assert.ok(citationParts('[S99]', r.sources)[0].unknown)
  assert.equal(sourceReview('无引用', r.sources).needsReview, true)
  assert.equal(sourceReview('[S1] [S99]', r.sources).needsReview, true)
  await f.store.importDocument({name:f.d.name, content:material + '\n\n新增内容'})
  assert.equal(f.store.export(r.id), markdown)
  const failed = await fixture(t, {generate:async () => { throw Object.assign(Error('max'), {code:'model-max-tokens', partial:'不完整 [S1]'}) }})
  const incomplete = await finish(failed, await prepare(failed))
  assert.equal(incomplete.status, 'failed'); assert.equal(incomplete.answer, '不完整 [S1]'); assert.match(failed.store.export(incomplete.id), /达到模型上限/)
  const tricky = (await f.store.importDocument({name:'特殊语法.md', content:'反馈 <script>ignored()</script> [链接](javascript:ignored)\n```\n# 不能变成导出标题\n```'})).document
  const trickyRun = await finish(f, await f.store.prepare({documentId:tricky.id, question:'反馈'}, signal()))
  const safeExport = f.store.export(trickyRun.id)
  assert.ok(safeExport.includes('````text\n' + tricky.content + '\n````'), 'exact source data must stay inside an unbreakable literal fence')
  assert.equal(f.calls.length, 2)
})

test('shared controller invalidates stale question/document/workspace confirmations and cancelled preparation never calls model', async t => {
  const f = await fixture(t)
  const remote = {dispatch:async payload => {
    const request = JSON.parse(payload)
    try {
      const value = request.action === 'workspaces' ? [{id:'w', title:'自编工作区'}] : await dispatchStore(f.store, request, signal())
      return JSON.stringify({ok:true, version:VERSION, protocol:PROTOCOL, value})
    } catch (e) { return JSON.stringify({ok:false, error:e.code}) }
  }}
  const c = new ReadingController(remote, {storage:null}); t.after(() => c.dispose())
  await c.boot(); c.input('question', '形成性评价反馈'); await c.prepare()
  assert.ok(c.state.prepared); c.set({consent:true}); c.input('question', '新的反馈问题')
  assert.equal(c.state.prepared, null); assert.equal(c.state.consent, false); await c.start(); assert.equal(f.calls.length, 0)
  await c.prepare(); await c.openDocument(f.d.id); assert.equal(c.state.prepared, null)
  c.input('question', '形成性评价'); await c.prepare(); c.forgetConfirmation(); assert.equal(f.store.prepared.size, 0)
  await c.prepare(); await c.selectWorkspace(''); assert.equal(c.state.prepared, null); assert.equal(c.state.document, null); assert.equal(f.calls.length, 0)
})
