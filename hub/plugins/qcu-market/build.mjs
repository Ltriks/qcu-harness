import { readFile, writeFile } from 'node:fs/promises'
import { Script } from 'node:vm'
const root=new URL('./',import.meta.url)
const {version}=JSON.parse(await readFile(new URL('package.json',root),'utf8'))
const parts=await Promise.all(['trusted-release','remote-contract','direct-flow','icons','styles','loop-plugin'].map(async name=>(await readFile(new URL(`src/${name}.mjs`,root),'utf8')).replace(/^import .*\n/gm,'').replaceAll('export ','')))
const out=`// Generated QCU market ${version}; explicit user confirmation, no model/session dependency.\nwindow.__ModuleLoader__.load({id:'qcu-market',factory(require){\nconst React=require('react');\n${parts.join('\n')}\nreturn createLoopPlugin(React);\n}});\n`
new Script(out,{filename:'client.js'});await writeFile(new URL('client.js',root),out)
console.log(`Built ${version} client; runtime import React only; official install RPC only after explicit confirmation.`)
