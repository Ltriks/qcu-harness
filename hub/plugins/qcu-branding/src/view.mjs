export const problemHelp = [
 {id:'network',title:'网络或校内 Hub 无法连接',text:'先确认设备网络和校内连接可用；校内 Hub 暂时离线时，稍后再由你尝试。反馈提交结果不确定时，先查询已有回执，不要重复提交。'},
 {id:'key',title:'提示缺少或无效的 API Key',text:'打开左下角“设置 → 模型”，在对应服务商的官方设置中核对并保存 Key。不要把 Key 贴到对话、截图或反馈里。'},
 {id:'busy',title:'服务繁忙或请求限流',text:'等待一段时间后，再由你决定是否重试。繁忙、容量不足或限流不代表余额耗尽；若持续出现，请查看服务商公告或联系维护者。'},
 {id:'quota',title:'服务明确提示额度或余额不足',text:'仅在服务商明确返回额度或余额不足时，到自己的服务商账户核对用量、配额和账单；不确定的提示可先联系维护者。'},
 {id:'workspace',title:'无法访问工作文件夹',text:'先保留当前草稿，再选择自己有权限访问且仍存在的文件夹。不要反复生成或更改系统权限；仍不可用时请联系维护者。'},
 {id:'install',title:'安装结果不确定',text:'先查看安装回执和当前状态，再正常关闭并重新打开客户端核对。不要反复安装或先卸载；仍不确定时保留回执并联系维护者。'}
];

