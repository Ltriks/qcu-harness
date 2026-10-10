import { DirectMarketFlow } from './direct-flow.mjs'
import { remoteContribution } from './remote-contract.mjs'
import { release } from './trusted-release.mjs'
import { iconPaths } from './icons.mjs'
import { marketStyles } from './styles.mjs'
const unavailableSnapshot=Object.freeze({phase:'unavailable',status:null,review:null,message:'缺少官方管理或QCU包准备服务；不能安装。'})
const noSubscribe=()=>()=>{}
const example='/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。'
export function createLoopPlugin(React){
  const h=React.createElement
  function Icon(){return h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},...iconPaths.market.map((d,i)=>h('path',{key:i,d})))}
  function Market({flow,onBack,onDetails,unavailable}){
    const state=React.useSyncExternalStore(flow?.subscribe||noSubscribe,flow?.snapshot||(()=>unavailableSnapshot),flow?.snapshot||(()=>unavailableSnapshot))
    const [error,setError]=React.useState(''),[copied,setCopied]=React.useState('')
    React.useEffect(()=>()=>{if(flow?.state.review||flow?.pending?.kind==='prepare')void flow.cancel()},[flow])
    const act=fn=>{setError('');void Promise.resolve().then(fn).catch(e=>setError(e.message))}
    const labels={'not-installed':'未安装','installed-disabled':'已安装，未启用','row-disabled':'包已启用，教练组件未启用','component-active':'组件已加载；技能调用尚未验证','restart-or-pending':'组件待加载或需重启',conflict:'版本或组件冲突',failed:'加载失败'}
    const busy=['preparing','verifying','installing','cancelling','applying','checking','enabling','unconfirmed'].includes(state.phase)
    const review=state.review
    const button=(text,fn,disabled=false)=>h('button',{type:'button',className:'qcu-control',disabled,onClick:()=>act(fn)},text)
    return h('section',{className:'qcu-market','aria-label':'QCU市场'},h('style',null,marketStyles),h('div',{className:'qcu-content'},
      button('返回对话',onBack),h('header',{className:'qcu-head'},h('div',{className:'qcu-wordmark'},h(Icon),h('h1',null,'QCU市场')),h('span',{className:'qcu-badge'},'用户确认安装 · 本地候选')),
      h('p',null,'安装无需模型或 API Key。包由校内 Hub 独立托管，点击准备后按需下载；市场不捆绑教练安装包。'),
      h('article',{className:'qcu-card'},h('h2',null,'QCU学习方法教练'),h('p',null,`${release.id}@${release.version} · skill ${release.skill} · DSH ${release.runtime} · MIT`),h('p',null,'拆解任务、合理安排节奏与错题复盘；不代写应交作业。'),
        h('p',{role:'status','aria-live':'polite'},labels[state.status?.state]||'当前实例尚未核对'),h('p',null,state.status?.reason||''),
        h('p',{className:'qcu-note'},'独立教练包从校内 Hub 按需下载；是否可获取以本次下载与完整性校验结果为准。模拟测试通过；真机安装、重启及教学效果待验收。'),
        unavailable?h('p',{role:'alert'},unavailable):null,
        button('检查本实例',()=>flow.status(),!flow||(busy&&!(state.phase==='unconfirmed'&&!flow.request))||Boolean(review)),
        !review&&(!state.status||state.status.state==='not-installed')?button('下载并查看安装确认',()=>flow.prepare(),!flow||busy):null,
        state.status?.state==='installed-disabled'&&!review?button('查看启用包确认',()=>flow.reviewEnable('bundle'),busy):null,
        state.status?.state==='row-disabled'&&!review?button('查看启用组件确认',()=>flow.reviewEnable('row'),busy):null,
        button('官方插件详情',onDetails),
        review?h('section',{className:'qcu-note','aria-labelledby':'qcu-review-title'},h('h2',{id:'qcu-review-title'},review.kind==='install'?'请确认本次安装':'请确认本次启用'),
          h('p',null,`名称：QCU学习方法教练；包：${release.id}；版本：${release.version}；来源：QCU自有 / ${release.origin}`),
          h('p',{style:{overflowWrap:'anywhere'}},`SHA256：${release.sha256}；${release.bytes} 字节`),
          h('p',null,review.kind==='install'?`官方检查：本机固定包；registry ${review.inspected.registry??'采用当前pnpm配置'}。确认仅安装，enabled=false。`:`此处哈希是固定发行包标识，未重新读取已安装文件。本次只启用${review.kind==='bundle'?'包，不自动启用组件':`组件 ${review.status.entryId}`}。`),
          h('p',null,'代码在Host进程以应用用户权限运行，不受工作区沙箱隔离。官方安装会改写当前profile的依赖、锁文件、缓存和日志，可能访问配置的registry/镜像解析依赖；影响该profile全部会话。教练运行时只注册静态技能。'),
          h('p',null,'QCU代码范围是实现限制，不是OS沙箱。不会自动授权build脚本、版本豁免或扩大权限。审批人为本机用户，没有远程审核。'),
          button('拒绝／不安装',()=>flow.decline()),button(review.kind==='install'?'确认安装（保持未启用）':'确认本次启用',()=>review.kind==='install'?flow.confirmInstall():flow.confirmEnable())):null,
        ['preparing','verifying','installing','cancelling','applying','unconfirmed'].includes(state.phase)?button('请求取消',()=>flow.cancel(),state.phase==='cancelling'):null,
        flow?.request?button('核对官方任务结果',()=>flow.reconcile()):null,
        h('p',{role:'status','aria-live':'polite'},state.message),error?h('p',{role:'alert'},error):null,
        state.result?.pendingBuilds?.length?h('p',{role:'alert'},`需要额外脚本授权，市场已停止：${state.result.pendingBuilds.join(', ')}。请另行审核。`):null,
        state.result?.application==='restart-required'?h('p',null,'需要你正常重启应用；市场不会替你重启，也不声称已生效。'):null,
        h('details',null,h('summary',null,'使用示例（手动发送）'),h('p',null,'组件加载不等于目标会话技能已发现。安装不调用模型；发送学习任务本身需要官方聊天已有的模型配置。'),h('textarea',{readOnly:true,value:example,'aria-label':'学习示例',rows:4,style:{width:'100%'}}),button('复制学习示例',async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error('无剪贴板');await globalThis.navigator.clipboard.writeText(example);setCopied('已复制；请自行在对话中粘贴并发送。')}catch{setCopied('复制失败，请手动选中上方示例复制。')}}),h('p',{role:'status'},copied))),
      h('details',null,h('summary',null,'权限与官方Office帮助'),h('p',null,'QCU Host仅按请求下载校验固定包并写入 ~/.cache/qcu-market。无会话创建、技能正文、聊天或凭据读取，无模型工具。客户端只按操作读取官方插件清单，用户确认后才发起安装或独立启用。'),h('p',null,'office-pptx / office-docx / office-xlsx 为官方能力；本实例需另行核对，不在此重复安装。'))))
  }
  return {inject:['slots','layout'],async apply(ctx){
    let flow=null,unavailable=''
    const remote=ctx.get('remote')
    try{if(!remote?.$mount||!remote.pluginManager)throw new Error('缺少官方管理或QCU包准备服务；不能安装。');await remote.$mount(remoteContribution);flow=new DirectMarketFlow(remote)}catch(e){unavailable=e.message}
    ctx.effect(()=>()=>flow?.dispose())
    if(flow)ctx.effect(()=>ctx.on('connection/reset',()=>flow.invalidate()))
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-market',inject:()=>({flow,unavailable,onBack:()=>ctx.layout.selectPanel(null),onDetails:()=>{const navigation=ctx.get('pluginNavigation');if(!navigation)throw new Error('官方详情服务不可用');navigation.openBundle(release.id)}})},Market))
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-market',order:30,label:'QCU市场'},Icon))
  }}
}
