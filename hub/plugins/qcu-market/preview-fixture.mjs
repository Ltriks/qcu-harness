// Browser-only synthetic backend. Never packaged, no fetch/profile/DSH access.
import {bundledCatalog,catalogSha256} from './src/bundled-catalog.mjs'
import {createCatalogFlows} from './src/direct-flow.mjs'
import {releaseKeyOf} from './src/catalog-core.mjs'
import {marketRuntime} from './src/remote-contract.mjs'
export function createPreviewFixture(){
 const calls=[],receipts=new Map(),bundles=[],rows=[]
 const ok=value=>({ok:true,value})
 const record=(name,fn)=>(...args)=>{calls.push({name,args:args.slice(0,2)});return Promise.resolve().then(()=>fn(...args))}
 const remote={qcuMarket:{
  status:record('status',()=>ok(JSON.stringify(marketRuntime))),
  refresh:record('refresh',()=>ok(JSON.stringify({mode:'legacy',state:'legacy',catalog:bundledCatalog,fingerprint:catalogSha256,message:'固定内置合成目录'}))),
  prepare:record('prepare',(id,key)=>{const entry=bundledCatalog.entries.find(e=>releaseKeyOf(e.release)===key).release;const receipt={id,entry,catalogSha256,releaseKey:key,path:'/synthetic/'+entry.file,expiresAt:Date.now()+300000};receipts.set(id,receipt);return ok(JSON.stringify(receipt))}),
  verify:record('verify',id=>ok(JSON.stringify(receipts.get(id)))),
  cancel:record('cancel',id=>{receipts.delete(id);return ok('{}')})
 },pluginManager:{
  listBundles:record('listBundles',()=>ok(bundles)),listPlugins:record('listPlugins',()=>ok(rows)),
  inspect:record('inspect',()=>ok({status:'accepted',kind:'tarball',bundle:null,registry:null})),
  installBundle:record('installBundle',(path,options)=>{const r=bundledCatalog.entries.find(e=>path==='/synthetic/'+e.release.file)?.release;if(!r||options.enabled!==false||bundles.some(b=>b.name===r.id))throw Error('Invalid synthetic install');bundles.push({name:r.id,version:r.version,installed:true,enabled:false,rows:[{rowId:r.id,moduleName:r.id,entryId:'preview:'+r.id}],overrides:[]});rows.push({moduleName:r.id,entryId:'preview:'+r.id,patchId:r.id,enabled:false,fiberPhase:null});return ok({application:'applied',stage:'enable',target:r.id,bundle:r.id,enabled:false})}),
  setBundleEnabled:record('setBundleEnabled',(id,enabled)=>{const b=bundles.find(b=>b.name===id);if(!b||enabled!==true)throw Error('Unknown synthetic bundle');b.enabled=true;return ok({application:'applied',stage:'enable',target:id,enabled})}),
  setPluginEnabled:record('setPluginEnabled',(id,enabled)=>{const row=rows.find(r=>r.entryId===id);if(!row||enabled!==true)throw Error('Unknown synthetic row');row.enabled=true;row.fiberPhase='active';return ok({application:'applied',stage:'enable',target:id,enabled})}),
  cancelInstall:record('cancelInstall',()=>ok({status:'not-running'})),waitForInstall:record('waitForInstall',()=>ok(null))
 },$on:()=>()=>{}}
 const flows=createCatalogFlows(remote)
 return {remote,flows,calls}
}
