import Foundation
import CryptoKit

public struct ReviewedDownload: Sendable {
    public let request: InstallRequest
    public let manifest: ReleaseManifest
    public let manifestDigest: String
    fileprivate let envelope: Data
}
public struct DownloadConsent: Sendable { fileprivate let id: UUID }

private final class RestrictedSessionDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil) // Never follow even a same-origin redirect.
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping @Sendable (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // TLS uses system trust. No keychain, interactive or HTTP credential fallback.
        completionHandler(challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust
                          ? .performDefaultHandling : .cancelAuthenticationChallenge, nil)
    }
}

/// URLSession transport only. No install/control listener, CLI or DSH credentials.
/// Owns ephemeral mode-0700 staging; every completed/failed transfer removes its file.
public actor DownloadClient {
    public nonisolated let stagingDirectory: URL
    private let trust: CatalogTrust
    private let timeout: TimeInterval
    private var consents: [UUID: (String, String, Date)] = [:]
    private var active = 0

    public init(trust: CatalogTrust, timeout: TimeInterval = 30) throws {
        try require(timeout >= 0.1 && timeout <= 60 && (trust.fixtureOnly || timeout >= 5), "invalid-download-timeout")
        self.trust = trust; self.timeout = timeout
        stagingDirectory = FileManager.default.temporaryDirectory.resolvingSymlinksInPath()
            .appendingPathComponent("chengyuan-DOWNLOAD-SIMULATION-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: stagingDirectory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    }

    public func fetchManifest(for request: InstallRequest) async throws -> ReviewedDownload {
        _ = try InstallRequest.parse(JSONEncoder().encode(request))
        try require(request.catalogID == trust.catalogID, "wrong-catalog")
        let url = trust.origin.appendingPathComponent("manifests/\(request.packageID)@\(request.version).json")
        let data = try await transfer(url, limit: 128 * 1024, expectedHash: nil, exactBytes: nil)
        return try review(envelope: data, request: request)
    }
    /// Also usable with a manifest handed to the client by a separately bounded
    /// offline channel; the same pinned trust is applied before download.
    public func review(envelope: Data, request: InstallRequest) throws -> ReviewedDownload {
        _ = try InstallRequest.parse(JSONEncoder().encode(request))
        let (manifest, hash) = try trust.verify(envelope, request: request, now: Date())
        return ReviewedDownload(request: request, manifest: manifest, manifestDigest: hash, envelope: envelope)
    }
    /// A local user action, not a remote API. One use, one signed version/hash.
    public func confirmDownloadFromLocalUser(_ reviewed: ReviewedDownload) throws -> DownloadConsent {
        _ = try trust.verify(reviewed.envelope, request: reviewed.request, now: Date())
        let id = UUID()
        consents[id] = (reviewed.request.requestID, reviewed.manifestDigest, Date().addingTimeInterval(300))
        return DownloadConsent(id: id)
    }
    public func download(_ reviewed: ReviewedDownload, consent: DownloadConsent) async throws -> DownloadedArchive {
        guard let confirmation = consents.removeValue(forKey: consent.id) else { throw InstallerError.refused("missing-or-used-download-consent") }
        try require(confirmation.0 == reviewed.request.requestID && confirmation.1 == reviewed.manifestDigest && confirmation.2 > Date(), "download-consent-mismatch")
        let (manifest, hash) = try trust.verify(reviewed.envelope, request: reviewed.request, now: Date())
        try require(hash == reviewed.manifestDigest, "manifest-changed")
        let url = URL(string: manifest.archiveURL)!
        let data = try await transfer(url, limit: manifest.bytes, expectedHash: manifest.sha256, exactBytes: manifest.bytes)
        // Expiration/revocation via a different trust configuration is never bypassed
        // by a previously staged file. Current client trust is immutable.
        _ = try trust.verify(reviewed.envelope, request: reviewed.request, now: Date())
        return DownloadedArchive(source: url, bytes: data)
    }
    public func removeStagingDirectory() throws {
        try require(active == 0, "download-still-active")
        try FileManager.default.removeItem(at: stagingDirectory)
    }
    private func transfer(_ url: URL, limit: Int, expectedHash: String?, exactBytes: Int?) async throws -> Data {
        try Task.checkCancellation()
        try require(active == 0, "download-already-active")
        active += 1; defer { active -= 1 }
        let file = stagingDirectory.appendingPathComponent(UUID().uuidString + ".partial")
        try require(FileManager.default.createFile(atPath: file.path, contents: nil, attributes: [.posixPermissions: 0o600]), "cannot-create-staging-file")
        let result: Data
        do {
            result = try await readTransfer(url, file: file, limit: limit, expectedHash: expectedHash, exactBytes: exactBytes)
        } catch {
            do { try FileManager.default.removeItem(at: file) }
            catch { throw InstallerError.refused("download-failed-cleanup-unconfirmed") }
            throw error
        }
        do { try FileManager.default.removeItem(at: file) }
        catch { throw InstallerError.refused("download-cleanup-unconfirmed") }
        return result
    }
    private func readTransfer(_ url: URL, file: URL, limit: Int, expectedHash: String?, exactBytes: Int?) async throws -> Data {
        let handle = try FileHandle(forWritingTo: file)
        defer { try? handle.close() }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil; configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = timeout; configuration.timeoutIntervalForResource = timeout
        let session = URLSession(configuration: configuration, delegate: RestrictedSessionDelegate(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        let (stream, response) = try await session.bytes(for: request)
        guard let response = response as? HTTPURLResponse else { throw InstallerError.refused("non-http-response") }
        try require(response.statusCode == 200 && response.url == url, "http-status-or-redirect")
        let encoding = response.value(forHTTPHeaderField: "Content-Encoding")?.lowercased()
        try require(encoding == nil || encoding == "identity", "encoded-http-body")
        try require(response.expectedContentLength <= limit, "declared-download-too-large")
        var hash = SHA256(), chunk = Data(), count = 0
        for try await byte in stream {
            try Task.checkCancellation()
            try require(count < limit, "download-size-limit")
            chunk.append(byte); count += 1
            if chunk.count == 32768 { try handle.write(contentsOf: chunk); hash.update(data: chunk); chunk.removeAll(keepingCapacity: true) }
        }
        try Task.checkCancellation()
        try handle.write(contentsOf: chunk); hash.update(data: chunk)
        try handle.close()
        if let exactBytes { try require(count == exactBytes, "short-download") }
        if let expectedHash {
            let observed = hash.finalize().map { String(format: "%02x", $0) }.joined()
            try require(observed == expectedHash, "download-hash-mismatch")
        }
        let bytes = try Data(contentsOf: file)
        try require(bytes.count == count && (expectedHash == nil || digest(bytes) == expectedHash), "staged-file-changed")
        return bytes
    }
}
