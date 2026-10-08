import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
// Match the pinned official Client module loader's lazy-CJS factory contract.
const result = await build({ entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', external: ['react'], sourcemap: false,
  legalComments: 'none', metafile: true,
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory(require) {\nconst module = { exports: {} }; const exports = module.exports;` },
  footer: { js: 'return module.exports;\n} });' } })
for (const output of Object.values(result.metafile.outputs)) for (const dependency of output.imports) {
  if (dependency.external && dependency.path !== 'react') throw new Error('Unexpected Client runtime dependency.')
}
