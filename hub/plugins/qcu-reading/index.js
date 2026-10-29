import {TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import {lstat, realpath} from 'node:fs/promises'
import {ReadingStore} from './src/store.mjs'
import {createGenerator, resolveRoute} from './src/model.mjs'
import {dispatchStore} from './src/dispatch.mjs'
import {exact, text, check, remoteContribution, VERSION, PROTOCOL, safeCode} from './src/protocol.mjs'

export const name = 'qcu-reading', inject = ['typert', 'workspaceRegistry']
export const Config = z.object({enabled:z.boolean().default(true)})
export class ReadingService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'qcuReading'); this.owner = ctx; this.stores = new Map(); this.lookups = new Set(); this.closed = false
    ctx.effect(() => () => this.dispose())
  }
  async store(workspaceId) {
    check(!this.closed, 'plugin-stopped'); text(workspaceId, 200)
    const workspace = this.owner.workspaceRegistry.get(workspaceId)
    check(workspace && typeof workspace.path === 'string', 'workspace-not-found')
    const stat = await lstat(workspace.path)
    check(stat.isDirectory() && !stat.isSymbolicLink(), 'unsafe-store')
    const canonical = await realpath(workspace.path)
    let slot = this.stores.get(workspaceId)
    if (slot) { check(slot.path === workspace.path && slot.canonical === canonical, 'workspace-changed'); return slot.promise }
    // Canonical registry aliases share the same store and active-call limit.
    const shared = [...this.stores.values()].find(s => s.canonical === canonical)
    check(this.stores.size < 8, 'workspace-limit')
    slot = {path:workspace.path, canonical, promise:shared?.promise ?? new ReadingStore(workspace.path, {model:signal => resolveRoute(this.owner, signal), generate:createGenerator(this.owner)}).init()}
    this.stores.set(workspaceId, slot)
    try { return await slot.promise } catch (e) { this.stores.delete(workspaceId); throw e }
  }
  async dispatch(payload, signal) {
    const controller = new AbortController(), cancel = () => controller.abort(signal?.reason)
    this.lookups.add(controller); signal?.addEventListener('abort', cancel, {once:true}); if (signal?.aborted) cancel()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      check(!this.closed, 'plugin-stopped'); check(typeof payload === 'string' && payload.length <= 600000, 'invalid-input')
      const request = JSON.parse(payload)
      check(request && typeof request === 'object', 'invalid-fields')
      let value
      if (request.action === 'workspaces') {
        exact(request, ['action']); value = this.owner.workspaceRegistry.list().slice(0, 100).map(w => ({id:w.id, title:w.title}))
      } else {
        text(request.workspaceId, 200)
        value = await dispatchStore(await this.store(request.workspaceId), request, controller.signal)
      }
      check(!this.closed, 'plugin-stopped')
      return JSON.stringify({ok:true, version:VERSION, protocol:PROTOCOL, value})
    } catch (e) { return JSON.stringify({ok:false, error:safeCode(e)}) }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); this.lookups.delete(controller) }
  }
  async dispose() {
    this.closed = true
    for (const controller of this.lookups) controller.abort()
    await Promise.allSettled([...new Set([...this.stores.values()].map(s => s.promise))].map(async promise => (await promise).dispose()))
    this.stores.clear()
  }
}
export function apply(ctx, config = {enabled:true}) {
  exact(config, ['enabled']); check(typeof config.enabled === 'boolean', 'invalid-fields')
  if (!config.enabled) return
  new ReadingService(ctx)
  ctx.typert.register({package:name, face:'host', schemas:[], invocations:remoteContribution.descriptors, model:{services:[], events:[], objects:[]}})
}
