import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, readFile, writeFile, readdir, symlink, link, rename, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {pdfFixture, docxFixture} from './fixtures/qcu-reading-binary.mjs'
const root = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(process.env.QCU_READING_PACKAGE_ROOT + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingStore} = await import(new URL('src/store.mjs', root))
const {ReadingController} = await import(new URL('src/controller.mjs', root))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', root))
const {VERSION, PROTOCOL, LIMITS, OUTPUT_BUDGET} = await import(new URL('src/protocol.mjs', root))
const {SHELF_LIMITS} = await import(new URL('src/shelf.mjs', root))
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), code = expected => e => e.code === expected
const metadata = patch => ({title:'', course:'', tags:[], favorite:false, ...patch})
const filters = patch => ({query:'', course:'', tag:'', favorites:false, ...patch})
const req = p => ({intentId:p.id, requestId:crypto.randomUUID(), consent:true, documentId:p.document.id, question:p.question, digest:p.digest})
const confirm = p => ({receiptId:p.id, digest:p.digest, documentId:p.document.id, consent:true})
async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'qcu-r2-')); t.after(() => rm(directory, {recursive:true, force:true}))
  let calls = 0, resolutions = 0
  const store = await new ReadingStore(directory, {model:async () => { resolutions++; return {provider:'synthetic', model:'fixture', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:OUTPUT_BUDGET}} }, generate:async (...args) => { calls++; return options.generate ? options.generate(...args) : '反馈草案 [S1]' }, ...options}).init()
  t.after(() => store.dispose())
  const d = (await store.importDocument({name:'自编.md', content:'课堂反馈帮助学生改进。\n\n及时反馈，核对来源。'})).document
  return {store, directory, d, file:join(directory, '.qcu-reading/state.json'), calls:() => calls, resolutions:() => resolutions}
}
async function run(f, d = f.d) {
  const p = await f.store.prepare({documentId:d.id, question:'反馈'}), r = await f.store.start(req(p))
  await f.store.jobs.get(r.id)?.promise; return f.store.run(r.id)
}
function remote(f, intercept = async () => {}) {
  return {dispatch:async payload => {
    const request = JSON.parse(payload); await intercept(request)
    try { return {ok:true, version:VERSION, protocol:PROTOCOL, value:request.action === 'workspaces' ? [{id:'w', title:'合成'}, {id:'other', title:'空工作区'}] : request.workspaceId === 'w' ? await dispatchStore(f.store, request) : {documents:[], notes:[], runs:[], library:{documents:{}, notes:{}}}} }
    catch (e) { return {ok:false, error:e.code} }
  }}
}

test('metadata and favorite excerpts remain separate; old evidence/version IDs survive aliasing, search, reopen and source moves', async t => {
  const f = await setup(t), oldRun = await run(f), before = structuredClone(f.store.state)
  const note = await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'保存原文'})
  const newer = (await f.store.importDocument({name:f.d.name, content:f.d.content + '\n\n新版本'})).document
  await f.store.updateMetadata(f.d.id, metadata({title:'旧版显示名', course:'会计', tags:['  反馈 ', '反馈', 'TAG', 'tag'], favorite:true}))
  await f.store.favoriteNote(note.id, true)
  assert.deepEqual(f.store.state.library.documents[f.d.id].tags, ['反馈', 'TAG'])
  assert.deepEqual(f.store.state.documents[0], before.documents[0]); assert.deepEqual(f.store.run(oldRun.id), oldRun)
  assert.deepEqual(f.store.state.notes[0], note)
  assert.deepEqual(f.store.shelf(filters({course:'会计', tag:'反馈', favorites:true})).documentIds, [f.d.id])
  for (const query of ['旧版显示名', 'TAG', '及时反馈', '自编']) assert.ok(f.store.shelf(filters({query})).documentIds.includes(f.d.id))
  const hit = f.store.shelf(filters({query:'及时反馈'})).hits.find(h => h.documentId === f.d.id)
  assert.equal(hit.locator, 'p0002'); assert.ok(f.store.document(hit.documentId).paragraphs.find(p => p.locator === hit.locator).text.includes(hit.text))
  assert.deepEqual(f.store.shelf(filters({course:'不存在'})), {documentIds:[], hits:[]})
  assert.equal(f.calls(), 1); assert.equal(f.resolutions(), 3)
  await f.store.dispose(); const s = await new ReadingStore(f.directory, {}).init(); t.after(() => s.dispose())
  assert.deepEqual(s.state, f.store.state); assert.deepEqual(s.run(oldRun.id).document, before.runs[0].document)
  assert.notEqual(newer.id, oldRun.document.id); assert.equal(s.document(oldRun.document.id).name, '自编.md')
})

