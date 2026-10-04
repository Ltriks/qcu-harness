/** Read-only check of Host package resolution and Desktop's exact runtime file path. */
import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

function inspectIndex(index) {
  const facts = { indexExists: false, indexReadable: false }
  try {
    facts.indexExists = existsSync(index) && statSync(index).isFile()
    if (facts.indexExists) {
      accessSync(index, constants.R_OK)
      facts.indexReadable = true
    }
  } catch {
    // Disappearing or unreadable inputs remain fixed booleans, never filesystem diagnostics.
  }
  return facts
}

function inspectHost(anchor) {
  const facts = { manifestResolvable: false, indexExists: false, indexReadable: false }
  let index
  try {
    const manifest = createRequire(anchor).resolve('@deepseek-ai/dsh-web-frontend/package.json')
    facts.manifestResolvable = true
    index = join(dirname(manifest), 'dist', 'index.html')
    Object.assign(facts, inspectIndex(index))
  } catch {
    // Missing/unreadable build inputs are represented by fixed booleans; no path or diagnostic leaks.
  }
  return { facts, index }
}

function inspectRenderer(runtimeProject) {
  // main.ts serves directly beneath resources.dsh/node_modules. Node ancestor
  // package resolution would certify a file the actual protocol handler cannot serve.
  const frontend = join(resolve(runtimeProject), 'node_modules', '@deepseek-ai', 'dsh-web-frontend')
  const index = join(frontend, 'dist', 'index.html')
  let manifestPresent = false
  try {
    const manifest = join(frontend, 'package.json')
    manifestPresent = existsSync(manifest) && statSync(manifest).isFile()
  } catch {
    // The actual Renderer path does not require a manifest; report only its presence.
  }
  return { facts: { manifestPresent, ...inspectIndex(index) }, index }
}

/**
 * Inspect only existing build outputs. This never builds, starts, installs or authenticates.
 * @param upstream - Reconstructed official checkout with installed workspace dependencies.
 * @param runtimeProject - Optional prepared Desktop runtime project to check its direct serving path.
 * @returns Numeric/boolean facts only, with a nonzero exit decision for missing required artifacts.
 */
export function verifyDesktopWeb(upstream, runtimeProject) {
  const host = inspectHost(join(resolve(upstream), 'packages', 'bundle', 'web-app', 'package.json'))
  const renderer = runtimeProject === undefined ? undefined : inspectRenderer(runtimeProject)
  let sameIndex = false
  let artifactCheckCompleted = true
  if (host.facts.indexReadable && renderer?.facts.indexReadable) {
    try {
      sameIndex = realpathSync(host.index) === realpathSync(renderer.index)
    } catch {
      // A file can disappear after access checks. Fail without exposing the underlying path/error.
      artifactCheckCompleted = false
    }
  }
  const facts = {
    hostManifestResolvable: host.facts.manifestResolvable,
    hostIndexExists: host.facts.indexExists,
    hostIndexReadable: host.facts.indexReadable,
    rendererChecked: renderer !== undefined,
    rendererManifestPresent: renderer?.facts.manifestPresent ?? false,
    rendererIndexExists: renderer?.facts.indexExists ?? false,
    rendererIndexReadable: renderer?.facts.indexReadable ?? false,
    samePhysicalIndex: sameIndex,
    artifactCheckCompleted,
  }
  return { facts, exitCode: artifactCheckCompleted && host.facts.indexReadable && (!renderer || renderer.facts.indexReadable) ? 0 : 1 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { upstream: { type: 'string' }, 'runtime-project': { type: 'string' } } })
  if (!values.upstream) {
    console.error('usage: node scripts/verify-desktop-web.mjs --upstream <checkout> [--runtime-project <prepared-project>]')
    process.exitCode = 2
  } else {
    const result = verifyDesktopWeb(values.upstream, values['runtime-project'])
    console.log(JSON.stringify(result.facts, null, 2))
    process.exitCode = result.exitCode
  }
}
