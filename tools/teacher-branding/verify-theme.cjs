// Exercise the built package using the frozen vendor's SlotRegistry and ThemeRuntime.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {runtime}=require('../offline-suite/offline.cjs');
(async()=>{
 const [resources,brandDir,reactRoot]=process.argv.slice(2).map(v=>path.resolve(v)),api=await runtime(resources);
 const testRequire=require('node:module').createRequire(path.join(path.resolve(reactRoot),'package.json'));
 const React=testRequire('react'),render=testRequire('react-dom/server').renderToStaticMarkup;
 const factories=new Map(),modules=new Map(),attrs=new Map(),storage=new Map();
 const document={body:{style:{getPropertyValue:()=>''},setAttribute:(n,v)=>attrs.set(n,v),removeAttribute:n=>attrs.delete(n),toggleAttribute:(n,v)=>v?attrs.set(n,''):attrs.delete(n)},createElement:()=>({dataset:{},remove(){}}),head:{append(){},appendChild(){}},getElementById:()=>null,querySelector:()=>null};
 const sandbox={window:{__ModuleLoader__:{load:m=>factories.set(m.id,m.factory)}},queueMicrotask,document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
 function browser(name){
  if(modules.has(name))return modules.get(name);
  if(name.startsWith('react'))return testRequire(name);
  if(['@deepseek-ai/cordis','@deepseek-ai/dsh-client-ui-slots'].includes(name))return api.req(name);
  // Settings-row controls/store are not mounted in this ThemeRuntime contract check.
  if(['@deepseek-ai/dsh-client-ui-primitives','@deepseek-ai/dsh-client-store'].includes(name))return{};
  if(!factories.has(name))vm.runInNewContext(fs.readFileSync(api.req.resolve(name+'/client'),'utf8'),sandbox,{filename:name});
  const value=factories.get(name)(browser);modules.set(name,value);return value;
 }
 vm.runInNewContext(fs.readFileSync(path.join(brandDir,'client.js'),'utf8'),sandbox,{filename:'qcu-branding'});
 const {Context}=api.req('@deepseek-ai/cordis'),ctx=new Context(),store=value=>{const listeners=new Set();return{getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set:v=>{value=v;for(const fn of listeners)fn();}}};
 try{
  browser('@deepseek-ai/dsh-client-ui-renderer').apply(ctx);const slots=ctx.slots;
  const {ThemeRuntime}=browser('@deepseek-ai/dsh-client-ui-theme');
  let settings={preference:'light',fontSize:14};
  const theme=new ThemeRuntime(ctx,{getSnapshot:()=>({value:settings}),subscribe:()=>()=>{},set:(k,v)=>{settings={...settings,[k]:v}}});ctx.provide('theme',theme);
  const panelInfo=store({activePanelId:'qcu-teacher-home'}),selected=[];
  ctx.provide('layout',{panelInfo,selectPanel:id=>selected.push(id),toggleSidebar(){}});
  ctx.provide('workspaces',{list:store({phase:'ready',items:[{workspaceId:'w',path:'/synthetic-teaching'}],archivedSessionIds:[]})});
  ctx.provide('sessions',{list:store({phase:'ready',ids:[],byId:{}})});
  ctx.provide('uiWorkspace',{selection:store({}),startSession(){},openSession(){}});
  ctx.provide('conversation',{});ctx.provide('locale',{setLocale:id=>assert.equal(id,'zh')});
  slots.register({name:'root',children:{sidebar:{kind:'single',scope:'root'},main:{kind:'keyed',scope:'root'},'shell.leading':{kind:'single',scope:'root'},'conversation.hero.brand.mark':{kind:'single',scope:'root'}}},()=>null);
  // The teacher bundle disables ui-sidebar. It must own, rather than redeclare,
  // that shell's child slots; native Workspace and Settings plugins then fill them.
  const before=theme.getTheme().active.tokens;
  const fork=ctx.plugin(browser('qcu-branding'));await fork.await();
  slots.register({name:'sidebar.settings',children:{'settings.launcher':{kind:'single',scope:'root'}}},()=>null);
  ctx.sessions.list.set({phase:'ready',ids:['blank'],byId:{blank:{sessionId:'blank',blank:true}}});
  ctx.uiWorkspace.selection.set({sessionId:'blank'});ctx.layout.selectPanel(null);await Promise.resolve();
  assert.equal(selected.at(-1),'qcu-teacher-home');
  assert.equal(theme.getTheme().active.tokens['--qcu-blue'],'#174F91');
  assert.equal(theme.getTheme().fontSize,18);
  theme.setTheme('dark');assert.equal(theme.getTheme().active.tokens['--qcu-blue'],'#ABD1FF');
  theme.setTheme('light');assert.equal(theme.getTheme().active.tokens['--qcu-blue'],'#174F91');
  const panels={};for(const row of slots._core.entries('main')){const C=row.component||row.value?.component||row.value;panels[row.options.key]=render(React.createElement(C));}
  assert.match(panels['qcu-teacher-home'],/从一堂好课开始/);assert.match(panels['qcu-teacher-home'],/在对话中继续/);assert.match(panels['qcu-teacher-help'],/API Key/);
  for(const skill of ['备课教案','分层练习','整理课堂笔记','教材精读','学习方法教练','引用自查','教研简报'])assert.ok(panels['qcu-teacher-tools'].includes(skill));
  slots.register({name:'sidebar.workspaces'},()=>null);
  assert.equal(slots._core.entries('sidebar.workspaces').length,1);
  // Vendor renderer hooks are client-only (no getServerSnapshot). Render our
  // sidebar component directly; the actual ledger above checks declaration ownership.
  const sidebarEntry=slots._core.entries('sidebar')[0];
  const shell=render(React.createElement(sidebarEntry.component,{collapsed:false,renderSlot:(name,props)=>{assert.ok(slots.spec(name));if(name==='sidebar.workspaces')assert.equal(props.wide,true);return null;}}));
  assert.match(shell,/教学首页/);assert.match(shell,/使用指南/);
  const recovery=slots._core.entries('shell.leading')[0].component();
  const buttons=recovery.type(recovery.props).props.children;
  const beforeReturn=selected.length;buttons[1].props.onClick();
  assert.equal(selected.at(-1),'qcu-teacher-home');assert.equal(selected.length,beforeReturn+1);
  assert.match(render(recovery),/展开导航/);assert.match(render(recovery),/教学首页/);
  const settingsEntry=slots._core.entries('settings.launcher')[0];
  let settingsOpened=false;const settingsButton=settingsEntry.component({openSettings:()=>{settingsOpened=true}});
  assert.match(render(settingsButton),/设置/);settingsButton.props.onClick();assert.equal(settingsOpened,true);
  assert.ok(attrs.has('data-qcu-teacher'));
  await fork.dispose();
  assert.deepEqual(theme.getTheme().active.tokens,before);assert.equal(attrs.has('data-qcu-teacher'),false);
  console.log('QCU_THEME_SDK_VERIFIED:'+JSON.stringify({slotRegistry:'frozen-vendor',themeRuntime:'frozen-vendor',officialSidebarDisabledByBundle:true,palettes:['light','dark'],panels:Object.keys(panels),rendering:'React SSR',disposeRestoresTokens:true,gui:false,modelCalls:0}));
 }finally{await ctx.fiber.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
