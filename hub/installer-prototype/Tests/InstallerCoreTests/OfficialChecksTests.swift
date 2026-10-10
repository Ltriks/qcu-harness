import XCTest
import Darwin
@testable import InstallerCore

final class OfficialChecksTests: XCTestCase {
    func testArchivedOfficialSignatureWhenExplicitlyProvided() throws {
        guard let path = ProcessInfo.processInfo.environment["QCU_READONLY_OFFICIAL_ARCHIVE"] else {
            throw XCTSkip("Archive path supplied only for explicit read-only verification run")
        }
        let app = URL(fileURLWithPath: path)
        let verifier = MacOfficialIdentityChecker(app: app)
        let identity = try verifier.inspect(app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh"))
        XCTAssertEqual(identity.signingIdentity, "NAN929V4UM:com.deepseek.dsh")
        XCTAssertEqual(identity.version, "0.2.0-rc.2")
        XCTAssertEqual(identity.executableHash.count, 64)
        XCTAssertThrowsError(try verifier.inspect(app.appendingPathComponent("Contents/MacOS/DeepSeek Harness")))
    }
    func testUnsignedFakeAppRejectedBySecurityFramework() throws {
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let app = env.root.appendingPathComponent("Fake.app")
        let cli = app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh")
        try FileManager.default.createDirectory(at: cli.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("fake".utf8).write(to: cli)
        XCTAssertThrowsError(try MacOfficialIdentityChecker(app: app).inspect(cli))
    }
    func testRealProcessInventoryFindsCurrentExecutable() throws {
        // Use own test executable's directory; no foreign command lines/env read.
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        XCTAssertFalse(try MacProcessOccupancy().idle(app: executable))
    }
    func testActualProfileReaderAndFailureBoundaries() throws {
        let env = try SimulationEnvironment(); defer { try? env.removeSimulation() }
        let home = env.home
        let profile = home.appendingPathComponent("profiles/desktop")
        try FileManager.default.createDirectory(at: profile, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let marker = Data("owned-profile-fixture".utf8)
        try marker.write(to: home.appendingPathComponent(".installer-owner"))
        let patch = Data("[]".utf8)
        for name in ["cordis.patch.yml", "profiles/desktop/cordis.patch.yml"] { try patch.write(to: home.appendingPathComponent(name)) }
        let manifest = profile.appendingPathComponent("package.json")
        func metadata(_ installed: Bool, selected: Bool = false) throws {
            let value: [String: Any] = ["dsh": ["profile": ["bundles": selected ? ["qcu-study-coach"] : []]],
                                        "dependencies": installed ? ["qcu-study-coach": "file:reviewed.tgz"] : [:]]
            try JSONSerialization.data(withJSONObject: value).write(to: manifest)
        }
        try metadata(false)
        let rowPatch = Data("[{\"insert\":[{\"id\":\"qcu-study-coach\",\"disabled\":true}]}]".utf8)
        let package = Data("{\"name\":\"qcu-study-coach\",\"version\":\"0.1.0-pilot.1\"}".utf8)
        let checker = OfficialProfileChecker(home: home, app: env.root.appendingPathComponent("NotRunning.app"), ownerMarker: marker,
            configurationPins: ["cordis.patch.yml": digest(patch), "profiles/desktop/cordis.patch.yml": digest(patch)],
            packageID: "qcu-study-coach", version: "0.1.0-pilot.1", archiveHash: "fixed-reviewed",
            files: [FileRecord(path: "package.json", sha256: digest(package), bytes: package.count), FileRecord(path: "cordis.patch.yml", sha256: digest(rowPatch), bytes: rowPatch.count)])
        do { let idle = try checker.isIdle(home: home); XCTAssertTrue(idle) }
        catch let error as InstallerError {
            // Explicit platform limitation, NOT a successful idle observation.
            XCTAssertTrue(error.description.hasPrefix("process-inventory-unavailable-"))
            print("LIVE_IDLE_PREFLIGHT_UNVERIFIED: " + error.description)
        }
        XCTAssertFalse(try checker.packagePresent(home: home))
        try Data().write(to: profile.appendingPathComponent("lock"))
        XCTAssertFalse(try checker.isIdle(home: home))
        try FileManager.default.removeItem(at: profile.appendingPathComponent("lock"))
        let target = profile.appendingPathComponent("node_modules/qcu-study-coach")
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
        try package.write(to: target.appendingPathComponent("package.json")); try rowPatch.write(to: target.appendingPathComponent("cordis.patch.yml")); try metadata(true)
        XCTAssertTrue(try checker.packagePresent(home: home))
        XCTAssertTrue(try checker.verifyInstalled(home: home, packageHash: "fixed-reviewed"))
        try Data("extra".utf8).write(to: target.appendingPathComponent("extra.js"))
        XCTAssertThrowsError(try checker.verifyInstalled(home: home, packageHash: "fixed-reviewed"))
        try FileManager.default.removeItem(at: target.appendingPathComponent("extra.js"))
        try metadata(true, selected: true)
        XCTAssertThrowsError(try checker.verifyInstalled(home: home, packageHash: "fixed-reviewed"))
        try metadata(false)
        try Data("enabled".utf8).write(to: home.appendingPathComponent("cordis.patch.yml"))
        XCTAssertThrowsError(try checker.isIdle(home: home))
    }
}