test('strict metadata bounds, plain text, known IDs and schema library keys refuse malformed input without a write', async t => {
  const f = await setup(t), original = await readFile(f.file)
  for (const patch of [{title:'x'.repeat(181)}, {course:'x'.repeat(81)}, {tags:Array(9).fill('a')}, {tags:['a'.repeat(25)]}, {tags:['']}, {favorite:1}, {title:'\u202e注入'}, {title:'\u2066注入'}, {course:'a\nb'}, {title:'\u061c'}, {tags:['\u0085']}, {other:true}, {tags:JSON.parse('{"__proto__":[]}')}]) {
    await assert.rejects(f.store.updateMetadata(f.d.id, metadata(patch)))
    assert.deepEqual(await readFile(f.file), original)
  }
  await assert.rejects(f.store.updateMetadata('__proto__', metadata()), code('document-not-found'))
  await assert.rejects(f.store.favoriteNote('__proto__', true), code('note-not-found'))
  await assert.rejects(f.store.favoriteNote('missing', false), code('note-not-found'))
  const valid = structuredClone(f.store.state)
  for (const library of [JSON.parse('{"documents":{"__proto__":{}},"notes":{}}'), {documents:{}, notes:{dangling:true}}, {documents:{[f.d.id]:metadata({tags:['dup', 'dup']})}, notes:{}}, {documents:{}, notes:{}, extra:1}]) {
    assert.throws(() => f.store.validateState({...valid, library}))
  }
  assert.equal({}.favorite, undefined); assert.equal(f.calls(), 0); assert.equal(f.resolutions(), 0)
})

test('schema1 and schema2 idle reads preserve exact disk bytes; first write backs up bytes, docs/notes/runs, then reopens idempotently', async t => {
  for (const version of [1, 2]) await t.test('schema' + version, async t => {
    const f = await setup(t); await run(f)
    await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'原摘录'})
    if (version === 2) await f.store.importDocument({name:'自编.pdf', base64:pdfFixture().toString('base64')})
    const {library, ...records} = f.store.state, old = {...records, schemaVersion:version}, bytes = Buffer.from(JSON.stringify(old, null, 2) + '\n')
    await f.store.dispose(); await writeFile(f.file, bytes)
    const s = await new ReadingStore(f.directory, {}).init(); t.after(() => s.dispose())
    assert.deepEqual(await readFile(f.file), bytes); assert.equal(s.state.schemaVersion, 3)
    assert.deepEqual(s.state.documents, old.documents); assert.deepEqual(s.state.notes, old.notes); assert.deepEqual(s.state.runs, old.runs)
    assert.equal((await readdir(join(f.directory, '.qcu-reading'))).filter(n => n.startsWith('state.schema')).length, 0)
    // Export is idle and complete even before the first migration write.
    await s.backupPrepare(); assert.deepEqual(await readFile(f.file), bytes)
    await s.updateMetadata(f.d.id, metadata({title:'资料架'}))
    assert.deepEqual(await readFile(join(f.directory, '.qcu-reading', `state.schema${version}.${sha(bytes)}.json`)), bytes)
    assert.equal(JSON.parse(await readFile(f.file)).schemaVersion, 3)
    await s.dispose(); const again = await new ReadingStore(f.directory, {}).init(); t.after(() => again.dispose())
    assert.deepEqual(again.state.documents, old.documents); assert.deepEqual(again.state.runs, old.runs)
    assert.equal((await readdir(join(f.directory, '.qcu-reading'))).filter(n => n.startsWith('state.schema')).length, 1)
  })
})

