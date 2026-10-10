import XCTest
import Foundation
import CryptoKit
@testable import InstallerCore
import DemoFixtures

final class InstallerTests: XCTestCase {
    func withInstaller(_ fixture: Fixture, _ body: (Installer, SimulationEnvironment) throws -> Void) throws {
        let environment = try SimulationEnvironment()
        defer { try? environment.removeSimulation() }
        try body(Installer(environment: environment, trust: fixture.trust), environment)
    }
    func prepare(_ fixture: Fixture, _ installer: Installer) throws -> PreparedInstall {
        try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive)
    }
    func rejects(_ fixture: Fixture) throws {
        try withInstaller(fixture) { installer, environment in
            XCTAssertThrowsError(try prepare(fixture, installer))
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: environment.skills.path), [])
        }
    }
    func testRequestRejectsUnknownFieldsAndPathTraversal() throws {
        let fixture = try Fixtures.make()
        var json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(fixture.request)) as! [String: Any]
        json["command"] = "echo unsafe"
        XCTAssertThrowsError(try InstallRequest.parse(JSONSerialization.data(withJSONObject: json)))
        json.removeValue(forKey: "command"); json["packageID"] = "../../escape"
        XCTAssertThrowsError(try InstallRequest.parse(JSONSerialization.data(withJSONObject: json)))
    }
    func testOwnSchemeIsStrictAndNeverADSHInstallRoute() throws {
        let fixture = try Fixtures.make()
        let query = "catalogID=test-qcu&packageID=qcu-study-demo&version=0.1.0-test.1&requestID=\(fixture.request.requestID)"
        XCTAssertEqual(try InstallRequest.parseURL(URL(string: "qcu-install://request?\(query)")!), fixture.request)
        for url in ["chengyuan-install://request?\(query)", "dsh://install?\(query)", "qcu-install://request?\(query)&command=whoami", "qcu-install://request?\(query)&catalogID=other", "qcu-install://request:80?\(query)"] {
            XCTAssertThrowsError(try InstallRequest.parseURL(URL(string: url)!))
        }
    }
    func testBadSignatureRejected() throws {
        let fixture = try Fixtures.make()
        var envelope = try JSONSerialization.jsonObject(with: fixture.envelope) as! [String: Any]
        envelope["signature"] = Data(repeating: 0, count: 64).base64EncodedString()
        try withInstaller(fixture) { installer, _ in
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: JSONSerialization.data(withJSONObject: envelope), archive: fixture.archive))
        }
    }
    func testUnknownKeyAndEmptyProductionTrustFailClosed() throws {
        let fixture = try Fixtures.make()
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let noKeys = try CatalogTrust(catalogID: "test-qcu", origin: fixture.trust.origin, publicKeys: [:], fixtureOnly: true)
        XCTAssertThrowsError(try prepare(fixture, Installer(environment: env, trust: noKeys)))
        XCTAssertThrowsError(try CatalogTrust(catalogID: "qcu", origin: fixture.trust.origin, publicKeys: fixture.trust.publicKeys))
        let production = try CatalogTrust(catalogID: "qcu", origin: fixture.trust.origin, publicKeys: [:])
        XCTAssertTrue(production.publicKeys.isEmpty)
        XCTAssertThrowsError(try prepare(fixture, Installer(environment: env, trust: production)))
    }
    func testExpiredAndWrongIdentityAndRuntimeRejected() throws {
        for change: (inout [String: Any]) -> Void in [
            { $0["expiresAt"] = 1 }, { $0["catalogID"] = "other" }, { $0["version"] = "9.0.0" },
            { $0["dshVersion"] = "latest" }, { $0["extra"] = true },
        ] { try rejects(Fixtures.make(mutate: change)) }
    }
    func testUnsignedManifestRefused() throws {
        let fixture = try Fixtures.make()
        let envelope = try JSONDecoder().decode(SignedEnvelope.self, from: fixture.envelope)
        try withInstaller(fixture) { installer, _ in
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: Data(base64Encoded: envelope.payload)!, archive: fixture.archive))
        }
    }
    func testDependencyAndScriptDeclarationsRejected() throws {
        try rejects(Fixtures.make(mutate: { $0["dependencies"] = ["other@1.0.0"] }))
        try rejects(Fixtures.make(mutate: { $0["installScripts"] = true }))
    }
    func testOriginAndImmutableFilenameAreBound() throws {
        try rejects(Fixtures.make(mutate: { $0["archiveURL"] = "https://attacker.example/package.tar" }))
        try rejects(Fixtures.make(mutate: { $0["archiveURL"] = "https://catalog.example.invalid/packages/latest.tar" }))
        let fixture = try Fixtures.make()
        try withInstaller(fixture) { installer, _ in
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: fixture.envelope,
                archive: DownloadedArchive(source: URL(string: "https://attacker.example/archive.tar")!, bytes: fixture.archive.bytes)))
        }
    }
    func testArchiveTamperingRejected() throws {
        let fixture = try Fixtures.make()
        var bytes = fixture.archive.bytes; bytes[513] ^= 1
        try withInstaller(fixture) { installer, _ in
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: fixture.envelope,
                archive: DownloadedArchive(source: fixture.archive.source, bytes: bytes)))
        }
    }
    func testTraversalAbsoluteAndCaseCollisionRejectedBeforeWriting() throws {
        for path in ["../outside.md", "/outside.md", "a/../outside.md", "a//x.md", "a\\x.md"] {
            try rejects(Fixtures.make(files: [path: Data("test".utf8)]))
        }
        try rejects(Fixtures.make(files: ["SKILL.md": Data(), "skill.md": Data()]))
    }
    func testLinksDevicesDirectoriesAndExtensionsRejected() throws {
        for type: UInt8 in [49, 50, 51, 52, 53, 54, 76, 120] {
            try rejects(Fixtures.make(entryType: type))
        }
        try rejects(Fixtures.make(mode: 0o755))
        try rejects(Fixtures.make(mode: 0o4600))
    }
    func testArchiveAndExpandedLimitsRejected() throws {
        try rejects(Fixtures.make(mutate: { $0["bytes"] = 8 * 1024 * 1024 + 1 }))
        try rejects(Fixtures.make(files: ["SKILL.md": Data(repeating: 65, count: 1024 * 1024 + 1)]))
        let many = Dictionary(uniqueKeysWithValues: (0..<101).map { ("file\($0).md", Data()) })
        try rejects(Fixtures.make(files: many))
    }
    func testTarChecksumAndMissingTerminatorRejectedEvenWhenSigned() throws {
        let fixture = try Fixtures.make()
        let parsed = try JSONDecoder().decode(SignedEnvelope.self, from: fixture.envelope)
        for mode in 0..<2 {
            var bytes = fixture.archive.bytes
            if mode == 0 { bytes[148] = 55 } else { bytes.removeLast(1024) }
            var manifest = try JSONSerialization.jsonObject(with: Data(base64Encoded: parsed.payload)!) as! [String: Any]
            let url = "https://catalog.example.invalid/packages/\(fixture.request.packageID)-\(fixture.request.version)-\(digest(bytes)).tar"
            manifest["sha256"] = digest(bytes); manifest["bytes"] = bytes.count; manifest["archiveURL"] = url
            try withInstaller(fixture) { installer, _ in
                XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: Fixtures.signed(manifest),
                    archive: DownloadedArchive(source: URL(string: url)!, bytes: bytes)))
            }
        }
    }
    func testTextSkillRejectsScriptsAndMismatchedFrontmatter() throws {
        try rejects(Fixtures.make(files: ["SKILL.md": Data("---\nname: other\n---\n".utf8)]))
        try rejects(Fixtures.make(files: ["run.js": Data("throw 1".utf8)]))
    }
    func testConfirmationRequiredAndSimulationOnlyInstall() throws {
        let fixture = try Fixtures.make()
        try withInstaller(fixture) { installer, env in
            let prepared = try prepare(fixture, installer)
            XCTAssertEqual(try installer.receipt(for: fixture.request)?.state, .awaitingConfirmation)
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: env.skills.path), [])
            let permission = try installer.confirmFromLocalUser(prepared)
            let result = try installer.install(prepared, confirmation: permission)
            XCTAssertEqual(result.state, .skillInstalledInSimulation)
            XCTAssertTrue(FileManager.default.fileExists(atPath: env.skills.appendingPathComponent(fixture.request.packageID + "/SKILL.md").path))
            XCTAssertTrue(env.home.path.contains("qcu-INSTALLER-SIMULATION-"))
            XCTAssertEqual(try installer.install(prepared, confirmation: permission).state, result.state)
        }
    }
    func testConfirmationCannotAuthorizeDifferentRequest() throws {
        let fixture = try Fixtures.make()
        let other = try Fixtures.make()
        try withInstaller(fixture) { installer, _ in
            let first = try prepare(fixture, installer), second = try prepare(other, installer)
            let approval = try installer.confirmFromLocalUser(first)
            XCTAssertThrowsError(try installer.install(second, confirmation: approval))
        }
    }
    func testConfirmationExpiresAndNotPersistedAcrossCoreRestart() throws {
        let fixture = try Fixtures.make()
        let environment = try SimulationEnvironment(); defer { try? environment.removeSimulation() }
        var now = Date()
        let installer = Installer(environment: environment, trust: fixture.trust, clock: { now })
        let prepared = try prepare(fixture, installer)
        let approval = try installer.confirmFromLocalUser(prepared)
        now = now.addingTimeInterval(301)
        XCTAssertThrowsError(try installer.install(prepared, confirmation: approval))
        let next = Installer(environment: environment, trust: fixture.trust)
        XCTAssertThrowsError(try next.install(prepared, confirmation: approval))
    }
    func testCancelIsTerminalAndIdempotent() throws {
        let fixture = try Fixtures.make()
        try withInstaller(fixture) { installer, env in
            let prepared = try prepare(fixture, installer)
            let approval = try installer.confirmFromLocalUser(prepared)
            XCTAssertEqual(try installer.cancel(prepared).state, .cancelled)
            XCTAssertEqual(try installer.cancel(prepared).state, .cancelled)
            XCTAssertEqual(try installer.install(prepared, confirmation: approval).state, .cancelled)
            XCTAssertThrowsError(try installer.confirmFromLocalUser(prepared))
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: env.skills.path), [])
        }
    }
    func testSameVersionCannotChangeContentEvenWithNewValidSignature() throws {
        let fixture = try Fixtures.make()
        let alternate = try Fixtures.make(files: ["SKILL.md": Data("---\nname: qcu-study-demo\n---\nChanged\n".utf8)])
        try withInstaller(fixture) { installer, _ in
            _ = try prepare(fixture, installer)
            XCTAssertThrowsError(try prepare(alternate, installer))
        }
    }
    func testRequestIDCannotChangeManifest() throws {
        let fixture = try Fixtures.make()
        let alternate = try Fixtures.make(requestID: fixture.request.requestID, mutate: { $0["title"] = "Different disclosure" })
        try withInstaller(fixture) { installer, _ in
            _ = try prepare(fixture, installer)
            XCTAssertThrowsError(try prepare(alternate, installer))
        }
    }
    func testPluginIsPlanOnlyAndRetainsDisabledRow() throws {
        let fixture = try Fixtures.make(kind: .plugin)
        try withInstaller(fixture) { installer, env in
            let prepared = try prepare(fixture, installer)
            let receipt = try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared))
            XCTAssertEqual(receipt.state, .pluginPlanOnly)
            let plan = try XCTUnwrap(installer.lastPlan)
            XCTAssertEqual(Array(plan.arguments.prefix(4)), ["plugin", "--profile", "desktop", "add"])
            XCTAssertTrue(plan.arguments[4].hasPrefix(env.root.path))
            XCTAssertThrowsError(try OfficialDesktopAdapter.execute(plan))
            let patch = URL(fileURLWithPath: plan.arguments[4]).appendingPathComponent("cordis.patch.yml")
            XCTAssertTrue(try String(contentsOf: patch, encoding: .utf8).contains("\"disabled\":true"))
            XCTAssertFalse(FileManager.default.fileExists(atPath: env.home.appendingPathComponent("profiles").path))
        }
    }
    func testPluginHiddenInstallScriptsAndPeerRangesRejected() throws {
        let initial = try Fixtures.make(kind: .plugin)
        let manifest = try initial.trust.verify(initial.envelope, request: initial.request, now: Date()).0
        var files = try unpack(initial.archive.bytes, manifest: manifest)
        var package = try JSONSerialization.jsonObject(with: files["package/package.json"]!) as! [String: Any]
        package["scripts"] = ["postinstall": "touch unwanted"]
        files["package/package.json"] = try JSONSerialization.data(withJSONObject: package)
        try rejects(Fixtures.make(kind: .plugin, files: files))
        package.removeValue(forKey: "scripts"); package["peerDependencies"] = ["@deepseek-ai/dsh-skill": "*"]
        files["package/package.json"] = try JSONSerialization.data(withJSONObject: package)
        try rejects(Fixtures.make(kind: .plugin, files: files))
    }
    func testUnownedAndSymlinkDestinationRefused() throws {
        for symlink in [false, true] {
            let fixture = try Fixtures.make()
            try withInstaller(fixture) { installer, env in
                let target = env.skills.appendingPathComponent(fixture.request.packageID)
                if symlink { try FileManager.default.createSymbolicLink(at: target, withDestinationURL: env.root.appendingPathComponent("journals")) }
                else { try FileManager.default.createDirectory(at: target, withIntermediateDirectories: false) }
                let prepared = try prepare(fixture, installer)
                XCTAssertThrowsError(try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared)))
            }
        }
    }
    func testFailedUpdateRestoresOldSkill() throws {
        let fixture = try Fixtures.make()
        let next = try Fixtures.make(version: "0.1.0-test.2", files: ["SKILL.md": Data("---\nname: qcu-study-demo\n---\nNew\n".utf8)])
        try withInstaller(fixture) { installer, env in
            let first = try prepare(fixture, installer)
            _ = try installer.install(first, confirmation: installer.confirmFromLocalUser(first))
            let file = env.skills.appendingPathComponent("qcu-study-demo/SKILL.md")
            let before = try Data(contentsOf: file)
            let second = try prepare(next, installer)
            installer.afterBackup = { throw InstallerError.refused("simulated-disk-failure") }
            XCTAssertThrowsError(try installer.install(second, confirmation: installer.confirmFromLocalUser(second)))
            XCTAssertEqual(try Data(contentsOf: file), before)
            XCTAssertEqual(try installer.receipt(for: next.request)?.state, .failed)
        }
    }
    func testInterruptedJournalRemainsUnknownNotSuccess() throws {
        let fixture = try Fixtures.make()
        try withInstaller(fixture) { installer, env in
            let prepared = try prepare(fixture, installer)
            let interrupted = Receipt(request: fixture.request, manifestDigest: prepared.manifestDigest, state: .applying, message: "test crash")
            try JSONEncoder().encode(interrupted).write(to: env.root.appendingPathComponent("journals/" + fixture.request.requestID + ".json"))
            let restarted = Installer(environment: env, trust: fixture.trust)
            XCTAssertEqual(try restarted.recover(fixture.request)?.state, .recoveryRequired)
            XCTAssertThrowsError(try restarted.confirmFromLocalUser(prepared))
        }
    }
    func testPreparedPackageCannotBypassChangedTrustConfiguration() throws {
        let fixture = try Fixtures.make()
        try withInstaller(fixture) { installer, env in
            let prepared = try prepare(fixture, installer)
            let noKeys = try CatalogTrust(catalogID: "test-qcu", origin: fixture.trust.origin, publicKeys: [:], fixtureOnly: true)
            let changed = Installer(environment: env, trust: noKeys)
            XCTAssertThrowsError(try changed.confirmFromLocalUser(prepared))
        }
    }
    func testPrivatePermissionsAndSuccessfulUpdateRetainsBackup() throws {
        let fixture = try Fixtures.make()
        let next = try Fixtures.make(version: "0.1.0-test.2")
        try withInstaller(fixture) { installer, env in
            let first = try prepare(fixture, installer)
            _ = try installer.install(first, confirmation: installer.confirmFromLocalUser(first))
            let second = try prepare(next, installer)
            XCTAssertEqual(try installer.install(second, confirmation: installer.confirmFromLocalUser(second)).state, .skillInstalledInSimulation)
            let backup = env.root.appendingPathComponent("transactions/\(next.request.requestID)/backup/SKILL.md")
            XCTAssertTrue(FileManager.default.fileExists(atPath: backup.path))
            let permissions = try FileManager.default.attributesOfItem(atPath: env.root.path)[.posixPermissions] as? Int
            XCTAssertEqual(permissions, 0o700)
            let mode = try FileManager.default.attributesOfItem(atPath: env.skills.appendingPathComponent("qcu-study-demo/SKILL.md").path)[.posixPermissions] as? Int
            XCTAssertEqual(mode, 0o600)
        }
    }
    func testJournalReadRevalidatesRequestsDecodedOutsideBoundary() throws {
        let fixture = try Fixtures.make()
        let raw = Data("{\"catalogID\":\"test-qcu\",\"packageID\":\"qcu-study-demo\",\"version\":\"0.1.0-test.1\",\"requestID\":\"../../outside\"}".utf8)
        let unvalidated = try JSONDecoder().decode(InstallRequest.self, from: raw)
        try withInstaller(fixture) { installer, _ in
            XCTAssertThrowsError(try installer.receipt(for: unvalidated))
            XCTAssertThrowsError(try installer.recover(unvalidated))
        }
    }
}
