/** Fixed QCU Office launch identity and isolated data roots, installed before Desktop imports. */

import { lstatSync, mkdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

/** Electron operations required before its shared Desktop module is evaluated. */
export interface QcuOfficeApplication {
  isReady(): boolean
  getPath(name: 'appData'): string
  setPath(name: 'appData' | 'userData' | 'sessionData', path: string): void
  setName(name: string): void
  readonly commandLine: {
    removeSwitch(name: string): void
    appendSwitch(name: string, value?: string): void
  }
}

/** Fixed directories beneath Electron's platform application-data directory. */
export interface QcuOfficePaths {
  readonly appData: string
  readonly userData: string
  readonly sessionData: string
  readonly home: string
}

const qcuOfficeLaunches = new WeakSet<QcuOfficeApplication>()

/**
 * Read whether the fixed entry finished configuring this Electron application.
 * Command-line switches, environment variables, and business configuration cannot select it.
 * @param application - The Electron application singleton used by the fixed entry.
 * @returns Whether this process completed its isolated QCU launch setup.
 */
export function isQcuOfficeLaunch(application: QcuOfficeApplication): boolean {
  return qcuOfficeLaunches.has(application)
}

/**
 * Refuse an ordinary release-policy feed in the independent QCU candidate.
 * @param dedicated - Whether the fixed QCU entry selected this launch.
 * @param config - Resolved mandatory-release policy, absent when no policy is configured.
 * @throws When QCU would otherwise run under the ordinary application's release policy.
 */
export function assertQcuOfficeReleasePolicy(dedicated: boolean, config: unknown): void {
  if (dedicated && config !== undefined) {
    throw new Error('QCU Office candidate cannot use the ordinary Desktop release policy; a qualified QCU release is required')
  }
}

function ensureQcuDirectory(path: string): void {
  try {
    mkdirSync(path, { mode: 0o700 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const stats = lstatSync(path)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('QCU Office entry requires real directories in its private namespace')
  }
  // Existing directories are checked, never chmodded or adopted from another owner.
  // Windows needs separate native ACL qualification; POSIX mode bits do not establish it.
  if (process.platform !== 'win32' && (stats.uid !== process.getuid?.() || (stats.mode & 0o077) !== 0)) {
    throw new Error('QCU Office entry requires owner-only directories owned by the current user')
  }
}

/**
 * Install the dedicated launch identity independently of plugins and inherited DSH settings.
 * Call once per process. No ordinary-profile fallback is permitted when path setup fails.
 * @param application - Electron application, before ready or importing the shared main module.
 * @param environment - Process environment passed to the Desktop Host.
 * @param ensureDirectory - Directory creation operation; tests inject an isolated substitute.
 * @returns The fixed QCU roots that this process owns.
 */
export function configureQcuOfficeEntry(
  application: QcuOfficeApplication,
  environment: NodeJS.ProcessEnv,
  ensureDirectory: (path: string) => void = ensureQcuDirectory,
): QcuOfficePaths {
  if (application.isReady()) throw new Error('QCU Office entry must configure its profile before Electron is ready')
  const platformAppData = application.getPath('appData')
  if (!isAbsolute(platformAppData) || platformAppData.includes('\0')) {
    throw new Error('QCU Office entry requires an absolute platform appData directory')
  }
  const appData = join(platformAppData, 'qcu-office')
  const paths = {
    appData,
    userData: join(appData, 'electron'),
    sessionData: join(appData, 'session-data'),
    home: join(appData, 'home'),
  }
  for (const path of Object.values(paths)) ensureDirectory(path)
  application.setName('QCU Office')
  application.setPath('appData', paths.appData)
  application.setPath('userData', paths.userData)
  application.setPath('sessionData', paths.sessionData)
  // The development launcher supplies a generic user-data-dir switch. Replace it as
  // well as Electron's path so Chromium never receives the ordinary profile override.
  application.commandLine.removeSwitch('user-data-dir')
  application.commandLine.appendSwitch('user-data-dir', paths.userData)
  environment.DSH_DESKTOP_USER_DATA_DIR = paths.userData
  environment.DSH_HOME = paths.home
  // Diagnostic only; the process-local record below is the Host launch authority.
  application.commandLine.removeSwitch('qcu-dedicated')
  application.commandLine.appendSwitch('qcu-dedicated')
  qcuOfficeLaunches.add(application)
  return paths
}