test('schema2 migration fails closed on bad backup/symlink/hardlink/directory and retains original bytes', async t => {
  for (const mode of ['bad', 'symlink', 'hardlink', 'directory']) await t.test(mode, async t => {
    const f = await setup(t), {library, ...records} = f.store.state
    const bytes = Buffer.from(JSON.stringify({...records, schemaVersion:2}, null, 1)), backup = join(f.directory, '.qcu-reading', `state.schema2.${sha(bytes)}.json`), marker = join(f.directory, 'marker')
    await f.store.dispose(); await writeFile(f.file, bytes); await writeFile(marker, 'KEEP')
    if (mode === 'bad') await writeFile(backup, 'bad')
    if (mode === 'symlink') await symlink(marker, backup)
    if (mode === 'hardlink') await link(marker, backup)
    if (mode === 'directory') await mkdir(backup)
    const s = await new ReadingStore(f.directory, {}).init(); t.after(() => s.dispose())
    await assert.rejects(s.updateMetadata(f.d.id, metadata({title:'不能覆盖'})))
    assert.deepEqual(await readFile(f.file), bytes); assert.equal(await readFile(marker, 'utf8'), 'KEEP')
    await assert.rejects(s.updateMetadata(f.d.id, metadata()), code('state-write-failed'))
  })
})

test('delete previews identify exact version/counts, cancellation is byte-identical; confirmation cascades only target and replay fails', async t => {
  const f = await setup(t), first = await run(f), other = (await f.store.importDocument({name:f.d.name, content:'另一个反馈版本'})).document, second = await run(f, other)
  const notes = []
  for (const d of [f.d, other]) {
    notes.push(await f.store.saveNote({documentId:d.id, locator:d.paragraphs[0].locator, text:d.paragraphs[0].text, comment:'记录'}))
    await f.store.updateMetadata(d.id, metadata({title:'别名 ' + d.id.slice(0, 6)}))
    await f.store.favoriteNote(notes.at(-1).id, true)
  }
  const original = await readFile(f.file), unrelated = structuredClone({document:other, run:second, note:notes[1], meta:f.store.state.library.documents[other.id]})
  const cancelled = await f.store.deletePreview(f.d.id)
  assert.equal(cancelled.document.id, first.document.id); assert.equal(cancelled.document.name, '自编.md'); assert.equal(cancelled.notes, 1); assert.equal(cancelled.runs, 1)
  f.store.dismissDelete(cancelled.id); assert.deepEqual(await readFile(f.file), original)
  await assert.rejects(f.store.deleteConfirm(confirm(cancelled)), code('delete-expired'))
  const p = await f.store.deletePreview(f.d.id)
  await f.store.deleteConfirm(confirm(p)); await assert.rejects(f.store.deleteConfirm(confirm(p)), code('delete-expired'))
  assert.throws(() => f.store.document(f.d.id), code('document-not-found')); assert.throws(() => f.store.run(first.id), code('run-not-found'))
  assert.deepEqual(f.store.document(other.id), unrelated.document); assert.deepEqual(f.store.run(second.id), unrelated.run); assert.deepEqual(f.store.state.notes, [unrelated.note])
  assert.deepEqual(f.store.state.library, {documents:{[other.id]:unrelated.meta}, notes:{[notes[1].id]:true}})
  assert.equal(f.calls(), 2)
})

