// Browser-only synthetic backend. Never packaged, no fetch/profile/DSH access.
import {bundledCatalog,catalogSha256} from './src/bundled-catalog.mjs'
import {createCatalogFlows} from './src/direct-flow.mjs'
import {releaseKeyOf} from './src/catalog-core.mjs'
import {marketRuntime} from './src/remote-contract.mjs'
export function createPreviewFixture(){
 const calls=[],receipts=new Map();let bundles=[],rows=[]
 const ok=value=>({ok:true,value})
 const record=(name,fn)=>(...args)=>{calls.push({name,args:args.slice(0,2)});return Promise.resolve().then(()=>fn(...args))}
 const remote={qcuMarket:{
  status:record('status',()=>ok(JSON.stringify(marketRuntime))),
  prepare:record('prepare',(id,key)=>{const entry=bundledCatalog.entries.find(e=>releaseKeyOf(e.release)===key).release;const receipt={id,entry,catalogSha256,releaseKey:key,path:'/synthetic/'+entry.file,expiresAt:Date.now()+300000};receipts.set(id,receipt);return ok(JSON.stringify(receipt))}),
  verify:record('verify',id=>ok(JSON.stringify(receipts.get(id)))),
  cancel:record('cancel',id=>{receipts.delete(id);return ok('{}')})
 },pluginManager:{
  listBundles:record('listBundles',()=>ok(bundles)),listPlugins:record('listPlugins',()=>ok(rows)),
  inspect:record('inspect',()=>ok({status:'accepted',kind:'tarball',bundle:null,registry:null})),
  installBundle:record('installBundle',()=>{const r=bundledCatalog.entries[0].release;bundles=[{name:r.id,version:r.version,installed:true,enabled:false}];rows=[{moduleName:r.id,entryId:'preview:coach',enabled:false,fiberPhase:null}];return ok({application:'applied',stage:'enable',target:r.id,bundle:r.id,enabled:false})}),
  setBundleEnabled:record('setBundleEnabled',()=>{bundles[0].enabled=true;return ok({application:'applied'})}),
  setPluginEnabled:record('setPluginEnabled',()=>{rows[0].enabled=true;rows[0].fiberPhase='active';return ok({application:'applied'})}),
  cancelInstall:record('cancelInstall',()=>ok({status:'not-running'})),waitForInstall:record('waitForInstall',()=>ok(null))
 },$on:()=>()=>{}}
 const flows=createCatalogFlows(remote)
 return {remote,flows,calls}
}
