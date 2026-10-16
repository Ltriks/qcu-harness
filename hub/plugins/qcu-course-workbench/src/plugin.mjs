import {createCourseViews} from './view.mjs'
import {CourseController} from './controller.mjs'
import {remoteContribution} from './protocol.mjs'
export function createPlugin(React){
 const {Page,Entry}=createCourseViews(React),h=React.createElement
 return {inject:['slots','layout'],apply(ctx){
  let current=null;const listeners=new Set(),availability={snapshot:()=>current,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}}
  const update=value=>{current=value;for(const fn of listeners)fn()}
  function Panel(){const controller=React.useSyncExternalStore(availability.subscribe,availability.snapshot,availability.snapshot);return controller?h(Page,{controller,onBack:()=>ctx.layout.selectPanel(null)}):h('div',{style:{padding:30}},h('h2',null,'Course Design Studio · 课程设计工作台'),h('p',null,'Connecting to the local workbench… / 正在连接本地工作台…'))}
  ctx.effect(()=>()=>listeners.clear())
  ctx.inject(['remote'],async service=>{
   let consumer,unmount
   try{
    unmount=await service.remote.$mount(remoteContribution)
    consumer=service.inject(['remote.qcuCourse'],inner=>{
     const controller=new CourseController(inner.remote.qcuCourse);update(controller)
     inner.on('connection/reset',()=>controller.invalidate())
     inner.effect(()=>()=>{controller.dispose();update(null)})
    })
   }catch{await consumer?.dispose();await unmount?.();return}
   service.effect(()=>async()=>{await consumer.dispose();await unmount()})
  })
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-course-workbench'},Panel))
  ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-course-workbench',order:31,label:'Course Studio'},Entry))
 }}
}
