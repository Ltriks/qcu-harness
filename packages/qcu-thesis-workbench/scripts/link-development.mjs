/** Local development setup only. This is NOT the DSH plugin installer. */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(process.argv[2] ?? '')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (commit !== '639ed015397290b3745d163aafe02ffee4aa3f84') throw new Error('Use the documented pinned official checkout')
const root = fileURLToPath(new URL('..', import.meta.url))
const modules = join(root, 'node_modules')
function link(target, destination) {
  const actual = realpathSync(target)
  if (existsSync(destination)) {
    if (realpathSync(destination) !== actual) throw new Error(`Preserve and review existing dependency: ${destination}`)
    return
  }
  try { lstatSync(destination); throw new Error(`Unresolved existing link: ${destination}`) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  mkdirSync(dirname(destination), { recursive: true })
  symlinkSync(actual, destination, process.platform === 'win32' ? 'junction' : undefined)
}
const refs = {
  esbuild: 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild',
  typescript: 'node_modules/typescript', vitest: 'node_modules/vitest', tsx: 'node_modules/tsx', jsdom: 'node_modules/jsdom',
  react: 'packages/client/ui-conversation/node_modules/react', 'react-dom': 'packages/client/ui-conversation/node_modules/react-dom',
  '@types/node': 'node_modules/@types/node', '@types/react': 'packages/client/ui-conversation/node_modules/@types/react',
  '@types/react-dom': 'packages/client/ui-conversation/node_modules/@types/react-dom',
  '@deepseek-ai/cordis': 'vendor/cordis', '@deepseek-ai/dsh-tools': 'packages/core/tools',
  '@deepseek-ai/dsh-skill': 'packages/skill/skill', '@deepseek-ai/dsh-skill-filesystem': 'packages/skill/skill-filesystem',
  '@deepseek-ai/dsh-system-prompt': 'packages/core/system-prompt', '@deepseek-ai/dsh-llm': 'packages/llm/llm',
}
for (const name of ['ui-slots', 'ui-conversation', 'ui-session', 'locale', 'ui-renderer']) refs[`@deepseek-ai/dsh-client-${name}`] = `packages/client/${name}`
for (const [name, relative] of Object.entries(refs)) link(join(source, relative), join(modules, name))
for (const [name, relative] of Object.entries({ vitest: 'vitest/vitest.mjs', tsc: 'typescript/bin/tsc', tsx: 'tsx/dist/cli.mjs' })) {
  link(join(modules, relative), join(modules, '.bin', name))
}
console.log('Linked pinned development dependencies only; no DSH profile or installed plugin changed')
