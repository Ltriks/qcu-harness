/** Plain-Node probe of the built QCU bootstrap, substituting only Electron and the Desktop main module. */

import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const platformAppData = process.argv[2]
const entry = pathToFileURL(resolve(process.argv[3])).href
const main = new URL('./main.js', entry).href
const electronUrl = 'qcu-entry-probe:electron'
const mainUrl = 'qcu-entry-probe:main'
const ordinary = process.argv[4] === 'ordinary'
// Reuse the actual consumer's emitted named import, including its bundler aliases.
// This makes the probe observe the same module instance as both shipped entries.
const authorityImport = readFileSync(new URL(main), 'utf8').match(/import \{[^}]*\bisQcuOfficeLaunch\b[^}]*\} from "([^"]+)";/)
if (authorityImport === null) throw new Error('Built Desktop must import the fixed-entry launch authority')
const sharedAuthorityImport = authorityImport[0].replace(JSON.stringify(authorityImport[1]), JSON.stringify(new URL(authorityImport[1], main).href))

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'electron') return { url: electronUrl, shortCircuit: true }
    const result = nextResolve(specifier, context)
    return result.url === main ? { url: mainUrl, shortCircuit: true } : result
  },
  load(url, context, nextLoad) {
    if (url === electronUrl) {
      return { format: 'module', shortCircuit: true, source: `
        const switches = new Map([['user-data-dir', '/ordinary/electron'], ['qcu-dedicated', undefined]]);
        export const app = {
          name: 'Harness',
          paths: { appData: ${JSON.stringify(platformAppData)}, userData: '/ordinary/electron', sessionData: '/ordinary/electron' },
          switches,
          isReady: () => false,
          getPath(name) { return this.paths[name]; },
          setPath(name, path) { this.paths[name] = path; },
          setName(name) { this.name = name; },
          commandLine: {
            removeSwitch(name) { switches.delete(name); },
            appendSwitch(name, value) { switches.set(name, value); },
          },
        };
      ` }
    }
    if (url === mainUrl) {
      return { format: 'module', shortCircuit: true, source: `
        ${sharedAuthorityImport}
        import assert from 'node:assert/strict';
        import { existsSync } from 'node:fs';
        import { join } from 'node:path';
        import { app } from 'electron';
        if (${JSON.stringify(ordinary)}) {
          assert.equal(app.switches.has('qcu-dedicated'), true);
          assert.equal(isQcuOfficeLaunch(app), false);
          assert.equal(app.paths.appData, ${JSON.stringify(platformAppData)});
          assert.equal(app.paths.userData, '/ordinary/electron');
          assert.equal(process.env.DSH_HOME, '/ordinary/home');
          process.stdout.write(JSON.stringify({ atMainEvaluation: true, dedicated: false, diagnosticSwitch: true }));
        } else {
        const root = join(${JSON.stringify(platformAppData)}, 'qcu-office');
        assert.equal(app.name, 'QCU Office');
        assert.equal(app.switches.has('qcu-dedicated'), true);
        assert.equal(isQcuOfficeLaunch(app), true);
        assert.equal(app.paths.appData, root);
        assert.equal(app.paths.userData, join(root, 'electron'));
        assert.equal(app.paths.sessionData, join(root, 'session-data'));
        assert.equal(app.switches.get('user-data-dir'), app.paths.userData);
        assert.equal(process.env.DSH_DESKTOP_USER_DATA_DIR, app.paths.userData);
        assert.equal(process.env.DSH_HOME, join(root, 'home'));
        for (const path of [...Object.values(app.paths), process.env.DSH_HOME]) assert.equal(existsSync(path), true);
        process.stdout.write(JSON.stringify({
          atMainEvaluation: true,
          dedicated: isQcuOfficeLaunch(app),
          paths: app.paths,
          home: process.env.DSH_HOME,
          businessConfigured: existsSync(join(process.env.DSH_HOME, 'profiles', 'desktop', 'cordis.yml')),
        }));
        }
      ` }
    }
    return nextLoad(url, context)
  },
})

await import(ordinary ? main : entry)
