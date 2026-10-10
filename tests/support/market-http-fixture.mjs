// Actual official LIB Host Connection/Gateway + LIB Client Connection/Gateway.
// Only credentials, UI slots, downloader destination and manager business backend are fixtures.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {createServer} from 'node:http'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
export const dependencies=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!dependencies)throw Error('QCU_OFFICIAL_DEPENDENCIES required; no dependency downloads allowed')
export const req=createRequire(pathToFileURL(dependencies+'/package.json'))
export const load=n=>import(pathToFileURL(req.resolve(n)))
export const {Context}=req('@deepseek-ai/cordis')
const cordis=req('@deepseek-ai/cordis'),React=req('react'),zod=req('zod')
const {TypertRegistry}=await load('@deepseek-ai/dsh-typert-registry')
const {TypertGatewayService}=await load('@deepseek-ai/dsh-api-gateway')
const {TypertRemoteService}=await load('@deepseek-ai/dsh-typert-protocol')
const hostConnection=await load('@deepseek-ai/dsh-client-connection')
const {TYPERT}=await load('@deepseek-ai/dsh-plugin-manager/typert')
const {default:managerRemote}=await load('@deepseek-ai/dsh-plugin-manager/remote')
export const work=fileURLToPath(new URL('../../.work/http-e2e/',import.meta.url))
export const archiveDir=join(work,'market/package')
export const tick=()=>new Promise(r=>setImmediate(r))
const methods=['listBundles','listPlugins','inspect','installBundle','waitForInstall','cancelInstall','setBundleEnabled','setPluginEnabled']
export async function startHost({marketDir=archiveDir,marketModule,backend={}}={}){
 const host=new Context(),routes=[],credentials=new Map(),calls=[]
 host.provide('credentials',{readRecord:async k=>credentials.get(k),modifyRecord:async(k,f)=>{const next=await f(credentials.get(k));if(next!==undefined)credentials.set(k,next);return next??credentials.get(k)}})
 host.provide('webServer',{register(route){routes.push(route);return()=>routes.splice(routes.indexOf(route),1)},registerUpgrade:()=>()=>{},tapIndex:()=>()=>{},port:0})
 new TypertRegistry(host)
 const c=host.plugin({inject:hostConnection.inject,apply:hostConnection.apply});await c.await()
 const g=host.plugin(TypertGatewayService,{});await g.await()
 const state={bundles:[],rows:[],mutations:[],pending:null}
 class Manager extends TypertRemoteService{
  constructor(ctx){super(ctx,'pluginManager')}
  listBundles(){return state.bundles}
  listPlugins(){return state.rows}
  inspect(spec,options,signal){assert.ok(spec.endsWith('.tgz'));assert.deepEqual(options,{});assert.ok(signal instanceof AbortSignal);return {status:'accepted',kind:'tarball',bundle:null,registry:null}}
  async installBundle(spec,options){state.mutations.push({method:'installBundle',spec,options});assert.equal(options.enabled,false);assert.deepEqual(Object.keys(options).sort(),['enabled','registry','requestId']);if(backend.install)return backend.install(state,spec,options);const {release}=await import(pathToFileURL(marketDir+'/src/trusted-release.mjs'));state.bundles=[{name:release.id,version:release.version,installed:true,enabled:false,optional:false,removable:true,rows:[],overrides:[]}];state.rows=[{moduleName:release.id,entryId:'fixture:coach',patchId:release.id,enabled:false,fiberPhase:null}];return {changed:true,application:'applied',stage:'enable',target:release.id,bundle:release.id,enabled:false}}
  waitForInstall(requestId){return backend.wait?.(state,requestId)??null}
  cancelInstall(requestId){state.mutations.push({method:'cancelInstall',requestId});return backend.cancel?.(state,requestId)??{status:'not-running'}}
  setBundleEnabled(name,enabled){state.mutations.push({method:'setBundleEnabled',name,enabled});assert.equal(name,'qcu-study-coach');assert.equal(enabled,true);state.bundles[0].enabled=true;return {changed:true,application:'applied',stage:'enable',target:name,enabled}}
  setPluginEnabled(id,enabled){state.mutations.push({method:'setPluginEnabled',id,enabled});assert.equal(id,'fixture:coach');assert.equal(enabled,true);state.rows[0].enabled=true;state.rows[0].fiberPhase='active';return {changed:true,application:'applied',stage:'enable',target:id,enabled}}
 }
 const manager=host.plugin({inject:['typert'],apply(ctx){new Manager(ctx);ctx.typert.register({...TYPERT,invocations:TYPERT.invocations.filter(d=>methods.includes(d.method)),schemas:[],model:{services:[],events:[],objects:[]}})}});await manager.await()
 const module=marketModule??await import(pathToFileURL(marketDir+'/index.js'))
 let fork=host.plugin(module);await fork.await()
 assert.equal(routes.length,1);assert.equal(routes[0].path,'/api')
 const server=createServer((request,response)=>{if(request.url.startsWith('/?')){if(host.connection.authorizeIndex(request,response)){response.writeHead(200);response.end('fixture')}return}calls.push({method:request.method,path:request.url});void routes[0].handler(request,response)})
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)})
 const origin='http://127.0.0.1:'+server.address().port
 const login=await fetch(host.connection.authenticatedUrl(origin),{redirect:'manual'});assert.equal(login.status,303)
 const cookie=login.headers.get('set-cookie').split(';',1)[0]
 const send=(path,init={})=>fetch(new URL(path,origin+'/'),{...init,headers:{...Object.fromEntries(new Headers(init.headers)),cookie}})
 const raw=(endpoint,args={},extra={})=>send('/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}}),...extra})
 return {host,calls,state,origin,send,raw,module,get fork(){return fork},async remount(){await fork.dispose();fork=host.plugin(module);await fork.await()},async close(){await host.fiber.dispose();server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
export async function attachDownload(h,{mode='ok'}={}){
 const dir=await mkdtemp(join(tmpdir(),'qcu-http-')),cache=join(dir,'cache')
 const {release}=await import(pathToFileURL(archiveDir+'/src/trusted-release.mjs'))
 const {fetchPinned}=await import(pathToFileURL(archiveDir+'/src/host-core.mjs'))
 const inputs=JSON.parse(await readFile(join(work,'inputs.json'),'utf8')),bytes=await readFile(inputs.coach.path)
 let count=0,current=mode,startedResolve;let started=new Promise(r=>startedResolve=r)
 const sockets=new Set()
 const server=createServer((r,s)=>{count++;startedResolve();assert.equal(r.url,'/plugins/'+release.file);if(current==='slow'){r.on('close',()=>{});return}if(current==='offline'){s.writeHead(503);s.end();return}s.writeHead(200,{'content-length':bytes.length});s.end(current==='bad-hash'?Buffer.alloc(bytes.length):bytes)})
 server.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s))})
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)})
 const url='http://127.0.0.1:'+server.address().port
 const wire=async(input,options)=>{assert.equal(input,release.origin+'/plugins/'+release.file);const response=await fetch(url+'/plugins/'+release.file,options);return new Response(response.body,{status:response.status,headers:response.headers})}
 const apply=()=>{const p=h.host.get('qcuMarket').packages;p.download=options=>fetchPinned({...options,root:cache,fetcher:wire})}
 apply()
 return {cache,release,count:()=>count,started:()=>started,setMode(value){current=value;started=new Promise(r=>startedResolve=r)},apply,async close(){for(const s of sockets)s.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}}
}
async function clientBundle(file){let handoff;vm.runInNewContext(await readFile(file,'utf8'),{window:{__ModuleLoader__:{load:v=>handoff=v}},AbortController,AbortSignal,URL,Headers,Response,Request,Uint8Array,TextEncoder,TextDecoder,DOMException,crypto,setTimeout,clearTimeout,setInterval,clearInterval,console,queueMicrotask});return handoff.factory(n=>{if(n==='@deepseek-ai/cordis')return cordis;if(n==='react')return React;if(n==='zod')return zod;throw Error('Unexpected client external '+n)})}
export async function startClient(h,{marketDir=archiveDir}={}){
 const ctx=new Context();new TypertRegistry(ctx)
 const conn=await clientBundle(req.resolve('@deepseek-ai/dsh-client-connection/client'))
 // Real official HTTP serializer. Only a fetch base/cookie adapter; no RPC handler replacement.
 conn.installConnection(ctx,{location:{hostname:'127.0.0.1',origin:h.origin,search:''},transport:{fetch:h.send,openStream:async function*(_endpoint,_payload,signal){await new Promise(r=>signal.aborted?r():signal.addEventListener('abort',r,{once:true}))}}})
 const gateway=await clientBundle(req.resolve('@deepseek-ai/dsh-api-gateway/client'))
 const g=ctx.plugin({inject:gateway.inject,apply:gateway.apply});await g.await()
 const unmountManager=await ctx.remote.$mount(managerRemote)
 const entries=[]
 class FixtureSlots extends cordis.Service{constructor(ctx){super(ctx,'slots')}inject(_name,fn){return fn()}register(options,component){const item={options,component};entries.push(item);return this.ctx.effect(()=>()=>{const n=entries.indexOf(item);if(n>=0)entries.splice(n,1)})}}
 new FixtureSlots(ctx)
 ctx.provide('layout',{selectPanel(){}});ctx.provide('pluginNavigation',{openBundle(){}})
 const plugin=await clientBundle(marketDir+'/client.js');let fork=ctx.plugin(plugin);await fork.await();await tick();await tick()
 const flow=()=>entries.find(e=>e.options.name==='main').options.inject().availability.snapshot().flow
 return {ctx,flow,async remount(){await fork.dispose();fork=ctx.plugin(plugin);await fork.await();await tick();await tick()},async close(){await fork.dispose();await unmountManager();await ctx.fiber.dispose()}}
}
