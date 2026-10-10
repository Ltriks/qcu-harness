import {pathToFileURL} from 'node:url'
import {Context,load,startHost,startClient,attachDownload} from './market-http-fixture.mjs'
const {Loader}=await load('@deepseek-ai/cordis-plugin-loader')
const ctx=new Context(),loader=new Loader(ctx,{baseUrl:pathToFileURL(process.argv[2]+'/cordis.yml').href});loader.write=()=>{}
const module=await loader.import('qcu-market'),h=await startHost({marketModule:module})
let d,c
try{
 const response=await h.raw('qcuMarket/cancel',{id:crypto.randomUUID()});const reply=await response.json()
 if(response.status!==200||!reply.result.ok)throw Error('cold route failed')
 const status=await h.raw('qcuMarket/status')
 d=await attachDownload(h);c=await startClient(h);await c.flow().status();await c.flow().prepare();if(c.flow().state.phase!=='review')throw Error(c.flow().state.message);await c.flow().decline()
 console.log(JSON.stringify({prepare:true,decline:true,cancel:true,statusHttp:status.status,activeDescriptors:h.host.typert.local.list().filter(d=>d.namespace==='qcuMarket').length}))
}finally{await c?.close();await d?.close();await h.close();await ctx.fiber.dispose()}
