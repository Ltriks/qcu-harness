/** Official Cordis Host entry owning QCU local service, strict tools, and packaged skill. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-skill'
import * as skillFilesystem from '@deepseek-ai/dsh-skill-filesystem'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply as applyLegacyTools } from '../plugin/index.js'
import { QcuLocalOwner } from './host/local-owner.ts'
import { QcuDesktopBinding } from './host/desktop-binding.ts'

/** Cordis function plugin name; this module intentionally has no default export. */
export const name = 'qcu-thesis-workbench'
/** Official services required by the tool and filesystem-skill contributions. */
export const inject = ['tools', 'skills']

/** Deployment-selected executable and private local data directory. */
export interface Config {
  readonly localPython: {
    readonly python: string
    readonly home: string
    readonly startupTimeoutMs?: number
    readonly shutdownTimeoutMs?: number
    readonly terminateTimeoutMs?: number
    readonly killTimeoutMs?: number
  }
}

function configured(config: Config): void {
  if (config === null || typeof config !== 'object' || Object.keys(config).some(key => key !== 'localPython')
    || config.localPython === null || typeof config.localPython !== 'object'
    || Object.keys(config.localPython).some(key => !['python', 'home', 'startupTimeoutMs', 'shutdownTimeoutMs', 'terminateTimeoutMs', 'killTimeoutMs'].includes(key))
    || typeof config.localPython.python !== 'string' || !isAbsolute(config.localPython.python)
    || typeof config.localPython.home !== 'string' || !isAbsolute(config.localPython.home)) {
    throw new Error('QCU requires explicit absolute localPython.python and localPython.home paths.')
  }
}

/**
 * Mount fail-closed tools and the packaged skill, then start the effect-owned local Python service.
 * Startup and runtime failures preserve all restrictions until the plugin is explicitly unloaded.
 * @param ctx - Official Cordis context; no publicClient or RPC contribution is registered.
 * @param config - Explicit locally installed Python executable and owner-only data directory.
 */
export function apply(ctx: Context, config: Config): void {
  const packageRoot = fileURLToPath(new URL('../', import.meta.url))
  let owner: QcuLocalOwner | undefined
  let desktopBinding: QcuDesktopBinding | undefined
  const reportUnavailable = (): void => {
    ctx.logger.error('QCU local service unavailable; dedicated-profile restrictions remain active.')
  }
  ctx.effect(() => {
    // The inert path is never read: Host admission remains closed for invalid configuration.
    const home = typeof config?.localPython?.home === 'string' && isAbsolute(config.localPython.home)
      ? config.localPython.home : join(packageRoot, '.inactive')
    ctx.effect(() => applyLegacyTools(ctx, { bridgePath: join(home, 'bridge.json'), strictMode: true }), 'QCU unchanged strict tools')
    ctx.tools.guard(() => owner?.available() ? undefined : 'QCU local service unavailable; local thesis tools are closed.')
    try {
      // Config validation follows policy registration because official Host startup is best-effort.
      configured(config)
      owner = new QcuLocalOwner({
        ...config.localPython,
        server: join(packageRoot, 'runtime/server.py'),
        onFailure: reportUnavailable,
      })
      desktopBinding = new QcuDesktopBinding(owner)
      const skill = ctx.plugin(skillFilesystem, {
        providerName: 'qcu-thesis-workbench', includeDefaultRoots: false,
        bundledSkillDir: join(packageRoot, 'skills'), watch: false,
      })
      const activeOwner = owner
      const activeBinding = desktopBinding
      void Promise.all([activeOwner.start(), skill.await()]).then(() => { activeBinding.serviceReady() }).catch(async () => {
        try { await activeOwner.stop() }
        catch (_error) { /* The effect retains ownership and retries cleanup when unloaded. */ }
        reportUnavailable()
      })
    } catch (_error) {
      reportUnavailable()
    }
    // Synchronous effect setup permits unloading to cancel a pending start immediately.
    return async () => {
      try { await owner?.stop() }
      finally { desktopBinding?.dispose() }
    }
  }, 'QCU owned local Python service')
}
