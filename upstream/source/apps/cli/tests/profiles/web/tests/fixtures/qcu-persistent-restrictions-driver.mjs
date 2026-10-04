/** Built standard-Web composition evidence unavailable through its disabled configuration UI. */
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [repo, root, mode, python] = process.argv.slice(2)
const url = relative => pathToFileURL(join(repo, relative)).href
const { runProfile, prepareProfile } = await import(url('apps/cli/lib/profile-boot.js'))
const { readProfilePatches, reconcileProfilePatches } = await import(url('packages/boot/app-boot/lib/index.js'))
const { createLaunchEnvironmentSnapshot } = await import(url('packages/util/launch-environment/lib/index.js'))
const { qcuProfileRestrictions } = await import(url('apps/desktop-host/lib/types/qcu-profile-policy.js'))
const { installQcuLaunchPolicy } = await import(url('apps/desktop-host/lib/types/qcu-policy.js'))
const restrictions = qcuProfileRestrictions()
const overrides = restrictions.map(({ id }) => ({ id, disabled: false }))
const emit = value => process.stdout.write('QCU_RESTRICTIONS_RESULT ' + JSON.stringify(value) + '\n')
const home = join(root, 'home')
const profile = prepareProfile('web')
const manifestPath = join(profile.dir, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const bundle = 'qcu-thesis-workbench'
const businessDir = join(repo, '../package')
const businessLink = join(profile.dir, 'node_modules', bundle)
mkdirSync(join(profile.dir, 'node_modules'), { recursive: true })
if (!existsSync(businessLink)) symlinkSync(businessDir, businessLink, process.platform === 'win32' ? 'junction' : 'dir')
const restarted = mode === 'restart'
if (!restarted) {
  manifest.dependencies = { ...manifest.dependencies, [bundle]: '0.2.0-external.3' }
  manifest.dsh.profile.bundles.push(bundle)
}
writeFileSync(manifestPath, JSON.stringify(manifest))
mkdirSync(join(root, 'qcu-private'), { recursive: true, mode: 0o700 })
let requests = 0
const sink = createServer((_request, response) => { requests++; response.writeHead(503).end('No model calls allowed') })
await new Promise(resolve => sink.listen(0, '127.0.0.1', resolve))
const baseURL = `http://127.0.0.1:${sink.address().port}`
const safeConfig = [
  { id: 'workspace-controller', config: { documentsDirectory: join(root, 'workspaces') } },
  { id: 'llm-deepseek', config: { baseURL } },
  { id: 'llm-deepseek-account', config: { baseURL } },
]
const businessConfig = { id: bundle, config: { localPython: { python, home: join(root, 'qcu-private') } } }
const overlayPath = join(root, 'user-overlay.patch.yml')
writeFileSync(overlayPath, JSON.stringify(overrides))
writeFileSync(join(home, 'cordis.patch.yml'), JSON.stringify(overrides))
writeFileSync(profile.patchPath, JSON.stringify([...safeConfig, ...restarted ? [] : [businessConfig], ...overrides]))
if (mode === 'bad-patch') writeFileSync(profile.patchPath, '{ malformed')
let application
let beforeEntryCount
let policy
const phases = []
function inspect(phase) {
  const ctx = application.ctx
  const entries = [...ctx.loader.entries()]
  const rows = restrictions.map(({ id }) => {
    const entry = entries.find(item => item.options.id === id)
    return { id, present: entry !== undefined, disabled: entry?.options.disabled, state: entry?.fiber?.state,
      name: entry?.options.name }
  })
  return { phase, rows, policy: policy.status,
    businessPresent: entries.some(entry => entry.options.id === bundle),
    businessState: entries.find(entry => entry.options.id === bundle)?.fiber?.state,
    clientEntries: ctx.clientModules.graph().entries.map(entry => entry.id),
    selectedBundles: JSON.parse(readFileSync(manifestPath, 'utf8')).dsh.profile.bundles,
    businessDependencyPresent: Object.hasOwn(JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies ?? {}, bundle),
    businessPackageBytesPresent: existsSync(join(businessLink, 'lib/index.js')),
  }
}
try {
  application = await runProfile({
    environment: createLaunchEnvironmentSnapshot([]), profile: 'web',
    args: ['--host', '127.0.0.1', '--port', '0', '--no-open'], patchFiles: [overlayPath],
    launchPatches: mode === 'missing-target' ? [...restrictions, { id: 'absent-required-target', disabled: true }] : restrictions,
    prepareRoot(ctx) {
      beforeEntryCount = [...ctx.loader.entries()].length
      policy = installQcuLaunchPolicy(ctx, { version: 1 })
    },
  })
  phases.push(inspect(restarted ? 'restart-without-business' : 'initial'))
  if (!restarted) {
    // Remove the bundle selection and its dependency declaration, not installed bytes.
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(name => name !== bundle)
    delete manifest.dependencies[bundle]
    writeFileSync(manifestPath, JSON.stringify(manifest))
    writeFileSync(profile.patchPath, JSON.stringify([...safeConfig, ...overrides]))
    await reconcileProfilePatches(application.ctx, readProfilePatches('dsh', application.ctx.profileContext), 'dsh')
    phases.push(inspect('business-configuration-removed'))
    // Config editor and production HMR use this same retained profileContext read/reconcile pair.
    writeFileSync(profile.patchPath, JSON.stringify([...safeConfig, ...overrides.slice().reverse()]))
    writeFileSync(join(home, 'cordis.patch.yml'), JSON.stringify(overrides.slice().reverse()))
    await reconcileProfilePatches(application.ctx, readProfilePatches('dsh', application.ctx.profileContext), 'dsh')
    phases.push(inspect('user-enablement-attempt-reconciled'))
    const standardBundles = manifest.dsh.profile.bundles
    manifest.dsh.profile.bundles = standardBundles.filter(name => name !== '@deepseek-ai/dsh-web-app')
    writeFileSync(manifestPath, JSON.stringify(manifest))
    let missingTargetError
    try {
      await reconcileProfilePatches(application.ctx, readProfilePatches('dsh', application.ctx.profileContext), 'dsh')
    } catch (error) { missingTargetError = String(error.message) }
    if (missingTargetError === undefined) throw new Error('Missing standard-Web launch targets were silently skipped')
    phases.push({ ...inspect('missing-target-reload-rejected'), rejected: missingTargetError })
    manifest.dsh.profile.bundles = standardBundles
    writeFileSync(manifestPath, JSON.stringify(manifest))
    writeFileSync(profile.patchPath, '{ malformed')
    let badPatchError
    try {
      await reconcileProfilePatches(application.ctx, readProfilePatches('dsh', application.ctx.profileContext), 'dsh')
    } catch (error) { badPatchError = String(error.message) }
    if (badPatchError === undefined) throw new Error('Malformed user patch was silently skipped')
    phases.push({ ...inspect('bad-patch-reload-rejected'), rejected: badPatchError })
    writeFileSync(profile.patchPath, JSON.stringify([...safeConfig, ...overrides]))
  }
  emit({ beforeEntryCount, phases, modelRequests: requests })
} catch (error) {
  emit({ beforeEntryCount, phases, error: String(error.message), modelRequests: requests })
  if (mode !== 'bad-patch' && mode !== 'missing-target') process.exitCode = 1
} finally {
  await application?.shutdown.shutdown(process.exitCode === 1 ? 1 : 0)
  sink.closeAllConnections()
  await new Promise((resolve, reject) => sink.close(error => error ? reject(error) : resolve()))
}
