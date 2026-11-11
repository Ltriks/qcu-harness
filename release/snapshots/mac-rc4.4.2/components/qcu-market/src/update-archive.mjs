// Read ordinary USTAR members only; never extract or execute package content.
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {updateAssert,updateFilePath} from './update-model.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
export function readUpdateArchive(compressed){
 updateAssert(compressed.length<=1048576,'包过大')
 const tar=gunzipSync(compressed,{maxOutputLength:5*1048576}),files=new Map()
 let offset=0,ended=false
 const str=b=>{const i=b.indexOf(0);return b.subarray(0,i<0?b.length:i).toString('utf8')}
 while(offset+512<=tar.length){
  const header=tar.subarray(offset,offset+512);if(header.every(b=>b===0)){ended=true;break}
  const oct=b=>{const s=str(b).trim();updateAssert(/^[0-7]+$/.test(s),'tar数值无效');return parseInt(s,8)}
  const sum=[...header].reduce((n,v,i)=>n+(i>=148&&i<156?32:v),0);updateAssert(sum===oct(header.subarray(148,156)),'tar头校验失败')
  const name=str(header.subarray(0,100)),prefix=str(header.subarray(345,500)),size=oct(header.subarray(124,136))
  updateAssert((header[156]===48||header[156]===0)&&!prefix&&name.startsWith('package/')&&updateFilePath(name.slice(8))&&!files.has(name.slice(8))&&size<=1048576&&files.size<80,'不支持的包成员')
  offset+=512;updateAssert(offset+size<=tar.length,'包不完整');files.set(name.slice(8),tar.subarray(offset,offset+size));offset+=Math.ceil(size/512)*512
 }
 updateAssert(ended&&tar.subarray(offset).every(b=>b===0),'tar结束内容无效')
 return files
}
export function archiveFingerprint(compressed){return [...readUpdateArchive(compressed)].map(([path,b])=>({path,bytes:b.length,sha256:hash(b)})).sort((a,b)=>a.path.localeCompare(b.path))}
export function inspectUpdateArchive(compressed,entry){
 updateAssert(compressed.length===entry.bytes&&hash(compressed)===entry.sha256,'包大小或SHA256不符')
 const files=readUpdateArchive(compressed)
 updateAssert(files.size===entry.files.length&&entry.files.every(f=>files.has(f.path)&&files.get(f.path).length===f.bytes&&hash(files.get(f.path))===f.sha256),'包成员与签名指纹不符')
 const pkg=JSON.parse(files.get('package.json').toString('utf8')),patch=JSON.parse(files.get('cordis.patch.yml').toString('utf8'))
 updateAssert(pkg.name===entry.id&&pkg.version===entry.version&&pkg.type==='module'&&pkg.dsh?.bundle?.patch==='./cordis.patch.yml','包身份或bundle声明不符')
 updateAssert(!['scripts','dependencies','optionalDependencies','bundledDependencies','bundleDependencies','bin','gypfile'].some(k=>pkg[k]!==undefined&&(pkg[k]===null||typeof pkg[k]!=='object'||Array.isArray(pkg[k])||Object.keys(pkg[k]).length!==0)),'包增加了执行脚本或运行依赖，须单独审核')
 updateAssert(JSON.stringify(Object.entries(pkg.peerDependencies??{}).sort())===JSON.stringify(Object.entries(entry.peers).sort()),'peer依赖不符')
 updateAssert(Array.isArray(patch)&&patch.length===1&&Object.keys(patch[0]).join()==='insert'&&Array.isArray(patch[0].insert)&&patch[0].insert.length===1,'多组件或覆盖补丁须单独审核')
 const row=patch[0].insert[0]
 updateAssert(row.id===entry.id&&row.name===entry.id&&Object.keys(row).every(k=>['id','name','disabled','config'].includes(k)),'组件身份变化须单独审核')
 return {name:pkg.name,version:pkg.version,peers:pkg.peerDependencies,components:1,changes:entry.changes}
}
