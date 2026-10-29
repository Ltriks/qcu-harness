import {ReadingController} from './controller.mjs'
import {createReadingViews} from './view.mjs'
import {remoteContribution} from './protocol.mjs'

export function createPlugin(React) {
  const {Page, Entry} = createReadingViews(React), h = React.createElement
  return {inject:['slots', 'layout'], apply(ctx) {
    let current = null
    const listeners = new Set(), subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }, snapshot = () => current
    const update = value => { current = value; for (const fn of listeners) fn() }
    function Panel() {
      const controller = React.useSyncExternalStore(subscribe, snapshot, snapshot)
      return controller ? h(Page, {controller, onBack:() => ctx.layout.selectPanel(null)}) : h('p', {style:{padding:16}}, '材料伴读正在连接；请确认插件已启用。')
    }
    ctx.effect(() => () => listeners.clear())
    ctx.inject(['remote'], async service => {
      let consumer, unmount
      try {
        unmount = await service.remote.$mount(remoteContribution)
        consumer = service.inject(['remote.qcuReading'], inner => {
          const controller = new ReadingController(inner.remote.qcuReading)
          update(controller); void controller.boot()
          inner.on('connection/reset', () => void controller.reconnect())
          inner.effect(() => () => { controller.dispose(); update(null) })
        })
      } catch { await consumer?.dispose(); await unmount?.(); return }
      service.effect(() => async () => { await consumer.dispose(); await unmount() })
    })
    ctx.slots.inject('main', () => ctx.slots.register({name:'main', key:'qcu-reading'}, Panel))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({name:'sidebar.panellist', id:'qcu-reading', order:34, label:'材料伴读'}, Entry))
  }}
}
