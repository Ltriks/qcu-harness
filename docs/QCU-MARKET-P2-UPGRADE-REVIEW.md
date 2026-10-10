# QCU市场p2固定包与升级确认

本轮仅本地制品准备，未传Mini、安装、启用、正常重启或修改Hub。p1归档保留。p1安装启用与市场可见为用户报告；其他p1交互不自动算通过。

## 固定包

| 项目 | 值 |
| --- | --- |
| 包名 | qcu-market |
| 实际package.json版本 | 0.1.0-pilot.2 |
| 文件 | qcu-market-0.1.0-pilot.2.tgz |
| 字节 | 11424 |
| SHA256 | 6dc4cafc60b1b76571831f3bac524bedc9471956f37cb75d38b789eedcdd0e14 |
| 默认row | qcu-market，disabled=true |
| 成员 | 9个普通0644 UTF-8文件，无符号链接/硬链接 |
| 固定peer | @deepseek-ai/cordis 4.0.4；@deepseek-ai/dsh-client-ui-layout 0.2.0-rc.2；@deepseek-ai/dsh-client-ui-sidebar 0.2.0-rc.2 |
| 普通/可选/bundled依赖、npm scripts | 均无 |

持久产物位于本任务根 `artifacts/qcu-market-pilot2/`，含TGZ、MANIFEST.json逐成员字节/hash、SHA256SUMS、AUDIT.json、REBUILD-RESULT.json及UPGRADE-REVIEW.md。构建输入以开发分支固定提交为准，来源绑定另存SOURCE.json。

包包含package.json、index.js、client.js、cordis.patch.yml、README.md、LICENSE、icon.svg、locale/zh.json和locale/en.json。CSS与场景SVG路径直接编入Client，无独立CSS加载和外部CDN/字体。locale只有清单展示meta，不是新增运行时服务。

p1仍为8239字节、SHA256 `04f6e3609d841ecff25e59c8452d7c5eeae2cea8837118af88ca5fff914cf01b`，位于相邻 `qcu-market-pilot1/`。已重核，不替换、改名或删除。

## 相对p1的变化和权限

新增紧凑场景图标卡片、本地搜索、语义主题样式和键盘焦点；官方条目显示“查看用法”，QCU草案显示“开发中／了解草案”，去掉灰色安装主按钮，技术信息折叠到详情。manifest新增原创MIT图标和中英展示说明，不仿造学校校徽。

Host index.js、bundle patch和LICENSE与p1逐字节相同；peerDependencies及整个dsh声明一致。唯一实际代码行为增加是本地字符串筛选与本组件样式/图标渲染。原有复制示例仍仅在点击后写剪贴板，失败给出手动降级；不读剪贴板。

没有文件I/O、fetch/WebSocket、外部HTML/脚本、聊天/密钥读取、管理RPC、安装调用、模型调用或权限扩展。运行时模块导入仅宿主React。UI仍是可执行Client代码，不声称零风险。五项QCU Skill只有静态目录说明，未附正文、注册或安装；三项Office仍是未验证的官方能力指导。

官方安装操作本身会写指定profile依赖/锁/选择状态，pnpm可能访问既有registry以解析peer；当前没有验证Mini缓存足以完全离线。包无npm scripts不等于官方包管理器绝无网络。遇到pendingBuilds、版本冲突/豁免、额外权限或未知状态时停止，不批准构建、不改registry或永久FullAccess。

## 可一次向用户说明的授权范围

“仅把上述固定p2包传入Mini，核验后在新试验Home `QCU Installer Pilot 20261010-000593f0` 的desktop profile，通过官方插件界面禁用并替换唯一qcu-market p1、安装p2、启用，并按官方结果正常重启该试验实例；验收图标/搜索/主题/窄屏/键盘/返回/复制。若失败，只撤回本次qcu-market变化，必要时用保留的固定p1包恢复。保留其他包、纯Skill、旧Home及线上Hub。每次官方确认仍由用户决定，不包括构建许可、版本豁免或永久FullAccess。”

