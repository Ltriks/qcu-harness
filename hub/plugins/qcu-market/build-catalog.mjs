import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import input from './catalog-input.mjs'
import {parseMarketCatalog} from './src/catalog-core.mjs'
const text=JSON.stringify(input);parseMarketCatalog(text)
const hash=createHash('sha256').update(text).digest('hex')
await writeFile(new URL('./src/bundled-catalog.mjs',import.meta.url),`// Generated from reviewed catalog-input.mjs; no remote catalog loading.\nimport {parseMarketCatalog} from './catalog-core.mjs'\nexport const catalogText=${JSON.stringify(text)}\nexport const catalogSha256=${JSON.stringify(hash)}\nexport const bundledCatalog=parseMarketCatalog(catalogText)\n`)
