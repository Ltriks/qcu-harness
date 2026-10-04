import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { QCU_NATIVE_IPC, QCU_NATIVE_PROTOCOL_VERSION, parseQcuNativeRequest, resolveQcuNativeBridge } from '../src/qcu-native-contract.ts'

it('pins the desktop v1 definitions to the separately installed external QCU package', () => {
  const source = readFileSync(new URL('../src/qcu-native-contract.ts', import.meta.url), 'utf8')
  const copied = source.slice(source.indexOf('\n') + 1).split('\n/** Desktop-only fixed IPC names.')[0]!
  expect(createHash('sha256').update(copied).digest('hex')).toBe('064ce144a0df8a458febf6bb7c2e810f5314fcfe928d7c395e63963c479db04b')
  const external = new URL('../../../../package/src/native-contract.ts', import.meta.url)
  if (existsSync(external)) expect(copied).toBe(readFileSync(external, 'utf8'))
  expect(QCU_NATIVE_PROTOCOL_VERSION).toBe(1)
  expect(new Set(Object.values(QCU_NATIVE_IPC)).size).toBe(5)
})

it('rejects expanded/unversioned bridges and hidden extra viewport fields', () => {
  const methods = {
    available: async () => true, open: async () => {}, setBounds: async () => {}, close: async () => {}, back: async () => {},
  }
  expect(resolveQcuNativeBridge(methods)).toBeUndefined()
  expect(resolveQcuNativeBridge({ protocolVersion: 1, ...methods, navigate: async () => {} })).toBeUndefined()
  expect(resolveQcuNativeBridge({ protocolVersion: 1, ...methods })).toBeDefined()
  const bounds = { x: 0, y: 0, width: 10, height: 10 }
  Object.defineProperty(bounds, Symbol('private'), { value: true })
  expect(() => parseQcuNativeRequest('open', ['opaque', bounds])).toThrow('Invalid QCU bounds')
  expect(() => parseQcuNativeRequest('navigate', ['opaque', '/task'])).toThrow('Invalid QCU request')
})
