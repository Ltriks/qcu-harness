/** Fixed dedicated launch selection is a launcher fact, never an unloadable plugin setting. */
import type { Profile } from '@deepseek-ai/dsh-app-boot'

/**
 * Reject ambiguous QCU deployment before any profile entry mounts.
 * @param selection - Private child environment set only after the fixed QCU entry configures Electron.
 * @param profile - Official resolved profile including missing selected bundles.
 * @returns The immutable dedicated choice; removing the business bundle does not clear a true choice.
 */
export function qcuDedicatedLaunch(selection: string | undefined, profile: Pick<Profile, 'layers' | 'skippedBundles'>): boolean {
  if (selection !== undefined && selection !== '1') throw new Error('Invalid QCU dedicated launch selection')
  const dedicated = selection === '1'
  const selected = [...profile.layers, ...profile.skippedBundles].some(layer => layer.packageName === 'qcu-thesis-workbench')
  if (selected && !dedicated) throw new Error('QCU bundle requires the protected QCU Office entry')
  return dedicated
}
