/** Read-only check of the frontend package resolved by Host and prepared Desktop. */
import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

function inspect(anchor) {
  const facts = { manifestResolvable: false, indexExists: false, indexReadable: false }
  let index
  try {
    const manifest = createRequire(anchor).resolve('@deepseek-ai/dsh-web-frontend/package.json')
    facts.manifestResolvable = true
    index = join(dirname(manifest), 'dist', 'index.html')
    facts.indexExists = existsSync(index) && statSync(index).isFile()
    if (facts.indexExists) {
      accessSync(index, constants.R_OK)
      facts.indexReadable = true
    }
  } catch {
    // Missing/unreadable build inputs are represented by fixed booleans; no path or diagnostic leaks.
  }
  return { facts, index }
}

/**
 * Inspect only existing build outputs. This never builds, starts, installs or authenticates.
 * @param upstream - Reconstructed official checkout with installed workspace dependencies.
 * @param runtimeProject - Optional prepared Desktop runtime project to check its own resolver.
 * @returns Numeric/boolean facts only, with a nonzero exit decision for missing required artifacts.
 */
export function verifyDesktopWeb(upstream, runtimeProject) {
  const host = inspect(join(resolve(upstream), 'packages', 'bundle', 'web-app', 'package.json'))
  const renderer = runtimeProject === undefined ? undefined : inspect(join(resolve(runtimeProject), 'package.json'))
  let sameIndex = false
  if (host.facts.indexReadable && renderer?.facts.indexReadable) {
    sameIndex = realpathSync(host.index) === realpathSync(renderer.index)
  }
  const facts = {
    hostManifestResolvable: host.facts.manifestResolvable,
    hostIndexExists: host.facts.indexExists,
    hostIndexReadable: host.facts.indexReadable,
    rendererChecked: renderer !== undefined,
    rendererManifestResolvable: renderer?.facts.manifestResolvable ?? false,
    rendererIndexExists: renderer?.facts.indexExists ?? false,
    rendererIndexReadable: renderer?.facts.indexReadable ?? false,
    samePhysicalIndex: sameIndex,
  }
  return { facts, exitCode: host.facts.indexReadable && (!renderer || renderer.facts.indexReadable) ? 0 : 1 }
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
