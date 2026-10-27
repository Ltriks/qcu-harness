import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
export const sdk=process.env.QCU_OFFICIAL_DEPENDENCIES??'/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source'
export const require=createRequire(join(sdk,'package.json'))
export const out=resolve(process.env.QCU_PRODUCT_POLISH_OUT??'.work/product-polish-review')
export async function build(){
 const theme=join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-theme'),layout=join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-layout')
 const clientRoot=resolve(process.env.QCU_PRODUCT_POLISH_CLIENTS??join(out,'clients'))
 if(!process.env.QCU_PRODUCT_POLISH_CLIENTS){await mkdir(join(clientRoot,'qcu-market'),{recursive:true});await copyFile('hub/plugins/qcu-market/client.js',join(clientRoot,'qcu-market/client.js'));await copyFile('hub/plugins/qcu-market/package.json',join(clientRoot,'qcu-market/package.json'))}
 const clients=[],inputs=[]
 for(const id of ['qcu-branding','qcu-market']){const actual=JSON.parse(await readFile(join(clientRoot,id,'package.json'),'utf8')),expected=JSON.parse(await readFile(id==='qcu-branding'?'tools/teacher-branding/package.json':'hub/plugins/qcu-market/package.json','utf8'));if(actual.name!==id||actual.version!==expected.version)throw Error('preview.client-identity');const client=await readFile(join(clientRoot,id,'client.js'),'utf8');clients.push(client);inputs.push({id,version:actual.version,path:join(clientRoot,id,'client.js'),bytes:Buffer.byteLength(client),sha256:createHash('sha256').update(client).digest('hex')})}
 const contents=`import React from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {ThemeRuntime} from ${JSON.stringify(join(theme,'src/client/index.ts'))};
import {ThemePresenter} from ${JSON.stringify(join(layout,'src/client/theme-presenter.ts'))};
import {bootThemeInjections} from ${JSON.stringify(join(theme,'src/boot-theme.ts'))};
import {createProductPolishHost} from ${JSON.stringify(resolve('tests/support/product-polish-host.mjs'))};
const plugins={};window.__ModuleLoader__={load:m=>plugins[m.id]=m.factory(n=>{if(n!=='react')throw Error(n);return React})};
${clients.join('\n')}
createProductPolishHost({React,createRoot,ThemeRuntime,ThemePresenter,bootThemeInjections,plugins,baseline:false});`
 await mkdir(join(out,'preview'),{recursive:true})
 await require('esbuild').build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',jsx:'automatic',loader:{'.css':'text'},nodePaths:[join(sdk,'node_modules')],outfile:join(out,'preview/app.js')})
 const css=(await Promise.all(['base','design-platform'].map(n=>readFile(join(theme,'src/styles',n+'.css'),'utf8')))).join('\n')
 await writeFile(join(out,'PREVIEW-BUILD.json'),JSON.stringify({clientRoot,inputs,bundle:{path:'preview/app.js',sha256:createHash('sha256').update(await readFile(join(out,'preview/app.js'))).digest('hex')}},null,2)+'\n')
 await writeFile(join(out,'preview/index.html'),`<!doctype html><html lang="zh-CN" data-platform="darwin"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QCU P16 合成预览</title><style>${css}
html,body{height:100%;margin:0}body{font:14px/1.5 var(--dsw-font-family);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}button,input,select,textarea{font:inherit;color:inherit}#toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l3);font:12px/1.5 var(--dsw-font-family)}#toolbar label{display:flex;gap:5px;align-items:center}#toolbar button,#toolbar select{padding:4px 8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:4px}#host{display:flex;flex:1;min-height:0}#side{height:100%;flex:none;min-width:0}#main{flex:1;min-width:0;display:flex;flex-direction:column}#main>header{flex:none;padding:8px}#panel{flex:1;min-height:0;min-width:0;display:flex}#panel>*{flex:1;min-width:0}.host-workspaces{overflow-wrap:anywhere}.host-workspaces button{white-space:normal;max-width:100%}.host-sentinel{display:none}textarea{max-width:100%}
</style><div id="toolbar"></div><div id="host"></div><script src="/app.js"></script></html>`)
}
if(process.argv[1]===new URL(import.meta.url).pathname)await build()
