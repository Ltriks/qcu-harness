import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, mkdir, rm, access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'

const packageRoot = process.env.QCU_READING_PACKAGE_ROOT ? pathToFileURL(process.env.QCU_READING_PACKAGE_ROOT + '/') : new URL('../hub/plugins/qcu-reading/', import.meta.url)
const {ReadingController} = await import(new URL('src/controller.mjs', packageRoot))
const {ReadingStore} = await import(new URL('src/store.mjs', packageRoot))
const {dispatchStore} = await import(new URL('src/dispatch.mjs', packageRoot))
const {VERSION, PROTOCOL, OUTPUT_BUDGET} = await import(new URL('src/protocol.mjs', packageRoot))
const A = {id:'A', title:'自编工作区 A'}, B = {id:'B', title:'自编工作区 B'}
const wire = value => ({ok:true, version:VERSION, protocol:PROTOCOL, value})
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return {promise, resolve, reject} }
const retained = s => Object.fromEntries(['workspaceId', 'document', 'documents', 'notes', 'runs', 'selected', 'query', 'hits', 'searched', 'question', 'prepared', 'consent', 'run', 'excerpt', 'comment', 'busy', 'parsing', 'loading', 'error', 'notice', 'pane', 'showMaterials'].map(k => [k, s[k]]))

async function fixture(t, generate = async () => '合成反馈 [S1]') {
  const root = await mkdtemp(join(tmpdir(), 'qcu-reading-discovery-')), stores = new Map(), requests = [], calls = []
  const registry = [A]
  t.after(async () => { for (const s of stores.values()) await s.dispose(); await rm(root, {recursive:true, force:true}) })
  for (const w of [A, B]) await mkdir(join(root, w.id))
  const store = async id => {
    if (!stores.has(id)) stores.set(id, await new ReadingStore(join(root, id), {
      model:async () => ({provider:'synthetic', model:'no-network', policy:{effort:'off', supportedEfforts:['off'], defaultEffort:'off', outputBudget:OUTPUT_BUDGET}}),
      generate:async (...args) => { calls.push(args[0]); return generate(...args) }
    }).init())
    return stores.get(id)
  }
  const a = await store('A'), document = (await a.importDocument({name:'A.md', content:'反馈帮助学生调整学习方法。\n\n有效反馈要及时提供。'})).document
  const c = new ReadingController({dispatch:async payload => {
    const req = JSON.parse(payload); requests.push(req)
    if (req.action === 'workspaces') return wire(structuredClone(registry))
    assert.ok(registry.some(w => w.id === req.workspaceId), 'only registered workspaces can be read')
    return wire(await dispatchStore(await store(req.workspaceId), req, new AbortController().signal))
  }}, {storage:null})
  t.after(() => c.dispose())
  await c.boot()
  return {c, a, document, registry, requests, calls, root, stores}
}

test('mutable discovery A -> A+B preserves the whole reading draft and prepared consent; B is only opened by explicit selection', async t => {
  const f = await fixture(t), {c} = f
  c.selectParagraph('p0001'); c.input('comment', '已保存的 A 笔记'); await c.saveNote()
  c.input('comment', '尚未保存的笔记'); c.input('query', '反馈'); await c.search()
  c.input('question', '反馈如何帮助学生'); await c.prepare(); c.set({consent:true, showMaterials:true})
  const before = retained(c.state), disk = await readFile(join(f.root, 'A/.qcu-reading/state.json'))
  f.registry.push(B); const at = f.requests.length
  await c.refreshWorkspaces()
  assert.deepEqual(c.state.workspaces, [A, B]); assert.deepEqual(retained(c.state), before)
  assert.deepEqual(f.requests.slice(at), [{action:'workspaces'}]); assert.equal(f.calls.length, 0)
  assert.equal(f.stores.has('B'), false); await assert.rejects(access(join(f.root, 'B/.qcu-reading/state.json')))
  assert.deepEqual(await readFile(join(f.root, 'A/.qcu-reading/state.json')), disk)
  await c.selectWorkspace('B')
  assert.equal(c.state.workspaceId, 'B'); assert.equal(c.state.document, null); assert.deepEqual(c.state.notes, [])
  assert.equal(c.state.question, ''); assert.equal(c.state.prepared, null); assert.equal(c.state.consent, false)
  await c.selectWorkspace('A')
  assert.equal(c.state.document.id, f.document.id); assert.equal(c.state.notes[0].comment, '已保存的 A 笔记')
  assert.equal(f.calls.length, 0)
})

