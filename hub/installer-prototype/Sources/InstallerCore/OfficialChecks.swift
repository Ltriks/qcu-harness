import Foundation
import Darwin
import Security
import NativeProcess

/// Actual Security.framework validation. Constants are pinned from the archived
/// official rc.2 signed application and prior verification receipt, never a URL.
struct MacOfficialIdentityChecker: OfficialIdentityChecking {
    static let team = "NAN929V4UM"
    static let bundle = "com.deepseek.dsh"
    static let version = "0.2.0-rc.2"
    let app: URL
    func inspect(_ executable: URL) throws -> CLIIdentity {
        let canonical = app.resolvingSymlinksInPath().standardizedFileURL
        try require(canonical == app.standardizedFileURL, "app-symlink")
        let launcher = app.appendingPathComponent("Contents/Resources/runtime/cli/bin/dsh")
        try require(executable == launcher && launcher.resolvingSymlinksInPath() == launcher, "not-bundled-cli")
        var code: SecStaticCode?
        try require(SecStaticCodeCreateWithPath(app as CFURL, [], &code) == errSecSuccess, "official-code-unreadable")
        var requirement: SecRequirement?
        let rule = "anchor apple generic and identifier \"com.deepseek.dsh\" and certificate leaf[subject.OU] = \"NAN929V4UM\""
        try require(SecRequirementCreateWithString(rule as CFString, [], &requirement) == errSecSuccess, "signature-requirement-unavailable")
        guard let code else { throw InstallerError.refused("official-code-missing") }
        let flags = SecCSFlags(rawValue: kSecCSStrictValidate | kSecCSCheckNestedCode | kSecCSCheckAllArchitectures)
        try require(SecStaticCodeCheckValidity(code, flags, requirement) == errSecSuccess, "official-signature-invalid")
        var signing: CFDictionary?
        try require(SecCodeCopySigningInformation(code, SecCSFlags(rawValue: kSecCSSigningInformation), &signing) == errSecSuccess, "signing-info-unavailable")
        let info = signing as? [String: Any]
        try require(info?[kSecCodeInfoTeamIdentifier as String] as? String == Self.team && info?[kSecCodeInfoIdentifier as String] as? String == Self.bundle, "official-identity-mismatch")
        let plist = try PropertyListSerialization.propertyList(from: bounded(app.appendingPathComponent("Contents/Info.plist"), limit: 131072), format: nil) as? [String: Any]
        try require(plist?["CFBundleIdentifier"] as? String == Self.bundle && plist?["CFBundleShortVersionString"] as? String == Self.version && plist?["CFBundleVersion"] as? String == Self.version, "official-version-mismatch")
        let hash = digest(try bounded(launcher, limit: 131072))
        try require(hash == "61647349bd61a5cfff40c338c7d5af767a22f409ddce36feabfb2f693d1e66af", "official-launcher-hash-mismatch")
        return CLIIdentity(version: Self.version, signingIdentity: Self.team + ":" + Self.bundle, executableHash: hash)
    }
}
func bounded(_ path: URL, limit: Int) throws -> Data {
    let file = try FileHandle(forReadingFrom: path); defer { try? file.close() }
    let data = try file.read(upToCount: limit + 1) ?? Data()
    try require(data.count <= limit, "metadata-too-large")
    return data
}

/// Reads executable paths and uid only, never argv, environment, credentials or
/// conversations. Conservatively blocks every instance of the selected App.
struct MacProcessOccupancy {
    func idle(app: URL) throws -> Bool {
        let result = app.path.withCString { official_app_busy($0) }
        try require(result >= 0, "process-inventory-unavailable-\(result)")
        return result == 0
    }
}

