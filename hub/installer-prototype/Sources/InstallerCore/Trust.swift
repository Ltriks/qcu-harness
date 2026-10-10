import Foundation
import CryptoKit

public enum InstallerError: Error, Equatable, CustomStringConvertible {
    case refused(String)
    public var description: String { switch self { case .refused(let reason): return reason } }
}
func require(_ value: Bool, _ reason: String) throws {
    if !value { throw InstallerError.refused(reason) }
}
public func digest(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}
func matches(_ string: String, _ pattern: String) -> Bool {
    string.range(of: pattern, options: .regularExpression) != nil
}
func object(_ data: Data, keys: Set<String>) throws -> [String: Any] {
    guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw InstallerError.refused("object-required")
    }
    try require(Set(value.keys) == keys, "missing-or-unknown-field")
    return value
}
let idPattern = "^[a-z][a-z0-9-]{0,79}$"
let versionPattern = "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[A-Za-z0-9]+([.-][A-Za-z0-9]+)*)?$"

public struct InstallRequest: Codable, Equatable, Sendable {
    public let catalogID: String
    public let packageID: String
    public let version: String
    public let requestID: String

    public static func parse(_ data: Data) throws -> Self {
        try require(data.count <= 2048, "request-too-large")
        _ = try object(data, keys: ["catalogID", "packageID", "version", "requestID"])
        let request = try JSONDecoder().decode(Self.self, from: data)
        try require(matches(request.catalogID, idPattern) && matches(request.packageID, idPattern), "invalid-id")
        try require(matches(request.version, versionPattern), "invalid-version")
        try require(UUID(uuidString: request.requestID)?.uuidString.lowercased() == request.requestID, "invalid-request-id")
        return request
    }

    /// Proposed CITY helper protocol, not a DSH route. No OS registration here.
    public static func parseURL(_ url: URL) throws -> Self {
        try require(url.absoluteString.utf8.count <= 4096, "request-url-too-large")
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { throw InstallerError.refused("invalid-request-url") }
        try require(parts.scheme == "qcu-install" && parts.host == "request" && parts.path.isEmpty
                    && parts.user == nil && parts.password == nil && parts.port == nil && parts.fragment == nil, "invalid-request-url")
        let items = parts.queryItems ?? []
        var fields: [String: String] = [:]
        for item in items {
            try require(fields[item.name] == nil && item.value != nil, "duplicate-or-empty-query")
            fields[item.name] = item.value
        }
        return try parse(JSONSerialization.data(withJSONObject: fields))
    }
}

public enum PackageKind: String, Codable, Sendable { case skill, plugin }
public enum ArchiveFormat: String, Codable, Sendable { case tar, tgz, zip }
public struct FileRecord: Codable, Sendable {
    public let path: String
    public let sha256: String
    public let bytes: Int
}
public struct ReleaseManifest: Codable, Sendable {
    public let schema: Int
    public let catalogID: String
    public let packageID: String
    public let version: String
    public let title: String
    public let kind: PackageKind
    public let archiveURL: String
    public let archiveFormat: ArchiveFormat
    public let sha256: String
    public let bytes: Int
    public let files: [FileRecord]
    public let expiresAt: Int
    public let dshVersion: String
    public let dependencies: [String]
    public let installScripts: Bool
    public let authority: String
}
public struct SignedEnvelope: Codable {
    public let keyID: String
    public let payload: String
    public let signature: String
    public init(keyID: String, payload: String, signature: String) {
        self.keyID = keyID; self.payload = payload; self.signature = signature
    }
}

/// Provisioned by a future signed application, never by the Hub request/manifest.
/// An empty production trust store fails closed. Fixture keys are a separate mode.
public struct CatalogTrust: Sendable {
    public let catalogID: String
    public let origin: URL
    public let publicKeys: [String: Data]
    public let fixtureOnly: Bool
    public init(catalogID: String, origin: URL, publicKeys: [String: Data], fixtureOnly: Bool = false) throws {
        try require(matches(catalogID, idPattern) && (fixtureOnly == catalogID.hasPrefix("test-")), "trust-mode-mismatch")
        let allowedScheme = origin.scheme == "https" || (fixtureOnly && origin.scheme == "http" && origin.host == "127.0.0.1" && origin.port != nil)
        try require(allowedScheme && origin.host != nil && origin.user == nil && origin.password == nil
                    && origin.query == nil && origin.fragment == nil && (origin.path.isEmpty || origin.path == "/"), "invalid-trust-origin")
        for (id, key) in publicKeys {
            try require(id.hasPrefix("test-") == fixtureOnly, "test-key-in-production")
            _ = try Curve25519.Signing.PublicKey(rawRepresentation: key)
        }
        self.catalogID = catalogID; self.origin = origin; self.publicKeys = publicKeys; self.fixtureOnly = fixtureOnly
    }

