/** Test-only driver for internal evidence unavailable from the public profile UI. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const [repo, root, mode, python] = process.argv.slice(2)
const native = mode.startsWith('native-')
let nativeOrigin
const nativeGranted = value => {
  if (value?.type === 'fixture:native-granted') nativeOrigin = value.origin
}
if (native) process.on('message', nativeGranted)
const url = relative => pathToFileURL(join(repo, relative)).href
const { runProfile } = await import(url('apps/cli/lib/profile-boot.js'))
const { loadProfileDirectory } = await import(url('packages/boot/app-boot/lib/index.js'))
const { createLaunchEnvironmentSnapshot } = await import(url('packages/util/launch-environment/lib/index.js'))
const { installQcuLaunchPolicy } = await import(url('apps/desktop-host/lib/types/qcu-policy.js'))
const { qcuDedicatedLaunch } = await import(url('apps/desktop-host/lib/types/qcu-launch.js'))
const fixture = name => new URL(name, import.meta.url).href
const { evidence, execute } = await import(fixture('qcu-protected-probe.mjs'))
const profileDir = join(root, 'home/profiles/qcu-protected')
const entryMarker = join(root, 'entries.txt')
const bodyMarker = join(root, 'tool-bodies.txt')
const cleanupMarker = join(root, 'cleanup.txt')
const queuedMarker = join(root, 'queued.txt')
const generationMarker = join(root, 'generations.txt')
mkdirSync(profileDir, { recursive: true })
const readLines = file => existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : []
const emit = value => process.stdout.write('QCU_PROTECTED_RESULT ' + JSON.stringify(value) + '\n')
const toolsUrl = url('packages/core/tools/lib/index.js')
const wrapper = join(profileDir, 'tools-provider.mjs')
function provider(generation) {
  return `import ToolRuntime from ${JSON.stringify(toolsUrl)};\n`
    + `import {appendFileSync} from 'node:fs';\n`
    + `appendFileSync(${JSON.stringify(generationMarker)},${JSON.stringify(String(generation) + '\n')});\n`
    + `export default ToolRuntime;\n`
}
async function failNextGuardBinding() {
  // Inject a defect into the real official implementation in this owned child.
  // The test must observe process exit, not a mocked exit or rejected Promise.
  const { default: ToolRuntime } = await import(toolsUrl)
  ToolRuntime.prototype.guard = () => {
    queueMicrotask(() => writeFileSync(queuedMarker, 'continued\n'))
    throw new Error('synthetic guard binding failure')
  }
}
writeFileSync(wrapper, provider(1))
if (mode === 'fatal-initial') await failNextGuardBinding()
const rows = [
  { id: 'system-prompt', name: url('packages/core/system-prompt/lib/index.js') },
  { id: 'tools', name: mode === 'hmr' ? pathToFileURL(wrapper).href : toolsUrl },
  { id: 'probe', name: fixture('qcu-protected-probe.mjs'), config: { entryMarker, bodyMarker, localTools: !native } },
]
if (!native && !['restart-empty', 'fatal-initial', 'fatal-rebind'].includes(mode)) {
  rows.push({ id: 'qcu-business', name: fixture('qcu-protected-business.mjs'), config: { entryMarker, cleanupMarker, fail: true } })
}
if (native) {
  mkdirSync(join(root, 'qcu-private'), { mode: 0o700 })
  rows.push({ id: 'skills', name: url('packages/skill/skill/lib/index.js') })
  rows.push({ id: 'qcu-business', name: url('../package/lib/index.js'), config: { localPython: { python, home: join(root, 'qcu-private'), startupTimeoutMs: 5000, shutdownTimeoutMs: 1000, terminateTimeoutMs: 500, killTimeoutMs: 1000 } } })
}
if (mode === 'hmr') {
  rows.push({ id: 'timer', name: url('vendor/timer/lib/index.js') })
  rows.push({ id: 'hmr', name: url('packages/boot/hmr/lib/index.js'), config: { base: profileDir, root: ['tools-provider.mjs'], ignored: [], debounce: 10, usePolling: true, interval: 20 } })
}
const patchPath = join(profileDir, 'cordis.patch.yml')
const manifestPath = join(profileDir, 'package.json')
// Reuse the previous launch's empty-business profile for the restart assertion.
if (mode !== 'restart-empty' || !existsSync(manifestPath)) {
  writeFileSync(manifestPath, JSON.stringify({ name: 'qcu-protected-fixture', version: '1.0.0', private: true, type: 'module', dsh: { profile: { bundles: [] } } }))
  writeFileSync(patchPath, JSON.stringify([{ insert: rows }]))
}
const installAnchor = join(repo, 'apps/cli/package.json')
const profile = loadProfileDirectory('dsh', profileDir, installAnchor)
const dedicated = qcuDedicatedLaunch(process.env.DSH_QCU_DEDICATED, profile)
let policy
let beforeEntryCount
let application
let server
let rootContext
let httpDelegations = 0
let agentDelegations = 0
let modelDelegations = 0
let origin
const reply = path => new Promise((resolve, reject) => {
  const req = request(origin + path, { agent: false, signal: AbortSignal.timeout(3000) }, res => {
    let text = ''
    res.setEncoding('utf8').on('data', value => { text += value })
    res.once('end', () => resolve({ status: res.statusCode, text }))
    res.once('error', reject)
  })
  req.once('error', reject)
  req.end()
})
const waitUntil = async (predicate, label) => {
  const deadline = Date.now() + 5000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for ' + label)
    await delay(10)
  }
}
async function inspect(phase) {
  const tools = rootContext.get('tools') ?? evidence.captures.at(-1)
  const ordinary = await execute(tools, 'ordinary_tool')
  const nearMiss = await execute(tools, 'qcu_thesis_open_extra')
  const allowed = native ? [] : await Promise.all(['qcu_thesis_open', 'qcu_thesis_check'].map(name => execute(tools, name)))
  const attachments = await Promise.all(['/api/session/uploadFileBinary', '/api/fileUploads/synthetic', '/api/file', '/api/%66ile'].map(reply))
  const health = await reply('/synthetic-health')
  const binaryMessages = [{ role: 'user', content: [{ type: 'attachment', id: 'synthetic' }] }]
  const agent = await rootContext.waterfall('agent/pre-step', { messages: binaryMessages }, async () => {
    agentDelegations++
    return { kind: 'continue' }
  })
  let modelError
  try {
    for await (const _chunk of rootContext.waterfall('llm/stream', { messages: binaryMessages }, async function* () {
      modelDelegations++
      yield { type: 'synthetic' }
    })) { /* Drain the synthetic stream; no provider or model is installed. */ }
  } catch (error) { modelError = String(error.message) }
  return { phase, policy: policy?.status, ordinary, nearMiss, allowed, attachments, health, agent, modelError,
    calls: [...evidence.calls], captures: evidence.captures.length, httpDelegations, agentDelegations, modelDelegations }
}

