# 纯文本 Skill 离线验收包

状态：仅离线准备；未安装真实 Home、未运行模型、未操作 App 或 Hub、未发布 ZIP。此目录不启用现有安装器的生产门，也不提供真实 Home 写入参数。

## 固定内容

- 独立 ID：`chengyuan-study-coach-text-pilot`，版本 `0.1.0-pilot.1`。
- 来源：canonical `skills/chengyuan-study-coach/SKILL.md`；只改 frontmatter 的 name、添加 metadata.version，正文保持一致。源 hash 固定在 prepare.py 与 manifest.json，发生变化即拒绝构建。
- MIT：保留仓库 LICENSE 全文和版权，随包为 LICENSE.txt。不是新增独立授权声明。
- 两个成员均为 UTF-8 普通文本，ZIP mode 0600；无脚本、JS、二进制、依赖、网络地址或外传步骤。文本仍是模型指令，不替代工具运行授权。
- 不修改原 `qcu-study-coach@0.1.0-pilot.1` Host JS TGZ，不把它重新标注为纯 Skill。

| ZIP 成员 | 字节 | SHA-256 |
|---|---:|---|
| chengyuan-study-coach-text-pilot/SKILL.md | 1485 | d15c895e9549149cbbabe5381a83243bad433a8056c1253f5e7d5a3cc52dfb83 |
| chengyuan-study-coach-text-pilot/LICENSE.txt | 1093 | 79832ece489707e2f1c9d5ddeaa9c38958a3bbce2a0d5b67645af5a4039ad787 |

ZIP 1992 字节；SHA-256 `d366f04c8eee8f7beaf635c63e292ab21be3b2d77b1a464968170e5605190e76`。清单为离线核验记录，未签名，不能作为联网安装信任根。重新打包若压缩实现导致归档 hash 不同，必须停下复核，不能默许替换审批对象。

## 离线检查

`python3 hub/pure-skill-pilot/prepare.py` 仅读取上述源码和许可证，在系统新建临时目录输出 ZIP 与清单。无网络、Home 环境变量、App/CLI 调用；Python 检查程序不会进入 ZIP。

6 项测试覆盖固定内容往返与本机重复构建一致性、越界/绝对路径/多余脚本/嵌套条目拒绝、内容变化拒绝、符号链接和可执行 mode 拒绝、重名成员拒绝、临时目录暂存→重命名→按 hash 检查→删除。验证器先检查精确成员和大小限制，再按固定字节验证，未使用 extractall。

最后一项只是单进程合成目录的阶段演练，**不是生产原子安装器、并发冲突保护或崩溃恢复验收**。已在 2026-10-10 运行 6/6 通过；真实写入仍待批准和目标绑定检查。

## 官方 rc.2 源码证据

固定官方 commit `639ed015397290b3745d163aafe02ffee4aa3f84`，版本 `0.2.0-rc.2`。以下均为源码规则，未据此宣称运行中新 Home 的有效配置已验证。

- [Desktop project-manager.ts:32、174](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/src/project-manager.ts#L174)：使用 WEB_PROFILE.bundles 初始化。
- [app-boot profile.ts:183](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/boot/app-boot/src/profile.ts#L183)：web 模板包含 dsh-base、dsh-web-app。
- [web-app patch:475](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/bundle/web-app/cordis.patch.yml#L475)：Host filesystem provider 禁用，交由 preset 挂载。
- [standard preset:34](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/bundle/web-app/presets/standard.patch.yml#L34)：包含 skill-filesystem 和 tool-skill，无局部 watch:false 配置。
- [filesystem index.ts:82、250](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/skill/skill-filesystem/src/index.ts#L82)：watch 默认 true；扫描 dshHome/skills。
- [filesystem README:81](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/skill/skill-filesystem/README.md#L81)：目录和 frontmatter 变化使下次 catalog 刷新，缺失根会被探测；不是保证 UI 即刻出现，也不等于模型调用成功。
- [registry index.ts:807](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/skill/skill/src/index.ts#L807) 与 [README:84](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/skill/skill/README.md#L84)：先按 scope 最近层胜出，同层 rank 小者优先，再 provider 注册顺序和 provider 内部顺序。默认本地 rank：project-dsh100、project-agents200、custom300、user-dsh400、user-agents500。不能把“独立 ID”视为绝对无冲突证明。

## 下一次批准的最小范围（尚未执行）

目标仅为已初始化的新试验 Home；相对目录 `skills/chengyuan-study-coach-text-pilot/`。具体绝对 Home 和用途标记应在私有审批中绑定，不保存进公共开发分支。不得采用旧 Home、复制 key、改模型设置或扫描聊天。

一次批准可覆盖：向该新 Home 新建这两个固定 hash 文件（目录0700、文件0600）；只读核对落盘 hash 与官方标准会话的技能目录/加载来源；若验收失败，仅在身份和 hash 仍一致时移除本次创建的文件及空目录。官方目录发现的操作方法还须在实施前明确；不得以触发模型调用代替无 key 的发现测试。

写前：验证目标 Home 的用途标记、所有者和路径身份；拒绝路径任何层为符号链接、同名目标已存在或无法判定；核对可访问技能目录是否已有同名项。不能覆盖、合并或“已存在即成功”。不读取配置全文来做这些检查。

写入方案：在同一受控文件系统建立新私有 staging，完整验证 ZIP/hash 后写文件、fsync 文件及目录；通过平台支持的 **no-replace** 原子目录提交（例如 macOS renamex_np RENAME_EXCL），禁止使用普通可覆盖 rename 当成并发安全证明。先做平台隔离测试，再获准真实写入。本轮仅合成演练，未实现或执行该生产路径。

回滚：提交前清理本次 staging；提交后必须验证目标目录身份和两文件 hash，任何内容被用户/其他进程改变即停止回滚并报告。只删除本次固定文件与空目录，不递归删除未知内容，不回滚其他 Home，不退出任何 App。崩溃后状态不明必须只读核对，不能自动重试覆盖。

## 真实验收状态

| 项目 | 状态 |
|---|---|
| 纯文本来源、许可证、文件及 ZIP hash | 已核对 |
| 安全 ZIP 与合成目录演练 | 6 项通过 |
| rc.2 标准 preset / watch / 同名规则 | 已读官方源码 |
| 新 Home 路径绑定、真实原子写入 | 待批准、未执行 |
| DSH 实际发现且来源指向目标文件 | 未验证 |
| 模型实际调用并按技能回复 | 未验证；未配置 key 时不能完成 |
| Hub 点击、下载信任、生产分发 | 本轮范围外 |

无 key 时仅能报告真实达到的文件落盘或目录发现阶段，不能声称端到端成功。模型验收必须由用户在新 Home 本地配置自己的 key 后另行批准，不复制旧 key。
