'use strict';
// Local-only startup incidents. Fixed fields only; never serialize Error objects.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const BUILD='rc44.2';
const descriptions={
 'QCU-ST-1001':'安装包文件清单不完整，请联系维护人员核对安装包。',
 'QCU-ST-1002':'安装包文件内容或权限发生变化，请联系维护人员核对安装包。',
 'QCU-ST-1003':'应用版本或运行环境不匹配，请核对套件版本。',
 'QCU-ST-1101':'已有数据来自另一份构建，请保留配置并联系维护人员。',
 'QCU-ST-1102':'本地配置无法解析，请保留原配置并联系维护人员。',
 'QCU-ST-1103':'数据目录存在未完成的初始化记录，请保留目录并联系维护人员。',
 'QCU-ST-1201':'组件清单格式异常，请联系维护人员修复。',
 'QCU-ST-1202':'组件清单存在重复项，请联系维护人员修复。',
 'QCU-ST-1203':'组件清单缺少基础组件，请联系维护人员修复。',
 'QCU-ST-1204':'组件清单包含未登记组件，请联系维护人员核对。',
 'QCU-ST-1301':'暂时无法访问所需文件，请联系维护人员核对权限。',
 'QCU-ST-1302':'磁盘空间不足，请释放空间后重试。',
 'QCU-ST-1303':'所需文件正在使用，请保存工作并正常退出旧助手后重试。',
 'QCU-ST-1399':'启动准备未完成，请将故障编号交维护人员核对。',
};
const stages=new Set(['arguments','release','runtime','parser','data-path','seed','receipt','profile','prepare','launch','migration']);
function selectionError(bundles,deps,native,allowed){
 let code;
 if(!Array.isArray(bundles)||bundles.some(id=>typeof id!=='string'))code='QCU-ST-1201';
 else if(new Set(bundles).size!==bundles.length)code='QCU-ST-1202';
 else if(!native.every(id=>bundles.includes(id)))code='QCU-ST-1203';
 else if(bundles.some(id=>!allowed.includes(id)&&!Object.hasOwn(deps,id)))code='QCU-ST-1204';
 if(code){const e=Error('Installed bundle selection invalid; preserved');e.incidentCode=code;return e}
}
function classify(error){
 if(Object.hasOwn(descriptions,error?.incidentCode))return error.incidentCode;
 if(error?.code==='QCU_DATA_RELEASE_MISMATCH')return 'QCU-ST-1101';
 if(error instanceof SyntaxError||error?.name==='YAMLException')return 'QCU-ST-1102';
 if(error?.code==='ENOSPC')return 'QCU-ST-1302';
 if(['EACCES','EPERM','EROFS'].includes(error?.code))return 'QCU-ST-1301';
 if(['EBUSY','EAGAIN','QCU_PREVIOUS_RUNNING'].includes(error?.code))return 'QCU-ST-1303';
 const message=typeof error?.message==='string'?error.message:'';
 if(message==='Seed file inventory differs from release')return 'QCU-ST-1001';
 if(message.startsWith('Release integrity failed: '))return 'QCU-ST-1002';
 if(message==='Data directory already exists without a completed receipt; preserved')return 'QCU-ST-1103';
 if(['Runtime does not match teacher release','Unexpected teacher release','Unexpected integrated teacher release'].includes(message))return 'QCU-ST-1003';
 return 'QCU-ST-1399';
}
const version=value=>typeof value==='string'&&/^[a-zA-Z0-9.-]{1,80}$/.test(value)?value:'unobserved';
function createIncident(error,context={}){
 const errorCode=classify(error),stage=stages.has(error?.incidentStage)?error.incidentStage:stages.has(context.stage)?context.stage:'prepare';
 const report={schemaVersion:1,incidentId:crypto.randomUUID(),createdAt:new Date().toISOString(),errorCode,stage,buildId:BUILD,suiteVersion:['0.1.0-rc.4.1','0.1.0-rc.4.2','0.1.0-rc.4.3','0.1.0-rc.4.4'].includes(context.suiteVersion)?context.suiteVersion:'unobserved',runtimeVersion:version(process.version),platform:['darwin','win32','linux'].includes(process.platform)?process.platform:'other',arch:['arm64','x64'].includes(process.arch)?process.arch:'other',osMajor:os.release().split('.')[0].replace(/[^0-9]/g,'').slice(0,4),uploadState:'local-only',sourceKind:context.sourceKind==='self-test'?'self-test':'startup'};
 report.fingerprint=crypto.createHash('sha256').update(JSON.stringify([report.schemaVersion,errorCode,stage,report.buildId,report.suiteVersion])).digest('hex');return report;
}
function validReport(report){
 const fields=['schemaVersion','incidentId','createdAt','errorCode','stage','buildId','suiteVersion','runtimeVersion','platform','arch','osMajor','uploadState','fingerprint','sourceKind'];
 try{return Boolean(report&&Object.keys(report).sort().join()===fields.sort().join()&&report.schemaVersion===1&&Object.hasOwn(descriptions,report.errorCode)&&report.buildId===BUILD&&stages.has(report.stage)&&report.uploadState==='local-only'&&['startup','self-test'].includes(report.sourceKind)&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(report.incidentId)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(report.createdAt)&&['0.1.0-rc.4.1','0.1.0-rc.4.2','0.1.0-rc.4.3','0.1.0-rc.4.4','unobserved'].includes(report.suiteVersion)&&/^v\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(report.runtimeVersion)&&['darwin','win32','linux','other'].includes(report.platform)&&['arm64','x64','other'].includes(report.arch)&&/^\d{1,4}$/.test(report.osMajor)&&report.fingerprint===crypto.createHash('sha256').update(JSON.stringify([1,report.errorCode,report.stage,report.buildId,report.suiteVersion])).digest('hex'))}catch{return false}
}
function saveIncident(report,root){
 let temporary;
 try{
  if(!validReport(report))throw Error('schema');
  if(!path.isAbsolute(root)||path.resolve(root)!==root)throw Error('root');
  for(let p=root;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p)){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('unsafe')}
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  const stat=fs.lstatSync(root);if(stat.isSymbolicLink()||!stat.isDirectory()||(typeof process.getuid==='function'&&stat.uid!==process.getuid())||(stat.mode&0o777)!==0o700)throw Error('unsafe');
  if(fs.readdirSync(root).length>=100)return {saved:false,storageState:'full'};
  const bytes=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(bytes)>16384)throw Error('size');
  const name=report.incidentId;if(!/^[a-f0-9-]{36}$/.test(name))throw Error('id');
  temporary=path.join(root,'.pending-'+name);const fd=fs.openSync(temporary,'wx',0o600);
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  fs.linkSync(temporary,path.join(root,name+'.json'));fs.unlinkSync(temporary);temporary=null;
  return {saved:true,storageState:'saved'};
 }catch{return {saved:false,storageState:'unavailable'}}
 finally{if(temporary)try{fs.unlinkSync(temporary)}catch{}}
}
function captureFailure(error,context,root){
 const report=createIncident(error,context),storage=saveIncident(report,root);
 const message='['+report.errorCode+'] '+descriptions[report.errorCode]+'\n故障编号：'+report.incidentId+'\n构建：'+report.buildId+'\n诊断记录：'+(storage.saved?'已保存本地记录':'未能保存，请复制此提示')+'\n请保留已有配置；无需发送密钥或教学资料。';
 return {report,storage,message};
}
module.exports={BUILD,selectionError,classify,createIncident,validReport,saveIncident,captureFailure};
