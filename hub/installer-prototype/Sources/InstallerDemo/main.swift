import SwiftUI
import InstallerCore
import DemoFixtures

@main
struct InstallerDemoApp: App {
    var body: some Scene {
        WindowGroup("城院安装助手 · 隔离原型") { InstallerView() }
            .defaultSize(width: 700, height: 650)
    }
}

struct InstallerView: View {
    @State private var installer: Installer?
    @State private var prepared: PreparedInstall?
    @State private var status = "尚未创建测试目录。选择一个合成包开始；不会连接 Hub 或真实 DSH。"
    @State private var accepted = false
    @State private var canConfirm = false
    @State private var plan = ""
    @State private var root = ""
    @State private var environments: [SimulationEnvironment] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("城院安装助手").font(.largeTitle.bold())
                Text("隔离演示 · 不安装到真实 DSH").font(.headline).foregroundStyle(.orange)
                Text("① Hub 发起　→　② 本机确认　→　③ 校验与暂存　→　④ 明确状态")
                HStack {
                    Button("模拟 Hub：纯 Skill") { prepare(.skill) }
                    Button("模拟 Hub：可执行插件") { prepare(.plugin) }
                }
                if let prepared {
                    let manifest = prepared.manifest
                    GroupBox("请核对本次安装内容") {
                        VStack(alignment: .leading, spacing: 9) {
                            Text(manifest.title).font(.title3.bold())
                            Text("\(manifest.packageID) @ \(manifest.version)")
                            Text("目录：\(manifest.catalogID)（仅测试信任）")
                            Text("来源：catalog.example.invalid · 测试包在内存提供")
                            Text("SHA-256：\(manifest.sha256)").font(.caption.monospaced()).textSelection(.enabled)
                            Text(manifest.kind == .skill
                                 ? "纯文本 Skill 会影响模型行为。本次仅写合成 Home，不调用模型。"
                                 : "Host 插件可在工作区沙箱外执行代码。本次只生成 CLI 参数计划；保留 row 原有禁用值。")
                            Text("无第三方依赖、无安装脚本；面向 DSH 0.2.0-rc.2。")
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(6)
                    }
                    Toggle("我确认以上版本、hash 和范围，仅进行隔离演示", isOn: $accepted).disabled(!canConfirm)
                    HStack {
                        Button("确认本次演示") { install() }.disabled(!accepted || !canConfirm)
                        Button("取消") { cancel() }.disabled(!canConfirm)
                    }
                }
                Divider()
                Text("当前状态").font(.headline)
                Text(status).textSelection(.enabled)
                if !root.isEmpty { Text("合成目录：\(root)").font(.caption.monospaced()).textSelection(.enabled) }
                if !plan.isEmpty { Text(plan).font(.caption.monospaced()).textSelection(.enabled) }
                Text("真实接入尚未实现：网络下载、系统 scheme 注册、真实 DSH Home 写入、CLI 执行、重启及调用验证。")
                    .font(.caption).foregroundStyle(.secondary)
                Button("清理本次会话全部合成目录") { cleanup() }.disabled(environments.isEmpty)
            }.padding(26)
        }.onOpenURL { url in
            do {
                let request = try InstallRequest.parseURL(url)
                status = "已解析结构化请求 \(request.packageID)@\(request.version)。生产目录传输未接入，未下载或安装。"
            } catch { status = "请求拒绝：\(error)" }
        }
    }
    private func prepare(_ kind: PackageKind) {
        accepted = false; canConfirm = false; prepared = nil; plan = ""
        do {
            let fixture = try Fixtures.make(kind: kind)
            let environment = try SimulationEnvironment()
            environments.append(environment); root = environment.root.path
            let engine = Installer(environment: environment, trust: fixture.trust)
            installer = engine
            prepared = try engine.prepare(request: fixture.request, envelope: fixture.envelope, archive: fixture.archive)
            canConfirm = true; status = "测试签名、来源、归档和文件 hash 已验证。等待本机确认。"
        } catch { status = "未完成：\(error)" }
    }
    private func install() {
        guard let installer, let prepared else { return }
        canConfirm = false
        do {
            let confirmation = try installer.confirmFromLocalUser(prepared)
            status = try installer.install(prepared, confirmation: confirmation).message
            if let cli = installer.lastPlan {
                plan = "计划（不执行）\nexecutable: \(cli.executable)\nargv: \(cli.arguments)\nDSH_HOME: \(cli.syntheticHome)"
            }
        } catch { status = "未完成：\(error)" }
    }
    private func cancel() {
        guard let installer, let prepared else { return }
        do { status = try installer.cancel(prepared).message; canConfirm = false } catch { status = "取消未确认：\(error)" }
    }
    private func cleanup() {
        do {
            for environment in environments { try environment.removeSimulation() }
            environments = []; installer = nil; prepared = nil; root = ""; plan = ""; canConfirm = false
            status = "合成目录已清理。"
        } catch { status = "清理未完成：\(error)" }
    }
}
