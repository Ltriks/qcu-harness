// Browsing schema deliberately cannot enter the release/install catalog validator.
export function validateMarket(value) {
  const fail = () => { throw new Error('QCU目录格式无效') }
  const exact = (o, names) => {
    if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).some(k => !names.includes(k))) fail()
  }
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 2000
  exact(value, ['schemaVersion','revision','title','tagline','compatible_dsh','skills','plugins'])
  if (value.schemaVersion !== 1 || !['revision','title','tagline','compatible_dsh'].every(k => text(value[k])) || !Array.isArray(value.skills) || value.skills.length > 100 || !Array.isArray(value.plugins) || value.plugins.length) fail()
  const ids = new Set()
  for (const e of value.skills) {
    exact(e, ['id','name','category','version','summary','source','kind','status','dshVersions','prerequisites','testStatus','risk','example','origin','license'])
    if (!['id','name','category','version','summary','prerequisites','testStatus','risk','example','origin','license'].every(k => text(e[k]))) fail()
    if (!/^(qcu-[a-z0-9-]+|office-(pptx|docx|xlsx))$/.test(e.id) || ids.has(e.id)) fail()
    ids.add(e.id)
    if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(e.version)) fail()
    if (!Array.isArray(e.dshVersions) || e.dshVersions.length !== 1 || e.dshVersions[0] !== '0.2.0-rc.2') fail()
    if (e.source === 'DSH官方') {
      if (!/^office-(pptx|docx|xlsx)$/.test(e.id) || e.kind !== 'builtin-guidance' || e.status !== 'builtin-unverified') fail()
    } else if (e.source !== 'QCU自有' || !e.id.startsWith('qcu-') || e.kind !== 'skill' || !['draft','not-installed'].includes(e.status)) fail()
  }
  return value
}

export function loadMarket(source) {
  try {
    // This release has no remote transport. Even an injected URL is never fetched.
    if (source.kind !== 'bundled') throw new Error('remote-disabled')
    return { state: 'ready', catalog: validateMarket(source.value) }
  } catch {
    return { state: 'offline', message: '目录加载失败或来源未获信任。当前离线；远程目录尚未接通。' }
  }
}

export async function copyExample(text, clipboard) {
  try {
    if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('clipboard-unavailable')
    await clipboard.writeText(text)
    return '已复制示例；请自行粘贴到对话。'
  } catch {
    return '复制失败；请选中下方示例文字手动复制。'
  }
}

export function filterMarketEntries(entries, category, query) {
  const term = query.trim().toLocaleLowerCase()
  return entries.filter(e => (category === '全部' || e.category === category)
    && (!term || [e.name, e.summary, e.category, e.id].some(value => value.toLocaleLowerCase().includes(term))))
}
