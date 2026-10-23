// Trusted fixed helper. Uploaded source is NEVER imported or executed.
import {generateKeyPairSync,sign,createPublicKey} from 'node:crypto'
import {resolve,join,dirname,basename} from 'node:path'
import {lstat} from 'node:fs/promises'
import {canonical,strictJson,authorityDigest,privateDirectory,privateRead,immutableWrite,verifyCatalog,validateTrust} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
const check=(v)=>{if(!v)throw Error('signing.refused')}
async function rootOK(root){
 check(resolve(root)===root&&basename(root)==='signing')
 for(let p=dirname(root);;p=dirname(p)){
  check(!(await lstat(join(p,'.git')).catch(e=>{if(e.code==='ENOENT')return null;throw e})))
  check(!((await lstat(join(p,'manifest.json')).catch(()=>null))&&(await lstat(join(p,'catalog.json')).catch(()=>null))))
  check(!((await lstat(join(p,'current.json')).catch(()=>null))&&(await lstat(join(p,'snapshots')).catch(()=>null))))
  if(p===dirname(p))break
 }
 // The chosen root must belong to an already initialized private administrator
 // store, never an arbitrary public/static directory supplied to an init command.
 const parent=dirname(root);await privateDirectory(parent)
 const state=JSON.parse((await privateRead(join(parent,'state.json'),15*1048576)).toString('utf8'))
 const auth=JSON.parse((await privateRead(join(parent,'admin-auth.json'),4096)).toString('utf8'))
 check(state.schemaVersion===2&&state.records&&auth.schemaVersion===2&&auth.username==='qcu-admin')
}
try{
 if(process.argv[2]==='init'){
  const root=process.argv[3];await rootOK(root);check(!(await lstat(root).catch(()=>null)));await privateDirectory(root,{create:true})
  const {publicKey,privateKey}=generateKeyPairSync('ed25519'),der=publicKey.export({format:'der',type:'spki'})
  await immutableWrite(root,'signing.key',privateKey.export({format:'pem',type:'pkcs8'}))
  const trust={schema:1,keyId:authorityDigest(der),origin:'http://192.168.1.68:8080',spki:der.toString('base64')}
  await immutableWrite(root,'public-trust.json',Buffer.from(canonical(trust)));process.stdout.write(canonical(trust))
 }else{
  const chunks=[];let size=0;for await(const b of process.stdin){size+=b.length;check(size<=1048576);chunks.push(b)}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));let output
  if(process.argv[2]==='configuration'){
   await rootOK(input.root);await privateDirectory(input.root);validateTrust(input.trust,{test:input.test===true})
   const path=join(input.root,'signing.key');check(((await lstat(path)).mode&0o777)===0o600)
   check(createPublicKey(await privateRead(path,8192)).export({format:'der',type:'spki'}).toString('base64')===input.trust.spki)
   output={configured:true}
  }else if(process.argv[2]==='sign'){
   await rootOK(input.root);await privateDirectory(input.root);validateTrust(input.trust,{test:input.test===true})
   const path=join(input.root,'signing.key');check(((await lstat(path)).mode&0o777)===0o600)
   const payload=Buffer.from(canonical(input.payload)),envelope={schema:1,keyId:input.trust.keyId,payload:payload.toString('base64'),signature:sign(null,payload,await privateRead(path,8192)).toString('base64')}
   const raw=Buffer.from(canonical(envelope));verifyCatalog(raw,input.trust,{test:input.test===true});output={raw:raw.toString('base64'),fingerprint:authorityDigest(raw)}
  }else if(process.argv[2]==='verify'){
   const raw=Buffer.from(input.raw,'base64'),accepted=verifyCatalog(raw,input.trust,{test:input.test===true,allowExpired:input.allowExpired===true});output={fingerprint:accepted.fingerprint,payload:accepted.payload}
  }else throw Error('command')
  const text=canonical(output);check(Buffer.byteLength(text)<=1048576);process.stdout.write(text)
 }
}catch{process.stderr.write('signing.refused\n');process.exitCode=2}
