/** Fixed private QCU messages carried only by the existing desktop parent/child IPC channel. */
export type QcuPrivateMessage =
  | { readonly type: 'qcu:hello'; readonly protocolVersion: 1; readonly ownerId: string }
  | { readonly type: 'qcu:bind' | 'qcu:grant' | 'qcu:granted' | 'qcu:revoke' | 'qcu:unbind' | 'qcu:unbound'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number }
  | { readonly type: 'qcu:ready'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number; readonly origin: string }
  | { readonly type: 'qcu:revoked'; readonly protocolVersion: 1; readonly ownerId: string; readonly generation: string; readonly requestId: number; readonly ok: boolean }

/** Recognize the reserved family without admitting a malformed member. */
export function isQcuPrivateMessage(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'type' in value
    && typeof value.type === 'string' && value.type.startsWith('qcu:')
}

/** Validate an exact loopback origin; never include a rejected value in diagnostics. */
export function qcuPrivateOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/?$/.test(value)) return undefined
  const port = Number(value.slice('http://127.0.0.1:'.length).replace(/\/$/, ''))
  if (port < 1 || port > 65535) return undefined
  return new URL(value).origin
}

/** Parse only version 1 exact fields, UUID owner/generation, and positive integer correlation IDs. */
export function parseQcuPrivateMessage(value: unknown): QcuPrivateMessage | undefined {
  if (!isQcuPrivateMessage(value)) return undefined
  const candidate = value as Record<string, unknown>
  const uuid = (input: unknown): boolean => typeof input === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input)
  if (candidate.protocolVersion !== 1 || !uuid(candidate.ownerId)) return undefined
  const fields = ['type', 'protocolVersion', 'ownerId']
  if (candidate.type !== 'qcu:hello') {
    if (!uuid(candidate.generation) || !Number.isSafeInteger(candidate.requestId) || Number(candidate.requestId) <= 0) return undefined
    fields.push('generation', 'requestId')
    if (candidate.type === 'qcu:ready') {
      if (qcuPrivateOrigin(candidate.origin) === undefined) return undefined
      fields.push('origin')
    } else if (candidate.type === 'qcu:revoked') {
      if (typeof candidate.ok !== 'boolean') return undefined
      fields.push('ok')
    } else if (!['qcu:bind', 'qcu:grant', 'qcu:granted', 'qcu:revoke', 'qcu:unbind', 'qcu:unbound'].includes(String(candidate.type))) return undefined
  }
  if (Object.keys(candidate).length !== fields.length || Object.keys(candidate).some(key => !fields.includes(key))) return undefined
  return candidate as QcuPrivateMessage
}
