/** Compile only this external Host; official packages remain runtime peers. */
import { build } from 'esbuild'
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external',
  external: ['../plugin/index.js'], sourcemap: false,
})