test('refresh preserves a running synthetic job and its observer without starting or cancelling any job', async t => {
  const answer = deferred(), f = await fixture(t, () => answer.promise), {c} = f
  t.after(() => answer.resolve('合成完成 [S1]'))
  c.input('question', '反馈帮助学生'); await c.prepare(); c.set({consent:true}); await c.start()
  const before = retained(c.state), at = f.requests.length
  f.registry.push(B); await c.refreshWorkspaces()
  assert.deepEqual(retained(c.state), before); assert.equal(c.state.run.status, 'running')
  assert.deepEqual(f.requests.slice(at), [{action:'workspaces'}]); assert.equal(f.calls.length, 1)
  answer.resolve('合成完成 [S1]'); await f.a.jobs.get(c.state.run.id).promise
  for (let n = 0; n < 30 && c.state.run.status === 'running'; n++) await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(c.state.run.status, 'completed'); assert.equal(f.calls.length, 1)
})

test('missing selection requires explicit reselection, invalidates consent and late prepare, and never deletes snapshots or history', async t => {
  const f = await fixture(t), {c} = f
  c.selectParagraph('p0001'); c.input('comment', '保留 A 笔记'); await c.saveNote()
  c.input('question', '反馈帮助学生'); await c.prepare(); c.set({consent:true})
  const before = c.state, disk = await readFile(join(f.root, 'A/.qcu-reading/state.json')), at = f.requests.length
  f.registry.splice(0, 1, B); await c.refreshWorkspaces()
  assert.equal(c.state.workspaceId, ''); assert.equal(c.state.workspaceMissing, true)
  assert.equal(c.state.prepared, null); assert.equal(c.state.consent, false)
  for (const k of ['document', 'notes', 'runs', 'question', 'excerpt', 'comment']) assert.equal(c.state[k], before[k])
  await c.start(); await c.prepare(); await c.openDocument(f.document.id)
  assert.deepEqual(f.requests.slice(at), [{action:'workspaces'}]); assert.equal(f.calls.length, 0)
  assert.deepEqual(await readFile(join(f.root, 'A/.qcu-reading/state.json')), disk)
  await c.refreshWorkspaces(); assert.equal(c.state.workspaceId, '', 'sole new B must not be auto-selected')
  f.registry.push(A); await c.refreshWorkspaces(); assert.equal(c.state.workspaceId, '')
  await c.selectWorkspace('A'); assert.equal(c.state.workspaceMissing, false); assert.equal(c.state.notes[0].comment, '保留 A 笔记')

  const pending = deferred(), remote = c.remote
  c.remote = {dispatch:payload => JSON.parse(payload).action === 'prepare' ? pending.promise : remote.dispatch(payload)}
  c.input('question', '反馈'); const preparing = c.prepare()
  f.registry.splice(0, 2, B); await c.refreshWorkspaces()
  pending.resolve(wire({id:'late-intent'})); await preparing
  assert.equal(c.state.prepared, null); assert.equal(c.state.busy, false); assert.equal(c.state.workspaceId, '')
  assert.equal(f.calls.length, 0)
})

test('removal during a live synthetic job leaves the Host running and preserves its completed history on explicit return', async t => {
  const answer = deferred(), f = await fixture(t, () => answer.promise), {c} = f
  t.after(() => answer.resolve('合成完成 [S1]'))
  c.input('question', '反馈帮助学生'); await c.prepare(); c.set({consent:true}); await c.start()
  const run = c.state.run, at = f.requests.length, disk = await readFile(join(f.root, 'A/.qcu-reading/state.json'))
  f.registry.splice(0, 1, B); await c.refreshWorkspaces()
  assert.equal(c.state.workspaceId, ''); assert.equal(c.state.run, run)
  assert.equal(f.a.run(run.id).status, 'running'); assert.equal(f.calls.length, 1)
  assert.deepEqual(f.requests.slice(at), [{action:'workspaces'}])
  assert.deepEqual(await readFile(join(f.root, 'A/.qcu-reading/state.json')), disk)
  answer.resolve('合成完成 [S1]'); await f.a.jobs.get(run.id).promise
  f.registry.push(A); await c.refreshWorkspaces(); assert.equal(c.state.workspaceId, '')
  await c.selectWorkspace('A'); assert.equal(c.state.runs[0].status, 'completed'); assert.equal(c.state.runs[0].id, run.id)
  assert.equal(f.calls.length, 1)
})

test('concurrent list refreshes use only the latest response, including stale errors and a failed latest request', async t => {
  for (const staleFailure of [false, true]) await t.test(staleFailure ? 'stale error' : 'stale missing-A list', async () => {
    const old = deferred(), latest = deferred(), queue = [old, latest]
    const c = new ReadingController({dispatch:() => queue.shift().promise}, {storage:null})
    c.set({workspaces:[A], workspaceId:'A', prepared:{id:'keep'}, consent:true, loading:false})
    const first = c.refreshWorkspaces(), second = c.refreshWorkspaces()
    latest.resolve(wire([A, B])); await second; const after = c.state
    if (staleFailure) old.reject(Error('late failure')); else old.resolve(wire([B]))
    await first; assert.deepEqual(c.state, after); c.set({prepared:null}); c.dispose()
  })
  const old = deferred(), latest = deferred(), queue = [old, latest]
  const c = new ReadingController({dispatch:() => queue.shift().promise}, {storage:null})
  t.after(() => { c.set({prepared:null}); c.dispose() })
  c.set({workspaces:[A], workspaceId:'A', prepared:{id:'keep'}, consent:true, question:'草稿', error:'保留材料错误', notice:'保留材料通知', loading:false})
  const before = retained(c.state), first = c.refreshWorkspaces(), second = c.refreshWorkspaces()
  latest.reject(Error('synthetic registry failure')); await second
  assert.deepEqual(retained(c.state), before); assert.ok(c.state.workspacesError); assert.equal(c.state.refreshingWorkspaces, false)
  old.resolve(wire([B])); await first; assert.deepEqual(c.state.workspaces, [A]); assert.ok(c.state.workspacesError)
  c.remote = {dispatch:async () => wire([A, B])}; await c.refreshWorkspaces()
  assert.equal(c.state.workspacesError, ''); assert.deepEqual(retained(c.state), before)
})

