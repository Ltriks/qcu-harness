import {readFile,writeFile} from 'node:fs/promises'
const read=name=>readFile(new URL(name,import.meta.url),'utf8')
const sources=await Promise.all(['theme','tasks','personalization','view','plugin'].map(name=>read(`src/${name}.mjs`)))
const client=(await read('client.template.js')).replace('__QCU_ICON_DATA__',(await read('icon-data.txt')).trim()).replace('__QCU_TEACHER_SOURCE__',sources.join('\n').replace(/^export /gm,''))
await writeFile(new URL('client.js',import.meta.url),client)
console.log('Built QCU home client')
