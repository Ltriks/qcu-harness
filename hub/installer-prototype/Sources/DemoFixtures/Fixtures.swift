// TEST FIXTURES ONLY. This module must not ship in a production installer.
// The deterministic test signing key has no production authority or persistence.
import Foundation
import CryptoKit
import InstallerCore

public struct Fixture {
    public let request: InstallRequest
    public let envelope: Data
    public let archive: DownloadedArchive
    public let trust: CatalogTrust
}
public enum Fixtures {
    public static let testKeyID = "test-fixture-ed25519-DO-NOT-TRUST-IN-PRODUCTION"
    public static func key() throws -> Curve25519.Signing.PrivateKey {
        try Curve25519.Signing.PrivateKey(rawRepresentation: Data(repeating: 0x42, count: 32))
    }
    public static func signed(_ manifest: [String: Any]) throws -> Data {
        let payload = try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        return try JSONEncoder().encode(SignedEnvelope(keyID: testKeyID, payload: payload.base64EncodedString(),
                                                      signature: key().signature(for: payload).base64EncodedString()))
    }
    public static func tar(_ files: [String: Data], entryType: UInt8 = 48, mode: Int = 0o600) -> Data {
        var archive = Data()
        for name in files.keys.sorted() {
            let content = files[name]!
            var header = [UInt8](repeating: 0, count: 512)
            func put(_ text: String, _ offset: Int, _ limit: Int) {
                for (i, byte) in text.utf8.prefix(limit).enumerated() { header[offset + i] = byte }
            }
            put(name, 0, 100); put(String(format: "%07o", mode), 100, 7)
            put("0000000", 108, 7); put("0000000", 116, 7)
            put(String(format: "%011o", content.count), 124, 11); put("00000000000", 136, 11)
            for i in 148..<156 { header[i] = 32 }
            header[156] = entryType
            put("ustar", 257, 5); put("00", 263, 2)
            let sum = header.reduce(0) { $0 + Int($1) }
            put(String(format: "%06o", sum), 148, 6); header[154] = 0; header[155] = 32
            archive.append(contentsOf: header); archive.append(content)
            archive.append(Data(repeating: 0, count: (512 - content.count % 512) % 512))
        }
        archive.append(Data(repeating: 0, count: 1024))
        return archive
    }
    public static func make(kind: PackageKind = .skill, version: String = "0.1.0-test.1", requestID: String = UUID().uuidString.lowercased(),
                            now: Date = Date(), files customFiles: [String: Data]? = nil, entryType: UInt8 = 48, mode: Int = 0o600,
                            mutate: ((inout [String: Any]) -> Void)? = nil) throws -> Fixture {
        let packageID = kind == .skill ? "chengyuan-study-demo" : "chengyuan-plugin-demo"
        let defaultFiles: [String: Data]
        if kind == .skill {
            defaultFiles = ["SKILL.md": Data("---\nname: \(packageID)\ndescription: Synthetic fixture only\n---\nAsk a learner to restate a concept. No private content.\n".utf8)]
        } else {
            defaultFiles = [
                "package/package.json": Data("{\"name\":\"\(packageID)\",\"version\":\"\(version)\",\"type\":\"module\",\"main\":\"index.js\",\"dsh\":{\"bundle\":{\"patch\":\"./cordis.patch.yml\"}}}".utf8),
                "package/cordis.patch.yml": Data("[{\"insert\":[{\"id\":\"chengyuan-plugin-demo\",\"name\":\"chengyuan-plugin-demo\",\"disabled\":true}]}]".utf8),
                "package/index.js": Data("// TEST ONLY, never loaded by this prototype.\nexport function apply() {}\n".utf8),
            ]
        }
        let files = customFiles ?? defaultFiles
        let tarball = tar(files, entryType: entryType, mode: mode)
        let hash = digest(tarball)
        let source = URL(string: "https://catalog.example.invalid/packages/\(packageID)-\(version)-\(hash).tar")!
        var manifest: [String: Any] = [
            "schema": 1, "catalogID": "test-chengyuan", "packageID": packageID, "version": version,
            "title": kind == .skill ? "学习教练 · 纯文本测试" : "插件 · 仅参数计划",
            "kind": kind.rawValue, "archiveURL": source.absoluteString, "sha256": hash, "bytes": tarball.count,
            "files": files.keys.sorted().map { ["path": $0, "sha256": digest(files[$0]!), "bytes": files[$0]!.count] as [String: Any] },
            "expiresAt": Int(now.addingTimeInterval(3600).timeIntervalSince1970), "dshVersion": "0.2.0-rc.2",
            "dependencies": [String](), "installScripts": false,
            "authority": kind == .skill ? "model-instructions" : "host-code-outside-workspace-sandbox",
        ]
        mutate?(&manifest)
        let request = try InstallRequest.parse(JSONSerialization.data(withJSONObject: ["catalogID": "test-chengyuan", "packageID": packageID, "version": version, "requestID": requestID]))
        let trust = try CatalogTrust(catalogID: "test-chengyuan", origin: URL(string: "https://catalog.example.invalid")!,
                                     publicKeys: [testKeyID: key().publicKey.rawRepresentation], fixtureOnly: true)
        return Fixture(request: request, envelope: try signed(manifest), archive: DownloadedArchive(source: source, bytes: tarball), trust: trust)
    }
}
