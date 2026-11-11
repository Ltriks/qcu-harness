'use strict';
// Kept as a source fragment for start.cjs's main; not executed on import.
module.exports=async function main(api){
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const {identity,defaultHome,assertPreviousStopped,prepare,startupDiagnostic}=api;
 const context={stage:'arguments',suiteVersion:'unobserved',sourceKind:process.env.QCU_TEACHER_TEST_HOME?'self-test':'startup'};
 let reportRoot=process.env.QCU_TEACHER_TEST_HOME
  ?path.join(path.dirname(path.resolve(process.env.QCU_TEACHER_TEST_HOME)),'diagnostics')
  :process.platform==='darwin'?path.join(os.homedir(),'Library/Logs/QCU-DSH'):path.join(os.homedir(),'AppData/Local/QCU-DSH/diagnostics');
 try{
  const args=process.argv.slice(2);
  if(!['prepare','inspect','diagnostics'].includes(args[0])||args[1]!=='--kit'||!args[2]||!([3,5].includes(args.length))||(args.length===5&&(args[3]!=='--migrate'||!['0.1.0-rc.4.1','0.1.0-rc.4.3','0.1.0-rc.4.4'].includes(args[4]))))throw Error('Invalid launch arguments');
  const kit=path.resolve(args[2]);context.stage='release';const m=identity(kit);context.suiteVersion=m.version;
  const target=m.target;context.stage='runtime';
  if(!((target==='win-x64'&&process.platform==='win32'&&process.arch==='x64')||(target==='mac-arm64'&&process.platform==='darwin'&&process.arch==='arm64')))throw Error('Runtime does not match teacher release');
  const testing=process.env.QCU_TEACHER_TEST_HOME,home=testing?path.resolve(testing):defaultHome(m.version),previous=!testing&&m.migrateFrom?defaultHome(m.migrateFrom.version):undefined;
  if(args[0]==='inspect'){console.log(JSON.stringify(require('./upgrade.cjs').inspect(home,api)));return;}
  if(args[0]==='diagnostics'){console.log(JSON.stringify(require('./diagnostics-api.cjs').status()));return;}
  let yaml=JSON.parse;context.stage='parser';
  if(['0.1.0-rc.4.1','0.1.0-rc.4.2','0.1.0-rc.4.3','0.1.0-rc.4.4'].includes(m.version)||(previous&&fs.existsSync(previous))){
   if(previous&&!fs.existsSync(path.join(home,'qcu-teacher.json')))assertPreviousStopped(previous);
   const resources=target==='mac-arm64'?path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'):path.join(kit,'program/resources');
   yaml=require('node:module').createRequire(path.join(resources,'app.asar/dsh/package.json'))('js-yaml').load;
  }
  context.stage='prepare';const result=args.length===5?require('./upgrade.cjs').migrate(kit,home,args[4],yaml,api):prepare(kit,home,previous,yaml);
  await require('./lan-report.cjs').flush(reportRoot);
  console.log('QCU_TEACHER_RESULT:'+JSON.stringify(result));console.log('QCU_TEACHER_HOME:'+result.home);
 }catch(e){
  try{const value=require('./incidents.cjs').captureFailure(e,context,reportRoot);const delivery=await require('./lan-report.cjs').flush(reportRoot);console.error('QCU_TEACHER_ERROR: '+value.message+'\n内网上报：'+(delivery.received?'收到回执（可用故障编号查询）':delivery.state==='disabled'?'未开启自动发送':'暂未获得回执，记录保留在本机'))}
  catch{console.error('QCU_TEACHER_ERROR: '+startupDiagnostic(e))}
  process.exitCode=1;
 }
};
