import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { catalogUrl } from './config.js'
import { fetchCatalog, listInstallable, selectSkills } from './catalog.js'

function compileParameters(spec) {
  const properties = {}
  const required = []
  for (const [key, prop] of Object.entries(spec)) {
    if (prop?.required === true) required.push(key)
    const node = {}
    if (typeof prop?.type === 'string') node.type = prop.type
    if (typeof prop?.description === 'string') node.description = prop.description
    properties[key] = node
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
}

function asRecord(value) {
  return typeof value === 'object' && value !== null ? value : {}
}

export function findSkillRoot(extractedDir, skillId) {
  const nested = join(extractedDir, skillId, 'SKILL.md')
  if (existsSync(nested)) return join(extractedDir, skillId)
  const flat = join(extractedDir, 'SKILL.md')
  if (existsSync(flat)) return extractedDir
  const kids = readdirSync(extractedDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  if (kids.length === 1) {
    const only = join(extractedDir, kids[0].name, 'SKILL.md')
    if (existsSync(only)) return join(extractedDir, kids[0].name)
  }
  throw new Error(`${skillId} 的 zip 里找不到 SKILL.md`)
}

export function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true })
  try {
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'pipe' })
    return
  } catch {
    // fall through to python
  }
  execFileSync('python3', ['-c', `
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
root = os.path.realpath(out)
with zipfile.ZipFile(src) as z:
    for info in z.infolist():
        dest = os.path.realpath(os.path.join(out, info.filename))
        if dest != root and not dest.startswith(root + os.sep):
            raise SystemExit('zip slip: ' + info.filename)
    z.extractall(out)
`, zipPath, destDir], { stdio: 'pipe' })
}

async function downloadZip(catalogBaseUrl, file, fetchImpl) {
  const url = catalogUrl(catalogBaseUrl, `/skills/${file}`)
  const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function installSkills({ cfg, id, category, all, fetchImpl = fetch }) {
  const catalog = await fetchCatalog(cfg.catalogBaseUrl, fetchImpl)
  const entries = listInstallable(catalog, cfg)
  const selected = selectSkills(entries, { id, category, all })
  mkdirSync(cfg.skillsDir, { recursive: true })
  const results = []
  for (const skill of selected) {
    const tmp = mkdtempSync(join(tmpdir(), 'chengyuan-skill-'))
    try {
      const zipPath = join(tmp, skill.file)
      writeFileSync(zipPath, await downloadZip(cfg.catalogBaseUrl, skill.file, fetchImpl))
      const extracted = join(tmp, 'extracted')
      extractZip(zipPath, extracted)
      const root = findSkillRoot(extracted, skill.id)
      const skillMd = readFileSync(join(root, 'SKILL.md'), 'utf8')
      if (!skillMd.includes(`name: ${skill.id}`)) {
        throw new Error(`${skill.id} 的 SKILL.md 未包含匹配的 name`)
      }
      const dest = resolve(cfg.skillsDir, skill.id)
      if (!dest.startsWith(resolve(cfg.skillsDir))) {
        throw new Error('拒绝安装到技能目录之外')
      }
      rmSync(dest, { recursive: true, force: true })
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(root, dest, { recursive: true })
      results.push({ id: skill.id, version: skill.version, dest, ok: true })
    } catch (error) {
      results.push({ id: skill.id, ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }
  return results
}

export function listLocal(cfg) {
  if (!existsSync(cfg.skillsDir)) return []
  return readdirSync(cfg.skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(cfg.idPrefix))
    .filter((d) => existsSync(join(cfg.skillsDir, d.name, 'SKILL.md')))
    .map((d) => d.name)
}

const listSchema = {
  type: 'object',
  properties: {
    catalog: { type: 'string' },
    remote: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          version: { type: 'string' },
          risk: { type: 'string' },
          summary: { type: 'string' },
          file: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    installed: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: true,
}

const installSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          version: { type: 'string' },
          dest: { type: 'string' },
          ok: { type: 'boolean' },
          error: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
}

export function buildTools(cfg) {
  const listTool = {
    name: 'chengyuan_skill_list',
    description: '列出城院校内 Skill 目录站上已发布、可安装的技能，以及本机 ~/.dsh/skills 已安装的 chengyuan-* 包。需要查看或安装城院教学 skill 时使用。',
    parameters: compileParameters({}),
    output: {
      schema: listSchema,
      render: (_args, value) => {
        const rec = asRecord(value)
        const remote = Array.isArray(rec.remote) ? rec.remote : []
        const installed = Array.isArray(rec.installed) ? rec.installed : []
        const lines = [
          `目录: ${rec.catalog || ''}`,
          `可装 ${remote.length} 个 / 本机已装 ${installed.length} 个`,
        ]
        for (const item of remote) {
          const s = asRecord(item)
          const mark = installed.includes(s.id) ? '已装' : '未装'
          lines.push(`- [${mark}] ${s.id}  ${s.name || ''}  (${s.category || ''} v${s.version || ''})`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute() {
      const catalog = await fetchCatalog(cfg.catalogBaseUrl)
      const remote = listInstallable(catalog, cfg)
      const local = listLocal(cfg)
      return { catalog: cfg.catalogBaseUrl, remote, installed: local }
    },
    timeoutMs: 20000,
  }
  const installTool = {
    name: 'chengyuan_skill_install',
    description: '从城院校内目录站下载已审 skill zip，解压到本机 ~/.dsh/skills/<id>/。只允许 chengyuan-* 已发布条目。安装后需新开 DSH 会话。id 与 category、all 三选一。',
    parameters: compileParameters({
      id: { type: 'string', description: '技能 id，例如 chengyuan-acct-entry-coach' },
      category: { type: 'string', description: '分类，例如 会计 或 通用' },
      all: { type: 'boolean', description: '安装目录站全部已发布城院 skill' },
    }),
    output: {
      schema: installSchema,
      render: (_args, value) => {
        const rec = asRecord(value)
        const results = Array.isArray(rec.results) ? rec.results : []
        const lines = [`安装结果 ${results.length} 项：`]
        for (const item of results) {
          const r = asRecord(item)
          lines.push(r.ok === true
            ? `- 成功 ${r.id} -> ${r.dest || ''}`
            : `- 失败 ${r.id}: ${r.error || ''}`)
        }
        lines.push('装完后请新开 DSH 会话再用这些 skill。')
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(rawArgs) {
      const args = asRecord(rawArgs)
      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : undefined
      const category = typeof args.category === 'string' && args.category.trim() ? args.category.trim() : undefined
      const all = args.all === true || args.all === 'true'
      const results = await installSkills({ cfg, id, category, all })
      return { results }
    },
    timeoutMs: 120000,
  }
  return [listTool, installTool]
}
