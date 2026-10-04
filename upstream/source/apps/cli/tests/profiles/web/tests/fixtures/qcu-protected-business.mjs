/** Unloadable synthetic business effects, including deliberately failed cleanup. */
import { appendFileSync } from 'node:fs'

export function apply(ctx, config) {
  appendFileSync(config.entryMarker, 'business\n')
  ctx.effect(() => async () => {
    appendFileSync(config.cleanupMarker, config.fail ? 'failed\n' : 'completed\n')
    if (config.fail) throw new Error('synthetic QCU business cleanup failure')
  }, 'synthetic business cleanup')
}
