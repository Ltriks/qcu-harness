import {TeamsController} from './controller.mjs'
import {createTeamsViews} from './view.mjs'
import {remoteContribution} from './protocol.mjs'
export function createPlugin(React){const {Page,Entry}=createTeamsViews(React),h=React.createElement;return {inject:['slots','layout'],apply(ctx){
 let current=null;const listeners=new Set(),subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)},snapshot=()=>current,update=v=>{current=v;for(const fn of listeners)fn()}
 function Panel(){const c=React.useSyncExternalStore(subscribe,snapshot,snapshot);return c?h(Page,{controller:c,onBack:()=>ctx.layout.selectPanel(null)}):h('div',{style:{padding:24}},'专家团工作室正在连接；若未启用，请在插件设置中启用本插件。')}
 ctx.effect(()=>()=>listeners.clear())
 ctx.inject(['remote'],async service=>{let consumer,unmount;try{unmount=await service.remote.$mount(remoteContribution);consumer=service.inject(['remote.qcuTeams'],inner=>{const c=new TeamsController(inner.remote.qcuTeams);update(c);void c.boot();inner.on('connection/reset',()=>void c.reconnect());inner.effect(()=>()=>{c.dispose();update(null)})})}catch{await consumer?.dispose();await unmount?.();return}service.effect(()=>async()=>{await consumer.dispose();await unmount()})})
 ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-expert-teams'},Panel))
 ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-expert-teams',order:32,label:'专家团'},Entry))
}}}
