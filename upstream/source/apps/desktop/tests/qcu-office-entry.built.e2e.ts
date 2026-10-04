import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'

const roots: string[] = []
const entry = fileURLToPath(new URL('../lib/qcu-main.js', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/qcu-entry-probe.mjs', import.meta.url))

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function temporaryAppData(): string {
  const root = mkdtempSync(join(tmpdir(), 'qcu-built-entry-'))
  roots.push(root)
  return root
}

function probe(appData: string, mode = 'qcu') {
  expect(existsSync(entry), 'Build Desktop before the built-entry smoke').toBe(true)
  return spawnSync(process.execPath, [fixture, appData, entry, mode], {
    encoding: 'utf8',
    timeout: 10_000,
    env: { PATH: process.env.PATH, DSH_HOME: '/ordinary/home', DSH_DESKTOP_USER_DATA_DIR: '/ordinary/electron', DSH_QCU_DEDICATED: '1' },
  })
}

it('uses the independent manifest entry and configures roots before evaluating bundled Desktop', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { main: string }
  expect(manifest.main).toBe('lib/qcu-main.js')
  const root = temporaryAppData()
  const result = probe(root)
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    atMainEvaluation: true,
    dedicated: true,
    paths: { appData: join(root, 'qcu-office'), userData: join(root, 'qcu-office', 'electron'), sessionData: join(root, 'qcu-office', 'session-data') },
    home: join(root, 'qcu-office', 'home'),
    businessConfigured: false,
  })
})

it('keeps ordinary main non-dedicated despite inherited diagnostic switches and environment', () => {
  const root = temporaryAppData()
  const result = probe(root, 'ordinary')
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ atMainEvaluation: true, dedicated: false, diagnosticSwitch: true })
  expect(existsSync(join(root, 'qcu-office'))).toBe(false)
})

it('keeps dedicated mode through a cold restart after every business config entry is removed', () => {
  const root = temporaryAppData()
  const profile = join(root, 'qcu-office', 'home', 'profiles', 'desktop')
  mkdirSync(profile, { recursive: true, mode: 0o700 })
  writeFileSync(join(profile, 'cordis.yml'), 'plugins: {}\n')
  const before = probe(root)
  expect(before.status, before.stderr).toBe(0)
  expect(JSON.parse(before.stdout)).toMatchObject({ dedicated: true, businessConfigured: true })
  rmSync(profile, { recursive: true })
  const after = probe(root)
  expect(after.status, after.stderr).toBe(0)
  expect(JSON.parse(after.stdout)).toMatchObject({ dedicated: true, businessConfigured: false })
})

it('fails before Desktop evaluation if the platform appData path is invalid', () => {
  const result = probe('relative/ordinary-profile')
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('absolute platform appData')
  expect(result.stdout).toBe('')
})

it('fails before Desktop evaluation instead of falling back when namespace creation fails', () => {
  const root = temporaryAppData()
  writeFileSync(join(root, 'qcu-office'), 'synthetic obstruction')
  const result = probe(root)
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('real directories')
  expect(result.stdout).toBe('')
  expect(readFileSync(join(root, 'qcu-office'), 'utf8')).toBe('synthetic obstruction')
})
