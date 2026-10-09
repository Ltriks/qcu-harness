/** Official rc.2 tool with explicit approval/manager stubs. Not model, App or native UI. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import ApprovalService from '@deepseek-ai/dsh-user-approval'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import * as ManagementTool from '@deepseek-ai/dsh-plugin-manager/tools'

test('official management approval rejects before manager mutation and allows only one call without changing mode', async () => {
  const ctx = new Context()
  let installations = 0
  let answer = 'rejected'
  const requests = []
  const manager = {
    installBundle: async (target, options) => {
      installations++
      assert.equal(target, '/synthetic/qcu-dialogue-install-probe-0.0.1-test.1.tgz')
      assert.equal(options.enabled, true)
      return { changed: true, application: 'restart-required' }
    },
    listBundles: async () => [],
  }
  try {
    ctx.provide('pluginManager', manager)
    await ctx.plugin(SystemPrompt).await()
    await ctx.plugin(ToolRuntime).await()
    await ctx.plugin(SessionProjections).await()
    await ctx.plugin(SandboxPolicy, { mode: 'workspace-write' }).await()
    await ctx.plugin(ApprovalService, { policy: 'ask' }).await()
    await ctx.plugin(ManagementTool).await()
    ctx.on('approval/request', request => {
      requests.push(request.reason)
      return Promise.resolve(answer)
    })
    const id = SessionId('synthetic-dialogue-install-probe')
    const session = Session.create(id, undefined, { version: SESSION_FORMAT_VERSION, id, createdAt: 0, isSeeded: false })
    session.append('turn/start', { turn: 1 })
    const agent = { session }
    let sequence = 0
    const execute = arguments_ => ctx.tools.execute({ name: 'plugin_manager', arguments: arguments_, agent,
      callId: 'probe-' + (++sequence), signal: new AbortController().signal })
    const arguments_ = { action: 'install_bundle', target: '/synthetic/qcu-dialogue-install-probe-0.0.1-test.1.tgz', enabled: true }
    const rejected = await execute(arguments_)
    assert.equal(rejected.isError, true)
    assert.equal(installations, 0)
    answer = 'allowed-once'
    const allowed = await execute(arguments_)
    assert.equal(allowed.isError, false)
    assert.equal(installations, 1)
    assert.equal(ctx.sandboxPolicy.resolve({ session }).mode, 'workspace-write')
    answer = 'rejected'
    const listed = await execute({ action: 'list_bundles' })
    assert.equal(listed.isError, true)
    assert.equal(installations, 1)
    assert.equal(requests.length, 3)
    assert.ok(requests.every(reason => reason.includes('danger-full-access')))
    assert.equal(ctx.sandboxPolicy.resolve({ session }).mode, 'workspace-write')
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  } finally { await ctx.fiber.dispose() }
})

