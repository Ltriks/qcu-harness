import Foundation
import XCTest
@testable import InstallerCore
import DemoFixtures

struct ArchiveFixture {
    let request: InstallRequest
    let envelope: Data
    let archive: DownloadedArchive
    let trust: CatalogTrust
}
func archivedFixture(_ name: String, origin: URL = URL(string: "https://catalog.example.invalid")!, mutate: ((inout [String: Any]) -> Void)? = nil) throws -> ArchiveFixture {
    let directory = Bundle.module.resourceURL!.appendingPathComponent("Fixtures")
    let all = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("archives.json"))) as! [String: [String: Any]]
    var record = all[name]!
    let bytes = try Data(contentsOf: directory.appendingPathComponent(name + ".fixture"))
    let package = record["packageID"] as! String, version = record["version"] as! String, hash = record["sha256"] as! String
    let format = record["archiveFormat"] as! String
    let source = origin.appendingPathComponent("packages/\(package)-\(version)-\(hash).\(format)")
    record["schema"] = 2; record["catalogID"] = "test-chengyuan"; record["title"] = "TEST archive"
    record["archiveURL"] = source.absoluteString; record["expiresAt"] = Int(Date().addingTimeInterval(3600).timeIntervalSince1970)
    record["dshVersion"] = "0.2.0-rc.2"; record["dependencies"] = [String](); record["installScripts"] = false
    record["authority"] = record["kind"] as? String == "skill" ? "model-instructions" : "host-code-outside-workspace-sandbox"
    mutate?(&record)
    let request = try InstallRequest.parse(JSONSerialization.data(withJSONObject: ["catalogID":"test-chengyuan", "packageID":package, "version":version, "requestID":UUID().uuidString.lowercased()]))
    let trust = try CatalogTrust(catalogID: "test-chengyuan", origin: origin, publicKeys: [Fixtures.testKeyID: Fixtures.key().publicKey.rawRepresentation], fixtureOnly: true)
    return ArchiveFixture(request: request, envelope: try Fixtures.signed(record), archive: DownloadedArchive(source: source, bytes: bytes), trust: trust)
}

/// Only tests may launch this owned, temporary GET-only loopback fixture.
final class LoopbackFixture {
    let root: URL
    let process: Process
    let origin: URL
    init(mode: String = "ok") throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("chengyuan-loopback-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        try JSONEncoder().encode(mode).write(to: root.appendingPathComponent("mode.json"))
        process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [Bundle.module.resourceURL!.appendingPathComponent("Fixtures/loopback.py").path, root.path]
        let pipe = Pipe(); process.standardOutput = pipe; process.standardError = FileHandle.nullDevice
        try process.run()
        var line = Data()
        while let byte = try pipe.fileHandleForReading.read(upToCount: 1), !byte.isEmpty {
            if byte == Data([10]) { break }; line.append(byte)
        }
        guard let text = String(data: line, encoding: .utf8), let port = Int(text) else {
            process.terminate(); process.waitUntilExit(); throw InstallerError.refused("test-server-not-ready")
        }
        origin = URL(string: "http://127.0.0.1:\(port)")!
    }
    func publish(_ fixture: ArchiveFixture) throws {
        for directory in ["packages", "manifests"] { try FileManager.default.createDirectory(at: root.appendingPathComponent(directory), withIntermediateDirectories: true) }
        try fixture.archive.bytes.write(to: root.appendingPathComponent(String(fixture.archive.source.path.dropFirst())))
        try fixture.envelope.write(to: root.appendingPathComponent("manifests/\(fixture.request.packageID)@\(fixture.request.version).json"))
    }
    func stop() {
        if process.isRunning { process.terminate(); process.waitUntilExit() }
        try? FileManager.default.removeItem(at: root)
    }
}

