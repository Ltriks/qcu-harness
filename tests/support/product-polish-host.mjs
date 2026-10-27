// Explicit synthetic services; actual generated QCU clients and official theme classes.
import {createPreviewFixture} from '../../hub/plugins/qcu-market/preview-fixture.mjs';

export function createProductPolishHost({React,createRoot,ThemeRuntime,ThemePresenter,bootThemeInjections,plugins,baseline}){
 const h=React.createElement,query=new URLSearchParams(location.search),actions=[],events=new Map,slots=new Map,pending=[],owners=[];
 const record=(name,...args)=>actions.push({name,args});
 const forbidden=name=>(...args)=>{record('FORBIDDEN:'+name,...args);throw Error('Forbidden synthetic operation: '+name);};
 function store(value){const listeners=new Set;return{getSnapshot:()=>value,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);},set:v=>{value=v;for(const f of listeners)f();},listeners};}
 const scopeKey='product-polish.scope.'+(query.get('scope')??'review');
 if(localStorage.getItem(scopeKey)===null){
  localStorage.setItem(scopeKey,JSON.stringify({fontSize:Number(query.get('size')??14),preference:query.get('theme')??'light'}));
  // These fixture-only seeds reset between scopes, never on a same-scope reload.
  const legacyFlags={'qcu.teacher.readability.v1':query.get('stale'),'qcu.teacher.initialized.v1':query.get('init')==='no'?null:'yes'};
  for(const[key,value]of Object.entries(legacyFlags))if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
 }
 const initial=JSON.parse(localStorage.getItem(scopeKey)),settings=store({value:initial});
 // Same pre-plugin body bootstrap used by the official Host, using synthetic durable data.
 for(const row of bootThemeInjections(initial.preference,initial.fontSize))if(row.kind==='script'){
  const script=document.createElement('script');script.textContent=row.text;document.body.append(script);
 }
 const panel=store({activePanelId:query.get('panel')??'qcu-teacher-home'}),collapsed=store(false),showSidebar=store(query.get('sidebar')!=='off');
 function context(label){
  const cleanups=[],ctx={label,cleanups,effect:f=>{const stop=f();if(typeof stop==='function')cleanups.push(stop);},
   emit:(name,...args)=>{for(const f of events.get(name)??[])f(...args);},
   on:(name,f)=>{const list=events.get(name)??new Set;events.set(name,list);list.add(f);const off=()=>list.delete(f);cleanups.push(off);return off;},
   dispose:async()=>{for(const stop of cleanups.splice(0).reverse())await stop();}};
  return ctx;
 }
 const runtimeCtx=context('official-theme'),form={getSnapshot:settings.getSnapshot,subscribe:settings.subscribe,set:async(key,value)=>{record('setting-write',key,value);const next={...settings.getSnapshot().value,[key]:value};localStorage.setItem(scopeKey,JSON.stringify(next));settings.set({value:next});}};
 const theme=new ThemeRuntime(runtimeCtx,form),presenter=new ThemePresenter;
 // Faithful public setter stub: record the locale call without throwing inside baseline's try.
 const locale={setLocale:value=>record('locale-write',value)};
 const present=()=>presenter.apply(theme.getTheme());runtimeCtx.on('theme/change',present);present();
 const foreignTokens=theme.overrideTokens('synthetic-foreign',{'--synthetic-foreign':{light:'kept',dark:'kept'}});
 document.body.setAttribute('data-foreign-sentinel','kept');
 const drafts=new Map();let serial=0;
 const market=createPreviewFixture();
 for(const method of ['feedbackSubmit','feedbackStatus','feedbackReceipts'])market.remote.qcuMarket[method]=async(payload,signal)=>{record(method);const r=await fetch('/__feedback/'+(method==='feedbackSubmit'?'submit':method==='feedbackStatus'?'status':'receipts'),{method:'POST',headers:{'Content-Type':'application/json'},body:payload??'{}',signal});return{ok:true,value:await r.text()}};
 for(const space of Object.values(market.remote))if(space&&typeof space==='object')for(const name of Object.keys(space))if(typeof space[name]==='function'&&!['status','refresh','updatesRecovery','listBundles','listPlugins','feedbackSubmit','feedbackStatus','feedbackReceipts'].includes(name))space[name]=forbidden('market-'+name);
 function pluginContext(label){
  const ctx=context(label);owners.push(ctx);
  Object.assign(ctx,{theme,locale,
   layout:{panelInfo:panel,selectPanel:id=>{if(id!==null&&!slots.has('main:'+id))throw Error('Synthetic faithful layout: panel not registered');record('panel',id);panel.set({activePanelId:id});},toggleSidebar:()=>{record('toggle');collapsed.set(!collapsed.getSnapshot());}},
   workspaces:{list:store({phase:'ready',items:[{workspaceId:'synthetic',path:'自编合成工作文件夹：用于验证长名称换行与导航按钮',sessionIds:['existing']}],archivedSessionIds:[]})},
   sessions:{list:store({phase:'ready',ids:['existing'],byId:{existing:{sessionId:'existing',title:'自编合成示例任务',blank:false,updatedAt:1}}}),create:async options=>{record('session-create',options);const id='synthetic-draft-'+(++serial);drafts.set(id,'');return id},retain:(id,options)=>{record('session-retain',id,options);return{binding:{ctx:{id}},release:()=>record('session-release',id)}}},
   uiWorkspace:{selection:store({sessionId:'existing'}),startSession:forbidden('session-start'),openSession:id=>{record('session-open',id);panel.set({activePanelId:null})}},
   conversation:{input:{for:scope=>({snapshot:{draft:drafts.get(scope.id)||'',attachmentIds:[]},setDraft:text=>{record('draft-set',scope.id);drafts.set(scope.id,text)}})},send:forbidden('send')},
   remote:{...market.remote,$mount:async()=>()=>{}},
   pluginNavigation:{openBundle:forbidden('plugin-details')},
   slots:{getVersion:()=>0,subscribe:()=>()=>{},entries:name=>[...slots.values()].filter(r=>r.o.name===name).map(r=>({options:r.o})),
    entriesOfSlot:()=>[{options:{id:'plugins',label:'插件管理'}},{options:{id:'qcu-course-workbench',label:'课程工作台'}},{options:{id:'qcu-market',label:'QCU市场'}},{options:{id:'qcu-expert-teams',label:'专家团'}}],
    inject:(_n,f)=>{const v=f();if(v?.[Symbol.iterator]){for(const stop of v)if(typeof stop==='function')ctx.cleanups.push(stop);}else if(typeof v==='function')ctx.cleanups.push(v);},
    register:(o,C)=>{const key=o.name+':'+(o.key??o.id??'');slots.set(key,{o,C});return()=>slots.delete(key);}},
  });
  ctx.inject=(_deps,fn)=>{const child=pluginContext(label+':service');const result=fn(child);if(result?.then)pending.push(result);return{dispose:()=>child.dispose()};};
  return ctx;
 }
 const branding=pluginContext('qcu-branding');
 if(query.get('branding')!=='off')plugins['qcu-branding'].apply(branding);
 for(const id of ['qcu-market'])plugins[id].apply(pluginContext(id));
 const openSettings=()=>{record('settings-open');alert('合成官方设置：请选择“模型”。这里不输入真实 Key。')};
 const renderSlot=name=>name==='sidebar.workspaces'?h('div',{'data-slot':name,className:'host-workspaces'},h('button',{onClick:()=>record('workspace-picker')},'添加工作文件夹'),h('p',null,'自编合成工作文件夹：用于验证长名称换行与导航按钮')):name==='sidebar.settings'?h('div',{'data-slot':name},h(slots.get('settings.launcher:').C,{openSettings})):null;
 function Host(){
  const info=React.useSyncExternalStore(panel.subscribe,panel.getSnapshot),isCollapsed=React.useSyncExternalStore(collapsed.subscribe,collapsed.getSnapshot),visible=React.useSyncExternalStore(showSidebar.subscribe,showSidebar.getSnapshot);
  const side=slots.get('sidebar:'),header=slots.get('shell.leading:'),row=slots.get('main:'+info.activePanelId);
  return h(React.Fragment,null,visible&&side&&h('div',{id:'side','data-sidebar-collapsed':isCollapsed?'':undefined,style:{width:isCollapsed?64:240}},h(side.C,{collapsed:isCollapsed,renderSlot})),h('main',{id:'main'},header&&h('header',null,h(header.C)),h('section',{id:'panel'},row?h(row.C,row.o.inject?.()):h('div',null,h('h1',null,'合成对话草稿（未发送）'),h('textarea',{'aria-label':'合成对话草稿',readOnly:true,value:[...drafts.values()].at(-1)||''}),h('p',null,'实际应用中在此核对模型并手动发送；本预览禁止发送。')))));
 }
 function Toolbar(){
  const panelState=React.useSyncExternalStore(panel.subscribe,panel.getSnapshot);
  const subscribe=f=>runtimeCtx.on('theme/change',f),current=React.useSyncExternalStore(subscribe,()=>theme.getTheme());
  return h(React.Fragment,null,h('span',null,'P16 合成预览 · 真实候选客户端 / 合成任务 / 离线服务 · 非原生 DSH'),
   h('label',null,'字号',h('select',{'aria-label':'合成宿主字号',value:current.fontSize,onChange:e=>theme.setFontSize(Number(e.target.value))},Array.from({length:13},(_,i)=>h('option',{key:i,value:i+10},i+10)))),
   h('label',null,'主题',h('select',{'aria-label':'合成宿主主题',value:current.preference,onChange:e=>theme.setTheme(e.target.value)},['light','dark','system'].map(v=>h('option',{key:v},v)))),
   h('button',{onClick:()=>showSidebar.set(!showSidebar.getSnapshot())},'显示/隐藏侧栏'),
   h('select',{'aria-label':'合成宿主页面',value:panelState.activePanelId??'',onChange:e=>panel.set({activePanelId:e.target.value})},['qcu-teacher-home','qcu-teacher-tools','qcu-teacher-help','qcu-teacher-about','qcu-market'].map(v=>h('option',{key:v},v))));
 }
 const root=createRoot(document.getElementById('host')),toolbar=createRoot(document.getElementById('toolbar'));root.render(h(Host));toolbar.render(h(Toolbar));
 window.polishPreview={drafts,resetConnection:()=>{record('connection-reset');for(const fn of events.get('connection/reset')??[])fn()},theme,settings,actions,marketCalls:market.calls,baseline,panel,ready:Promise.all(pending),
  eventCounts:()=>Object.fromEntries([...events].map(([k,v])=>[k,v.size])),
  cleanupBranding:async()=>{root.unmount();toolbar.unmount();await branding.dispose();return{slots:[...slots.keys()],events:window.polishPreview.eventCounts(),tokens:theme.getTheme().active.tokens,fontSize:theme.getTheme().fontSize,foreign:document.body.getAttribute('data-foreign-sentinel'),styles:[...document.querySelectorAll('style[data-plugin]')].map(e=>e.dataset.plugin)};},
  cleanup:async()=>{root.unmount();toolbar.unmount();await Promise.allSettled(pending);for(const owner of owners.toReversed())await owner.dispose();foreignTokens();await runtimeCtx.dispose();presenter.dispose();},
 };
}
