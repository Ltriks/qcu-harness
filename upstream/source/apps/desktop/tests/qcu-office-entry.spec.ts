import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertQcuOfficeReleasePolicy, configureQcuOfficeEntry, isQcuOfficeLaunch, type QcuOfficeApplication } from '../src/qcu-office-entry.ts'

const roots: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('electron')
  vi.doUnmock('../src/main.ts')
  vi.resetModules()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(platformAppData = join(tmpdir(), 'qcu-entry-mocked-app-data')) {
  const order: string[] = []
  const switches = new Map<string, string | undefined>([['user-data-dir', '/ordinary/electron']])
  const paths = new Map<string, string>()
  const app = {
    isReady: vi.fn(() => false),
    getPath: vi.fn((_name: 'appData') => platformAppData),
    setPath: vi.fn((name: 'appData' | 'userData' | 'sessionData', path: string) => {
      order.push(`path:${name}`)
      paths.set(name, path)
    }),
    setName: vi.fn((_name: string) => { order.push('name') }),
    commandLine: {
      removeSwitch: vi.fn((name: string) => { switches.delete(name) }),
      appendSwitch: vi.fn((name: string, value?: string) => { order.push(`switch:${name}`); switches.set(name, value) }),
    },
  } satisfies QcuOfficeApplication
  const env: NodeJS.ProcessEnv = { DSH_HOME: '/ordinary/home', DSH_DESKTOP_USER_DATA_DIR: '/ordinary/electron' }
  const ensureDirectory = vi.fn((path: string) => { order.push(`directory:${path}`) })
  return { app, env, ensureDirectory, order, paths, switches }
}

