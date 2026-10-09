/** Read the user's fixed signed App; generate a complete independent profile overlay only. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const resources = process.argv[2]
if (!resources) throw new Error('Official App resources argument required.')
const require = createRequire(join(resources, 'app.asar/dsh/package.json'))
const boot = require('@deepseek-ai/dsh-app-boot')
const webPath = require.resolve('@deepseek-ai/dsh-web-app/package.json')
const web = JSON.parse(readFileSync(webPath, 'utf8'))
if (web.version !== '0.2.0-rc.2') throw new Error('Fixed official rc.2 is required.')
const patches = boot.bundlePatchPaths(dirname(webPath), web.dsh.bundle)
  .flatMap(file => boot.loadOverlayPatches('qcu-dialogue-pilot', file))
const original = boot.composeEntries([patches]).find(row => row.id === 'preset-standard')
if (original?.name !== '@deepseek-ai/dsh-agent-preset' || original.config?.id !== 'standard')
  throw new Error('Unknown official Standard composition.')
const config = structuredClone(original.config)
const manager = config.plugins.filter(row => row.id === 'tool-plugin-manager')
if (manager.length !== 1 || manager[0].name !== '@deepseek-ai/dsh-plugin-manager/tools' || manager[0].disabled !== true)
  throw new Error('Unexpected official management tool declaration.')
manager[0].disabled = false
const expected = structuredClone(original.config)
expected.plugins.find(row => row.id === 'tool-plugin-manager').disabled = false
if (JSON.stringify(config) !== JSON.stringify(expected)) throw new Error('Unexpected composition change.')
const overlay = [
  { id: 'preset-standard', disabled: false, config },
  ...['preset-cordis', 'preset-minimal', 'preset-ptc'].map(id => ({ id, disabled: true })),
  { id: 'sandbox-policy', config: { mode: 'workspace-write' } },
  { id: 'approval', config: { policy: 'ask' } },
  { id: 'hmr', disabled: true },
  { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
  { id: 'plugin-manager', config: { registry: 'https://registry.npmjs.org/', fallbackRegistries: [] } },
]
const effective = boot.composeEntries([patches, overlay])
if (JSON.stringify(effective.find(row => row.id === 'preset-standard').config) !== JSON.stringify(expected))
  throw new Error('Official composition did not preserve Standard.')
const depRequire = createRequire(require.resolve('@deepseek-ai/dsh-app-boot'))
const { dump, load } = depRequire('js-yaml')
const { entryListSchema } = depRequire('@deepseek-ai/cordis-plugin-include')
// Official schema preserves !!js platform expressions in all nested plugin rows.
const yaml = dump(overlay, { schema: entryListSchema, noRefs: true })
const reloaded = load(yaml, { schema: entryListSchema })
const roundTrip = boot.composeEntries([patches, reloaded])
if (JSON.stringify(roundTrip.find(row => row.id === 'preset-standard').config) !== JSON.stringify(expected))
  throw new Error('Serialized profile lost an official Standard expression or tool.')
process.stdout.write(yaml)

