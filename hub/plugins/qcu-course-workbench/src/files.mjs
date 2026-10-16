import {constants} from 'node:fs'
import {open,mkdir,lstat,rename,unlink,link,realpath} from 'node:fs/promises'
import {join,resolve,isAbsolute} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {inflateRawSync} from 'node:zlib'
import {check,text} from './protocol.mjs'
export const digest=b=>createHash('sha256').update(b).digest('hex')
export async function directory(path){
 try{await mkdir(path,{mode:0o700})}catch(e){if(e.code!=='EEXIST')throw e}
 const st=await lstat(path);check(st.isDirectory()&&!st.isSymbolicLink(),'unsafe-directory');return path
}
export async function workspaceRoot(root){check(isAbsolute(root),'invalid-workspace');check((await lstat(root)).isDirectory(),'invalid-workspace');return realpath(root)}
export async function readSafe(path,max=4000000){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
 try{const st=await f.stat();check(st.isFile()&&st.size<=max,'unsafe-file');const b=await f.readFile();check(b.length<=max,'file-too-large');return b}finally{await f.close()}
}
export async function atomic(path,bytes,{replace=true}={}){
 const tmp=path+'.partial-'+randomUUID();let f
 try{
  f=await open(tmp,'wx',0o600);await f.writeFile(bytes);await f.sync();await f.close();f=null
  if(replace){try{const s=await lstat(path);check(s.isFile()&&!s.isSymbolicLink(),'unsafe-file')}catch(e){if(e.code!=='ENOENT')throw e}await rename(tmp,path)}
  else await link(tmp,path)
 }finally{await f?.close();await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e})}
}
export const filename=(s,ext)=>{
 const base=text(s,240,true).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/^[. ]+|[. ]+$/g,'').slice(0,100)
 check(base&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base),'invalid-filename');return base+'.'+ext
}
// Bounded ZIP reader: only text XML from the central directory, never extract to paths.
export function zipEntries(bytes){
 check(bytes.length>=22&&bytes.length<=8*1024*1024,'invalid-zip');let end=-1
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break}
 check(end>=0,'invalid-zip');check(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0,'invalid-zip')
 const count=bytes.readUInt16LE(end+10);check(count>0&&count<=2000&&count===bytes.readUInt16LE(end+8),'invalid-zip');let at=bytes.readUInt32LE(end+16),total=0;const result=new Map()
 for(let n=0;n<count;n++){
  check(at+46<=end&&bytes.readUInt32LE(at)===0x02014b50,'invalid-zip')
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),size=bytes.readUInt32LE(at+20),unpacked=bytes.readUInt32LE(at+24),len=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42)
  check(!(flags&1)&&at+46+len+extra+comment<=end&&unpacked<=4000000,'invalid-zip');total+=unpacked;check(total<=16000000,'zip-too-large')
  const name=bytes.subarray(at+46,at+46+len).toString('utf8');check(!result.has(name),'duplicate-zip-entry')
  if(/^(word\/document\.xml|ppt\/slides\/slide\d+\.xml)$/.test(name)){
   check(offset+30<=at&&bytes.readUInt32LE(offset)===0x04034b50,'invalid-zip');const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28)
   check(start+size<=at&&[0,8].includes(method),'invalid-zip');const compressed=bytes.subarray(start,start+size)
   const out=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:4000000});check(out.length===unpacked,'invalid-zip');result.set(name,out.toString('utf8'))
  }else result.set(name,null)
  at+=46+len+extra+comment
 }
 return result
}
const unescapeXml=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[v])).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''})
export function material(name,base64){
 text(name,240,true);check(!/[\/\\]/.test(name),'invalid-filename');check(typeof base64==='string'&&base64.length<=11200000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64),'invalid-file')
 const bytes=Buffer.from(base64,'base64');check(bytes.length>0&&bytes.length<=8*1024*1024,'file-too-large')
 const ext=name.split('.').at(-1).toLowerCase();let content
 if(['txt','md','csv'].includes(ext)){content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
 else if(['docx','pptx'].includes(ext)){
  const entries=[...zipEntries(bytes)].filter(([n,s])=>s!==null).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));check(entries.length>0,'empty-material')
  content=entries.map(([,xml])=>{check(!/<!DOCTYPE|<!ENTITY/i.test(xml),'unsafe-xml');return [...xml.matchAll(/<(?:w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|a):t>/g)].map(m=>unescapeXml(m[1])).join('\n')}).join('\n\n')
 }else check(false,'unsupported-file-use-text')
 content=text(content,60000,true);check(content.replace(/\s/g,'').length>=10,'empty-material')
 return {name,content,sha256:digest(bytes),bytes:bytes.length}
}
export function child(root,name){const p=resolve(root,name);check(p.startsWith(root+'/'),'unsafe-path');return p}
