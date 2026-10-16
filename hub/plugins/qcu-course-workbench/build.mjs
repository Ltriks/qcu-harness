import {readFile,writeFile} from 'node:fs/promises'
import {Script} from 'node:vm'
const root=new URL('./',import.meta.url)
const parts=await Promise.all(['protocol','artifact-html','styles','controller','view','plugin'].map(async n=>(await readFile(new URL('src/'+n+'.mjs',root),'utf8')).replace(/^import .*\n/gm,'').replace(/\bexport /g,'')))
const code=`// Generated official lazy-CJS Client; shared host React only.\nwindow.__ModuleLoader__.load({id:'qcu-course-workbench',factory(require){\nconst React=require('react');\n${parts.join('\n')}\nreturn createPlugin(React);\n}});\n`
new Script(code,{filename:'qcu-course-workbench/client.js'})
await writeFile(new URL('client.js',root),code)
console.log('Built Course Studio: '+Buffer.byteLength(code)+' bytes; external React only')
