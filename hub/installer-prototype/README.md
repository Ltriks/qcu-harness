# 城院薄安装助手：隔离原型

基于 `ab362184c917554354486cd13d300f4c934be138` 开发，目标为 Apple Silicon Mac 上的官方 DSH **0.2.0-rc.2**。当前只交付可测试核心和原生交互样例，**不能安装到真实 DSH**。不修改 DSH 源码或线上 Hub，不注册系统协议、不监听网络、不创建生产信任、不访问 API Key/聊天。

技术选择：Swift 6、SwiftUI、Foundation URLSession、CryptoKit 和系统 zlib，最低构建目标 macOS 14。无额外下载的依赖；未来签名的本机应用可独立分发，无需老师安装 Node/pnpm。当前开发构建需要 Swift 工具链；已组装本地 arm64 开发应用包；尚未验证最低 macOS、启动效果、签名、公证或分发。

## 当前可以演示什么

原生窗口的“开始演示”按钮提供纯 Skill / Host 插件及慢下载、下载失败、hash/签名失败场景。显示签名校验后的包名、版本、来源、SHA-256、能力风险，勾选并点击本机确认后：

- 纯 Skill 仅写入新建私有临时目录的 `synthetic-dsh-home/skills/<id>`。不会读取 `DSH_HOME` 环境变量或采用传入目录，不会调用 DSH 验证加载。
- Host 插件安全解包后，仅生成官方随包 CLI 的 executable + argv 计划，状态恒为 `pluginPlanOnly`；真实执行函数始终抛错。不会写 `profiles/desktop`，不会修改 bundle/row 开关。测试包的 `disabled:true` 字节保留。
- 取消发生在确认/提交前；提交阶段同步且不宣称可取消。重复请求不会重复写入；同 requestID 不可更换身份或清单；同版本不可更换包 hash。
- Skill 更新只覆盖助手在合成目录内标记的同目录来源/同包目录。失败恢复旧目录；事务备份保留。中断的 staging/applying 记录变为 `recoveryRequired`，不推断成功、不自动重试、不复用审批。

`hub-request-demo.html` 可离线展示 Hub 的四字段请求。按钮只产生请求文本，不跳转协议、不联网。原生样例的 `onOpenURL` 仅接收严格解析后的请求并报告“生产目录信任未配置”；不凭 URL 安装任何内容。完整浏览器 → OS → 助手端到端尚未打通。

下载核心已独立实现：`DownloadClient.fetchManifest` 从预绑定 origin 的固定 `/manifests/<package>@<version>.json` 取得有界清单并验签；本机确认生成 5 分钟单次下载许可后，`download` 使用 URLSession 下载清单绑定的不可变 URL，写私有临时文件、累计 SHA-256，再回读核对和重新验证清单有效期。所有重定向均拒绝，禁用 Cookie/缓存/HTTP 凭据回退，使用系统 TLS 信任；限制响应声明和实际字节、总超时，支持 Task 取消。结束/失败/取消均删除临时文件，删除未确认会报错而不返回成功。默认超时 30 秒；生产配置只允许 HTTPS，显式 test catalog 才允许带端口的 `http://127.0.0.1`。原生窗口已通过 InstallerViewModel 接入此核心：一次本机勾选确认明确覆盖下载和该清单的合成安装/计划；下载和归档校验后才提交。演示用进程内 URLProtocol 提供合成响应，不使用外部网络或监听；测试另用临时 loopback 验证真实 HTTP 传输。取消等待清理完成；没有完成回执或清理未确认时显示结果未知，不报告成功。

## 自行启动演示（本轮未执行 UI）

在本目录执行：

```sh
swift test
node --test checks/hub-demo.test.mjs
swift run ChengyuanInstallerDemo
```

最后一条仅在希望查看原生窗口时手动执行。它不是正式应用安装，不注册 scheme；首次按模拟按钮才创建合成目录。窗口有清理按钮。直接关闭窗口会保留临时日志/备份，供诊断；不要把这些目录当真实安装记录。Node 仅用于离线 HTML 合同测试，原生程序不依赖它。

