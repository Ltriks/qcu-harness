/**
 * 城院 Skill 安装器：从校内目录站安装已审 SKILL.md 包。
 */
import { resolveConfig } from './config.js'
import { buildTools } from './install.js'

export const name = 'chengyuan-skill-installer'
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = resolveConfig(config)
  const disposers = []
  for (const definition of buildTools(cfg)) {
    disposers.push(ctx.tools.register(definition))
  }
  ctx.on('dispose', () => {
    for (const dispose of disposers) dispose()
  })
}
