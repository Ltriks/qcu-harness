import Foundation

public enum InstallState: String, Codable, Sendable {
    case awaitingConfirmation, staging, applying, skillInstalledInSimulation
    case pluginPlanOnly, cancelled, failed, recoveryRequired
}
public struct Receipt: Codable, Sendable {
    public let request: InstallRequest
    public let manifestDigest: String
    public var state: InstallState
    public var message: String
}
public struct PreparedInstall: Sendable {
    public let request: InstallRequest
    public let manifest: ReleaseManifest
    public let manifestDigest: String
    fileprivate let files: [String: Data]
    fileprivate let signedEnvelope: Data
}
/// Only a local UI confirmation handler should obtain this ephemeral capability.
/// No network, tool or model-facing approve endpoint exists.
public struct UserConfirmation {
    fileprivate let id: UUID
}
public struct OfficialCLIPlan: Sendable {
    public let executable: String
    public let arguments: [String]
    public let syntheticHome: String
    public let state = "plan-only-not-executed"
}
public enum OfficialDesktopAdapter {
    static func plan(packageDirectory: URL, environment: SimulationEnvironment) -> OfficialCLIPlan {
        OfficialCLIPlan(executable: "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh",
                        arguments: ["plugin", "--profile", "desktop", "add", packageDirectory.path],
                        syntheticHome: environment.home.path)
    }
    /// No Process, shell, app lifecycle, environment or profile write implementation.
    public static func execute(_ plan: OfficialCLIPlan) throws {
        throw InstallerError.refused("real-cli-execution-not-implemented")
    }
}