本机默认 CommandLineTools 缺 XCTest，已通过命令级 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` 选择安装的 Xcode 工具链完成测试，未更改系统 `xcode-select`。遇到同类问题，可在以上 Swift 命令前加该环境变量，并通过 `xcrun swift` 调用。

受限构建环境可把编译缓存放到本目录（不是 DSH 配置）：

```sh
CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache" \
swift test --cache-path .build/cache
```

若嵌套 sandbox 被执行环境拒绝，需由该环境批准构建/测试；不禁用产品安全边界。原生窗口尚未实际启动/视觉验收，测试结果见 [VALIDATION.md](VALIDATION.md)。

## 合同与信任边界

入口 JSON 必须恰好包含 `catalogID/packageID/version/requestID`；拒绝未知字段、路径、重复 URL 参数、非规范 UUID。拟议自有 URL 为 `chengyuan-install://request?...`；没有安装/注册该协议。官方 `dsh://open` 仅聚焦窗口。

`CatalogTrust` 是未来随签名应用或管理流程预置的 **catalog → HTTPS origin → keyID/public key** 配置接口，绝不来自请求或待验 manifest。生产默认没有任何可信 key；`test-*` key/catalog 仅在显式 fixture 模式使用。DemoFixtures 的公开固定测试种子任何人都能签名，不能用于生产；生产目标必须排除整个 DemoFixtures 模块。没有写入密钥、系统钥匙串、配置或持久生产授权。

Envelope 是 `{keyID,payload,signature}`，后两项为 base64；Ed25519 签名覆盖 payload **原始 JSON 字节**，先验签再解析。当前清单 **schema 2** 增加必须的 `archiveFormat: tar|tgz|zip`，旧原型 schema 1 拒绝；没有修改现有线上 catalog 合同。清单绑定 catalog/包/版本、明确 DSH 版本、类型/风险、有效期、同源不可变文件名、完整归档 hash/字节数和全部文件 hash/大小。确认是内存中单次随机能力，绑定 requestID + 清单摘要，5 分钟过期，不写入磁盘；拒绝跨清单、跨请求、核心重建后的复用。

支持无压缩 ustar、单成员 gzip/ustar TGZ，以及 ZIP32 的 stored/deflate 子集。使用系统 zlib 有界流式展开，不调用 shell/tar/unzip。只允许常规文件、受限 ASCII 路径，无链接/目录条目/设备/可执行位；TGZ 拒绝 PAX/GNU 扩展、拼接 gzip、尾随数据，ZIP 拒绝加密、data descriptor、extra fields、ZIP64、分卷、注释，并核对中央目录/本地头、CRC、尺寸、文件集合和 hash。归档输入上限 8 MiB，解压出的 tar 容器上限 8 MiB，文件内容合计 4 MiB，单文件 1 MiB、100 文件；不信任压缩头声明尺寸。先完整验包，再写合成目标；目录 0700、文件 0600。这是明确受限的格式支持，不承诺接受任意 ZIP/TGZ。

固定 `qcu-study-coach@0.1.0-pilot.1` 原 TGZ（SHA-256 `76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c`）已逐成员对照 canonical 源码/确定性生成内容，只读审计和临时下载/解包/CLI-plan 测试通过。JS 从未加载，`disabled:true` 保持原字节。纯 Skill ZIP fixture 已完成真实 deflate/stored 解析到合成 Home 的路径。测试公钥只为这些内容提供隔离测试 envelope，不构成对原包的生产签名或安装授权。

纯 Skill 仅接受 UTF-8 `.md/.txt`，核对 SKILL.md frontmatter 身份。它仍可影响模型行为，文本审核不是沙箱授权。Plugin package.json 仅接受小范围字段，无依赖/脚本字段；允许的精确 peer 仅 Cordis 4.0.4 和 dsh-skill 0.2.0-rc.2，既不批准构建脚本也不豁免兼容性。Host 代码有宿主用户权限，签名不是代码隔离。此次不执行其 JS/YAML。

