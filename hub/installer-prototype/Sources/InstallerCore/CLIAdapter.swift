import Foundation
import Darwin

/// Public entry point remains closed. No bool, URL, environment variable or
/// test flag can mint production authorization in this build.
public enum ProductionInstallGate {
    public static var blockingReason: String { "production-authorization-and-official-verifier-not-configured" }
    public static func authorize() throws { throw InstallerError.refused(blockingReason) }
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
    private let environment: SimulationEnvironment
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
        self.environment = environment; self.executable = executable; self.package = package
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
    private func safe(_ url: URL) throws {
        try require(url.standardizedFileURL.path.hasPrefix(environment.root.path + "/"), "outside-owned-target")
        var current = url
        while current.path != environment.root.deletingLastPathComponent().path {
            let a = try FileManager.default.attributesOfItem(atPath: current.path)
            try require(a[.type] as? FileAttributeType != .typeSymbolicLink, "target-symlink")
            try require((a[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(), "target-owner")
            if current == environment.root { break }
            current.deleteLastPathComponent()
        }
    }
    private func preflight() throws {
        try safe(executable); try safe(package); try safe(environment.home)
        let owner = environment.home.appendingPathComponent(".installer-owner")
        try safe(owner)
        try require(try Data(contentsOf: owner) == marker, "home-marker-changed")
        try require(expected.version == "0.2.0-rc.2" && !expected.signingIdentity.isEmpty, "unsupported-official-identity")
        let observed = try identity.inspect(executable)
        try require(observed == expected, "official-identity-mismatch")
        try require(digest(try Data(contentsOf: executable)) == expected.executableHash, "cli-bytes-changed")
        try require(digest(try Data(contentsOf: package)) == packageHash, "package-bytes-changed")
        try require(try state.isIdle(home: environment.home), "target-running-or-unknown")
        try require(try !state.packagePresent(home: environment.home), "same-package-present")
    }
    func confirmLocally() throws -> BoundCLIConsent {
        try preflight()
        let nonce = UUID(); issuedNonce = nonce
        return BoundCLIConsent(nonce: nonce, target: environment.home.path, packageHash: packageHash,
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
        try require(!consumed && issuedNonce == consent.nonce && consent.target == environment.home.path && consent.packageHash == packageHash
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
        let process = Process()
        process.executableURL = executable
        process.arguments = ["plugin", "--profile", "desktop", "add", package.path]
        process.environment = ["HOME": environment.home.path, "DSH_HOME": environment.home.path,
                               "DSH_AGENTS_HOME": environment.home.appendingPathComponent("agents").path,
                               "PATH": "/usr/bin:/bin", "LANG": "C", "TMPDIR": environment.root.path]
        process.currentDirectoryURL = environment.root
        process.standardInput = FileHandle.nullDevice
        let output = Pipe()
        process.standardOutput = output; process.standardError = output
        let readFD = output.fileHandleForReading.fileDescriptor
        _ = fcntl(readFD, F_SETFL, O_NONBLOCK)
        defer { try? output.fileHandleForReading.close(); try? output.fileHandleForWriting.close() }
        do { try process.run() } catch {
            result.state = .unknown; result.code = "launch-failed"; try save(result); return result
        }
        // Never retain or publish child output: stronger than regex redaction.
        var count = 0
        var bytes = [UInt8](repeating: 0, count: 4096)
        let deadline = Date().addingTimeInterval(timeout)
        var failure: String?
        repeat {
            let n = read(readFD, &bytes, bytes.count)
            if n > 0 { count += n }
            if count > 16384 { failure = "output-limit" }
            if cancelled() { failure = "cancelled-after-launch" }
            if Date() >= deadline { failure = "timeout" }
            if failure != nil && process.isRunning {
                // Only the child launched here; never a DSH instance/profile.
                process.terminate()
                let grace = Date().addingTimeInterval(0.2)
                while process.isRunning && Date() < grace { Thread.sleep(forTimeInterval: 0.01) }
                if process.isRunning { kill(process.processIdentifier, SIGKILL) }
            }
            if !process.isRunning && (n <= 0 || failure != nil) { break }
            Thread.sleep(forTimeInterval: 0.005)
        } while true
        process.waitUntilExit()
        result.state = .unknown
        result.code = failure ?? (process.terminationStatus == 0 ? "verification-required" : "cli-failed")
        if failure == nil && process.terminationStatus == 0 {
            do {
                try safe(environment.home)
                if try state.verifyInstalled(home: environment.home, packageHash: packageHash) {
                    result.state = .verifiedInstallationOnly; result.code = "fixture-installation-verified-not-loaded"
                }
            } catch { result.code = "verification-failed" }
        }
        try save(result)
        return result
    }
}
