import {FeedbackFlow} from './feedback-flow.mjs'
import {CatalogRuntime} from './catalog-runtime.mjs'
import {remoteContribution} from './remote-contract.mjs'
import {release} from './trusted-release.mjs'
import {createMarketViews} from './market-view.mjs'
export function createLoopPlugin(React){
 const {MarketPage,Icon}=createMarketViews(React)
  return {inject:['slots','layout'],apply(ctx){
    // Keep a visible unavailable panel while optional runtime services are absent.
    // Package-level dsh.client.inject does not declare Cordis service access.
    const unavailableDetails=()=>{throw new Error('官方详情服务不可用')}
    let ready={openFirstTask:()=>{try{ctx.layout.selectPanel('qcu-teacher-help');return true}catch{return false}},flow:null,unavailable:'缺少官方管理或 QCU 包准备服务，不能安装。',onDetails:unavailableDetails}
    const listeners=new Set()
    const availability={snapshot:()=>ready,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}}
    const update=patch=>{ready={...ready,...patch};for(const fn of listeners)fn()}
    ctx.effect(()=>()=>listeners.clear())
    ctx.inject(['pluginNavigation'],navigationCtx=>{
      update({onDetails:(id=release.id)=>navigationCtx.pluginNavigation.openBundle(id)})
      navigationCtx.effect(()=>()=>update({onDetails:unavailableDetails}))
    })
    ctx.inject(['remote'],async serviceCtx=>{
      let ui,unmount
      try{
        unmount=await serviceCtx.remote.$mount(remoteContribution)
        // Our namespace exists only after $mount; declaring it on the outer
        // plugin would deadlock startup. The manager is a consumer dependency only:
        // withdrawing it must not queue $unmount inside its own namespace teardown.
        ui=serviceCtx.inject(['remote.pluginManager','remote.qcuMarket'],async flowCtx=>{
          const feedback=new FeedbackFlow(flowCtx.remote)
          const runtime=new CatalogRuntime(flowCtx.remote,update)
          update({feedback,refresh:()=>runtime.refresh(),updates:runtime.updates,catalog:{entries:[]}})
          flowCtx.effect(()=>()=>{feedback.dispose();runtime.dispose();update({feedback:null,flow:null,flows:null,flowByKey:null,updates:null,refresh:null,catalog:{entries:[]},unavailable:'服务已释放或连接能力变化，请等待服务恢复。'})})
          flowCtx.on('connection/reset',()=>{feedback.invalidate();runtime.reset()})
          await runtime.refresh()
        })
      }catch(e){await ui?.dispose();await unmount?.();update({flow:null,unavailable:e.message});return}
      // Withdraw consumers before the namespace they use; both belong to this fiber.
      serviceCtx.effect(()=>async()=>{await ui.dispose();await unmount()})
    })
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-market',inject:()=>({availability,onBack:()=>ctx.layout.selectPanel(null)})},MarketPage))
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-market',order:30,label:'工具市场'},Icon))
  }}
}
