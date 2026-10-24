// Presentation metadata only. Historical entries never enter the Host install allowlist.
export const productKindOf=item=>item.capabilities?.[0]==='skill'?'skill':'plugin'
export const productLabelOf=item=>item.id==='qcu-expert-teams'?'专家协作插件':productKindOf(item)==='skill'?'技能':'插件'
export function parseVersionHistory(text){
 const root=JSON.parse(text),origin='http://192.168.1.68:8080',seen=new Set()
 if(!root||root.origin!==origin||typeof root.sourceRevision!=='string'||!Array.isArray(root.entries)||root.entries.length>100)throw Error('Invalid reviewed version history')
 const entries=root.entries.map(e=>{
  if(!e||Object.keys(e).sort().join()!==['id','version','file','bytes','sha256','dshVersions'].sort().join()||!/^qcu-[a-z0-9-]+$/.test(e.id)||!/^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:\.[a-z0-9]+)*)?$/.test(e.version)||!/^[a-f0-9]{64}$/.test(e.sha256)||e.file!==`${e.id}-${e.version}-${e.sha256}.tgz`||!Number.isSafeInteger(e.bytes)||e.bytes<=0||e.bytes>1048576||!Array.isArray(e.dshVersions)||e.dshVersions.length!==1||e.dshVersions[0]!=='0.2.0-rc.2'||seen.has(e.id+'@'+e.version))throw Error('Invalid historical fixed package')
  seen.add(e.id+'@'+e.version);return Object.freeze({...e,dshVersions:Object.freeze([...e.dshVersions]),url:origin+'/plugins/'+e.file})
 })
 return Object.freeze({sourceRevision:root.sourceRevision,entries:Object.freeze(entries)})
}
export const historyFor=(history,id,current)=>history.entries.filter(e=>e.id===id&&e.version!==current).sort((a,b)=>b.version.localeCompare(a.version,'en',{numeric:true}))
export function installedVersionLabel(status){
 if(!status)return '尚未检查'
 if(status.state==='not-installed')return '未安装'
 return typeof status.installedVersion==='string'&&status.installedVersion.length?status.installedVersion:'版本待核对'
}
