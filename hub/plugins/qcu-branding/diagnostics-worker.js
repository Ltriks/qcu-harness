// Fixed diagnostics operations only. Never return exception messages or paths.
import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {join} from 'node:path';
try{
 const {support,method,argument}=workerData;
 if(!['status','preference','exportRecord','onboarding'].includes(method))throw Error('unsupported');
 const api=createRequire(import.meta.url)(join(support,'diagnostics-api.cjs'));
 const value=await (method==='status'?api.status():api[method](argument));
 parentPort.postMessage({ok:true,value});
}catch{parentPort.postMessage({ok:false})}
finally{parentPort.close()}
