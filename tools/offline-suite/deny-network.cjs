/* Test-only preload: deny every TCP/DNS/HTTP attempt in this process and its pnpm child. */
const fs=require('node:fs'),path=require('node:path');
const log=event=>{if(process.env.QCU_OFFLINE_TEST_LOG)fs.appendFileSync(process.env.QCU_OFFLINE_TEST_LOG,JSON.stringify({event,pid:process.pid,entry:path.basename(process.argv[1]||'')})+'\n')};
const fail=()=>{log('blocked');throw new Error('QCU_OFFLINE_TEST: network access denied')};
require('node:net').Socket.prototype.connect=fail;
for(const mod of ['node:http','node:https']){require(mod).request=fail;require(mod).get=fail}
for(const key of ['lookup','resolve','resolve4','resolve6'])require('node:dns')[key]=fail;
for(const key of ['lookup','resolve','resolve4','resolve6'])require('node:dns').promises[key]=async()=>fail();
globalThis.fetch=async()=>fail();
globalThis.QCU_OFFLINE_NETWORK_GUARD=true;
log('guard-installed');
