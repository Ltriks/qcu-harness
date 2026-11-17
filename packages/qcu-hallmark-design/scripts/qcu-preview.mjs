import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const [slug,output]=process.argv.slice(2),pins=JSON.parse(fs.readFileSync(new URL('./qcu-previews.json',import.meta.url),'utf8')),pin=pins[slug];
if(!pin||!output||path.isAbsolute(output))throw Error('Use qcu-preview.mjs THEME RELATIVE-OUTPUT.jpg inside the project');
const cwd=fs.realpathSync(process.cwd()),dest=path.resolve(cwd,output);if(!dest.startsWith(cwd+path.sep))throw Error('Output must stay in project');
for(let p=path.dirname(dest);p!==cwd;p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Linked output directory refused');
const response=await fetch(pin.url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(response.status!==200)throw Error('Preview unavailable; use the bundled theme text and report preview unverified');
const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>pin.bytes)throw Error('Preview size mismatch');chunks.push(chunk)}const b=Buffer.concat(chunks);if(b.length!==pin.bytes||createHash('sha256').update(b).digest('hex')!==pin.sha256)throw Error('Preview integrity mismatch');
fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx',mode:0o644});console.log(dest);
