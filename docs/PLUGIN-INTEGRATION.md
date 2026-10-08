# DSH 功能插件接入约定

DSH 提供基础运行环境，业务功能保持独立插件。接入以固定官方 baseline 的 Bundle、Cordis Host、Client、Skill 机制为准，避免另造注册框架。官方源码与累计补丁身份见 [baseline](../upstream/baseline.json)，重建见 [REBUILD](REBUILD.md)。

当前论文插件有 Host、Client、Python 引擎及原生协议；13 项独立 Skills 的唯一源码在 skills。第二功能选择 CSV 诊断，先验证真实工具注册、权限及清理，再根据实际使用决定导航位置。用户要求工具始终可找到、无需先新建会话；该原则尚未实现为新 UI，也没有预先固定顶部按钮位置。

生产插件须明确包导出、官方 peer 版本、Bundle manifest、Host/Client 入口和 Skill 材料化。Host 的 effect 拥有工具注册及任务，卸载应先撤销新任务、取消已有任务、等待子进程退出和临时目录清理。补丁顺序、资源哈希、固定锁文件须可重建；有原生能力时仍须经过官方完整性及能力门槛。

无会话操作必须由可信 Host 在用户选择文件及确认用途后创建本地任务 scope。授权明确文件类型、用途、期限及撤销规则；模型参数只传不透明 ID，不允许路径或自行创建 scope。有会话操作继续绑定会话身份，不把会话授权复用为无会话授权。策略不是同权限 Node 代码的操作系统沙箱。

CSV 原型只在程序化构造的隔离 Host 中注册。现有论文启动策略仍只允许论文工具；原型没有修改该白名单，没有 Bundle 安装入口，没有生产文件授权实现。原始数据、完整报告、规则、路径及错误详情留在 Host；工具仅返回重建后的计数，不能直接转发 Python 报告。

验收分层记录：引擎合成回归、真实 Host 工具与生命周期、隔离原生 UI、Hub 发现/安装/更新/首次配置、正式打包。通过前一层不代表后一层通过。Hub 是后续分发目标；当前安装链未验证。签名、Windows、自动更新和正式发布不在本轮范围，packageReady=false。

对应当前证明见 [CSV 计划](SECOND-FEATURE-TABLE-AUDIT.md)、[Mac 人工验收](MAC-USER-ACCEPTANCE.md) 和 [原型 README](../packages/qcu-table-audit/README.md)。
