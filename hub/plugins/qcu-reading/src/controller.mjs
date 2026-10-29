import {VERSION, PROTOCOL, LIMITS, errors, check} from './protocol.mjs'

export class ReadingController {
  constructor(remote, {storage = globalThis.localStorage} = {}) {
    this.remote = remote; this.storage = storage; this.listeners = new Set(); this.epoch = 0; this.pollEpoch = 0
    this.state = {workspaces:[], workspaceId:'', documents:[], notes:[], runs:[], document:null, selected:'', query:'', hits:[], searched:false, question:'', prepared:null, consent:false, run:null, excerpt:'', comment:'', busy:false, parsing:null, loading:true, error:'', notice:'', pane:'original', showMaterials:false}
  }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  snapshot = () => this.state
  set(patch) { if (this.closed) return; this.state = {...this.state, ...patch}; for (const fn of this.listeners) fn() }
  async call(payload) {
    const reply = await this.remote.dispatch(JSON.stringify(payload))
    const wire = typeof reply === 'string' ? JSON.parse(reply) : reply.ok && typeof reply.value === 'string' ? JSON.parse(reply.value) : reply
    if (!wire.ok) throw Object.assign(Error(wire.error), {code:wire.error})
    check(wire.version === VERSION && wire.protocol === PROTOCOL, 'operation-failed')
    return wire.value
  }
  message(e) { return errors[e?.code] ?? errors['operation-failed'] }
  async action(fn) {
    if (this.state.busy || this.closed) return false
    const epoch = this.epoch
    this.set({busy:true, error:'', notice:''})
    try { await fn(epoch); return epoch === this.epoch }
    catch (e) { if (epoch === this.epoch) this.set({error:this.message(e), notice:''}); return false }
    finally { if (epoch === this.epoch) this.set({busy:false}) }
  }
  forgetConfirmation() {
    const s = this.state
    if (s.prepared) void this.call({action:'dismiss', workspaceId:s.workspaceId, intentId:s.prepared.id}).catch(() => {})
    this.set({prepared:null, consent:false})
  }
  invalidate() { this.forgetConfirmation(); this.stopImport(); this.epoch++; this.set({busy:false, parsing:null, error:'', notice:''}) }
  async boot() {
    const epoch = ++this.epoch
    this.set({loading:true})
    try {
      const workspaces = await this.call({action:'workspaces'})
      if (epoch !== this.epoch || this.closed) return
      this.set({workspaces, loading:false})
      let remembered
      try { remembered = this.storage?.getItem('qcu-reading.workspace') } catch {}
      const chosen = workspaces.find(w => w.id === this.state.workspaceId || w.id === remembered) ?? (workspaces.length === 1 ? workspaces[0] : null)
      if (chosen) await this.selectWorkspace(chosen.id)
    } catch (e) { if (epoch === this.epoch) this.set({loading:false, error:this.message(e)}) }
  }
  async selectWorkspace(id) {
    this.invalidate(); clearTimeout(this.timer); const token = ++this.pollEpoch, epoch = this.epoch
    this.set({workspaceId:id, documents:[], notes:[], runs:[], document:null, selected:'', question:'', query:'', hits:[], searched:false, run:null, loading:!!id, excerpt:'', comment:''})
    if (!id) return
    try {
      const data = await this.call({action:'catalog', workspaceId:id})
      if (epoch !== this.epoch || this.closed) return
      this.set({...data, loading:false})
      try { this.storage?.setItem('qcu-reading.workspace', id) } catch {}
      if (data.documents.length) await this.openDocument(data.documents[0].id)
      const active = data.runs.find(r => r.status === 'running')
      if (active && token === this.pollEpoch) { this.set({run:active}); this.poll(active.id, token) }
    } catch (e) { if (epoch === this.epoch) this.set({loading:false, error:this.message(e)}) }
  }
  async openDocument(id, locator = '') {
    this.invalidate(); const epoch = this.epoch, workspaceId = this.state.workspaceId
    this.set({loading:true, query:'', hits:[], searched:false, excerpt:'', comment:'', selected:'', showMaterials:false})
    try {
      const document = await this.call({action:'document', workspaceId, documentId:id})
      if (epoch !== this.epoch || this.closed) return
      this.set({document, loading:false})
      if (locator) this.selectParagraph(locator)
    } catch (e) { if (epoch === this.epoch) this.set({loading:false, error:this.message(e)}) }
  }
  input(key, value) {
    if (key === 'question') this.invalidate()
    if (key === 'query') this.set({searched:false, hits:[]})
    this.set({[key]:value})
  }
  async refresh(epoch = this.epoch) {
    const data = await this.call({action:'catalog', workspaceId:this.state.workspaceId})
    if (epoch === this.epoch) this.set(data)
  }
  async importFile(file) {
    const workspaceId = this.state.workspaceId
    this.forgetConfirmation()
    await this.action(async epoch => {
      check(file && /\.(txt|md|pdf|docx)$/i.test(file.name), 'unsupported-format')
      const binary = /\.(pdf|docx)$/i.test(file.name)
      check(file.size <= (binary ? LIMITS.binaryBytes : LIMITS.fileBytes), binary ? 'binary-too-large' : 'file-too-large')
      const importId = crypto.randomUUID(), task = {id:importId, workspaceId, cancelled:false}
      this.importTask = task; this.set({parsing:{stage:'opening', done:0, total:0}})
      let input
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        check(bytes.length <= (binary ? LIMITS.binaryBytes : LIMITS.fileBytes), binary ? 'binary-too-large' : 'file-too-large')
        if (binary) {
          let ascii = ''; for (let i = 0; i < bytes.length; i += 8192) ascii += String.fromCharCode(...bytes.subarray(i, i + 8192))
          input = {name:file.name, base64:btoa(ascii)}
        } else {
          let content
          try { content = new TextDecoder('utf-8', {fatal:true}).decode(bytes) } catch { check(false, 'invalid-utf8') }
          input = {name:file.name, content}
        }
      // Navigation during file decoding never imports into the newly selected workspace.
      if (epoch !== this.epoch) return
      check(!task.cancelled, 'parse-cancelled')
      if (binary) this.pollImport(task, epoch)
      const result = await this.call({action:'import', workspaceId, importId, file:input})
      if (epoch !== this.epoch) return
      await this.refresh(epoch)
      if (epoch !== this.epoch) return
      this.forgetConfirmation()
      this.set({document:result.document, selected:'', excerpt:'', comment:'', query:'', hits:[], searched:false, showMaterials:false, notice:result.duplicate ? '相同内容已存在，已打开原快照。' : '材料已保存为本地快照。'})
      } finally {
        clearTimeout(task.timer)
        if (this.importTask === task) { this.importTask = null; this.set({parsing:null}) }
      }
    })
  }
  pollImport(task, epoch) {
    task.timer = setTimeout(async () => {
      if (this.importTask !== task || epoch !== this.epoch) return
      try {
        const progress = await this.call({action:'importStatus', workspaceId:task.workspaceId, importId:task.id})
        if (this.importTask === task && epoch === this.epoch) { if (progress.stage !== 'idle') this.set({parsing:progress}); this.pollImport(task, epoch) }
      } catch {}
    }, 200)
  }
  stopImport() {
    const task = this.importTask; if (!task) return
    task.cancelled = true; clearTimeout(task.timer)
    void this.call({action:'cancelImport', workspaceId:task.workspaceId, importId:task.id}).catch(() => {})
  }
  cancelImport() { this.stopImport(); this.set({notice:'正在停止解析…'}) }
  async search() {
    await this.action(async epoch => {
      const s = this.state, query = s.query
      const hits = await this.call({action:'search', workspaceId:s.workspaceId, documentId:s.document.id, query})
      if (epoch === this.epoch && query === this.state.query) this.set({hits, searched:true})
    })
  }
  selectParagraph(locator) {
    const p = this.state.document?.paragraphs.find(p => p.locator === locator)
    if (p) this.set({selected:locator, excerpt:p.text.slice(0, 4000), comment:'', pane:'original'})
  }
  async cite(run, source) {
    if (this.state.document?.id !== run.document.id) await this.openDocument(run.document.id, source.locator)
    else this.selectParagraph(source.locator)
  }
  async saveNote() {
    await this.action(async epoch => {
      const s = this.state
      await this.call({action:'note', workspaceId:s.workspaceId, note:{documentId:s.document.id, locator:s.selected, text:s.excerpt, comment:s.comment}})
      if (epoch === this.epoch) { await this.refresh(epoch); this.set({notice:'摘录已保存，重新打开仍会保留。'}) }
    })
  }
  async prepare() {
    this.forgetConfirmation()
    await this.action(async epoch => {
      const s = this.state, prepared = await this.call({action:'prepare', workspaceId:s.workspaceId, documentId:s.document.id, question:s.question})
      if (epoch !== this.epoch) { if (prepared.id) void this.call({action:'dismiss', workspaceId:s.workspaceId, intentId:prepared.id}).catch(() => {}); return }
      if (prepared.status === 'no-evidence') this.set({notice:errors['no-evidence'], pane:'qa'})
      else this.set({prepared, consent:false, pane:'qa'})
    })
  }
  async start() {
    const p = this.state.prepared
    if (!p || !this.state.consent) return
    await this.action(async epoch => {
      const workspaceId = this.state.workspaceId
      const run = await this.call({action:'start', workspaceId, intentId:p.id, requestId:crypto.randomUUID(), consent:true, documentId:this.state.document.id, question:this.state.question, digest:p.digest})
      if (epoch !== this.epoch) return
      this.set({prepared:null, consent:false, run, pane:'qa'})
      await this.refresh(epoch)
      if (epoch === this.epoch) this.poll(run.id, ++this.pollEpoch)
    })
  }
  poll(id, token) {
    clearTimeout(this.timer)
    const workspaceId = this.state.workspaceId
    this.timer = setTimeout(async () => {
      try {
        const run = await this.call({action:'run', workspaceId, runId:id})
        if (token !== this.pollEpoch || this.closed || workspaceId !== this.state.workspaceId) return
        this.set({...(this.state.run?.id === id ? {run} : {}), runs:this.state.runs.map(r => r.id === id ? run : r)})
        if (run.status === 'running') this.poll(id, token)
      } catch (e) { if (token === this.pollEpoch) this.set({error:this.message(e)}) }
    }, 300)
  }
  async cancel(id) {
    await this.action(async epoch => {
      const run = await this.call({action:'cancel', workspaceId:this.state.workspaceId, runId:id})
      if (epoch === this.epoch) { if (this.state.run?.id === id) this.set({run}); await this.refresh(epoch) }
    })
  }
  async exportRun(id, deliver) {
    await this.action(async epoch => {
      const result = await this.call({action:'export', workspaceId:this.state.workspaceId, runId:id})
      if (epoch === this.epoch) deliver(result)
    })
  }
  async reconnect() { this.invalidate(); clearTimeout(this.timer); ++this.pollEpoch; await this.boot() }
  dispose() { this.forgetConfirmation(); this.stopImport(); clearTimeout(this.timer); ++this.epoch; ++this.pollEpoch; this.closed = true; this.listeners.clear() }
}
