export function createTeacherViews(React, icon) {
 const h=React.createElement;
 const useSource=source=>React.useSyncExternalStore(fn=>source.subscribe(fn),()=>source.getSnapshot(),()=>source.getSnapshot());
 function Glyph({kind='home',size=22}) {
  const paths={home:'M3 10l9-7 9 7v10H7V10m5 4v6',book:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15',tools:'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',folder:'M3 6h7l2 3h9v11H3z',chat:'M3 4h18v14H9l-6 4z',menu:'M4 6h16M4 12h16M4 18h16',help:'M9 9a3 3 0 116 0c0 2-3 2-3 5m0 3h.01',chevron:'M14 6l-6 6 6 6'};
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[kind]??paths.tools}));
 }
 function Mark({size=28,className}) {return h('img',{src:icon,width:size,height:size,className,alt:'',draggable:false});}
 function Name(){return h('strong',null,'QCU助手');}
 function HeaderNavigation({ctx}) {
  return h('nav',{className:'qcu-teacher qcu-header-nav','aria-label':'窗口导航'},
   h('button',{type:'button',className:'qcu-button','aria-label':'展开导航',title:'展开导航',onClick:()=>ctx.layout.toggleSidebar()},h(Glyph,{kind:'menu',size:18})),
   h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-home')},'教学首页'));
 }
 function SettingsLauncher({openSettings}) {
  return h('button',{type:'button',className:'qcu-footer-row','aria-haspopup':'dialog',onClick:openSettings},h(Glyph,{kind:'tools',size:20}),h('span',null,'设置'));
 }
 function Sidebar({ctx,collapsed,toggleSidebar,renderSlot}) {
  const info=useSource(ctx.layout.panelInfo);
  React.useSyncExternalStore(fn=>ctx.slots.subscribe('sidebar.panellist',fn),()=>ctx.slots.getVersion('sidebar.panellist'),()=>ctx.slots.getVersion('sidebar.panellist'));
  const extraPanels=ctx.slots.entriesOfSlot('sidebar.panellist').map(row=>row.options).filter(o=>o.id!=='plugins'&&o.id!=='qcu-course-workbench');
  const promoted=extraPanels.filter(o=>['qcu-market','qcu-expert-teams'].includes(o.id));
  const maintenance=extraPanels.filter(o=>!['qcu-market','qcu-expert-teams'].includes(o.id));
  const active=info.activePanelId;
  const nav=(id,label,kind)=>h('button',{key:id,type:'button','aria-label':label,title:collapsed?label:undefined,'aria-current':active===id?'page':undefined,onClick:()=>ctx.layout.selectPanel(id)},h(Glyph,{kind}),!collapsed&&h('span',null,label));
  return h('aside',{className:'qcu-teacher qcu-side'+(collapsed?' collapsed':''),'aria-label':'QCU导航'},
   collapsed&&h('div',{className:'qcu-windows-recovery'},h(HeaderNavigation,{ctx})),
   h('div',{className:'qcu-side-brand'},h(Mark,{}),!collapsed&&h('div',null,h(Name),h('small',null,'教学与教研助手'))),
   h('nav',{className:'qcu-side-nav','aria-label':'主要功能'},nav('qcu-teacher-home','教学首页','home'),nav('qcu-course-workbench','课程工作台','book'),nav('qcu-teacher-tools','教学工具','tools'),...promoted.map(o=>nav(o.id,o.id==='qcu-market'?'插件市场':'专家团','tools')),
    h('button',{type:'button','aria-label':'自由对话',title:collapsed?'自由对话':undefined,onClick:()=>ctx.uiWorkspace.startSession()},h(Glyph,{kind:'chat'}),!collapsed&&'自由对话')),
   h('div',{className:'qcu-side-work qcu-native-workspaces'},!collapsed&&renderSlot('sidebar.workspaces',{wide:true})),
   h('div',{className:'qcu-side-foot'},!collapsed&&h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},h(Glyph,{kind:'help',size:20}),h('span',null,'使用指南')),
    h('div',{className:'qcu-footer-settings'},renderSlot('sidebar.settings',{wide:!collapsed})),
    !collapsed&&h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('qcu-teacher-about')},h(Glyph,{kind:'book',size:20}),h('span',null,'套件版本说明')),
    !collapsed&&h('details',{className:'qcu-maintenance'},h('summary',{className:'qcu-footer-row'},h(Glyph,{kind:'chevron',size:20}),h('span',null,'维护与高级选项')),h('div',{className:'qcu-maintenance-items'},h('button',{type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel('plugins')},'插件管理'),maintenance.map(o=>h('button',{key:o.id,type:'button',className:'qcu-footer-row',onClick:()=>ctx.layout.selectPanel(o.id)},typeof o.label==='function'?o.label():o.label??o.id)),renderSlot('sidebar.footer.action',{})))),
   h('button',{className:'qcu-button quiet',type:'button','aria-label':collapsed?'展开导航':'收起导航',onClick:toggleSidebar},h(Glyph,{kind:collapsed?'menu':'chevron',size:18})));
 }
 function Home({ctx,preferences,homeState}) {
  const workspaces=useSource(ctx.workspaces.list),sessions=useSource(ctx.sessions.list),prefs=useSource(preferences);
  const {selected,drafts,workspaceId}=useSource(homeState);
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
   h('header',{className:'qcu-home-top'},h('div',null,h('h1',null,'从一堂好课开始'),h('p',{className:'qcu-muted'},'准备教学材料，继续课程，让想法落到课堂。')),
    h('div',{className:'qcu-toolbar'},h('button',{type:'button',className:'qcu-button quiet','aria-pressed':prefs.large,onClick:()=>preferences.setLarge(!prefs.large)},prefs.large?'使用普通字号':'使用大字模式'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},'使用指南'))),
   h('section',{className:'qcu-task-sheet','aria-label':'开始教学任务'},h('h2',null,'今天想准备什么？'),
    h('div',{className:'qcu-task-tabs','aria-label':'选择教学任务'},teachingTasks.slice(0,3).map(t=>h('button',{type:'button',key:t.id,'aria-pressed':selected===t.id,onClick:()=>{setSelected(t.id);setError('');}},t.title)),h('button',{type:'button','aria-pressed':!teachingTasks.slice(0,3).some(t=>t.id===selected),onClick:()=>ctx.layout.selectPanel('qcu-teacher-tools')},'更多教学工具')),
    h('p',{className:'qcu-muted'},task.brief),h('label',{className:'qcu-field'},h('span',null,'任务要求 · 可以直接修改'),h('textarea',{'aria-label':'任务要求',value:draft,maxLength:12000,disabled:busy,onChange:e=>setDrafts({...drafts,[selected]:e.target.value})})),
    h('label',{className:'qcu-field'},h('span',null,'工作文件夹'),h('select',{'aria-label':'工作文件夹',value:effectiveWorkspace,disabled:busy||!workspaces.items.length,onChange:e=>setWorkspace(e.target.value)},!workspaces.items.length&&h('option',{value:''},workspaces.phase==='ready'?'请先在左侧创建工作文件夹':'正在读取工作文件夹…'),workspaces.items.map(w=>h('option',{value:w.workspaceId,key:w.workspaceId},w.label??w.title??w.name??w.path)))),
    error&&h('p',{role:'alert',className:'qcu-notice'},error),
    h('div',{className:'qcu-task-bottom'},h('p',{className:'qcu-muted'},'打开后可继续修改、添加资料；由你确认发送。'),h('button',{type:'button',className:'qcu-button primary',disabled:busy||!effectiveWorkspace||!draft.trim(),onClick:start},busy?'正在打开…':'在对话中继续'))),
   h('div',{className:'qcu-lower'},h('section',null,h('h2',null,'继续最近的任务'),sessions.phase!=='ready'?h('p',{className:'qcu-muted'},'正在读取最近任务…'):recent.length?h('ul',{className:'qcu-recent'},recent.map(s=>h('li',{key:s.sessionId},h('button',{type:'button',onClick:()=>ctx.uiWorkspace.openSession(s.sessionId)},s.title||'未命名任务')))):h('div',{className:'qcu-empty'},h('p',null,'还没有教学任务。'),h('p',{className:'qcu-muted'},'从上面的备课开始，发送后的任务会出现在这里。'))),
    h('aside',null,h('section',{className:'qcu-course-link'},h('h2',null,'课程工作台'),h('p',{className:'qcu-muted'},'围绕课程组织资料、生成草案，审阅后再保存。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('qcu-course-workbench')},'进入课程工作台')),
     h('section',null,h('h2',null,'第一次使用？'),h('p',{className:'qcu-muted'},'从左下角进入“设置 → 模型”，配置自己的 API Key。'),h('button',{type:'button',className:'qcu-button quiet',onClick:()=>ctx.layout.selectPanel('qcu-teacher-help')},'查看配置和使用方法')))),
   h('details',null,h('summary',null,'外观设置'),h('div',{className:'qcu-toolbar'},['light','dark','system'].map((mode,i)=>h('button',{type:'button',className:'qcu-button',key:mode,'aria-pressed':prefs.preference===mode,onClick:()=>ctx.theme.setTheme(mode)},['浅色','深色','跟随系统'][i]))))));
 }
 function Tools({ctx,onChoose}) {
  return h('div',{className:'qcu-teacher qcu-home'},h('div',{className:'qcu-home-inner'},h('header',{className:'qcu-home-top'},h('div',null,h('h1',null,'教学工具'),h('p',{className:'qcu-muted'},'选择一项任务，补充背景和资料后，在对话中开始。'))),h('ul',{className:'qcu-tool-list'},teachingTasks.map(t=>h('li',{key:t.id},h('strong',null,t.title),h('p',null,t.brief),h('p',{className:'qcu-muted'},'准备：'+t.materials),h('button',{type:'button',className:'qcu-button',onClick:()=>onChoose(t.id)},'使用'+t.title)))),h('section',{className:'qcu-notice'},h('h2',null,'飞书文档只读'),h('p',null,'需本人授权及一个明确的文档链接。先读取目录，再选择要读的一节；不会批量扫描或修改文档。'),h('button',{type:'button',className:'qcu-button',onClick:()=>ctx.layout.selectPanel('plugins')},'查看插件与配置'))));
 }
 function Help(){return h('div',{className:'qcu-teacher qcu-home'},h('article',{className:'qcu-home-inner'},h('h1',null,'开始使用 QCU助手'),
  h('section',{className:'qcu-notice'},h('h2',null,'先配置自己的模型'),h('ol',null,h('li',null,'点击左下角“设置”，选择“模型”。'),h('li',null,'在对应服务商中填写你自己的 API Key 并保存。使用内置 DeepSeek 时保留默认服务地址。'),h('li',null,'回到教学首页，填写任务要求，点击“在对话中继续”。确认资料和模型后再发送。')),h('p',null,'API Key 是个人密钥，只在模型设置中填写，不要贴进对话、截图或分享给他人。预装技能可以离线加载，调用在线模型仍需联网和服务额度。')),
  h('h2',null,'用一次备课熟悉流程'),h('p',null,'选择“备课教案”，补充课程主题、学生情况、课时与目标。进入对话后，可添加已核对的资料，确认后发送。要求不完整时，先补充信息再生成。'),
  h('h2',null,'课程成果怎样保存'),h('p',null,'在课程工作台选择工作文件夹与课程，添加参考资料，选择教学组件。确认模型使用的资料后生成草稿，审阅、修改、应用，再选择位置并保存。预览或应用不代表文件已保存；以保存成功提示和实际文件位置为准。'),
  h('h2',null,'遇到问题'),h('p',null,'模型没有响应时，检查网络、API Key 和服务额度。工作文件夹不可用时，重新选择有权限访问的目录。结果不符合要求时，补充背景并修改，不必反复点击生成。'),h('p',{className:'qcu-muted'},'套件目录内另附“QCU助手使用指南.html”，可离线查阅七项技能的示例。')));}
 function About(){return h('div',{className:'qcu-teacher qcu-home'},h('article',{className:'qcu-home-inner'},h('h1',null,'套件版本说明'),h('p',null,'QCU清蓝主题测试版'),h('dl',null,h('dt',null,'当前教师套件'),h('dd',null,'0.1.0-rc.4.2'),h('dt',null,'客户端内核'),h('dd',null,'DeepSeek Harness 0.2.0-rc.2'),h('dt',null,'教师主题'),h('dd',null,'QCU清蓝 0.2.4')),h('section',{className:'qcu-notice'},h('h2',null,'由维护者统一更新'),h('p',null,'维护者会核对客户端、技能、插件和配置保留情况，再交付完整QCU套件。拿到新版后按随包说明更新即可。'),h('p',null,'模型服务要求更高版本时，请联系维护人员获取新版套件。'))));}
 return {Sidebar,Home,Tools,Help,About,Mark,Name,Glyph,HeaderNavigation,SettingsLauncher};
}
