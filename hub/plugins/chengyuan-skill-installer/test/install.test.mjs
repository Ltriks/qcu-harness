import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeSkillId, isSafeZipName, pickPublished, resolveConfig } from '../lib/config.js'
import { selectSkills } from '../lib/catalog.js'
import { extractZip, findSkillRoot, installSkills } from '../lib/install.js'

test('id and zip name guards', () => {
  assert.equal(isSafeSkillId('chengyuan-acct-entry-coach', 'chengyuan-'), true)
  assert.equal(isSafeSkillId('../evil', 'chengyuan-'), false)
  assert.equal(isSafeZipName('chengyuan-acct-entry-coach-0.1.0.zip'), true)
  assert.equal(isSafeZipName('../x.zip'), false)
})

test('pickPublished only allows chengyuan published zips', () => {
  const list = pickPublished({
    skills: [
      { id: 'chengyuan-a', status: 'published', file: 'chengyuan-a-0.1.0.zip' },
      { id: 'chengyuan-b', status: 'planned', file: 'chengyuan-b-0.1.0.zip' },
      { id: 'other-x', status: 'published', file: 'other-x-0.1.0.zip' },
    ],
  }, { idPrefix: 'chengyuan-' })
  assert.deepEqual(list.map((s) => s.id), ['chengyuan-a'])
})

test('selectSkills', () => {
  const entries = [
    { id: 'chengyuan-a', category: '通用' },
    { id: 'chengyuan-b', category: '会计' },
  ]
  assert.equal(selectSkills(entries, { id: 'chengyuan-b' })[0].id, 'chengyuan-b')
  assert.equal(selectSkills(entries, { category: '会计' }).length, 1)
  assert.equal(selectSkills(entries, { all: true }).length, 2)
})

test('extractZip + findSkillRoot', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cy-test-'))
  try {
    const src = join(tmp, 'chengyuan-a')
    mkdirSync(src)
    writeFileSync(join(src, 'SKILL.md'), '---\nname: chengyuan-a\ndescription: x\n---\n')
    const zip = join(tmp, 'chengyuan-a-0.1.0.zip')
    execFileSync('zip', ['-qr', zip, 'chengyuan-a'], { cwd: tmp })
    const extracted = join(tmp, 'out')
    extractZip(zip, extracted)
    const root = findSkillRoot(extracted, 'chengyuan-a')
    assert.equal(existsSync(join(root, 'SKILL.md')), true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('installSkills from mock catalog', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cy-inst-'))
  try {
    const src = join(tmp, 'chengyuan-a')
    mkdirSync(src)
    writeFileSync(join(src, 'SKILL.md'), '---\nname: chengyuan-a\ndescription: demo\n---\nbody\n')
    execFileSync('zip', ['-qr', 'chengyuan-a-0.1.0.zip', 'chengyuan-a'], { cwd: tmp })
    const zipBuf = readFileSync(join(tmp, 'chengyuan-a-0.1.0.zip'))
    const skillsDir = join(tmp, 'skills')
    const cfg = resolveConfig({ catalogBaseUrl: 'http://catalog.test', skillsDir, idPrefix: 'chengyuan-' })
    const fetchImpl = async (url) => {
      if (String(url).endsWith('/catalog.json')) {
        return {
          ok: true,
          json: async () => ({
            skills: [{ id: 'chengyuan-a', status: 'published', file: 'chengyuan-a-0.1.0.zip', name: 'A', category: '通用', version: '0.1.0' }],
          }),
        }
      }
      if (String(url).endsWith('/skills/chengyuan-a-0.1.0.zip')) {
        return { ok: true, arrayBuffer: async () => zipBuf }
      }
      throw new Error('unexpected ' + url)
    }
    const results = await installSkills({ cfg, id: 'chengyuan-a', fetchImpl })
    assert.equal(results[0].ok, true)
    assert.equal(readFileSync(join(skillsDir, 'chengyuan-a', 'SKILL.md'), 'utf8').includes('name: chengyuan-a'), true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
