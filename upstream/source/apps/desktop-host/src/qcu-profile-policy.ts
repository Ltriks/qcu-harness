/** Fixed entry restrictions for the QCU launch, independent of its business bundle. */
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'

const RESTRICTED_ENTRY_IDS = [
  'ui-deliverables',
  'preset-standard',
  'preset-ptc',
  'preset-minimal',
  'preset-cordis',
  'hmr',
  'session-title-llm',
  'session-telemetry-otel',
  'desktop-product-telemetry',
  'product-analytics',
  'command-feedback',
  'message-feedback',
  'ui-message-feedback',
  'file-reference-local',
  'ui-reference',
  'ui-attachment',
  'ui-sidebar-files',
  'ui-sidebar-terminal',
  'ui-sidebar-documentpreview',
  'workspace-files',
  'terminal-controller',
  'ui-plugin-manager',
  'ui-settings-plugins',
  'ui-settings-plugin-inventory',
  'ui-cordis',
  'cordis-host-runner',
  'cordis-client-runner',
  'cordis-inspect-providers',
] as const

/**
 * Return the fixed disable rows applied after mutable profile and user patches.
 * These IDs target the supported standard Web/Desktop profile.
 * @returns Fresh patches that retain the original 28 QCU entry restrictions.
 */
export function qcuProfileRestrictions(): PatchOptions[] {
  return RESTRICTED_ENTRY_IDS.map(id => ({ id, disabled: true }))
}
