import { catalogUrl, pickPublished } from './config.js'

export async function fetchCatalog(catalogBaseUrl, fetchImpl = fetch) {
  const url = catalogUrl(catalogBaseUrl, '/catalog.json')
  const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`读取目录失败 ${res.status} ${url}`)
  const data = await res.json()
  if (!data || typeof data !== 'object') throw new Error('catalog.json 格式无效')
  return data
}

export function listInstallable(catalog, cfg) {
  return pickPublished(catalog, cfg).map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category || '',
    version: s.version || '',
    risk: s.risk || '',
    summary: s.summary || '',
    file: s.file,
  }))
}

export function selectSkills(entries, { id, category, all }) {
  if (all) return entries
  if (category) {
    const picked = entries.filter((s) => s.category === category)
    if (picked.length === 0) throw new Error(`分类「${category}」没有可安装条目`)
    return picked
  }
  if (id) {
    const one = entries.find((s) => s.id === id)
    if (!one) throw new Error(`目录中没有已发布的 ${id}`)
    return [one]
  }
  throw new Error('请指定 skill id、--category 或 --all')
}
