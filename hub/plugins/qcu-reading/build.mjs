import {readFile, writeFile} from 'node:fs/promises'
import {Script} from 'node:vm'
import {verifyVendor} from './vendor.mjs'
await verifyVendor()
const root = new URL('./', import.meta.url)
const parts = await Promise.all(['protocol', 'shelf', 'reports', 'controller', 'view', 'plugin'].map(async name =>
  (await readFile(new URL('src/' + name + '.mjs', root), 'utf8')).replace(/^import .*\n/gm, '').replace(/\bexport /g, '')))
const code = `// Generated official lazy-CJS Client; shared host React only.\nwindow.__ModuleLoader__.load({id:'qcu-reading',factory(require){\nconst React=require('react');\n${parts.join('\n')}\nreturn createPlugin(React);\n}});\n`
new Script(code)
await writeFile(new URL('client.js', root), code)
console.log('Built qcu-reading Client: ' + Buffer.byteLength(code) + ' bytes')
