import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import input from './catalog-input.mjs'
import {parseMarketCatalog} from './src/catalog-core.mjs'
const text=JSON.stringify(input);parseMarketCatalog(text)
for(const item of input.entries)if(item.kind==='skill'&&createHash('sha256').update(await readFile(new URL(`../../../skills/${item.id}/SKILL.md`,import.meta.url))).digest('hex')!==item.release.skillSha256)throw Error('Reviewed instruction hash mismatch: '+item.id)
const hash=createHash('sha256').update(text).digest('hex')
await writeFile(new URL('./src/bundled-catalog.mjs',import.meta.url),`// Generated from reviewed catalog-input.mjs; no remote catalog loading.\nimport {parseMarketCatalog} from './catalog-core.mjs'\nexport const catalogText=${JSON.stringify(text)}\nexport const catalogSha256=${JSON.stringify(hash)}\nexport const bundledCatalog=parseMarketCatalog(catalogText)\n`)
