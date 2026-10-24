// Run the patched frozen coordinator/scheduler against a zero-network fake updater.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const main=fs.readFileSync(path.resolve(process.argv[2]),'utf8');
function region(name){const begin=main.indexOf('//#region lib/types/'+name);assert.ok(begin>=0);return main.slice(begin,main.indexOf('//#endregion',begin));}
const calls={checks:0,downloads:0,installs:0,timers:0};
const updater={on(){},off(){},checkForUpdates(){calls.checks++;throw Error('network must not be reached')},downloadUpdate(){calls.downloads++;throw Error('download must not be reached')},quitAndInstall(){calls.installs++;}};
const context={electronUpdater:{autoUpdater:{}},app:{isPackaged:true,getVersion:()=> '0.2.0-rc.2'},performance,console,setTimeout:()=>{calls.timers++;throw Error('ordinary polling timer must not be created')},clearTimeout(){},process:{env:{}},existsSync:()=>true,join:path.join};
vm.createContext(context);
vm.runInContext(region('update-coordinator.js')+'\n'+region('update-schedule.js')+'\nglobalThis.classes={DesktopUpdateCoordinator,DesktopUpdateSchedule};',context);
(async()=>{
 const {DesktopUpdateCoordinator,DesktopUpdateSchedule}=context.classes;
 const c=new DesktopUpdateCoordinator(()=>{},()=>assert.fail('must not restart'),updater,()=>true,()=> '0.2.0-rc.2');
 for(const manual of [false,true])assert.equal((await c.check(manual)).phase,'idle');
 assert.equal((await c.doCheck()).phase,'idle');
 c.candidate='99.0.0';c.downloaded=true;
 await assert.rejects(c.download('99.0.0'),/维护者统一更新/);
 await assert.rejects(c.install('99.0.0'),/维护者统一更新/);
 const schedule=new DesktopUpdateSchedule(c,{intervalMs:1,maxBackoffMs:1,jitter:0});
 for(const manual of [false,true])assert.equal((await schedule.check(manual,true)).phase,'idle');
 schedule.schedule(false);
 assert.deepEqual(calls,{checks:0,downloads:0,installs:0,timers:0});
 assert.match(main,/label: "套件版本说明"/);
 assert.match(main,/if \(!quitting\) mandatoryPolicy\?\.check\("foreground-or-resume"\)/);
 assert.match(main,/mandatoryPolicy\.check\("launch"\)/);
 assert.match(main,/if \(!quitting && !QCU_MANAGED_UPDATES\) updateSchedule\.check/);
 console.log('QCU_MANAGED_UPDATES_VERIFIED:'+JSON.stringify({manualAndAutomaticChecksBlocked:true,directDownloadAndInstallBlocked:true,preparedTargetAlsoBlocked:true,ordinaryTimers:0,updaterCalls:calls,minimumPolicyEntryPointsRetained:true,gui:false}));
})().catch(e=>{console.error(e);process.exitCode=1});
