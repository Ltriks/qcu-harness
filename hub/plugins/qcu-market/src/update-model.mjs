// Shared bounded update data. Trust is established by the Host signature verifier.
import {updatePolicy,expertUpdatePolicy,legacyUpdatePolicy} from './update-policy.mjs'
// Public key injection is limited to existing ephemeral-key test interfaces.
// Projection capability depends on exact frozen identities, capabilities and peers.
export function sameUpdateProducts(actual,expected){
 return Boolean(actual&&Object.keys(actual).sort().join()===Object.keys(expected).sort().join()&&Object.entries(expected).every(([id,p])=>actual[id]&&Object.keys(actual[id]).sort().join()===Object.keys(p).sort().join()&&actual[id].capability===p.capability&&Object.keys(actual[id].peers??{}).sort().join()===Object.keys(p.peers).sort().join()&&Object.entries(p.peers).every(([k,v])=>actual[id].peers[k]===v)))
}
export const readingProjectionCapable=policy=>sameUpdateProducts(policy?.products,updatePolicy.products)
export const expertProjectionCapable=policy=>sameUpdateProducts(policy?.products,expertUpdatePolicy.products)||readingProjectionCapable(policy)
export const updateProjections=Object.freeze({
 legacy:Object.freeze({file:'updates.json',channel:'pilot',state:'state.json',products:legacyUpdatePolicy.products}),
 v2:Object.freeze({file:'updates-v2.json',channel:'pilot-experts',state:'state-v2.json',products:expertUpdatePolicy.products}),
 v3:Object.freeze({file:'updates-v3.json',channel:'pilot-reading',state:'state-v3.json',products:updatePolicy.products})
})
export const updateOrigin='http://192.168.1.68:8080'
export const updateAssert=(ok,message)=>{if(!ok)throw Error('更新检查：'+message)}
export const updateExact=(obj,keys)=>updateAssert(obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join()===keys.slice().sort().join(),'字段不符')
const versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
export function compareUpdateVersions(a,b){
 const parse=v=>{const m=versionPattern.exec(v);updateAssert(m&&m.slice(1,4).every(n=>Number.isSafeInteger(Number(n))),'版本号无效');const p=m[4]?.split('.')??[];updateAssert(p.every(s=>!/^\d+$/.test(s)||s==='0'||!s.startsWith('0')),'预发布版本号无效');return [...m.slice(1,4).map(Number),p]}
 const x=parse(a),y=parse(b)
 for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1
 if(!x[3].length||!y[3].length)return x[3].length===y[3].length?0:x[3].length?-1:1
 for(let i=0;i<Math.max(x[3].length,y[3].length);i++){
  const p=x[3][i],q=y[3][i];if(p===q)continue;if(p===undefined||q===undefined)return p===undefined?-1:1
  const pn=/^\d+$/.test(p),qn=/^\d+$/.test(q)
  if(pn&&qn)return p.length===q.length?(p>q?1:-1):p.length>q.length?1:-1
  return pn!==qn?pn?-1:1:p>q?1:-1
 }return 0
}
export const updateFilePath=p=>typeof p==='string'&&p.length<=180&&(/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.(?:m?js|cjs|json|md|ya?ml|svg|txt)$/.test(p)||['LICENSE','NOTICE','WRAPPER-LICENSE'].includes(p))&&!p.split('/').some(s=>s==='.'||s==='..'||s===''||s==='node_modules')
export function parseUpdatePayload(payload,policy,now=Date.now()){
 updateAssert(typeof payload==='string'&&new TextEncoder().encode(payload).length<=262144,'清单过大')
 const feed=JSON.parse(payload);updateExact(feed,['schemaVersion','channel','revision','issuedAt','expiresAt','entries'])
 updateAssert(feed.schemaVersion===1&&(feed.channel==='pilot'||(feed.channel==='pilot-experts'&&expertProjectionCapable(policy))||(feed.channel==='pilot-reading'&&readingProjectionCapable(policy)))&&Number.isSafeInteger(feed.revision)&&feed.revision>0,'更新清单版本或通道不符')
 const issued=Date.parse(feed.issuedAt),expires=Date.parse(feed.expiresAt)
 updateAssert(typeof feed.issuedAt==='string'&&typeof feed.expiresAt==='string'&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+300000&&expires>now&&expires>issued&&expires-issued<=30*86400000,'更新清单未生效或已过期，请联系发布者更新清单')
 updateAssert(Array.isArray(feed.entries)&&feed.entries.length>0&&feed.entries.length<=60,'更新清单数量无效')
 const products=feed.channel==='pilot-experts'?expertUpdatePolicy.products:feed.channel==='pilot'&&expertProjectionCapable(policy)?legacyUpdatePolicy.products:policy.products
 const seen=new Set()
 for(const e of feed.entries){
  updateExact(e,['id','version','file','sha256','bytes','runtime','capability','changes','upgradePolicy','withdrawn','files','peers'])
  updateAssert(e.id!=='qcu-reading'||feed.channel==='pilot-reading'&&readingProjectionCapable(policy),'产品或能力类别未获支持')
  const known=products[e.id];updateAssert(known&&known.capability===e.capability,'产品或能力类别未获支持')
  compareUpdateVersions(e.version,e.version)
  updateAssert(!seen.has(e.id+'@'+e.version),'重复版本');seen.add(e.id+'@'+e.version)
  updateAssert(/^[a-f0-9]{64}$/.test(e.sha256)&&e.file===`${e.id}-${e.version}-${e.sha256}.tgz`&&Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=1048576,'固定包地址、大小或校验信息无效')
  updateAssert(typeof e.runtime==='string'&&versionPattern.test(e.runtime)&&typeof e.withdrawn==='boolean','兼容性或撤回标记无效')
  updateAssert(typeof e.changes==='string'&&e.changes.length>0&&e.changes.length<=2000&&!/[\u0000-\u001f]/.test(e.changes),'更新说明无效')
  updateAssert(['preserve-config-no-migration','manual-review'].includes(e.upgradePolicy),'升级策略无效')
  updateAssert(e.peers&&typeof e.peers==='object'&&!Array.isArray(e.peers)&&Object.entries(e.peers).every(([k,v])=>known.peers[k]===v),'新增或改变依赖需要单独审核')
  if(['qcu-expert-teams','qcu-reading'].includes(e.id))updateAssert(Object.keys(e.peers).length===Object.keys(known.peers).length,'插件依赖必须与固定策略完全一致')
  updateAssert(Array.isArray(e.files)&&e.files.length>0&&e.files.length<=80,'包文件清单无效')
  const files=new Set();let total=0
  for(const f of e.files){updateExact(f,['path','bytes','sha256']);updateAssert(updateFilePath(f.path)&&!files.has(f.path)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=1048576&&/^[a-f0-9]{64}$/.test(f.sha256),'包文件指纹无效');files.add(f.path);total+=f.bytes}
  updateAssert(total<=4194304&&['package.json','cordis.patch.yml'].every(p=>files.has(p)),'包文件不完整或过大')
 }
 return feed
}
export const updateReleaseKey=e=>`${e.id}@${e.version}+${e.sha256}`
export function updateCandidate(entries,id,installed,runtime){
 const all=entries.filter(e=>e.id===id&&!e.withdrawn).sort((a,b)=>compareUpdateVersions(b.version,a.version))
 const latest=all.find(e=>e.runtime===runtime)
 if(!latest)return {state:'incompatible',target:null,latest:all[0]?.version??null}
 if(!installed)return {state:'not-installed',target:null,latest:latest.version}
 const newer=compareUpdateVersions(latest.version,installed)>0
 return {state:newer?(latest.upgradePolicy==='manual-review'?'manual-review':'available'):'current',target:newer?latest:null,latest:latest.version}
}
