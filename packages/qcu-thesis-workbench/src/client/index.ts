/** Official external Client plugin: localized existing-slot entry only. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { QcuEntry } from './QcuEntry.tsx'
import { en, zh, NS } from './locales.ts'
import type { QcuKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** QCU launcher and native-panel frame copy. */
    'qcu-thesis-workbench': QcuKey
  }
}

/** Client plugin identity matches the package and lazy factory identifier. */
export const name = 'qcu-thesis-workbench'
/** Official services only; native availability is checked by the mounted entry. */
export const inject = ['slots', 'locale']

/**
 * Register removable dictionaries and one entry in the existing Session header list.
 * @param ctx - Official Client Context; no remote namespace or tool is registered here.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'qcu: client locales')
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: name,
    locale: NS,
  }, QcuEntry))
}
