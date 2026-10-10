# 隔离验证记录

2026-10-10，Apple Silicon Mac，Swift 6.4 / 已安装 Xcode 工具链。基础 commit：`ab362184c917554354486cd13d300f4c934be138`。未启动 SwiftUI 窗口、官方 DSH 或其他用户应用。

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| Swift Package 编译 | 通过 | InstallerCore、DemoFixtures、SwiftUI executable 和测试目标；不等于视觉验收 |
| XCTest | **38/38 通过，0 失败** | 原有28项 + 10项真实压缩格式/URLSession测试；包含多种攻击和网络故障子用例 |
| Node 离线交互测试 | **2/2 通过** | Hub 样例点击生成四字段 JSON，自有 scheme 文本，不联网、不导航 |
| 固定 TGZ / 纯 Skill ZIP | 通过 | 原固定TGZ逐成员核对、临时下载到CLI-plan；ZIP stored/deflate到合成Home |
| URLSession 下载 | 通过 | 临时GET-only loopback：清单验签、用户许可、流式hash、拒绝重定向、超时/取消/失败清理 |
| 原生 UI / 系统 scheme | 未执行 | 本轮不注册协议、不启动应用 |
| 真实 Home / 官方 CLI / DSH 调用 | 未执行 | 唯一目的地是新建合成 Home；CLI 执行函数固定拒绝 |
| 线上 Hub / 签名公证 | 未执行 | 未部署、未提交签名服务、未生成生产密钥 |

第一阶段28项于2026-10-10 09:53:53（UTC+8）通过。第二阶段最终 XCTest 完成于 **2026-10-10 10:05:46（UTC+8）**：38项，0 failure；Node 2项另行通过。使用 README 测试命令、命令级 Xcode `DEVELOPER_DIR` 与本地 `.build` cache。第一阶段构建曾遇嵌套 sandbox、CommandLineTools 无 XCTest和测试访问级别问题；第二阶段一次测试在归档fixture尚未生成时启动，7项报缺文件，补齐并审计后回归通过。最终结果无跳过测试。

主要回归覆盖：

- 未知字段、路径身份、重复 URL 参数、伪造 `dsh://install`、额外命令参数，以及绕过入口直接解码后仍须重验证的日志读取。
- 未签名/坏签名/未知 key、空 production trust、fixture key 模式混用、信任配置变更、身份/版本/运行时/有效期不符。
- 外站/可变下载地址、来源标识不符、包/文件 hash、目录穿越、绝对路径、大小写重复、symlink/hardlink/设备/PAX、可执行位、体积/数量/结束块/checksum。
- 本机确认前无 Skill 落盘；确认只适用本次清单；过期、核心重建后失效；取消和重复调用不产生第二次写入。
- 同版本换内容拒绝；未归属/链接目录拒绝；更新失败恢复旧内容；成功更新保留备份；目录 0700、文件 0600。
- 中断 journaling 状态明确为结果未知；不自动恢复审批或报告成功。
- 插件 package.json 的脚本/依赖/未审 peer 拒绝；官方 CLI 固定参数计划保持关闭，row `disabled:true` 原字节保留且无 profile 目录写入。
- 下载阶段只从固定信任 origin 取清单；坏签名不请求包。单次许可绑定清单，跨请求使用时不发生HTTP请求。所有重定向（含同源）、HTTP认证挑战、超额Content-Length、未知长度超额流、短读、hash不符、超时和取消均拒绝，暂存目录为空。
- TGZ路径穿越、软/硬链接、9MiB压缩炸弹、截断、CRC损坏和拼接gzip；ZIP路径穿越、symlink、超量展开、伪造小展开尺寸、截断和坏deflate均拒绝。特别检查伪造尺寸ZIP与TGZ炸弹返回有界展开拒绝，未依赖头部声称的体积。
- 下载清理未确认会返回明确失败；畸形包不会修改已安装的合成Skill。下载结果仅表示验证后的字节，插件仍仅`pluginPlanOnly`，Skill仍仅`skillInstalledInSimulation`。

测试服务由测试进程启动/终止，只绑定`127.0.0.1:0`，仅GET文件和受控故障响应，没有控制API；所有服务和临时文件随测试清理，无LAN监听。固定TGZ SHA256为`76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c`，8个成员与canonical源码或确定性生成内容一致；其中JS从未执行。

此记录证明受限ZIP/TGZ格式、系统网络库和合成安装路径，不证明任意格式兼容、真实HTTPS部署/证书链验收、原生UI完整接入、最低macOS兼容性、真实DSH安装或技能调用。当前仍不具备真实助手安装试点条件；前置工作见 [README.md](README.md)。
