import {createHash, randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {mkdir, lstat, open, rename, realpath, unlink} from 'node:fs/promises'
import {isAbsolute, join} from 'node:path'
import {check, text, exact, parseImport, paragraphsFor, evidenceFor, searchDocument, parseRoute, sameRoute, LIMITS, safeCode, errors} from './protocol.mjs'
import {exportRun} from './reports.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const hash = value => createHash('sha256').update(value).digest('hex')
const digest = value => hash(JSON.stringify(value))
const statuses = ['running', 'completed', 'failed', 'cancelled', 'interrupted']
export async function bounded(job, controller, milliseconds) {
  const signal = controller.signal
  signal.throwIfAborted()
  let timer, listener
  try {
    return await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return job(signal) }),
      new Promise((_, reject) => {
        listener = () => reject(signal.reason ?? Object.assign(Error('cancelled'), {code:'cancelled'}))
        signal.addEventListener('abort', listener, {once:true})
        timer = setTimeout(() => controller.abort(Object.assign(Error('call-timeout'), {code:'call-timeout'})), milliseconds)
      })
    ])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', listener) }
}

export class ReadingStore {
  constructor(root, {model, generate, now = () => Date.now(), callTimeout = 60000}) {
    Object.assign(this, {root, model, generate, now, callTimeout})
    this.state = {schemaVersion:1, documents:[], notes:[], runs:[]}
    this.prepared = new Map(); this.jobs = new Map(); this.mutations = Promise.resolve()
    this.closed = false; this.writeFault = false
  }
  ready() { check(!this.closed && !this.stopping, 'plugin-stopped'); check(!this.writeFault, 'state-write-failed') }
  async location() {
    check(typeof this.root === 'string' && isAbsolute(this.root), 'workspace-not-found')
    const rootStat = await lstat(this.root)
    check(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'unsafe-store')
    const base = await realpath(this.root)
    if (this.base) check(this.base === base && this.rootInode === rootStat.ino && this.rootDevice === rootStat.dev, 'workspace-changed')
    else { this.base = base; this.rootInode = rootStat.ino; this.rootDevice = rootStat.dev }
    const dir = join(base, '.qcu-reading')
    try { await mkdir(dir, {mode:0o700}) } catch (e) { if (e.code !== 'EEXIST') throw e }
    const stat = await lstat(dir)
    check(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(dir) === dir, 'unsafe-store')
    if (this.dirInode !== undefined) check(stat.ino === this.dirInode && stat.dev === this.dirDevice, 'unsafe-store')
    else { this.dirInode = stat.ino; this.dirDevice = stat.dev }
    const file = join(dir, 'state.json')
    try {
      const s = await lstat(file)
      check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= LIMITS.storeBytes, 'unsafe-store')
    } catch (e) { if (e.code !== 'ENOENT') throw e }
    return {dir, file}
  }
  async init() {
    const {file} = await this.location()
    let handle
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
      const stat = await handle.stat()
      check(stat.isFile() && stat.nlink === 1 && stat.size <= LIMITS.storeBytes, 'invalid-store')
      const buffer = Buffer.alloc(LIMITS.storeBytes + 1)
      let size = 0
      while (size < buffer.length) {
        const {bytesRead} = await handle.read(buffer, size, buffer.length - size, size)
        if (!bytesRead) break
        size += bytesRead
      }
      check(size <= LIMITS.storeBytes, 'invalid-store')
      this.state = this.validateState(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(buffer.subarray(0, size))))
      await this.location()
    } catch (e) {
      if (e.code !== 'ENOENT' || handle) check(false, e.code === 'unsafe-store' ? e.code : 'invalid-store')
    } finally { await handle?.close() }
    let changed = false
    for (const run of this.state.runs) if (run.status === 'running') {
      run.status = 'interrupted'; run.error = 'interrupted'; run.finishedAt = this.now(); changed = true
    }
    if (changed) await this.persist(this.state)
    return this
  }
  validateState(s) {
    exact(s, ['schemaVersion', 'documents', 'notes', 'runs'])
    check(s.schemaVersion === 1 && Array.isArray(s.documents) && s.documents.length <= LIMITS.documents && Array.isArray(s.notes) && s.notes.length <= LIMITS.notes && Array.isArray(s.runs) && s.runs.length <= LIMITS.runs, 'invalid-store')
    const documents = new Map(), ids = new Set(), requests = new Set()
    for (const d of s.documents) {
      exact(d, ['id', 'name', 'content', 'paragraphs', 'createdAt'])
      const parsed = parseImport({name:d.name, content:d.content})
      check(parsed.content === d.content && d.id === hash(d.content) && !documents.has(d.id) && Number.isFinite(d.createdAt) && JSON.stringify(d.paragraphs) === JSON.stringify(paragraphsFor(d.content)), 'invalid-store')
      documents.set(d.id, d)
    }
    for (const n of s.notes) {
      exact(n, ['id', 'documentId', 'locator', 'text', 'comment', 'createdAt'])
      text(n.id, 100); text(n.text, 4000); text(n.comment, 2000, false)
      check(!ids.has(n.id) && Number.isFinite(n.createdAt) && documents.get(n.documentId)?.paragraphs.some(p => p.locator === n.locator && p.text.includes(n.text)), 'invalid-store'); ids.add(n.id)
    }
    for (const r of s.runs) {
      exact(r, ['id', 'requestId', 'intentId', 'binding', 'document', 'question', 'sources', 'route', 'status', 'answer', 'createdAt', 'finishedAt', 'error'])
      text(r.id, 100); text(r.requestId, 100); text(r.intentId, 100); text(r.binding, 64); text(r.question, LIMITS.questionChars); text(r.answer, LIMITS.answerChars, false); parseRoute(r.route)
      const d = documents.get(r.document?.id)
      check(d && d.name === r.document.name && d.createdAt === r.document.createdAt && statuses.includes(r.status) && Number.isFinite(r.createdAt) && !ids.has(r.id) && !requests.has(r.requestId), 'invalid-store')
      check((r.status !== 'completed' || r.answer.trim()) && (r.status === 'running' || Number.isFinite(r.finishedAt)) && (r.error === undefined || Object.hasOwn(errors, r.error)), 'invalid-store')
      check(Array.isArray(r.sources) && r.sources.length > 0 && r.sources.length <= LIMITS.sources, 'invalid-store')
      r.sources.forEach((source, i) => {
        exact(source, ['id', 'locator', 'start', 'end', 'text', 'clipped'])
        const p = d.paragraphs.find(p => p.locator === source.locator)
        check(source.id === 'S' + (i + 1) && p && Number.isInteger(source.start) && Number.isInteger(source.end) && source.start >= p.start && source.end <= p.end && source.end > source.start && source.text.length <= LIMITS.snippetChars && source.text === d.content.slice(source.start, source.end) && typeof source.clipped === 'boolean', 'invalid-store')
      })
      ids.add(r.id); requests.add(r.requestId)
    }
    return s
  }
  async persist(state) {
    const bytes = JSON.stringify(state)
    check(Buffer.byteLength(bytes) <= LIMITS.storeBytes, 'store-limit')
    const {dir, file} = await this.location(), temp = join(dir, 'write-' + randomUUID() + '.tmp')
    let handle
    try {
      handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
      await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null
      await this.location(); await rename(temp, file)
    } catch (e) { check(false, e.code === 'unsafe-store' || e.code === 'workspace-changed' ? e.code : 'state-write-failed') }
    finally { await handle?.close(); await unlink(temp).catch(() => {}) }
  }
  mutate(fn, terminal = false) {
    const result = this.mutations.then(() => { if (!terminal) this.ready(); return fn() })
    this.mutations = result.catch(() => {})
    return result
  }
  capacity() {
    return {documents:this.state.documents.length, notes:this.state.notes.length, runs:this.state.runs.length, bytes:Buffer.byteLength(JSON.stringify(this.state)), limits:LIMITS}
  }
  snapshot() {
    this.ready()
    return clone({documents:this.state.documents.map(({content, paragraphs, ...d}) => ({...d, paragraphs:paragraphs.length})), notes:this.state.notes, runs:this.state.runs, capacity:this.capacity()})
  }
  document(id) {
    this.ready(); text(id, 64)
    const document = this.state.documents.find(d => d.id === id)
    check(document, 'document-not-found'); return clone(document)
  }
  importDocument(raw) {
    return this.mutate(async () => {
      const parsed = parseImport(raw), id = hash(parsed.content), existing = this.state.documents.find(d => d.id === id)
      if (existing) return {document:clone(existing), duplicate:true}
      check(this.state.documents.length < LIMITS.documents, 'store-limit')
      const document = {id, ...parsed, paragraphs:paragraphsFor(parsed.content), createdAt:this.now()}
      const next = {...this.state, documents:[...this.state.documents, document]}
      await this.persist(next); this.state = next
      return {document:clone(document), duplicate:false}
    })
  }
  search(id, query) { return searchDocument(this.document(id), query) }
  saveNote(raw) {
    return this.mutate(async () => {
      exact(raw, ['documentId', 'locator', 'text', 'comment'])
      const d = this.document(raw.documentId), excerpt = text(raw.text, 4000), comment = text(raw.comment, 2000, false)
      check(d.paragraphs.some(p => p.locator === raw.locator && p.text.includes(excerpt)), 'note-invalid')
      check(this.state.notes.length < LIMITS.notes, 'store-limit')
      const note = {id:randomUUID(), documentId:d.id, locator:raw.locator, text:excerpt, comment, createdAt:this.now()}
      const next = {...this.state, notes:[note, ...this.state.notes]}
      await this.persist(next); this.state = next; return clone(note)
    })
  }
  async prepare({documentId, question}, signal) {
    this.ready()
    const document = this.document(documentId)
    text(question, LIMITS.questionChars)
    const sources = evidenceFor(document, question)
    if (!sources.length) return {status:'no-evidence', sources:[]}
    const controller = new AbortController(), cancel = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', cancel, {once:true}); if (signal?.aborted) cancel()
    let route
    try { route = parseRoute(await bounded(s => this.model(s), controller, 6000)) }
    finally { signal?.removeEventListener('abort', cancel) }
    this.ready(); signal?.throwIfAborted()
    for (const [id, p] of this.prepared) if (this.now() - p.createdAt > 600000) this.prepared.delete(id)
    check(this.prepared.size < 10, 'store-limit')
    const prepared = {id:randomUUID(), status:'prepared', document:{id:document.id, name:document.name, createdAt:document.createdAt}, question, sources, route, createdAt:this.now()}
    prepared.digest = digest(prepared)
    this.prepared.set(prepared.id, clone(prepared))
    return prepared
  }
  dismiss(intentId) { this.prepared.delete(text(intentId, 100)); return null }
  start(raw, signal) {
    return this.mutate(async () => {
      exact(raw, ['intentId', 'requestId', 'consent', 'documentId', 'question', 'digest'])
      text(raw.intentId, 100); text(raw.requestId, 100); text(raw.documentId, 64); text(raw.question, LIMITS.questionChars); text(raw.digest, 64)
      check(raw.consent === true, 'consent-required')
      const binding = digest([raw.intentId, raw.requestId, raw.consent, raw.documentId, raw.question, raw.digest]), existing = this.state.runs.find(r => r.requestId === raw.requestId)
      if (existing) { check(existing.binding === binding, 'idempotency-conflict'); return clone(existing) }
      const p = this.prepared.get(raw.intentId)
      check(p && this.now() - p.createdAt <= 600000 && raw.digest === p.digest && raw.documentId === p.document.id && raw.question === p.question, 'prepare-expired')
      check(!this.jobs.size && !this.state.runs.some(r => r.status === 'running'), 'run-busy')
      check(this.state.runs.length < LIMITS.runs && this.capacity().bytes < LIMITS.storeBytes - 300000, 'store-limit')
      const controller = new AbortController(), cancel = () => controller.abort(signal?.reason)
      signal?.addEventListener('abort', cancel, {once:true}); if (signal?.aborted) cancel()
      try { check(sameRoute(p.route, await bounded(s => this.model(s), controller, 6000)), 'model-policy-changed') }
      finally { signal?.removeEventListener('abort', cancel) }
      this.ready(); signal?.throwIfAborted()
      const run = {id:randomUUID(), requestId:raw.requestId, intentId:p.id, binding, document:clone(p.document), question:p.question, sources:clone(p.sources), route:clone(p.route), status:'running', answer:'', createdAt:this.now()}
      const next = {...this.state, runs:[run, ...this.state.runs]}
      await this.persist(next); this.state = next; this.prepared.delete(p.id)
      if (signal?.aborted || this.stopping) {
        run.status = this.stopping ? 'interrupted' : 'cancelled'; run.error = run.status; run.finishedAt = this.now()
        try { await this.persist(this.state) } catch (e) { this.writeFault = true; throw e }
        return clone(run)
      }
      const job = {controller:new AbortController()}
      this.jobs.set(run.id, job)
      job.promise = this.execute(run.id, job.controller).finally(() => this.jobs.delete(run.id))
      job.promise.catch(() => {})
      return clone(run)
    })
  }
  async execute(id, controller) {
    const run = clone(this.state.runs.find(r => r.id === id))
    try {
      const output = await bounded(async signal => {
        this.ready(); check(sameRoute(run.route, await this.model(signal)), 'model-policy-changed')
        signal.throwIfAborted()
        return this.generate({question:run.question, sources:clone(run.sources), model:clone(run.route)}, signal)
      }, controller, this.callTimeout)
      controller.signal.throwIfAborted(); text(output, LIMITS.answerChars)
      run.answer = output; run.status = 'completed'
    } catch (e) {
      run.status = this.stopping || this.closed ? 'interrupted' : e?.code === 'cancelled' || controller.signal.reason?.code === 'cancelled' ? 'cancelled' : 'failed'
      run.error = this.stopping || this.closed ? 'interrupted' : safeCode(e)
      if (typeof e?.partial === 'string') run.answer = e.partial.slice(0, LIMITS.answerChars).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/gu, '')
      controller.abort(e)
    }
    run.finishedAt = this.now()
    // Serialize terminal writes with imports/notes; failed persistence blocks later paid calls.
    await this.mutate(async () => {
      const next = {...this.state, runs:this.state.runs.map(r => r.id === id ? run : r)}
      try { await this.persist(next); this.state = next }
      catch (e) { this.writeFault = true; const current = this.state.runs.find(r => r.id === id); current.status = 'failed'; current.error = 'state-write-failed'; throw e }
    }, true)
  }
  run(id) {
    text(id, 100); const run = this.state.runs.find(r => r.id === id)
    check(run, 'run-not-found'); return clone(run)
  }
  async cancel(id) {
    this.run(id); const job = this.jobs.get(id)
    job?.controller.abort(Object.assign(Error('cancelled'), {code:'cancelled'}))
    await job?.promise; return this.run(id)
  }
  export(id) { return exportRun(this.run(id)) }
  async dispose() {
    this.prepared.clear()
    // Cancel before closing so terminal states can still be written through the mutation queue.
    this.stopping = true
    for (const job of this.jobs.values()) job.controller.abort(Object.assign(Error('interrupted'), {code:'interrupted'}))
    await Promise.allSettled([...this.jobs.values()].map(j => j.promise))
    await this.mutations; this.closed = true
  }
}