test('question edits and explicit selection during discovery do not discard a fresh list or restore the old selection', async t => {
  const f = await fixture(t), {c} = f, remote = c.remote, pending = deferred()
  f.registry.push(B); c.set({workspaces:[A, B]})
  c.remote = {dispatch:payload => JSON.parse(payload).action === 'workspaces' ? pending.promise : remote.dispatch(payload)}
  const refreshing = c.refreshWorkspaces(); await c.selectWorkspace('B'); c.input('question', 'B 草稿')
  pending.resolve(wire([A, B])); await refreshing
  assert.equal(c.state.workspaceId, 'B'); assert.equal(c.state.question, 'B 草稿'); assert.equal(c.state.refreshingWorkspaces, false)
  assert.deepEqual(c.state.workspaces, [A, B]); assert.equal(f.calls.length, 0)
})

test('a late material catalog and note completion cannot overwrite state after discovery removes the selection', async t => {
  const f = await fixture(t), {c} = f, remote = c.remote, catalog = deferred(), entered = deferred()
  c.remote = {dispatch:payload => {
    if (JSON.parse(payload).action === 'catalog') { entered.resolve(); return catalog.promise }
    return remote.dispatch(payload)
  }}
  c.selectParagraph('p0001'); c.input('comment', '保存期间移除工作区')
  const saving = c.saveNote(); await entered.promise
  f.registry.splice(0, 1, B); await c.refreshWorkspaces(); c.set({notice:'保留更新后的状态'})
  const after = c.state; catalog.resolve(wire({documents:[], notes:[], runs:[]})); await saving
  assert.deepEqual(c.state, after); assert.equal(c.state.workspaceMissing, true); assert.equal(f.calls.length, 0)
})

test('reconnect/boot supersedes old discovery; disposed controllers cannot dispatch or accept late discovery replies', async t => {
  const f = await fixture(t), {c} = f, remote = c.remote, old = deferred()
  c.remote = {dispatch:payload => JSON.parse(payload).action === 'workspaces' ? old.promise : remote.dispatch(payload)}
  const refreshing = c.refreshWorkspaces()
  f.registry.push(B); c.remote = remote; await c.reconnect(); c.input('question', '重新连接后的草稿')
  const after = c.state; old.resolve(wire([B])); await refreshing; assert.deepEqual(c.state, after)
  const late = deferred(); c.remote = {dispatch:() => late.promise}; const pending = c.refreshWorkspaces()
  c.dispose(); const disposed = c.state; late.resolve(wire([B])); await pending
  assert.deepEqual(c.state, disposed)
  c.remote = {dispatch:() => assert.fail('disposed controllers cannot dispatch')}
  await c.refreshWorkspaces(); await c.boot(); await c.reconnect(); await c.selectWorkspace('B')
  assert.deepEqual(c.state, disposed); assert.equal(f.calls.length, 0)
})

test('a superseded initial boot cannot select its old sole workspace; a missing remembered workspace cannot select a new sole B', async t => {
  const initial = deferred(), latest = deferred(), queue = [initial, latest]
  const requests = [], c = new ReadingController({dispatch:payload => { requests.push(JSON.parse(payload)); return queue.shift().promise }}, {storage:null})
  t.after(() => c.dispose())
  const boot = c.boot(), refresh = c.refreshWorkspaces()
  latest.resolve(wire([B])); await refresh; initial.resolve(wire([A])); await boot
  assert.deepEqual(c.state.workspaces, [B]); assert.equal(c.state.workspaceId, ''); assert.equal(c.state.loading, false)
  assert.equal(c.state.refreshingWorkspaces, false); assert.deepEqual(requests, [{action:'workspaces'}, {action:'workspaces'}])
  const remembered = new ReadingController({dispatch:async () => wire([B])}, {storage:{getItem:() => 'A'}})
  t.after(() => remembered.dispose())
  await remembered.boot(); assert.equal(remembered.state.workspaceId, ''); assert.equal(remembered.state.workspaceMissing, true)
  await remembered.reconnect(); assert.equal(remembered.state.workspaceId, '')
})
