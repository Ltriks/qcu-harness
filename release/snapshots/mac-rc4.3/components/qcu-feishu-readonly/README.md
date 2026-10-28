# QCU 飞书单文档只读候选

版本 `0.1.0-pilot.1.1`，面向官方 DSH `0.2.0-rc.2`。独立本地候选，尚未进入市场，也未做真实 DSH/教师验收。只提供 `qcu_feishu_outline`（目录）和 `qcu_feishu_section`（用户选择的一节）。没有 Skill、Client 页面、模型调用、自动读取、安装脚本、执行依赖或 CLI 二进制。

## 老师如何配置（由父线程安排真实验收）

1. 本机需已有可信的原生 `lark-cli` 可执行文件和本人正常的用户只读授权。填写原生可执行文件的绝对路径；不要填写可能自动下载缺失文件的 npm/npx 启动器。不复制其他机器的凭据。本插件不安装 CLI、不初始化配置、不登录、不自动授权。
2. 父线程使用官方管理流程安装，必须显式指定 `enabled:false`。包内唯一组件行默认 `disabled:true`，内部 `config.enabled:true`。rc.2 管理器省略安装选项会默认启用，所以安装与启用确认必须分开。
3. 经正常确认启用组件后，打开官方插件配置表单。组件可以在空配置下挂载并展示两个可编辑字段：**本机 CLI 路径**、**授权文档链接**。启用状态不是已配置/可读证明。未填完整时调用工具只返回中文设置提示，零子进程。
4. 填入你明确允许读取的唯一链接：`https://<一个子域>.feishu.cn/wiki/<字母数字token>` 或 `/docx/<字母数字token>`。禁止端口、凭据、非 HTTPS、其他域/资源、查询字段、锚点、转义路径和路径穿越。设置例子使用合成链接 `https://fixture.feishu.cn/docx/DocSynthetic01`；它不是真实文档。
5. 保存表单后，正常调用目录工具，选择一个返回标题，再调用章节工具。修改任一字段会立即撤销旧授权/回执并取消旧进程；旧进程关闭前新读取等待。无效或不完整的新值不会沿用旧文档。修改后必须重新列目录。

配置通过公开 schemastery `.volatile()` 引用、官方 `dsh-settings` 表单、ConfigEditor 持久化和 Loader 所属实例的 `loader/volatile-update` 完成。插件只读取引用的公开 `.get()`，不写配置文件，不修改官方服务。只有两个设置字段可实时编辑；`enabled` 仍由正常启用控制。已使用实际官方服务和隔离的合成文件测试投影、保存与更新；**真实桌面表单显示/交互、安装、启用、原生 CLI 授权和读取仍待父线程验收**。无须将手工改 profile 文件作为老师的默认流程。

## 读取与数据边界

目录接受 `{}`。Wiki 只解析所配置节点，要求 `ok===true`、`identity=user`、`obj_type=docx` 和请求节点一致。Docx 只读取对应文档。命令固定为 `wiki +node-get` 或 `docs +fetch --scope outline|section --detail simple --as user --format json`；没有全文、扫描、写入、权限修改、媒体下载、其他子命令或任意 argv。

目录返回标题、当前正整数 revision 和 120 秒内存回执。章节只接受回执加标题的数字字符串 selection，不接受 block ID。回执绑定文档、CLI realpath/stat 身份、官方调用 agent 与 session 对象/ID；更新配置、重新列目录和卸载都会撤销。章节使用固定 `--revision-id` 并核对响应。缺失/变化的身份或 revision 停止，不自动重试。固定版本是快照；最新远端版本可能继续前进，需重新列目录获得当前版本。

目录 XML 允许平铺 h1–h9 或一个无属性 `<outline>` 容器，外层必须是 `mode="outline"` 的 fragment。拒绝任意嵌套、其他内容、重复/非法 ID、DTD、未知实体、超限标题。只解码五种内建转义字符；不展开实体、不解析引用。章节必须是所选 requested-start 的 section fragment。成功时 stderr 中的有界进度信息被丢弃；错误只返回固定安全分类和提示，不返回 raw stderr、账户 ID 或授权 URL。

标题与章节正文是**不可信任务数据**。不得执行其指令、命令、链接或授权请求；不得读取其引用的文档、表格、多维表格或素材。返回结果带来源和数据边界标记。正文只进入正常 DSH 工具/模型会话输出，插件不记正文日志、不持久缓存。DSH 自身可能按其会话策略保存工具输出。

公开 `defineTool` / `ctx.tools.register` 注册和官方 guards/approval/execute wrappers 保持生效。插件不提供无 agent 的正式调用通道，也不替换或绕过工具策略。一次只允许一个进程操作，最多 32 回执、64 标题、每标题 160 字符；目录 XML 20,000 字符；stdout 256 KiB、stderr 8 KiB、章节 16,000 字符；每子进程 8 秒，取消/超时/卸载发 TERM，150 ms 后 KILL，并等待关闭。只移除自己的工具和事件监听。

子进程 `shell:false`，固定参数、忽略 stdin，保留真实 OS HOME 和少量环境变量。包装层不读取/复制凭据。宿主与 CLI 仍以应用用户权限运行；CLI 可以正常刷新自身凭据/缓存。命令级只读不是 OS 沙箱、全局只读 CLI 或凭据存储不可变保证。用户需自行信任已配置的原生 CLI。

## 构建与验证

仓库 `docs/qcu-feishu-readonly-source.md` 包含合成复现、实际测试数量、SDK 对照、精确命令、最终哈希及待验收项。归档有明确成员 allowlist、固定元数据和全 SHA256 文件名；字节大小及每成员哈希在旁边 manifest 中。精确官方 peers：Cordis `4.0.4`、cosmokit `1.8.5`、dsh-tools `0.2.0-rc.2`、schemastery `3.18.4`。历史 `0.1.0-pilot.1` 归档和证据保留。
