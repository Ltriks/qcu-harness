// Actual ZIP Client artifacts + actual ASAR SlotRegistry, rendered with trusted SDK React SSR.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const [kit,home,sdk,out]=process.argv.slice(2),{runtime}=require(path.join(kit,'support/offline.cjs'));
 const api=await runtime(path.join(kit,'program/DeepSeek Harness.app/Contents/Resources'));
 const req=require('node:module').createRequire(path.join(sdk,'package.json')),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
 const buttons=[],react={...React,createElement(type,props,...children){if(type==='button')buttons.push(props);return React.createElement(type,props,...children)}};
 const factories=new Map(),modules=new Map(),storage=new Map();
 const sandbox={window:{__ModuleLoader__:{load:m=>factories.set(m.id,m.factory)}},document:{createElement:()=>({dataset:{},remove(){}}),head:{append(){}},body:{setAttribute(){},removeAttribute(){},toggleAttribute(){}}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},queueMicrotask,setTimeout,clearTimeout,TextEncoder,TextDecoder,AbortController,AbortSignal,URL,URLSearchParams,performance,crypto:globalThis.crypto,console};
 function browser(name){
  if(modules.has(name))return modules.get(name);
  if(name==='react')return react;
  if(name.startsWith('react'))return req(name);
  if(name==='@deepseek-ai/cordis'||name==='@deepseek-ai/dsh-client-ui-slots')return api.req(name);
  if(!factories.has(name)){
   let client;try{client=api.req.resolve(name+'/client')}catch(e){if(e.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw e;return api.req(name)}
   vm.runInNewContext(fs.readFileSync(client,'utf8'),sandbox,{filename:name});
  }
  const value=factories.get(name)(browser);modules.set(name,value);return value;
 }
 for(const id of ['qcu-course-workbench','qcu-market','qcu-expert-teams','qcu-branding'])vm.runInNewContext(fs.readFileSync(path.join(home,'profiles/desktop/node_modules',id,'client.js'),'utf8'),sandbox,{filename:id});
 const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context(),selected=[];
 try{
  const {SlotRegistry}=browser('@deepseek-ai/dsh-client-ui-renderer');new SlotRegistry(ctx);
  ctx.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},sidebar:{kind:'single',scope:'root'},'shell.leading':{kind:'single',scope:'root'},'settings.launcher':{kind:'single',scope:'root'},'conversation.hero.brand.mark':{kind:'single',scope:'root'}}},()=>null);
  let active=null;
  const info={getSnapshot:()=>({activePanelId:active}),subscribe:()=>()=>{}};
  const layout={panelInfo:info,selectPanel:id=>{assert.ok(ctx.slots.entriesOfSlot('main').some(e=>e.options.key===id));active=id;selected.push(id)},toggleSidebar(){},dispose(){}};ctx.reflect.provide('layout',layout);
  const store={getSnapshot:()=>({phase:'loading',items:[],ids:[],byId:{}}),subscribe:()=>()=>{}};
  for(const [name,value] of Object.entries({theme:{overrideTokens:()=>()=>{},getTheme:()=>({preference:'light'}),setFontSize(){}},locale:{setLocale(){}},uiWorkspace:{selection:{getSnapshot:()=>({}),subscribe:()=>()=>{}}},workspaces:{list:store},sessions:{list:store},conversation:{}}))ctx.reflect.provide(name,value);
  for(const id of ['qcu-course-workbench','qcu-market','qcu-expert-teams','qcu-branding'])await ctx.plugin(browser(id)).await();
  const main=ctx.slots.entriesOfSlot('main').map(e=>e.options.key),sidebar=ctx.slots.entriesOfSlot('sidebar')[0];
  for(const id of ['qcu-course-workbench','qcu-market','qcu-expert-teams','qcu-teacher-home'])assert.ok(main.includes(id));
  const markup=renderToStaticMarkup(React.createElement(sidebar.component,{collapsed:false,renderSlot:()=>null,toggleSidebar(){}}));
  fs.writeFileSync(path.join(out,'sidebar.html'),markup);
  assert.match(markup,/aria-label="主要功能"/);assert.match(markup,/aria-label="插件市场"/);assert.match(markup,/aria-label="专家团"/);
  for(const label of ['插件市场','专家团']){const button=buttons.find(p=>p?.['aria-label']===label);assert.ok(button?.onClick);button.onClick()}
  assert.deepEqual(selected,['qcu-market','qcu-expert-teams']);
  const about=ctx.slots.entriesOfSlot('main').find(e=>e.options.key==='qcu-teacher-about');const aboutHtml=renderToStaticMarkup(React.createElement(about.component));assert.match(aboutHtml,/0\.1\.0-rc\.4\.1/);assert.match(aboutHtml,/QCU清蓝 0\.2\.3/);assert.doesNotMatch(aboutHtml,/0\.1\.0-rc\.3/);fs.writeFileSync(path.join(out,'about.html'),aboutHtml);
  assert.equal(ctx.get('remote'),undefined);
  console.log('INTEGRATED_CLIENT:'+JSON.stringify({officialAsarSlotRegistry:true,actualZipClientArtifacts:true,aboutSuite:'0.1.0-rc.4.1',aboutTheme:'0.2.3',trustedReactSsr:true,syntheticLayoutProvider:true,mainPanels:main,sidebarLabels:['插件市场','专家团'],clickSelections:selected,modelCalls:0,installationCalls:0,networkGuard:globalThis.QCU_OFFLINE_NETWORK_GUARD===true}));
  layout.dispose();
 }finally{await ctx.fiber.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
