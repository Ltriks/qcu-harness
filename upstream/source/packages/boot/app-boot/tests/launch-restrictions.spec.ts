import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { composeEntries, type Profile } from '../src/profile.ts'
import { readProfilePatches, type ProfileContext } from '../src/profile-context.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture(launchPatches?: readonly PatchOptions[]) {
  const root = mkdtempSync(join(tmpdir(), 'launcher-restriction-'))
  roots.push(root)
  const context: ProfileContext = {
    name: 'synthetic', dir: root, patchPath: join(root, 'profile.patch.yml'), installAnchor: join(root, 'package.json'),
    cwd: root, home: root, startedBundles: [], overlays: [{ id: 'guarded', disabled: false }], telemetryDisabledEnv: undefined,
    ...(launchPatches === undefined ? {} : { launchPatches }),
  }
  const profile: Profile = {
    name: 'synthetic', dir: root, patchPath: context.patchPath, layers: [], skippedBundles: [],
    patches: [{ insert: [{ id: 'guarded', name: 'synthetic-never-imported' }] }],
  }
  return { context, profile }
}
it('retains ordinary profile behavior without launcher restrictions', () => {
  const { context, profile } = fixture()
  expect(composeEntries([readProfilePatches('test', context, profile)])[0]?.disabled).toBe(false)
})
it('appends detached fixed disables after user overrides on every composition', () => {
  const launch = [{ id: 'guarded', disabled: true }]
  const { context, profile } = fixture(launch)
  const one = readProfilePatches('test', context, profile)
  expect(composeEntries([one])[0]?.disabled).toBe(true)
  one.at(-1)!.disabled = false
  expect(launch[0]?.disabled).toBe(true)
  expect(composeEntries([readProfilePatches('test', context, profile)])[0]?.disabled).toBe(true)
})
it('rejects missing targets instead of ordinary warning-and-skip behavior', () => {
  const { context, profile } = fixture([{ id: 'missing', disabled: true }])
  expect(() => readProfilePatches('test', context, profile)).toThrow('Launcher restriction target is missing')
})
it.each([
  null, 'text', [], { id: 'guarded', disabled: false }, { id: 'guard*', disabled: true },
  { id: 'guarded', disabled: true, config: {} }, { disabled: true },
  Object.create({ id: 'guarded', disabled: true }) as object,
])('rejects malformed launcher restriction %# before producing patches', (restriction) => {
  const { context, profile } = fixture([restriction as PatchOptions])
  expect(() => readProfilePatches('test', context, profile)).toThrow('Invalid launcher restrictions')
})
it('rejects a malformed container and duplicate targets', () => {
  const { context, profile } = fixture([{ id: 'guarded', disabled: true }, { id: 'guarded', disabled: true }])
  expect(() => readProfilePatches('test', context, profile)).toThrow('Invalid launcher restrictions')
  expect(() => readProfilePatches('test', { ...context, launchPatches: {} as readonly PatchOptions[] }, profile))
    .toThrow('Invalid launcher restrictions')
})
