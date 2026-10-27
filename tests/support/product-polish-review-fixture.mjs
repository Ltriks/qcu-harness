import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {feedbackCanonical} from '../../hub/plugins/qcu-market/src/feedback-schema.mjs'
import {marketRuntime} from '../../hub/plugins/qcu-market/src/remote-contract.mjs'
export const reviewHash=v=>createHash('sha256').update(v).digest('hex')
export const reviewPreview=()=>({category:'ui',title:'合成匿名界面',steps:'打开工具市场',expected:'按钮完整显示',actual:'合成按钮换行',knownVersions:{market:marketRuntime.version,runtime:'unobserved'},text:'匿名合成预览，无真实资料。'})
export const reviewSubmission=(requestId='1'.repeat(64),preview=reviewPreview())=>({...preview,requestId,confirmed:true,previewSha256:reviewHash(feedbackCanonical(preview))})
export function reviewArchive(files){
 const chunks=[]
 for(const [path,text]of Object.entries(files).sort()){
  const bytes=Buffer.from(text),h=Buffer.alloc(512);h.write('package/'+path);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(bytes.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);chunks.push(h,bytes,Buffer.alloc((512-bytes.length%512)%512))
 }
 return gzipSync(Buffer.concat([...chunks,Buffer.alloc(1024)]),{mtime:0})
}
