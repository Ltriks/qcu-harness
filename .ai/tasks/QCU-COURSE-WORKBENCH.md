# QCU-COURSE-WORKBENCH

2026-10-16：按用户要求从单文件原型及交接文档重写，原同事源码不复用。

## 交付

独立 `qcu-course-workbench` 官方 Cordis Host/Client 插件及固定市场目录候选。一条真实闭环：选择 DSH 工作区、创建课程、选择匿名资料、配置目标及14种组件、调用当前使用者已配置的默认模型、教师预览/修订、确认保存。界面中英切换，沿用奶油白/绿色原型。实验性六项明确标注。无学生系统、成绩、自动排课、私有原生桥或全局禁用策略。

Host 持有数据与任务，公开 Typert Remote 传输；Client 采用已验证 lazy-CJS factory、main keyed slot、sidebar.panellist。插件自身默认禁用，不修改其他插件配置。Skill 随包，不扩张教学 Skill 目录。文件只从浏览器选择的字节读取，文件名不当路径；成果写到用户明确选定的已登记 DSH 工作区。Key 不经过本插件，LLM 只调用官方服务。不执行资料中的指令或模型代码。

## 验收

- 匿名样例创建→生成→预览/修订→保存及持久化重启；不同课程不能混用引用。
- 重复请求幂等；修改任一目标字段产生新任务；取消太晚、超时未知、重启未完成状态准确。
- 重名不静默覆盖；覆盖须核对预览和当前文件摘要；导出合法 DOCX/PPTX/离线 HTML，HTML 无第三方 CDN。
- 构建产物实际 React 渲染（selector hook 约束），Chromium完整交互与窄屏/深色检查。
- 实际官方 Cordis/Typert/Tools/Skill 注册与卸载，包内协议和默认禁用检查，确定性 TGZ <1MB。
- 市场固定摘要/大小/URL与包一致；保持现有产品。部署与真实模型/教师效果分层记录。

源码独占分支 `dev/qcu-course-workbench`，worktree 暂在主仓库 `.work/course-workbench`（沙箱可写范围，经用户工具批准移入）；不改 main 现有 README 修改。产物最终移至规范 Artifacts 目录（按实际权限处理）。
