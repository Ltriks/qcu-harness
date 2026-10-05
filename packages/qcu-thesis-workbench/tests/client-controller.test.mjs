import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [new URL('../src/client/controller.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022' })
const { QcuPanelController } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const bounds = { x: 10.5, y: 81.25, width: 600, height: 400 }
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture(overrides = {}) {
  const calls = []
  const states = []
  let id = 0
  const bridge = {
    protocolVersion: 1,
    available: async () => true,
    open: async (...args) => { calls.push(['open', ...args]) },
    setBounds: async (...args) => { calls.push(['setBounds', ...args]) },
    close: async (...args) => { calls.push(['close', ...args]) },
    back: async (...args) => { calls.push(['back', ...args]) },
    ...overrides,
  }
  return { bridge, calls, states, controller: new QcuPanelController(bridge, state => states.push(state), () => `opaque-${++id}`) }
}

test('availability checks never open a task or acquire a context', async () => {
  const f = fixture()
  await f.controller.checkAvailability()
  assert.equal(f.controller.getSnapshot().availability, 'ready')
  assert.deepEqual(f.calls, [])
})

test('explicit readiness retry changes only availability and never acquires an occurrence', async () => {
  let ready = false
  const f = fixture({ available: async () => ready })
  await f.controller.checkAvailability()
  assert.equal(f.controller.getSnapshot().availability, 'unavailable')
  ready = true
  await f.controller.checkAvailability()
  assert.deepEqual(f.states.map(state => state.availability), ['checking', 'unavailable', 'checking', 'ready'])
  assert.deepEqual(f.calls, [])
  await f.controller.open(bounds)
  assert.equal(f.calls[0][1], 'opaque-1')
})

test('disposed controller ignores pending availability and refuses future readiness checks', async () => {
  const pending = deferred()
  let checks = 0
  const f = fixture({ available: () => { ++checks; return pending.promise } })
  const checking = f.controller.checkAvailability()
  await f.controller.dispose()
  const count = f.states.length
  pending.resolve(true)
  await checking
  await f.controller.checkAvailability()
  assert.equal(f.states.length, count)
  assert.equal(checks, 1)
  assert.deepEqual(f.calls, [])
})

test('absent, disabled, and failing capabilities produce only unavailable presentation', async () => {
  for (const bridge of [undefined, { available: async () => false }, { available: async () => { throw new Error('private native details') } }]) {
    const states = []
    const controller = new QcuPanelController(bridge, state => states.push(state))
    await controller.checkAvailability()
    assert.deepEqual(controller.getSnapshot(), { availability: 'unavailable', phase: 'idle' })
    assert.equal(JSON.stringify(states).includes('private'), false)
  }
})

test('explicit open checks availability again, sends only an opaque occurrence and CSS bounds', async () => {
  const f = fixture()
  await f.controller.checkAvailability()
  await f.controller.open(bounds)
  assert.deepEqual(f.calls, [['open', 'opaque-1', bounds]])
  assert.equal(f.controller.getSnapshot().phase, 'open')
  await f.controller.back()
  await f.controller.resize({ ...bounds, width: 620 })
  await f.controller.close()
  assert.deepEqual(f.calls.map(call => call[0]), ['open', 'back', 'setBounds', 'close'])
})

test('duplicate clicks while availability is pending produce one native open', async () => {
  const wait = deferred()
  const f = fixture({ available: () => wait.promise })
  const first = f.controller.open(bounds)
  await f.controller.open(bounds)
  wait.resolve(true)
  await first
  assert.equal(f.calls.filter(call => call[0] === 'open').length, 1)
})

test('cancel before availability resolves never opens the view', async () => {
  const wait = deferred()
  const f = fixture({ available: () => wait.promise })
  const opening = f.controller.open(bounds)
  await f.controller.close()
  wait.resolve(true)
  await opening
  assert.deepEqual(f.calls, [])
  assert.equal(f.controller.getSnapshot().phase, 'idle')
})

test('cancel while native open is pending closes that occurrence and ignores late completion', async () => {
  const wait = deferred()
  const calls = []
  const f = fixture({ open: (...args) => { calls.push(['open', ...args]); return wait.promise }, close: async id => { calls.push(['close', id]) } })
  const opening = f.controller.open(bounds)
  await Promise.resolve()
  await f.controller.close()
  wait.resolve()
  await opening
  assert.deepEqual(calls, [['open', 'opaque-1', bounds], ['close', 'opaque-1'], ['close', 'opaque-1']])
  assert.equal(f.controller.getSnapshot().phase, 'idle')
})

test('a later occurrence is not overwritten or closed by an older completion', async () => {
  const wait = deferred()
  const f = fixture()
  f.bridge.open = async (id, rect) => { f.calls.push(['open', id, rect]); if (id === 'opaque-1') await wait.promise }
  const old = f.controller.open(bounds)
  await Promise.resolve()
  await f.controller.close()
  await f.controller.open(bounds)
  wait.resolve()
  await old
  assert.equal(f.controller.getSnapshot().phase, 'open')
  assert.equal(f.calls.some(call => call[0] === 'close' && call[1] === 'opaque-2'), false)
})

