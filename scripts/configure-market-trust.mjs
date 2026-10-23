// Explicit release operation; accepts public material only. Never generates a signing key.
import {readFile,writeFile} from 'node:fs/promises'
import {validateTrust} from '../hub/plugins/qcu-market/src/catalog-authority.mjs'
const file=process.argv[2]
if(!file)throw Error('Usage: configure-market-trust.mjs <out-of-band public-trust.json | --legacy>')
const trust=file==='--legacy'?null:JSON.parse(await readFile(file,'utf8'))
if(trust)validateTrust(trust)
await writeFile(new URL('../hub/plugins/qcu-market/src/public-trust.mjs',import.meta.url),`// Explicit release trust configuration. PUBLIC key only; never fetched from Hub.\nexport const publicTrust=${JSON.stringify(trust)}\n`)
console.log(trust?'DYNAMIC TRUST CONFIGURED: '+trust.keyId:'LEGACY ONLY: dynamic publication is unavailable in this build')