    func verify(_ bytes: Data, request: InstallRequest, now: Date) throws -> (ReleaseManifest, String) {
        try require(bytes.count <= 128 * 1024, "manifest-too-large")
        _ = try object(bytes, keys: ["keyID", "payload", "signature"])
        let envelope = try JSONDecoder().decode(SignedEnvelope.self, from: bytes)
        guard let key = publicKeys[envelope.keyID], let payload = Data(base64Encoded: envelope.payload),
              let signature = Data(base64Encoded: envelope.signature) else { throw InstallerError.refused("untrusted-key-or-encoding") }
        try require(try Curve25519.Signing.PublicKey(rawRepresentation: key).isValidSignature(signature, for: payload), "bad-signature")
        let value = try object(payload, keys: ["schema", "catalogID", "packageID", "version", "title", "kind", "archiveURL", "archiveFormat", "sha256", "bytes", "files", "expiresAt", "dshVersion", "dependencies", "installScripts", "authority"])
        guard let files = value["files"] as? [[String: Any]] else { throw InstallerError.refused("invalid-files") }
        for file in files { try require(Set(file.keys) == ["path", "sha256", "bytes"], "unknown-file-field") }
        let manifest = try JSONDecoder().decode(ReleaseManifest.self, from: payload)
        try require(manifest.schema == 2 && manifest.catalogID == catalogID && request.catalogID == catalogID
                    && manifest.packageID == request.packageID && manifest.version == request.version, "identity-mismatch")
        try require(manifest.expiresAt > Int(now.timeIntervalSince1970), "expired-manifest")
        try require(!manifest.title.isEmpty && manifest.title.count <= 120 && !manifest.title.unicodeScalars.contains(where: { $0.value < 32 }), "invalid-title")
        try require(manifest.dshVersion == "0.2.0-rc.2" && manifest.dependencies.isEmpty && !manifest.installScripts, "unsupported-dependencies-scripts-or-runtime")
        try require(manifest.authority == (manifest.kind == .skill ? "model-instructions" : "host-code-outside-workspace-sandbox"), "invalid-authority-disclosure")
        try require(manifest.bytes > 0 && manifest.bytes <= 8 * 1024 * 1024 && matches(manifest.sha256, "^[a-f0-9]{64}$"), "invalid-archive-limits")
        guard let url = URL(string: manifest.archiveURL) else { throw InstallerError.refused("invalid-archive-url") }
        let expected = origin.appendingPathComponent("packages/\(manifest.packageID)-\(manifest.version)-\(manifest.sha256).\(manifest.archiveFormat.rawValue)")
        try require(url.absoluteString == expected.absoluteString, "unbound-or-mutable-archive-url")
        try require(!manifest.files.isEmpty && manifest.files.count <= 100, "file-count-limit")
        var total = 0
        var names = Set<String>()
        for file in manifest.files {
            try validatePath(file.path)
            try require(names.insert(file.path.lowercased()).inserted && file.bytes >= 0 && file.bytes <= 1024 * 1024
                        && matches(file.sha256, "^[a-f0-9]{64}$"), "invalid-file-record")
            total += file.bytes
        }
        try require(total <= 4 * 1024 * 1024, "expanded-size-limit")
        return (manifest, digest(payload))
    }
}

/// Immutable archive bytes. DownloadClient validates the network source and file;
/// offline callers must still supply a signed envelope to Installer.prepare.
public struct DownloadedArchive: Sendable {
    public let source: URL
    public let bytes: Data
    public init(source: URL, bytes: Data) { self.source = source; self.bytes = bytes }
}
