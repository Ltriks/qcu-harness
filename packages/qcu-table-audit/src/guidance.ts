/** Bundled read-only task guidance; never scans user or project Skill roots. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'
import * as filesystem from '@deepseek-ai/dsh-skill-filesystem'
import { fileURLToPath } from 'node:url'
export const name = 'qcu-table-audit-guidance'
export const inject = ['skills']
export interface Config { readonly enabled: boolean }
export function apply(ctx: Context, config: Config): void {
  if (config?.enabled === false) return
  if (config?.enabled !== true) throw new Error('CSV guidance requires explicit activation.')
  ctx.plugin(filesystem, { providerName: name, includeDefaultRoots: false, watch: false,
    bundledSkillDir: fileURLToPath(new URL('../skills', import.meta.url)) })
}