该范围尚未获p2真实升级批准。本轮不会实施。上传目录和完整目标路径在批准后确定并再次核验，不将本机路径给Mini安装界面使用。

## 官方升级步骤

1. **先核目标与保留恢复材料。** 确认目标新Home的desktop profile、当前qcu-market确为p1以及唯一row实际entryId；读取官方状态，保存当前这一轮的无凭据恢复元数据。不要把初次安装前的两文件备份当作当前完整配置直接覆盖。保留固定p1 TGZ，核验准备传入的p2 SHA256。
2. **官方侧栏“插件”中禁用qcu-market bundle。** 启动型profile显示需要重启时，正常退出并重新打开明确绑定这个新Home的同一试验实例，重新核对禁用状态。包级“立即启用”仅切换bundle，不能当作全部row已启用。
3. **只卸载qcu-market。** 用官方该包详情的“卸载”并由用户确认；结果成功后核对列表。官方不支持以UI“添加插件”冒充自动升级：同名包可能被识别为already-installed。若返回 `stop-profile`/`bundle-in-use`，停止并报告。这意味着当前运行实例仍使用该包；不能强删node_modules、改配置或杀进程，也不能自动改走CLI。CLI仅在另行满足官方完全退出门、目标身份和原有未知进程问题后才可能采用，本轮没有解决这些条件。
4. **添加p2。** 在“插件 → 添加插件 → 包名或地址”输入Mini上已核验的p2 TGZ完整路径。官方UI源码以 `enabled:false` 安装。等待“已安装”最终结果，核对0.1.0-pilot.2与目标安装位置；下载完成、退出码或目录出现均不替代正式结果。失败/未知即停止，不叠加重试。
5. **启用与加载新代际。** 用户在“立即启用”选择bundle，再在包详情核对唯一qcu-market组件row是否仍为禁用，按官方实际entryId启用。旧profile override可能保留，所以不预设row状态。保存状态确认后，**替换包必须正常重启目标试验进程**以加载新JS代际，即使某些开关已HMR生效；按官方restart-required可能不止一次。不得仅因侧栏仍叫QCU市场就声称p2代码生效。
6. **无模型验收。** 核对官方插件详情版本p2；进入QCU市场可见新图标、搜索、3项“查看用法”及5项草案说明，没有灰色安装主按钮。检查搜索/清空/无结果、六场景、详情收放、返回和重复进入、复制成功与失败反馈。分别看宿主明暗主题、窄窗口和Tab/Enter/Space焦点；恢复为用户原主题/窗口状态。不得为检验复制而自动发送对话。无需模型key或调用Office/Skill。

## 限定回滚

如果p2不可用，在批准范围内通过官方界面禁用唯一qcu-market，并按必要正常重启，再卸载p2。核验保留p1包的固定hash后，以同一官方禁用安装→bundle/row状态确认→启用→正常重启顺序恢复p1。只恢复本包，不删除或整体覆盖Home、profile、其他依赖或既有纯Skill。若卸载被stop-profile门阻挡、结果未知或p1恢复失败，保留现场和恢复材料并停止；不要宣称已回滚。

## 本地证据与未测项

14项本地测试通过。实际p2 TGZ九个成员与源码逐字节一致，类型/大小/hash/导出和icon/locale闭包通过；无脚本、网络/管理调用模式或秘密模式发现。实际归档client.js在真实rc.2 Cordis/SlotRegistry/LayoutController组件集成1项通过（注册、8卡静态渲染、重复导航、返回与释放）。重建hash一致；21个颜色token在官方明暗声明中存在。

此前两张用户截图已实际查看，用于p1根因和设计调整；**p2明暗/窄屏/键盘真实视觉仍not tested**。没有可获准且不绕策略的独立浏览器视觉通道；不以静态渲染测试冒充像素验收，不绕过此前Chrome file限制。

官方依据：固定rc.2 `plugin-manager/src/index.ts` 的removeBundle停止门，`ui-plugin-manager/src/client/manager-store.ts` 的disabled安装/启用语义，官方README的package replacement重启要求。本轮只读源码，不调用实际管理服务。
