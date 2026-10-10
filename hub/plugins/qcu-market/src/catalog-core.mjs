// Strict local data model. This parser does not confer trust on remote JSON.
const catalogOrigin='http://192.168.1.68:8080'
const catalogAssert=(ok,message)=>{if(!ok)throw Error('Catalog: '+message)}
const exact=(value,keys)=>catalogAssert(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join()===keys.slice().sort().join(),'unknown or missing fields')
const plain=(s,max=2000)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
const packageName=s=>typeof s==='string'&&/^qcu-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<100
const versionName=s=>typeof s==='string'&&/^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:\.[a-z0-9]+)*)?$/.test(s)
const shaName=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
export const releaseKeyOf=e=>`${e.id}@${e.version}+${e.sha256}`
export function parseMarketCatalog(text){
 catalogAssert(typeof text==='string'&&new TextEncoder().encode(text).length<=262144,'size limit')
 const root=JSON.parse(text);exact(root,['schemaVersion','revision','protocol','entries'])
 catalogAssert(root.schemaVersion===2&&root.protocol===2&&Number.isSafeInteger(root.revision)&&root.revision>0,'schema or revision')
 catalogAssert(Array.isArray(root.entries)&&root.entries.length>0&&root.entries.length<=100,'entry count')
 const seen=new Set(),versions=new Set()
 for(const item of root.entries){
  exact(item,['id','title','scenario','purpose','sourceLabel','prerequisites','risk','example','testStatus','kind','release'])
  catalogAssert(packageName(item.id)&&!seen.has(item.id),'duplicate or invalid id');seen.add(item.id)
  for(const k of ['title','scenario','purpose','sourceLabel','prerequisites','risk','example','testStatus'])catalogAssert(plain(item[k]),'invalid display text')
  catalogAssert(item.kind==='bundle'&&item.sourceLabel==='QCU自有','unsupported source or kind')
  const e=item.release;exact(e,['id','version','skill','skillSha256','provider','origin','file','bytes','sha256','runtime','releaseStatus','license'])
  catalogAssert(e.id===item.id&&e.skill===e.id&&versionName(e.version)&&e.provider===`${e.id}@${e.version}`,'package identity')
  catalogAssert(e.origin===catalogOrigin&&e.runtime==='0.2.0-rc.2'&&e.license==='MIT'&&e.releaseStatus==='local-candidate-not-published','source, compatibility or review status')
  catalogAssert(shaName(e.sha256)&&shaName(e.skillSha256)&&e.file===`${e.id}-${e.version}-${e.sha256}.tgz`,'hash or immutable path')
  catalogAssert(Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=1048576,'package size')
  catalogAssert(!versions.has(`${e.id}@${e.version}`),'duplicate version');versions.add(`${e.id}@${e.version}`)
  Object.freeze(e);Object.freeze(item)
 }
 Object.freeze(root.entries);return Object.freeze(root)
}
export function findMarketRelease(catalog,key){const item=catalog.entries.find(i=>releaseKeyOf(i.release)===key);catalogAssert(item,'unreviewed release');return item.release}