/// Restricted profile reader, not a general YAML editor. All row configuration
/// files must match locally reviewed pins; unknown YAML is refused unchanged.
struct OfficialProfileChecker: TargetStateChecking {
    let home: URL
    let app: URL
    let ownerMarker: Data
    let configurationPins: [String: String] // exact root/profile patches, reviewed locally
    let packageID: String
    let version: String
    let archiveHash: String
    let files: [FileRecord]
    private var profile: URL { home.appendingPathComponent("profiles/desktop") }
    private func checkPath(_ url: URL, directory: Bool = false) throws {
        try require(url.standardizedFileURL.path == home.path || url.standardizedFileURL.path.hasPrefix(home.path + "/"), "profile-outside-home")
        try require(url.resolvingSymlinksInPath() == url, "profile-symlink")
        let a = try FileManager.default.attributesOfItem(atPath: url.path)
        try require((a[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(), "profile-owner")
        try require(a[.type] as? FileAttributeType == (directory ? .typeDirectory : .typeRegular), "profile-file-type")
        if directory { try require(((a[.posixPermissions] as? NSNumber)?.intValue ?? 0) & 0o077 == 0, "profile-not-private") }
    }
    private func metadata() throws -> [String: Any] {
        try checkPath(home, directory: true); try checkPath(profile, directory: true)
        let marker = home.appendingPathComponent(".installer-owner")
        try checkPath(marker); try require(try bounded(marker, limit: 1024) == ownerMarker, "profile-marker-mismatch")
        try require(configurationPins.keys.sorted() == ["cordis.patch.yml", "profiles/desktop/cordis.patch.yml"], "configuration-pins-required")
        for (name, hash) in configurationPins {
            let path = home.appendingPathComponent(name); try checkPath(path)
            try require(digest(try bounded(path, limit: 131072)) == hash, "profile-config-changed")
        }
        let path = profile.appendingPathComponent("package.json"); try checkPath(path)
        guard let meta = try JSONSerialization.jsonObject(with: bounded(path, limit: 131072)) as? [String: Any],
              let dsh = meta["dsh"] as? [String: Any], let config = dsh["profile"] as? [String: Any],
              let bundles = config["bundles"] as? [String] else { throw InstallerError.refused("official-profile-uninitialized") }
        try require(!bundles.contains(packageID), "bundle-already-selected")
        try require(matches(packageID, idPattern) && matches(version, versionPattern), "package-identity-invalid")
        return meta
    }
    func isIdle(home: URL) throws -> Bool {
        try require(home == self.home, "wrong-profile-target")
        _ = try metadata()
        // lstat also detects broken links. Never remove lock or infer staleness.
        var st = stat()
        if lstat(profile.appendingPathComponent("lock").path, &st) == 0 { return false }
        try require(errno == ENOENT, "profile-lock-unreadable")
        return try MacProcessOccupancy().idle(app: app)
    }
    func packagePresent(home: URL) throws -> Bool {
        try require(home == self.home, "wrong-profile-target")
        let meta = try metadata()
        if (meta["dependencies"] as? [String: Any])?[packageID] != nil { return true }
        var st = stat()
        if lstat(profile.appendingPathComponent("node_modules/" + packageID).path, &st) == 0 { return true }
        try require(errno == ENOENT, "package-presence-unknown"); return false
    }
    func verifyInstalled(home: URL, packageHash: String) throws -> Bool {
        try require(home == self.home && packageHash == archiveHash, "wrong-installed-identity")
        let meta = try metadata()
        try require((meta["dependencies"] as? [String: Any])?[packageID] is String, "installed-dependency-missing")
        // pnpm can create an internal symlink; it must resolve under this profile.
        let modules = profile.appendingPathComponent("node_modules")
        let target = modules.appendingPathComponent(packageID).resolvingSymlinksInPath()
        try require(target.path.hasPrefix(modules.path + "/"), "installed-package-escape")
        try require(!files.isEmpty && files.count <= 100, "installed-file-manifest-required")
        var expected = Set<String>()
        for record in files {
            try require(!record.path.hasPrefix("/") && !record.path.split(separator: "/").contains(".."), "installed-file-path")
            try require(expected.insert(record.path).inserted, "duplicate-installed-file")
            let path = target.appendingPathComponent(record.path)
            try checkPath(path)
            let data = try bounded(path, limit: 1048576)
            try require(data.count == record.bytes && digest(data) == record.sha256, "installed-file-mismatch")
        }
        guard let enumeration = FileManager.default.enumerator(atPath: target.path) else { throw InstallerError.refused("installed-files-unreadable") }
        var actual = Set<String>()
        for case let name as String in enumeration {
            let file = target.appendingPathComponent(name)
            let values = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            try require(values.isSymbolicLink != true, "installed-file-symlink")
            if values.isRegularFile == true { actual.insert(name) }
        }
        try require(actual == expected, "installed-extra-or-missing-file")
        let package = try JSONSerialization.jsonObject(with: bounded(target.appendingPathComponent("package.json"), limit: 131072)) as? [String: Any]
        try require(package?["name"] as? String == packageID && package?["version"] as? String == version, "installed-package-version")
        let patch = try JSONSerialization.jsonObject(with: bounded(target.appendingPathComponent("cordis.patch.yml"), limit: 131072))
        guard let actions = patch as? [[String: Any]], actions.count == 1,
              Set(actions[0].keys) == ["insert"], let rows = actions[0]["insert"] as? [[String: Any]],
              rows.count == 1, rows[0]["id"] as? String == packageID, rows[0]["disabled"] as? Bool == true
        else { throw InstallerError.refused("installed-row-not-disabled") }
        // Exact reviewed patch bytes plus unchanged root/profile config and
        // unselected bundle mean this stage cannot claim activation.
        return true
    }
}
