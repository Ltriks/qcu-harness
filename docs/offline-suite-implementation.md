# 离线完整套件实施记录

2026-10-21补充：四个现有发布包已另存到主仓库根目录 `releases/`，固定位置、用法与当前版本区别统一见[发布交接记录](../../../releases/README.md)。本页原路径作为构建/验证证据保留，原件未删除。

2026-10-20，用户已明确 Windows x64 与 macOS Apple Silicon 分别出包；WorkBuddy 采用人工导入。当前分支 `dev/qcu-offline-release`，基线 `1012167`。不覆盖已有发行包、不改默认 DSH home、不包含本人凭据。

## 固定输入

- 官方 Mac 客户端 0.2.0-rc.2，369764183 字节，SHA256 `7c32c459c403d8a035ac60600f240ed2025312f0a7afde283f454f30ec4ed96e`。来自此前归档、摘要与官方固定 URL 相符。已只读挂载；沙箱外 `codesign --verify --deep --strict` 通过。沙箱内曾误报 invalid signature，不能据此认定副本已修改。
- 官方 Windows x64 客户端 0.2.0-rc.2，289313640 字节，SHA256 `d61cd8882f8b8a1251144320493ad27920d15139503eba2465b9579eee720cfc`。本轮从官方固定 HTTPS URL 获取。NSIS 包内载荷 `app-64.7z` 已在本地解出用于隔离验证，不作为改包发行。
- 十个固定产品见 `release/offline-products.json`：七项 Skill、市场14.1、工作台1.2、飞书1.1。经包内 metadata 核对均只有 peerDependencies、无额外 dependencies/optionalDependencies/安装脚本，且各一个组件。未混入未发布工作台1.3候选。
- WorkBuddy 七项人工导入总包 SHA256 `168507c26cc841689f3685bf766323b17b5271fbd8fa9a81bafe7f317815882a`，实际导入及模型效果仍待用户验收。
- 原生 Lark CLI 1.0.84，两平台官方发布归档与其校验清单匹配；采用 MIT 并保留许可证。用户自己的授权独立配置，不随包分发。

## 实现

`scripts/build-offline-suite.py` 从已取得输入构建平台套件及确定性 ZIP；`tools/offline-suite/offline.cjs` 使用官方应用内 Electron/Node、app-boot 初始化 API 和 `runProfilePnpm` 安装本地固定归档，传 `--offline --ignore-scripts`、独立空配置与独立 store，不安装 npm 包管理器或 Node。

默认数据目录为当前用户的 `QCU-DSH/offline/0.1.0-rc.1`。全部包先安装但不启用，再由使用者独立确认启用七项技能与市场。课程和飞书另行在官方设置启用。启用写标准 profile 用户补丁和公开 `writeProfileBundles`，不改包内 patch、不改用户原环境。已有相同套件仅核对版本；其他已有内容不覆盖。

两平台使用本机 `.command` / `.cmd`；Windows 发行流程不要求 PowerShell、Python、npm 或 ExecutionPolicy Bypass。提供专用启动入口与离线开始页、许可及验收说明。

## 验证结果

- 6 项 Node 测试通过：路径逃逸、损坏、链接、平台、重复记录、已有目录保护。
- Mac 官方镜像内运行时已在全新空 store 下安装10包。强化测试通过命令行 preload 在父进程和实际 pnpm 子进程安装网络阻断，CLI 本身 `--offline`。
- Mac 实际官方 Skills 注册表在独立冷进程中成功发现七项提供方并读取正文；十个已安装模块都完成真实导入。未调用模型、未运行原生 GUI。
- Electron 不接受子进程 NODE_OPTIONS 时不能据此声称网络阻断生效；测试已改为对子进程显式传 `--require`。最终应检查 guard 日志确有 pnpm.mjs 条目。
- Mac 最终候选的安装、启用、重复安装、冷进程技能读取和 Lark1.0.84均通过。重复安装前添加用户注释，以字节摘要确认配置未改写；官方 `readProfilePatches` + `composeEntries` 在新进程中确认七项技能和市场共八个组件已启用。
- Windows 在当前用户的全新 `QCUOfflineTests` 命名空间下验证；官方安装器和应用 Authenticode 均为 Valid。通过 host-only 网桥严格白名单传输公开文件，分别核对 SHA256。官方 x64 运行时完成空缓存安装10包、启用、重复安装保留用户配置、冷进程实际导入10模块及七项技能读取，Lark CLI1.0.84通过。实际 pnpm 子进程 guard 日志存在且没有 blocked 事件。
- Windows 环境为 ARM64 Windows11 虚拟机上的 x64 仿真，不能描述为原生 x64 硬件验收。安装器的 peer 提示源于使用客户端自带运行时提供 peer；没有临时下载 peer，以真实模块导入和实际 Skills 注册表检查验证解析。
- 虚拟机过长 EncodedCommand 出现未启动的停顿，后以短命令完成；这属于测试调度，不是发行流程。接收人的 `.cmd` 不使用 PowerShell。未禁用网络、修改防火墙或变更共享权限。
- 离线 HTML 开始页已通过本机 HTTP 预览核对排版与三步安装内容，不依赖远程字体或资源。

测试候选位于 `.work/staging4`，Mac manifest SHA256 `c8004a8f0a42782c5ae57a88e14bccd790a17e4dd63f308c96c0318e7af7cd2a`，Windows `b504872afe4af4f43f34da79deaf1dd74ed998a62d50d150423477a18833bd5c`。最终套件仅补入本轮实际验收说明，运行时代码及客户端、十个产品、WorkBuddy 包、原生 CLI 与已测试候选保持相同字节；最终摘要及交付路径见 `.work/releases/0.1.0-rc.1/delivery.json`。接收人原生 GUI、官方安装界面、模型及 WorkBuddy 实际导入仍待验收，不提前声称正式发布验收完成。

## 构建与维护

固定输入放入独立输入目录，按 `release/offline-products.json` 核对来源和摘要，另放两项 Lark 官方归档、其 LICENSE 和已验证 WorkBuddy 总包。构建不联网、不访问本机 DSH 用户数据：

```sh
python3 scripts/build-offline-suite.py --inputs .work/inputs --out .work/releases/0.1.0-rc.1/QCU-DSH-Offline-0.1.0-rc.1-mac-arm64 --target mac-arm64 --zip
python3 scripts/build-offline-suite.py --inputs .work/inputs --out .work/releases/0.1.0-rc.1/QCU-DSH-Offline-0.1.0-rc.1-win-x64 --target win-x64 --zip
node --test tests/offline-suite.test.cjs
```

输出目录必须不存在；更换任何固定版本、客户端或依赖都要重新核对完整依赖闭包、官方运行时兼容与新环境安装。最终 ZIP 不含测试 home、测试 VM 载荷、开发账号或密钥。源码本轮未提交、推送或部署 Hub。

本任务创建的只读镜像挂载 `.work/mac-dmg-mount` 已卸载（disk6 ejected），临时 host-only 传输服务51916和本机预览51917均已停止。Windows 提取载荷 `.work/windows-extract/$PLUGINSDIR/{app-64.7z,dsh-7za.exe}` 与隔离测试目录保留作为验收证据；不接触现有用户应用或凭据。