test('delete rejects expired, altered, cross-store, stale, active or disk-swapped confirmations; no overwritten unrelated bytes', async t => {
  for (const mode of ['expired', 'digest', 'id', 'stale', 'external', 'inode', 'symlink', 'directory', 'workspace', 'cross-store', 'import', 'generation', 'no-consent']) await t.test(mode, async t => {
    const f = await setup(t), p = await f.store.deletePreview(f.d.id), request = confirm(p), original = await readFile(f.file)
    if (mode === 'expired') f.store.now = () => p.expiresAt + 1
    if (mode === 'digest') request.digest = '0'.repeat(64)
    if (mode === 'id') request.documentId = '0'.repeat(64)
    if (mode === 'stale') await f.store.updateMetadata(f.d.id, metadata({title:'后来修改'}))
    if (mode === 'no-consent') request.consent = false
    if (mode === 'external') await writeFile(f.file, Buffer.concat([original, Buffer.from(' \n')]))
    if (mode === 'inode') { await rename(f.file, f.file + '.old'); await writeFile(f.file, original) }
    if (mode === 'symlink') { await rename(f.file, f.file + '.old'); await symlink(f.file + '.old', f.file) }
    if (mode === 'directory') { await rename(join(f.directory, '.qcu-reading'), join(f.directory, 'saved')); await mkdir(join(f.directory, '.qcu-reading')); await writeFile(f.file, original) }
    if (mode === 'workspace') { await rename(f.directory, f.directory + '-old'); await mkdir(f.directory); await mkdir(join(f.directory, '.qcu-reading')); await writeFile(f.file, original); t.after(() => rm(f.directory + '-old', {recursive:true, force:true})) }
    if (mode === 'import') f.store.imports.set('fixture', {controller:new AbortController(), promise:Promise.resolve()})
    if (mode === 'generation') f.store.jobs.set('fixture', {controller:new AbortController(), promise:Promise.resolve()})
    const current = await readFile(f.file)
    if (mode === 'cross-store') { const second = await setup(t), secondBefore = await readFile(second.file); await assert.rejects(second.store.deleteConfirm(request), code('delete-expired')); assert.deepEqual(await readFile(second.file), secondBefore) }
    else await assert.rejects(f.store.deleteConfirm(request))
    assert.deepEqual(await readFile(f.file), current)
    assert.equal(f.store.state.documents.length, 1); assert.equal(f.calls(), 0); assert.equal(f.resolutions(), 0)
    if (['import', 'generation'].includes(mode)) await assert.rejects(f.store.deletePreview(f.d.id), code('delete-busy'))
  })
})

test('bounded full backup is byte-accurate with binary originals, notes, runs, escaped and multibyte text; changed state rejects chunks', async t => {
  const f = await setup(t); await run(f)
  for (const [name, bytes] of [['fixture.pdf', pdfFixture()], ['fixture.docx', await docxFixture()]]) await f.store.importDocument({name, base64:bytes.toString('base64')})
  await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'汉字😀 "\\\t\n'.repeat(80)})
  await f.store.updateMetadata(f.d.id, metadata({tags:['多字节😀'], favorite:true}))
  const p = await f.store.backupPrepare(), parts = []
  for (let index = 0; index < p.chunks; index++) {
    const chunk = await f.store.backupChunk({digest:p.digest, index}); assert.ok(JSON.stringify(chunk).length < LIMITS.requestChars)
    const bytes = Buffer.from(chunk.base64, 'base64'); assert.ok(bytes.length <= SHELF_LIMITS.chunkBytes); parts.push(bytes)
  }
  const bytes = Buffer.concat(parts), backup = JSON.parse(bytes)
  assert.equal(bytes.length, p.bytes); assert.equal(sha(bytes), p.digest); assert.equal(backup.format, 'qcu-reading-backup'); assert.equal(backup.version, 1)
  assert.equal(sha(JSON.stringify(backup.state)), backup.checksum.state); assert.deepEqual(backup.state, f.store.state)
  assert.equal(JSON.stringify(backup).includes(f.directory), false); assert.equal(f.calls(), 1)
  await assert.rejects(f.store.backupChunk({digest:p.digest, index:p.chunks}), code('invalid-fields'))
  await assert.rejects(f.store.backupChunk({digest:p.digest, index:0.5}), code('invalid-fields'))
  await f.store.updateMetadata(f.d.id, metadata({title:'新的快照'}))
  await assert.rejects(f.store.backupChunk({digest:p.digest, index:0}), code('backup-changed'))
})

