import './build-catalog.mjs'
import './build-versions.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import {createHash} from 'node:crypto'
import {marketRuntime} from './src/remote-contract.mjs'
import {publicTrust} from './src/public-trust.mjs'
import {validateTrust} from './src/catalog-authority.mjs'
if(publicTrust)validateTrust(publicTrust)
console.log(publicTrust?'DYNAMIC TRUST PINNED: '+publicTrust.keyId:'LEGACY ONLY / NOT DYNAMIC-PRODUCTION-READY: no out-of-band public trust configured')
const root=new URL('./',import.meta.url)
if(createHash('sha256').update(await readFile(new URL('src/update-policy.mjs',root))).digest('hex')!==marketRuntime.updatePolicySha256)throw Error('Update policy identity mismatch')
const {version}=JSON.parse(await readFile(new URL('package.json',root),'utf8'))
const parts=await Promise.all(['trusted-release','catalog-core','bundled-catalog','remote-contract','update-policy','update-model','direct-flow','update-flow','update-view','catalog-runtime','icons','styles','teacher-tools','teacher-view','version-model','reviewed-versions','market-view','loop-plugin'].map(async name=>(await readFile(new URL(`src/${name}.mjs`,root),'utf8')).replace(/^import .*\n/gm,'').replaceAll('export ','')))
const out=`// Generated QCU market ${version}; explicit user confirmation, no model/session dependency.\nwindow.__ModuleLoader__.load({id:'qcu-market',factory(require){\nconst React=require('react');\n${parts.join('\n')}\nreturn createLoopPlugin(React);\n}});\n`
new Script(out,{filename:'client.js'});await writeFile(new URL('client.js',root),out)
console.log(`Built ${version} client; runtime import React only; official install RPC only after explicit confirmation.`)
