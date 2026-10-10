import Foundation
import AppKit

/// No public URL/path initializer. Only native panels create production choices.
public struct LocalPilotSelection {
    let app: URL
    let home: URL
    let package: URL
    let fixture: Bool
    private init(app: URL, home: URL, package: URL, fixture: Bool) {
        self.app = app; self.home = home; self.package = package; self.fixture = fixture
    }
    @MainActor public static func chooseLocally() -> Self? {
        func choose(_ title: String, directory: Bool) -> URL? {
            let panel = NSOpenPanel(); panel.title = title
            panel.canChooseDirectories = directory; panel.canChooseFiles = !directory
            panel.allowsMultipleSelection = false
            panel.treatsFilePackagesAsDirectories = directory
            return panel.runModal() == .OK ? panel.url : nil
        }
        guard let app = choose("选择官方 DeepSeek Harness.app（仅预检）", directory: true),
              let home = choose("选择已准备的独立试验 Home（不会创建或覆盖）", directory: true),
              let package = choose("选择固定版本学习教练 TGZ（仅本地校验）", directory: false) else { return nil }
        return Self(app: app, home: home, package: package, fixture: false)
    }
    static func isolated(app: URL, home: URL, package: URL) -> Self {
        Self(app: app, home: home, package: package, fixture: true)
    }
}

