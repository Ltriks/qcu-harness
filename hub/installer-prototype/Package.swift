// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "QCUInstallerPrototype",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "QCUInstallerDemo", targets: ["InstallerDemo"])],
    targets: [
        .systemLibrary(name: "SystemZlib"),
        .target(name: "NativeProcess"),
        .target(name: "InstallerCore", dependencies: ["SystemZlib", "NativeProcess"]),
        .target(name: "InstallerPresentation", dependencies: ["InstallerCore"]),
        // TEST ONLY: no signing private key belongs in InstallerCore.
        .target(name: "DemoFixtures", dependencies: ["InstallerCore"]),
        .executableTarget(name: "InstallerDemo", dependencies: ["InstallerCore", "InstallerPresentation", "DemoFixtures"]),
        .testTarget(name: "InstallerCoreTests", dependencies: ["InstallerCore", "InstallerPresentation", "DemoFixtures"], resources: [.copy("Fixtures")]),
    ]
)
