// Strict local data model. This parser does not confer trust on remote JSON.
const catalogOrigin='http://192.168.1.68:8080'
const catalogAssert=(ok,message)=>{if(!ok)throw Error('Catalog: '+message)}
const exact=(value,keys)=>catalogAssert(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join()===keys.slice().sort().join(),'unknown or missing fields')
const plain=(s,max=2000)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
const packageName=s=>typeof s==='string'&&/^qcu-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<100
const versionName=s=>typeof s==='string'&&/^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:\.[a-z0-9]+)*)?$/.test(s)
const shaName=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
export const releaseKeyOf=e=>`${e.id}@${e.version}+${e.sha256}`
export function validateMarketRelease(item){
 const capabilities=item.capabilities
 catalogAssert(['bundle','skill'].includes(item.kind),'unsupported kind')
 catalogAssert(Array.isArray(capabilities)&&capabilities.length===1&&['skill','tools','workbench'].includes(capabilities[0])&&(item.kind!=='skill'||capabilities[0]==='skill'),'unsupported capabilities or kind')
 const e=item.release;exact(e,['id','version','skill','skillSha256','provider','origin','file','bytes','sha256','runtime','releaseStatus','license'])
 catalogAssert(e.id===item.id&&packageName(e.id)&&versionName(e.version),'package identity')
 if(capabilities[0]==='skill')catalogAssert(e.skill===e.id&&shaName(e.skillSha256)&&e.provider===`${e.id}@${e.version}`,'Skill identity')
 else if(capabilities[0]==='workbench')catalogAssert(e.id==='qcu-course-workbench'&&e.skill==='qcu-course-draft'&&shaName(e.skillSha256)&&e.provider===`${e.id}@${e.version}`,'workbench identity')
 else catalogAssert(e.skill===null&&e.skillSha256===null&&e.provider===null,'tools-only release must not claim a Skill or provider')
 catalogAssert(e.origin===catalogOrigin&&e.runtime==='0.2.0-rc.2'&&['MIT','Apache-2.0'].includes(e.license)&&e.releaseStatus==='local-candidate-not-published','source, compatibility or review status')
 catalogAssert(shaName(e.sha256)&&e.file===`${e.id}-${e.version}-${e.sha256}.tgz`,'hash or immutable path')
 catalogAssert(Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=1048576,'package size')
 catalogAssert(e.license===item.provenance.license,'license mismatch')
 return e
}
export function parseMarketCatalog(text){
 catalogAssert(typeof text==='string'&&new TextEncoder().encode(text).length<=262144,'size limit')
 const root=JSON.parse(text);exact(root,['schemaVersion','revision','protocol','entries'])
 catalogAssert(root.schemaVersion===4&&root.protocol===4&&root.revision===6,'schema, protocol or reviewed revision')
 catalogAssert(Array.isArray(root.entries)&&root.entries.length>0&&root.entries.length<=100,'entry count')
 const seen=new Set(),versions=new Set()
 for(const item of root.entries){
  exact(item,['id','title','scenario','purpose','sourceLabel','prerequisites','risk','example','testStatus','kind','capabilities','provenance','release'])
  catalogAssert(packageName(item.id)&&!seen.has(item.id),'duplicate or invalid id');seen.add(item.id)
  for(const k of ['title','scenario','purpose','sourceLabel','prerequisites','risk','example','testStatus'])catalogAssert(plain(item[k]),'invalid display text')
  catalogAssert(['bundle','skill'].includes(item.kind),'unsupported kind')
  const provenance=item.provenance
  exact(provenance,['ownership','author','upstreamSource','pinnedRevision','license','modifications'])
  catalogAssert(['qcu','third-party'].includes(provenance.ownership)&&item.sourceLabel===(provenance.ownership==='qcu'?'QCU自有':'第三方改编'),'source label disagrees with provenance')
  for(const key of ['author','upstreamSource','modifications'])catalogAssert(plain(provenance[key]),'invalid provenance')
  catalogAssert(/^[a-f0-9]{40}$/.test(provenance.pinnedRevision)&&['MIT','Apache-2.0'].includes(provenance.license),'unpinned or unsupported license')
  const e=validateMarketRelease(item)
  catalogAssert(!versions.has(`${e.id}@${e.version}`),'duplicate version');versions.add(`${e.id}@${e.version}`)
  Object.freeze(item.capabilities);Object.freeze(provenance);Object.freeze(e);Object.freeze(item)
 }
 Object.freeze(root.entries);return Object.freeze(root)
}
export function findMarketRelease(catalog,key){const item=catalog.entries.find(i=>releaseKeyOf(i.release)===key);catalogAssert(item,'unreviewed release');return item.release}