struct PreparedLocalTarget {
    let app: URL
    let home: URL
    let package: URL
    let identity: CLIIdentity
    let marker: Data
    let checker: any TargetStateChecking
    let verifier: any OfficialIdentityChecking
    let helperHash: String
    let fingerprint: String
    let fixture: Bool
    var executable: URL { app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh") }
}

public struct PilotReview: Equatable {
    public let target: String
    public let app: String
    public let officialIdentity: String
    public let source = "本地文件选择；预检不联网"
    public let package = "qcu-study-coach@0.1.0-pilot.1"
    public let packageHash: String
    public let helperHash: String
    public let fingerprint: String
    public let action = "仅安装；不选择 bundle、不启用 row、不重启、不调用模型"
}
public enum PilotExecutionResult { case installationVerified(String), unknown(String) }

public struct PilotAuthorization {
    let nonce: UUID
    let fingerprint: String
    let expiry: Date
}

/// Actual factory with immutable native selection. Injected checkers are INTERNAL
/// and accepted only for a fixture selection; no production override flag.
struct LocalTargetFactory {
    let fixtureVerifier: (any OfficialIdentityChecking)?
    let fixtureChecker: (any TargetStateChecking)?
    init() { fixtureVerifier = nil; fixtureChecker = nil }
    init(fixtureVerifier: any OfficialIdentityChecking, fixtureChecker: any TargetStateChecking) {
        self.fixtureVerifier = fixtureVerifier; self.fixtureChecker = fixtureChecker
    }
    func prepare(_ selected: LocalPilotSelection) throws -> PreparedLocalTarget {
        try require(selected.fixture == (fixtureVerifier != nil && fixtureChecker != nil), "selection-checker-mode-mismatch")
        for url in [selected.app, selected.home, selected.package] {
            try require(url.standardizedFileURL == url.resolvingSymlinksInPath(), "selected-target-symlink")
        }
        let verifier: any OfficialIdentityChecking = fixtureVerifier ?? MacOfficialIdentityChecker(app: selected.app)
        let executable = selected.app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh")
        let identity = try verifier.inspect(executable)
        try require(digest(try bounded(executable, limit: 131072)) == identity.executableHash, "selected-cli-bytes-changed")
        let attrs = try FileManager.default.attributesOfItem(atPath: selected.home.path)
        try require(attrs[.type] as? FileAttributeType == .typeDirectory && (attrs[.ownerAccountID] as? NSNumber)?.uint32Value == getuid() && ((attrs[.posixPermissions] as? NSNumber)?.intValue ?? 0) & 0o077 == 0, "independent-home-owner-or-permissions")
        try require(identity.version == "0.2.0-rc.2", "target-version")
        let bytes = try bounded(selected.package, limit: 3331)
        _ = try unpack(bytes, manifest: PilotPackage.manifest)
        let markerURL = selected.home.appendingPathComponent(".installer-owner")
        try require(markerURL.resolvingSymlinksInPath() == markerURL, "target-marker-symlink")
        let marker = try bounded(markerURL, limit: 1024)
        try require(!marker.isEmpty, "independent-home-marker-required")
        if !selected.fixture { try validateProductionHomeMarker(marker) }
        var pins: [String: String] = [:]
        for name in ["cordis.patch.yml", "profiles/desktop/cordis.patch.yml"] {
            let url = selected.home.appendingPathComponent(name)
            try require(url.resolvingSymlinksInPath() == url, "target-config-symlink")
            pins[name] = digest(try bounded(url, limit: 131072))
        }
        let checker: any TargetStateChecking = fixtureChecker ?? OfficialProfileChecker(home: selected.home, app: selected.app, ownerMarker: marker, configurationPins: pins, packageID: "qcu-study-coach", version: "0.1.0-pilot.1", archiveHash: PilotPackage.hash, files: PilotPackage.files.map { FileRecord(path: String($0.path.dropFirst(8)), sha256: $0.sha256, bytes: $0.bytes) })
        // Unknown process errors propagate unchanged, before issuing a review.
        try require(try checker.isIdle(home: selected.home), "target-running")
        try require(try !checker.packagePresent(home: selected.home), "same-package-present")
        guard let helper = Bundle.main.executableURL else { throw InstallerError.refused("helper-identity-unavailable") }
        let helperHash = digest(try bounded(helper, limit: 64 * 1024 * 1024))
        let fields = [selected.app.path, selected.home.path, selected.package.path, identity.version,
                      identity.signingIdentity, identity.executableHash, digest(marker), PilotPackage.hash, helperHash] + pins.sorted { $0.key < $1.key }.map { $0.key + ":" + $0.value }
        let fingerprint = digest(try JSONEncoder().encode(fields))
        return PreparedLocalTarget(app: selected.app, home: selected.home, package: selected.package, identity: identity,
                                   marker: marker, checker: checker, verifier: verifier, helperHash: helperHash,
                                   fingerprint: fingerprint, fixture: selected.fixture)
    }
}

@MainActor public final class LocalPilotSession {
    private let factory: LocalTargetFactory
    private var selection: LocalPilotSelection?
    private var target: PreparedLocalTarget?
    private var authorization: PilotAuthorization?
    private var used = false
    // Test-only closure cannot be supplied through any public initializer.
    private let fixtureExecution: ((PreparedLocalTarget) throws -> PilotExecutionResult)?
    public init() { factory = LocalTargetFactory(); fixtureExecution = nil }
    init(factory: LocalTargetFactory, fixtureExecution: @escaping (PreparedLocalTarget) throws -> PilotExecutionResult) {
        self.factory = factory; self.fixtureExecution = fixtureExecution
    }
    public var executionEnabled: Bool {
        guard let target else { return false }
        return target.fixture ? fixtureExecution != nil : ProductionInstallGate.executionEnabled
    }
    public func prepare(_ selection: LocalPilotSelection) throws -> PilotReview {
        try require(!used, "session-already-used")
        authorization = nil; target = nil; self.selection = nil
        let prepared = try factory.prepare(selection)
        self.selection = selection; target = prepared
        return PilotReview(target: prepared.home.path, app: prepared.app.path, officialIdentity: prepared.identity.signingIdentity + " / " + prepared.identity.version, packageHash: PilotPackage.hash, helperHash: prepared.helperHash, fingerprint: prepared.fingerprint)
    }
    public func confirm(_ review: PilotReview) throws -> PilotAuthorization {
        guard let selection, let target else { throw InstallerError.refused("no-verified-target") }
        let current = try factory.prepare(selection)
        try require(!used && review.fingerprint == target.fingerprint && current.fingerprint == target.fingerprint, "review-or-target-changed")
        if !executionEnabled { try ProductionInstallGate.authorize() }
        let token = PilotAuthorization(nonce: UUID(), fingerprint: current.fingerprint, expiry: Date().addingTimeInterval(300))
        authorization = token; return token
    }
    public func execute(_ token: PilotAuthorization) throws -> PilotExecutionResult {
        guard let selection, let target, let issued = authorization else { throw InstallerError.refused("no-authorization") }
        try require(!used && token.nonce == issued.nonce && token.fingerprint == target.fingerprint && token.expiry == issued.expiry && token.expiry > Date(), "invalid-or-used-authorization")
        // Consume before revalidation as well: an unknown process revokes this attempt.
        used = true; authorization = nil
        let current = try factory.prepare(selection)
        try require(current.fingerprint == target.fingerprint, "target-changed-after-confirmation")
        if current.fixture {
            guard let fixtureExecution else { throw InstallerError.refused("fixture-executor-unavailable") }
            return try fixtureExecution(current)
        }
        try ProductionInstallGate.authorize()
        let adapter = try IsolatedCLIAdapter(localTarget: current)
        let result = try adapter.run(adapter.confirmLocally())
        return result.state == .verifiedInstallationOnly ? .installationVerified("安装文件已核验；未启用、未验证技能调用") : .unknown("结果未知：" + result.code)
    }
    public func cancel() { authorization = nil; target = nil; selection = nil; used = true }
}

// An existing arbitrary/default Home cannot be adopted merely by adding text.
// Provisioning this marker is a separate approved preparation action, not here.
func validateProductionHomeMarker(_ data: Data) throws {
    let value = try object(data, keys: ["schema", "purpose", "profile", "homeID"])
    try require(value["schema"] as? Int == 1 && value["purpose"] as? String == "chengyuan-official-desktop-pilot" && value["profile"] as? String == "desktop", "independent-home-purpose-mismatch")
    guard let id = value["homeID"] as? String, UUID(uuidString: id) != nil else { throw InstallerError.refused("independent-home-id-required") }
}