describe('fixed QCU Office entry', () => {
  it('ignores a bare dedicated switch until the fixed entry finishes configuration', () => {
    const context = fixture()
    context.switches.set('qcu-dedicated', undefined)
    context.env.DSH_QCU_DEDICATED = '1'
    expect(isQcuOfficeLaunch(context.app)).toBe(false)
    configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)
    expect(isQcuOfficeLaunch(context.app)).toBe(true)
    context.switches.delete('qcu-dedicated')
    delete context.env.DSH_QCU_DEDICATED
    expect(isQcuOfficeLaunch(context.app)).toBe(true)
    expect(isQcuOfficeLaunch(fixture().app)).toBe(false)
  })

  it('does not mark an application whose final setup operation failed', () => {
    const context = fixture()
    context.app.commandLine.appendSwitch.mockImplementation((name) => {
      if (name === 'qcu-dedicated') throw new Error('synthetic switch failure')
    })
    expect(() => configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)).toThrow('synthetic switch failure')
    expect(isQcuOfficeLaunch(context.app)).toBe(false)
  })

  it('replaces inherited ordinary roots before dedicated mode is selected', () => {
    const context = fixture()
    const paths = configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)
    const root = join(context.app.getPath('appData'), 'qcu-office')
    expect(paths).toEqual({ appData: root, userData: join(root, 'electron'), sessionData: join(root, 'session-data'), home: join(root, 'home') })
    expect(context.ensureDirectory.mock.calls.map(([path]) => path)).toEqual(Object.values(paths))
    expect(context.app.setName).toHaveBeenCalledExactlyOnceWith('QCU Office')
    expect(Object.fromEntries(context.paths)).toEqual({ appData: paths.appData, userData: paths.userData, sessionData: paths.sessionData })
    expect(context.env.DSH_HOME).toBe(paths.home)
    expect(context.env.DSH_DESKTOP_USER_DATA_DIR).toBe(paths.userData)
    expect(context.switches.get('user-data-dir')).toBe(paths.userData)
    expect(context.switches.has('qcu-dedicated')).toBe(true)
    expect(context.order.at(-1)).toBe('switch:qcu-dedicated')
  })

  it('reasserts dedicated mode for a cold restart without inherited flags or business configuration', () => {
    for (const env of [{}, { DSH_QCU_DEDICATED: '0', DSH_HOME: '/ordinary/home' }]) {
      const context = fixture()
      context.switches.clear()
      const paths = configureQcuOfficeEntry(context.app, env, context.ensureDirectory)
      expect(context.switches.has('qcu-dedicated')).toBe(true)
      expect(env.DSH_HOME).toBe(paths.home)
    }
  })

  it.each(['', 'relative/profile', '/tmp/invalid\0profile'])('refuses invalid appData %j before profile or mode changes', (path) => {
    const context = fixture(path)
    expect(() => configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)).toThrow('absolute platform appData')
    expect(context.ensureDirectory).not.toHaveBeenCalled()
    expect(context.order).toEqual([])
    expect(context.env.DSH_HOME).toBe('/ordinary/home')
  })

  it('refuses a late bootstrap before using any profile paths', () => {
    const context = fixture()
    context.app.isReady.mockReturnValue(true)
    expect(() => configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)).toThrow('before Electron is ready')
    expect(context.app.getPath).not.toHaveBeenCalled()
  })

  it('propagates a directory failure without falling back to ordinary roots', () => {
    const context = fixture()
    context.ensureDirectory.mockImplementation(() => { throw new Error('profile is read-only') })
    expect(() => configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)).toThrow('profile is read-only')
    expect(context.app.setPath).not.toHaveBeenCalled()
    expect(context.switches.has('qcu-dedicated')).toBe(false)
  })

  it('propagates Electron path rejection before enabling mode', () => {
    const context = fixture()
    context.app.setPath.mockImplementation(() => { throw new Error('Electron refused appData') })
    expect(() => configureQcuOfficeEntry(context.app, context.env, context.ensureDirectory)).toThrow('Electron refused appData')
    expect(context.switches.has('qcu-dedicated')).toBe(false)
  })

  it('accepts an existing private namespace without changing its permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-private-entry-'))
    roots.push(root)
    const appData = join(root, 'qcu-office')
    mkdirSync(appData, { mode: 0o700 })
    const mode = statSync(appData).mode
    const context = fixture(root)
    expect(configureQcuOfficeEntry(context.app, context.env).appData).toBe(appData)
    expect(statSync(appData).mode).toBe(mode)
  })

  it.skipIf(process.platform === 'win32')('rejects an existing public namespace without changing it', () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-public-entry-'))
    roots.push(root)
    const appData = join(root, 'qcu-office')
    mkdirSync(appData, { mode: 0o755 })
    chmodSync(appData, 0o755)
    const context = fixture(root)
    expect(() => configureQcuOfficeEntry(context.app, context.env)).toThrow('owner-only directories')
    expect(statSync(appData).mode & 0o777).toBe(0o755)
    expect(existsSync(join(appData, 'home'))).toBe(false)
    expect(context.app.setPath).not.toHaveBeenCalled()
  })

  it.each(['root', 'userData'])('rejects a symlink at the QCU %s without writing into its target', (position) => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-symlink-entry-'))
    roots.push(root)
    const target = join(root, 'ordinary-profile')
    const appData = join(root, 'qcu-office')
    mkdirSync(target, { mode: 0o700 })
    if (position === 'userData') mkdirSync(appData, { mode: 0o700 })
    symlinkSync(target, position === 'root' ? appData : join(appData, 'electron'), 'junction')
    const context = fixture(root)
    expect(() => configureQcuOfficeEntry(context.app, context.env)).toThrow('real directories')
    expect(existsSync(join(target, 'home'))).toBe(false)
    expect(context.app.setPath).not.toHaveBeenCalled()
  })

  it('evaluates the source Desktop import only after fixed QCU roots and mode exist', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-source-entry-'))
    roots.push(root)
    const context = fixture(root)
    vi.stubEnv('DSH_HOME', '/ordinary/home')
    vi.stubEnv('DSH_DESKTOP_USER_DATA_DIR', '/ordinary/electron')
    vi.doMock('electron', () => ({ app: context.app }))
    let evaluated = false
    vi.doMock('../src/main.ts', async () => {
      const entry = await import('../src/qcu-office-entry.ts')
      expect(entry.isQcuOfficeLaunch(context.app)).toBe(true)
      expect(context.switches.has('qcu-dedicated')).toBe(true)
      expect(process.env.DSH_HOME).toBe(join(root, 'qcu-office', 'home'))
      expect(context.paths.get('userData')).toBe(join(root, 'qcu-office', 'electron'))
      evaluated = true
      return {}
    })
    await import('../src/qcu-main.ts')
    expect(evaluated).toBe(true)
  })

  it('does not import the Desktop module when the fixed namespace cannot be created', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-source-entry-failure-'))
    roots.push(root)
    writeFileSync(join(root, 'qcu-office'), 'synthetic obstruction')
    const context = fixture(root)
    const desktopImport = vi.fn(() => ({}))
    vi.doMock('electron', () => ({ app: context.app }))
    vi.doMock('../src/main.ts', desktopImport)
    await expect(import('../src/qcu-main.ts')).rejects.toThrow()
    expect(desktopImport).not.toHaveBeenCalled()
    expect(context.app.setName).not.toHaveBeenCalled()
  })

  it('propagates a Desktop configuration failure without relaxing the selected mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'qcu-source-config-failure-'))
    roots.push(root)
    const context = fixture(root)
    vi.stubEnv('DSH_HOME', '/ordinary/home')
    vi.stubEnv('DSH_DESKTOP_USER_DATA_DIR', '/ordinary/electron')
    vi.doMock('electron', () => ({ app: context.app }))
    vi.doMock('../src/main.ts', () => { throw new Error('invalid business configuration') })
    await expect(import('../src/qcu-main.ts')).rejects.toThrow()
    expect(context.switches.has('qcu-dedicated')).toBe(true)
    expect(process.env.DSH_HOME).toBe(join(root, 'qcu-office', 'home'))
    expect(context.app.setName).toHaveBeenCalledExactlyOnceWith('QCU Office')
  })
})

describe('QCU candidate release policy', () => {
  it('allows QCU without an ordinary mandatory-release policy', () => {
    expect(() => { assertQcuOfficeReleasePolicy(true, undefined) }).not.toThrow()
  })

  it('rejects any configured ordinary policy for QCU', () => {
    for (const config of [{ url: 'https://example.invalid/ordinary' }, null, false]) {
      expect(() => { assertQcuOfficeReleasePolicy(true, config) }).toThrow('qualified QCU release is required')
    }
  })

  it('preserves ordinary Desktop policy configuration', () => {
    expect(() => { assertQcuOfficeReleasePolicy(false, { url: 'https://example.invalid/ordinary' }) }).not.toThrow()
    expect(() => { assertQcuOfficeReleasePolicy(false, undefined) }).not.toThrow()
  })
})
