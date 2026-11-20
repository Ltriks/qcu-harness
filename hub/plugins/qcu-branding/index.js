import {Worker} from 'node:worker_threads';
import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
export const name='qcu-branding';
export const inject=['typert'];
const codec={mode:'strict',typeSymbol:'qcu-branding#DiagnosticJson',create:()=>({parse(value){if(typeof value!=='string'||Buffer.byteLength(value)>32768)throw Error('diagnostics.invalid');JSON.parse(value);return value}})};
const descriptors=[['status',[]],['onboarding',[{name:'payload',wire:'payload',source:'json',codec}]],['preference',[{name:'payload',wire:'payload',source:'json',codec}]],['exportRecord',[{name:'payload',wire:'payload',source:'json',codec}]]].map(([method,parameters])=>({id:'qcu-branding#qcuDiagnostics/'+method,service:'qcuDiagnostics',namespace:'qcuDiagnostics',method,invocation:{kind:'direct'},parameters,result:codec}));
class Diagnostics extends TypertRemoteService{
 constructor(ctx){super(ctx,'qcuDiagnostics')}
 api(){const support=process.env.QCU_SUITE_SUPPORT;if(!support)throw Error('diagnostics.unavailable');const info=JSON.parse(readFileSync(join(support,'release-info.json'),'utf8'));if(info.version!=='0.1.0-rc.4.5'||!/^rc45\.[0-9]+$/.test(info.build))throw Error('diagnostics.version');return createRequire(import.meta.url)(join(support,'diagnostics-api.cjs'))}
 async invokeApi(method,argument){
  this.api(); // Keep the release/support gate; only ACL-heavy execution moves off-thread.
  return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./diagnostics-worker.js',import.meta.url),{workerData:{support:process.env.QCU_SUITE_SUPPORT,method,argument}});
   let settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value)};
   const timer=setTimeout(()=>{finish(Error('diagnostics.timeout'));void worker.terminate()},45000);
   worker.once('message',message=>message?.ok===true?finish(null,message.value):finish(Error('diagnostics.host')));
   worker.once('error',()=>finish(Error('diagnostics.worker')));
   worker.once('exit',()=>{if(!settled)finish(Error('diagnostics.worker'))});
  });
 }
 status(){
  if(!this.pendingStatus)this.pendingStatus=this.invokeApi('status').then(value=>JSON.stringify({ok:true,value}),()=>JSON.stringify({ok:false,error:'diagnostics.unavailable'})).finally(()=>{this.pendingStatus=null});
  return this.pendingStatus;
 }
 async onboarding(payload){try{const v=JSON.parse(payload);if(Object.keys(v).join()!=='action'||!['inspect','disclosed','disable'].includes(v.action))throw Error('invalid');return JSON.stringify({ok:true,value:await this.invokeApi('onboarding',v.action)})}catch{return JSON.stringify({ok:false,error:'diagnostics.onboarding'})}}
 async preference(payload){try{const v=JSON.parse(payload);if(Object.keys(v).join()!=='enabled'||typeof v.enabled!=='boolean')throw Error('invalid');return JSON.stringify({ok:true,value:await this.invokeApi('preference',v.enabled)})}catch{return JSON.stringify({ok:false,error:'diagnostics.preference'})}}
 async exportRecord(payload){try{const v=JSON.parse(payload);if(Object.keys(v).join()!=='incidentId')throw Error('invalid');return JSON.stringify({ok:true,value:await this.invokeApi('exportRecord',v.incidentId)})}catch{return JSON.stringify({ok:false,error:'diagnostics.export'})}}

}
export function apply(ctx){new Diagnostics(ctx);ctx.typert.register({package:name,face:'host',schemas:[],invocations:descriptors,model:{services:[],events:[],objects:[]}})}
