'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const incident=require('./incidents.cjs'),lan=require('./lan-report.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function root(){return process.env.QCU_TEACHER_TEST_HOME?path.join(path.dirname(path.resolve(process.env.QCU_TEACHER_TEST_HOME)),'diagnostics'):path.join(os.homedir(),'Library/Logs/QCU-DSH')}
function initialize(){
 const dir=root();
 for(let p=dir;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p)){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('diagnostics.unsafe')}
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const stat=fs.lstatSync(dir);
 if((stat.mode&0o777)!==0o700||stat.uid!==process.getuid())throw Error('diagnostics.unsafe');return dir;
}
function read(file,max){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.uid!==process.getuid()||stat.size>max||(stat.mode&0o777)!==0o600)throw Error('diagnostics.file');return JSON.parse(fs.readFileSync(fd,'utf8'))}finally{fs.closeSync(fd)}
}
function record(id){if(!UUID.test(id))throw Error('diagnostics.id');const dir=initialize(),report=read(path.join(dir,id+'.json'),16384);if(!incident.validReport(report)||report.incidentId!==id)throw Error('diagnostics.invalid');return report}
function delivery(id){
 try{const value=read(path.join(root(),id+'.delivery.json'),4096);if(value.state==='received'&&value.receipt?.incidentId===id&&/^[a-f0-9]{64}$/.test(value.receipt.receiptId))return {state:'received',receiptId:value.receipt.receiptId};if(['queued','unknown'].includes(value.state))return {state:value.state}}catch{}
 return {state:lan.enabled(root())?'queued':'local-only'};
}
function status(){
 const records=[];let storageAvailable=true;
 try{const dir=initialize();for(const name of fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).slice(0,100))try{const v=record(name.slice(0,-5));records.push({incidentId:v.incidentId,createdAt:v.createdAt,errorCode:v.errorCode,stage:v.stage,delivery:delivery(v.incidentId).state})}catch{}}catch{storageAvailable=false}
 records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const info=JSON.parse(fs.readFileSync(path.join(__dirname,'release-info.json'),'utf8'));
 return {version:info.version,build:info.build,kernel:info.kernel,autoReport:lan.enabled(root()),storageAvailable,receiver:'校内维护服务（.68）',records:records.slice(0,50)};
}
async function preference(enabled){if(typeof enabled!=='boolean')throw Error('diagnostics.preference');lan.setPreference(initialize(),enabled);if(enabled)await lan.flush(root());return status()}
function exportRecord(id){return {schemaVersion:1,diagnostic:record(id),delivery:delivery(id)}}
module.exports={root,status,preference,exportRecord};
