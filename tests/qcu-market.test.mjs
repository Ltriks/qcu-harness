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
test('compiled Client registers lazy factory with only host React; Host exports no tools', async () => {
  let loaded
  vm.runInNewContext(await read('hub/plugins/qcu-market/client.js'), {window:{__ModuleLoader__:{load:m=>loaded=m}}})
  assert.equal(loaded.id,'qcu-market')
  const imports=[]; const p=loaded.factory(name=>{imports.push(name);return {createElement(){}}})
  assert.deepEqual(imports,['react']); assert.deepEqual(Array.from(p.inject),['slots','layout'])
  const host=await import('../hub/plugins/qcu-market/index.js')
  assert.deepEqual(Object.keys(host),['apply']); assert.equal(host.apply(),undefined)
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
  const cardElement=flatten(Main({onBack(){}})).find(n=>typeof n.type==='function')
  const card=cardElement.type(cardElement.props)
  const button=flatten(card).find(n=>n.type==='button'&&n.children.includes('复制示例'))
  const first=button.props.onClick();await button.props.onClick()
  assert.equal(calls,1);assert.equal(writes,1)
  for(const cleanup of cleanups)cleanup()
  resolveCopy();await first
  assert.equal(writes,1)
})
test('bundle defaults disabled, export closure exists and no executable installer surface is included', async () => {
  const pkg=JSON.parse(await read('hub/plugins/qcu-market/package.json'))
  const patch=JSON.parse(await read('hub/plugins/qcu-market/cordis.patch.yml'))
  assert.equal(patch[0].insert[0].disabled,true)
  for(const p of Object.values(pkg.exports))await read('hub/plugins/qcu-market/'+p)
  for(const p of pkg.files)await read('hub/plugins/qcu-market/'+p)
  const code=await read('hub/plugins/qcu-market/client.js')
  assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|WebSocket|eval\(|innerHTML|child_process|apiKey|modelKey/)
})
