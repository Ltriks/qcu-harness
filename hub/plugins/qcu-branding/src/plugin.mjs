export function createTeacherPlugin(React,icon) {
 const {Sidebar,Home,Help,Mark,Name,HeaderNavigation,SettingsLauncher}=createTeacherViews(React,icon),h=React.createElement;
 return {inject:['slots','layout','theme','locale','uiWorkspace','sessions','workspaces','conversation','remote'],apply(ctx){
  const diagnosticCodec={mode:'strict',typeSymbol:'qcu-branding#DiagnosticJson',create:()=>({parse(value){if(typeof value!=='string'||new TextEncoder().encode(value).length>32768)throw Error('Invalid diagnostic');JSON.parse(value);return value}})};
  const diagnosticsContract={package:'qcu-branding',descriptors:[['status',[]],['onboarding',[{name:'payload',wire:'payload',source:'json',codec:diagnosticCodec}]],['preference',[{name:'payload',wire:'payload',source:'json',codec:diagnosticCodec}]],['exportRecord',[{name:'payload',wire:'payload',source:'json',codec:diagnosticCodec}]]].map(([method,parameters])=>({id:'qcu-branding#qcuDiagnostics/'+method,service:'qcuDiagnostics',namespace:'qcuDiagnostics',method,invocation:{kind:'direct'},parameters,result:diagnosticCodec}))};
  const diagnosticConnection={current:null};
  ctx.inject(['remote'],async scope=>{const unmount=await scope.remote.$mount(diagnosticsContract);const consumer=scope.inject(['remote.qcuDiagnostics'],ready=>{diagnosticConnection.current=ready.remote.qcuDiagnostics;ready.effect(()=>()=>{diagnosticConnection.current=null})});scope.effect(()=>async()=>{await consumer.dispose();await unmount()})});
  ctx.effect(()=>ctx.theme.overrideTokens('qcu-branding',pairedTokens));
  ctx.effect(()=>{
   const previous=document.title;
   const normalizeTitle=()=>{const value=document.title||'';const next=value?value.replaceAll('DeepSeek Harness','QCU Buddy').replaceAll('QCU助手','QCU Buddy'):'QCU Buddy';if(value!==next)document.title=next};
   document.title='QCU Buddy';
   const observer=typeof globalThis.MutationObserver==='function'?new MutationObserver(normalizeTitle):null;
   observer?.observe(document.head,{childList:true,subtree:true,characterData:true});
   return()=>{observer?.disconnect();document.title=previous};
  });
  ctx.effect(()=>{
   const tag=document.createElement('style');tag.dataset.plugin='qcu-branding';tag.textContent=teacherStyles;document.head.append(tag);document.body.setAttribute('data-qcu-teacher','');
   return()=>{tag.remove();document.body.removeAttribute('data-qcu-teacher');};
  });
  const preferences=createTeacherPreferences(ctx);
  ctx.effect(()=>()=>preferences.dispose());
  const homeState=createTeacherHomeState();
  const personalization=createHomePersonalization();
  ctx.effect(()=>()=>personalization.dispose());
  ctx.effect(()=>ctx.reflect.provide('qcuHomePersonalization',personalization));
  let capabilities=null;const capabilityListeners=new Set();
  const capabilitySource={getSnapshot:()=>capabilities,subscribe:fn=>{capabilityListeners.add(fn);return()=>capabilityListeners.delete(fn)}};
  const publishCapabilities=value=>{capabilities=value;for(const fn of capabilityListeners)fn()};
  ctx.inject(['qcuHomeCapabilities'],scope=>{publishCapabilities(scope.qcuHomeCapabilities);scope.effect(()=>()=>publishCapabilities(null))});
  ctx.effect(()=>()=>capabilityListeners.clear());
  ctx.effect(()=>()=>homeState.dispose());
  function HomePanel(){return h(Home,{ctx,preferences,homeState,personalization,capabilitySource,diagnosticConnection});}
  ctx.slots.inject('main',function*(){
   yield ctx.slots.register({name:'main',key:'qcu-teacher-home'},HomePanel);
   yield ctx.slots.register({name:'main',key:'qcu-teacher-tools'},()=>h(Help,{ctx,preferences,homeState,diagnosticConnection}));
   yield ctx.slots.register({name:'main',key:'qcu-teacher-help'},()=>h(Help,{ctx,preferences,homeState,diagnosticConnection}));
   yield ctx.slots.register({name:'main',key:'qcu-teacher-about'},()=>h(Help,{ctx,preferences,homeState,diagnosticConnection}));
  });
  // Preserve the host-owned workspace browser, settings/onboarding and footer actions.
  const children=Object.fromEntries(['sidebar.brand.mark','sidebar.brand.name','sidebar.toggle.badge','sidebar.workspaces','sidebar.settings'].map(n=>[n,{kind:'single',scope:'root'}]));
  children['sidebar.panellist']={kind:'list',scope:'root'};children['sidebar.footer.action']={kind:'list',scope:'root'};
  ctx.slots.inject('sidebar',()=>ctx.slots.register({name:'sidebar',priority:-10,children},props=>h(Sidebar,{...props,ctx,toggleSidebar:()=>ctx.layout.toggleSidebar()})));
  ctx.slots.inject('shell.leading',()=>ctx.slots.register({name:'shell.leading'},()=>h(HeaderNavigation,{ctx})));
  function PublicSettingsLauncher(props){React.useEffect(()=>{homeState.update({openSettings:props.openSettings});return()=>homeState.update({openSettings:null})},[props.openSettings]);return h(SettingsLauncher,props);}
  ctx.slots.inject('settings.launcher',()=>ctx.slots.register({name:'settings.launcher',priority:-10},PublicSettingsLauncher));
  ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.register({name:'sidebar.brand.mark'},Mark));
  ctx.slots.inject('sidebar.brand.name',()=>ctx.slots.register({name:'sidebar.brand.name'},Name));
  ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark'},Mark));
  // A new/blank workspace opens the teacher home. Existing substantive sessions stay open.
  let initial=true,queued=false,active=true;
  ctx.effect(()=>()=>{active=false;});
  const showInitialHome=()=>{
   if(!initial||queued)return;
   queued=true;
   // Workspace publishes selection before revealing the conversation in the same
   // stack. Wait until that navigation settles, rather than being overwritten.
   queueMicrotask(()=>{
    queued=false;if(!initial||!active)return;
    const ws=ctx.workspaces.list.getSnapshot(),ss=ctx.sessions.list.getSnapshot(),id=ctx.uiWorkspace.selection.getSnapshot().sessionId;
    if(ws.phase!=='ready'||ss.phase!=='ready')return;
    if(!ctx.slots.entries('main').some(row=>row.options.key==='qcu-teacher-home'))return;
    if(!id&&ws.items.length)return;
    if(id&&!ss.byId[id])return;
    initial=false;
    if(!id||ss.byId[id].blank)ctx.layout.selectPanel('qcu-teacher-home');
   });
  };
  ctx.effect(()=>{const stops=[ctx.workspaces.list.subscribe(showInitialHome),ctx.sessions.list.subscribe(showInitialHome),ctx.uiWorkspace.selection.subscribe(showInitialHome),ctx.slots.subscribe('main',showInitialHome)];showInitialHome();return()=>stops.forEach(stop=>stop());});
 }};
}

