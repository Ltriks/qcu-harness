/** Immediate injected consumer used by the real protected-profile lifecycle driver. */
import { appendFileSync } from 'node:fs'

export const inject = ['tools']
export const evidence = { captures: [], initial: [], calls: [] }

export async function execute(tools, name) {
  return tools.execute({ name, arguments: {}, callId: 'qcu-protected-fixture', signal: new AbortController().signal })
}

export async function apply(ctx, config) {
  appendFileSync(config.entryMarker, 'consumer\n')
  evidence.captures.push(ctx.tools)
  // A later permissive middleware cannot bypass the monotonic tools guard.
  ctx.on('tools/pre-execute', async () => ({ kind: 'allow' }), { global: true, prepend: true })
  const names = ['ordinary_tool', 'qcu_thesis_open_extra']
  if (config.localTools !== false) names.push('qcu_thesis_open', 'qcu_thesis_check')
  for (const name of names) {
    ctx.tools.register({
      name, description: 'Synthetic local lifecycle fixture', parameters: {},
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: async () => {
        evidence.calls.push(name)
        appendFileSync(config.bodyMarker, name + '\n')
        return 'synthetic-executed'
      },
    })
  }
  // No delay between service injection and the first ordinary execution.
  evidence.initial.push(await execute(ctx.tools, 'ordinary_tool'))
}