## 明确未实现

- 生产 catalog 签名发布/轮换/撤销和真实 HTTPS 部署验收、原生 UI 视觉验收。系统 TLS 正常验证，未在本轮向外部服务器发请求；本轮网络测试均为临时 loopback HTTP。`DownloadedArchive` 值对象的手工构造本身不能证明 TLS 来源；网络来源由 DownloadClient 负责。
- 现有 Hub `catalog.json` 到签名 schema 2 的发布转换。旧 SHA-256 目录不能自动升级成可信签名源；固定 TGZ 字节已兼容，仍需可信签名 envelope 的受审分发。ZIP 的未支持扩展需拒绝或经审核重新打包；不会静默降级到不安全解包工具。
- 真实 Home 选择/检测与安装、官方 CLI 执行/进程生命周期、DSH inventory/skill 调用验证、实际重启状态；无 shell、任意命令、HTTP 安装桥。
- 自动启用 row、覆写既有用户选择、自动更新/降级、跨进程/并发安装锁、断电持久性保证。事务用原子文件写/同卷 rename；不是 fsync 级断电事务。进程中断可通过同一 SimulationEnvironment 的新核心实例识别未知状态，但尚无磁盘 root 导入/应用重开恢复 UI。
- 本机原生确认防欺骗、签名/公证、系统 scheme handler 安装及浏览器到 OS 跳转验收。同用户恶意进程/篡改私有目录不在原型隔离保证内。

## 官方适配依据与下一次试点

官方基线 `639ed015397290b3745d163aafe02ffee4aa3f84`：

- [Desktop README L89–97](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/README.md#L89)：随包 CLI、初始化后完整退出、管理 desktop profile 后重开；npm dsh 不能替代。
- [tools.ts L21–43](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/boot/plugin-manager/src/tools.ts#L21)：模型工具每次提升审批，不改变会话权限。助手 CLI 路线是用户授权本地安装器的另一入口，不能冒充已获得工具审批。
- [skills.md L64–85](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/subsystems/skills.md#L64)：官方用户目录扫描和 watcher；文件落盘不等于实际调用成功。
- [manager L425](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/boot/plugin-manager/src/index.ts#L425)：bundle 选择与 row 开关分离；替换包/无 HMR 时需按返回状态重启。

真实试点仍不就绪：原生下载状态/取消已接通，本地应用包已生成但没有启动。生产信任与真实 CLI 适配接口边界见 [INTERFACES.md](INTERFACES.md)。下一轮唯一最小待批准动作：打开本地演示窗口，完成一次纯 Skill 合成下载确认→取消的视觉验收；不注册协议、不操作真实 DSH、不安装到真实 Home。后续真实安装/启用试点、签名公证、生产 trust 与线上发布均不在本轮范围。

## 本地构建产物与交互说明

通过测试编译后运行 `python3 checks/build-demo-app.py`，只组装 `.build/artifacts/ChengyuanInstallerDemo.app`，不启动、不签名、不注册协议。产物是本机开发构建，不是可分发的正式安装器；Info.plist 没有 CFBundleURLTypes。

获准视觉演示后，打开该应用，选择“纯 Skill”并开始；检查签名清单中的版本、来源、hash 与隔离范围，勾选后确认下载，可在下载期间取消。终态后用“清理合成目录并重置”。若需更长取消窗口选择慢下载。插件场景只显示未执行的 CLI 计划。所有成功文字限定合成目录，不能据此声称 DSH 内已可用。直接关闭窗口不保证暂存清理，尚无重开恢复 UI。

CLI执行核心现已提供仅限新建合成目录的伪CLI集成测试；生产执行门仍固定拒绝。已实现/仍为接口的精确边界见 [INTERFACES.md](INTERFACES.md) 文末。既有本地.app仍为01845695构建，本轮没有重新打包或启动它。
