import XCTest
@testable import InstallerCore
@testable import InstallerPresentation

private struct LocalFixtureIdentity: OfficialIdentityChecking {
    let value: CLIIdentity
    func inspect(_ executable: URL) throws -> CLIIdentity { value }
}
private final class LocalFixtureState: TargetStateChecking {
    var unknown = false
    func isIdle(home: URL) throws -> Bool {
        if unknown { throw InstallerError.refused("process-inventory-unavailable--3") }
        return true
    }
    func packagePresent(home: URL) throws -> Bool { false }
    func verifyInstalled(home: URL, packageHash: String) throws -> Bool {
        (try? String(contentsOf: home.appendingPathComponent("fixture-result"), encoding: .utf8)) == "disabled"
    }
}
@MainActor final class LocalPilotTests: XCTestCase {
    private func make() throws -> (SimulationEnvironment, LocalPilotSelection, LocalPilotSession, LocalFixtureState) {
        let env = try SimulationEnvironment()
        let app = env.root.appendingPathComponent("Fixture.app")
        let cli = app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh")
        try FileManager.default.createDirectory(at: cli.deletingLastPathComponent(), withIntermediateDirectories: true)
        let source = Data("#!/usr/bin/python3\nimport os\nopen(os.environ['DSH_HOME']+'/fixture-result','w').write('disabled')\n".utf8)
        try source.write(to: cli); try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cli.path)
        let archive = Bundle.module.resourceURL!.appendingPathComponent("Fixtures/fixed-study-coach.fixture")
        let package = env.root.appendingPathComponent("reviewed.tgz")
        try FileManager.default.copyItem(at: archive, to: package)
        let profile = env.home.appendingPathComponent("profiles/desktop")
        try FileManager.default.createDirectory(at: profile, withIntermediateDirectories: true)
        for p in [env.home.appendingPathComponent("cordis.patch.yml"), profile.appendingPathComponent("cordis.patch.yml")] { try Data("[]".utf8).write(to: p) }
        let identity = LocalFixtureIdentity(value: CLIIdentity(version: "0.2.0-rc.2", signingIdentity: "fixture", executableHash: digest(source)))
        let state = LocalFixtureState()
        let adapter = try IsolatedCLIAdapter(environment: env, executable: cli, package: package, expected: identity.value, packageHash: PilotPackage.hash, identity: identity, state: state)
        let factory = LocalTargetFactory(fixtureVerifier: identity, fixtureChecker: state)
        let session = LocalPilotSession(factory: factory, fixtureExecution: { _ in
            let result = try adapter.run(adapter.confirmLocally())
            return result.state == .verifiedInstallationOnly ? .installationVerified("合成安装核验；未调用DSH") : .unknown(result.code)
        })
        return (env, .isolated(app: app, home: env.home, package: package), session, state)
    }
    func testFullNativeViewModelToFixedPackageAndFakeCLI() throws {
        let (env, selection, session, _) = try make(); defer { try? env.removeSimulation() }
        let model = PilotPreparationViewModel(session: session)
        model.prepare(selection); XCTAssertEqual(model.state, .reviewed)
        XCTAssertTrue(model.canConfirm)
        model.confirm(); XCTAssertEqual(model.state, .finished)
        XCTAssertFalse(model.canConfirm)
        model.confirm(); XCTAssertEqual(model.state, .finished)
    }
    func testUnknownProcessBlocksUIEvenWithFixtureExecutor() throws {
        let (env, selection, session, state) = try make(); defer { try? env.removeSimulation() }
        state.unknown = true
        let model = PilotPreparationViewModel(session: session)
        model.prepare(selection)
        XCTAssertEqual(model.state, .blocked); XCTAssertFalse(model.canConfirm)
        XCTAssertTrue(model.message.contains("process-inventory-unavailable"))
        model.confirm()
        XCTAssertFalse(FileManager.default.fileExists(atPath: env.home.appendingPathComponent("fixture-result").path))
    }
    func testBecomesUnknownAfterReviewStopsAtConfirmation() throws {
        let (env, selection, session, state) = try make(); defer { try? env.removeSimulation() }
        let model = PilotPreparationViewModel(session: session)
        model.prepare(selection); state.unknown = true; model.confirm()
        XCTAssertEqual(model.state, .blocked)
        XCTAssertFalse(FileManager.default.fileExists(atPath: env.home.appendingPathComponent("fixture-result").path))
    }
    func testAuthorizationExpiresCannotReplayOrCrossTarget() throws {
        let (env, selection, session, _) = try make(); defer { try? env.removeSimulation() }
        let review = try session.prepare(selection); let token = try session.confirm(review)
        let expired = PilotAuthorization(nonce: token.nonce, fingerprint: token.fingerprint, expiry: .distantPast)
        XCTAssertThrowsError(try session.execute(expired))
        _ = try session.execute(token)
        XCTAssertThrowsError(try session.execute(token))
        let (other, selection2, session2, _) = try make(); defer { try? other.removeSimulation() }
        _ = try session2.prepare(selection2)
        XCTAssertThrowsError(try session2.execute(token))
    }
    func testChangedConfigurationInvalidatesReviewAndCancellationRevokes() throws {
        let (env, selection, session, _) = try make(); defer { try? env.removeSimulation() }
        let review = try session.prepare(selection)
        try Data("[{}]".utf8).write(to: env.home.appendingPathComponent("cordis.patch.yml"))
        XCTAssertThrowsError(try session.confirm(review))
        session.cancel(); XCTAssertThrowsError(try session.prepare(selection))
    }
    func testProductionFactoryRejectsFixtureSelectionWithoutReadingApp() throws {
        let (env, selection, _, _) = try make(); defer { try? env.removeSimulation() }
        XCTAssertThrowsError(try LocalTargetFactory().prepare(selection))
        let model = PilotPreparationViewModel(); model.prepare(selection)
        XCTAssertEqual(model.state, .blocked); XCTAssertFalse(model.canConfirm)
        XCTAssertThrowsError(try ProductionInstallGate.authorize())
    }
    func testUnknownAfterAuthorizationRevokesAttemptEvenIfLaterIdle() throws {
        let (env, selection, session, state) = try make(); defer { try? env.removeSimulation() }
        let review = try session.prepare(selection); let token = try session.confirm(review)
        state.unknown = true; XCTAssertThrowsError(try session.execute(token))
        state.unknown = false; XCTAssertThrowsError(try session.execute(token))
        XCTAssertFalse(FileManager.default.fileExists(atPath: env.home.appendingPathComponent("fixture-result").path))
    }
    func testPackageAndCLITamperingBlockedBeforeAuthorization() throws {
        let (env, selection, session, _) = try make(); defer { try? env.removeSimulation() }
        let review = try session.prepare(selection)
        try Data("changed".utf8).write(to: selection.package)
        XCTAssertThrowsError(try session.confirm(review))
        let (other, selection2, session2, _) = try make(); defer { try? other.removeSimulation() }
        try Data("changed".utf8).write(to: selection2.app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh"))
        XCTAssertThrowsError(try session2.prepare(selection2))
    }

    func testProductionHomeMarkerMustHaveReviewedPurpose() throws {
        XCTAssertThrowsError(try validateProductionHomeMarker(Data("arbitrary".utf8)))
        let marker = try JSONSerialization.data(withJSONObject: ["schema": 1, "purpose": "chengyuan-official-desktop-pilot", "profile": "desktop", "homeID": UUID().uuidString])
        XCTAssertNoThrow(try validateProductionHomeMarker(marker))
        let wrong = try JSONSerialization.data(withJSONObject: ["schema": 1, "purpose": "default-home", "profile": "desktop", "homeID": UUID().uuidString])
        XCTAssertThrowsError(try validateProductionHomeMarker(wrong))
    }

}
