import Foundation
// Fixed reviewed artifact, no key or trust configuration supplied by a webpage.
enum PilotPackage {
    static let hash = "76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c"
    static let files = [
        FileRecord(path: "package/README.md", sha256: "fb7de0a3c443ea2fe8815dc975029b4d7a2a61d6a38f568db8e909c40ab00701", bytes: 1479),
        FileRecord(path: "package/SOURCE.json", sha256: "3fa19020091b4f346b8e0a62fe5700440408cef4c1f1e124913839475f5f339f", bytes: 518),
        FileRecord(path: "package/cordis.patch.yml", sha256: "31c48d98144596188b81ef359a7033a5d7426484217e7924ca681b633fa08482", bytes: 200),
        FileRecord(path: "package/index.js", sha256: "1ab715baabee23aa653220355616e6012db002cc8a7b1d68b8e209f2cf5fbc6d", bytes: 302),
        FileRecord(path: "package/package.json", sha256: "7d526007abe82b2f01d574adc4e6f1c5c53e45bbc35575e6a61450d3c2d16daf", bytes: 618),
        FileRecord(path: "package/provider.js", sha256: "21c7fb3254c040c4c6c2cac781a8e8919fb9be03537da83d8ad10bfbdf9a8d66", bytes: 1057),
        FileRecord(path: "package/skill-content.js", sha256: "94c101dba57b9846b1f28c452e3eec232a850b434f84e8a3ba09b4eed0abd4df", bytes: 1505),
        FileRecord(path: "package/skills/chengyuan-study-coach/SKILL.md", sha256: "dfd2fac7624c2f46f0bdcb15c7ea475156082d538b44d023f39b7e445e42de32", bytes: 1437)
    ]
    static let manifest = ReleaseManifest(schema: 2, catalogID: "qcu-reviewed-offline", packageID: "qcu-study-coach", version: "0.1.0-pilot.1", title: "学习方法教练", kind: .plugin, archiveURL: "offline-local-selection", archiveFormat: .tgz, sha256: hash, bytes: 3331, files: files, expiresAt: 0, dshVersion: "0.2.0-rc.2", dependencies: [], installScripts: false, authority: "host-code")
}
