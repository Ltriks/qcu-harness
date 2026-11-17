import {spawn} from 'node:child_process'

function causeCode(error){
 return error?.cause?.code||error?.code||null
}

function shouldFallbackToCurl(error){
 if(process.platform!=='darwin')return false
 return ['EHOSTUNREACH','ENETUNREACH','EPERM'].includes(causeCode(error))
}

function headerMap(raw){
 const map=new Map()
 for(const line of String(raw||'').split(/\r?\n/)){
  const i=line.indexOf(':')
  if(i<=0)continue
  const key=line.slice(0,i).trim().toLowerCase()
  const value=line.slice(i+1).trim()
  if(!map.has(key))map.set(key,value)
 }
 return map
}

export async function curlFetcher(url,{headers={},signal}={}){
 if(typeof url!=='string'||!/^https?:\/\//.test(url))throw Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error('invalid url'),{code:'EINVAL'})})
 const args=['-sS','--noproxy','*','--http1.1','--max-redirs','0','--connect-timeout','8','--max-time','10','-D','-','-o','-','-w','\n__QCU_CURL_STATUS__:%{http_code}']
 for(const [k,v] of Object.entries(headers||{})){
  if(v==null)continue
  args.push('-H',`${k}: ${v}`)
 }
 args.push(url)
 const child=spawn('/usr/bin/curl',args,{stdio:['ignore','pipe','pipe']})
 const chunks=[],errChunks=[]
 let aborted=false
 const onAbort=()=>{aborted=true;try{child.kill('SIGTERM')}catch{}}
 if(signal){
  if(signal.aborted)onAbort()
  else signal.addEventListener('abort',onAbort,{once:true})
 }
 child.stdout.on('data',d=>chunks.push(d))
 child.stderr.on('data',d=>errChunks.push(d))
 const code=await new Promise((resolve,reject)=>{
  child.on('error',reject)
  child.on('close',resolve)
 })
 if(signal)signal.removeEventListener('abort',onAbort)
 if(aborted){
  const error=new Error('aborted');error.name='TimeoutError';throw error
 }
 if(code!==0){
  const detail=Buffer.concat(errChunks).toString('utf8').trim()||`curl exit ${code}`
  throw Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error(detail),{code:'EHOSTUNREACH'})})
 }
 const raw=Buffer.concat(chunks)
 const marker=Buffer.from('\n__QCU_CURL_STATUS__:')
 const at=raw.lastIndexOf(marker)
 if(at<0)throw Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error('curl status missing'),{code:'EIO'})})
 const status=Number(raw.slice(at+marker.length).toString('utf8').trim())
 const headAndBody=raw.slice(0,at)
 const sep=headAndBody.indexOf('\r\n\r\n')>=0?headAndBody.indexOf('\r\n\r\n'):headAndBody.indexOf('\n\n')
 needSep(sep>=0)
 const split=headAndBody.indexOf('\r\n\r\n')>=0?4:2
 const headerText=headAndBody.slice(0,sep).toString('utf8')
 const body=headAndBody.slice(sep+split)
 const headersMap=headerMap(headerText)
 return {
  status:Number.isInteger(status)?status:0,
  redirected:false,
  url,
  headers:{get(name){return headersMap.get(String(name||'').toLowerCase())||null}},
  body:{
   locked:false,
   async *[Symbol.asyncIterator](){yield body},
   async cancel(){},
  },
 }
}

function needSep(v){if(!v)throw Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error('curl headers missing'),{code:'EIO'})})}

export function createResilientFetcher(baseFetch=globalThis.fetch){
 return async function resilientFetcher(url,opts){
  try{
   return await baseFetch(url,opts)
  }catch(error){
   if(!shouldFallbackToCurl(error))throw error
   return curlFetcher(url,opts)
  }
 }
}
