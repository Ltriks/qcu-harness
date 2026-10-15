# QCU市场安装包准备（可选维护候选）

教师入口已改为 [Hub 网页三步安装流程](qcu-hub-teacher-install.md)，当前网页为本地候选，未部署。教师安装官方 DSH、复制固定市场地址、在官方界面添加；后续产品在 DSH 内 QCU 市场安装。网页还提供无需解压的本地 TGZ 备选，不要求运行准备器、Python、Node、终端或新建 Home。

下文保留独立准备器的历史功能、证据与维护操作。它不再是教师前置；源码、应用内 README 和不可变归档保持原样，本轮不再修订应用，也不把 Developer ID 签名/公证当成教师入口的待交付工作。

准备器 `0.1.0-bootstrap.1` 与市场 `0.1.0-pilot.9.1` 是两个版本。当前支持基线：官方 DSH `0.2.0-rc.2`、Apple Silicon Mac、校园局域网。

最终候选产物位于开发机 `$HOME/Artifacts/qcu-harness/0.1.0-bootstrap.1/final/`。ZIP 的完整文件名、字节数和哈希见[交付检查](qcu-market-preparation-parent-validation.md)。解压目录含 `QCU市场安装准备器.app`、`先读我.md`、命令行脚本、`MANIFEST.json` 和 `SHA256SUMS`。维护者已直接传至 mini 并解压验证，无需用户手动传包；尚无 Hub 下载入口，不是公开发行版。

## 历史准备器流程（供维护者参考）

1. 连接校园局域网，双击 **QCU市场安装准备器.app**。工具自动下载、校验；已经存在的有效包直接复用。等待“安装包已准备好”。
2. 点击 **复制安装路径**。自行打开官方 DSH，进入 **插件 → 添加插件**，粘贴该路径。
3. 核对 **QCU市场 / 0.1.0-pilot.9.1** 与来源后，按官方流程安装。安装与启用各自确认；按官方提示自行重启。后续模型与教学任务见[安装指引](qcu-market-p9-install-guide.md)。

“稍后”不会复制路径。准备成功仅表示固定文件通过校验，**不表示 DSH、市场已安装或启用**。工具不启动或检查 DSH，不读取配置、账号或 API Key，也不调用模型；教师继续使用自己的模型设置。

这是仅有本地 ad-hoc 签名、无 Developer ID 签名、未公证的本地 app。遇到系统安全提示请联系维护者，不绕过 Gatekeeper。父线程已独立验证开发机原生准备完成对话框并截图，以及 mini 的真实下载和缓存复用。桌面控制工具点击与重新绑定窗口超时，剪贴板复制、稍后退出、暗色显示与 mini 原生窗口仍未完成验证；未通过本准备器执行 DSH 安装/启用。详见[交付检查与手动步骤](qcu-market-preparation-parent-validation.md)。

## 文件保留与失败处理

默认安装文件在本人 `~/Library/Application Support/qcu/market-packages/`，不放在临时目录或 DSH Home。请长期保留：官方包管理器可能在后续操作中引用这个路径。

- 下载未完成：确认校园局域网连接后，再次打开准备器。
- 已有包损坏、校验失败或保存期间发生变化：工具保留原文件并停止，联系维护者核对；不要自行覆盖、删除锁或降低校验要求。
- 保存目录不安全：联系维护者选择本人私有普通目录。目录祖先不能是符号链接、非目录、非本人/系统所有或允许其他用户写入；最终目录须为本人私有。额外 allow ACL 也保守拒绝，不自动改权限。

有效旧环境更新市场时，可使用网页下载同字节本地 TGZ，再走官方安装；准备器仅作为维护者的可选准备方式。**本工具不能修复已经缺失 integrity 的锁文件**。若已有 `ERR_PNPM_MISSING_TARBALL_INTEGRITY`，停止并保留错误供维护者检查，不删除锁、清缓存、降低校验或反复重试。依据与边界见[缓存机制复现](qcu-market-p9-cache-integrity-reproduction.md)。不要求已经有有效市场的环境重复安装。

## 固定来源与维护者命令

固定引用：[P9 TGZ](http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz)，43446 字节，SHA256 `ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12`，市场源码提交 `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3`。准备器不捆绑 TGZ，不信任远端 manifest，不接受 URL、版本、大小、哈希覆盖。

历史准备器运行无需 Python、Node、npm 或 rtk；只依赖 macOS 自带 shell、curl、哈希工具和 AppleScript。以下为维护者历史测试/打包参考，开发机使用 Python 标准库和系统 osacompile，不安装依赖；本轮不重新打包或再生成归档。

```sh
# 新输出目录，父目录须已存在；旧目录拒绝覆盖
rtk proxy /usr/bin/python3 scripts/pack-qcu-market-prepare.py \
  --out "$HOME/Artifacts/qcu-harness/0.1.0-bootstrap.1/另一个唯一候选目录"

rtk proxy /usr/bin/python3 tests/test_qcu_market_prepare.py \
  --scratch-parent "$HOME/Artifacts/qcu-harness/0.1.0-bootstrap.1" -v

# 以下是候选包内的操作员入口，不需要 rtk
/bin/bash ./prepare-market.sh --json
/bin/bash ./prepare-market.sh --path-only
/bin/bash ./prepare-market.sh --json --destination-directory "/Users/本人/私有安装包"
```

JSON 区分工具/市场版本，包含固定字节数/哈希、本地路径、`new` 或 `reused`，始终如实声明 `installed:false`、`enabled:false`、`official_confirmation_required:true`。失败非零，返回 `USAGE`、`UNSAFE_PATH`、`CACHE_INVALID`、`DOWNLOAD_FAILED`、`INTEGRITY_FAILED`、`PUBLICATION_RACE`、`CANCELLED` 或 `IO_ERROR`，没有成功路径。调用方可自行以排他新文件捕获 stdout；工具不写额外报告，不覆盖旧报告。

curl 首参数 `-q`，空环境并显式禁用代理，不携带认证或 Cookie；只取固定 LAN HTTP 地址、不跟随重定向，请求 identity 编码并拒绝响应的其他编码。连接/总时限为 5/30 秒，curl 大小限制与进程文件大小上限共同约束输出。仅 HTTP 200、精确大小和 SHA256 全部通过才发布。普通文件、属主、权限、ACL、祖先路径与 inode/哈希均复核，通过 macOS `link(1)` 原子创建最终路径；已存在的任何目标都不覆盖，失败/信号只清理本次私有 partial。此设计不承诺抵抗任意同用户权限的恶意进程。

清单记录源文件哈希、实际 app 文件字节/哈希/权限和固定来源。脚本源码复制可确定，编译 app 每次测量，不宣称逐字节可复现。最终资源写入后，以系统 codesign 做本地 ad-hoc 签名，并通过 deep/strict 完整性校验；不用 Developer ID、证书、密钥或网络时间戳，不更改 Gatekeeper/隔离设置。测试使用机械替换固定常量的临时副本连接本机合成 HTTP，不访问真实 Hub，不修改生产默认值。源码、下载机制、编译与文件校验通过不能替代 app 原生 UI、实际 Hub 下载和官方安装/启用的独立验收。
