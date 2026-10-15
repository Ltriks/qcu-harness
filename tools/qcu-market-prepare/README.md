# QCU市场安装准备器

本地候选工具 `0.1.0-bootstrap.1`，准备 QCU市场 `0.1.0-pilot.9.1`。适用官方 DSH `0.2.0-rc.2`、Apple Silicon Mac 和校园局域网。

1. 连接校园局域网，双击 **QCU市场安装准备器.app**，等待准备完成。
2. 点击 **复制安装路径**，自行打开 DSH，在 **插件 → 添加插件** 中粘贴。
3. 核对市场名称、版本与来源后，按官方流程安装；**启用另行确认**。

工具只准备文件，不安装 DSH，不安装或启用市场，不启动 DSH，不访问账号、配置或 API Key。选择“稍后”不会修改剪贴板。保留已准备的文件：官方包管理器可能长期引用它。默认位置为本人 `~/Library/Application Support/qcu/market-packages/`。

这是仅有本地 ad-hoc 签名、无 Developer ID 签名、未公证的本地候选，尚待原生 UI 和实机验收，不是公开发行版。遇到系统安全提示请联系维护者，不绕过 Gatekeeper。下载失败先确认局域网；校验失败或已有文件损坏时，原文件保留，请联系维护者。本工具不能修复已经损坏的 DSH 锁文件。

维护者命令行（系统 Bash，无需 Python/Node/npm/rtk）：

```sh
/bin/bash ./prepare-market.sh --json
/bin/bash ./prepare-market.sh --path-only
# 显式私有目录；祖先须为普通目录且不允许其他用户写入，最终目录须为本人私有
/bin/bash ./prepare-market.sh --json --destination-directory "/Users/本人/私有安装包"
```

默认 JSON 包含新下载/复用、路径、版本、固定字节数/SHA256，以及 `installed:false`、`enabled:false`、`official_confirmation_required:true`。失败返回非零和稳定代码。目录或文件存在额外的 allow ACL 时也保守拒绝，不修改已有权限。需要报告可由调用方捕获 stdout，并用 shell noclobber 等方式拒绝覆盖旧报告。工具本身没有报告文件写入选项，也没有下载地址、版本或校验值覆盖选项。

固定市场来源提交 `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3`，43446 字节，SHA256 `ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12`。固定来源：`http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz`。工具不含 TGZ，仅下载并验证这一个已审核包。

随包 `MANIFEST.json` 记录源码与实际构建文件哈希、权限、ad-hoc 签名与验收边界；`SHA256SUMS` 覆盖清单及其他文件。构建使用系统 osacompile，在最终资源写入后用系统 codesign 做本地 ad-hoc 签名并校验，不使用证书、密钥或网络时间戳。源码复制可确定，编译 app 不宣称逐字节可复现。私有目录、原子发布和复核用于降低误操作与竞争风险，不承诺抵抗同一用户权限下的任意恶意进程。
