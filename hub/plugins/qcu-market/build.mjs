import { readFile, writeFile } from 'node:fs/promises'
import { Script } from 'node:vm'
const root=new URL('./',import.meta.url)
const parts=await Promise.all(['flow','icons','styles','loop-plugin'].map(async name=>(await readFile(new URL(`src/${name}.mjs`,root),'utf8')).replace(/^import .*\n/gm,'').replaceAll('export ','')))
const out=`// Generated QCU market pilot.3.1; fixed Host command bridge, no model submission.\nwindow.__ModuleLoader__.load({id:'qcu-market',factory(require){\nconst React=require('react');\n${parts.join('\n')}\nreturn createLoopPlugin(React);\n}});\n`
new Script(out,{filename:'client.js'});await writeFile(new URL('client.js',root),out)
console.log('Built pilot.3.1 client; runtime import React only; no automatic submit or installer RPC.')
