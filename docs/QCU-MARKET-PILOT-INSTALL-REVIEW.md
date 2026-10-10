# QCU市场固定试用包与确认范围

仅离线准备，尚未安装、启用或启动任何DSH。视觉验收仍为 **not tested**：IAB不可用，Chrome本地文件策略拒绝；未绕过。此前CLI退出/检查问题没有在本轮诊断或证明解决。

## 固定产物

- 包名/row建议ID：`qcu-market`；版本：`0.1.0-pilot.1`。
- 文件：`qcu-market-0.1.0-pilot.1.tgz`，8239字节。
- SHA256：`04f6e3609d841ecff25e59c8452d7c5eeae2cea8837118af88ca5fff914cf01b`。
- 持久任务产物目录：`artifacts/qcu-market-pilot1/`（本任务根下，不在/tmp）。该目录包含TGZ、逐文件 `MANIFEST.json`、`SHA256SUMS` 和本清单副本。
- 归档仅6个普通0644文件：`package/package.json`、`index.js`、`client.js`、`cordis.patch.yml`、`README.md`、`LICENSE`。无链接、可执行文件、Skill正文、node_modules、源码构建器、秘密或学生数据。
- 导出 `.`→`index.js`；`./client`→预构建`client.js`；`./package.json`→清单。patch路径实际存在。无npm scripts字段，因此无preinstall/install/postinstall/prepare/build脚本；安装不需要运行源码构建器。
- 固定peer：`@deepseek-ai/cordis=4.0.4`、`@deepseek-ai/dsh-client-ui-layout=0.2.0-rc.2`、`@deepseek-ai/dsh-client-ui-sidebar=0.2.0-rc.2`。没有普通、可选或bundled dependencies；React使用官方Client模块表。不得安装版本豁免来绕过不匹配。
- bundle只插入一个 `disabled:true` row。安装请求还必须显式 `enabled:false`，因为官方 `install_bundle` 的enabled省略时默认true。`dsh.client.immediately:true` 是Client资源预取层级，不是安装自动启用授权。

## 实际运行面

Host模块顶层只有空 `apply()` 导出，不注册工具、服务、Skill提供方、管理RPC或监听器。启用后官方Loader可执行这个空Host函数；它仍属于有Host代码的包，不宣称沙箱隔离或天然无风险。

Client顶层向官方ModuleLoader注册懒工厂。工厂取得官方React、读取剪贴板API引用，并构造静态目录UI。激活后注册main keyed slot和sidebar.panellist；返回调用layout.selectPanel(null)。浏览只渲染目录；用户明确点击复制时调用clipboard.writeText。没有读剪贴板、文件读取/写入、聊天、model key、fetch、socket、远程HTML或管理调用。资源本身由官方Host/Client加载机制从本地包传递，不等于浏览器完全没有官方资源请求。

**五项QCU Skill仅作为静态说明存在于client.js的目录数据中。** 本包没有SKILL.md，没有skills注册，不安装、不启用、不调用它们。三项Office也只是官方内置能力使用指导，当前实例未验证；不会新装Office包。复制示例只写剪贴板，不自动发送对话。

官方安装器自身会写目标profile依赖、锁文件和选择/patch状态，可能使用pnpm缓存或访问registry处理peer依赖。这不是插件发起的网络操作；当前没有在Mini验证离线可满足依赖，不能承诺安装零网络。发现pendingBuilds、新依赖版本不符、意外脚本、版本豁免要求或异常挂起时停止，不添加approvedBuilds、不改registry/权限、不重试并行安装或杀进程。

## 可由父线程一次提出的用户确认范围

建议用户确认：将**上述固定哈希唯一TGZ**传入Mini指定试验产物目录，核验字节后，仅在既有新试验Home `QCU Installer Pilot 20261010-000593f0` 的已确认profile，通过官方plugin_manager逐次真实审批完成“先禁用安装 → 选择该bundle → 启用列举出的唯一qcu-market row → 正常退出并重启同一试验实例 → 无模型UI验收”。可同时约定失败时只禁用/移除该包与本次row的回滚。不包含删除整个Home、旧有Skill、任何其他包或数据。

