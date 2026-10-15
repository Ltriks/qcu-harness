# 市场安装准备器：交付检查与验收

2026-10-15，工具 `0.1.0-bootstrap.1`；市场固定为 `0.1.0-pilot.9.1`。分支 `dev/qcu-market-bootstrap`，基于 `f0c06ac8e23a7dbe7147a896f227bc5af4a22ecf`。这是本地候选，未发布 Hub；官方 DSH、市场源码、目录和不可变安装包均未改动。

## 交付行为

双击原生 app → 自动下载并校验固定市场包 → 显示准备完成 → 用户主动复制路径 → 官方“添加插件”中安装 → 另行确认启用。准备器不操作 DSH、不访问模型或凭据，不修改已有锁文件，不修复缺失 integrity 的坏锁。教师运行无需 Python、Node、npm 或 rtk。

默认长期缓存 `~/Library/Application Support/qcu/market-packages/`；有效文件复用，损坏文件保留并停止。下载连接/总超时 5/30 秒；只允许固定 LAN HTTP 地址、HTTP 200、43446 字节和固定 SHA256，无重定向、代理、认证或远端参数覆盖。

## 最终产物与位置

开发机：`$HOME/Artifacts/qcu-harness/0.1.0-bootstrap.1/final/`。

- ZIP：`qcu-market-prepare-0.1.0-bootstrap.1-06f5415e3f85ec3cebebe0e77d9bc521c8aaf8944bfdf7451f814717a680e345.zip`
- 大小：407585 字节；SHA256：`06f5415e3f85ec3cebebe0e77d9bc521c8aaf8944bfdf7451f814717a680e345`。
- 根目录 `qcu-market-prepare-0.1.0-bootstrap.1/`，14 个普通文件，无符号链接，无 TGZ 捆绑，无包含开发机路径的构建日志。
- app/脚本直接复制自修正后 candidate-20261015-02；五项打包源文件哈希与工作树一致。构建清单的 UI 未测字段为构建时状态，后续父线程证据单独记录于本文。

维护者已直接传送到 mini 并解压、校验签名和文件，用户无需传包或解包。mini app：

```text
~/Artifacts/qcu-harness/0.1.0-bootstrap.1/native-20261015-mf2d491j/extracted/qcu-market-prepare-0.1.0-bootstrap.1/QCU市场安装准备器.app
```

mini `native-20261015-mf2d491j/` 内有 SUMMARY.json、prepare-first.json、prepare-reuse.json 和 codesign.log；报告已由维护者直接取回开发机 `mini-validation-20261015/`。这些私有运行报告不入 Git。

## 已通过

| 检查 | 证据与范围 |
| --- | --- |
| 36 项行为测试 | 系统 Python 3.9.6 全通过；父线程 Python 3.11 独立复跑相同 36 项全通过。计 36 个不同测试，不合计为 72 项。 |
| 下载与失败边界 | 合成 HTTP 验证精确包、复用不请求 HTTP、错误状态/大小/SHA/编码、重定向、无长度响应、超限、取消清理。 |
| 文件边界 | 旧损坏包、FIFO、符号链接、错误属主、宽松权限、额外 allow ACL、发布竞争均拒绝，旧文件保留；空格/中文/引号路径通过。 |
| 构建与签名 | AppleScript 编译、执行位、实际文件清单、源 pin、拒绝覆盖输出；最终资源写入后 ad-hoc 签名，deep/strict 验证通过。 |
| 开发机真实 Hub 下载 | 10:36:58（北京时间）首次准备成功；43446 字节、固定 SHA256；未安装/启用。 |
| mini 真实 Hub 下载 | 10:48:11 观察：首次 new，第二次 reused；缓存 inode、字节、修改时间和哈希一致，文件本人所有、0600。 |
| mini 环境保留 | 测试前后默认 Home 与原测试 Home 的 package.json、pnpm-lock.yaml 四个 SHA256 全部一致；没有启动/退出/操作 DSH。此检查只涵盖这四个文件，不声称逐文件审计整个 Home。 |
| 开发机原生界面 | 修正后 app 显示中文准备完成对话框，短步骤和两按钮可见；截图位于 screenshots/native-ready-light.png。通过缓存复用显示，未测空缓存下原生 app 的首次网络权限提示。 |
| 范围保持 | 基线中除 README 和 P9 安装指引外的 492 个跟踪文件不变；主仓库已有 README 修改、onboarding 用户填写的验收文档保持原字节。 |

精确市场 SHA256：`ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12`，来源提交 `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3`。源码与构建方法见[准备指南](qcu-market-preparation-guide.md)。

## 失败与修正

早期测试在沙箱中因本机 HTTP 监听/构建权限被拒绝；按正常审批运行后通过。初始 app 在 osacompile 后修改资源/Info.plist 导致 seal 失效，父线程发现 deep/strict 验证失败。已修正为全部写入后仅对新候选 app 做本地 ad-hoc 签名，并加构建验证。早期候选与日志留存，不分发。

原生控制工具对“稍后”的点击没有得到界面变化证据，按键及重新绑定窗口超时，重置工具后仍超时。不能据此判断按钮代码失效，也不能记交互通过；开发机候选窗口可能仍打开。没有通过其他 UI 自动化通道绕过该限制。

## 未测与验收步骤

1. 在 mini Finder 使用“前往文件夹”打开上面 app 所在目录，双击准备器。无需退出默认 DSH、运行测试启动器或重新安装市场。若系统安全拦截，记录提示并停止，不绕过；本候选仅 ad-hoc 签名，无 Developer ID、未公证。
2. 应显示“安装包已准备好”，不会自动启动/安装/启用 DSH。点击“稍后”，确认窗口关闭；原剪贴板内容应保持不变，可使用自行放入的无敏感测试文字检查。
3. 再打开 app，点击“复制安装路径”；粘贴到空白文本文件，确认是本人 Library 下以 qcu-market 开头的长期 TGZ 路径。不要发送给其他人。确认窗口正常结束。
4. 当前 mini 默认环境已安装有效 P9.1，无需重复安装。将来确需安装或更新时，在官方“添加插件”粘贴路径并核对版本/来源，安装与启用仍由使用者确认；此次不把旧的同字节本地 TGZ 安装证据移作新准备器端到端通过。
5. 可补充跟随系统暗色显示、mini 原生首次打开、复制/稍后、空缓存首次网络提示及浏览器下载隔离/Gatekeeper 行为。不要删除现有缓存或更改安全设置来制造首次证据；首次下载边界需另选经授权的干净测试环境。

未测：上述真实按钮/剪贴板交互、mini 原生窗口、暗色主题、浏览器下载/隔离、安全提示、普通教师完整安装/启用。未部署 Hub，未使用 Developer ID/公证。当前交付为可复核本地候选，不能写成全项实机验收通过。
