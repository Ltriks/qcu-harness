/** Standalone esbuild implementation of the locked official lazy-CJS factory recipe. */
import { build } from 'esbuild'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await mkdir(new URL('../lib', import.meta.url), { recursive: true })
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  loader: { '.css': 'text' },
  sourcemap: 'external',
  sourcesContent: true,
  legalComments: 'none',
  metafile: true,
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory(require) {\nconst module = { exports: {} }; const exports = module.exports;` },
  footer: { js: 'return module.exports;\n} });' },
})
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && dependency.path !== 'react') {
      throw new Error(`Unexpected Client runtime dependency: ${dependency.path}`)
    }
  }
}
console.log(`Built ${manifest.name}/client: lazy-CJS factory; shared React; no native implementation`)
