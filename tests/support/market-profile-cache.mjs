// Actual profile resolution interception + Loader, against copied immutable archive files.
import {mkdir,cp,rm,readFile} from 'node:fs/promises'
import {join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {Context,load,req,work,archiveDir,startHost} from './market-http-fixture.mjs'
const {PluginPackages}=await import(pathToFileURL(join(work,'official-app-boot/index.mjs'))),{Loader}=await load('@deepseek-ai/cordis-plugin-loader')
const dir=join(work,'profile-cache-'+crypto.randomUUID()),profiles=join(dir,'profiles'),profile=join(profiles,'desktop'),local=join(profile,'node_modules/qcu-market')
await mkdir(dirname(local),{recursive:true});await cp(join(work,'old/package'),local,{recursive:true})
const peers=JSON.parse(await readFile(archiveDir+'/package.json','utf8')).peerDependencies
const entries=Object.keys(peers).map(name=>({name,packageDir:dirname(req.resolve(name+'/package.json')),version:peers[name],declarer:join(dir,'installation/package.json'),scope:'installation'}))
const resolution={profilesDir:profiles,profileDir:profile,localPackageNames:['qcu-market'],entries,linkedRoots:[]}
const ctx=new Context(),packages=new PluginPackages(ctx,{resolution}),loader=new Loader(ctx,{baseUrl:pathToFileURL(profile+'/cordis.yml').href});loader.write=()=>{}
let h
try{
 const old=await loader.import('qcu-market');const oldVersion=packages.packageOf('qcu-market',loader.ctx.baseUrl).version
 await rm(local,{recursive:true});await cp(archiveDir,local,{recursive:true});packages.replace(resolution)
 const cached=await loader.import('qcu-market'),newVersion=packages.packageOf('qcu-market',loader.ctx.baseUrl).version
 h=await startHost({marketModule:cached});const response=await h.raw('qcuMarket/prepare',{id:crypto.randomUUID()})
 if(cached!==old||response.status!==404||oldVersion===newVersion)throw Error('profile cache reproduction did not match')
 console.log(JSON.stringify({resolver:'official PluginPackages runtime interception',oldVersion,newVersion,moduleIdentityUnchanged:cached===old,http:response.status}))
}finally{await h?.close();await ctx.fiber.dispose();await rm(dir,{recursive:true,force:true})}
