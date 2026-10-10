import SwiftUI
import InstallerCore
import InstallerPresentation
import DemoFixtures

@main
struct InstallerDemoApp: App {
    var body: some Scene {
        WindowGroup("城院安装助手 · 隔离原型") { InstallerView() }
            .defaultSize(width: 740, height: 730)
    }
}

struct InstallerView: View {
    @StateObject private var model = InstallerViewModel()
    @State private var selected: DemoScenario = .skill
    @State private var accepted = false
    @State private var transport: DemoTransport?
    @State private var setupError = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("城院安装助手").font(.largeTitle.bold())
                Text("隔离演示 · 不安装到真实 DSH").font(.headline).foregroundStyle(.orange)
                Text("合成数据经 URLSession → 签名校验 → 本机确认 → 下载校验 → 合成结果")
                HStack {
                    Picker("演示场景", selection: $selected) {
                        ForEach(DemoScenario.allCases, id: \.self) { Text($0.title).tag($0) }
                    }.disabled(!model.canStart)
                    Button("开始演示") { begin() }.disabled(!model.canStart)
                }
                if let reviewed = model.reviewed {
                    let manifest = reviewed.manifest
                    GroupBox("本次确认覆盖以下具体内容") {
                        VStack(alignment: .leading, spacing: 9) {
                            Text(manifest.title).font(.title3.bold())
                            Text("\(manifest.packageID) @ \(manifest.version)")
                            Text("目录：\(manifest.catalogID) · 公开测试 key，仅本次合成演示")
                            Text("来源：\(URL(string: manifest.archiveURL)?.host ?? "")")
                            Text("SHA-256：\(manifest.sha256)").font(.caption.monospaced()).textSelection(.enabled)
                            Text(manifest.kind == .skill
                                 ? "确认后下载并写入合成 Home。纯文本会影响模型行为；本次不调用 DSH。"
                                 : "确认后下载并生成官方 CLI 参数计划。Host 代码可在沙箱外运行；本次绝不执行，保留禁用状态。")
                            Text("DSH 0.2.0-rc.2；无第三方依赖或安装脚本。")
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(6)
                    }
                    Toggle("我确认这个版本、hash 与上述隔离范围", isOn: $accepted).disabled(!model.canConfirm)
                    Button("确认并下载") { _ = model.confirm() }.disabled(!accepted || !model.canConfirm)
                }
                HStack {
                    if [.reviewing, .downloading, .verifying, .applying, .cancelling, .cleaning].contains(model.state) {
                        ProgressView().controlSize(.small)
                    }
                    Text("状态：\(model.state.rawValue)").font(.headline)
                    Spacer()
                    Button("取消") { model.cancel() }.disabled(!model.canCancel)
                }
                Text(model.message).textSelection(.enabled)
                if !setupError.isEmpty { Text(setupError).foregroundStyle(.red) }
                if !model.rootPath.isEmpty { Text("合成目录：\(model.rootPath)").font(.caption.monospaced()).textSelection(.enabled) }
                if let plan = model.plan {
                    Text("未执行的计划\n\(plan.executable)\nargv: \(plan.arguments)").font(.caption.monospaced()).textSelection(.enabled)
                }
                Button("清理合成目录并重置") {
                    Task {
                        await model.cleanup()
                        if model.canStart { transport?.close(); transport = nil; accepted = false }
                    }
                }.disabled(!model.canCleanup)
                Divider()
                Text("演示数据由进程内 URLProtocol 提供，无外部联网或监听；使用实际 URLSession、签名/hash、归档与状态核心。真实目录入口拒绝未配置的信任；网页公钥不能授权安装。")
                    .font(.caption).foregroundStyle(.secondary)
                Text("系统协议、真实 Home、CLI 执行、DSH 重启及真实调用仍禁用。关闭窗口前建议取消并清理；应用强制退出后的暂存恢复 UI 尚未实现。")
                    .font(.caption).foregroundStyle(.secondary)
            }.padding(26)
        }.onOpenURL { model.receiveExternalURL($0) }
    }
    private func begin() {
        guard model.canStart else { return }
        do {
            accepted = false; setupError = ""
            let demo = try DemoURLProtocol.install(selected)
            let client = try DownloadClient(trust: demo.fixture.trust, fixtureProtocol: DemoURLProtocol.self)
            let session = try CoreInstallSession(client: client, trust: demo.fixture.trust)
            transport = demo
            _ = model.begin(demo.fixture.request, session: session)
        } catch { setupError = "演示初始化失败：\(error)" }
    }
}
