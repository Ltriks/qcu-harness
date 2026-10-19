import {readFile,writeFile} from 'node:fs/promises'
import {parseVersionHistory} from './src/version-model.mjs'
const text=JSON.stringify(JSON.parse(await readFile(new URL('../../market/version-history.json',import.meta.url),'utf8')))
parseVersionHistory(text)
await writeFile(new URL('./src/reviewed-versions.mjs',import.meta.url),`// Generated from reviewed local version-history.json; no remote loading or install authority.\nimport {parseVersionHistory} from './version-model.mjs'\nexport const releaseHistory=parseVersionHistory(${JSON.stringify(text)})\n`)
