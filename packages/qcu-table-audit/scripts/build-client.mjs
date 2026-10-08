import { build } from 'esbuild'
await build({ entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'esm', target: 'es2022', packages: 'external', sourcemap: false })