export function createTeacherViews(React, icon) {
 const h=React.createElement;
 const useSource=source=>React.useSyncExternalStore(fn=>source.subscribe(fn),()=>source.getSnapshot(),()=>source.getSnapshot());
 function Glyph({kind='home',size=22}) {
  const paths={home:'M3 10l9-7 9 7v10H7V10m5 4v6',book:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15',tools:'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',folder:'M3 6h7l2 3h9v11H3z',chat:'M3 4h18v14H9l-6 4z',menu:'M4 6h16M4 12h16M4 18h16',more:'M5 12h.01M12 12h.01M19 12h.01',collapse:'M3 4h18v16H3zM8 4v16M16 9l-3 3 3 3',expand:'M3 4h18v16H3zM8 4v16M13 9l3 3-3 3',help:'M9 9a3 3 0 116 0c0 2-3 2-3 5m0 3h.01',chevron:'M14 6l-6 6 6 6'};
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[kind]??paths.tools}));
 }
 function Mark({size=28,className}) {return h('img',{src:icon,width:size,height:size,className,alt:'',draggable:false});}
 function Name(){return h('strong',null,'QCU助手');}
 function HeaderNavigation({ctx}) {
  return h('nav',{className:'qcu-teacher qcu-header-nav','aria-label':'窗口导航'},
   h('button',{type:'button',className:'qcu-sidebar-toggle','aria-label':'展开导航',title:'展开导航',onClick:()=>ctx.layout.toggleSidebar()},h(Glyph,{kind:'expand',size:20})));
 }
 function SettingsLauncher({openSettings}) {
  return h('button',{type:'button',className:'qcu-footer-row','aria-haspopup':'dialog',onClick:openSettings},h(Glyph,{kind:'tools',size:20}),h('span',null,'设置'));
 }
 function Sidebar({ctx,collapsed,toggleSidebar,renderSlot}) {
  const info=useSource(ctx.layout.panelInfo),more=React.useRef(null);
  React.useEffect(()=>{if(more.current)more.current.open=false},[info.activePanelId,collapsed]);
  React.useEffect(()=>{const close=event=>{if(more.current&&!more.current.contains(event.target))more.current.open=false};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
  React.useSyncExternalStore(fn=>ctx.slots.subscribe('sidebar.panellist',fn),()=>ctx.slots.getVersion('sidebar.panellist'),()=>ctx.slots.getVersion('sidebar.panellist'));
  const extraPanels=ctx.slots.entriesOfSlot('sidebar.panellist').map(row=>row.options).filter(o=>o.id!=='plugins'&&o.id!=='qcu-course-workbench');
  const promoted=extraPanels.filter(o=>['qcu-market','qcu-expert-teams'].includes(o.id));
  const maintenance=extraPanels.filter(o=>!['qcu-market','qcu-expert-teams'].includes(o.id));
  const active=info.activePanelId,hiddenMacSidebar=collapsed&&document.documentElement?.dataset.platform==='darwin';
  const nav=(id,label,kind)=>h('button',{key:id,type:'button','aria-label':label,title:collapsed?label:undefined,'aria-current':active===id?'page':undefined,onClick:()=>ctx.layout.selectPanel(id)},h(Glyph,{kind}),!collapsed&&h('span',null,label));
  return h('aside',{className:'qcu-teacher qcu-side'+(collapsed?' collapsed':''),'aria-label':'QCU导航','aria-hidden':hiddenMacSidebar||undefined,inert:hiddenMacSidebar?'':undefined},
   collapsed&&h('div',{className:'qcu-windows-recovery'},h(HeaderNavigation,{ctx})),
   h('div',{className:'qcu-side-brand'},!collapsed&&h(Mark,{}),!collapsed&&h('div',{className:'qcu-brand-name'},h(Name),h('small',null,'教学与教研助手')),h('button',{type:'button',className:'qcu-sidebar-toggle','aria-label':collapsed?'展开导航':'收起导航',title:collapsed?'展开导航':'收起导航',onClick:toggleSidebar},h(Glyph,{kind:collapsed?'expand':'collapse',size:20}))),
   h('nav',{className:'qcu-side-nav','aria-label':'主要功能'},nav('qcu-teacher-home','首页','home'),nav('qcu-capabilities','工作助手','tools'),...promoted.map(o=>nav(o.id,o.id==='qcu-market'?'工具市场':'专家团','tools')),
    h('button',{type:'button','aria-label':'自由对话',title:collapsed?'自由对话':undefined,onClick:()=>ctx.uiWorkspace.startSession()},h(Glyph,{kind:'chat'}),!collapsed&&'自由对话')),
   h('div',{className:'qcu-side-work qcu-native-workspaces'},!collapsed&&renderSlot('sidebar.workspaces',{wide:true})),
   h('div',{className:'qcu-side-foot'},h('details',{className:'qcu-more',ref:more,onKeyDown:event=>{if(event.key==='Escape'&&more.current?.open){more.current.open=false;more.current.querySelector('summary')?.focus();event.stopPropagation()}}},h('summary',{'aria-label':'更多',title:'更多'},h(Glyph,{kind:'more',size:20}),!collapsed&&h('span',null,'更多'),!collapsed&&h('span',{className:'qcu-more-indicator'},h(Glyph,{kind:'chevron',size:16}))),
    h('div',{className:'qcu-more-items'},renderSlot('sidebar.settings',{wide:true}),
     h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},h(Glyph,{kind:'help',size:20}),h('span',null,'使用指南')),
     h('details',{className:'qcu-maintenance'},h('summary',{className:'qcu-footer-row'},h(Glyph,{kind:'chevron',size:20}),h('span',null,'维护与高级选项')),h('div',{className:'qcu-maintenance-items'},h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('plugins')},'插件管理'),maintenance.filter(o=>o.id!=='qcu-capabilities').map(o=>h('button',{key:o.id,type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel(o.id)},typeof o.label==='function'?o.label():o.label??o.id)),renderSlot('sidebar.footer.action',{})))))));
 }
 const emptySubscribe=()=>()=>{},emptyReady={},emptyFlow={status:null},emptySnapshot=()=>emptyReady,emptyFlowSnapshot=()=>emptyFlow;
 function Shortcut({id,item,flow,personalization,managing,onLaunch,onManage,index,total,conversationReady}) {
  const state=React.useSyncExternalStore(flow?.subscribe??emptySubscribe,flow?.snapshot??emptyFlowSnapshot,flow?.snapshot??emptyFlowSnapshot);
  React.useEffect(()=>{void flow?.status()},[flow]);
  const active=item?.conversationTask?conversationReady:state.status?.state==='component-active',title=item?.workTitle??item?.title??id;
  return h('li',{'data-shortcut':id},h('div',null,h('button',{type:'button',className:'qcu-shortcut-launch',disabled:!active,onClick:()=>onLaunch(item,flow)},title),h('p',{className:'qcu-muted'},!item?'当前目录中不可用':item.conversationTask?'对话任务':active?'已启用':state.status?.state==='not-installed'?'尚未安装':'需检查启用或连接状态')),
   h('div',{className:'qcu-toolbar'},!active&&h('button',{type:'button',className:'qcu-button',onClick:()=>onManage(id)},'查看状态'),managing&&h(React.Fragment,null,h('button',{type:'button',className:'qcu-button','aria-label':'上移'+title,disabled:index===0,onClick:()=>personalization.move(id,-1)},'上移'),h('button',{type:'button',className:'qcu-button','aria-label':'下移'+title,disabled:index===total-1,onClick:()=>personalization.move(id,1)},'下移'),h('button',{type:'button',className:'qcu-button','aria-label':'取消固定'+title,onClick:()=>personalization.pin(id)},'取消固定'))));
 }
 function Home({ctx,homeState,personalization,capabilitySource}) {
  const workspaces=useSource(ctx.workspaces.list),sessions=useSource(ctx.sessions.list),local=useSource(homeState),bridge=useSource(capabilitySource);
  const personal=React.useSyncExternalStore(personalization.subscribe,personalization.snapshot,personalization.snapshot),ready=React.useSyncExternalStore(bridge?.availability?.subscribe??emptySubscribe,bridge?.availability?.snapshot??emptySnapshot,bridge?.availability?.snapshot??emptySnapshot);
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[managing,setManaging]=React.useState(false);
  const draft=local.conversationDraft??'',workspaceId=workspaces.items.some(w=>w.workspaceId===local.workspaceId)?local.workspaceId:(workspaces.items[0]?.workspaceId??'');
  const entries=[...new Map([...(ready.officeTasks??[]),...(ready.catalog?.entries??[]),...(ready.localSkills?.items??[])].map(item=>[item.id,item])).values()],flowFor=item=>item&&!item.conversationTask?ready.localSkillFlows?.[item.id]??ready.flowByKey?.[`${item.release.id}@${item.release.version}+${item.release.sha256}`]??ready.flows?.find(f=>f.releaseKey===`${item.release.id}@${item.release.version}+${item.release.sha256}`):null;
  const openLibrary=()=>ctx.layout.selectPanel('qcu-capabilities'),manage=id=>bridge?.openMarket?bridge.openMarket(id):openLibrary();
  const launch=async(item,flow)=>{setError('');setBusy(true);try{if(item.conversationTask){if(!bridge?.openTask)throw Error('工作助手尚未就绪，请稍后重试。');await bridge.openTask(item.id,workspaceId,draft);return}const status=await flow?.status();if(status?.state!=='component-active')throw Error('能力状态已变化，请在技能中检查后重试。');if(bridge?.isTeam(item)){await bridge.openTeam(item.id);return}if(!(item.skillName??item.release.skill))throw Error('此项能力需要从技能页面打开。');await openTeachingDraft(ctx,workspaceId,`/${item.skillName??item.release.skill}\n${draft}`)}catch(e){setError(e.message||'暂时无法打开，请检查工作文件夹和能力状态。')}finally{setBusy(false)}};
  const start=async()=>{setError('');setBusy(true);try{await openTeachingDraft(ctx,workspaceId,draft)}catch{setError('暂时无法打开对话，要求已保留。请检查工作文件夹后重试。')}finally{setBusy(false)}};
  const recent=recentTasks(sessions,workspaces);
  return h('div',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},h('header',{className:'qcu-home-top'},h('h1',null,'首页')),
   h('section',{className:'qcu-home-compose','aria-label':'开始对话'},h('h2',null,'今天想做什么？'),h('label',{className:'qcu-field'},h('span',null,'任务要求'),h('textarea',{'aria-label':'任务要求',placeholder:'描述你的目标，或从下方选择常用技能…',value:draft,maxLength:12000,disabled:busy,onChange:e=>homeState.update({conversationDraft:e.target.value})})),
    h('label',{className:'qcu-field'},h('span',null,'工作文件夹'),h('select',{'aria-label':'工作文件夹',value:workspaceId,disabled:busy||!workspaces.items.length,onChange:e=>homeState.update({workspaceId:e.target.value})},!workspaces.items.length&&h('option',{value:''},'请先在左侧添加工作文件夹'),workspaces.items.map(w=>h('option',{key:w.workspaceId,value:w.workspaceId},w.label??w.title??w.path)))),
    error&&h('p',{role:'alert'},error),h('div',{className:'qcu-task-bottom'},h('p',{className:'qcu-muted'},'先打开草稿，检查后由你发送。'),h('button',{type:'button',className:'qcu-button primary',disabled:busy||!workspaceId||!draft.trim(),onClick:start},busy?'正在打开…':'在对话中继续'))),
   h('section',{className:'qcu-home-favorites','aria-label':'我的常用'},h('div',{className:'qcu-section-heading'},h('h2',null,'我的常用'),h('div',{className:'qcu-toolbar'},personal.pinned.length>0&&h('button',{type:'button',className:'qcu-button','aria-pressed':managing,onClick:()=>setManaging(!managing)},managing?'完成管理':'管理常用'),h('button',{type:'button',className:'qcu-button',onClick:openLibrary},'添加常用'))),personal.error&&h('p',{role:'alert'},personal.error),personal.pinned.length?h('ul',{className:'qcu-shortcuts'},personal.pinned.map((id,index)=>{const item=entries.find(e=>e.id===id);return h(Shortcut,{key:id,id,item,flow:flowFor(item),personalization,managing,index,conversationReady:!!ready.skillRuntime,total:personal.pinned.length,onLaunch:launch,onManage:manage})})):h('p',{className:'qcu-muted'},'还没有固定的能力。到“工作助手”中选择“固定到首页”，把常用功能放在这里。')),
   h('section',{className:'qcu-home-recents','aria-label':'最近对话'},h('h2',null,'最近对话'),sessions.phase!=='ready'?h('p',{role:'status'},'正在读取最近对话…'):recent.length?h('ul',{className:'qcu-recent'},recent.map(row=>h('li',{key:row.sessionId},h('button',{type:'button',onClick:()=>ctx.uiWorkspace.openSession(row.sessionId)},row.title||'未命名对话')))):h('p',{className:'qcu-muted'},'还没有对话记录。'))));
 }
 function ExampleComposer({ctx,preferences,homeState,guide=true}) {
  const workspaces=useSource(ctx.workspaces.list),sessions=useSource(ctx.sessions.list),prefs=useSource(preferences);
  const {selected,drafts,workspaceId,firstTaskDone}=useSource(homeState);
  const setSelected=value=>homeState.update({selected:value});
  const setDrafts=value=>homeState.update({drafts:value});
  const setWorkspace=value=>homeState.update({workspaceId:value});
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const task=teachingTasks.find(t=>t.id===selected)??teachingTasks[0];
  const draft=drafts[selected]??task.prompt;
  const effectiveWorkspace=workspaces.items.some(w=>w.workspaceId===workspaceId)?workspaceId:(workspaces.items[0]?.workspaceId??'');
  const recent=recentTasks(sessions,workspaces);
  const start=async()=>{setError('');setBusy(true);try{await openTeachingDraft(ctx,effectiveWorkspace,draft);}catch{setError('暂时无法打开任务，填写的要求已保留。请确认工作文件夹可用后重试；如已创建空白任务，可在左侧打开检查。');}finally{setBusy(false);}};
  return h('div',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},
   !guide&&h('header',{className:'qcu-home-top'},h('div',null,h('h1',null,'从一堂好课开始'),h('p',{className:'qcu-muted'},'准备教学材料，继续课程，让想法落到课堂。')),
    h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-button quiet','aria-pressed':prefs.large,onClick:()=>preferences.setLarge(!prefs.large)},prefs.large?'使用普通字号':'使用大字模式'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},'使用指南'))),
   !guide&&h('section',{className:'qcu-first-task'},h('span',null,firstTaskDone?'首次任务已完成，可随时回看步骤。':'第一次使用：从模型设置到打开一份匿名任务草稿。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},firstTaskDone?'回看首次任务步骤':'开始首次任务指引')),
   h('div',{className:'qcu-compose-grid'},h('section',{className:'qcu-task-sheet','aria-label':'开始教学任务'},h('h2',null,'今天想准备什么？'),
    h('div',{className:'qcu-task-tabs','aria-label':'选择教学任务'},(guide?teachingTasks:teachingTasks.slice(0,3)).map(t=>h('button',{type:'button',key:t.id,'aria-pressed':selected===t.id,onClick:()=>{setSelected(t.id);setError('');}},t.title)),!guide&&h('button',{type:'button','aria-pressed':!teachingTasks.slice(0,3).some(t=>t.id===selected),onClick:()=>ctx.layout.selectPanel('qcu-teacher-tools')},'更多教学工具')),
    h('p',{className:'qcu-muted'},task.brief),guide&&h('button',{type:'button',className:'qcu-button',onClick:()=>setDrafts({...drafts,[selected]:task.prompt+'\n匿名练习示例：虚构通识课堂，45分钟，主题为区分论点与证据。请先询问缺失信息。'})},'填入匿名示例（替换当前任务要求）'),h('label',{className:'qcu-field'},h('span',null,'任务要求 · 可以直接修改'),h('textarea',{'aria-label':'任务要求',value:draft,maxLength:12000,disabled:busy,onChange:e=>setDrafts({...drafts,[selected]:e.target.value})})),
    h('label',{className:'qcu-field'},h('span',null,'工作文件夹'),h('select',{'aria-label':'工作文件夹',value:effectiveWorkspace,disabled:busy||!workspaces.items.length,onChange:e=>setWorkspace(e.target.value)},!workspaces.items.length&&h('option',{value:''},workspaces.phase==='ready'?'请先在左侧创建工作文件夹':'正在读取工作文件夹…'),workspaces.items.map(w=>h('option',{value:w.workspaceId,key:w.workspaceId},w.label??w.title??w.name??w.path)))),
    error&&h('p',{role:'alert',className:'qcu-notice'},error),
    h('div',{className:'qcu-task-bottom'},h('p',{className:'qcu-muted'},'打开后可继续修改、添加资料；由你确认发送。'),h('button',{type:'button',className:'qcu-button primary',disabled:busy||!effectiveWorkspace||!draft.trim(),onClick:start},busy?'正在打开…':'在对话中继续'))),
   h('section',{className:'qcu-recent-section'},h('h2',null,'继续最近的任务'),sessions.phase!=='ready'?h('p',{className:'qcu-muted'},'正在读取最近任务…'):recent.length?h('ul',{className:'qcu-recent'},recent.map(s=>h('li',{key:s.sessionId},h('button',{type:'button',onClick:()=>ctx.uiWorkspace.openSession(s.sessionId)},s.title||'未命名任务')))):h('div',{className:'qcu-empty'},h('p',null,'还没有教学任务。'),h('p',{className:'qcu-muted'},'从上面的备课开始，发送后的任务会出现在这里。')))),
   h('details',null,h('summary',null,'外观设置'),h('div',{className:'qcu-toolbar'},['light','dark','system'].map((mode,i)=>h('button',{type:'button',className:'qcu-button',key:mode,'aria-pressed':prefs.preference===mode,onClick:()=>ctx.theme.setTheme(mode)},['浅色','深色','跟随系统'][i]))))));
 }
 function Help({ctx,preferences,homeState,diagnosticConnection}){return h('div',{className:'qcu-teacher qcu-home'},h('article',{className:'qcu-home-inner'},h('h1',null,'使用指南'),
  h('section',{'aria-label':'新手教程'},h('h2',null,'新手教程'),h('p',{className:'qcu-muted'},'按需查阅说明和示例。'),
   h('details',null,h('summary',null,'配置模型与开始对话'),h('ol',null,h('li',null,'在“更多 → 设置 → 模型”中配置自己的服务商与 API Key。'),h('li',null,'回到首页，选择工作文件夹并填写任务要求。'),h('li',null,'打开对话草稿，检查模型、资料和要求后自行发送。')),h('p',null,'密钥只在模型设置中填写。在线模型需要网络与可用额度。')),
   h('details',null,h('summary',null,'收藏技能与定制首页'),h('p',null,'打开“工作助手”，收藏感兴趣的能力；选择“固定到首页”后即可从“我的常用”访问。首页可以调整顺序或取消固定，取消固定不会卸载技能。')),
   h('details',null,h('summary',null,'任务示例'),h(ExampleComposer,{ctx,preferences,homeState})),
   h('details',null,h('summary',null,'保存与检查成果'),h('p',null,'在对话中审阅结果，按需复制或保存到工作文件夹；保存后检查实际文件。知识、计算和来源仍需核对。')),
   h('details',null,h('summary',null,'套件版本说明'),h(About,{ctx,diagnosticConnection}))),
  h('section',{'aria-label':'问题与维护'},h('h2',null,'问题与维护'),problemHelp.map(topic=>h('details',{key:topic.id},h('summary',null,topic.title),h('p',null,topic.text))),h('details',null,h('summary',null,'诊断与上报'),h(Diagnostics,{diagnosticConnection})))));}
 function Diagnostics({diagnosticConnection}){
  const [data,setData]=React.useState(null),[notice,setNotice]=React.useState('正在读取本机诊断状态…'),[busy,setBusy]=React.useState(false),[copy,setCopy]=React.useState('');
  async function call(method,payload){const timer=new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),6000));let v=await Promise.race([payload===undefined?diagnosticConnection.current[method]():diagnosticConnection.current[method](JSON.stringify(payload)),timer]);if(v&&typeof v==='object'&&v.ok===true)v=v.value;const result=typeof v==='string'?JSON.parse(v):v;if(!result?.ok)throw Error('unavailable');return result.value}
  async function refresh(){setBusy(true);try{setData(await call('status'));setNotice('')}catch{setNotice('暂时无法读取诊断。可重开助手后再试；不会影响已保存资料。')}finally{setBusy(false)}}
  React.useEffect(()=>{let active=true;call('status').then(v=>{if(active){setData(v);setNotice('')}}).catch(()=>{if(active)setNotice('诊断服务暂不可用，请重开助手后再试。')});return()=>{active=false}},[]);
  async function toggle(){setBusy(true);try{setData(await call('preference',{enabled:!data.autoReport}));setNotice('设置已保存。')}catch{setNotice('设置未能保存，请重试。')}finally{setBusy(false)}}
  async function output(id,download){setBusy(true);try{const text=JSON.stringify(await call('exportRecord',{incidentId:id}),null,2);if(download){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='QCU-diagnostic-'+id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('已请求保存诊断文件。')}else{try{await navigator.clipboard.writeText(text);setNotice('诊断已复制。')}catch{setCopy(text);setNotice('请从下方文本框手动复制。')}}}catch{setNotice('记录无法读取，请刷新后重试。')}finally{setBusy(false)}}
  const labels={'received':'已获回执','queued':'等待发送','unknown':'待确认回执','local-only':'仅保存在本机'};
  return h('section',{className:'qcu-notice','aria-label':'诊断与上报'},h('h2',null,'诊断与上报'),data&&h('p',null,'套件 '+data.version+' · 构建 '+data.build+' · 内核 '+data.kernel),h('p',null,'仅发送故障编号、版本、阶段与固定技术错误码到'+(data?.receiver||'维护服务')+'；不含密钥、配置正文、对话或教学资料。默认关闭，断网保存在本机。'),data&&h('p',null,'自动上报：'+(data.autoReport?'已开启':'已关闭')+(data.storageAvailable?'':'；诊断目录暂不可用')),h('div',{className:'qcu-toolbar'},data&&h('button',{type:'button',className:'qcu-button',disabled:busy,onClick:toggle},data.autoReport?'关闭自动上报':'同意并开启自动上报'),h('button',{type:'button',className:'qcu-button',disabled:busy,onClick:refresh},'刷新状态')),h('p',{role:'status'},notice),data?.records.length===0&&h('p',null,'暂无故障记录。'),data&&h('ul',null,data.records.map(r=>h('li',{key:r.incidentId},h('p',null,r.errorCode+' · '+r.createdAt+' · '+(labels[r.delivery]||'仅保存在本机')),h('code',null,r.incidentId),h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-button',disabled:busy,onClick:()=>output(r.incidentId,false)},'复制诊断'),h('button',{type:'button',className:'qcu-button',disabled:busy,onClick:()=>output(r.incidentId,true)},'导出诊断 JSON'))))),copy&&h('textarea',{'aria-label':'诊断文本',readOnly:true,value:copy,rows:8,style:{width:'100%'}}));
 }
 function About(){return h('div',null,h('p',null,'QCU助手 · 清蓝主题 0.3.0-pilot.6'),h('p',null,'主题版本与完整应用版本分别维护。当前套件与内核版本可在下方“问题与维护 → 诊断与上报”查看。'),h('p',null,'完整套件由维护者统一交付；单独更新主题不会升级客户端。'))}


 return {Sidebar,Home,Help,About,Mark,Name,Glyph,HeaderNavigation,SettingsLauncher};
}
