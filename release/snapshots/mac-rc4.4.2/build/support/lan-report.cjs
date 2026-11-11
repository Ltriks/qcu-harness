'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validReport}=require('./incidents.cjs');
const ORIGIN='http://192.168.1.68:18768';
function privateRoot(root){
 if(!path.isAbsolute(root)||path.resolve(root)!==root)throw Error('path');
 for(let p=root;p!==path.dirname(p);p=path.dirname(p)){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('unsafe')}
 const s=fs.statSync(root);if((s.mode&0o777)!==0o700||(typeof process.getuid==='function'&&s.uid!==process.getuid()))throw Error('private');
}
function readJSON(file,limit){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.size>limit||(s.mode&0o777)!==0o600||(typeof process.getuid==='function'&&s.uid!==process.getuid()))throw Error('file');return JSON.parse(fs.readFileSync(fd,'utf8'))}finally{fs.closeSync(fd)}
}
function writeJSON(root,name,value){
 const temporary=path.join(root,'.pending-delivery-'+crypto.randomUUID());
 try{fs.writeFileSync(temporary,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,path.join(root,name))}finally{try{fs.unlinkSync(temporary)}catch{}}
}
function setPreference(root,enabled){
 privateRoot(root);if(typeof enabled!=='boolean')throw Error('preference');
 writeJSON(root,'reporting-settings.json',{schemaVersion:1,autoReport:enabled,receiver:'lan-68',policyVersion:1});
}
function enabled(root){
 try{privateRoot(root);const v=readJSON(path.join(root,'reporting-settings.json'),1024);return Object.keys(v).sort().join()==='autoReport,policyVersion,receiver,schemaVersion'&&v.schemaVersion===1&&v.autoReport===true&&v.receiver==='lan-68'&&v.policyVersion===1}catch{return false}
}
async function jsonResponse(response){
 const length=Number(response.headers.get('content-length'));
 if(!Number.isSafeInteger(length)||length<1||length>4096||!response.body)throw Error('response');
 const reader=response.body.getReader(),chunks=[];let count=0;
 try{while(true){const item=await reader.read();if(item.done)break;count+=item.value.length;if(count>length||count>4096)throw Error('size');chunks.push(Buffer.from(item.value))}if(count!==length)throw Error('short');return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
function acknowledgement(value,id){
 return value&&Object.keys(value).sort().join()==='incidentId,receiptId,receivedAt,state'&&value.incidentId===id&&value.state==='received'&&value.receiptId===crypto.createHash('sha256').update('QCU-INCIDENT/V1:'+id).digest('hex')&&typeof value.receivedAt==='string'&&value.receivedAt.length<=40&&Number.isFinite(Date.parse(value.receivedAt));
}
async function flush(root,{origin=ORIGIN,fetcher=fetch,test=false,budgetMs=1500}={}){
 if(!enabled(root))return {state:'disabled',received:0};
 if(origin!==ORIGIN&&!(test&&/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin)))return {state:'refused-origin',received:0};
 let received=0,attempted=0;const deadline=Date.now()+Math.max(100,Math.min(budgetMs,3000));
 try{
  for(const name of fs.readdirSync(root).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).slice(0,100)){
   if(Date.now()>=deadline||attempted>=3)break;
   let report;try{report=readJSON(path.join(root,name),16384)}catch{continue}
   if(!validReport(report)||name!==report.incidentId+'.json')continue;
   let delivery;try{delivery=readJSON(path.join(root,report.incidentId+'.delivery.json'),4096)}catch{}
   if(delivery?.state==='received'&&acknowledgement(delivery.receipt,report.incidentId))continue;
   if(Number.isFinite(delivery?.nextAttemptAt)&&delivery.nextAttemptAt>Date.now())continue;
   ++attempted;
   const request=async(method,tail,body)=>fetcher(origin+tail,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(Math.max(1,Math.min(700,deadline-Date.now())))});
   try{
    let response=await request('GET','/v1/incidents/'+report.incidentId+'/receipt');
    if(response.status===404){await response.body?.cancel();if(Date.now()>=deadline)throw Error('budget');response=await request('POST','/v1/incidents',report)}
    if(response.status!==200&&response.status!==201){const rate=response.status===429;await response.body?.cancel();writeJSON(root,report.incidentId+'.delivery.json',{state:'queued',nextAttemptAt:Date.now()+(rate?3600000:60000)});continue}
    const receipt=await jsonResponse(response);if(!acknowledgement(receipt,report.incidentId))throw Error('receipt');
    writeJSON(root,report.incidentId+'.delivery.json',{state:'received',receipt});++received;
   }catch{writeJSON(root,report.incidentId+'.delivery.json',{state:'unknown',nextAttemptAt:Date.now()+60000})}
  }
  return {state:attempted?'checked':'idle',received};
 }catch{return {state:'unavailable',received}}
}
module.exports={ORIGIN,setPreference,enabled,flush};
