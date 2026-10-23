// Fresh process, actual official profile resolution + Loader, no base services or models.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
const require=createRequire(process.env.QCU_OFFICIAL_DEPENDENCIES+'/package.json'),load=n=>import(pathToFileURL(require.resolve(n)))
const {Context}=await load('@deepseek-ai/cordis')
const {Loader}=await load('@deepseek-ai/cordis-plugin-loader')
const {PluginPackages,loadProfileDirectory,createRuntimeResolution}=await load('@deepseek-ai/dsh-app-boot')
const {TypertRegistry}=await load('@deepseek-ai/dsh-typert-registry')
const [dir,home,anchor,selected]=process.argv.slice(2),enabled=selected==='true'
const profile=loadProfileDirectory('dsh',dir,anchor)
assert.deepEqual(profile.skippedBundles,[])
const resolution=await createRuntimeResolution({installAnchor:anchor,profile,home})
const ctx=new Context()
try{
 new PluginPackages(ctx,{resolution});new TypertRegistry(ctx)
 ctx.reflect.provide('workspaceRegistry',{list:()=>[{id:'synthetic',title:'Synthetic only',path:join(home,'workspace')}],get:()=>undefined})
 const loader=new Loader(ctx,{baseUrl:pathToFileURL(join(dir,'cordis.yml')).href});loader.write=()=>{}
 const module=await loader.import('qcu-expert-teams'),pkg=ctx.pluginPackages.packageOf('qcu-expert-teams',loader.ctx.baseUrl)
 assert.equal(pkg.version,'0.2.0-pilot.2')
 if(enabled){const fork=ctx.plugin(module,{enabled:true});await fork.await();assert.ok(ctx.get('qcuTeams'));const response=JSON.parse(await ctx.qcuTeams.dispatch('{"action":"workspaces"}'));assert.equal(response.ok,true);assert.equal(response.value[0].id,'synthetic')}
 const active=Boolean(ctx.get('qcuTeams'));assert.equal(active,enabled)
 console.log('COLD_RESULT:'+JSON.stringify({officialLoader:true,freshProcess:true,profileLayers:profile.layers.map(l=>l.packageName),skippedBundles:profile.skippedBundles,packagePath:pkg.dir,version:pkg.version,active,syntheticProviders:true,modelCalls:0,teacherBaseServicesBooted:false}))
}finally{await ctx.fiber.dispose()}