try {
  application = await runProfile({
    environment: createLaunchEnvironmentSnapshot([]), profile: 'qcu-protected',
    resolvedProfile: { profile, installAnchor }, args: [], patchFiles: [],
    ...(dedicated ? { prepareRoot(ctx) {
      beforeEntryCount = [...ctx.loader.entries()].length
      if (mode === 'invalid-policy') return installQcuLaunchPolicy(ctx, { version: 2 })
      if (mode === 'missing-policy') return installQcuLaunchPolicy(ctx)
      policy = installQcuLaunchPolicy(ctx, { version: 1 })
    } } : {}),
  })
  rootContext = application.ctx
  const loader = rootContext.loader
  const entry = id => [...loader.entries()].find(item => item.options.id === id)
  if (evidence.initial.length !== 1) throw new Error('Immediate configured consumer did not activate exactly once')
  server = createServer((req, res) => {
    void rootContext.waterfall('connection/request', req, res, async () => {
      httpDelegations++
      res.end('synthetic-admitted')
    }).catch(error => { res.destroy(error) })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  if (native) await waitUntil(() => nativeOrigin !== undefined, 'private native grant')
  const phases = [await inspect('initial')]

  let nativeEvidence
  if (native) {
    const business = entry('qcu-business')
    const retiring = business.fiber
    const listenersBefore = process.listenerCount('message')
    const started = performance.now()
    business.parent.tree.remove(business.options.id)
    await retiring.await()
    const elapsedMs = performance.now() - started
    if (entry('qcu-business')) throw new Error('Actual QCU business entry was not removed')
    phases.push(await inspect('native-business-removed'))
    const serviceClosed = await new Promise(resolve => {
      const req = request(nativeOrigin + '/task', { agent: false, signal: AbortSignal.timeout(2000) }, response => { response.resume(); resolve(false) })
      req.once('error', () => resolve(true))
      req.end()
    })
    nativeEvidence = { elapsedMs, serviceClosed, bridgeRemoved: !existsSync(join(root, 'qcu-private/bridge.json')),
      listenersRemoved: listenersBefore - process.listenerCount('message'), localToolsRemoved: !rootContext.tools.schemas().some(tool => tool.name === 'qcu_thesis_open') }
    await rootContext.fiber.dispose()
    phases.push(await inspect('root-disposed'))
  } else if (mode === 'lifecycle') {
    const business = entry('qcu-business')
    await loader.update(business.id, { disabled: true })
    await business.fiber.await()
    phases.push(await inspect('business-disabled-after-failed-cleanup'))
    await loader.update(business.id, { disabled: false })
    await loader.await()
    const remounted = business.fiber
    business.parent.tree.remove(business.options.id)
    await remounted.await()
    if (entry('qcu-business')) throw new Error('Business entry was not removed')
    phases.push(await inspect('business-removed-after-failed-cleanup'))

    const tools = entry('tools')
    await tools.fiber.restart()
    await loader.await()
    phases.push(await inspect('official-tools-restarted'))
    const previous = tools.fiber
    await loader.update(tools.id, { disabled: true })
    await previous.await()
    phases.push(await inspect('official-tools-absent'))
    await loader.update(tools.id, { disabled: false })
    await loader.await()
    phases.push(await inspect('official-tools-reenabled'))
    const retired = tools.fiber
    tools.parent.tree.remove(tools.options.id)
    await retired.await()
    await loader.await()
    await loader.create({ name: toolsUrl })
    await loader.await()
    phases.push(await inspect('official-tools-replaced'))

    // Persist business removal; the second process reuses the same profile.
    writeFileSync(patchPath, JSON.stringify([{ insert: rows.filter(row => row.id !== 'qcu-business') }]))
    await rootContext.fiber.dispose()
    phases.push(await inspect('root-disposed'))
  } else if (mode === 'hmr') {
    let reloads = 0
    rootContext.on('hmr/reload', () => { reloads++ })
    const oldTools = evidence.captures[0]
    writeFileSync(wrapper, provider(2))
    await waitUntil(() => reloads > 0 && evidence.captures.length === 2, 'real HMR replacement')
    await loader.await()
    if (oldTools === rootContext.tools) throw new Error('HMR retained the original service')
    const generations = readLines(generationMarker)
    if (generations.join(',') !== '1,2') throw new Error('HMR did not import the changed provider module')
    phases.push({ ...await inspect('watched-tools-module-replaced'), reloads, generation: Number(generations.at(-1)) })
    await rootContext.fiber.dispose()
    phases.push(await inspect('root-disposed'))
  } else if (mode === 'fatal-rebind') {
    await failNextGuardBinding()
    const tools = entry('tools')
    const retired = tools.fiber
    tools.parent.tree.remove(tools.options.id)
    await retired.await()
    await loader.await()
    await loader.create({ name: toolsUrl })
    await loader.await()
    throw new Error('Guard binding failure returned instead of terminating')
  }
  const retained = await Promise.all(evidence.captures.map(tools => execute(tools, 'ordinary_tool')))
  emit({ mode, beforeEntryCount, nativeEvidence, phases, initial: evidence.initial, retained,
    entries: readLines(entryMarker), bodies: readLines(bodyMarker), cleanup: readLines(cleanupMarker),
    businessPresent: [...loader.entries()].some(item => item.options.id === 'qcu-business') })
} catch (error) {
  emit({ mode, beforeEntryCount, error: String(error.message), entries: readLines(entryMarker), bodies: readLines(bodyMarker) })
  if (mode !== 'invalid-policy' && mode !== 'missing-policy') process.exitCode = 1
} finally {
  if (server) {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
  await application?.shutdown.shutdown(process.exitCode === 1 ? 1 : 0)
  if (native) {
    process.off('message', nativeGranted)
    if (process.connected) process.disconnect()
  }
}
