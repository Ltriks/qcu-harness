import {inflateRawSync} from 'node:zlib'
import {check, LIMITS} from './protocol.mjs'
const valid = ok => check(ok, 'invalid-docx'), bound = ok => check(ok, 'parse-limit')
const table = Uint32Array.from({length:256}, (_, n) => {
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1
  return n >>> 0
})
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0 }

// Only classic, single-disk ZIP with stored/deflated members. Validate ALL metadata before inflate.
// maxOutputLength is independent of untrusted declared sizes; CRC, actual length and consumed input
// are also checked. No paths are extracted and no JSZip unbounded async/string operation is used.
export function zipEntries(data) {
  const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  valid(b.length >= 22 && b.readUInt32LE(0) === 0x04034b50)
  let e = b.length - 22
  while (e >= Math.max(0, b.length - 65557) && b.readUInt32LE(e) !== 0x06054b50) e--
  valid(e >= 0 && e + 22 + b.readUInt16LE(e + 20) === b.length)
  const count = b.readUInt16LE(e + 10), size = b.readUInt32LE(e + 12), offset = b.readUInt32LE(e + 16)
  valid(b.readUInt16LE(e + 4) === 0 && b.readUInt16LE(e + 6) === 0 && b.readUInt16LE(e + 8) === count && offset + size === e)
  bound(count > 0 && count <= LIMITS.zipEntries)
  let at = offset, total = 0
  const names = new Set(), entries = []
  for (let i = 0; i < count; i++) {
    valid(at + 46 <= e && b.readUInt32LE(at) === 0x02014b50)
    const flags = b.readUInt16LE(at + 8), method = b.readUInt16LE(at + 10), crc = b.readUInt32LE(at + 16), compressed = b.readUInt32LE(at + 20), bytes = b.readUInt32LE(at + 24), length = b.readUInt16LE(at + 28), extra = b.readUInt16LE(at + 30), comment = b.readUInt16LE(at + 32), local = b.readUInt32LE(at + 42)
    valid(at + 46 + length + extra + comment <= e && b.readUInt16LE(at + 34) === 0)
    check(!(flags & 1), 'unsafe-docx')
    valid(!(flags & ~0x080e) && [0, 8].includes(method) && bytes !== 0xffffffff && compressed !== 0xffffffff && local !== 0xffffffff)
    const rawName = b.subarray(at + 46, at + 46 + length)
    let name
    try { name = new TextDecoder('utf-8', {fatal:true}).decode(rawName) } catch { valid(false) }
    valid(name && name.length <= 240 && !/[\\:\u0000-\u001f\u007f]/.test(name) && !name.startsWith('/') && name.split('/').every((p, j, a) => p !== '.' && p !== '..' && (p || j === a.length - 1)))
    const key = name.toLowerCase(); valid(!names.has(key)); names.add(key)
    valid((b.readUInt32LE(at + 38) >>> 16 & 0xf000) !== 0xa000)
    check(!/vbaproject|encryptedpackage|encryptioninfo/i.test(name), 'unsafe-docx')
    total += bytes
    bound(bytes <= LIMITS.zipEntryBytes && total <= LIMITS.zipTotalBytes && bytes <= Math.max(1, compressed) * LIMITS.zipRatio)
    valid(local + 30 <= offset && b.readUInt32LE(local) === 0x04034b50 && b.readUInt16LE(local + 6) === flags && b.readUInt16LE(local + 8) === method)
    const nl = b.readUInt16LE(local + 26), el = b.readUInt16LE(local + 28), start = local + 30 + nl + el, end = start + compressed
    valid(nl === length && b.subarray(local + 30, local + 30 + nl).equals(rawName) && end <= offset)
    for (const [pos, expected] of [[14, crc], [18, compressed], [22, bytes]]) valid(b.readUInt32LE(local + pos) === expected || flags & 8 && b.readUInt32LE(local + pos) === 0)
    let localEnd = end
    if (flags & 8) {
      valid(end + 12 <= offset)
      const d = b.readUInt32LE(end) === 0x08074b50 ? end + 4 : end
      valid(d + 12 <= offset && b.readUInt32LE(d) === crc && b.readUInt32LE(d + 4) === compressed && b.readUInt32LE(d + 8) === bytes); localEnd = d + 12
    }
    entries.push({name, method, crc, bytes, start, end, local, localEnd})
    at += 46 + length + extra + comment
  }
  valid(at === e)
  const sorted = [...entries].sort((a, z) => a.local - z.local)
  valid(sorted[0].local === 0 && sorted.at(-1).localEnd === offset)
  for (let i = 1; i < sorted.length; i++) valid(sorted[i - 1].localEnd === sorted[i].local)
  return entries.map(entry => ({name:entry.name, read() {
    const input = b.subarray(entry.start, entry.end)
    let result
    try {
      if (entry.method === 0) result = input
      else {
        const inflated = inflateRawSync(input, {maxOutputLength:Math.min(entry.bytes + 1, LIMITS.zipEntryBytes + 1), info:true})
        valid(inflated.engine.bytesWritten === input.length); result = inflated.buffer
      }
    } catch (e) { check(false, e.code === 'ERR_BUFFER_TOO_LARGE' ? 'parse-limit' : 'invalid-docx') }
    valid(result.length === entry.bytes && crc32(result) === entry.crc)
    return result
  }}))
}