@MainActor
final class ArchiveDownloadTests: XCTestCase {
    func testFixedPublishedTGZIsParsedWithoutExecutionOrRowChanges() throws {
        let fixture = try archivedFixture("fixed-study-coach")
        XCTAssertEqual(digest(fixture.archive.bytes), "76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c")
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let installer = Installer(environment: env, trust: fixture.trust)
        let prepared = try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive)
        XCTAssertEqual(try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared)).state, .pluginPlanOnly)
        let plan = try XCTUnwrap(installer.lastPlan)
        let patch = try String(contentsOf: URL(fileURLWithPath: plan.arguments[4]).appendingPathComponent("cordis.patch.yml"), encoding: .utf8)
        XCTAssertTrue(patch.contains("\"disabled\": true"))
        XCTAssertThrowsError(try OfficialDesktopAdapter.execute(plan))
    }
    func testRealZIPStoredDeflatedAndTGZSkillInstallInSimulation() throws {
        for name in ["good-zip", "stored-zip", "good-tgz"] {
            let fixture = try archivedFixture(name)
            let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
            let installer = Installer(environment: env, trust: fixture.trust)
            let prepared = try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive)
            XCTAssertEqual(try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared)).state, .skillInstalledInSimulation)
        }
    }
    func testMaliciousCompressedArchivesLeaveNoInstalledFiles() throws {
        for name in ["tgz-traversal", "tgz-link", "tgz-hardlink", "tgz-bomb", "tgz-truncated", "tgz-concatenated", "tgz-bad-crc", "zip-traversal", "zip-link", "zip-bomb", "zip-truncated", "zip-bad-deflate"] {
            let fixture = try archivedFixture(name)
            let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
            let installer = Installer(environment: env, trust: fixture.trust)
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive), name)
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: env.skills.path), [], name)
            XCTAssertNil(try installer.receipt(for: fixture.request), name)
        }
    }
    func testProductionTrustRefusesHTTP() throws {
        XCTAssertThrowsError(try CatalogTrust(catalogID: "chengyuan", origin: URL(string: "http://127.0.0.1:12345")!, publicKeys: [:]))
        XCTAssertThrowsError(try CatalogTrust(catalogID: "test-chengyuan", origin: URL(string: "http://192.0.2.1:12345")!, publicKeys: [:], fixtureOnly: true))
    }
    func testDownloadManifestConsentAndArchiveIntegration() async throws {
      for name in ["good-zip", "fixed-study-coach"] {
        let server = try LoopbackFixture(); defer { server.stop() }
        let fixture = try archivedFixture(name, origin: server.origin); try server.publish(fixture)
        let client = try DownloadClient(trust: fixture.trust)
        let reviewed = try await client.fetchManifest(for: fixture.request)
        XCTAssertEqual(try String(contentsOf: server.root.appendingPathComponent("requests.txt"), encoding: .utf8).split(separator: "\n").count, 1)
        let consent = try await client.confirmDownloadFromLocalUser(reviewed)
        let archive = try await client.download(reviewed, consent: consent)
        XCTAssertEqual(archive.bytes, fixture.archive.bytes)
        do { _ = try await client.download(reviewed, consent: consent); XCTFail("consent replay") } catch {}
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [])
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let installer = Installer(environment: env, trust: fixture.trust)
        let prepared = try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: archive)
        XCTAssertEqual(try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared)).state,
                       name == "good-zip" ? .skillInstalledInSimulation : .pluginPlanOnly)
        try await client.removeStagingDirectory()
      }
    }
    func testNetworkFailureRedirectAndSizeAlwaysCleanStaging() async throws {
        for mode in ["redirect", "cross-redirect", "oversize", "unbounded", "truncated", "bad-hash", "unauthorized"] {
            let server = try LoopbackFixture(mode: mode); defer { server.stop() }
            let fixture = try archivedFixture("good-zip", origin: server.origin); try server.publish(fixture)
            let client = try DownloadClient(trust: fixture.trust, timeout: 1)
            let reviewed = try await client.fetchManifest(for: fixture.request)
            let consent = try await client.confirmDownloadFromLocalUser(reviewed)
            do { _ = try await client.download(reviewed, consent: consent); XCTFail(mode) } catch {}
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [], mode)
            XCTAssertFalse(try String(contentsOf: server.root.appendingPathComponent("requests.txt"), encoding: .utf8).contains("redirect-target"))
            try await client.removeStagingDirectory()
        }
    }
    func testTimeoutAndCancellationCleanPartialFiles() async throws {
        for cancel in [false, true] {
            let server = try LoopbackFixture(mode: "slow"); defer { server.stop() }
            let fixture = try archivedFixture("good-zip", origin: server.origin); try server.publish(fixture)
            let client = try DownloadClient(trust: fixture.trust, timeout: cancel ? 5 : 0.2)
            let reviewed = try await client.fetchManifest(for: fixture.request)
            let consent = try await client.confirmDownloadFromLocalUser(reviewed)
            let work = Task { try await client.download(reviewed, consent: consent) }
            if cancel { try await Task.sleep(for: .milliseconds(100)); work.cancel() }
            do { _ = try await work.value; XCTFail("timeout/cancel") } catch {}
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [])
            try await client.removeStagingDirectory()
        }
    }
    func testManifestSignatureFailureNeverDownloadsPackage() async throws {
        let server = try LoopbackFixture(); defer { server.stop() }
        let fixture = try archivedFixture("good-zip", origin: server.origin); try server.publish(fixture)
        let path = server.root.appendingPathComponent("manifests/\(fixture.request.packageID)@\(fixture.request.version).json")
        try Data("{}".utf8).write(to: path)
        let client = try DownloadClient(trust: fixture.trust)
        do { _ = try await client.fetchManifest(for: fixture.request); XCTFail("unsigned manifest") } catch {}
        XCTAssertFalse(try String(contentsOf: server.root.appendingPathComponent("requests.txt"), encoding: .utf8).contains("/packages/"))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: client.stagingDirectory.path), [])
        try await client.removeStagingDirectory()
    }
    func testBoundedInflaterRejectsForgedSmallZipSizeAndTGZBomb() throws {
        for name in ["zip-bomb-forged-size", "tgz-bomb"] {
            let fixture = try archivedFixture(name)
            let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
            let installer = Installer(environment: env, trust: fixture.trust)
            XCTAssertThrowsError(try installer.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive)) {
                XCTAssertEqual($0 as? InstallerError, .refused("inflated-size-limit"))
            }
        }
    }
    func testMalformedUpdatePreservesInstalledSkillAndMissingConsentCannotTransfer() async throws {
        let good = try archivedFixture("good-zip"), bad = try archivedFixture("zip-truncated")
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let installer = Installer(environment: env, trust: good.trust)
        let prepared = try installer.prepare(request: good.request, envelope: good.envelope, archive: good.archive)
        _ = try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared))
        let file = env.skills.appendingPathComponent("chengyuan-study-demo/SKILL.md")
        let before = try Data(contentsOf: file)
        XCTAssertThrowsError(try installer.prepare(request: bad.request, envelope: bad.envelope, archive: bad.archive))
        XCTAssertEqual(try Data(contentsOf: file), before)

        let server = try LoopbackFixture(); defer { server.stop() }
        let first = try archivedFixture("good-zip", origin: server.origin), other = try archivedFixture("stored-zip", origin: server.origin)
        let client = try DownloadClient(trust: first.trust)
        let reviewed = try await client.review(envelope: first.envelope, request: first.request)
        let wrong = try await client.review(envelope: other.envelope, request: other.request)
        let consent = try await client.confirmDownloadFromLocalUser(reviewed)
        do { _ = try await client.download(wrong, consent: consent); XCTFail("cross-request consent") } catch {}
        XCTAssertFalse(FileManager.default.fileExists(atPath: server.root.appendingPathComponent("requests.txt").path))
        try await client.removeStagingDirectory()
    }
}
