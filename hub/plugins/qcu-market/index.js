import { defineTool } from '@deepseek-ai/dsh-tools'
import { MarketOperations, inspectCoach } from './src/host-core.mjs'
export const name = 'qcu-market'
export const inject = ['commands', 'tools', 'pluginManager', 'skills', 'sandboxPolicy']
export function apply(ctx) {
  const operations = new MarketOperations({ authorize: agent => { const mode = ctx.sandboxPolicy.resolve({session: agent.session}).mode; if (!['read-only','workspace-write'].includes(mode)) throw new Error('Use a session permission mode that requires official per-call approval; QCU will not change it') }, inspect: agent => inspectCoach({ manager: ctx.pluginManager, skills: ctx.get('agentPresets')?.serviceFor(agent, 'skills') ?? ctx.skills, agent }) })
  ctx.effect(() => () => operations.dispose())
  ctx.commands.register({ name: 'qcu-market', description: 'QCU市场固定包准备和状态检查；不安装、不调用模型', input: { hint: 'prepare | status | verify | cancel' },
    async handler({ rawInput, agent, signal }) {
      try { return { kind: 'success', text: JSON.stringify(await operations.run(rawInput.trim(), agent, signal)) } }
      catch (error) { return { kind: 'error', text: error.message } }
    },
  })
  ctx.tools.register(defineTool({ name: 'qcu_market', description: 'Prepare, verify, cancel preparation or inspect only the pinned QCU study coach. Never installs, activates or approves. Installation must use the official plugin_manager with per-call approval. Stop after any denied/cancelled approval.',
    parameters: { action: { type: 'string', required: true, enum: ['prepare','status','verify','cancel'] } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) { if (!exec.agent) throw new Error('Session required'); return JSON.stringify(await operations.run(args.action, exec.agent, exec.signal)) },
  }))
}
