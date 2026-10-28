# Windows 教师预装版 0.1.0-rc.2

2026-10-21补充：当前包的固定归档位置、两平台使用方法及待验收项统一见主仓库[发布交接记录](../../../releases/README.md)。本页原工作树路径仍保留，归档副本与原包SHA256一致。

用户于2026-10-21要求 Windows 也打包测试。本版交付原生 `城院助手.exe` 单入口，无需先安装官方客户端、执行 `.cmd` 或安装插件。原0.1.0-rc.1双平台套件保持原样。

## 实现

- 使用固定官方0.2.0-rc.2 x64客户端原始载荷，保留供应商签名及许可证。自有启动器是.NET Framework x64 Windows GUI程序，源码 `tools/teacher-suite/Launcher.cs`，不重签或改写供应商应用。
- 从九个固定 TGZ 直接构造无账号预装模板，排除市场。七项教学技能、课程工作台、飞书工具均选择为bundle且组件启用。飞书授权与指定文档仍需本人提供。
- 双击入口在后台调用官方 Electron 的 Node 模式，检查模板摘要和完整文件清单，复制模板到 `%LOCALAPPDATA%\QCU-DSH\teacher\0.1.0-rc.2`，绑定本机CLI路径，再从专用工作目录启动官方桌面应用。
- 首次准备不调用 npm/pnpm、不需要网络。已有同一预装版本仅核对已装版本；保留配置。其他已有目录或不同seed拒绝覆盖。初始化使用同父目录的独立临时目录，完成后重命名，不改旧DSH环境。
- 服务监听固定为loopback和动态端口；独立 DSH_HOME、agents 和 Electron userData。该隔离不等于全部OS日志、协议注册、shell环境和第三方CLI账号都隔离；没有对原厂程序作此承诺。
- 不包含模型密钥、登录态、会话或用户数据。维护人员需交付前配置模型。WorkBuddy人工导入总包放在support内，保持教师启动流程不变。

## 已验证

- Windows11 ARM64虚拟机中的实际x64官方运行时，供应商应用 Authenticode Valid；不声称原生x64硬件已验收。
- 全新中文/空格路径完成预装准备；网络阻断下导入九个模块并从实际官方Skills注册表读取七项技能。未调用包管理器、日志中没有联网尝试。
- 在配置中加入用户注释，重复准备后文件摘要不变。
- 原生x64 GUI子系统启动器编译成功。通过其 `--prepare-only` 诊断模式，验证实际C#进程→官方Electron/Node→新中文数据目录准备→UTF8路径回传；再次运行保留配置。这个诊断模式不打开桌面窗口。
- 新增五项初始化保护测试通过：路径逃逸、首次绑定及保留配置、原有目录保护、损坏及额外文件拒绝、符号链接和其他版本拒绝。
- 最终402493999字节ZIP在Windows端重新下载后SHA256匹配；系统自带Expand-Archive完整解出9870个文件，从解压目录中的原生启动器执行准备诊断也通过。主机逐文件摘要、ZIP CRC及成员清单全部通过。部分远程长命令未启动，拆成传输/解压/准备短命令后完成，未修改系统安全策略。

桌面自动化在操作 Parallels 来宾窗口时没有可靠送达输入，随后工具超时。本轮没有通过命令行替代GUI自动化，也没有把 CLI 成功当作双击界面验收。用户随后明确反馈：“出现了dsh正常画面，course工作台和skill插件都可见”。据此将原生入口→正常主界面、课程工作台与Skill插件可见记为用户手动验收通过；不延伸为模型输出或飞书读取通过。

## 待验收及发行边界

实际双击后的正常主界面、课程工作台及Skill插件可见已获用户确认。关闭/重开、飞书界面及授权、实际模型回答和教师试用仍待独立记录。原生Windows x64电脑、Windows10及学校终端策略尚未验证。启动器未取得商业代码签名，不能承诺所有电脑或互联网下载后均无系统提示；未调整SmartScreen、防火墙、执行策略或虚拟机安全设置。

构建脚本：`scripts/build-teacher-windows.py`，输入沿用上一版固定输入。先从已核对的官方EXE解出原始载荷，然后在Windows用Framework64的csc编译启动器：

```text
csc /nologo /target:winexe /platform:x64 /codepage:65001 /reference:System.Windows.Forms.dll /out:城院助手.exe Launcher.cs
```

构建最终包时传 `--launcher <编译得到的exe> --zip`。构建器核对启动器为x64 Windows GUI PE，输出预装清单、逐文件摘要、CRC可验证ZIP。最终包不含测试数据home；源码本轮未提交或推送。

最终路径和摘要记录于 `.work/teacher-release/0.1.0-rc.2/delivery.json`。自动检查证据位于 `.work/teacher-windows-{signature,prepare,repeat,smoke,native-check}.log`，诊断native-check与真正GUI结果必须分开。
