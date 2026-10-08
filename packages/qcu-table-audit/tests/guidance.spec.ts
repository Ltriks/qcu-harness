/** Real official Skill provider lifecycle; no user roots or model calls. */
import { Context } from '@deepseek-ai/cordis'
import Skills from '@deepseek-ai/dsh-skill'
import { expect, it } from 'vitest'
import * as Guidance from '../lib/guidance.js'

it('loads only packaged read-only guidance and removes it on unload', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(Skills).await()
    const fiber = ctx.plugin(Guidance, { enabled: true }); await fiber.await()
    const list = await ctx.skills.list()
    expect(list.map(skill => skill.name)).toEqual(['qcu-csv-readonly-task'])
    const skill = await ctx.skills.get('qcu-csv-readonly-task')
    expect(skill?.content).toContain('不要搜索个人目录')
    expect(skill?.content).toContain('不清洗')
    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  } finally { await ctx.fiber.dispose() }
})

it('keeps disabled guidance inert', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(Skills).await()
    await ctx.plugin(Guidance, { enabled: false }).await()
    expect(await ctx.skills.list()).toEqual([])
  } finally { await ctx.fiber.dispose() }
})
