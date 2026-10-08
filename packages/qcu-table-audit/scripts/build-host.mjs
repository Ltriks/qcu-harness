/** Build the Host adapter and materialize its one canonical Python engine. */
import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
execFileSync(process.execPath, [createRequire(import.meta.url).resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { stdio: 'inherit' })
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: false })
await mkdir('lib', { recursive: true })
await copyFile('../../skills/qcu-table-audit/scripts/audit.py', 'lib/audit.py')
await copyFile('../../skills/qcu-table-audit/examples/rules.json', 'lib/demo-rules.json')
await build({ entryPoints: ['src/task-host.ts'], outfile: 'lib/task-host.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: false })
await build({ entryPoints: ['src/guidance.ts'], outfile: 'lib/guidance.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: false })