test('near 8MB state passes bounded RPC and verified controller export; metadata counts toward cap', async t => {
  const f = await setup(t), raw = '汉字😀"\\\t\n'.repeat(9000)
  // Normal imports build a large, valid state; source text and paragraph text are both saved.
  for (let i = 0; i < 23; i++) await f.store.importDocument({name:'大材料' + i + '.md', content:i + raw})
  let bytes = f.store.capacity().bytes
  assert.ok(bytes > 6000000, String(bytes))
  // Fill the remaining bounded capacity using legal notes rather than an invalid oversized fixture.
  while (f.store.state.notes.length < LIMITS.notes && f.store.capacity().bytes < 7980000) {
    await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'中'.repeat(1900)})
  }
  while (LIMITS.storeBytes - f.store.capacity().bytes > 5800) await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'中'.repeat(1700)})
  const shell = {id:'x'.repeat(36), documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'', createdAt:f.store.now()}
  const available = LIMITS.storeBytes - 100 - Buffer.byteLength(JSON.stringify({...f.store.state, notes:[shell, ...f.store.state.notes]}))
  assert.ok(available >= 0 && available <= 6000, String(available))
  await f.store.saveNote({documentId:f.d.id, locator:'p0001', text:'课堂反馈', comment:'中'.repeat(Math.floor(available / 3)) + 'a'.repeat(available % 3)})
  assert.equal(f.store.capacity().bytes, LIMITS.storeBytes - 100)
  const c = new ReadingController(remote(f), {storage:null}); t.after(() => c.dispose()); await c.selectWorkspace('')
  c.set({workspaces:[{id:'w'}]}); await c.selectWorkspace('w')
  let delivered
  await c.exportBackup(result => delivered = result)
  assert.ok(delivered, c.state.error); assert.ok(delivered.bytes.length > 7800000)
  assert.deepEqual(JSON.parse(new TextDecoder().decode(delivered.bytes)).state, f.store.state)
  assert.equal(f.calls(), 0); assert.equal(f.resolutions(), 0)
  const before = await readFile(f.file)
  // Adding only legal display metadata exceeds the remaining 100 bytes.
  await assert.rejects(f.store.updateMetadata(f.d.id, metadata({title:'中'.repeat(180)})), code('store-limit'))
  assert.deepEqual(await readFile(f.file), before)
})

test('controller preserves question/consent on metadata, filters, favorites and refresh; no model dispatch, dangling notes refuse', async t => {
  const f = await setup(t), actions = [], c = new ReadingController(remote(f, async r => actions.push(r.action)), {storage:null}); t.after(() => c.dispose())
  c.set({workspaces:[{id:'w'}]}); await c.selectWorkspace('w')
  const sentinel = {id:'not-a-model-intent'}; c.set({question:'尚未发送', excerpt:'未保存', comment:'草稿', prepared:sentinel, consent:true})
  await c.saveMetadata(metadata({title:'别名', course:'课程', tags:['tag'], favorite:true})); await c.filterShelf({favorites:true}); await c.refreshWorkspaces()
  assert.equal(c.state.question, '尚未发送'); assert.equal(c.state.excerpt, '未保存'); assert.equal(c.state.prepared, sentinel); assert.equal(c.state.consent, true)
  const note = await f.store.saveNote({documentId:f.d.id, locator:'p0002', text:'及时反馈', comment:'摘录'})
  await c.refresh(); await c.favoriteNote(note.id, true); assert.equal(c.state.library.notes[note.id], true)
  const selected = c.state.document; await c.openNote('dangling'); assert.equal(c.state.document, selected); assert.match(c.state.error, /不存在/)
  await c.openNote(note.id); assert.equal(c.state.selected, 'p0002')
  assert.ok(!actions.some(a => ['prepare', 'start'].includes(a))); assert.equal(f.calls(), 0); assert.equal(f.resolutions(), 0)
})

