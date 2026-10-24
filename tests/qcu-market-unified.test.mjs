import test from 'node:test'
import assert from 'node:assert/strict'
import {productKindOf,parseVersionHistory,historyFor,installedVersionLabel} from '../hub/plugins/qcu-market/src/version-model.mjs'
import {releaseHistory} from '../hub/plugins/qcu-market/src/reviewed-versions.mjs'
import {bundledCatalog} from '../hub/plugins/qcu-market/src/bundled-catalog.mjs'
import {findMarketRelease,releaseKeyOf} from '../hub/plugins/qcu-market/src/catalog-core.mjs'
import {readProduct} from '../hub/plugins/qcu-market/src/direct-flow.mjs'

test('capabilities give seven Skills and three plugins without changing bundle identities',()=>{
 assert.equal(bundledCatalog.entries.filter(e=>productKindOf(e)==='skill').length,7)
 assert.equal(bundledCatalog.entries.filter(e=>productKindOf(e)==='plugin').length,3)
 const coach=bundledCatalog.entries.find(e=>e.id==='qcu-study-coach')
 assert.equal(coach.kind,'bundle');assert.equal(productKindOf(coach),'skill')
 assert.equal(productKindOf(bundledCatalog.entries.find(e=>e.id==='qcu-course-workbench')),'plugin')
})

test('reviewed history is immutable, version sorted and never grants install authority',()=>{
 assert.ok(Object.isFrozen(releaseHistory.entries))
 assert.equal(releaseHistory.sourceRevision,'pilot-market-p15-2-suite-integration-b')
 assert.equal(releaseHistory.entries.length,23)
 assert.ok(releaseHistory.entries.some(e=>e.id==='qcu-market'&&e.version==='0.1.0-pilot.13.2'))
 assert.ok(releaseHistory.entries.some(e=>e.id==='qcu-course-workbench'&&e.version==='0.1.0-pilot.1.2'))
 assert.ok(releaseHistory.entries.some(e=>e.id==='qcu-market'&&e.version==='0.1.0-pilot.15.1'))
 const versions=historyFor(releaseHistory,'qcu-market','0.1.0-pilot.15.2')
 assert.equal(versions[0].version,'0.1.0-pilot.15.1')
 assert.equal(versions[0].sha256,'6b17dc4a16718ffd39f1c7381f6bde52d78599874f0e06249bad444090705c49')
 assert.equal(versions.find(e=>e.version==='0.1.0-pilot.13.1').sha256,'e17f3d38d7feed0048e19534ed779593e7531122b84265e4f4ca90e40234dbb3')
 assert.throws(()=>findMarketRelease(bundledCatalog,releaseKeyOf(versions[0])),/unreviewed release/)
 assert.ok(versions.findIndex(e=>e.version==='0.1.0-pilot.11.1')<versions.findIndex(e=>e.version==='0.1.0-pilot.9.1'))
 const old=historyFor(releaseHistory,'qcu-study-coach','0.1.0-pilot.2')[0]
 assert.equal(old.version,'0.1.0-pilot.1')
 assert.throws(()=>findMarketRelease(bundledCatalog,releaseKeyOf(old)),/unreviewed release/)
 assert.equal(historyFor(releaseHistory,'qcu-unknown','1.0.0').length,0)
})

for(const [name,mutate] of Object.entries({origin:c=>c.origin='https://wrong.invalid',path:c=>c.entries[0].file='../x.tgz',hash:c=>c.entries[0].sha256='0',size:c=>c.entries[0].bytes=0,unknown:c=>c.entries[0].command='run',duplicate:c=>c.entries.push(c.entries[0]),runtime:c=>c.entries[0].dshVersions=['*']})){
 test('version history rejects '+name,()=>{
  const c={origin:'http://192.168.1.68:8080',sourceRevision:'test',entries:releaseHistory.entries.map(({url,...e})=>({...e,dshVersions:[...e.dshVersions]}))}
  mutate(c);assert.throws(()=>parseVersionHistory(JSON.stringify(c)))
 })
}

test('read-only inventory exposes actual conflicting version, not the catalog version',async()=>{
 const entry=bundledCatalog.entries[0].release,calls=[]
 const manager={listBundles:async()=>{calls.push('list');return {ok:true,value:[{name:entry.id,installed:true,version:'0.1.0-pilot.1',enabled:false}]}}}
 const status=await readProduct(manager,entry)
 assert.equal(status.state,'conflict');assert.equal(installedVersionLabel(status),'0.1.0-pilot.1')
 assert.deepEqual(calls,['list'])
 assert.equal(installedVersionLabel(null),'尚未检查')
 assert.equal(installedVersionLabel({state:'not-installed'}),'未安装')
 assert.equal(installedVersionLabel({state:'component-active'}),'版本待核对')
})

test('ambiguous inventory does not report an invented installed version',async()=>{
 const entry=bundledCatalog.entries[0].release,b={name:entry.id,installed:true,version:entry.version}
 const status=await readProduct({listBundles:async()=>({ok:true,value:[b,b]})},entry)
 assert.equal(status.state,'conflict');assert.equal(status.installedVersion,null)
})
