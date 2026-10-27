import {createServer} from 'node:http'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {join} from 'node:path'
import {out} from './build-product-polish-preview.mjs'
import {FeedbackReceiptJournal} from '../hub/plugins/qcu-market/src/feedback-storage.mjs'
import {FeedbackTransport} from '../hub/plugins/qcu-market/src/feedback-host.mjs'
export async function serve(){
 const child=spawn('rtk',['proxy','python3','tests/support/product-polish-services.py'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
 const services=await new Promise((resolve,reject)=>{let raw='';const timer=setTimeout(()=>reject(Error('services.timeout')),10000);child.stdout.on('data',b=>{raw+=b;try{const v=JSON.parse(raw);clearTimeout(timer);resolve(v)}catch{}});child.once('exit',()=>{clearTimeout(timer);reject(Error('services.exited'))})})
 const privateRoot=await mkdtemp('/private/tmp/qcu-p16-host-preview-');let mode='normal';const calls=[]
 const createTransport=()=>new FeedbackTransport({testOrigin:services.feedback,runtime:'0.2.0-rc.2',journal:new FeedbackReceiptJournal(join(privateRoot,'receipts')),fetcher:async(url,options)=>{
  calls.push({method:url.endsWith('/submit')?'submit':'status'})
  if(mode==='unreachable')throw Error('Synthetic offline fixture')
  if(mode==='rejected'&&url.endsWith('/submit')){const body=JSON.parse(options.body);options={...options,body:JSON.stringify({...body,confirmed:false})}}
  return fetch(url,options)
 }});
 let transport=createTransport()
 const server=createServer(async(req,res)=>{
  try{
   if(req.method==='POST'&&['/__feedback/submit','/__feedback/status','/__feedback/receipts'].includes(req.url)){
    const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>16384)throw Error('limit');chunks.push(b)}
    let reply;const cancelled=new AbortController();res.once('close',()=>{if(!res.writableEnded)cancelled.abort()})
    if(req.url.endsWith('/receipts'))reply=await transport.receipts()
    else{reply=await transport.post(req.url.endsWith('submit')?'submit':'status',Buffer.concat(chunks).toString('utf8'),cancelled.signal);if(mode==='unknown'&&req.url.endsWith('submit'))reply=JSON.stringify({ok:false,error:'feedback.unavailable',unknown:true,tracked:true})}
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(reply);return
   }
   const name=new URL(req.url,'http://localhost').pathname,file=name==='/'?'index.html':name==='/app.js'?'app.js':null
   if(req.method!=='GET'||!file){res.writeHead(404).end();return}
   res.writeHead(200,{'content-type':file.endsWith('js')?'text/javascript':'text/html; charset=utf-8','cache-control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"}).end(await readFile(join(out,'preview',file)))
  }catch{res.writeHead(503).end('{}')}
 })
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)})
 return{url:'http://127.0.0.1:'+server.address().port,services,setMode:value=>{mode=value},feedbackCalls:()=>calls.slice(),restartHost:()=>{transport.dispose();transport=createTransport()},close:async()=>{transport.dispose();server.closeAllConnections();await new Promise(r=>server.close(r));child.kill('SIGINT');await new Promise(r=>child.once('exit',r));await rm(privateRoot,{recursive:true,force:true})}}
}
if(process.argv[1]===new URL(import.meta.url).pathname){const s=await serve();console.log(JSON.stringify({teacher:s.url,admin:s.services.admin,synthetic:true,account:'qcu-admin',password:'synthetic-preview-password'}));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void s.close().then(()=>process.exit(0)))}
