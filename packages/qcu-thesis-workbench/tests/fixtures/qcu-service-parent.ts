/** Actual Host owner used by the synthetic abrupt-death supervisor. */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { QcuService } from '../../src/host/qcu-service.ts'

const [python, server, home, sibling] = process.argv.slice(2)
if (python === undefined || server === undefined || home === undefined) throw new Error('Missing fixture paths')
const service = new QcuService({ python, server, home, startupTimeoutMs: 10_000 })
const ready = await service.start()
if (sibling === 'sibling') {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { existsSync, writeFileSync } from 'node:fs'
    const [stop, alive] = process.argv.slice(1)
    const timer = setInterval(() => {
      if (existsSync(stop)) { clearInterval(timer); process.exit(0) }
      writeFileSync(alive, String(Date.now()))
    }, 50)
    setTimeout(() => process.exit(0), 12000).unref()
  `, join(home, 'sibling-stop'), join(home, 'sibling-alive')], { stdio: 'ignore' })
  writeFileSync(join(home, 'sibling-pid'), String(child.pid))
}
process.stdout.write(JSON.stringify(ready) + '\n')
process.stdin.on('data', () => { void service.stop().then(() => process.exit(0)) })