test('retired Session entry does not update React or reopen after pending native completion', async () => {
  const wait = deferred()
  const f = fixture({ open: () => wait.promise })
  const opening = f.controller.open(bounds)
  await Promise.resolve()
  await f.controller.dispose()
  const count = f.states.length
  wait.resolve()
  await opening
  await f.controller.open(bounds)
  assert.equal(f.states.length, count)
  assert.ok(f.calls.every(call => call[0] === 'close' && call[1] === 'opaque-1'))
})

test('geometry updated during capability check is used for initial native open', async () => {
  const wait = deferred()
  const f = fixture({ available: () => wait.promise })
  const opening = f.controller.open(bounds)
  await f.controller.resize({ ...bounds, x: 24 })
  wait.resolve(true)
  await opening
  assert.deepEqual(f.calls[0], ['open', 'opaque-1', { ...bounds, x: 24 }])
})

test('native errors never display details, and open failure revokes its occurrence', async () => {
  const f = fixture({ open: async () => { throw new Error('synthetic-secret-path') } })
  await f.controller.open(bounds)
  assert.deepEqual(f.calls, [['close', 'opaque-1']])
  assert.equal(f.controller.getSnapshot().error, 'failed')
  assert.equal(JSON.stringify(f.states).includes('synthetic-secret'), false)
})

test('close failure is explicit and blocks another open', async () => {
  const f = fixture({ close: async () => { throw new Error('native failure') } })
  await f.controller.open(bounds)
  await f.controller.close()
  const failure = f.controller.getSnapshot()
  const count = f.states.length
  await f.controller.checkAvailability()
  assert.equal(f.controller.getSnapshot(), failure)
  assert.equal(f.states.length, count)
  await f.controller.open(bounds)
  assert.equal(f.controller.getSnapshot().error, 'closeFailed')
  assert.equal(f.calls.filter(call => call[0] === 'open').length, 1)
})

test('capability disabled between mount and explicit click fails closed', async () => {
  const f = fixture()
  await f.controller.checkAvailability()
  f.bridge.available = async () => false
  await f.controller.open(bounds)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.controller.getSnapshot(), { availability: 'unavailable', phase: 'idle' })
})

test('reopening waits for a pending native close to settle', async () => {
  const wait = deferred()
  const f = fixture({ close: () => wait.promise })
  await f.controller.open(bounds)
  const closing = f.controller.close()
  await f.controller.checkAvailability()
  await f.controller.open(bounds)
  assert.equal(f.controller.getSnapshot().availability, 'checking')
  assert.equal(f.calls.filter(call => call[0] === 'open').length, 1)
  wait.resolve()
  await closing
  await f.controller.open(bounds)
  assert.equal(f.calls.filter(call => call[0] === 'open').length, 2)
})

test('back and resize failures close only their occurrence and keep diagnostics generic', async () => {
  for (const operation of ['back', 'resize']) {
    const fail = async () => { throw new Error('synthetic-native-sensitive-details') }
    const f = fixture({ back: fail, setBounds: fail })
    await f.controller.open(bounds)
    await f.controller[operation](bounds)
    assert.deepEqual(f.calls.at(-1), ['close', 'opaque-1'])
    assert.equal(f.controller.getSnapshot().error, 'failed')
    assert.equal(JSON.stringify(f.states).includes('sensitive'), false)
  }
})

test('a late failed cleanup retires a newer occurrence instead of leaving a usable entry', async () => {
  const oldOpen = deferred()
  let oldCloseCount = 0
  const f = fixture()
  f.bridge.open = async (id, rect) => { f.calls.push(['open', id, rect]); if (id === 'opaque-1') await oldOpen.promise }
  f.bridge.close = async id => {
    f.calls.push(['close', id])
    if (id === 'opaque-1' && ++oldCloseCount === 2) throw new Error('late synthetic close failure')
  }
  const old = f.controller.open(bounds)
  await Promise.resolve()
  await f.controller.close()
  await f.controller.open(bounds)
  oldOpen.resolve()
  await old
  assert.ok(f.calls.some(call => call[0] === 'close' && call[1] === 'opaque-2'))
  assert.deepEqual(f.controller.getSnapshot(), { availability: 'unavailable', phase: 'idle', error: 'closeFailed' })
})


test('the native occurrence carries only a hashed conversation scope and remains fresh per open', async () => {
  const {createHash} = await import('node:crypto'); const calls=[];
  const bridge={available:async()=>true,open:async(...args)=>calls.push(args),close:async()=>{},setBounds:async()=>{},back:async()=>{},protocolVersion:1};
  const controller=new QcuPanelController(bridge,()=>{},()=> 'opaque-random-1','synthetic-conversation-a');
  await controller.open(bounds);
  assert.equal(calls[0][0],`scope_${createHash('sha256').update('synthetic-conversation-a').digest('hex')}_opaque-random-1`);
  assert.equal(JSON.stringify(calls).includes('synthetic-conversation-a'),false);
  await controller.dispose();
});
