import Foundation
import XCTest
@testable import InstallerCore
@testable import InstallerPresentation
import DemoFixtures

@MainActor private final class ObservedSession: InteractiveInstallSession {
    let core: CoreInstallSession
    var reviewCalls = 0, transferCalls = 0, applyCalls = 0, cleanupCalls = 0
    var rejectValidation = false, loseReply = false, cleanupFails = false, cleanupDelay = false
    var rootPath: String { core.rootPath }
    var plan: OfficialCLIPlan? { core.plan }
    init(_ core: CoreInstallSession) { self.core = core }
    func review(_ request: InstallRequest) async throws -> ReviewedDownload {
        reviewCalls += 1; return try await core.review(request)
    }
    func transfer(_ reviewed: ReviewedDownload) async throws -> DownloadedArchive {
        transferCalls += 1; return try await core.transfer(reviewed)
    }
    func validate(_ reviewed: ReviewedDownload, archive: DownloadedArchive) throws -> PreparedInstall {
        if rejectValidation { throw InstallerError.refused("test-archive-validation-failure") }
        return try core.validate(reviewed, archive: archive)
    }
    func apply(_ prepared: PreparedInstall) throws -> Receipt? {
        applyCalls += 1
        let result = try core.apply(prepared)
        return loseReply ? nil : result
    }
    func cleanup() async throws {
        cleanupCalls += 1
        if cleanupDelay { try await Task.sleep(for: .milliseconds(100)) }
        if cleanupFails { throw InstallerError.refused("test-cleanup-unconfirmed") }
        try await core.cleanup()
    }
}

