import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {out} from './build-font-settings-preview.mjs';
export async function servePreview(){
 const server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=name==='/'?'index.html':['/app.js','/before-app.js'].includes(name)?name.slice(1):null;
  if(req.method!=='GET'||!file){res.writeHead(404).end();return;}
  try{res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8','cache-control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'"}).end(await readFile(join(out,'preview',file)));}catch{res.writeHead(500).end();}
 });
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 return{server,url:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const host=await servePreview();console.log(host.url);for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void host.close().then(()=>process.exit(0)));}
