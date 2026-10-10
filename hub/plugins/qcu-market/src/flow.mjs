export class MarketFlow {
  constructor(ctx) { this.ctx = ctx; this.session = null; this.opening = null; this.busy = false; this.disposed = false; this.operation = 0 }
  async scope() {
    if (this.disposed) throw new Error('Market closed')
    if (!this.opening) this.opening = (async () => {
      const id = await this.ctx.sessions.create()
      if (this.disposed) throw new Error('Market closed')
      this.session = this.ctx.sessions.retain(id, { source: 'qcu-market' })
      return this.session.ready
    })().catch(e => { this.session?.release(); this.session = null; this.opening = null; throw e })
    return this.opening
  }
  async command(action, operation) {
    const binding = await this.scope()
    if (this.disposed || (operation !== undefined && operation !== this.operation)) throw new Error('Operation cancelled')
    const answer = await this.ctx.remote.commands.execute(binding.sessionId, `/qcu-market ${action}`, [])
    if (!answer.ok) throw new Error(answer.error?.message || 'Host unavailable')
    const result = answer.value?.result
    if (!result || result.kind !== 'success') throw new Error(result?.text || 'QCU Host command unavailable')
    return JSON.parse(result.text)
  }
  async run(action) {
    if (this.busy) throw new Error('Operation already in progress')
    this.busy = true; const operation = ++this.operation
    try {
      const result = await this.command(action, operation)
      if (this.disposed || operation !== this.operation) throw new Error('Operation cancelled')
      return result
    } finally { this.busy = false }
  }
  async draft(text) {
    const binding = await this.scope()
    if (this.disposed) throw new Error('Market closed')
    const input = this.ctx.conversation.input.for(binding.ctx)
    // This is a dedicated user-created market session; never overwrite an existing draft.
    const state = input.state.getSnapshot()
    if (state.draft || state.attachmentIds?.length || state.queue?.length || state.phase !== 'plain') throw new Error('Finish or clear the market session draft before continuing')
    input.setDraft(text)
    this.ctx.uiWorkspace.openSession(binding.sessionId)
    this.ctx.layout.selectPanel(null)
    // Deliberately no submit(): only the person can send the draft and start model work.
  }
  async cancel() {
    ++this.operation
    if (this.session) return this.command('cancel')
    return { state: 'cancelled' }
  }
  dispose() { this.disposed = true; ++this.operation; if (this.session) { if (this.busy) void this.ctx.remote.commands.execute(this.session.sessionId, '/qcu-market cancel', []).catch(() => {}); this.session.release() }; this.session = null }
}