/// The sole destination factory. Cannot adopt a real DSH_HOME or caller path.
/// All work is confined to one new, mode-0700 synthetic directory.
public final class SimulationEnvironment {
    public let root: URL
    public var home: URL { root.appendingPathComponent("synthetic-dsh-home") }
    public var skills: URL { home.appendingPathComponent("skills") }
    fileprivate var journals: URL { root.appendingPathComponent("journals") }
    fileprivate var transactions: URL { root.appendingPathComponent("transactions") }
    fileprivate var identities: URL { root.appendingPathComponent("release-identities") }
    public init() throws {
        root = FileManager.default.temporaryDirectory.resolvingSymlinksInPath()
            .appendingPathComponent("chengyuan-INSTALLER-SIMULATION-\(UUID().uuidString)", isDirectory: true)
        for path in [root, home, skills, journals, transactions, identities] { try makePrivate(path) }
    }
    /// Explicit cleanup is limited to the directory this instance created.
    public func removeSimulation() throws { try FileManager.default.removeItem(at: root) }
    fileprivate func safe(_ url: URL) throws {
        try require(url.path.hasPrefix(root.path + "/"), "outside-simulation")
        var check = url
        while check.path.hasPrefix(root.path) {
            if let attrs = try? FileManager.default.attributesOfItem(atPath: check.path) {
                try require(attrs[.type] as? FileAttributeType != .typeSymbolicLink, "symlink-destination")
            }
            if check == root { break }
            check.deleteLastPathComponent()
        }
    }
}
private func makePrivate(_ url: URL) throws {
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
}
private func writePrivate(_ data: Data, to url: URL) throws {
    try data.write(to: url, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
}

/// Single-owner synchronous core: UI runs on MainActor. No concurrent installer
/// or cross-process resumption is advertised in this prototype.
public final class Installer {
    public let environment: SimulationEnvironment
    public private(set) var lastPlan: OfficialCLIPlan?
    private let trust: CatalogTrust
    private var confirmations: [UUID: (String, String, Date)] = [:]
    private let clock: () -> Date
    // A filesystem fault seam used only by @testable regression tests.
    var afterBackup: (() throws -> Void)?

    public init(environment: SimulationEnvironment, trust: CatalogTrust, clock: @escaping () -> Date = Date.init) {
        self.environment = environment; self.trust = trust; self.clock = clock
    }
    private func journal(_ request: InstallRequest) -> URL {
        environment.journals.appendingPathComponent(request.requestID + ".json")
    }
    private func transaction(_ request: InstallRequest) -> URL {
        environment.transactions.appendingPathComponent(request.requestID)
    }
    public func receipt(for request: InstallRequest) throws -> Receipt? {
        _ = try InstallRequest.parse(JSONEncoder().encode(request))
        let path = journal(request)
        try environment.safe(path)
        guard FileManager.default.fileExists(atPath: path.path) else { return nil }
        let receipt = try JSONDecoder().decode(Receipt.self, from: Data(contentsOf: path))
        try require(receipt.request == request, "request-id-reused")
        return receipt
    }
    private func save(_ receipt: Receipt) throws {
        try environment.safe(journal(receipt.request))
        try writePrivate(JSONEncoder().encode(receipt), to: journal(receipt.request))
    }
    public func prepare(request: InstallRequest, envelope: Data, archive: DownloadedArchive) throws -> PreparedInstall {
        // Even requests decoded by a caller must pass the strict boundary parser.
        _ = try InstallRequest.parse(JSONEncoder().encode(request))
        let (manifest, payloadDigest) = try trust.verify(envelope, request: request, now: clock())
        try require(archive.source.absoluteString == manifest.archiveURL, "download-source-mismatch")
        let files = try unpack(archive.bytes, manifest: manifest)
        try validatePackage(manifest, files: files)
        let identity = digest(Data("\(request.catalogID)/\(request.packageID)@\(request.version)".utf8))
        let identityPath = environment.identities.appendingPathComponent(identity)
        try environment.safe(identityPath)
        if FileManager.default.fileExists(atPath: identityPath.path) {
            try require(try String(contentsOf: identityPath, encoding: .utf8) == manifest.sha256, "version-content-changed")
        } else { try writePrivate(Data(manifest.sha256.utf8), to: identityPath) }
        if let previous = try receipt(for: request) {
            try require(previous.manifestDigest == payloadDigest, "request-id-rebound")
        } else {
            try save(Receipt(request: request, manifestDigest: payloadDigest, state: .awaitingConfirmation,
                             message: "已校验测试包，等待本机确认；未安装。"))
        }
        return PreparedInstall(request: request, manifest: manifest, manifestDigest: payloadDigest, files: files, signedEnvelope: envelope)
    }
    private func validatePackage(_ manifest: ReleaseManifest, files: [String: Data]) throws {
        if manifest.kind == .skill {
            try require(files.keys.allSatisfy { $0.hasSuffix(".md") || $0.hasSuffix(".txt") }, "skill-must-be-text-only")
            guard let data = files["SKILL.md"], let text = String(data: data, encoding: .utf8) else { throw InstallerError.refused("missing-skill") }
            let sections = text.components(separatedBy: "---")
            try require(text.hasPrefix("---\n") && sections.count >= 3
                        && sections[1].split(separator: "\n").contains("name: \(manifest.packageID)"), "skill-identity-mismatch")
            try require(files.values.allSatisfy { String(data: $0, encoding: .utf8) != nil }, "non-utf8-skill")
        } else {
            guard let package = files["package/package.json"], let value = try JSONSerialization.jsonObject(with: package) as? [String: Any] else {
                throw InstallerError.refused("missing-plugin-manifest")
            }
            let packageKeys: Set<String> = ["name", "version", "private", "type", "main", "exports", "dsh", "peerDependencies", "files", "description"]
            try require(Set(value.keys).isSubset(of: packageKeys), "unsupported-plugin-package-field")
            try require(value["name"] as? String == manifest.packageID && value["version"] as? String == manifest.version, "plugin-identity-mismatch")
            for key in ["dependencies", "optionalDependencies", "devDependencies", "scripts", "bundledDependencies", "bundleDependencies"] {
                try require(value[key] == nil, "plugin-dependencies-or-scripts-forbidden")
            }
            if let peers = value["peerDependencies"] as? [String: String] {
                let allowed = ["@deepseek-ai/cordis": "4.0.4", "@deepseek-ai/dsh-skill": "0.2.0-rc.2"]
                try require(peers.allSatisfy { allowed[$0.key] == $0.value }, "unapproved-peer")
            } else { try require(value["peerDependencies"] == nil, "invalid-peers") }
            let dsh = value["dsh"] as? [String: Any]
            let bundle = dsh?["bundle"] as? [String: Any]
            try require(dsh.map { Set($0.keys) == ["bundle"] } == true && bundle.map { Set($0.keys) == ["patch"] } == true
                        && bundle?["patch"] as? String == "./cordis.patch.yml" && files["package/cordis.patch.yml"] != nil, "missing-bundle-patch")
            try require(files.keys.allSatisfy { $0.hasPrefix("package/") }, "plugin-outside-package")
        }
    }

    public func confirmFromLocalUser(_ prepared: PreparedInstall) throws -> UserConfirmation {
        _ = try trust.verify(prepared.signedEnvelope, request: prepared.request, now: clock())
        let receipt = try receipt(for: prepared.request)
        try require(receipt?.state == .awaitingConfirmation && receipt?.manifestDigest == prepared.manifestDigest, "not-awaiting-confirmation")
        try require(prepared.manifest.expiresAt > Int(clock().timeIntervalSince1970), "expired-manifest")
        let id = UUID()
        confirmations[id] = (prepared.request.requestID, prepared.manifestDigest, clock().addingTimeInterval(300))
        return UserConfirmation(id: id)
    }

    public func cancel(_ prepared: PreparedInstall) throws -> Receipt {
        guard var current = try receipt(for: prepared.request) else { throw InstallerError.refused("unknown-request") }
        try require(current.manifestDigest == prepared.manifestDigest, "request-id-rebound")
        if current.state == .cancelled { return current }
        try require(current.state == .awaitingConfirmation, "too-late-to-cancel")
        current.state = .cancelled; current.message = "已取消；没有安装。"
        confirmations = confirmations.filter { $0.value.0 != prepared.request.requestID }
        try save(current)
        return current
    }

    public func install(_ prepared: PreparedInstall, confirmation: UserConfirmation) throws -> Receipt {
        guard var current = try receipt(for: prepared.request) else { throw InstallerError.refused("unknown-request") }
        try require(current.manifestDigest == prepared.manifestDigest, "request-id-rebound")
        // Replaying a completed operation returns its exact status, never writes again.
        if [.skillInstalledInSimulation, .pluginPlanOnly, .cancelled].contains(current.state) { return current }
        _ = try trust.verify(prepared.signedEnvelope, request: prepared.request, now: clock())
        guard let approval = confirmations.removeValue(forKey: confirmation.id) else { throw InstallerError.refused("missing-or-consumed-confirmation") }
        try require(current.state == .awaitingConfirmation && approval.0 == prepared.request.requestID
                    && approval.1 == prepared.manifestDigest && approval.2 > clock()
                    && prepared.manifest.expiresAt > Int(clock().timeIntervalSince1970), "confirmation-mismatch-or-expired")
        let fm = FileManager.default
        let tx = transaction(prepared.request)
        let stage = tx.appendingPathComponent("staged")
        let backup = tx.appendingPathComponent("backup")
        let dest = environment.skills.appendingPathComponent(prepared.manifest.packageID)
        var oldMoved = false
        var newMoved = false
        do {
            for path in [tx, stage, dest] { try environment.safe(path) }
            try makePrivate(tx); try makePrivate(stage)
            current.state = .staging; current.message = "暂存于隔离目录。"; try save(current)
            for name in prepared.files.keys.sorted() {
                let target = stage.appendingPathComponent(name)
                let parts = name.split(separator: "/").dropLast()
                var parent = stage
                for part in parts {
                    parent.appendPathComponent(String(part))
                    if !fm.fileExists(atPath: parent.path) { try makePrivate(parent) }
                }
                try environment.safe(target)
                try writePrivate(prepared.files[name]!, to: target)
            }
            if prepared.manifest.kind == .plugin {
                lastPlan = OfficialDesktopAdapter.plan(packageDirectory: stage.appendingPathComponent("package"), environment: environment)
                current.state = .pluginPlanOnly
                current.message = "仅生成官方 CLI 参数计划；未运行、未安装、未启用。真实重启与调用验证未进行。"
                try save(current)
                return current
            }
            let marker = ".chengyuan-simulation-owner"
            if fm.fileExists(atPath: dest.path) {
                let markerPath = dest.appendingPathComponent(marker)
                try environment.safe(markerPath)
                try require((try? String(contentsOf: markerPath, encoding: .utf8)) == prepared.request.catalogID + "/" + prepared.request.packageID, "unowned-skill-collision")
            }
            try writePrivate(Data((prepared.request.catalogID + "/" + prepared.request.packageID).utf8), to: stage.appendingPathComponent(marker))
            current.state = .applying; current.message = "写入合成 Home，尚未确认完成。"; try save(current)
            if fm.fileExists(atPath: dest.path) { try fm.moveItem(at: dest, to: backup); oldMoved = true }
            try afterBackup?()
            try environment.safe(dest)
            try fm.moveItem(at: stage, to: dest); newMoved = true
            for (name, bytes) in prepared.files { try require(try Data(contentsOf: dest.appendingPathComponent(name)) == bytes, "post-write-integrity") }
            current.state = .skillInstalledInSimulation
            current.message = "已写入合成 DSH Home；真实 DSH 未安装、未发现或调用验证。"
            try save(current)
            // Retain backup for explicit recovery/inspection; never silently delete user data.
            return current
        } catch {
            do {
                if newMoved { try fm.removeItem(at: dest) }
                if oldMoved { try fm.moveItem(at: backup, to: dest) }
                current.state = .failed; current.message = "安装失败；已恢复原合成目录。需要新请求重新确认。"
                try save(current)
            } catch {
                current.state = .recoveryRequired; current.message = "恢复未确认，禁止显示成功。保留事务目录供检查。"
                try? save(current)
            }
            throw error
        }
    }

    /// Read-only recovery classification after loss of the in-memory installer.
    /// Never infer completion from files, rerun an install, or reuse approval.
    public func recover(_ request: InstallRequest) throws -> Receipt? {
        guard var current = try receipt(for: request) else { return nil }
        if [.staging, .applying].contains(current.state) {
            current.state = .recoveryRequired
            current.message = "上次操作中断，结果未知；保留暂存/备份，未自动重试。"
            try save(current)
        }
        return current
    }
}