test('controller refuses corrupt chunks, mid-export mutation, cancel, dispose and workspace change without any partial download', async t => {
  for (const mode of ['corrupt', 'mutation', 'cancel', 'dispose', 'workspace']) await t.test(mode, async t => {
    const f = await setup(t); let c, intercepted = false, delivered = 0
    const base = remote(f), transport = {dispatch:async payload => {
      const r = JSON.parse(payload), response = await base.dispatch(payload)
      if (r.action === 'backupChunk' && !intercepted) {
        intercepted = true
        if (mode === 'corrupt') { const bytes = Buffer.from(response.value.base64, 'base64'); bytes[0] ^= 1; response.value.base64 = bytes.toString('base64') }
        if (mode === 'mutation') await f.store.updateMetadata(f.d.id, metadata({title:'changed'}))
        if (mode === 'cancel') c.cancelBackup()
        if (mode === 'dispose') c.dispose()
        if (mode === 'workspace') await c.selectWorkspace('other')
      }
      return response
    }}
    c = new ReadingController(transport, {storage:null}); t.after(() => c.dispose()); c.set({workspaces:[{id:'w'}, {id:'other'}]}); await c.selectWorkspace('w')
    await c.exportBackup(() => delivered++); assert.equal(delivered, 0); assert.equal(c.state.backing, null); assert.equal(f.calls(), 0)
    if (mode === 'corrupt') assert.match(c.state.error, /校验/)
    if (mode === 'mutation') assert.match(c.state.error, /变化/)
  })
})

test('backup delivery without an observed system save reports prepared and asks to confirm saving; failed delivery claims no success', async t => {
  const f = await setup(t), c = new ReadingController(remote(f), {storage:null}); t.after(() => c.dispose())
  c.set({workspaces:[{id:'w'}]}); await c.selectWorkspace('w')
  const before = await readFile(f.file); let callbacks = 0
  // A host Save dialog may be cancelled. The callback accepts valid bytes without
  // writing any file or returning an OS-save receipt; completion cannot be inferred.
  await c.exportBackup(({bytes}) => {
    callbacks++; assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)).state, f.store.state)
  })
  assert.equal(callbacks, 1); assert.match(c.state.notice, /备份已准备/)
  assert.match(c.state.notice, /系统保存窗口或下载列表中确认保存/)
  assert.match(c.state.notice, /尚无导入恢复界面/)
  assert.doesNotMatch(c.state.notice, /已下载|已保存|保存成功|下载完成/)
  assert.equal(c.state.backing, null); assert.deepEqual(await readFile(f.file), before)
  await c.exportBackup(() => { throw Error('synthetic delivery failure') })
  assert.equal(c.state.notice, ''); assert.match(c.state.error, /操作未完成/)
  assert.equal(f.calls(), 0); assert.equal(f.resolutions(), 0)
})

test('protocol2/version mismatch stays safe and never emits backup', async t => {
  const f = await setup(t), base = remote(f), c = new ReadingController({dispatch:async p => ({...await base.dispatch(p), protocol:2})}, {storage:null}); t.after(() => c.dispose())
  c.set({workspaceId:'w'}); let delivered = false; await c.exportBackup(() => delivered = true)
  assert.equal(delivered, false); assert.match(c.state.error, /操作未完成/)
})
