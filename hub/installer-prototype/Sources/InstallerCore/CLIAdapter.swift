import Foundation
import Darwin
import NativeProcess

/// Public entry point remains closed. No bool, URL, environment variable or
/// test flag can mint production authorization in this build.
public enum ProductionInstallGate {
    public static var executionEnabled: Bool { false } // Build policy, never an env/UI flag.
    public static var blockingReason: String { "production-execution-not-enabled" }
    public static func authorize() throws { try require(executionEnabled, blockingReason) }
}

// Internal integration seams. Only @testable fixtures currently construct these.
// A production verifier must independently inspect the official signing identity,
// runtime version and every executable resource; caller claims are not evidence.
struct CLIIdentity: Equatable {
    let version: String
    let signingIdentity: String
    let executableHash: String
}
protocol OfficialIdentityChecking {
    func inspect(_ executable: URL) throws -> CLIIdentity
}
protocol TargetStateChecking {
    /// Must positively establish that the exact Home/profile is not in use.
    func isIdle(home: URL) throws -> Bool
    func packagePresent(home: URL) throws -> Bool
    /// Must verify exact package files/version and that row remains disabled.
    func verifyInstalled(home: URL, packageHash: String) throws -> Bool
}
struct CLITransaction: Codable {
    enum State: String, Codable { case prepared, applying, verifiedInstallationOnly, unknown }
    let id: String
    let packageHash: String
    var state: State
    var code: String
}
struct BoundCLIConsent {
    let nonce: UUID
    let target: String
    let packageHash: String
    let executableHash: String
    let expires: Date
}

