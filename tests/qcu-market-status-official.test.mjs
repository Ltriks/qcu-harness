// Exact rc.2 PluginManager + Gateway; synthetic profile and empty loader roster.
// No application boot, pnpm, network, install/enable/prepare or real Home.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {readProduct} from '../hub/plugins/qcu-market/src/direct-flow.mjs'
import {release} from '../hub/plugins/qcu-market/src/trusted-release.mjs'
const require=createRequire(pathToFileURL(process.env.QCU_OFFICIAL_DEPENDENCIES+'/package.json'))
const {Context}=require('@deepseek-ai/cordis')
const load=async name=>import(pathToFileURL(require.resolve(name)))
const {PluginManager}=await load('@deepseek-ai/dsh-plugin-manager'),{TypertRegistry}=await load('@deepseek-ai/dsh-typert-registry'),{TypertGatewayService}=await load('@deepseek-ai/dsh-api-gateway')
async function files(root){const result={};for(const name of await readdir(root,{recursive:true})){try{result[name]=await readFile(join(root,name),'utf8')}catch(e){if(e.code!=='EISDIR')throw e}}return result}
test('official manager initialization and concurrent inventory read actual profile facts without mutations or peer-operation errors',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'market-official-status-')),home=join(dir,'home'),pkg=join(dir,'node_modules',release.id),anchor=join(dir,'installation.json'),manifest=join(dir,'package.json')
 await mkdir(home);await mkdir(pkg,{recursive:true});await writeFile(anchor,JSON.stringify({dependencies:{}}))
 await writeFile(manifest,JSON.stringify({name:'synthetic-profile',private:true,dependencies:{[release.id]:release.version},dsh:{profile:{bundles:[]}}}))
 await writeFile(join(pkg,'package.json'),JSON.stringify({name:release.id,version:release.version,dsh:{bundle:{patch:'./cordis.patch.yml'}}}))
 await writeFile(join(pkg,'cordis.patch.yml'),JSON.stringify([{insert:[{id:release.id,name:release.id,disabled:true}]}]))
 const before=await files(dir),ctx=new Context();new TypertRegistry(ctx);const gateway=new TypertGatewayService(ctx,{})
 ctx.reflect.provide('loader',{entries:()=>[]})
 ctx.reflect.provide('profileContext',{name:'synthetic',dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:anchor,cwd:dir,home,startedBundles:[],overlays:[]})
 const owner=ctx.plugin(PluginManager);try{
  await owner.await();assert.deepEqual(await files(dir),before)
  const invoke=method=>gateway.invoke({namespace:'pluginManager',method,args:{}})
  const bundles=await Promise.all(Array.from({length:5},()=>invoke('listBundles')));assert.ok(bundles.every(rows=>rows[0].name===release.id&&rows[0].version===release.version&&rows[0].installed&&!rows[0].enabled))
  assert.deepEqual(await invoke('listPlugins'),[])
  const status=await readProduct({listBundles:async()=>({ok:true,value:await invoke('listBundles')}),listPlugins:()=>assert.fail('disabled bundle needs no row lookup')},release)
  assert.equal(status.state,'installed-disabled');assert.equal(status.installedVersion,release.version);assert.deepEqual(await files(dir),before)
  await owner.dispose();await assert.rejects(invoke('listBundles'),/withdrawn|unavailable|no active Remote/)
 }finally{await owner.dispose();await ctx.fiber.dispose()}
})
