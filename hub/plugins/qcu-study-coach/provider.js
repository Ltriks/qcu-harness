import { createHash } from 'node:crypto'

export const skillName = 'chengyuan-study-coach'
export const expectedSkillSha256 = 'dfd2fac7624c2f46f0bdcb15c7ea475156082d538b44d023f39b7e445e42de32'

/** In-memory canonical guidance only: no files, network, child processes or tools. */
export function createSkillProvider(content) {
  if (typeof content !== 'string' || createHash('sha256').update(content, 'utf8').digest('hex') !== expectedSkillSha256) {
    throw new Error('Canonical skill source mismatch; review and version before changing it.')
  }
  const frontmatter = /^---\nname: ([^\n]+)\ndescription: ([^\n]+)\n---\n/.exec(content)
  if (!frontmatter || frontmatter[1] !== skillName) throw new Error('Canonical skill metadata mismatch.')
  return function apply(ctx, config) {
    if (config?.enabled === false) return
    if (config?.enabled !== true) throw new Error('Study coach requires explicit activation.')
    ctx.skills.register({ name: skillName, description: frontmatter[2],
      source: 'qcu-study-coach@0.1.0-pilot.1', content })
  }
}
