import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
export const name='qcu-branding';
export const inject=['typert'];
const codec={mode:'strict',typeSymbol:'qcu-branding#DiagnosticJson',create:()=>({parse(value){if(typeof value!=='string'||Buffer.byteLength(value)>32768)throw Error('diagnostics.invalid');JSON.parse(value);return value}})};
const descriptors=[['status',[]],['preference',[{name:'payload',wire:'payload',source:'json',codec}]],['exportRecord',[{name:'payload',wire:'payload',source:'json',codec}]]].map(([method,parameters])=>({id:'qcu-branding#qcuDiagnostics/'+method,service:'qcuDiagnostics',namespace:'qcuDiagnostics',method,invocation:{kind:'direct'},parameters,result:codec}));
class Diagnostics extends TypertRemoteService{
 constructor(ctx){super(ctx,'qcuDiagnostics')}
 api(){const support=process.env.QCU_SUITE_SUPPORT;if(!support)throw Error('diagnostics.unavailable');const info=JSON.parse(readFileSync(join(support,'release-info.json'),'utf8'));if(info.version!=='0.1.0-rc.4.4'||!/^rc44\.[0-9]+$/.test(info.build))throw Error('diagnostics.version');return createRequire(import.meta.url)(join(support,'diagnostics-api.cjs'))}
 status(){try{return JSON.stringify({ok:true,value:this.api().status()})}catch{return JSON.stringify({ok:false,error:'diagnostics.unavailable'})}}
 async preference(payload){try{const v=JSON.parse(payload);if(Object.keys(v).join()!=='enabled'||typeof v.enabled!=='boolean')throw Error('invalid');return JSON.stringify({ok:true,value:await this.api().preference(v.enabled)})}catch{return JSON.stringify({ok:false,error:'diagnostics.preference'})}}
 exportRecord(payload){try{const v=JSON.parse(payload);if(Object.keys(v).join()!=='incidentId')throw Error('invalid');return JSON.stringify({ok:true,value:this.api().exportRecord(v.incidentId)})}catch{return JSON.stringify({ok:false,error:'diagnostics.export'})}}
}
export function apply(ctx){new Diagnostics(ctx);ctx.typert.register({package:name,face:'host',schemas:[],invocations:descriptors,model:{services:[],events:[],objects:[]}})}
