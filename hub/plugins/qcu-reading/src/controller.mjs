import {VERSION, PROTOCOL, LIMITS, errors, check} from './protocol.mjs'
import {SHELF_LIMITS, emptyMetadata, metadataFor} from './shelf.mjs'

export class ReadingController {
  constructor(remote, {storage = globalThis.localStorage} = {}) {
    this.remote = remote; this.storage = storage; this.listeners = new Set(); this.epoch = 0; this.pollEpoch = 0; this.workspacesEpoch = 0
    this.state = {workspaces:[], workspaceId:'', refreshingWorkspaces:false, workspacesError:'', workspacesNotice:'', workspaceMissing:false, documents:[], notes:[], runs:[], library:{documents:{}, notes:{}}, shelfQuery:'', course:'', tag:'', favorites:false, shelfIds:null, shelfHits:[], deletePreview:null, backing:null, document:null, selected:'', query:'', hits:[], searched:false, question:'', prepared:null, consent:false, run:null, excerpt:'', comment:'', busy:false, parsing:null, loading:true, error:'', notice:'', pane:'original', showMaterials:false}
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
    if (this.state.busy || !this.state.workspaceId || this.closed) return false
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
  invalidate() { this.forgetConfirmation(); this.dismissDelete(); this.cancelBackup(); this.stopImport(); this.epoch++; this.set({busy:false, parsing:null, error:'', notice:''}) }
  setWorkspaces(workspaces) {
    if (this.state.workspaceId && !workspaces.some(w => w.id === this.state.workspaceId)) {
      // Invalidate local sends/replies and observation only. Never cancel a Host job or erase its saved data.
      ++this.epoch; ++this.pollEpoch; clearTimeout(this.timer); clearTimeout(this.importTask?.timer)
      this.dismissDelete(); this.cancelBackup()
      this.set({workspaces, workspaceId:'', workspaceMissing:true, prepared:null, consent:false, busy:false, loading:false, parsing:null})
    } else this.set({workspaces})
  }
  async refreshWorkspaces() {
    if (this.closed) return
    const token = ++this.workspacesEpoch
    this.set({refreshingWorkspaces:true, workspacesError:'', workspacesNotice:''})
    try {
      const workspaces = await this.call({action:'workspaces'})
      if (token !== this.workspacesEpoch || this.closed) return
      this.setWorkspaces(workspaces)
      this.set({workspacesNotice:'工作区列表已刷新。'})
    } catch (e) { if (token === this.workspacesEpoch && !this.closed) this.set({workspacesError:'刷新工作区失败：' + this.message(e)}) }
    finally { if (token === this.workspacesEpoch && !this.closed) this.set({refreshingWorkspaces:false}) }
  }
  async boot() {
    if (this.closed) return
    const epoch = ++this.epoch, token = ++this.workspacesEpoch
    this.set({loading:false, refreshingWorkspaces:true, workspacesError:'', workspacesNotice:''})
    try {
      const workspaces = await this.call({action:'workspaces'})
      if (token !== this.workspacesEpoch || this.closed) return
      this.setWorkspaces(workspaces)
      if (epoch !== this.epoch) return
      let remembered
      try { remembered = this.storage?.getItem('qcu-reading.workspace') } catch {}
      const chosen = this.state.workspaceMissing ? null : workspaces.find(w => w.id === this.state.workspaceId) ?? workspaces.find(w => w.id === remembered) ?? (!this.state.workspaceId && !remembered && workspaces.length === 1 ? workspaces[0] : null)
      if (chosen) await this.selectWorkspace(chosen.id)
      else if (remembered && !this.state.workspaceId) this.set({workspaceMissing:true})
    } catch (e) { if (token === this.workspacesEpoch && !this.closed) this.set({workspacesError:'读取工作区失败：' + this.message(e)}) }
    finally { if (token === this.workspacesEpoch && !this.closed) this.set({refreshingWorkspaces:false}) }
  }
  async selectWorkspace(id) {
    if (this.closed || (id && !this.state.workspaces.some(w => w.id === id))) return
    this.invalidate(); clearTimeout(this.timer); const token = ++this.pollEpoch, epoch = this.epoch
    this.set({workspaceId:id, workspaceMissing:false, documents:[], notes:[], runs:[], library:{documents:{}, notes:{}}, shelfQuery:'', course:'', tag:'', favorites:false, shelfIds:null, shelfHits:[], document:null, selected:'', question:'', query:'', hits:[], searched:false, run:null, loading:!!id, excerpt:'', comment:''})
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
    if (!this.state.workspaceId || this.closed) return
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
  metadata(id = this.state.document?.id) { return id ? metadataFor(this.state.library, id) : emptyMetadata() }
  async filterShelf(patch = {}) {
    this.set({...patch, shelfIds:null, shelfHits:[]})
    await this.action(async epoch => { await this.loadShelf(epoch) })
  }
  async loadShelf(epoch) {
    const s = this.state
    const binding = state => JSON.stringify([state.shelfQuery, state.course, state.tag, state.favorites])
    const result = await this.call({action:'shelf', workspaceId:s.workspaceId, query:s.shelfQuery, course:s.course, tag:s.tag, favorites:s.favorites})
    if (epoch === this.epoch && binding(s) === binding(this.state)) this.set({shelfIds:result.documentIds, shelfHits:result.hits})
  }
  clearFilters() { void this.filterShelf({shelfQuery:'', course:'', tag:'', favorites:false}) }
  async saveMetadata(metadata) {
    await this.action(async epoch => {
      const s = this.state
      await this.call({action:'metadata', workspaceId:s.workspaceId, documentId:s.document.id, metadata})
      if (epoch !== this.epoch) return
      await this.refresh(epoch); if (epoch !== this.epoch) return
      await this.loadShelf(epoch); if (epoch === this.epoch) this.set({notice:'资料信息已保存；原文和历史来源保持原版本。'})
    })
  }
  async favoriteNote(noteId, favorite) {
    await this.action(async epoch => {
      await this.call({action:'favoriteNote', workspaceId:this.state.workspaceId, noteId, favorite})
      if (epoch === this.epoch) await this.refresh(epoch)
    })
  }
  async openNote(noteId) {
    const note = this.state.notes.find(n => n.id === noteId)
    if (!note || !this.state.documents.some(d => d.id === note.documentId)) { this.set({error:errors['note-not-found']}); return }
    await this.openDocument(note.documentId, note.locator)
  }
  async previewDelete() {
    this.dismissDelete()
    await this.action(async epoch => {
      const s = this.state, preview = await this.call({action:'deletePreview', workspaceId:s.workspaceId, documentId:s.document.id})
      if (epoch === this.epoch) this.set({deletePreview:preview})
      else void this.call({action:'deleteDismiss', workspaceId:s.workspaceId, receiptId:preview.id}).catch(() => {})
    })
  }
  dismissDelete() {
    const s = this.state
    if (s.deletePreview) void this.call({action:'deleteDismiss', workspaceId:s.workspaceId, receiptId:s.deletePreview.id}).catch(() => {})
    this.set({deletePreview:null})
  }
  async confirmDelete() {
    const s = this.state, p = s.deletePreview
    if (!p) return
    await this.action(async epoch => {
      await this.call({action:'deleteConfirm', workspaceId:s.workspaceId, receiptId:p.id, digest:p.digest, documentId:p.document.id, consent:true})
      if (epoch !== this.epoch) return
      this.forgetConfirmation(); this.set({deletePreview:null, document:null, selected:'', excerpt:'', comment:'', run:s.run?.document.id === p.document.id ? null : s.run})
      await this.refresh(epoch); if (epoch !== this.epoch) return
      await this.loadShelf(epoch); if (epoch === this.epoch) this.set({notice:'已删除该版本及其摘录、问答；其他材料记录保留。'})
    })
  }
  cancelBackup() { if (this.backupTask) this.backupTask.cancelled = true; this.set({backing:null}) }
  async exportBackup(deliver) {
    await this.action(async epoch => {
      const workspaceId = this.state.workspaceId, task = {cancelled:false}; this.backupTask = task
      const current = () => !task.cancelled && !this.closed && epoch === this.epoch && workspaceId === this.state.workspaceId
      const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
      this.set({backing:{done:0, total:0}})
      try {
        const p = await this.call({action:'backupPrepare', workspaceId})
        if (!current()) return
        check(p.format === 'qcu-reading-backup' && p.version === 1 && p.stateSchema === 3 && Number.isInteger(p.bytes) && p.bytes > 0 && p.bytes <= SHELF_LIMITS.backupBytes && p.chunkBytes === SHELF_LIMITS.chunkBytes && p.chunks === Math.ceil(p.bytes / p.chunkBytes) && /^[a-f0-9]{64}$/.test(p.digest) && /^[a-f0-9]{64}$/.test(p.checksum), 'backup-invalid')
        const bytes = new Uint8Array(p.bytes); let offset = 0
        for (let index = 0; index < p.chunks; index++) {
          if (!current()) return
          const chunk = await this.call({action:'backupChunk', workspaceId, digest:p.digest, index})
          if (!current()) return
          check(chunk.digest === p.digest && chunk.index === index && typeof chunk.base64 === 'string' && chunk.base64.length <= 4 * Math.ceil(p.chunkBytes / 3) && /^[A-Za-z0-9+/]*={0,2}$/.test(chunk.base64), 'backup-invalid')
          const ascii = atob(chunk.base64), expected = Math.min(p.chunkBytes, p.bytes - offset)
          check(ascii.length === expected, 'backup-invalid')
          for (let i = 0; i < ascii.length; i++) bytes[offset + i] = ascii.charCodeAt(i)
          offset += ascii.length; this.set({backing:{done:index + 1, total:p.chunks}})
        }
        check(offset === p.bytes && await sha(bytes) === p.digest, 'backup-invalid')
        const backup = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes))
        check(backup.format === p.format && backup.version === 1 && backup.stateSchema === 3 && backup.checksum?.algorithm === 'SHA-256' && backup.checksum.state === p.checksum && await sha(new TextEncoder().encode(JSON.stringify(backup.state))) === p.checksum, 'backup-invalid')
        if (!current()) return
        const final = await this.call({action:'backupPrepare', workspaceId})
        check(final.digest === p.digest && final.bytes === p.bytes, 'backup-changed')
        if (current()) { deliver({filename:'qcu-reading-backup-' + p.digest.slice(0, 16) + '.json', bytes}); this.set({notice:'完整本地备份已准备，请在系统保存窗口或下载列表中确认保存；含原材料、摘录及问答。本版尚无导入恢复界面。'}) }
      } finally { if (this.backupTask === task) { this.backupTask = null; if (epoch === this.epoch) this.set({backing:null}) } }
    })
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
      if (epoch === this.epoch) { await this.refresh(epoch); if (epoch === this.epoch) this.set({notice:'摘录已保存，重新打开仍会保留。'}) }
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
  async reconnect() { if (this.closed) return; this.invalidate(); clearTimeout(this.timer); ++this.pollEpoch; await this.boot() }
  dispose() { this.forgetConfirmation(); this.dismissDelete(); this.cancelBackup(); this.stopImport(); clearTimeout(this.timer); ++this.epoch; ++this.pollEpoch; ++this.workspacesEpoch; this.closed = true; this.listeners.clear() }
}
