import XCTest
@testable import InstallerCore

private struct FixtureIdentity: OfficialIdentityChecking {
    let value: CLIIdentity
    func inspect(_ executable: URL) throws -> CLIIdentity { value }
}
private final class FixtureState: TargetStateChecking {
    var idle = true; var present = false; var verified = true
    func isIdle(home: URL) throws -> Bool { idle }
    func packagePresent(home: URL) throws -> Bool { present }
    func verifyInstalled(home: URL, packageHash: String) throws -> Bool {
        verified && (try? String(contentsOf: home.appendingPathComponent("fixture-installed"), encoding: .utf8)) == "disabled"
    }
}
final class CLIAdapterTests: XCTestCase {
    private func fixture(_ body: String = "open(os.environ['DSH_HOME']+'/fixture-installed','w').write('disabled')") throws -> (SimulationEnvironment, IsolatedCLIAdapter, FixtureState) {
        let env = try SimulationEnvironment()
        let cli = env.root.appendingPathComponent("fixture-cli")
        let code = "#!/usr/bin/python3\nimport os,sys,time\nassert sys.argv[1:5] == ['plugin','--profile','desktop','add']\nassert 'API_KEY' not in os.environ\n" + body + "\n"
        try Data(code.utf8).write(to: cli)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cli.path)
        let package = env.root.appendingPathComponent("approved.tgz")
        try Data("fixed-package".utf8).write(to: package)
        let identity = CLIIdentity(version: "0.2.0-rc.2", signingIdentity: "fixture-not-official", executableHash: digest(Data(code.utf8)))
        let state = FixtureState()
        let adapter = try IsolatedCLIAdapter(environment: env, executable: cli, package: package,
            expected: identity, packageHash: digest(Data("fixed-package".utf8)), identity: FixtureIdentity(value: identity), state: state)
        return (env, adapter, state)
    }
    func testProductionHasNoAuthorizationFactory() {
        XCTAssertThrowsError(try ProductionInstallGate.authorize())
    }
    func testBoundFixtureExecutionAndNoRepeat() throws {
        let (env, adapter, _) = try fixture(); defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        let result = try adapter.run(consent)
        XCTAssertEqual(result.state, .verifiedInstallationOnly)
        XCTAssertThrowsError(try adapter.run(consent))
    }
    func testBusyAndSamePackageRefused() throws {
        let (env, adapter, state) = try fixture(); defer { try? env.removeSimulation() }
        state.idle = false; XCTAssertThrowsError(try adapter.confirmLocally())
        state.idle = true; state.present = true; XCTAssertThrowsError(try adapter.confirmLocally())
        state.present = false
        let consent = try adapter.confirmLocally(); state.idle = false
        XCTAssertThrowsError(try adapter.run(consent))
    }
    func testChangedCLIAndHomeMarkerRefused() throws {
        let (env, adapter, _) = try fixture(); defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        try Data("changed".utf8).write(to: env.root.appendingPathComponent("fixture-cli"))
        XCTAssertThrowsError(try adapter.run(consent))
        try Data("foreign".utf8).write(to: env.home.appendingPathComponent(".installer-owner"))
        XCTAssertThrowsError(try adapter.confirmLocally())
    }
    func testExitZeroWithoutEvidenceIsUnknown() throws {
        let (env, adapter, _) = try fixture("pass"); defer { try? env.removeSimulation() }
        let result = try adapter.run(adapter.confirmLocally())
        XCTAssertEqual(result.state, .unknown)
        XCTAssertEqual(result.code, "verification-required")
    }
    func testTimeoutCancellationAndOutputLimitNeverLeakOutput() throws {
        for (body, expected) in [("time.sleep(10)", "timeout"), ("print('SECRET_TOKEN'*20000)", "output-limit"), ("sys.exit(9)", "cli-failed")] {
            let (env, adapter, _) = try fixture(body); defer { try? env.removeSimulation() }
            let result = try adapter.run(adapter.confirmLocally(), timeout: body.contains("sleep") ? 0.15 : 2)
            XCTAssertEqual(result.state, .unknown); XCTAssertEqual(result.code, expected)
            let journal = try String(contentsOf: env.root.appendingPathComponent("cli-transaction.json"), encoding: .utf8)
            XCTAssertFalse(journal.contains("SECRET_TOKEN"))
        }
        let (env, adapter, _) = try fixture("time.sleep(10)"); defer { try? env.removeSimulation() }
        var polls = 0
        let result = try adapter.run(adapter.confirmLocally(), cancelled: { polls += 1; return polls > 2 })
        XCTAssertEqual(result.code, "cancelled-after-launch")
    }
    func testInterruptedRecoveryDoesNotReplay() throws {
        let (env, adapter, _) = try fixture(); defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        let interrupted = CLITransaction(id: UUID().uuidString, packageHash: "fixed", state: .applying, code: "applying")
        try JSONEncoder().encode(interrupted).write(to: env.root.appendingPathComponent("cli-transaction.json"))
        XCTAssertEqual(try adapter.recover()?.state, .unknown)
        XCTAssertThrowsError(try adapter.run(consent))
    }
    func testChangedPackageAndExpiredConsentRefused() throws {
        let (env, adapter, _) = try fixture(); defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        let expired = BoundCLIConsent(nonce: consent.nonce, target: consent.target, packageHash: consent.packageHash, executableHash: consent.executableHash, expires: .distantPast)
        XCTAssertThrowsError(try adapter.run(expired))
        try Data("tampered".utf8).write(to: env.root.appendingPathComponent("approved.tgz"))
        XCTAssertThrowsError(try adapter.run(consent))
    }
    func testSymlinkLockAndEnabledResultRefused() throws {
        let (env, adapter, _) = try fixture("open(os.environ['DSH_HOME']+'/fixture-installed','w').write('enabled')")
        defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        let lock = env.root.appendingPathComponent("cli-operation.lock")
        try Data().write(to: lock)
        XCTAssertThrowsError(try adapter.run(consent))
        try FileManager.default.removeItem(at: lock)
        XCTAssertEqual(try adapter.run(consent).state, .unknown)
        let (env2, adapter2, _) = try fixture(); defer { try? env2.removeSimulation() }
        let package = env2.root.appendingPathComponent("approved.tgz")
        try FileManager.default.removeItem(at: package)
        try FileManager.default.createSymbolicLink(at: package, withDestinationURL: env2.root.appendingPathComponent("fixture-cli"))
        XCTAssertThrowsError(try adapter2.confirmLocally())
    }
    func testForgedNonceAndCrossTargetConsentRefused() throws {
        let (env, adapter, _) = try fixture(); defer { try? env.removeSimulation() }
        let consent = try adapter.confirmLocally()
        let forged = BoundCLIConsent(nonce: UUID(), target: consent.target, packageHash: consent.packageHash, executableHash: consent.executableHash, expires: consent.expires)
        XCTAssertThrowsError(try adapter.run(forged))
        let (other, adapter2, _) = try fixture(); defer { try? other.removeSimulation() }
        XCTAssertThrowsError(try adapter2.run(consent))
    }

}
