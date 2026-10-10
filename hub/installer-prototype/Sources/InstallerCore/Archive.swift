import Foundation

func validatePath(_ path: String) throws {
    try require(path.utf8.count <= 100 && matches(path, "^[A-Za-z0-9_-][A-Za-z0-9_./-]*$")
                && path.split(separator: "/", omittingEmptySubsequences: false).allSatisfy { !$0.isEmpty && $0 != "." && $0 != ".." }, "unsafe-archive-path")
}

/// Deliberately narrow POSIX ustar: regular files only, no compression, links,
/// directory entries, devices, PAX/GNU extensions or executable permissions.
/// Parse and validate the complete bounded archive before any filesystem write.
func unpack(_ bytes: Data, manifest: ReleaseManifest) throws -> [String: Data] {
    try require(bytes.count == manifest.bytes && digest(bytes) == manifest.sha256, "archive-integrity")
    let data = [UInt8](bytes)
    try require(data.count >= 1024 && data.count % 512 == 0, "invalid-tar-length")
    var cursor = 0
    var output: [String: Data] = [:]
    let records = Dictionary(uniqueKeysWithValues: manifest.files.map { ($0.path, $0) })
    func string(_ start: Int, _ count: Int) throws -> String {
        let field = data[start..<(start + count)]
        let head = field.prefix { $0 != 0 }
        try require(field.dropFirst(head.count).allSatisfy { $0 == 0 }, "invalid-tar-string")
        guard let value = String(bytes: head, encoding: .ascii) else { throw InstallerError.refused("non-ascii-tar") }
        return value
    }
    func octal(_ start: Int, _ count: Int) throws -> Int {
        let field = data[start..<(start + count)]
        try require(field.allSatisfy { $0 == 0 || $0 == 32 || (48...55).contains($0) }, "invalid-tar-number")
        let value = String(bytes: field.filter { $0 != 0 && $0 != 32 }, encoding: .ascii) ?? ""
        guard let number = Int(value, radix: 8) else { throw InstallerError.refused("invalid-tar-number") }
        return number
    }
    while cursor + 512 <= data.count {
        if data[cursor..<(cursor + 512)].allSatisfy({ $0 == 0 }) {
            try require(cursor + 1024 <= data.count && data[cursor...].allSatisfy { $0 == 0 }, "invalid-tar-end")
            try require(Set(output.keys) == Set(records.keys), "archive-file-set-mismatch")
            return output
        }
        let checksum = try octal(cursor + 148, 8)
        let sum = (0..<512).reduce(0) { $0 + ((148..<156).contains($1) ? 32 : Int(data[cursor + $1])) }
        try require(sum == checksum, "tar-checksum")
        try require(try string(cursor + 257, 6) == "ustar" && string(cursor + 345, 155).isEmpty, "unsupported-tar-format")
        try require(data[cursor + 156] == 48 && (try string(cursor + 157, 100)).isEmpty, "non-regular-tar-entry")
        let mode = try octal(cursor + 100, 8)
        try require(mode & 0o7111 == 0, "executable-or-special-mode")
        let name = try string(cursor, 100)
        try validatePath(name)
        guard let record = records[name] else { throw InstallerError.refused("unlisted-file") }
        try require(output[name] == nil, "duplicate-tar-entry")
        let count = try octal(cursor + 124, 12)
        try require(count == record.bytes && count <= data.count - cursor - 512, "tar-size-limit")
        let content = Data(data[(cursor + 512)..<(cursor + 512 + count)])
        try require(digest(content) == record.sha256, "file-integrity")
        output[name] = content
        cursor += 512 + ((count + 511) / 512) * 512
    }
    throw InstallerError.refused("missing-tar-end")
}
