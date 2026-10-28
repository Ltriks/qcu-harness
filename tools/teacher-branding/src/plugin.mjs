export function createTeacherPlugin(React,icon) {
 const {Sidebar,Home,Tools,Help,About,Mark,Name,HeaderNavigation,SettingsLauncher}=createTeacherViews(React,icon),h=React.createElement;
 return {inject:['slots','layout','theme','locale','uiWorkspace','sessions','workspaces','conversation'],apply(ctx){
  ctx.effect(()=>ctx.theme.overrideTokens('qcu-branding',pairedTokens));
  ctx.effect(()=>{
   const tag=document.createElement('style');tag.dataset.plugin='qcu-branding';tag.textContent=teacherStyles;document.head.append(tag);document.body.setAttribute('data-qcu-teacher','');
   return()=>{tag.remove();document.body.removeAttribute('data-qcu-teacher');document.body.removeAttribute('data-qcu-large');};
  });
  const preferences=createTeacherPreferences(ctx);
  ctx.effect(()=>()=>preferences.dispose());
  const homeState=createTeacherHomeState();
  ctx.effect(()=>()=>homeState.dispose());
  function HomePanel(){return h(Home,{ctx,preferences,homeState});}
  const chooseTask=id=>{homeState.update({selected:id});ctx.layout.selectPanel('qcu-teacher-home');};
  ctx.slots.inject('main',function*(){
   yield ctx.slots.register({name:'main',key:'qcu-teacher-home'},HomePanel);
   yield ctx.slots.register({name:'main',key:'qcu-teacher-tools'},()=>h(Tools,{ctx,onChoose:chooseTask}));
   yield ctx.slots.register({name:'main',key:'qcu-teacher-help'},Help);
   yield ctx.slots.register({name:'main',key:'qcu-teacher-about'},About);
  });
  // Preserve the host-owned workspace browser, settings/onboarding and footer actions.
  const children=Object.fromEntries(['sidebar.brand.mark','sidebar.brand.name','sidebar.toggle.badge','sidebar.workspaces','sidebar.settings'].map(n=>[n,{kind:'single',scope:'root'}]));
  children['sidebar.panellist']={kind:'list',scope:'root'};children['sidebar.footer.action']={kind:'list',scope:'root'};
  ctx.slots.inject('sidebar',()=>ctx.slots.register({name:'sidebar',priority:-10,children},props=>h(Sidebar,{...props,ctx,toggleSidebar:()=>ctx.layout.toggleSidebar()})));
  ctx.slots.inject('shell.leading',()=>ctx.slots.register({name:'shell.leading'},()=>h(HeaderNavigation,{ctx})));
  ctx.slots.inject('settings.launcher',()=>ctx.slots.register({name:'settings.launcher',priority:-10},SettingsLauncher));
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
 const key='qcu.teacher.readability.v1',listeners=new Set();
 let large=false;
 try{large=localStorage.getItem(key)==='large';}catch{}
 // Apply teacher defaults once; subsequent launches respect settings chosen by the user.
 try{if(localStorage.getItem('qcu.teacher.initialized.v1')!=='yes'){ctx.locale.setLocale('zh');ctx.theme.setFontSize(18);localStorage.setItem('qcu.teacher.initialized.v1','yes');}}catch{}
 let snapshot;
 function refresh(){const theme=ctx.theme.getTheme();snapshot={large,preference:theme.preference};document.body.toggleAttribute('data-qcu-large',large);for(const fn of listeners)fn();}
 refresh();
 const off=ctx.on('theme/change',refresh);
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setLarge(value){large=value;try{localStorage.setItem(key,large?'large':'normal');}catch{}ctx.theme.setFontSize(large?20:18);refresh();},dispose(){off();listeners.clear();}};
}

export function createTeacherHomeState() {
 let snapshot={selected:teachingTasks[0].id,drafts:{},workspaceId:''};
 const listeners=new Set();
 return {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},update(patch){snapshot={...snapshot,...patch};for(const fn of listeners)fn();},dispose(){listeners.clear();}};
}
