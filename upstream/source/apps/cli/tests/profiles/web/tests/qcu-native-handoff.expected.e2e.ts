/** CLI-installed external QCU Host, real owned Python service, and strictly synthetic local task. */
import { createServer, request as httpRequest } from 'node:http'
import { QcuHostBinding } from '../../../../../desktop/src/qcu-host-binding.ts'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FiberState } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { withDefaultWeb, webGet } from './default-web-process.ts'

const base = resolve(import.meta.dirname, '../../../../../..')
const migration = resolve(base, '..')
const archive = join(migration, 'qcu-thesis-workbench-0.2.0-external.3.tgz')
const pnpm = resolve(base, '../../qcu-task-providers/tooling/node_modules/.bin')

/** Owned-loopback HTTP adapter, matching QcuService's direct node:http transport. */
function localRequest(url: string, init: {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  signal?: AbortSignal
} = {}) {
  if (!/^http:\/\/127\.0\.0\.1:[0-9]+\//u.test(url)) throw new Error('Test request is not an owned-loopback target')
  return new Promise<{
    status: number
    headers: { get(name: string): string | undefined }
    text(): Promise<string>
    json(): Promise<unknown>
  }>((done, fail) => {
    const req = httpRequest(url, { method: init.method ?? 'GET', headers: init.headers, signal: init.signal }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      response.on('error', fail)
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        done({ status: response.statusCode ?? 0, headers: { get(name) {
          const value = response.headers[name.toLowerCase()]
          return Array.isArray(value) ? value[0] : value
        } }, text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)) })
      })
    })
    req.setTimeout(5000, () => { req.destroy(new Error('Owned-loopback test request timed out')) })
    req.on('error', fail)
    if (init.body !== undefined) req.setHeader('Content-Length', Buffer.byteLength(init.body))
    req.end(init.body)
  })
}

