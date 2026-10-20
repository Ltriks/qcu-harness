import {productKindOf,historyFor,installedVersionLabel} from './version-model.mjs'
import {releaseHistory} from './reviewed-versions.mjs'
import {marketRuntime} from './remote-contract.mjs'
import {bundledCatalog} from './bundled-catalog.mjs'
import {iconPaths,sceneIcon} from './icons.mjs'
import {marketStyles} from './styles.mjs'
import {createTeacherViews} from './teacher-view.mjs'
const unavailableSnapshot=Object.freeze({phase:'unavailable',status:null,review:null,message:''})
const noSubscribe=()=>()=>{}
const statusLabels={'not-installed':'未安装','installed-disabled':'已安装 · 未启用','row-disabled':'包已启用 · 组件未启用','component-active':'组件已加载','restart-or-pending':'等待加载或重启',conflict:'需要核对版本',failed:'加载失败'}
const phaseLabels={unavailable:'状态检查不可用',preparing:'正在准备安装',verifying:'正在复核',installing:'正在安装',cancelling:'正在请求取消',applying:'正在应用',checking:'正在检查',enabling:'正在启用',unconfirmed:'结果待核对',error:'操作未完成',cancelled:'已取消',declined:'未授权操作',review:'等待你的确认',partial:'启用部分完成 · 需核对'}
export function createMarketViews(React){
 const h=React.createElement
 const {Guide,Tasks,Feedback}=createTeacherViews(React)
 const useFlow=flow=>React.useSyncExternalStore(flow?.subscribe||noSubscribe,flow?.snapshot||(()=>unavailableSnapshot),flow?.snapshot||(()=>unavailableSnapshot))
 function Icon({name='market'}){return h('svg',{width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},...iconPaths[name].map((d,i)=>h('path',{key:i,d})))}
 const label=state=>phaseLabels[state.phase]||statusLabels[state.status?.state]||'状态待检查'
 function Diagnostics({flow,item}){const s=useFlow(flow);return h('div',{className:'qcu-diagnostic'},h('strong',null,item.title),h('p',null,s.message||'暂无操作日志'),s.status?.reason?h('p',null,s.status.reason):null,h('p',null,item.testStatus))}
 function Card({item,flow,onOpen}){const s=useFlow(flow);return h('article',{className:'qcu-product'},h('button',{type:'button',className:'qcu-card-link',onClick:onOpen,'aria-label':'查看'+item.title},h('div',{className:'qcu-card-title'},h('span',{className:'qcu-icon-tile'},h(Icon,{name:sceneIcon(item.scenario)})),h('h2',null,item.title)),h('p',{className:'qcu-summary'},item.purpose),h('span',{className:'qcu-card-footer'},h('span',{className:'qcu-badge'},productKindOf(item)==='skill'?'技能':'插件'),h('span',{className:'qcu-card-version'},item.release.version),h('span',{className:'qcu-status'},label(s)))))}
 function VersionPanel({item,flow,onDetails,standalone=false,self=false}){
  const s=useFlow(flow),[message,setMessage]=React.useState(''),[manual,setManual]=React.useState('')
  const versions=historyFor(releaseHistory,item.id,item.release.version)
  const copyMetadata=async version=>{
   const text=`${version.url}\nSHA256: ${version.sha256}\n${version.bytes} 字节；DSH ${version.dshVersions.join(', ')}`
   try{if(!globalThis.navigator?.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);setManual('');setMessage('已复制固定地址和校验信息。')}
   catch{setManual(text);setMessage('自动复制不可用，请手动选中下方内容复制。')}
  }
  const check=()=>{setMessage('');void Promise.resolve().then(()=>flow.status()).catch(e=>setMessage(e.message))}
  const busy=['preparing','verifying','installing','checking','enabling','cancelling','applying','unconfirmed'].includes(s.phase)
  return h('section',{className:'qcu-section qcu-versions','data-version-product':item.id},
   h('h2',null,standalone?item.title:'版本管理'),
   h('dl',{className:'qcu-facts'},h('div',null,h('dt',null,self?'当前界面版本':'当前审核版本'),h('dd',null,item.release.version)),self?null:h('div',null,h('dt',null,'本实例已安装'),h('dd',null,installedVersionLabel(s.status)))),
   self?h('p',{className:'qcu-hint'},'市场更新通过官方插件页面安装，正常重启后生效。'):h('div',{className:'qcu-button-row'},h('button',{type:'button',className:'qcu-control',disabled:!flow||busy,onClick:check},'检查已安装版本'),h('button',{type:'button',className:'qcu-control',onClick:()=>onDetails(item.id)},'在官方页面管理版本')),
   h('details',{className:'qcu-history'},h('summary',null,`历史版本（${versions.length}）`),versions.length?h(React.Fragment,null,h('p',{className:'qcu-hint'},'历史包保留原固定地址和校验信息。复制后在官方页面核对版本、安装影响并逐次确认；不会自动覆盖当前版本。'),...versions.map(version=>h('div',{key:version.version,className:'qcu-version-row'},h('h3',null,version.version),h('p',{className:'qcu-hint'},`${version.bytes} 字节；DSH ${version.dshVersions.join(', ')}`),h('code',{className:'qcu-hash'},version.sha256),h('button',{type:'button',className:'qcu-control',onClick:()=>{void copyMetadata(version)}},'复制 '+version.version+' 地址与校验信息')))):h('p',{className:'qcu-hint'},'暂无其他已审核版本。')),
   manual?h('textarea',{readOnly:true,value:manual,rows:4,'aria-label':item.title+'历史版本地址与校验信息',onFocus:e=>e.target.select()}):null,
   h('p',{className:'qcu-hint',role:'status'},message))
 }
 function VersionsPage({catalog,flowFor,onDetails}){
  return h('div',{className:'qcu-aux-page'},h('h1',{tabIndex:-1,'data-page-heading':true},'版本管理'),h('p',{className:'qcu-muted'},'同一个工具保留一个入口。在这里核对当前版本、已安装版本与历史发布。'),
   h(VersionPanel,{item:{id:'qcu-market',title:'QCU 市场',release:{version:marketRuntime.version}},self:true,standalone:true,onDetails}),
   ...catalog.entries.map(item=>h(VersionPanel,{key:item.id,item,flow:flowFor(item),onDetails,standalone:true})))
 }
 function Detail({item,flow,onBack,onDetails,unavailable}){
  const s=useFlow(flow),release=item.release,review=s.review,toolsOnly=item.capabilities[0]==='tools',workbench=item.capabilities[0]==='workbench'
  const [error,setError]=React.useState(''),[copied,setCopied]=React.useState('')
  // Leaving a detail revokes an unconfirmed receipt/download, never authorizes a mutation.
  React.useEffect(()=>()=>{if(flow&&!flow.disposed)flow.leave()},[flow])
  const act=fn=>{setError('');void Promise.resolve().then(fn).catch(e=>setError(e.message))}
  const button=(text,fn,disabled=false,primary=false)=>h('button',{type:'button',className:'qcu-control'+(primary?' qcu-primary':''),disabled,onClick:()=>act(fn)},text)
  const busy=['preparing','verifying','installing','cancelling','applying','checking','enabling','unconfirmed'].includes(s.phase)
  return h('div',{className:'qcu-detail'},button('← 返回列表',onBack),
   h('header',{className:'qcu-detail-head'},h('span',{className:'qcu-icon-tile qcu-icon-large'},h(Icon,{name:sceneIcon(item.scenario)})),h('div',null,h('span',{className:'qcu-eyebrow'},'QCU / '+(productKindOf(item)==='skill'?'技能':'插件')),h('h1',{tabIndex:-1,'data-page-heading':true},item.title),h('p',{className:'qcu-muted'},item.scenario))),
   h('p',{className:'qcu-purpose'},item.purpose),
   h('section',{className:'qcu-actions','aria-label':'安装与启用'},h('span',{role:'status','aria-live':'polite',className:'qcu-status'},label(s)),
    h('div',{className:'qcu-button-row'},
     !review&&(!s.status||s.status.state==='not-installed')?button('下载并查看安装确认',()=>flow.prepare(),!flow||busy,true):null,
     ['installed-disabled','row-disabled'].includes(s.status?.state)&&!review?button('查看启用确认',()=>flow.reviewActivate(),busy||Boolean(flow?.activation),true):null,
     button('检查本实例',()=>flow.status(),!flow||Boolean(flow?.activation)||(busy&&!(s.phase==='unconfirmed'&&!flow.request))||Boolean(review)),
     ['preparing','verifying','installing','cancelling','applying','unconfirmed'].includes(s.phase)?button('请求取消',()=>flow.cancel(),s.phase==='cancelling'):null,
     flow?.request?button('核对官方任务结果',()=>flow.reconcile()):null,
     flow?.activation?button('只读核对启用状态',()=>flow.reconcileActivation(),Boolean(flow.pending)):null),
    h('p',{className:'qcu-hint'},'安装后默认不启用；另一次启用确认覆盖本包及唯一组件。'),
    s.status?.state==='component-active'?h('p',{className:'qcu-hint'},workbench?'组件已加载；请打开侧栏 Course Studio，选择工作区并创建课程。模型生成与教学效果仍需现场验证。':toolsOnly?'组件已加载；请在官方插件设置完成配置，再在目标会话验证工具发现和读取。加载状态不证明已配置、已授权或可读。':'组件已加载；目标会话的技能发现与调用仍需验证。'):null,
    error?h('p',{role:'alert'},error):null,
    s.phase==='error'||s.phase==='unconfirmed'?h('p',{role:'alert'},'操作尚未确认完成，请展开下方技术检查查看原因。'):null,
    unavailable?h('p',{role:'alert'},'安装服务暂不可用，请查看技术检查。'):null,
    s.result?.pendingBuilds?.length?h('p',{role:'alert'},`需要额外脚本授权，市场已停止：${s.result.pendingBuilds.join(', ')}。请另行审核。`):null,
    s.result?.application==='restart-required'?h('p',{role:'status'},'需要你正常重启应用；市场不会替你重启，也不声称已生效。'):null),
   review?h('section',{className:'qcu-review','aria-labelledby':'qcu-review-'+item.id},h('h2',{id:'qcu-review-'+item.id},review.kind==='install'?'请确认本次安装':'请确认本次启用'),
    h('p',null,item.risk),h('p',null,`名称：${item.title}；包：${release.id}；版本：${release.version}；来源：${item.sourceLabel} / ${release.origin}`),
    h('p',{className:'qcu-hash'},`SHA256：${release.sha256}；${release.bytes} 字节`),
    h('p',null,review.kind==='install'?`官方检查：本机固定包；registry ${review.inspected.registry??'采用当前pnpm配置'}。确认仅安装，enabled=false。`:`此处哈希是固定发行包标识，未重新读取已安装文件。本次确认覆盖启用包 ${release.id} 及其唯一组件 ${review.inventory.bundle.rows[0].rowId}（模块 ${release.id}${review.inventory.rows[0]?'；entryId '+review.inventory.rows[0].entryId:''}）。包已启用时仅启用该组件；包启用已使组件加载时不重复启用。`),
    review.kind==='activate'?h('p',null,'这两项启用动作会保存当前profile的包选择及组件配置，影响该profile全部会话。组件代码在Host进程以应用用户权限运行；失败、重启要求或未知结果会停止后续动作，已发出的操作不会因返回而取消。'):null,
    h('p',null,'代码在Host进程以应用用户权限运行，不受工作区沙箱隔离。官方安装会改写当前profile的依赖、锁文件、缓存和日志，可能访问配置的registry/镜像解析依赖；影响该profile全部会话。'+(workbench?'工作台读取老师明确选择的参考资料；确认生成后向本人已配置的默认模型发送所选内容，可能产生费用；教师审阅并再次确认后写入选定工作区。不改其他插件、不创建对话或暴露代理工具。':toolsOnly?'本插件注册两个只读工具；空配置可加载，但不证明授权或读取就绪。需在官方设置选定可信CLI和一个文档，再按用户请求读取目录和选中章节；内容进入当前模型/会话。':'提供方仅在明确启用后校验并注册静态说明，不读文件、不联网、不调用模型。')),
    h('p',null,'QCU代码范围是实现限制，不是OS沙箱。不会自动授权build脚本、版本豁免或扩大权限。审批人为本机用户，没有远程审核。'),
    h('div',{className:'qcu-button-row'},button(review.kind==='install'?'拒绝／不安装':'拒绝／不启用',()=>flow.decline()),button(review.kind==='install'?'确认安装（保持未启用）':'确认启用',()=>review.kind==='install'?flow.confirmInstall():flow.confirmActivate(),false,true))):null,
   h('section',{className:'qcu-section'},h('h2',null,'这样开始使用'),h('p',{className:'qcu-muted'},workbench?'启用后打开侧栏 Course Studio：选择 DSH 工作区，创建课程，加入匿名资料与学习目标，选组件并确认生成，再预览、修订和保存。资料30分钟有效，任务使用后需重新选择。':toolsOnly?'启用后，在官方插件设置填写可信原生CLI的绝对路径和文档基础链接；本人完成正常用户只读授权，再在目标会话确认两个工具可发现。先列目录，选择一节后读取并审阅。':'启用并确认技能可用后，将示例粘贴到对话中发送。'),h('textarea',{readOnly:true,value:item.example,'aria-label':workbench?'工作台使用步骤':toolsOnly?'工具请求示例':'学习示例',rows:4}),workbench?null:button(toolsOnly?'复制工具请求示例':'复制学习示例',async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw Error('无剪贴板');await navigator.clipboard.writeText(item.example);setCopied('已复制，请自行粘贴并发送。')}catch{setCopied('复制失败，请手动选中上方示例复制。')}}),h('span',{className:'qcu-hint',role:'status'},copied)),
   h(VersionPanel,{item,flow,onDetails}),
   h('section',{className:'qcu-section'},h('h2',null,'来源与兼容信息'),h('dl',{className:'qcu-facts'},...[
    ['能力',workbench?'Host + Client 工作台；包内说明 Skill：qcu-course-draft；14种草案组件（6项实验性）':toolsOnly?'只读工具：qcu_feishu_outline（目录）、qcu_feishu_section（选择的一节）；没有 Skill':'Skill：'+release.skill],['兼容性','DSH '+release.runtime],['来源',item.sourceLabel+' · '+release.origin],['许可',release.license],['作者',item.provenance.author],['上游来源',item.provenance.upstreamSource],['固定修订',item.provenance.pinnedRevision],['修改说明',item.provenance.modifications],['使用前提',item.prerequisites],['验证状态',item.testStatus]
   ].map(([k,v])=>h('div',{key:k},h('dt',null,k),h('dd',null,v))))),
   h('section',{className:'qcu-section'},h('h2',null,'权限与影响'),h('p',null,item.risk),h('p',{className:'qcu-muted'},'市场Host仅按请求下载并校验固定包，写入 ~/.cache/qcu-market。不读取聊天或凭据，不创建会话。'+(workbench?'工作台独立持久化课程和草案，参考资料只留Host内存；停用停止自身生成，已保存成果保留。覆盖文件需额外确认；包内说明Skill不代替这些动作。':toolsOnly?'市场不执行CLI或代写配置；插件通过官方设置与工具审批，使用本人选定的本机CLI读取一个文档。开发机授权不会转移；目录与章节是待审阅的数据，后续模型使用需自行配置。':'提供方只注册静态说明；发送示例需自行配置模型。静态说明不增加工具权限，后续使用已有工具仍遵守当前审批。'))),
   h('details',{className:'qcu-technical'},h('summary',null,'技术检查与操作日志'),unavailable?h('p',null,unavailable):null,h(Diagnostics,{flow,item}),h('p',{className:'qcu-hash'},`SHA256：${release.sha256} · ${release.bytes} 字节`),button('官方插件详情',()=>onDetails(release.id))))
 }
 function MarketPage({availability,onBack,catalog=bundledCatalog}){
  const ready=React.useSyncExternalStore(availability.subscribe,availability.snapshot,availability.snapshot)
  const [category,setCategory]=React.useState('all'),[scenario,setScenario]=React.useState('all'),[query,setQuery]=React.useState(''),[selected,setSelected]=React.useState(null)
  const [aux,setAux]=React.useState(null),[guide,setGuide]=React.useState({step:0,done:false}),[drafts,setDrafts]=React.useState({}),[task,setTask]=React.useState(null),[detailReturn,setDetailReturn]=React.useState(null)
  const root=React.useRef(null),lastSelected=React.useRef(null),lastAux=React.useRef(null)
  React.useEffect(()=>{if(aux)root.current?.querySelector('[data-page-heading]')?.focus();else if(lastAux.current&&!selected)root.current?.querySelector('[data-aux="'+lastAux.current+'"]')?.focus();lastAux.current=aux},[aux,selected])
  const navigate=page=>{setSelected(null);setDetailReturn(null);setAux(page)}
  const auxiliary=h('nav',{'aria-label':'教学辅助',className:'qcu-page-nav'},...[[null,'市场首页'],['versions','版本管理'],['guide','新手指引'],['tasks','常用任务'],['feedback','问题反馈']].map(([key,text])=>h('button',{key:text,type:'button',className:'qcu-control','data-aux':key||'home','aria-pressed':aux===key&&!selected,onClick:()=>navigate(key)},text)))
  React.useEffect(()=>{if(selected)root.current?.querySelector('[data-page-heading]')?.focus();else if(lastSelected.current)root.current?.querySelector('[data-item="'+lastSelected.current+'"] button')?.focus();lastSelected.current=selected},[selected])
  const flowFor=item=>ready.flows?.[catalog.entries.indexOf(item)]||ready.flow
  const item=catalog.entries.find(e=>e.id===selected)
  const kindItems=catalog.entries.filter(e=>category==='all'||productKindOf(e)===(category==='skills'?'skill':'plugin'))
  const scenarios=[...new Set(kindItems.map(e=>e.scenario))]
  const visible=catalog.entries.filter(e=>(category==='all'||category==='plugins'&&productKindOf(e)==='plugin'||category==='skills'&&productKindOf(e)==='skill')&&(scenario==='all'||e.scenario===scenario)&&[e.title,e.purpose,e.scenario].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return h('section',{ref:root,className:'qcu-market','aria-label':'QCU市场'},h('style',null,marketStyles),h('div',{className:'qcu-content'},h('header',{className:'qcu-app-header'},h('div',{className:'qcu-wordmark'},h(Icon),h('span',null,'QCU 市场')),h('button',{type:'button',className:'qcu-control qcu-exit',onClick:onBack},'← 返回对话')),auxiliary,aux==='versions'?h(VersionsPage,{catalog,flowFor,onDetails:ready.onDetails}):aux==='guide'?h(Guide,{state:guide,setState:setGuide,onHome:()=>navigate(null)}):aux==='tasks'?h(Tasks,{drafts,setDrafts,selected:task,setSelected:setTask,onDetail:id=>{setDetailReturn('tasks');setAux(null);setSelected(id)}}):aux==='feedback'?h(Feedback):item?h(Detail,{key:item.id,item,flow:flowFor(item),onBack:()=>{setSelected(null);setAux(detailReturn);setDetailReturn(null)},onDetails:ready.onDetails,unavailable:ready.unavailable}):h(React.Fragment,null,
   h('header',{className:'qcu-home-intro'},h('h1',null,'教学工具'),h('p',{className:'qcu-muted'},'按用途选择技能与插件，查看详情后再决定是否安装。')),
   h('section',{className:'qcu-onboarding','aria-label':'首次使用指引'},h('div',null,h('h2',null,guide.done?'随时回看使用步骤':'第一次使用，从这里开始'),h('p',{className:'qcu-hint'},guide.done?'已浏览引导（不代表已验收）；可随时从“新手指引”再看。':'5 步了解模型设置、技能选择和手动发送，可随时退出。')),h('button',{type:'button',className:'qcu-control',onClick:()=>navigate('guide')},guide.done?'再看指引':'开始浏览引导')),
   h('div',{className:'qcu-market-workspace'},h('aside',{className:'qcu-scenes','aria-label':'使用场景'},h('h2',null,'使用场景'),...['all',...scenarios].map(value=>h('button',{key:value,type:'button',className:'qcu-scene-filter','aria-pressed':scenario===value,onClick:()=>setScenario(value)},h('span',null,value==='all'?'全部场景':value),h('span',{'aria-hidden':true},kindItems.filter(e=>value==='all'||e.scenario===value).length)))),h('div',{className:'qcu-market-results'},h('div',{className:'qcu-toolbar'},h('nav',{'aria-label':'市场分类',className:'qcu-tabs'},...[['all','全部'],['skills','技能 Skill'],['plugins','插件 Plugin']].map(([key,text])=>h('button',{key,type:'button','aria-pressed':category===key,onClick:()=>{setCategory(key);setScenario('all')}},text))),h('label',{className:'qcu-search'},h('span',null,'搜索'),h('input',{type:'search',value:query,onChange:e=>setQuery(e.target.value),placeholder:'搜索名称或用途','aria-label':'搜索名称或用途'}))),
   h('p',{className:'qcu-count',role:'status','aria-live':'polite'},`${visible.length} 款工具`),
   visible.length?h('div',{className:'qcu-grid'},...visible.map(e=>h('div',{key:e.id,'data-item':e.id},h(Card,{item:e,flow:flowFor(e),onOpen:()=>setSelected(e.id)})))):h('div',{className:'qcu-empty'},h(Icon),h('h2',null,query.trim()?'没有找到匹配项目':'暂无可安装的技能'),h('p',null,query.trim()?'试试其他关键词，或切换分类。':'审核后的独立技能将在这里显示。'),query?h('button',{type:'button',className:'qcu-control',onClick:()=>setQuery('')},'清除搜索'):null))),
   h('details',{className:'qcu-technical'},h('summary',null,'技术检查与操作日志'),ready.unavailable?h('p',null,ready.unavailable):null,...catalog.entries.map(e=>h(Diagnostics,{key:e.id,item:e,flow:flowFor(e)}))))))
 }
 return {MarketPage,Detail,Icon}
}
