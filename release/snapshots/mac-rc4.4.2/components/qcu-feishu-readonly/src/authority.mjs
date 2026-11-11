import { ReadonlyRunner, ReadError, validateConfig } from './core.mjs'

/** Per-mount authority. Factory injection is only a trusted core test seam, never plugin config. */
export class ReadAuthority {
  #closed = false; #generation = 0; #config = null; #runner = null; #draining = Promise.resolve()
  #factory
  constructor(config, factory = value => new ReadonlyRunner(value)) {
    this.#factory = factory; this.update(config)
  }
  // Revocation happens synchronously before any await, even for invalid/incomplete replacement values.
  update(config) {
    if (this.#closed) return
    this.#generation++; this.#config = null
    const old = this.#runner; this.#runner = null
    const stopped = old ? old.dispose() : Promise.resolve()
    this.#draining = Promise.all([this.#draining, stopped]).then(() => undefined)
    // Observe failure; callers still fail closed when awaiting the original draining promise.
    this.#draining.catch(() => {})
    try { const next = validateConfig(config); if (next.enabled) this.#config = Object.freeze({ enabled: next.enabled, cliPath: next.cliPath, documentUrl: next.documentUrl }) }
    catch { /* An invalid new setup never keeps the old binding active. */ }
  }
  async read(method, args, scope, signal) {
    if (!['outline', 'section'].includes(method)) throw new ReadError('arguments')
    const generation = this.#generation
    const check = () => { if (this.#closed || generation !== this.#generation || signal.aborted) throw new ReadError('cancelled') }
    check()
    if (!this.#config) throw new ReadError('setup')
    try { await this.#draining } catch { throw new ReadError('cancelled') }
    check()
    if (!this.#runner) this.#runner = this.#factory(this.#config)
    const runner = this.#runner
    const result = method === 'outline' ? await runner.outline(scope, signal) : await runner.section(args, scope, signal)
    check(); return result
  }
  async dispose() {
    if (!this.#closed) {
      this.#closed = true; this.#generation++; this.#config = null
      const old = this.#runner; this.#runner = null
      const stopped = old ? old.dispose() : Promise.resolve()
      this.#draining = Promise.all([this.#draining, stopped]).then(() => undefined)
    }
    await this.#draining
  }
}
