// Source candidate only: no catalog rebuild, package mutation, installation or host data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

export const sdk=process.env.QCU_OFFICIAL_DEPENDENCIES??'/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source';
export const require=createRequire(join(resolve(sdk),'package.json'));
export const out=resolve('.work/font-settings');
export const themeRoot=join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-theme');
export const presenterPath=join(sdk,'node_modules/@deepseek-ai/dsh-client-ui-layout/src/client/theme-presenter.ts');
export const sha256=v=>createHash('sha256').update(v).digest('hex');
const base='f48b9f6cd91b34ea140baffaf1a3abe35e6ec740';
const packages=[
 ['qcu-branding','tools/teacher-branding',['tasks','theme','view','plugin']],
 ['qcu-course-workbench','hub/plugins/qcu-course-workbench',['protocol','artifact-html','styles','controller','view','plugin']],
 ['qcu-market','hub/plugins/qcu-market',['trusted-release','catalog-core','bundled-catalog','remote-contract','update-policy','update-model','direct-flow','update-flow','update-view','catalog-runtime','icons','styles','teacher-tools','teacher-view','version-model','reviewed-versions','market-view','loop-plugin']],
 ['qcu-expert-teams','hub/plugins/qcu-expert-teams',['protocol','reports','controller','view','plugin']],
];
export async function buildPreview(){
 const built=[];
 for(const baseline of [false,true]){
  const source=async path=>baseline?execFileSync('rtk',['proxy','git','show',base+':'+path],{maxBuffer:16*1024*1024}).toString():readFile(path,'utf8');
  const clients=[];
  for(const[id,dir,names]of packages){
   const manifest=JSON.parse(await source(dir+'/package.json'));
   const parts=await Promise.all(names.map(n=>source(dir+'/src/'+n+'.mjs')));
   let client;
   if(id==='qcu-branding'){
    const icon='data:image/svg+xml;base64,'+(await readFile('branding/qcu-assistant/icon.svg')).toString('base64');
    client=(await source(dir+'/client.template.js')).replace('__QCU_TEACHER_SOURCE__',()=>parts.join('\n').replace(/^export /gm,''))
     .replace('__QCU_ICON_DATA__',icon).replace(/QCU清蓝 \d+\.\d+\.\d+/,()=> 'QCU清蓝 '+manifest.version);
   }else{
    const factory=id==='qcu-market'?'createLoopPlugin':'createPlugin';
    client=`// Generated source candidate; same lazy-CJS assembly as package build.mjs.\nwindow.__ModuleLoader__.load({id:${JSON.stringify(id)},factory(require){\nconst React=require('react');\n${parts.join('\n').replace(/^import .*\n/gm,'').replace(/\bexport /g,'')}\nreturn ${factory}(React);\n}});\n`;
   }
   new Script(client,{filename:id+'/client.js'});
   const target=join(out,baseline?'baseline-clients':'clients',id);await mkdir(target,{recursive:true});
   await writeFile(join(target,'client.js'),client);await writeFile(join(target,'package.json'),JSON.stringify(manifest,null,2)+'\n');
   built.push({id,baseline,version:manifest.version,path:join(target,'client.js'),sha256:sha256(client),bytes:Buffer.byteLength(client)});
   clients.push(client);
  }
  const contents=`import React from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {ThemeRuntime} from ${JSON.stringify(join(themeRoot,'src/client/index.ts'))};
import {ThemePresenter} from ${JSON.stringify(presenterPath)};
import {bootThemeInjections} from ${JSON.stringify(join(themeRoot,'src/boot-theme.ts'))};
import {createFontSettingsHost} from ${JSON.stringify(resolve('tests/support/font-settings-host.mjs'))};
const plugins={};window.__ModuleLoader__={load:m=>plugins[m.id]=m.factory(n=>{if(n!=='react')throw Error(n);return React;})};
${clients.join('\n')}
createFontSettingsHost({React,createRoot,ThemeRuntime,ThemePresenter,bootThemeInjections,plugins,baseline:${baseline}});`;
  const preview=join(out,'preview');await mkdir(preview,{recursive:true});
  await require('esbuild').build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',jsx:'automatic',loader:{'.css':'text'},nodePaths:[join(sdk,'node_modules')],outfile:join(preview,baseline?'before-app.js':'app.js')});
 }
 const officialCss=(await Promise.all(['base','design-platform'].map(n=>readFile(join(themeRoot,'src/styles',n+'.css'),'utf8')))).join('\n');
 const html=`<!doctype html><html lang="zh-CN" data-platform="darwin"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QCU 字号修复 · 合成宿主预览</title>
<style>${officialCss}
/* Synthetic host reset/geometry only; QCU component styles come from actual clients. */
html,body{height:100%;margin:0}body{font:14px/1.5 var(--dsw-font-family);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}button,input,select,textarea{font:inherit}button{color:inherit}#toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l3);font:12px/1.5 var(--dsw-font-family)}#toolbar label{display:flex;gap:5px;align-items:center}#toolbar button,#toolbar select{padding:4px 8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:4px}body{display:flex;flex-direction:column}#host{display:flex;flex:1;min-height:0}#side{height:100%;flex:none;min-width:0}#main{flex:1;min-width:0;display:flex;flex-direction:column}#main>header{flex:none;padding:8px}#panel{flex:1;min-height:0;min-width:0;display:flex}#panel>*{flex:1;min-width:0}.host-workspaces{overflow-wrap:anywhere}.host-workspaces button{white-space:normal;max-width:100%}.host-sentinel{display:none}
</style><div id="toolbar"></div><div id="host"></div><script>const s=document.createElement('script');s.src=new URLSearchParams(location.search).has('baseline')?'before-app.js':'app.js';document.body.append(s)</script></html>`;
 await writeFile(join(out,'preview/index.html'),html);
 await writeFile(join(out,'builds.json'),JSON.stringify({base,sourceCandidate:true,built},null,2)+'\n');
 return built;
}
if(process.argv[1]===new URL(import.meta.url).pathname){const built=await buildPreview();console.log(JSON.stringify({output:out,clients:built.length}));}
