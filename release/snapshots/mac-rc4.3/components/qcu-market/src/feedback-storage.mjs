// Dedicated immutable intent slots. No update-store allowlist changes or content storage.
import {constants} from 'node:fs'
import {lstat,open,readdir,rename,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {privateDirectory,strictJson} from './catalog-authority.mjs'
import {feedbackCanonical,feedbackNeed,feedbackExact} from './feedback-schema.mjs'
export const feedbackReceiptId=requestId=>createHash('sha256').update('QCU-FEEDBACK/V1:'+requestId).digest('hex')
const slot=i=>'intent-'+String(i).padStart(2,'0')
const check=s=>feedbackNeed(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o777)===0o600&&s.size<=1024,'feedback.store-unsafe')
export function validateFeedbackIntent(r){
 feedbackExact(r,['schema','requestId','receiptId','state','createdAt','marketVersion'])
 feedbackNeed(r.schema===1&&typeof r.requestId==='string'&&/^[a-f0-9]{64}$/.test(r.requestId)&&r.receiptId===feedbackReceiptId(r.requestId)&&r.state==='pending'&&typeof r.marketVersion==='string'&&/^[a-zA-Z0-9.-]{1,80}$/.test(r.marketVersion),'feedback.store-corrupt')
 feedbackNeed(typeof r.createdAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.createdAt)&&Number.isFinite(Date.parse(r.createdAt))&&new Date(r.createdAt).toISOString()===r.createdAt,'feedback.store-corrupt');return r
}
export class FeedbackReceiptJournal{
 constructor(root,{now=()=>Date.now(),waitMs=1000}={}){feedbackNeed(typeof root==='string'&&waitMs>0&&waitMs<=1000,'feedback.store-configuration');this.root=root;this.now=now;this.waitMs=waitMs}
 async ensure(){try{try{await privateDirectory(this.root,{create:true})}catch(e){if(e.code!=='EEXIST')throw e;await privateDirectory(this.root)}}catch{feedbackNeed(false,'feedback.store-unsafe')}}
 async readSlot(i){
  let f
  try{f=await open(join(this.root,slot(i)+'.json'),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);check(await f.stat());const raw=await f.readFile();feedbackNeed(raw.length<=1024,'feedback.store-corrupt');return validateFeedbackIntent(strictJson(raw,1024))}
  catch(e){if(e.code==='ENOENT')return null;if(/^feedback\.store-/.test(e.code??''))throw e;feedbackNeed(false,['ELOOP','EACCES','EPERM'].includes(e.code)?'feedback.store-unsafe':'feedback.store-corrupt')}finally{await f?.close()}
 }
 async list(){
  await this.ensure();const names=await readdir(this.root),records=[];let blocked=false
  feedbackNeed(names.length<=64,'feedback.store-corrupt')
  for(const name of names){feedbackNeed(/^(?:intent-(?:[0-2][0-9]|3[01])\.json|\.intent-(?:[0-2][0-9]|3[01])\.lock)$/.test(name),'feedback.store-corrupt');if(name.endsWith('.lock')){try{check(await lstat(join(this.root,name)));blocked=true}catch(e){if(e.code!=='ENOENT')throw e}}}
  for(let i=0;i<32;i++){const record=await this.readSlot(i);if(record)records.push(record)}
  feedbackNeed(new Set(records.map(r=>r.requestId)).size===records.length,'feedback.store-corrupt')
  return {records,capacity:32,blocked}
 }
 async reserve(requestId,marketVersion,signal){
  const record=validateFeedbackIntent({schema:1,requestId,receiptId:feedbackReceiptId(requestId),state:'pending',createdAt:new Date(this.now()).toISOString(),marketVersion})
  const existing=(await this.list()).records.find(r=>r.requestId===requestId);if(existing)return {record:existing,existing:true}
  const deadline=performance.now()+this.waitMs
  for(let i=0;i<32;i++){
   while(true){
    signal?.throwIfAborted();const old=await this.readSlot(i);if(old){if(old.requestId===requestId)return {record:old,existing:true};break}
    const temporary=join(this.root,'.'+slot(i)+'.lock');let f,owned=false,published=false
    try{
     try{f=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);owned=true}
     catch(e){if(e.code!=='EEXIST')throw e;try{check(await lstat(temporary))}catch(e){if(e.code==='ENOENT')continue;throw e};feedbackNeed(performance.now()<deadline,'feedback.store-busy');await new Promise(r=>setTimeout(r,10));continue}
     // Another writer may have published between our first read and reservation.
     const actual=await this.readSlot(i);if(actual){if(actual.requestId===requestId)return {record:actual,existing:true};break}
     signal?.throwIfAborted();await f.writeFile(Buffer.from(feedbackCanonical(record)));await f.sync();await f.close();f=null
     signal?.throwIfAborted();await rename(temporary,join(this.root,slot(i)+'.json'));published=true
     const dir=await open(this.root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await dir.sync()}finally{await dir.close()}
     return {record,existing:false}
    }finally{await f?.close();if(owned&&!published)await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e})}
   }
  }
  feedbackNeed(false,'feedback.store-full')
 }
}