export function createTeacherPreferences(ctx) {
 const listeners=new Set();
 // Preserve the existing one-time locale default; the host owns font persistence.
 try{if(localStorage.getItem('qcu.teacher.initialized.v1')!=='yes'){ctx.locale.setLocale('zh');localStorage.setItem('qcu.teacher.initialized.v1','yes');}}catch{}
 // Legacy QCU readability flags do not control the host font setting.
 let snapshot;
 function refresh(){const theme=ctx.theme.getTheme();snapshot={fontSize:theme.fontSize,large:theme.fontSize>=18,preference:theme.preference};for(const fn of listeners)fn();}
 refresh();
 const off=ctx.on('theme/change',refresh);
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setLarge(value){ctx.theme.setFontSize(value?18:14);},dispose(){off();listeners.clear();}};
}

export function createTeacherHomeState({storage,tasks=teachingTasks}={}) {
 const key='qcu.teacher.first-task.v2';let saved=null;
 try{storage??=globalThis.localStorage;const raw=storage?.getItem(key);if(raw&&raw.length<=512){const v=JSON.parse(raw);if(v&&Object.keys(v).sort().join()==='completed,schema,step,taskId,viewed'&&v.schema===2&&Number.isInteger(v.step)&&v.step>=0&&v.step<=3&&tasks.some(t=>t.id===v.taskId)&&typeof v.completed==='boolean'&&typeof v.viewed==='boolean')saved=v;}}catch{}
 let snapshot={selected:saved?.taskId??tasks[0].id,drafts:{},workspaceId:'',guideStep:saved?.step??0,firstTaskDone:saved?.completed??false,viewed:saved?.viewed??false,draftOpened:false,openSettings:null};
 const listeners=new Set();
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},update(patch){snapshot={...snapshot,...patch};
  if(['selected','guideStep','firstTaskDone','viewed'].some(k=>Object.hasOwn(patch,k)))try{storage?.setItem(key,JSON.stringify({schema:2,step:snapshot.guideStep,taskId:snapshot.selected,viewed:snapshot.viewed,completed:snapshot.firstTaskDone}));}catch{}
  for(const fn of listeners)fn();},dispose(){listeners.clear();}};
}
