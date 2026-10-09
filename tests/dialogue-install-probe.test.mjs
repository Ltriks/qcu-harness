import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import Skills from '@deepseek-ai/dsh-skill'
import * as Probe from '../hub/pilot/dialogue-install-probe/index.js'

test('default bundle row stays disabled and declares no installation scripts or dependencies', async () => {
  const base = new URL('../hub/pilot/dialogue-install-probe/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8'))
  const patch = JSON.parse(await readFile(new URL('cordis.patch.yml', base), 'utf8'))
  assert.equal(patch[0].insert[0].disabled, true)
  assert.equal(manifest.version, '0.0.1-test.1')
  assert.equal(manifest.scripts, undefined)
  assert.equal(manifest.dependencies, undefined)
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-skill'], '0.2.0-rc.2')
})

test('explicit activation is required and disabled apply exposes no marker', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(Skills).await()
    await ctx.plugin(Probe, { enabled: false }).await()
    assert.deepEqual(await ctx.skills.list(), [])
    assert.throws(() => Probe.apply(ctx, {}), /explicit activation/)
    assert.throws(() => Probe.apply(ctx, { enabled: 'true' }), /explicit activation/)
  } finally { await ctx.fiber.dispose() }
})

test('marker loads in a new context and lifecycle disposal removes it', async () => {
  for (let restart = 0; restart < 2; restart++) {
    const ctx = new Context()
    try {
      await ctx.plugin(Skills).await()
      const fiber = ctx.plugin(Probe, { enabled: true }); await fiber.await()
      assert.deepEqual((await ctx.skills.list()).map(skill => skill.name), ['qcu-dialogue-install-probe'])
      const value = await ctx.skills.get('qcu-dialogue-install-probe')
      assert.ok(value.content.includes('QCU_INSTALL_PROBE_TEST_1'))
      await fiber.dispose()
      assert.deepEqual(await ctx.skills.list(), [])
    } finally { await ctx.fiber.dispose() }
  }
})

