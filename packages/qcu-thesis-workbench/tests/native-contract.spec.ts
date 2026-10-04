import { describe, expect, it } from 'vitest'
import { parseQcuNativeRequest, qcuBounds, qcuContextId, resolveQcuNativeBridge } from '../src/native-contract.ts'

const bounds = { x: -2.5, y: 3.25, width: 400.75, height: 600.5 }
const bridge = () => ({
  protocolVersion: 1,
  available: async () => true,
  open: async () => {},
  setBounds: async () => {},
  close: async () => {},
  back: async () => {},
})

describe('fixed QCU preload bridge', () => {
  it('accepts only the versioned fixed capability', () => {
    const value = Object.freeze(bridge())
    expect(resolveQcuNativeBridge(value)).toBe(value)
    expect(Object.keys(value).sort()).toEqual(['available', 'back', 'close', 'open', 'protocolVersion', 'setBounds'])
  })

  it.each([undefined, null, false, {}, [], { ...bridge(), protocolVersion: 0 }, { ...bridge(), protocolVersion: 2 },
    { ...bridge(), protocolVersion: '1' }, { ...bridge(), protocolVersion: undefined }, { ...bridge(), open: undefined },
    { ...bridge(), register: () => {} }, { ...bridge(), origin: 'http://127.0.0.1:4000' },
    { ...bridge(), [Symbol('extra')]: true }])('fails closed for a missing, malformed, expanded, or incompatible bridge (%#)', value => {
    expect(resolveQcuNativeBridge(value)).toBeUndefined()
  })

  it('does not accept the old unversioned candidate', () => {
    const { protocolVersion: _version, ...legacy } = bridge()
    expect(resolveQcuNativeBridge(legacy)).toBeUndefined()
  })

  it('contains malformed capability accessors', () => {
    const value = { ...bridge(), get protocolVersion() { throw new Error('private target') } }
    expect(resolveQcuNativeBridge(value)).toBeUndefined()
  })
})

describe('fixed IPC operation parser', () => {
  it('accepts the five operations and preserves fractional CSS coordinates', () => {
    expect(parseQcuNativeRequest('available', [])).toEqual({ operation: 'available' })
    for (const operation of ['open', 'setBounds']) {
      const parsed = parseQcuNativeRequest(operation, ['fresh-opaque_id', bounds])
      expect(parsed).toEqual({ operation, contextId: 'fresh-opaque_id', bounds })
      expect('bounds' in parsed && parsed.bounds).not.toBe(bounds)
    }
    for (const operation of ['close', 'back']) {
      expect(parseQcuNativeRequest(operation, ['context'])).toEqual({ operation, contextId: 'context' })
    }
  })

  it.each(['register', 'list', 'navigate', 'openURL', 'readFile', 'execute', 'print', 'download', '__proto__', undefined])(
    'rejects an extra operation: %s', operation => {
      expect(() => parseQcuNativeRequest(operation, [])).toThrow('Invalid QCU request')
    },
  )

  it.each([
    ['available', [1]], ['available', ['qcu']], ['open', []], ['open', ['context']],
    ['open', ['qcu', 'context', bounds]], ['open', ['context', bounds, 'http://127.0.0.1:4000/task']],
    ['setBounds', ['context']], ['setBounds', ['context', bounds, {}]], ['close', []],
    ['close', ['context', 'file.docx']], ['back', []], ['back', ['context', '/task']],
  ])('rejects invalid argument counts for %s (%#)', (operation, args) => {
    expect(() => parseQcuNativeRequest(operation, args)).toThrow('Invalid QCU request')
  })

  it.each([null, {}, [], '', 'a'.repeat(257), 'bad\ncontext', 'space context', '/tmp/paper.docx',
    'http://127.0.0.1:4000/task', 'paper.docx', 42])('rejects malformed occurrence IDs (%#)', value => {
    expect(() => qcuContextId(value)).toThrow('Invalid QCU context')
  })

  it.each([
    undefined, null, [], {}, { ...bounds, url: '/task' }, { ...bounds, body: 'private' },
    { ...bounds, documentId: 'ab'.repeat(16) }, { ...bounds, x: NaN }, { ...bounds, y: Infinity },
    { ...bounds, width: -1 }, { ...bounds, height: -1 }, { ...bounds, x: 100_001 },
    { ...bounds, y: -100_001 }, { ...bounds, height: '600' }, { ...bounds, [Symbol('extra')]: 1 },
  ])('rejects malformed or expanded viewport data (%#)', value => {
    expect(() => qcuBounds(value)).toThrow('Invalid QCU bounds')
  })

  it('rejects inherited viewport coordinates and copies valid coordinates', () => {
    expect(() => qcuBounds(Object.create(bounds))).toThrow('Invalid QCU bounds')
    const parsed = qcuBounds(bounds)
    expect(parsed).toEqual(bounds)
    expect(Object.isFrozen(parsed)).toBe(true)
  })
})
