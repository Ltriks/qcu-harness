// Synthetic controlled process. Never invokes the actual Lark CLI or reads HOME.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
const directory = dirname(process.argv[1])
const plan = JSON.parse(readFileSync(join(directory, 'plan.json'), 'utf8'))
const step = plan.shift()
writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan))
appendFileSync(join(directory, 'calls.jsonl'), JSON.stringify({ argv: process.argv.slice(2), pid: process.pid,
  home: process.env.HOME, envKeys: Object.keys(process.env).sort() }) + '\n')
if (!step) process.exit(99)
if (step.ignoreTerm) process.on('SIGTERM', () => {})
if (step.hang) setInterval(() => {}, 1000)
else setTimeout(async () => {
  const out = step.stdoutBytes ? 'x'.repeat(step.stdoutBytes) : step.raw ?? (step.value ? JSON.stringify(step.value) : '')
  const err = step.stderrBytes ? 'x'.repeat(step.stderrBytes) : step.error ? JSON.stringify(step.error) : ''
  await Promise.all([new Promise(r => process.stdout.write(out, r)), new Promise(r => process.stderr.write(err, r))])
  process.exit(step.code ?? 0)
}, step.delayMs ?? 0)
