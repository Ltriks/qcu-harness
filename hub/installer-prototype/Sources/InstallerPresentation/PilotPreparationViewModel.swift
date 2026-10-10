import Foundation
import Combine
import InstallerCore

@MainActor public final class PilotPreparationViewModel: ObservableObject {
    public enum State: String { case idle, checking, reviewed, blocked, cancelled, executing, finished, unknown }
    @Published public private(set) var state: State = .idle
    @Published public private(set) var review: PilotReview?
    @Published public private(set) var message = "生产执行关闭。仅可由本机文件选择器准备目标；网页不能指定路径。"
    private let session: LocalPilotSession
    public init() { session = LocalPilotSession() }
    init(session: LocalPilotSession) { self.session = session }
    public var canConfirm: Bool { state == .reviewed && session.executionEnabled }
    public var canChoose: Bool { state == .idle }
    public func chooseLocally() {
        guard canChoose else { return }
        guard let selection = LocalPilotSelection.chooseLocally() else { state = .cancelled; message = "已取消选择，未改动目标。"; return }
        prepare(selection)
    }
    // Typed selection has no public path initializer and no URL-event binding.
    public func prepare(_ selection: LocalPilotSelection) {
        guard canChoose else { return }
        state = .checking
        do {
            review = try session.prepare(selection)
            state = .reviewed
            message = session.executionEnabled ? "合成目标已核验；确认仅执行伪 CLI。" : "目标预检完成；生产执行仍未启用，不能确认安装。"
        } catch {
            review = nil; state = .blocked
            let code = (error as? InstallerError)?.description ?? "target-preflight-failed"
            message = "预检阻止：" + code + "。未授权、未安装。"
        }
    }
    public func confirm() {
        guard canConfirm, let review else { return }
        do {
            let token = try session.confirm(review)
            state = .executing
            switch try session.execute(token) {
            case .installationVerified(let text): message = text; state = .finished
            case .unknown(let text): message = text; state = .unknown
            }
        } catch {
            message = "执行未确认：" + ((error as? InstallerError)?.description ?? "execution-failed")
            state = state == .executing ? .unknown : .blocked
        }
    }
    public func cancel() {
        guard state != .executing && state != .finished else { return }
        session.cancel(); review = nil; state = .cancelled; message = "已取消本次授权，未启动安装。"
    }
}
