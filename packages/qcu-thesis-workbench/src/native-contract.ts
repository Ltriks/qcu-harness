/** Fixed QCU renderer commands. This module contains no native or Host implementation. */

/** The only supported renderer/native protocol; absent and other versions fail closed. */
export const QCU_NATIVE_PROTOCOL_VERSION = 1 as const

declare const contextBrand: unique symbol

/** Fresh opaque panel occurrence, never a session, document, filename, or business identifier. */
export type QcuContextId = string & { readonly [contextBrand]: 'QcuContextId' }

/** Fractional CSS viewport pixels. Electron converts to DIP and clips to the owner window. */
export interface QcuBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Optional `window.dshDesktop.qcu`; methods expose neither service targets nor document data. */
export interface QcuNativeBridge {
  readonly protocolVersion: typeof QCU_NATIVE_PROTOCOL_VERSION
  /** @returns True only while the fixed native panel and private Host service are enabled and bound. */
  available(): Promise<boolean>
  /** @param contextId - Fresh panel occurrence. @param bounds - CSS viewport rectangle. */
  open(contextId: QcuContextId, bounds: QcuBounds): Promise<void>
  /** @param contextId - Current occurrence. @param bounds - Updated CSS viewport rectangle. */
  setBounds(contextId: QcuContextId, bounds: QcuBounds): Promise<void>
  /** @param contextId - Occurrence to revoke; closing never cancels server computation. */
  close(contextId: QcuContextId): Promise<void>
  /** @param contextId - Current occurrence to return to the fixed `/task` document. */
  back(contextId: QcuContextId): Promise<void>
}

/** The five fixed IPC operations; there is no provider registration or arbitrary navigation. */
export type QcuNativeRequest =
  | { readonly operation: 'available' }
  | { readonly operation: 'open' | 'setBounds'; readonly contextId: QcuContextId; readonly bounds: QcuBounds }
  | { readonly operation: 'close' | 'back'; readonly contextId: QcuContextId }

const methodNames = ['available', 'open', 'setBounds', 'close', 'back'] as const
const bridgeKeys = ['protocolVersion', ...methodNames] as const

/**
 * Check the optional preload bridge without accepting older unversioned candidates.
 * @param value - The value at `window.dshDesktop.qcu`, not the surrounding desktop object.
 * @returns The fixed bridge, or undefined for missing, expanded, malformed, or mismatched bridges.
 */
export function resolveQcuNativeBridge(value: unknown): QcuNativeBridge | undefined {
  try {
    if (!record(value) || !versionedBridge(value)) return undefined
    return value
  } catch (_error) {
    // A hostile/malformed property getter cannot make a missing capability usable.
    return undefined
  }
}

/**
 * Validate an opaque occurrence at the untrusted IPC boundary.
 * @param value - Renderer-supplied occurrence; clients generate a new random UUID on each explicit open.
 * @returns A bounded opaque identifier, with no business meaning assigned by native code.
 */
export function qcuContextId(value: unknown): QcuContextId {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/u.test(value)) throw new Error('Invalid QCU context')
  return value as QcuContextId
}

/**
 * Copy and validate an exact CSS viewport rectangle at the untrusted IPC boundary.
 * @param value - Renderer-supplied rectangle; additional fields are forbidden.
 * @returns Finite bounded coordinates, retaining fractional precision.
 */
export function qcuBounds(value: unknown): QcuBounds {
  const keys = ['x', 'y', 'width', 'height'] as const
  if (!record(value) || !exactKeys(value, keys)) throw new Error('Invalid QCU bounds')
  const result = { x: 0, y: 0, width: 0, height: 0 }
  for (const key of keys) {
    const number = value[key]
    if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 100_000
      || ((key === 'width' || key === 'height') && number < 0)) throw new Error('Invalid QCU bounds')
    result[key] = number
  }
  return Object.freeze(result)
}

/**
 * Parse fixed operation names and exact argument counts; no renderer-selected target is accepted.
 * @param operation - IPC operation selected by one of the five fixed preload methods.
 * @param args - Positional payload, excluding the IPC sender supplied by Electron itself.
 * @returns A validated request containing only an occurrence and optional viewport.
 */
export function parseQcuNativeRequest(operation: unknown, args: readonly unknown[]): QcuNativeRequest {
  if (!Array.isArray(args)) throw new Error('Invalid QCU request')
  if (operation === 'available' && args.length === 0) return { operation }
  if ((operation === 'open' || operation === 'setBounds') && args.length === 2) {
    return { operation, contextId: qcuContextId(args[0]), bounds: qcuBounds(args[1]) }
  }
  if ((operation === 'close' || operation === 'back') && args.length === 1) {
    return { operation, contextId: qcuContextId(args[0]) }
  }
  throw new Error('Invalid QCU request')
}

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value)
  return keys.length === expected.length && keys.every(key => typeof key === 'string' && expected.includes(key))
}

function versionedBridge(value: Record<string, unknown>): value is Record<string, unknown> & QcuNativeBridge {
  return exactKeys(value, bridgeKeys) && value.protocolVersion === QCU_NATIVE_PROTOCOL_VERSION
    && methodNames.every(name => typeof value[name] === 'function')
}
