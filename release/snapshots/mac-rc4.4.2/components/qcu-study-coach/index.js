import { createHash } from 'node:crypto'
import { content, contentSha256 } from './skill-content.js'
export const name = 'qcu-study-coach'
export const inject = ['skills']
export async function apply(ctx, config) {
  if (config?.enabled !== true) throw new Error('Explicit activation required')
  if (createHash('sha256').update(content).digest('hex') !== contentSha256) throw new Error('Skill integrity failure')
  if (await ctx.skills.get('qcu-study-coach')) throw new Error('Existing qcu-study-coach skill; no overwrite')
  ctx.skills.register({ name: 'qcu-study-coach', description: 'QCU学习方法教练：合理拆解任务、安排节奏与错题复盘，不代写应交作业。', source: 'qcu-study-coach@0.1.0-pilot.2', provider: 'qcu-study-coach@0.1.0-pilot.2', content })
}
