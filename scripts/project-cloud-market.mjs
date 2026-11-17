// Project only already-signed, approved LAN entries to a separately pinned cloud origin.
// Run on the existing publisher. Private signing material never leaves this machine.
import {readFile,mkdir,copyFile,writeFile,lstat} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {homedir} from 'node:os'
import {createPublicKey,verify,createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {canonical} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
const [publicRoot,outDir,nodePath]=process.argv.slice(2).map(p=>resolve(p))
const hash=b=>createHash('sha256').update(b).digest('hex'),fail=m=>{throw Error(m)}
const signing=join(homedir(),'Library/Application Support/qcu-hub-admin/signing'),trust=JSON.parse(await readFile(join(signing,'public-trust.json'),'utf8'))
if(trust.keyId!=='2bda63cbcde1bd5bfc978b89cd3530602e7ebc2f357de739957e744a16053f5f'||trust.origin!=='http://192.168.1.68:8080')fail('Unexpected publisher trust')
const pointer=JSON.parse(await readFile(join(publicRoot,'current.json'),'utf8'))
if(!/^[1-9][0-9]*-[0-9a-f]{64}$/.test(pointer.snapshot))fail('Invalid publisher pointer')
const raw=await readFile(join(publicRoot,'snapshots',pointer.snapshot,'catalog.signed.json')),envelope=JSON.parse(raw),bytes=Buffer.from(envelope.payload,'base64'),key=createPublicKey({key:Buffer.from(trust.spki,'base64'),format:'der',type:'spki'})
if(!verify(null,bytes,key,Buffer.from(envelope.signature,'base64')))fail('Invalid original signature')
const payload=JSON.parse(bytes)
if(payload.origin!==trust.origin||payload.revision!==pointer.revision||payload.expiresAt<=Date.now())fail('Expired or changed source')
let prior=null
try{prior=JSON.parse(await readFile(join(outDir,'projection.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
if(prior?.sourceRevision===pointer.revision&&prior.expiresAt>Date.now()+7*86400000){console.log(JSON.stringify({...prior,unchanged:true}));process.exit(0)}
const origin='https://111.229.103.201';await mkdir(join(outDir,'plugins'),{recursive:true,mode:0o700});await mkdir(join(outDir,'market'),{recursive:true,mode:0o700})
for(const item of payload.catalog.entries){const r=item.release;if(!/^qcu-[a-z0-9.-]+-[a-f0-9]{64}\.tgz$/.test(r.file))fail('Invalid archive');const source=join(publicRoot,'archives',r.file),s=await lstat(source),b=await readFile(source);if(!s.isFile()||s.isSymbolicLink()||b.length!==r.bytes||hash(b)!==r.sha256)fail('Archive integrity mismatch');await copyFile(source,join(outDir,'plugins',r.file));r.origin=origin}
payload.origin=origin;payload.revision=Math.max(payload.revision,prior?.revision??0)+1;payload.catalog.revision=payload.revision;payload.issuedAt=Date.now();payload.expiresAt=payload.issuedAt+30*86400000
const input={trust:{...trust,origin},root:signing,payload},helper=join(import.meta.dirname,'qcu-market-sign.mjs')
const signed=await new Promise((resolve,reject)=>{const child=execFile(nodePath,[helper,'sign'],{maxBuffer:1048576,timeout:15000},(error,stdout)=>error?reject(Error('Cloud projection signing failed')):resolve(JSON.parse(stdout)));child.stdin.end(JSON.stringify(input))})
await writeFile(join(outDir,'market/catalog.signed.json'),Buffer.from(signed.raw,'base64'),{mode:0o600})
const proof={origin,revision:payload.revision,entries:payload.catalog.entries.length,fingerprint:signed.fingerprint,expiresAt:payload.expiresAt,privateKeyExported:false,sourceRevision:pointer.revision}
await writeFile(join(outDir,'projection.json'),JSON.stringify(proof,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(proof))
