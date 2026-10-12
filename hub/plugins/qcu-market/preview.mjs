// Same React page and state machine as the plugin; synthetic services only.
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const deps=process.env.QCU_OFFICIAL_DEPENDENCIES
if(!deps)throw Error('Set QCU_OFFICIAL_DEPENDENCIES to audited local React/ReactDOM/esbuild dependencies')
const require=createRequire(resolve(deps,'package.json'))
const here=fileURLToPath(new URL('./',import.meta.url))
const out=resolve(process.env.QCU_MARKET_PREVIEW_OUT||resolve(here,'../../../.work/market-preview'))
await mkdir(out,{recursive:true})
const entry=`import React from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {createMarketViews} from ${JSON.stringify(resolve(here,'src/market-view.mjs'))};
import {createPreviewFixture} from ${JSON.stringify(resolve(here,'preview-fixture.mjs'))};
const fixture=createPreviewFixture();window.qcuPreview=fixture;
const ready={flows:fixture.flows,unavailable:'',onDetails:()=>{document.getElementById('preview-status').textContent='隔离预览没有官方插件详情页。'}};
const availability={snapshot:()=>ready,subscribe:()=>()=>{}};
const {MarketPage}=createMarketViews(React),root=createRoot(document.getElementById('panel'));
const render=()=>root.render(React.createElement(MarketPage,{availability,onBack:()=>root.render(React.createElement('p',null,'已返回隔离预览首页。'))}));
document.getElementById('open').onclick=render;
document.getElementById('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'};
render();`
await require('esbuild').build({stdin:{contents:entry,resolveDir:here},bundle:true,outfile:resolve(out,'app.js')})
await writeFile(resolve(out,'index.html'),await readFile(new URL('./preview.html',import.meta.url)))
console.log('Synthetic preview (no DSH/network/install): '+out)
