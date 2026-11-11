import {mkdir,lstat,open,rename,unlink} from 'node:fs/promises'
import {constants} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {updateAssert} from './update-model.mjs'
export async function ownedUpdateDir(path){
 await mkdir(path,{recursive:true,mode:0o700})
 const s=await lstat(path);updateAssert(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid(),'缓存目录不安全');return path
}
export async function regularUpdateBytes(path,cap){
 const s=await lstat(path);updateAssert(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&s.size<=cap,'文件不安全或过大')
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
 try{const actual=await file.stat();updateAssert(actual.ino===s.ino&&actual.dev===s.dev&&actual.size===s.size,'文件已变化');const bytes=await file.readFile();updateAssert(bytes.length===s.size,'文件已变化');return bytes}finally{await file.close()}
}
export class UpdateStorage{
 constructor(root){this.root=root}
 async read(name){
  updateAssert(['state.json','state-v2.json','journal.json'].includes(name),'未知缓存名');await ownedUpdateDir(this.root)
  try{return JSON.parse((await regularUpdateBytes(join(this.root,name),1048576)).toString('utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}
 }
 async write(name,value){
  updateAssert(['state.json','state-v2.json','journal.json'].includes(name),'未知缓存名');await ownedUpdateDir(this.root)
  const path=join(this.root,name),temp=join(this.root,'.partial-'+randomUUID()),bytes=Buffer.from(JSON.stringify(value))
  updateAssert(bytes.length<=1048576,'缓存数据过大')
  try{await regularUpdateBytes(path,1048576)}catch(e){if(e.code!=='ENOENT')throw e}
  let f
  try{f=await open(temp,'wx',0o600);await f.writeFile(bytes);await f.sync();await f.close();f=null;await rename(temp,path)}finally{await f?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e})}
 }
}
