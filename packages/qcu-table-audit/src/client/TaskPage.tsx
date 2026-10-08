/** No Session or conversation service is used by this standalone task view. */
import * as React from 'react'
import { CsvTaskController } from './controller.ts'
export function TaskPage() {
  const [controller, setController] = React.useState<CsvTaskController>()
  React.useEffect(() => {
    const owner = new CsvTaskController(); setController(owner); void owner.open()
    return () => { void owner.dispose().catch(() => {}) }
  }, [])
  return controller ? <TaskView controller={controller} /> : <p role="status">连接任务服务</p>
}
function TaskView({ controller }: { controller: CsvTaskController }) {
  const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [consent, setConsent] = React.useState(false)
  const [kind, setKind] = React.useState<'demo' | 'personal'>('demo')
  const [rules, setRules] = React.useState('{}')
  const picker = React.useRef<HTMLInputElement>(null)
  const busy = ['opening', 'authorizing', 'checking', 'clearing'].includes(state.phase)
  return <section aria-label="CSV 只读诊断" style={{ padding: 24, maxWidth: 800, margin: 'auto' }}>
    <h1>CSV 只读诊断</h1>
    <p>每次仅选择一个 CSV。本机诊断，不改原件、不上传表格内容到外部服务。摘要只包含计数。</p>
    <p>演示和个人规则不代表学校正式规范。</p>
    <p>若插件页提示“下次启动生效”，关闭开关不会立即撤销当前任务。停止使用请先“取消并撤销”，再正常退出并重启；重启后确认入口消失。</p>
    <label>选择 CSV <input ref={picker} type="file" accept=".csv,text/csv" disabled={busy || state.phase === 'failed'}
      onChange={event => { setConsent(false); void controller.select(event.currentTarget.files?.[0]) }} /></label>
    {state.filename && <p>当前文件：{state.filename}</p>}
    <label>规则 <select value={kind} disabled={state.phase !== 'selected' && state.phase !== 'idle'}
      onChange={event => { setConsent(false); setKind(event.currentTarget.value as 'demo' | 'personal') }}>
      <option value="demo">演示规则</option><option value="personal">个人规则</option></select></label>
    {kind === 'personal' && <label>个人规则 JSON <textarea value={rules} rows={8} disabled={state.phase !== 'selected'}
      onChange={event => { setConsent(false); setRules(event.currentTarget.value) }} /></label>}
    <p><label><input type="checkbox" checked={consent} disabled={state.phase !== 'selected'} onChange={event => setConsent(event.currentTarget.checked)} />
      授权本次所选文件用于短期、只读 CSV 诊断；更换或取消将撤销授权。</label></p>
    <button type="button" disabled={!consent || state.phase !== 'selected'} onClick={() => { void controller.authorize(consent, kind, rules) }}>授权本次文件</button>{' '}
    <button type="button" disabled={!['ready', 'complete'].includes(state.phase)} onClick={() => { void controller.check() }}>检查 / 再次检查</button>{' '}
    <button type="button" disabled={state.phase === 'opening' || state.phase === 'idle'} onClick={() => {
      setConsent(false); if (picker.current) picker.current.value = ''; void controller.cancel()
    }}>取消并撤销</button>
    {state.error && <p role="alert">任务未完成或清理失败。请重试清理，然后重新选择文件。<button type="button" onClick={() => {
      setConsent(false); if (picker.current) picker.current.value = ''; void controller.retryCleanup()
    }}>重试清理</button></p>}
    <p role="status">{({ opening: '连接任务服务', idle: '等待选择文件', selected: '等待逐文件授权', authorizing: '正在授权', ready: '可以检查', checking: '正在检查', complete: '检查完成', clearing: '撤销与清理中', failed: '任务不可用', closed: '已关闭' })[state.phase]}</p>
    {state.summary && <div><p>记录：{state.summary.rows}；问题：{state.summary.issues}</p>
      <table><thead><tr><th>问题类型</th><th>数量</th></tr></thead><tbody>{Object.entries(state.summary.counts).map(([code, count]) => <tr key={code}><td>{code}</td><td>{count}</td></tr>)}</tbody></table>
      <button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([controller.export()], { type: 'application/json;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = 'qcu-csv-count-summary.json'; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>导出仅计数摘要</button></div>}
  </section>
}
