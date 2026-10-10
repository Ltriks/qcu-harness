// Build an isolated local preview, never start a browser, server or DSH.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const deps = process.env.QCU_OFFICIAL_DEPENDENCIES
if (!deps) throw new Error('Set QCU_OFFICIAL_DEPENDENCIES to a local audited dependency tree with React/ReactDOM/esbuild')
const require = createRequire(resolve(deps,'package.json'))
const root = fileURLToPath(new URL('../../../', import.meta.url))
const out = resolve(root,'.work/market-preview')
await mkdir(out,{recursive:true})
const entry = `import React from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {createMarketPlugin} from ${JSON.stringify(resolve(root,'hub/plugins/qcu-market/src/plugin.mjs'))};
import catalog from ${JSON.stringify(resolve(root,'hub/market/catalog.json'))};
const root=createRoot(document.getElementById('panel'));let main;
createMarketPlugin(React,{kind:'bundled',value:catalog},undefined).apply({slots:{inject:(key,fn)=>fn(),register:(o,c)=>{if(o.name==='main')main={o,c};return ()=>{}}},layout:{selectPanel:()=>root.render(React.createElement('p',null,'已返回隔离预览首页；此处没有DSH会话。'))}});
document.getElementById('open').onclick=()=>root.render(React.createElement(main.c,main.o.inject()));document.getElementById('open').click();`
await require('esbuild').build({stdin:{contents:entry,resolveDir:root},bundle:true,outfile:resolve(out,'app.js')})
await writeFile(resolve(out,'index.html'), await readFile(new URL('./preview.html',import.meta.url)))
console.log(`Preview built: ${out}/index.html (synthetic shell; clipboard disabled for failure testing)`)
