// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ChengyuanInstallerPrototype",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "ChengyuanInstallerDemo", targets: ["InstallerDemo"])],
    targets: [
        .target(name: "InstallerCore"),
        // TEST ONLY: no signing private key belongs in InstallerCore.
        .target(name: "DemoFixtures", dependencies: ["InstallerCore"]),
        .executableTarget(name: "InstallerDemo", dependencies: ["InstallerCore", "DemoFixtures"]),
        .testTarget(name: "InstallerCoreTests", dependencies: ["InstallerCore", "DemoFixtures"]),
    ]
)
