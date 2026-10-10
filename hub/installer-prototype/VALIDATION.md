# 隔离验证记录

2026-10-10，Apple Silicon Mac，Swift 6.4 / 已安装 Xcode 工具链。基础 commit：`ab362184c917554354486cd13d300f4c934be138`。未启动 SwiftUI 窗口、官方 DSH 或其他用户应用。

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| Swift Package 编译 | 通过 | InstallerCore、DemoFixtures、SwiftUI executable 和测试目标；不等于视觉验收 |
| XCTest | **28/28 通过，0 失败** | 严格请求、签名/来源/过期、hash、归档限制、确认绑定、取消、重放、恢复和 dry-run |
| Node 离线交互测试 | **2/2 通过** | Hub 样例点击生成四字段 JSON，自有 scheme 文本，不联网、不导航 |
| 原生 UI / 系统 scheme | 未执行 | 本轮不注册协议、不启动应用 |
| 真实 Home / 官方 CLI / DSH 调用 | 未执行 | 唯一目的地是新建合成 Home；CLI 执行函数固定拒绝 |
| 线上 Hub / 签名公证 | 未执行 | 未部署、未提交签名服务、未生成生产密钥 |

最终 XCTest 完成于本机记录 2026-10-10 09:53:53（UTC+8）；总执行 28 项，0 failure。命令为 README 所述测试命令，使用命令级 Xcode `DEVELOPER_DIR` 与本地 `.build` cache。构建早期失败包括当前执行环境拒绝嵌套 sandbox、默认 CommandLineTools 无 XCTest，以及测试引用 fileprivate 路径；分别通过获准执行测试、命令级工具链选择、修正测试访问处理。最后成功结果不包含跳过测试。

主要回归覆盖：

- 未知字段、路径身份、重复 URL 参数、伪造 `dsh://install`、额外命令参数，以及绕过入口直接解码后仍须重验证的日志读取。
- 未签名/坏签名/未知 key、空 production trust、fixture key 模式混用、信任配置变更、身份/版本/运行时/有效期不符。
- 外站/可变下载地址、来源标识不符、包/文件 hash、目录穿越、绝对路径、大小写重复、symlink/hardlink/设备/PAX、可执行位、体积/数量/结束块/checksum。
- 本机确认前无 Skill 落盘；确认只适用本次清单；过期、核心重建后失效；取消和重复调用不产生第二次写入。
- 同版本换内容拒绝；未归属/链接目录拒绝；更新失败恢复旧内容；成功更新保留备份；目录 0700、文件 0600。
- 中断 journaling 状态明确为结果未知；不自动恢复审批或报告成功。
- 插件 package.json 的脚本/依赖/未审 peer 拒绝；官方 CLI 固定参数计划保持关闭，row `disabled:true` 原字节保留且无 profile 目录写入。

此记录仅证明原型的合成路径。它不证明现有 ZIP/TGZ 已兼容、真实网络来源验证、用户交互体验、最低 macOS 兼容性、真实 DSH 安装或技能调用。具体未实现列表及下阶段授权动作见 [README.md](README.md)。