/// Deliberately inaccessible to the UI/public API: isolated integration harness.
/// It cannot adopt an arbitrary Home; all inputs are children of a freshly owned
/// SimulationEnvironment. It never infers that a skill is loaded/callable.
final class IsolatedCLIAdapter {
    private let workspace: URL
    private let home: URL
    private let officialApp: URL?
    private let executable: URL
    private let package: URL
    private let expected: CLIIdentity
    private let packageHash: String
    private let identity: any OfficialIdentityChecking
    private let state: any TargetStateChecking
    private let marker: Data
    private var consumed = false
    private var issuedNonce: UUID?
    private let journal: URL
    private let lock: URL
    init(environment: SimulationEnvironment, executable: URL, package: URL,
         expected: CLIIdentity, packageHash: String,
         identity: any OfficialIdentityChecking, state: any TargetStateChecking) throws {
        self.workspace = environment.root; self.home = environment.home; self.officialApp = nil
        self.executable = executable; self.package = package
        self.expected = expected; self.packageHash = packageHash; self.identity = identity; self.state = state
        marker = Data(UUID().uuidString.utf8)
        journal = environment.root.appendingPathComponent("cli-transaction.json")
        lock = environment.root.appendingPathComponent("cli-operation.lock")
        try safe(executable); try safe(package); try safe(environment.home)
        try require(!FileManager.default.fileExists(atPath: journal.path), "existing-transaction")
        let owner = environment.home.appendingPathComponent(".installer-owner")
        try require(!FileManager.default.fileExists(atPath: owner.path), "existing-home-owner")
        try marker.write(to: owner, options: .withoutOverwriting)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: owner.path)
    }
    /// Production path is fully wired but cannot be reached while the public
    /// gate is closed. No fixture can use this constructor to adopt a real Home.
    init(localTarget target: PreparedLocalTarget) throws {
        try require(!target.fixture, "fixture-cannot-adopt-production-target")
        try ProductionInstallGate.authorize()
        home = target.home; officialApp = target.app; executable = target.executable
        workspace = FileManager.default.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent("qcu-local-pilot-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        package = workspace.appendingPathComponent("reviewed.tgz")
        let bytes = try bounded(target.package, limit: 3331)
        try require(digest(bytes) == PilotPackage.hash, "package-changed-before-staging")
        try bytes.write(to: package, options: .withoutOverwriting)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: package.path)
        expected = target.identity; packageHash = PilotPackage.hash
        identity = target.verifier; state = target.checker; marker = target.marker
        journal = workspace.appendingPathComponent("cli-transaction.json")
        lock = home.appendingPathComponent(".installer-operation.lock")
    }
    private func safe(_ url: URL) throws {
        if let officialApp, url == executable {
            try require(url.path.hasPrefix(officialApp.path + "/") && url.resolvingSymlinksInPath() == url, "official-executable-location")
            return
        }
        let root = (url == home || url.path.hasPrefix(home.path + "/")) ? home : workspace
        try require(url == root || url.standardizedFileURL.path.hasPrefix(root.path + "/"), "outside-owned-target")
        var current = url
        while true {
            let a = try FileManager.default.attributesOfItem(atPath: current.path)
            try require(a[.type] as? FileAttributeType != .typeSymbolicLink, "target-symlink")
            try require((a[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(), "target-owner")
            if current == root { break }
            current.deleteLastPathComponent()
        }
    }
    private func preflight() throws {
        try safe(executable); try safe(package); try safe(home)
        let owner = home.appendingPathComponent(".installer-owner")
        try safe(owner)
        try require(try Data(contentsOf: owner) == marker, "home-marker-changed")
        try require(expected.version == "0.2.0-rc.2" && !expected.signingIdentity.isEmpty, "unsupported-official-identity")
        let observed = try identity.inspect(executable)
        try require(observed == expected, "official-identity-mismatch")
        try require(digest(try Data(contentsOf: executable)) == expected.executableHash, "cli-bytes-changed")
        try require(digest(try Data(contentsOf: package)) == packageHash, "package-bytes-changed")
        try require(try state.isIdle(home: home), "target-running-or-unknown")
        try require(try !state.packagePresent(home: home), "same-package-present")
    }
    func confirmLocally() throws -> BoundCLIConsent {
        try preflight()
        let nonce = UUID(); issuedNonce = nonce
        return BoundCLIConsent(nonce: nonce, target: home.path, packageHash: packageHash,
                               executableHash: expected.executableHash, expires: Date().addingTimeInterval(300))
    }
    private func save(_ value: CLITransaction) throws {
        try JSONEncoder().encode(value).write(to: journal, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: journal.path)
    }
    func recover() throws -> CLITransaction? {
        guard FileManager.default.fileExists(atPath: journal.path) else { return nil }
        try safe(journal)
        var value = try JSONDecoder().decode(CLITransaction.self, from: Data(contentsOf: journal))
        if value.state == .applying || value.state == .prepared {
            value.state = .unknown; value.code = "interrupted-no-automatic-retry"
            try save(value)
        }
        return value
    }
    func run(_ consent: BoundCLIConsent, timeout: TimeInterval = 2,
             cancelled: () -> Bool = { false }) throws -> CLITransaction {
        try require(!consumed && issuedNonce == consent.nonce && consent.target == home.path && consent.packageHash == packageHash
                    && consent.executableHash == expected.executableHash && consent.expires > Date(), "invalid-or-used-consent")
        try require(timeout > 0 && timeout <= 30, "timeout-range")
        try require(try recover() == nil, "transaction-exists-no-retry")
        try preflight()
        let fd = open(lock.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        try require(fd >= 0, "target-locked")
        close(fd)
        defer { try? FileManager.default.removeItem(at: lock) }
        consumed = true
        var result = CLITransaction(id: UUID().uuidString, packageHash: packageHash, state: .prepared, code: "prepared")
        try save(result)
        if cancelled() { result.state = .unknown; result.code = "cancelled-before-launch"; try save(result); return result }
        try preflight()
        result.state = .applying; result.code = "applying"; try save(result)
        let arguments = [executable.path, "plugin", "--profile", "desktop", "add", package.path]
        let env = ["HOME=" + home.path, "DSH_HOME=" + home.path,
                   "DSH_AGENTS_HOME=" + home.appendingPathComponent("agents").path,
                   "PATH=/usr/bin:/bin", "LANG=C", "TMPDIR=" + workspace.path]
        var argv = arguments.map { strdup($0) } + [nil]
        var envp = env.map { strdup($0) } + [nil]
        defer { argv.forEach { free($0) }; envp.forEach { free($0) } }
        var child = owned_child()
        let launch = argv.withUnsafeMutableBufferPointer { args in
            envp.withUnsafeMutableBufferPointer { vars in
                owned_spawn(executable.path, args.baseAddress, vars.baseAddress, workspace.path, &child)
            }
        }
        if launch != 0 { result.state = .unknown; result.code = "launch-failed"; try save(result); return result }
        var count = 0
        var bytes = [UInt8](repeating: 0, count: 4096)
        let deadline = ProcessInfo.processInfo.systemUptime + timeout
        var failure: String?
        repeat {
            let n = read(child.output, &bytes, bytes.count)
            if n > 0 { count += n }
            if count > 16384 { failure = "output-limit" }
            if cancelled() { failure = "cancelled-after-launch" }
            if ProcessInfo.processInfo.systemUptime >= deadline { failure = "timeout" }
            let exited = owned_exited(&child)
            if exited < 0 { failure = "child-state-unknown" }
            if failure != nil || (exited == 1 && n <= 0) { break }
            Thread.sleep(forTimeInterval: 0.005)
        } while true
        var exitStatus: Int32 = -1
        if owned_finish(&child, &exitStatus) != 0 {
            failure = "process-group-cleanup-unconfirmed"
            if child.output >= 0 { close(child.output) }
        }
        result.state = .unknown
        result.code = failure ?? (exitStatus == 0 ? "verification-required" : "cli-failed")
        if failure == nil && exitStatus == 0 {
            do {
                try safe(home)
                if try state.verifyInstalled(home: home, packageHash: packageHash) {
                    result.state = .verifiedInstallationOnly; result.code = "fixture-installation-verified-not-loaded"
                }
            } catch { result.code = "verification-failed" }
        }
        try save(result)
        return result
    }
}
