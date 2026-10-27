// Bounded static inspection only. Never extracts, imports or executes package code.
import {readUpdateArchive,archiveFingerprint,inspectUpdateArchive} from '../hub/plugins/qcu-market/src/update-archive.mjs'
const need=(v,m)=>{if(!v)throw Error('archive.'+m)}
export function archiveJson(bytes){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let p=0
 const ws=()=>{while(/\s/.test(text[p]??'')&&p<text.length)p++}
 const string=()=>{const start=p;need(text[p++]==='"','json');let escape=false;for(;p<text.length;p++){const c=text[p];if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c==='"'){p++;return JSON.parse(text.slice(start,p))}}throw Error('archive.json')}
 const value=depth=>{
  need(depth<=20,'json-depth');ws();const c=text[p]
  if(c==='{'){p++;ws();const seen=new Set();if(text[p]==='}'){p++;return}while(true){ws();const key=string();need(!seen.has(key),'json-duplicate');seen.add(key);ws();need(text[p++]===':','json');value(depth+1);ws();if(text[p]==='}'){p++;return}need(text[p++]===',','json')}}
  else if(c==='['){p++;ws();if(text[p]===']'){p++;return}while(true){value(depth+1);ws();if(text[p]===']'){p++;return}need(text[p++]===',','json')}}
  else if(c==='"')string()
  else{const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p));need(match,'json');p+=match[0].length}
 }
 value(0);ws();need(p===text.length,'json-trailing');return JSON.parse(text)
}
export function inspectProductArchive(raw,expected,{policy,branding=false,inventory}={}){
 const files=readUpdateArchive(raw),pkg=archiveJson(files.get('package.json')??Buffer.alloc(0)),patch=archiveJson(files.get('cordis.patch.yml')??Buffer.alloc(0))
 need(pkg.name===expected.id&&pkg.version===expected.version&&pkg.type==='module'&&pkg.dsh?.bundle?.patch==='./cordis.patch.yml','identity')
 for(const key of ['scripts','dependencies','optionalDependencies','bundledDependencies','bundleDependencies','bin','gypfile'])need(pkg[key]===undefined||(pkg[key]&&typeof pkg[key]==='object'&&!Array.isArray(pkg[key])&&Object.keys(pkg[key]).length===0),'execution-surface')
 const peers=pkg.peerDependencies??{};need(peers&&Object.getPrototypeOf(peers)===Object.prototype,'peers')
 if(branding){
  need(Object.keys(peers).length===0&&['LICENSE','client.js','cordis.patch.yml','icon.svg','index.js','package.json'].sort().join()===[...files.keys()].sort().join(),'branding-members')
  need(JSON.stringify(patch)===JSON.stringify([{id:'ui-brand-official',disabled:true},{id:'ui-sidebar',disabled:true},{insert:[{id:'qcu-branding',name:'qcu-branding'}]}]),'branding-patch')
 }else{
  need(Array.isArray(pkg.files)&&pkg.files.every(p=>typeof p==='string')&&new Set(pkg.files).size===pkg.files.length,'members')
  need([...new Set(['package.json',...pkg.files])].sort().join()===[...files.keys()].sort().join(),'members')
  const known=policy?.products?.[pkg.name]
  if(known)need(Object.entries(peers).every(([k,v])=>known.peers[k]===v),'policy-peers')
  need(Array.isArray(patch)&&patch.length===1&&Object.keys(patch[0]).join()==='insert'&&Array.isArray(patch[0].insert)&&patch[0].insert.length===1,'components')
  const row=patch[0].insert[0];need(row.id===pkg.name&&row.name===pkg.name&&Object.keys(row).every(k=>['id','name','disabled','config'].includes(k)),'components')
 }
 const checkExport=value=>{
  if(typeof value==='string'){need(value.startsWith('./'),'export-path');const path=value.slice(2);if(path.includes('*')){for(const language of ['zh','en'])need(files.has(path.replaceAll('*',language)),'export-path')}else need(files.has(path),'export-path')}
  else{need(value&&typeof value==='object','exports');for(const child of Object.values(value))checkExport(child)}
 }
 checkExport(pkg.exports);need(files.has(pkg.dsh.bundle.patch.slice(2)),'patch')
 const actual=archiveFingerprint(raw)
 if(inventory)need(actual.length===inventory.length&&inventory.every(row=>actual.some(a=>a.path===row.path.replace(/^package\//,'')&&a.bytes===row.bytes&&a.sha256===row.sha256)),'inventory')
 if(expected.files)inspectUpdateArchive(raw,expected)
 return {id:pkg.name,version:pkg.version,memberCount:files.size,files:actual,peers}
}