@MainActor final class ViewModelTests: XCTestCase {
    private func session(_ scenario: DemoScenario) throws -> (DemoTransport, DownloadClient, ObservedSession) {
        let demo = try DemoURLProtocol.install(scenario)
        let client = try DownloadClient(trust: demo.fixture.trust, fixtureProtocol: DemoURLProtocol.self)
        let observed = try ObservedSession(CoreInstallSession(client: client, trust: demo.fixture.trust))
        return (demo, client, observed)
    }
    func testProductionURLWithoutTrustIsRefusedWithoutSession() {
        let model = InstallerViewModel()
        let url = URL(string: "chengyuan-install://request?catalogID=chengyuan&packageID=chengyuan-study-demo&version=1.0.0&requestID=7fba698a-7349-4b98-a146-caf9471e3660")!
        model.receiveExternalURL(url)
        XCTAssertEqual(model.state, .refused)
        XCTAssertTrue(model.message.contains("网页提供的公钥"))
        XCTAssertNil(model.reviewed); XCTAssertTrue(model.rootPath.isEmpty)
        XCTAssertFalse(model.confirm())
    }
    func testProductionTrustCannotInjectFixtureProtocol() throws {
        let trust = try CatalogTrust(catalogID: "chengyuan", origin: URL(string: "https://catalog.example.invalid")!, publicKeys: [:])
        XCTAssertThrowsError(try DownloadClient(trust: trust, fixtureProtocol: DemoURLProtocol.self))
    }
    func testDuplicateBeginAndConfirmHaveOneDownloadAndApply() async throws {
        let (demo, _, session) = try session(.skill); defer { demo.close() }
        let model = InstallerViewModel()
        XCTAssertTrue(model.begin(demo.fixture.request, session: session))
        XCTAssertFalse(model.begin(demo.fixture.request, session: session))
        await model.waitForOperation()
        XCTAssertEqual(model.state, .awaitingConfirmation)
        XCTAssertEqual(session.transferCalls, 0)
        XCTAssertTrue(model.confirm()); XCTAssertFalse(model.confirm())
        await model.waitForOperation()
        XCTAssertEqual(session.reviewCalls, 1); XCTAssertEqual(session.transferCalls, 1); XCTAssertEqual(session.applyCalls, 1)
        XCTAssertEqual(model.state, .simulationComplete)
        XCTAssertTrue(model.message.contains("真实 DSH 未安装"))
        XCTAssertEqual(model.events, [.idle, .reviewing, .awaitingConfirmation, .downloading, .verifying, .applying, .simulationComplete])
        await model.cleanup()
        XCTAssertTrue(model.canStart); XCTAssertFalse(FileManager.default.fileExists(atPath: session.rootPath))
    }
    func testRefuseAtConfirmationDoesNotDownload() async throws {
        let (demo, _, session) = try session(.skill); defer { demo.close() }
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        model.cancel(); model.cancel()
        XCTAssertEqual(model.state, .cancelled); XCTAssertFalse(model.confirm())
        XCTAssertEqual(session.transferCalls, 0); XCTAssertEqual(session.applyCalls, 0)
        await model.cleanup()
    }
    func testCancelDuringDownloadWaitsForCleanup() async throws {
        let (demo, client, session) = try session(.slow); defer { demo.close() }
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        model.confirm()
        try await Task.sleep(for: .milliseconds(100))
        model.cancel()
        XCTAssertEqual(model.state, .cancelling); XCTAssertFalse(model.canCleanup)
        await model.waitForOperation()
        XCTAssertEqual(model.state, .cancelled); XCTAssertEqual(session.applyCalls, 0)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [])
        await model.cleanup()
    }
    func testSignatureRejectionNeverOffersConfirmation() async throws {
        let (demo, _, session) = try session(.signatureFailure); defer { demo.close() }
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        XCTAssertEqual(model.state, .failed); XCTAssertNil(model.reviewed)
        XCTAssertFalse(model.confirm()); XCTAssertEqual(session.transferCalls, 0)
        await model.cleanup()
    }
    func testDownloadAndHashFailuresNeverApply() async throws {
        for scenario in [DemoScenario.downloadFailure, .integrityFailure] {
            let (demo, client, session) = try session(scenario); defer { demo.close() }
            let model = InstallerViewModel()
            model.begin(demo.fixture.request, session: session); await model.waitForOperation()
            model.confirm(); await model.waitForOperation()
            XCTAssertEqual(model.state, .failed); XCTAssertEqual(session.applyCalls, 0)
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [])
            await model.cleanup()
        }
    }
    func testArchiveValidationFailureIsSeparateFromDownload() async throws {
        let (demo, _, session) = try session(.skill); defer { demo.close() }
        session.rejectValidation = true
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        model.confirm(); await model.waitForOperation()
        XCTAssertEqual(model.state, .failed); XCTAssertTrue(model.message.contains("归档校验"))
        XCTAssertEqual(session.applyCalls, 0)
        await model.cleanup()
    }
    func testLostCompletionReplyRemainsUnknownAndCannotRetry() async throws {
        let (demo, _, session) = try session(.skill); defer { demo.close() }
        session.loseReply = true
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        model.confirm(); await model.waitForOperation()
        XCTAssertEqual(model.state, .unknown); XCTAssertFalse(model.canStart); XCTAssertFalse(model.confirm())
        XCTAssertTrue(model.message.contains("不能报告可用"))
        await model.cleanup()
    }
    func testPluginUIIsOnlyPlanAndExecutionStillRefused() async throws {
        let (demo, _, session) = try session(.plugin); defer { demo.close() }
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation()
        model.confirm(); await model.waitForOperation()
        XCTAssertEqual(model.state, .pluginPlanOnly)
        XCTAssertThrowsError(try OfficialDesktopAdapter.execute(XCTUnwrap(model.plan)))
        XCTAssertTrue(model.message.contains("未安装、未启用"))
        await model.cleanup()
    }
    func testCleanupFailureRemainsUnknownAndRepeatedCleanupIsGuarded() async throws {
        let (demo, _, session) = try session(.skill); defer { demo.close() }
        let model = InstallerViewModel()
        model.begin(demo.fixture.request, session: session); await model.waitForOperation(); model.cancel()
        session.cleanupFails = true
        await model.cleanup()
        XCTAssertEqual(model.state, .unknown); XCTAssertFalse(model.canStart)
        session.cleanupFails = false; session.cleanupDelay = true
        let work = Task { await model.cleanup() }
        await Task.yield()
        XCTAssertFalse(model.canCleanup)
        await model.cleanup(); await work.value
        XCTAssertEqual(session.cleanupCalls, 2); XCTAssertEqual(model.state, .idle)
    }
    func testViewModelUsesRealLoopbackDownloadWithZIP() async throws {
        let server = try LoopbackFixture(); defer { server.stop() }
        let fixture = try archivedFixture("good-zip", origin: server.origin); try server.publish(fixture)
        let client = try DownloadClient(trust: fixture.trust)
        let session = try CoreInstallSession(client: client, trust: fixture.trust)
        let model = InstallerViewModel()
        model.begin(fixture.request, session: session); await model.waitForOperation()
        model.confirm(); await model.waitForOperation()
        XCTAssertEqual(model.state, .simulationComplete)
        await model.cleanup()
    }
}
