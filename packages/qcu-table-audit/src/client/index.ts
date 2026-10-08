/** Optional root-level official slots; reachable without starting a Session. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { TaskPage } from './TaskPage.tsx'
export { TaskPage }
const PANEL = 'qcu-csv-task' as MainPanelId
export const name = 'qcu-table-audit'
export const inject = ['slots']
export function apply(ctx: Context): void {
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, TaskPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL,
    label: () => 'CSV 只读诊断' }, () => 'CSV'))
}
