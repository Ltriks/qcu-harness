import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_CATALOG_URL = 'http://127.0.0.1:8080'
export const DEFAULT_ID_PREFIX = 'chengyuan-'

export function defaultSkillsDir() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skills')
}

export function resolveConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {}
  const catalogBaseUrl = String(cfg.catalogBaseUrl || process.env.CHENGYUAN_CATALOG_URL || DEFAULT_CATALOG_URL).replace(/\/$/, '')
  const skillsDir = String(cfg.skillsDir || process.env.CHENGYUAN_SKILLS_DIR || defaultSkillsDir())
  const idPrefix = String(cfg.idPrefix || DEFAULT_ID_PREFIX)
  return { catalogBaseUrl, skillsDir, idPrefix }
}

export function isSafeZipName(file) {
  return typeof file === 'string' && /^[a-z0-9][a-z0-9._-]*\.zip$/i.test(file)
}

export function isSafeSkillId(id, prefix) {
  return typeof id === 'string' && new RegExp(`^${prefix}[a-z0-9]+(?:-[a-z0-9]+)*$`).test(id)
}

export function pickPublished(catalog, { idPrefix }) {
  const skills = Array.isArray(catalog?.skills) ? catalog.skills : []
  return skills.filter((s) => (
    s && s.status === 'published'
    && isSafeSkillId(s.id, idPrefix)
    && isSafeZipName(s.file)
  ))
}

export function catalogUrl(base, path) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
