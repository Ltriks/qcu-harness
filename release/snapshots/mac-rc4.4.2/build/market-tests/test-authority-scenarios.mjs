import {mkdtempSync,mkdirSync,rmSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {publicTrust} from './extracted/package/src/public-trust.mjs'
import {CatalogAuthority,canonical} from './extracted/package/src/catalog-authority.mjs'

function assert(cond,msg){if(!cond)throw Error(msg)}
const roots=[]
function root(){
 // Avoid /tmp (symlink on macOS); CatalogAuthority rejects symlink ancestors.
 const base=join(homedir(),'.cache','qcu-market-authority-tests')
 mkdirSync(base,{recursive:true,mode:0o700})
 const r=mkdtempSync(join(base,'case-'))
 roots.push(r)
 return r
}

async function scenario(name,fetcher,expectCode){
 const auth=new CatalogAuthority(publicTrust,{root:root(),fetcher,now:()=>Date.now()})
 const snap=await auth.refresh()
 assert(String(snap.message).includes('['+expectCode+']'), name+' got '+snap.message)
 assert(/维护：阶段=/.test(snap.message), name+' missing diagnostic')
 console.log('ok', name, snap.message.slice(0,120))
}

const live=await fetch('http://192.168.1.68:8080/market/catalog.signed.json')
assert(live.status===200,'live catalog unavailable')
const goodBytes=Buffer.from(await live.arrayBuffer())

await scenario('unreachable', async()=>{throw Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error('x'),{code:'ECONNREFUSED'})})}, 'QCU-MKT-OFFLINE')
await scenario('timeout', async()=>{const e=new Error('aborted');e.name='TimeoutError';throw e}, 'QCU-MKT-TIMEOUT')
await scenario('http-503', async()=>({status:503,redirected:false,url:'http://192.168.1.68:8080/market/catalog.signed.json',headers:{get:()=>null},body:null}), 'QCU-MKT-HTTP')
const forged=JSON.parse(Buffer.from(goodBytes).toString('utf8'))
forged.signature=Buffer.alloc(64,7).toString('base64')
const forgedBytes=Buffer.from(canonical(forged))
await scenario('signature', async()=>({
 status:200,redirected:false,url:'http://192.168.1.68:8080/market/catalog.signed.json',
 headers:{get:(k)=>k==='content-length'?String(forgedBytes.length):k==='content-encoding'?null:'identity'},
 body:(async function*(){yield forgedBytes})(),
}), 'QCU-MKT-SIGNATURE')

const okRoot=root()
const ok=new CatalogAuthority(publicTrust,{root:okRoot,fetcher:async(url)=>({
 status:200,redirected:false,url,
 headers:{get:(k)=>k==='content-length'?String(goodBytes.length):k==='content-encoding'?null:'identity'},
 body:(async function*(){yield goodBytes})(),
}),now:()=>Date.now()})
const fresh=await ok.refresh()
assert(fresh.state==='fresh', 'live signed catalog should verify: '+fresh.message)
console.log('ok live-verify', fresh.state, 'revision', fresh.catalog?.revision)

for(const r of roots)rmSync(r,{recursive:true,force:true})
console.log('PASS authority scenarios')
