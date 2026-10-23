import {gzipSync} from 'node:zlib'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MarketUpdates} from '../../hub/plugins/qcu-market/src/update-host.mjs'
import {archiveFingerprint,readUpdateArchive} from '../../hub/plugins/qcu-market/src/update-archive.mjs'
import {MarketUpdateFlow} from '../../hub/plugins/qcu-market/src/update-flow.mjs'
import {marketRuntime} from '../../hub/plugins/qcu-market/src/remote-contract.mjs'
export const updateHash=b=>createHash('sha256').update(b).digest('hex')
export function syntheticUpdateArchive(id,version,{peers={},patch,extra={}}={}){
 const files={'package.json':JSON.stringify({name:id,version,type:'module',exports:{'.':'./index.js'},dsh:{bundle:{patch:'./cordis.patch.yml'}},peerDependencies:peers,files:['index.js','cordis.patch.yml','LICENSE'],...extra}),'index.js':`export function apply(){} // ${version}`,'cordis.patch.yml':JSON.stringify(patch??[{insert:[{id,name:id,disabled:true,config:{enabled:true}}]}]),LICENSE:'MIT\n'}
 const chunks=[]
 for(const [path,text] of Object.entries(files)){
  const bytes=Buffer.from(text),h=Buffer.alloc(512);h.write('package/'+path);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(bytes.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);const sum=[...h].reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);chunks.push(h,bytes,Buffer.alloc((512-bytes.length%512)%512))
 }return gzipSync(Buffer.concat([...chunks,Buffer.alloc(1024)]),{mtime:0})
}
export function syntheticUpdateEntry(id,version,bytes,capability='skill'){
 const sha256=updateHash(bytes),pkg=JSON.parse(readUpdateArchive(bytes).get('package.json').toString())
 return {id,version,sha256,file:`${id}-${version}-${sha256}.tgz`,bytes:bytes.length,runtime:'0.2.0-rc.2',capability,changes:'合成新版说明',upgradePolicy:'preserve-config-no-migration',withdrawn:false,files:archiveFingerprint(bytes),peers:pkg.peerDependencies}
}
export async function updateFixture(t,{id='qcu-study-coach',from='0.1.0-pilot.1',to='0.1.0-pilot.2',enabled=true,capability='skill'}={}){
 const dir=await mkdtemp(join(tmpdir(),'qcu-update-flow-'));t.after(()=>rm(dir,{recursive:true,force:true}));const profile=join(dir,'profile'),local=join(profile,'node_modules',id);await mkdir(local,{recursive:true})
 const a=syntheticUpdateArchive(id,from),b=syntheticUpdateArchive(id,to),entries=[syntheticUpdateEntry(id,from,a,capability),syntheticUpdateEntry(id,to,b,capability)]
 const installFiles=async bytes=>{for(const [name,b] of readUpdateArchive(bytes))await writeFile(join(local,name),b)};await installFiles(a)
 await writeFile(join(profile,'package.json'),JSON.stringify({dependencies:{[id]:'file:original.tgz'},dsh:{profile:{bundles:enabled?[id]:[]}}}));await writeFile(join(profile,'cordis.patch.yml'),'[]\n')
 const keys=generateKeyPairSync('ed25519'),policy={publicKey:keys.publicKey.export({type:'spki',format:'pem'}),products:{[id]:{capability,peers:{}}}},clock={now:Date.now()},calls=[]
 let revision=1,mode='ok',responseMode='ok',installed=from,boot='before'
 const envelope=()=>{const payload=JSON.stringify({schemaVersion:1,channel:'pilot',revision,issuedAt:new Date(clock.now-1000).toISOString(),expiresAt:new Date(clock.now+86400000).toISOString(),entries});return {payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64')}}
 const inventory=async()=>({bundles:[{name:id,version:installed,installed:true,optional:false,removable:true,enabled,rows:[{rowId:id,moduleName:id,entryId:enabled?'row:'+id:undefined}],overrides:[]}],rows:enabled?[{moduleName:id,entryId:'row:'+id,patchId:id,enabled:true,fiberPhase:'active'}]:[]})
 const fetcher=async(url,options)=>{calls.push({name:'fetch',url});if(mode==='offline')throw Error('offline');let bytes=url.endsWith('/updates.json')?Buffer.from(JSON.stringify(envelope())):b;if(mode==='bad-signature'&&url.endsWith('/updates.json')){const value=envelope();value.signature='A'.repeat(86)+'==';bytes=Buffer.from(JSON.stringify(value))}if(mode==='bad-package'&&!url.endsWith('/updates.json'))bytes=Buffer.alloc(b.length);options?.signal?.throwIfAborted();return new Response(bytes,{headers:{'content-length':String(bytes.length)}})}
 const host=new MarketUpdates({profileDir:profile,runtime:'0.2.0-rc.2',marketVersion:marketRuntime.version,root:join(dir,'cache'),policy,inventory,bootId:boot,fetcher,now:()=>clock.now})
 const ok=value=>({ok:true,value}),call=(name,fn)=>(...args)=>{calls.push({name,args});return Promise.resolve().then(()=>fn(...args)).then(ok)}
 const remote={qcuMarket:{status:call('status',()=>JSON.stringify(marketRuntime)),updatesCheck:call('updatesCheck',s=>host.check(s)),updatesPrepare:call('updatesPrepare',(i,k,s)=>host.prepare(i,k,s)),updatesVerify:call('updatesVerify',i=>host.verify(i)),updatesCancel:call('updatesCancel',i=>host.cancel(i)),updatesJournal:call('updatesJournal',(i,r)=>host.journal(i,r)),updatesRecovery:call('updatesRecovery',()=>host.recovery()),updatesAcknowledge:call('updatesAcknowledge',(r,s)=>host.acknowledge(r,s))},pluginManager:{listBundles:call('listBundles',async()=>(await inventory()).bundles),listPlugins:call('listPlugins',async()=>(await inventory()).rows),inspect:call('inspect',()=>({status:'accepted',kind:'tarball',bundle:null,registry:null})),installBundle:call('installBundle',async()=>{if(responseMode==='failed')return {application:'failed',stage:'install'};await installFiles(b);installed=to;if(responseMode==='lost')throw Error('lost reply');return {application:'restart-required',stage:'enable',target:id,bundle:id,enabled:false}}),waitForInstall:call('waitForInstall',()=>null),cancelInstall:call('cancelInstall',()=>({status:'not-running'}))}}
 const flow=new MarketUpdateFlow(remote,{now:()=>clock.now});t.after(()=>{flow.dispose();host.dispose()})
 return {id,from,to,a,b,entries,policy,keys,clock,calls,host,flow,remote,profile,local,envelope,inventory,installFiles,setRevision:v=>revision=v,setMode:v=>mode=v,setResponse:v=>responseMode=v,restart(){host.bootId='after';boot='after'},get installed(){return installed}}
}