这是一项**有条件的范围确认**，不是替用户点击后续原生审批。每次plugin_manager调用（包括list）仍需官方本次调用审批；不切换永久FullAccess，不自动批准build，不添加版本豁免。父线程拿到具体批准前不传文件或碰真实Home。目标Home的完整实际路径、profile标识和当前实例绑定仍须先只读核实，不能从目录名推断当前App已绑定该Home。

## 最少动作与验收门

1. 用户确认上段范围后，只读确认官方App版本、目标Home/profile与实例绑定；确认无冲突的同名包/row。若实例或CLI状态不明，停止。目标不是生产Home或Mini线上Hub。
2. 传入固定TGZ并核验SHA256。用官方 `plugin_manager` 的 `list_bundles`、`list_plugins` 获取真实标识与当前状态；每次保留工具结果和用户本次审批，不猜entryId。
3. 发起 `{"action":"install_bundle","target":"<Mini上已核验的TGZ绝对路径>","enabled":false}`。不带approvedBuilds或版本豁免。等待官方最终结果，不能仅凭下载/依赖目录出现/CLI退出码声称安装成功。若挂起、取消或退出检查异常，状态记未知并停止；本轮没有修复此前问题。
4. 官方list确认 `qcu-market@0.1.0-pilot.1` 已安装且bundle未选择。随后另一次真实审批 `set_bundle target=qcu-market enabled=true`，再list获取唯一row的真实entryId并确认默认disabled。若返回restartRequired则按官方状态处理，不猜已运行；必要时先正常重启再列举。
5. 仅在确认唯一目标row后，经真实审批 `set_plugin target=<list返回entryId> enabled=true`。启动型profile须正常退出并重启**同一试验Home/profile**；HMR型可能即时生效，仍以工具结果为准。不得kill、复制密钥、改启动权限或用其他Home代验。批准范围可包含安装、启用后的必要正常重启，次数按官方restartRequired与待生效状态确定，不保证只需一次。
6. 无需模型key即可在已启动的官方UI中检查：一条QCU市场侧栏、六场景八卡片、反复进入无重复入口、返回原会话、权限/来源/状态显示、复制成功或手动失败降级、全部安装按钮禁用、原品牌/聊天/审批布局保留。原生点击与剪贴板检查未做。无需调用Office或五项Skill，不把市场可见等同Skill可用。
7. 若验收失败，按已批准回滚范围用官方管理禁用/移除**唯一qcu-market**，正常重启确认入口消失；其他Home、包、技能和线上Hub不变。若无回滚授权则先停并报告。

`plugin_manager` 是Agent工具。由模型主动发起调用通常需要当前实例已有且授权的模型连接；本包本身与市场浏览不需要模型key。没有模型配置时不复制其他实例key、不绕过工具审批；可由用户在官方设置UI手工管理（官方源码同一管理服务），但这属于需明确选择的人工路线，不伪装成本次plugin_manager工具调用。正常启动官方App后，仅看市场的UI验收可以全程无模型。

## 离线证据

重新构建Client后，9项本地检查通过。实际TGZ逐成员校验名称、类型、UTF-8、SHA256、大小和导出闭包；将**实际归档中的client.js**送入真实rc.2 Cordis/SlotRegistry/LayoutController集成测试，加载、8卡React渲染、重复导航、返回与卸载释放1项通过。没有调用安装器、npm/pnpm安装、真实Home或App。

复现：`python3 hub/plugins/qcu-market/pack-pilot.py <持久输出目录>`；打包器拒绝覆盖同版本不同字节。官方集成测试可用 `QCU_MARKET_CLIENT_PATH=<经审计归档解出的client.js>` 指向真实包，而非源码。node类型转换只用于测试上游TS，交付JS不需要转换器。
