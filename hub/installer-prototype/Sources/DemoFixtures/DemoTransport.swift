// In-process URLSession fixture only. No sockets, servers or child processes.
import Foundation
import InstallerCore

public enum DemoScenario: String, CaseIterable, Sendable {
    case skill, plugin, slow, downloadFailure, integrityFailure, signatureFailure
    public var title: String {
        switch self {
        case .skill: "纯 Skill 正常流程"
        case .plugin: "插件：仅生成计划"
        case .slow: "慢速下载：可取消"
        case .downloadFailure: "下载失败"
        case .integrityFailure: "包校验失败"
        case .signatureFailure: "签名拒绝"
        }
    }
}
private struct FixtureResponse: Sendable {
    let data: Data
    let delay: TimeInterval
    let fail: Bool
}
private final class ResponseRegistry: @unchecked Sendable {
    private let lock = NSLock()
    private var responses: [String: FixtureResponse] = [:]
    func put(_ url: URL, _ response: FixtureResponse) { lock.withLock { responses[url.absoluteString] = response } }
    func get(_ url: URL) -> FixtureResponse? { lock.withLock { responses[url.absoluteString] } }
    func remove(_ urls: [URL]) { lock.withLock { for url in urls { responses.removeValue(forKey: url.absoluteString) } } }
}

public final class DemoURLProtocol: URLProtocol, @unchecked Sendable {
    private static let registry = ResponseRegistry()
    private let stoppedLock = NSLock()
    private var stopped = false
    // Claim every request, including unknown URLs, so fixture errors cannot
    // fall through to external networking in this dedicated URLSession.
    public override class func canInit(with request: URLRequest) -> Bool { true }
    public override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    public override func startLoading() {
        guard let url = request.url, let response = Self.registry.get(url) else {
            client?.urlProtocol(self, didFailWithError: URLError(.resourceUnavailable)); return
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + response.delay) { [self] in
            guard !stoppedLock.withLock({ stopped }) else { return }
            if response.fail { client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost)); return }
            let http = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Length": String(response.data.count)])!
            client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: response.data)
            client?.urlProtocolDidFinishLoading(self)
        }
    }
    public override func stopLoading() { stoppedLock.withLock { stopped = true } }
    public static func install(_ scenario: DemoScenario) throws -> DemoTransport {
        let origin = URL(string: "https://demo-\(UUID().uuidString.lowercased()).example.invalid")!
        let fixture = try Fixtures.make(kind: scenario == .plugin ? .plugin : .skill, origin: origin)
        var envelope = fixture.envelope
        if scenario == .signatureFailure {
            var object = try JSONSerialization.jsonObject(with: envelope) as! [String: Any]
            object["signature"] = Data(repeating: 0, count: 64).base64EncodedString()
            envelope = try JSONSerialization.data(withJSONObject: object)
        }
        var archive = fixture.archive.bytes
        if scenario == .integrityFailure { archive[0] ^= 1 }
        let manifestURL = origin.appendingPathComponent("manifests/\(fixture.request.packageID)@\(fixture.request.version).json")
        registry.put(manifestURL, FixtureResponse(data: envelope, delay: 0.05, fail: false))
        registry.put(fixture.archive.source, FixtureResponse(data: archive, delay: scenario == .slow ? 5 : 0.6, fail: scenario == .downloadFailure))
        return DemoTransport(fixture: fixture, urls: [manifestURL, fixture.archive.source])
    }
    fileprivate static func remove(_ urls: [URL]) { registry.remove(urls) }
}
public final class DemoTransport {
    public let fixture: Fixture
    private let urls: [URL]
    fileprivate init(fixture: Fixture, urls: [URL]) { self.fixture = fixture; self.urls = urls }
    public func close() { DemoURLProtocol.remove(urls) }
    deinit { close() }
}