it.for([true, false])('installs the bundle with native marker %s, checks locally, and retires the owned service', async (enabled, test) => {
  const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim()
  expect(python.startsWith('/')).toBe(true)
  const modelRequests: string[] = []
  const sink = createServer((request, response) => { modelRequests.push(request.url ?? ''); response.writeHead(503).end('No model calls allowed') })
  await new Promise<void>((done, fail) => { sink.once('error', fail); sink.listen(0, '127.0.0.1', done) })
  test.onTestFinished(() => new Promise<void>((done, fail) => { sink.close((error) => { if (error) fail(error); else done() }) }))
  const address = sink.address()
  if (address === null || typeof address === 'string') throw new Error('No test-owned sink')
  const baseURL = `http://127.0.0.1:${address.port}`
  const patches: string[] = []
  let localOrigin = ''
  let nativeRevoked = false
  let qcuMessages = 0
  const nativeBinding = new QcuHostBinding(async () => { nativeRevoked = true })
  await withDefaultWeb(test, async ({ root, url, request }) => {
    if (enabled) await expect.poll(() => nativeBinding.available(), { timeout: 15000 }).toBe(true)
    else expect(nativeBinding.available()).toBe(false)
    const privateTarget = enabled ? await nativeBinding.acquireNativeTarget() : undefined
    const roster = await request('roster')
    expect(roster.entries).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'qcu-thesis-workbench', state: FiberState.ACTIVE })]))
    for (const id of ['@deepseek-ai/dsh-file-reference-local', '@deepseek-ai/dsh-client-ui-attachment', '@deepseek-ai/dsh-api-workspace-files', '@deepseek-ai/dsh-cordis-host-runner', '@deepseek-ai/dsh-cordis-client-runner']) {
      const disabled = roster.entries.find(row => row.name === id)
      expect(disabled, id).toBeDefined()
      expect(disabled?.state, id).not.toBe(FiberState.ACTIVE)
    }
    expect(JSON.stringify(roster.client)).not.toContain(join(root, 'qcu-private'))
    expect(JSON.stringify(roster.client)).not.toContain(python)
    expect(JSON.stringify(roster.client)).not.toContain('localPython')
    const client = roster.client.entries.find(row => row.id === 'qcu-thesis-workbench')
    if (client === undefined) throw new Error('External QCU Client was not advertised')
    const auth = await webGet(url, test.signal)
    const cookie = auth.headers['set-cookie']?.[0]?.split(';', 1)[0]
    if (cookie === undefined) throw new Error('No owned Host cookie')
    const clientBytes = await webGet(new URL(client.url, url), test.signal, { cookie })
    expect(clientBytes.status).toBe(200)
    expect(clientBytes.text).toContain('qcu-thesis-workbench')
    const skill = await webGet(new URL('/api/__qcu_test_skill', url), test.signal, { cookie })
    expect(skill.status).toBe(200)
    expect(JSON.parse(skill.text)).toEqual({ found: true })

    // Only the test process reads this private record; it is never a Client/RPC result or model input.
    await expect.poll(async () => {
      try { return (await readFile(join(root, 'qcu-private/bridge.json'))).length > 0 }
      catch (_error) { return false }
    }, { timeout: 15000 }).toBe(true)
    const bridge = JSON.parse(await readFile(join(root, 'qcu-private/bridge.json'), 'utf8')) as { base_url: string; token: string }
    expect(bridge.base_url).toMatch(/^http:\/\/127\.0\.0\.1:[0-9]+$/u)
    localOrigin = bridge.base_url
    if (enabled) expect(privateTarget?.origin).toBe(localOrigin)
    const page = await localRequest(localOrigin + '/task')
    expect(page.status).toBe(200)
    const localCookie = page.headers.get('set-cookie')?.split(';', 1)[0]
    if (localCookie === undefined) throw new Error('No private task cookie')
    const headers = { Cookie: localCookie, Origin: localOrigin }
    const rulesResponse = await localRequest(localOrigin + '/api/rules', { headers })
    const rules = await rulesResponse.json() as Array<{ id: string }>
    const rule = rules[0]
    if (rule === undefined) throw new Error('Packaged demo rule missing')
    const docx = await readFile(join(migration, 'fixtures/01-demo-match.docx'))
    const uploaded = await localRequest(localOrigin + '/api/task/upload', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: docx })
    expect(uploaded.status).toBe(200)
    const document = await uploaded.json() as { document_id: string; chat_allowed: boolean }
    expect(document.chat_allowed).toBe(false)
    const run = (consent: boolean) => localRequest(localOrigin + '/api/task/run', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: document.document_id, rule_id: rule.id, local_authorized: consent }) })
    expect((await run(false)).status).toBe(400)
    const completed = await run(true)
    expect(completed.status).toBe(200)
    const result = await completed.json() as { status: string; report_id: string; counts: Record<string, number> }
    expect(result.status).toBe('completed')
    expect(result.report_id).toMatch(/^[0-9a-f]{32}$/u)
    const report = await localRequest(`${localOrigin}/reports/${result.report_id}`, { headers })
    expect(report.status).toBe(200)
    expect(await report.text()).toContain('<html')
    const reuse = await localRequest(localOrigin + '/bridge/run', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-QCU-Bridge': bridge.token }, body: JSON.stringify({ document_id: document.document_id, rule_id: rule.id }) })
    expect(reuse.status).toBe(400)
    await writeFile(join(migration, `verification/host-task-summary-${String(enabled)}.json`), JSON.stringify({ nativeMarker: enabled, nativeBindingReady: nativeBinding.available(), bundleActive: true, skillDiscovered: true, clientAdvertised: true, chatAllowed: false, consentFalseRejected: true, localTaskCompleted: true, taskDocumentModelBridgeRejected: true, counts: result.counts, modelRequests: modelRequests.length }, null, 2))
    await writeFile(join(migration, `verification/served-client-${String(enabled)}.js`), clientBytes.text)
    await writeFile(join(migration, `verification/served-graph-${String(enabled)}.json`), JSON.stringify(roster.client, null, 2))
  }, { patches, qcuPrivateIpc: enabled, onChild: (child) => {
    nativeBinding.attach(child)
    child.on('message', (message) => {
      if (nativeBinding.handleMessage(child, message)) qcuMessages++
    })
    child.once('disconnect', () => { void nativeBinding.disconnected(child).catch(() => undefined) })
  }, prepare: async (root) => {
    const env = { PATH: `${pnpm}:${process.env.PATH ?? ''}`, HOME: root, DSH_HOME: join(root, 'home'), DSH_TELEMETRY_DISABLED: '1' }
    for (const args of [['--profile', 'web', '--dump-config'], ['plugin', '--profile', 'web', 'add', archive, '--ignore-scripts', '--offline', '--store-dir', resolve(base, '../../qcu-task-providers/pnpm-store')]]) {
      const proc = spawnSync(process.execPath, [join(base, 'apps/cli/lib/bin.js'), ...args], { cwd: root, env, encoding: 'utf8', timeout: 30_000 })
      expect(proc.status, proc.stderr).toBe(0)
    }
    await mkdir(join(root, 'qcu-private'), { mode: 0o700 })
    const probe = join(root, 'qcu-evidence-probe.js')
    await writeFile(probe, String.raw`export const inject=['skills'];export function apply(ctx){ctx.on('connection/request',async(req,res,next)=>{if(new URL(req.url,'http://127.0.0.1').pathname!=='/api/__qcu_test_skill')return next();const all=await ctx.skills.list();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({found:all.some(s=>s.name==='qcu-thesis-format-check')}));});}`)
    const patch = join(root, 'qcu-test.patch.yml')
    await writeFile(patch, JSON.stringify([
      { id: 'qcu-thesis-workbench', config: { localPython: { python, home: join(root, 'qcu-private') } } },
      { id: 'workspace-controller', config: { documentsDirectory: join(root, 'workspaces') } },
      { id: 'llm-deepseek', config: { baseURL } }, { id: 'llm-deepseek-account', config: { baseURL } },
      { insert: [{ id: 'qcu-evidence-probe', name: pathToFileURL(probe).href }] },
    ]))
    patches.push(patch)
  } })
  expect(modelRequests).toEqual([])
  expect(nativeBinding.available()).toBe(false)
  expect(nativeRevoked).toBe(enabled)
  if (!enabled) expect(qcuMessages).toBe(0)
  else expect(qcuMessages).toBeGreaterThanOrEqual(4)
  await expect(localRequest(localOrigin + '/api/rules', { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
})
