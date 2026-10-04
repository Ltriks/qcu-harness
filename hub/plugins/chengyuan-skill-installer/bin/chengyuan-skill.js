#!/usr/bin/env node
import { DEFAULT_CATALOG_URL, resolveConfig } from '../lib/config.js'
import { fetchCatalog, listInstallable } from '../lib/catalog.js'
import { installSkills, listLocal } from '../lib/install.js'

function usage() {
  return `城院 Skill 安装器

每位师生在本机运行 DSH Web（http://127.0.0.1:3080），
从共用局域网目录站下载技能，安装到本机技能目录。

用法:
  chengyuan-skill list
  chengyuan-skill install <id>
  chengyuan-skill install --category 会计
  chengyuan-skill install --all

环境变量:
  CHENGYUAN_CATALOG_URL   覆盖目录站，默认 ${DEFAULT_CATALOG_URL}
  CHENGYUAN_SKILLS_DIR    默认 ~/.dsh/skills
  DSH_HOME                默认 ~/.dsh
`
}

async function main(argv) {
  const cfg = resolveConfig({})
  const cmd = argv[0]
  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(usage())
    return
  }
  if (cmd === 'list') {
    const catalog = await fetchCatalog(cfg.catalogBaseUrl)
    const remote = listInstallable(catalog, cfg)
    const local = listLocal(cfg)
    process.stdout.write(`目录: ${cfg.catalogBaseUrl}\n可装 ${remote.length} 个 / 本机已装 ${local.length} 个\n`)
    for (const s of remote) {
      const mark = local.includes(s.id) ? '已装' : '未装'
      process.stdout.write(`- [${mark}] ${s.id}  ${s.name}  (${s.category} v${s.version})\n`)
    }
    return
  }
  if (cmd === 'install') {
    const rest = argv.slice(1)
    const all = rest.includes('--all')
    const catIdx = rest.indexOf('--category')
    const category = catIdx >= 0 ? rest[catIdx + 1] : undefined
    const id = rest.find((a) => !a.startsWith('--') && a !== category)
    const results = await installSkills({ cfg, id, category, all })
    for (const r of results) {
      if (r.ok) process.stdout.write(`已安装 ${r.id} -> ${r.dest}\n`)
      else process.stdout.write(`失败 ${r.id}: ${r.error}\n`)
    }
    if (results.some((r) => !r.ok)) process.exitCode = 1
    else process.stdout.write('安装完成。请新开 DSH 会话后再用这些 skill。\n')
    return
  }
  throw new Error(usage())
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n')
  process.exit(1)
})
