# 真实 CLI 试点准备度（2026-10-10）

结论：所要求的三个实际实现均已落地，**仍不可执行真实试装**。当前明确的平台阻塞是本机进程盘点中存在当前 UID 的不可读可执行路径，返回 `process-inventory-unavailable--3`；未将它当作“DSH 已退出”。此外产品仍刻意只接纳新建合成 Home，生产门无条件拒绝，尚须经审阅的具体目标接纳/授权接线，不能说仅点击确认就能安装。

| 项目 | 实现和本轮真实证据 |
| --- | --- |
| 官方身份 | `MacOfficialIdentityChecker` 调用 Security.framework，检查 Apple 信任链、固定 TeamID `NAN929V4UM`、BundleID `com.deepseek.dsh`、严格/嵌套/全架构签名、plist 两个版本字段均为 `0.2.0-rc.2`、随包 CLI 精确位置及 hash。已有官方归档只读验证通过；未执行其中程序。无签名伪 App、错误 CLI 路径拒绝。 |
| 固定来源 | Team/Bundle 来自既有官方归档系统签名验收记录，再由本轮实际API核验。CLI SHA256 为 `61647349bd61a5cfff40c338c7d5af767a22f409ddce36feabfb2f693d1e66af`，已固定在代码；网页不能设置这些身份。没有新造key。当前签名测试不等于本轮重新在线验证公证/撤销服务。 |
| 进程占用 | 实际 libproc/内核查询，仅当前UID、PID、进程身份/可执行路径；不读取argv/env/模型信息。检测本测试可执行程序占用通过。存在不可读进程时拒绝；本机“不存在的App应空闲”正向证明被平台可见性阻断，单独记录，不计通过。 |
| profile | `OfficialProfileChecker` 实读合成官方结构，验证Home owner/私有权限/标记、profiles/desktop/package.json结构、lock（包括失效链接）、同名依赖/包存在；检查固定配置hash、bundle未选择、安装文件完整集合/hash、包身份版本以及唯一row disabled=true。JSON以外的未知patch不解析、不改写。内部pnpm包链接只允许解析到本profile的node_modules内。 |
| 后代收尾 | `posix_spawn` 原子建立新进程组，记录直接子进程UID/PGID/启动时间；组长退出用waitid WNOWAIT保留PID不可复用。收尾前核对身份，只向本次组发TERM/KILL，再回收组长。超时、取消、组长正常退出后留后台子进程三条测试通过；子进程被内核确认已退出/僵尸，不能继续执行。没有killall、按名结束或触碰DSH。 |

进程组收尾不是恶意代码沙箱：主动 setsid/setpgid 逃离该组的守护进程不在此保证内，当前受审单包禁止安装脚本/任意代码执行扩展。若未来官方运行链会主动脱离组，必须再核实并阻止试点，不能扩大到扫描并杀死系统进程。原子记录仍不是fsync级断电事务；中断/清理身份不明保持unknown，不自动重放。

## 哪些还需要代码，哪些需要现场信息

- **已有实际代码，不再是mock：** 签名/版本/CLI hash检查、只读进程盘点、profile结构与安装后核验、已拥有进程组收尾。测试的profile和CLI是合成数据，但这些检查函数本身实际读取文件/内核；官方签名测试实际读取官方归档。
- **平台证据阻塞：** 当前执行环境不能完整读取当前UID的可执行路径。目标Mac要以相同只读检查拿到完整可信结果；失败就停，不增加隐私权限、不默认忽略未知进程。不能用测试替身绕过。
- **刻意保留的代码接线：** 生产授权凭证/受审真实目标工厂仍未接入；当前 `IsolatedCLIAdapter` 只采用新建 SimulationEnvironment，`OfficialDesktopAdapter.execute` 和 ProductionInstallGate 固定拒绝。下一次开发应依据已确认的唯一目标绑定此实际检查器和执行核心，并审阅一次性本机授权；不能用fixtureOnly、网页参数或环境变量解锁。这是边界接线工作，不是上述三项检查的空stub。
- **现场只读信息：** 官方App当前身份/版本、独立Home实际路径及所有者、是否初始化、配置hash及来源、是否同名已装、实际进程/锁状态。现有mini记录不能代替当前预检；不从网页/未审清单产生信任。

最终安装确认必须限定助手源码commit/二进制hash和签名状态、目标Mac/App/Home/profile、`qcu-study-coach@0.1.0-pilot.1`及固定归档hash/大小、唯一来源和是否下载、用户正常退出哪个实例、安装后保持未选择/未启用、错误停止与另行卸载边界。未拿到完整只读目标证据及完成授权接线前，不请求真实试装。

本轮不生成新App包，不替换/打开现有演示，不运行真实CLI，不接触真实Home、API Key、聊天、scheme或线上Hub。最终测试日志仅在忽略目录 `.build/validation-platform.log`；公开文档不带本机用户名/归档绝对路径/进程明细。
