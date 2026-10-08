# qcu-table-audit 开发原型

版本 0.2.0-prototype.6 是树外 Bundle/Host/Client 包。包根默认导出任务 Host；原程序化 adapter 改从 `qcu-table-audit/adapter` 导入，`./task-host` 仍保留。官方 Client loader 要求 Bundle 的主 Host row 使用精确包名，因此不再用 `/task-host` 子路径作为该 row 名。`./client` 是官方 ModuleLoader 的 CJS factory，只有 React 外置；`./guidance` 注册包内只读说明 Skill，关闭个人与项目 Skill 根扫描。Bundle patch 的两项组件默认均关闭。

已在独立 profile 上通过官方 CLI 安装及真实 Chrome 页面验收，使用未修改的官方 npm DSH/Web 0.2.0-rc.2 和固定源码基线 639ed015397290b3745d163aafe02ffee4aa3f84。只使用合成 CSV，未替换论文候选，旧论文策略仍拒绝 CSV 工具。

Client 使用 main 与 sidebar.panellist 提供无需 Session 的独立页面。逐次选择单个 CSV、演示或个人规则并确认只读 diagnose-csv 用途后，页面才读取文件快照；不提交原文件名或路径。可信 Host 创建短期 page capability、local-task scope 和不透明 task ID，绑定页面与 revision，拒绝跨页面、过期、撤销和旧 revision。重新选择、取消、关闭及授权到期撤销任务。失联页面 lease 回收包括空页面；活动不延长文件授权期限。演示规则不是学校正式规范。

快照通过官方已认证同源本地 Connection 传输，不进入聊天或模型。Host tool 只接受 task ID，拒绝模型 Agent。所有页面共享子进程并发上限。运行使用 owned 私有目录、固定 canonical Python 引擎、输入/规则字节上限、行/列/问题上限、报告总字节生成预算、读取上限及超时。生成预算在创建输出目录及写报告前拒绝超限；无 --clean，不改源文件。这不是 OS 磁盘配额或同权限进程沙箱。

页面只显示固定计数并导出仅计数 JSON，原始行、路径、规则及 stdout/stderr 不返回。取消/卸载撤销授权，终止自身子进程并等待清理。删除失败保留 owned 记录；root-owned recovery route 和 admission guard 在 feature 卸载后保留到清理成功再释放。恢复只处理 closing 或 cleanup-failed 记录，不复活授权或清理其他 live page。Host 整个进程退出后的跨进程残留恢复尚未实现。

构建和回归使用匹配官方 checkout 的现有依赖和 Python 3.10+，不重新安装：

```sh
node scripts/build-host.mjs
node scripts/build-client.mjs
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.client.json --noEmit
QCU_TEST_PYTHON=/absolute/path/to/python \
QCU_TEST_UPSTREAM=/absolute/path/to/matching/built/checkout \
node node_modules/vitest/vitest.mjs run --config vitest.config.mjs
```

canonical 引擎仅在 skills/qcu-table-audit/scripts/audit.py 编辑，构建复制到 lib。测试针对生成后的 lib，使用真实工具运行时、实际 Connection/BrowserAuth、Python 子进程和合成文件。React DOM/StrictMode 使用 JSDOM；真实官方 Client 挂载及浏览器业务流程另有独立证据。浏览器自动文件选择不等同原生系统文件对话框验收。生成目录及本机依赖链接不提交。清理屏障仅拦截自身 run 目录的 rm，其余文件操作及子进程保持真实。

当前安装及浏览器结果见 [安装验收](../../docs/TABLE-AUDIT-INSTALL-VALIDATION.md) 与 [脱敏证据](../../docs/evidence/table-audit-install-validation.json)。此前 [任务阶段](../../docs/evidence/table-audit-task-validation.json) 和 [Host 阶段](../../docs/evidence/table-audit-host-validation.json) 属历史证据。关闭 HMR 的测试 profile 在管理页开关变更后需要正常退出并重启才能应用；当前任务先用“取消并撤销”立即撤销，不能把保存配置当作即时关闭。当前真实私人 CSV 未获授权；本机 Hub 是下载→哈希→官方 CLI 安装的隔离测试，非公开发布。安装配置见 [试用说明](../../docs/TABLE-AUDIT-NEXT-STAGE.md)。不支持清理、TSV/XLSX、批量、行级导出、外部模型或永久授权；packageReady=false。
