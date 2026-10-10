import Foundation
import SystemZlib

/// Bounded ZIP32 subset: stored/deflate, ASCII paths, regular files only.
/// No encryption, data descriptors, extra fields, ZIP64, comments or split disks.
/// The central directory and local headers must agree exactly with signed files.
func unpackZIP(_ data: Data, manifest: ReleaseManifest) throws -> [String: Data] {
    let bytes = [UInt8](data)
    func number(_ at: Int, _ width: Int) throws -> Int {
        try require(at >= 0 && at <= bytes.count - width, "truncated-zip")
        return (0..<width).reduce(0) { $0 | (Int(bytes[at + $1]) << (8 * $1)) }
    }
    try require(bytes.count >= 22, "truncated-zip")
    let end = bytes.count - 22
    try require(try number(end, 4) == 0x06054b50 && number(end + 4, 2) == 0 && number(end + 6, 2) == 0
                && number(end + 20, 2) == 0, "unsupported-zip-end")
    let count = try number(end + 10, 2), directorySize = try number(end + 12, 4), directory = try number(end + 16, 4)
    try require(try count == manifest.files.count && count == number(end + 8, 2) && directory <= end && directorySize == end - directory, "zip-directory-limits")
    let records = Dictionary(uniqueKeysWithValues: manifest.files.map { ($0.path, $0) })
    var result: [String: Data] = [:]
    var cursor = directory
    var localCursor = 0
    for _ in 0..<count {
        try require(try number(cursor, 4) == 0x02014b50, "bad-central-header")
        let flags = try number(cursor + 8, 2), method = try number(cursor + 10, 2)
        let crc = try number(cursor + 16, 4), packed = try number(cursor + 20, 4), expanded = try number(cursor + 24, 4)
        let nameLength = try number(cursor + 28, 2), extras = try number(cursor + 30, 2), comment = try number(cursor + 32, 2)
        let external = try number(cursor + 38, 4), local = try number(cursor + 42, 4)
        try require(try flags == 0 && (method == 0 || method == 8) && extras == 0 && comment == 0
                    && number(cursor + 34, 2) == 0 && nameLength > 0 && nameLength <= 100
                    && cursor + 46 + nameLength <= end && local == localCursor, "unsupported-zip-entry")
        let mode = (external >> 16) & 0xffff
        try require((mode & 0o170000 == 0 || mode & 0o170000 == 0o100000) && mode & 0o7111 == 0 && external & 0x10 == 0, "zip-link-or-special-file")
        guard let name = String(bytes: bytes[(cursor + 46)..<(cursor + 46 + nameLength)], encoding: .ascii) else { throw InstallerError.refused("non-ascii-zip") }
        try validatePath(name)
        guard let record = records[name] else { throw InstallerError.refused("unlisted-zip-file") }
        try require(result[name] == nil && expanded == record.bytes, "zip-file-size-or-duplicate")
        try require(try number(local, 4) == 0x04034b50 && number(local + 6, 2) == flags && number(local + 8, 2) == method
                    && number(local + 14, 4) == crc && number(local + 18, 4) == packed && number(local + 22, 4) == expanded
                    && number(local + 26, 2) == nameLength && number(local + 28, 2) == 0, "zip-local-central-mismatch")
        let start = local + 30 + nameLength
        try require(start <= directory && packed <= directory - start, "zip-overlap-or-size")
        try require(Array(bytes[(local + 30)..<start]) == Array(name.utf8), "zip-path-mismatch")
        let payload = Data(bytes[start..<(start + packed)])
        let content = method == 0 ? payload : try inflateBounded(payload, windowBits: -15, limit: record.bytes)
        try require(content.count == expanded && digest(content) == record.sha256, "zip-file-integrity")
        let actualCRC = content.withUnsafeBytes { buffer in crc32(0, buffer.bindMemory(to: UInt8.self).baseAddress, uInt(buffer.count)) }
        try require(actualCRC == crc, "zip-crc")
        result[name] = content
        localCursor = start + packed; cursor += 46 + nameLength
    }
    try require(cursor == end && localCursor == directory && Set(result.keys) == Set(records.keys), "zip-trailing-or-missing-files")
    return result
}
