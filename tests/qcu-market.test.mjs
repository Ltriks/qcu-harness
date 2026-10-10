import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { validateMarket, loadMarket, copyExample } from '../hub/plugins/qcu-market/src/catalog.mjs'
import { createMarketPlugin } from '../hub/plugins/qcu-market/src/plugin.mjs'
const root = new URL('../', import.meta.url)
const read = p => readFile(new URL(p, root), 'utf8')
const catalog = JSON.parse(await read('hub/market/catalog.json'))

test('catalog has six scenes, five owned drafts and three unverified official capabilities', () => {
  assert.equal(validateMarket(catalog), catalog)
  assert.equal(new Set(catalog.skills.map(e => e.category)).size, 6)
  assert.equal(catalog.skills.filter(e => e.status === 'draft').length, 5)
  assert.equal(catalog.skills.filter(e => e.status === 'builtin-unverified').length, 3)
})
test('unknown fields, installed claims, bad dependency/version/source and duplicates fail closed', () => {
  for (const mutate of [c => c.skills[0].status = 'installed', c => c.skills[0].install = 'curl bad', c => c.skills[0].dshVersions = ['>=0'], c => c.skills[0].source = 'DSH官方', c => c.skills.push(c.skills[0]), c => c.plugins.push({}), c => c.skills[0].prerequisites = '']) {
    const c = structuredClone(catalog); mutate(c)
    assert.equal(loadMarket({kind:'bundled',value:c}).state, 'offline')
  }
})
test('missing/malformed/remote sources stay offline without network calls', () => {
  assert.equal(loadMarket({kind:'bundled', value:null}).state, 'offline')
  assert.equal(loadMarket({kind:'remote', url:'https://untrusted.invalid/'}).state, 'offline')
  assert.equal(loadMarket(null).state, 'offline')
})
test('copy reports actual success, denial, absent clipboard with manual fallback', async () => {
  let text
  assert.match(await copyExample('示例',{writeText: async t => {text=t}}), /已复制/)
  assert.equal(text,'示例')
  assert.match(await copyExample('x',{writeText: async () => {throw Error('denied')}}), /复制失败/)
  assert.match(await copyExample('x',undefined), /手动复制/)
})
test('every owned draft is UTF-8, properly named and ships original license; adaptations retain source hashes', async () => {
  for (const e of catalog.skills.filter(e => e.source==='QCU自有')) {
    const body=await read(e.origin)
    assert.ok(body.includes(`name: ${e.id}`)); assert.ok(!body.includes('\ufffd'))
    assert.equal(await read(`skills/${e.id}/LICENSE`),await read('LICENSE'))
    if (['qcu-note-organizer','qcu-reading-outline','qcu-integrity-guard'].includes(e.id)) {
      const source=JSON.parse(await read(`skills/${e.id}/SOURCE.json`))
      assert.equal(createHash('sha256').update(await read(source.source)).digest('hex'),source.sourceSha256)
    }
  }
  assert.match(await read('skills/qcu-integrity-guard/SKILL.md'),/不作学生处分判断/)
})
test('compiled Client registers lazy factory with only host React; Host exposes only bounded operations', async () => {
  let loaded
  vm.runInNewContext(await read('hub/plugins/qcu-market/client.js'), {window:{__ModuleLoader__:{load:m=>loaded=m}}})
  assert.equal(loaded.id,'qcu-market')
  const imports=[]; const p=loaded.factory(name=>{imports.push(name);return {createElement(){}}})
  assert.deepEqual(imports,['react']); assert.deepEqual(Array.from(p.inject),['slots','layout'])
  const host=await read('hub/plugins/qcu-market/index.js')
  assert.doesNotMatch(host,/installBundle|setBundleEnabled|setPluginEnabled|removeBundle/)
  assert.match(host,/PackagePreparation/)
})
test('missing dependencies fail explicitly and only approved slots are requested', () => {
  const p=createMarketPlugin({createElement(){}},{kind:'bundled',value:catalog})
  assert.throws(()=>p.apply({}),/需要官方/)
  const entries=[]; const disposers=[]
  p.apply({layout:{selectPanel(){}},slots:{inject:(name,cb)=>disposers.push(cb()),register:(o,c)=>{entries.push(o);return ()=>entries.splice(entries.indexOf(o),1)}}})
  assert.deepEqual(entries.map(e=>e.name),['main','sidebar.panellist'])
  assert.equal(entries[0].key,entries[1].id)
  for(const dispose of disposers.reverse())dispose()
  assert.equal(entries.length,0)
})
test('copy button coalesces rapid clicks and ignores async completion after unmount', async () => {
  let resolveCopy, calls=0, writes=0
  const cleanups=[]
  const React={
    createElement:(type,props,...children)=>({type,props:props??{},children}), Fragment:'fragment',
    useState:initial=>[initial,()=>{writes++}],useRef:value=>({current:value}),
    useEffect:fn=>{cleanups.push(fn())},
  }
  const p=createMarketPlugin(React,{kind:'bundled',value:catalog},{writeText:()=>{calls++;return new Promise(r=>resolveCopy=r)}})
  let Main
  p.apply({layout:{selectPanel(){}},slots:{inject:(name,fn)=>fn(),register:(o,c)=>{if(o.name==='main')Main=c;return ()=>{}}}})
  const flatten=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flatten)]
  const cardElement=flatten(Main({onBack(){}})).find(n=>typeof n.type==='function'&&n.props.entry)
  const card=cardElement.type(cardElement.props)
  const button=flatten(card).find(n=>n.type==='button'&&n.children.includes('复制示例'))
  const first=button.props.onClick();await button.props.onClick()
  assert.equal(calls,1);assert.equal(writes,1)
  for(const cleanup of cleanups)cleanup()
  resolveCopy();await first
  assert.equal(writes,1)
})
test('bundle defaults disabled, export closure exists and no embedded installer scripts, network primitives or model credentials', async () => {
  const pkg=JSON.parse(await read('hub/plugins/qcu-market/package.json'))
  const patch=JSON.parse(await read('hub/plugins/qcu-market/cordis.patch.yml'))
  assert.equal(patch[0].insert[0].disabled,true)
  for(const p of Object.values(pkg.exports)){
    if(p.includes('*')){for(const language of ['zh','en'])await read('hub/plugins/qcu-market/'+p.replace('*',language))}
    else await read('hub/plugins/qcu-market/'+p)
  }
  for(const p of pkg.files)await read('hub/plugins/qcu-market/'+p)
  const code=await read('hub/plugins/qcu-market/client.js')
  assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|WebSocket|eval\(|innerHTML|child_process|apiKey|modelKey/)
})
test('p2 separates official usage from drafts and removes fake installation controls', async () => {
  // Structural component test independent of optional renderer availability.
  const React={createElement:(type,props,...children)=>({type,props:props??{},children}),Fragment:'fragment',useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect(){}}
  let Main
  createMarketPlugin(React,{kind:'bundled',value:catalog}).apply({layout:{selectPanel(){}},slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.name==='main')Main=c;return ()=>{}}}})
  const expand=n=>!n||typeof n!=='object'?n:typeof n.type==='function'?expand(n.type(n.props)):{...n,children:n.children.map(expand)}
  const tree=expand(Main({onBack(){}}))
  const flat=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flat)]
  const nodes=flat(tree)
  assert.equal(nodes.filter(n=>n.type==='summary'&&n.children.includes('查看用法')).length,3)
  assert.equal(nodes.filter(n=>n.type==='summary'&&n.children.includes('了解草案')).length,5)
  assert.equal(nodes.filter(n=>n.type==='button'&&n.props.disabled).length,0)
  assert.ok(!JSON.stringify(tree).includes('安装 / 启用 / 升级'))
  assert.ok(nodes.filter(n=>n.type==='svg').length>=16)
  assert.ok(nodes.filter(n=>n.type==='svg').every(n=>n.props['aria-hidden']===true&&n.props.focusable===false))
  assert.equal(nodes.filter(n=>n.type==='article'&&n.props['aria-labelledby']).length,8)
  assert.equal(nodes.filter(n=>n.type==='style').length,1)
})
test('scene filters update visible cards and retain native keyboard button semantics', () => {
  let category='全部',Main
  const React={createElement:(type,props,...children)=>({type,props:props??{},children}),Fragment:'fragment',useState:initial=>initial==='全部'?[category,v=>{category=v}]:['',()=>{}]}
  createMarketPlugin(React,{kind:'bundled',value:catalog}).apply({layout:{selectPanel(){}},slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.name==='main')Main=c;return ()=>{}}}})
  const flat=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flat)]
  let nodes=flat(Main({onBack(){}}))
  nodes.find(n=>n.type==='button'&&n.children.includes('课件制作')).props.onClick()
  nodes=flat(Main({onBack(){}}))
  assert.equal(nodes.filter(n=>n.props.entry).length,1)
  assert.equal(nodes.find(n=>n.props.entry).props.entry.id,'office-pptx')
  assert.equal(nodes.find(n=>n.type==='button'&&n.children.includes('课件制作')).props['aria-pressed'],true)
})
test('p2 styles are locally scoped, semantic-token based, focusable and network free; package icon metadata exists', async () => {
  const {marketStyles}=await import('../hub/plugins/qcu-market/src/styles.mjs')
  assert.match(marketStyles,/:focus-visible/)
  assert.match(marketStyles,/--dsw-alias-bg-base/)
  assert.match(marketStyles,/--dsw-alias-label-primary/)
  assert.doesNotMatch(marketStyles,/#(?:[a-fA-F0-9]{3})\b|rgba?\(|url\(|@import|@font-face|:root|document\.body/)
  const selectors=marketStyles.split('{').slice(0,-1).map(x=>x.slice(x.lastIndexOf('}')+1).trim()).filter(x=>x&&!x.startsWith('@media'))
  assert.ok(selectors.every(x=>x.startsWith('.qcu-market')))
  const pkg=JSON.parse(await read('hub/plugins/qcu-market/package.json'))
  assert.equal(pkg.version,'0.1.0-pilot.4.1')
  assert.equal(pkg.icon,'./icon.svg')
  const svg=await read('hub/plugins/qcu-market/icon.svg')
  assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|href=|onload=|<foreignObject/)
  for(const lang of ['zh','en'])assert.ok(JSON.parse(await read(`hub/plugins/qcu-market/locale/${lang}.json`)).meta.title)
})
test('local search combines with category and handles blank, case-insensitive and zero-result queries', async () => {
  const {filterMarketEntries}=await import('../hub/plugins/qcu-market/src/catalog.mjs')
  assert.equal(filterMarketEntries(catalog.skills,'全部','  ').length,8)
  assert.equal(filterMarketEntries(catalog.skills,'全部','OFFICE-PPTX')[0].id,'office-pptx')
  assert.equal(filterMarketEntries(catalog.skills,'课件制作','百分比').length,0)
  assert.equal(filterMarketEntries(catalog.skills,'备课与课堂活动','分层')[0].id,'qcu-tiered-practice')
  assert.equal(filterMarketEntries(catalog.skills,'全部','不存在的课程').length,0)
})
test('compiled p2 carries the exact styles and icon vectors with no separate stylesheet fetch', async () => {
  const {marketStyles}=await import('../hub/plugins/qcu-market/src/styles.mjs')
  const {iconPaths}=await import('../hub/plugins/qcu-market/src/icons.mjs')
  const compiled=await read('hub/plugins/qcu-market/client.js')
  assert.ok(compiled.includes(marketStyles))
  assert.match(compiled,/h\('style',\s*null,marketStyles\)/)
  for(const paths of Object.values(iconPaths))for(const path of paths)assert.ok(compiled.includes(path))
  assert.doesNotMatch(compiled,/rel:\s*['"]stylesheet|<link|@import|fetch\(/)
})
