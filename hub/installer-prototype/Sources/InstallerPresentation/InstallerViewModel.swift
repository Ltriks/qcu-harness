import Foundation
import Combine
import InstallerCore

public enum FlowState: String, Sendable {
    case idle, reviewing, awaitingConfirmation, downloading, verifying, applying
    case simulationComplete, pluginPlanOnly, cancelling, cancelled, failed, unknown, refused, cleaning
}

/// UI owns explicit consent. No model, HTTP or URL callback calls confirm().
@MainActor public protocol InteractiveInstallSession: AnyObject {
    var rootPath: String { get }
    var plan: OfficialCLIPlan? { get }
    func review(_ request: InstallRequest) async throws -> ReviewedDownload
    func transfer(_ reviewed: ReviewedDownload) async throws -> DownloadedArchive
    func validate(_ reviewed: ReviewedDownload, archive: DownloadedArchive) throws -> PreparedInstall
    func apply(_ prepared: PreparedInstall) throws -> Receipt?
    func cleanup() async throws
}

@MainActor public final class CoreInstallSession: InteractiveInstallSession {
    private let client: DownloadClient
    private let installer: Installer
    public var rootPath: String { installer.environment.root.path }
    public var plan: OfficialCLIPlan? { installer.lastPlan }
    private var downloadCleaned = false
    private var homeCleaned = false
    public init(client: DownloadClient, trust: CatalogTrust) throws {
        self.client = client
        installer = Installer(environment: try SimulationEnvironment(), trust: trust)
    }
    public func review(_ request: InstallRequest) async throws -> ReviewedDownload {
        try await client.fetchManifest(for: request)
    }
    public func transfer(_ reviewed: ReviewedDownload) async throws -> DownloadedArchive {
        let consent = try await client.confirmDownloadFromLocalUser(reviewed)
        return try await client.download(reviewed, consent: consent)
    }
    public func validate(_ reviewed: ReviewedDownload, archive: DownloadedArchive) throws -> PreparedInstall {
        let prepared = try installer.prepare(request: reviewed.request, envelope: reviewed.envelope, archive: archive)
        guard prepared.manifestDigest == reviewed.manifestDigest else { throw InstallerError.refused("reviewed-manifest-changed") }
        return prepared
    }
    public func apply(_ prepared: PreparedInstall) throws -> Receipt? {
        // The single prior UI action expressly includes download + this exact
        // simulated installation/plan. No extra authority is inferred here.
        try installer.install(prepared, confirmation: installer.confirmFromLocalUser(prepared))
    }
    public func cleanup() async throws {
        if !downloadCleaned { try await client.removeStagingDirectory(); downloadCleaned = true }
        if !homeCleaned { try installer.environment.removeSimulation(); homeCleaned = true }
    }
}

@MainActor public final class InstallerViewModel: ObservableObject {
    @Published public private(set) var state: FlowState = .idle
    @Published public private(set) var message = "选择合成演示。真实目录信任未配置。"
    @Published public private(set) var reviewed: ReviewedDownload?
    @Published public private(set) var events: [FlowState] = [.idle]
    @Published public private(set) var plan: OfficialCLIPlan?
    @Published public private(set) var rootPath = ""
    private var session: (any InteractiveInstallSession)?
    private var operation: Task<Void, Never>?
    public init() {}
    public var canStart: Bool { operation == nil && session == nil && [.idle, .refused].contains(state) }
    public var canConfirm: Bool { operation == nil && state == .awaitingConfirmation }
    public var canCancel: Bool { [.reviewing, .awaitingConfirmation, .downloading, .verifying].contains(state) }
    public var canCleanup: Bool { operation == nil && session != nil && state != .cleaning }

    private func transition(_ next: FlowState, _ text: String) {
        state = next; message = text; events.append(next)
    }
    /// External URLs can request identification, never supply origin/public keys
    /// or self-authorize. Production routing is deliberately not configured.
    public func receiveExternalURL(_ url: URL) {
        guard canStart else { return }
        do {
            _ = try InstallRequest.parseURL(url)
            transition(.refused, "生产目录信任未配置：不能使用网页提供的公钥或来源。未下载、未安装。")
        } catch { transition(.refused, "请求已拒绝：\(error)") }
    }
    @discardableResult public func begin(_ request: InstallRequest, session: any InteractiveInstallSession) -> Bool {
        guard canStart else { return false }
        self.session = session; rootPath = session.rootPath
        reviewed = nil; plan = nil
        transition(.reviewing, "读取并验证签名清单，尚未下载包。")
        operation = Task {
            defer { operation = nil }
            do {
                let result = try await session.review(request)
                try Task.checkCancellation()
                reviewed = result
                transition(.awaitingConfirmation, "清单已验证。请确认版本、hash 和隔离范围后下载。")
            } catch {
                if String(describing: error).contains("cleanup-unconfirmed") { transition(.unknown, "清单读取清理未确认：\(error)") }
                else if Task.isCancelled { transition(.cancelled, "已取消清单读取；没有安装。") }
                else { transition(.failed, "清单验证失败：\(error)") }
            }
        }
        return true
    }
    @discardableResult public func confirm() -> Bool {
        guard canConfirm, let reviewed, let session else { return false }
        transition(.downloading, "下载中；可取消。只会写入私有临时文件。")
        operation = Task {
            defer { operation = nil }
            do {
                let archive = try await session.transfer(reviewed)
                try Task.checkCancellation()
                transition(.verifying, "校验包 hash、归档和全部文件；尚未提交。")
                await Task.yield()
                try Task.checkCancellation()
                let prepared = try session.validate(reviewed, archive: archive)
                try Task.checkCancellation()
                transition(.applying, "提交合成安装／生成计划。此短阶段不可取消。")
                guard let receipt = try session.apply(prepared) else {
                    transition(.unknown, "结果未知：未取得完成回执。保留合成目录，不能报告可用。")
                    return
                }
                plan = session.plan
                switch receipt.state {
                case .skillInstalledInSimulation: transition(.simulationComplete, receipt.message)
                case .pluginPlanOnly: transition(.pluginPlanOnly, receipt.message)
                case .cancelled: transition(.cancelled, receipt.message)
                case .failed: transition(.failed, receipt.message)
                default: transition(.unknown, "结果未确认：\(receipt.message)")
                }
            } catch {
                let cleanupUnconfirmed = String(describing: error).contains("cleanup-unconfirmed")
                if cleanupUnconfirmed || state == .applying {
                    transition(.unknown, "结果或清理未确认：\(error)。不能报告成功。")
                } else if Task.isCancelled {
                    transition(.cancelled, "下载／校验已取消；没有提交安装。")
                } else {
                    transition(.failed, "\(state == .verifying ? "归档校验" : "下载")失败：\(error)")
                }
            }
        }
        return true
    }
    public func cancel() {
        guard canCancel else { return }
        if state == .awaitingConfirmation { transition(.cancelled, "用户取消：未下载包、未安装。") }
        else { transition(.cancelling, "正在取消并等待临时文件清理。") ; operation?.cancel() }
    }
    /// Used by the UI cleanup button and deterministic tests, never while applying.
    public func cleanup() async {
        guard canCleanup, let session else { return }
        transition(.cleaning, "清理本次合成目录。")
        do {
            try await session.cleanup()
            self.session = nil; reviewed = nil; plan = nil; rootPath = ""
            transition(.idle, "合成目录已清理；真实 DSH 未更改。")
        } catch { transition(.unknown, "清理未确认：\(error)") }
    }
    public func waitForOperation() async { await operation?.value }
}
