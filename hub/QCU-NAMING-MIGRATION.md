# QCU 命名清单与迁移边界

今后产品显示使用 **QCU**；技能/包/目录 ID 使用 `qcu-`，工具函数使用 `qcu_`。本次只改未发布开发源码与测试，不安装、发布、修改真实 Home、系统注册或在线目录。`chengyuan` 在固定包、历史证据、来源路径和兼容性字段中的出现不代表新产品命名。

## 本次开发源码已调整

| 原开发名称 | 新开发名称 | 范围 |
|---|---|---|
| ChengyuanInstallerPrototype | QCUInstallerPrototype | Swift package 名 |
| ChengyuanInstallerDemo | QCUInstallerDemo | 新编译 product、未来开发 .app 文件名；旧 .app 未重建/重命名 |
| 城院安装助手 | QCU 安装助手 | 新源码窗口与界面文案 |
| chengyuan-study-demo / chengyuan-plugin-demo | qcu-study-demo / qcu-plugin-demo | 动态合成测试包 |
| test-chengyuan | test-qcu | 新合成目录 ID |
| chengyuan-install://request | qcu-install://request | 未注册的协议合同、解析与测试；没有操作系统注册 |
| chengyuan- 临时目录及 simulation-owner | qcu- 临时目录及 simulation-owner | 新建合成测试，不迁移历史临时目录 |
| chengyuan-study-coach-text-pilot@0.1.0-pilot.1 | qcu-study-coach-text-pilot@0.1.0-pilot.2 | 新源码候选与新 hash；旧安装保持 |

构建辅助脚本目前**保留** `org.chengyuan.installer.isolated-demo`，避免在这次命名整理中暗自改变系统身份；仅未来开发输出文件名和显示名改变。不得将同 bundle ID 的新旧 .app 当成隔离应用并行分发。正式构建前应确认新的 QCU bundle ID、签名与旧版退役方案。本轮未执行 .app 组装脚本、启动或系统注册。

## 已安装或已发布项：仅规划

| 原身份 | 拟新身份 / 版本 | 共存或退役方法 |
|---|---|---|
| 纯 Skill chengyuan-study-coach-text-pilot@0.1.0-pilot.1 | qcu-study-coach-text-pilot@0.1.0-pilot.2 | 另建目录并校验新 hash，发现验收后再批准有备份移走旧目录 |
| skill chengyuan-study-coach，位于固定 Host 包内 | skill qcu-study-coach，建议 metadata.version=0.1.0-qcu.1 | 不改原 TGZ；随新包发布，先独立试验 Home 验收 |
| qcu-study-coach@0.1.0-pilot.1（包名已合规） | qcu-study-coach@0.1.0-pilot.2（拟） | 更改内部 skill ID/路径/元数据后新构建、审核、签名与新 hash。同 npm 包名版本不能在同 profile 并存；按官方升级/重启及回退流程另批 |
| chengyuan-skill-installer@0.1.0 | qcu-skill-installer@0.2.0-preview.1（拟） | 旧工具/CLI/配置映射一起迁移，避免并行写入；先停用旧安装入口，再启用新入口，均另批 |
| chengyuan_skill_list / chengyuan_skill_install | qcu_skill_list / qcu_skill_install（拟） | 新插件明确提供新工具；不静默建立高权限别名 |
| chengyuan-skill CLI | qcu-skill（拟） | 新包 bin 名与文档同步，旧 CLI 仅保留明确弃用信息，删除另批 |
| CHENGYUAN_CATALOG_URL / CHENGYUAN_SKILLS_DIR | QCU_CATALOG_URL / QCU_SKILLS_DIR（拟） | 新实现可在明确过渡期只读旧变量；两套同时给且不一致时拒绝。此轮不改用户环境 |
| org.chengyuan.installer.isolated-demo | 新 QCU bundle ID 待确认 | 系统身份、签名、旧 App 退役独立批准，不能靠改显示名完成 |
| Home marker purpose=chengyuan-official-desktop-pilot | 新 schema 的 qcu-official-desktop-pilot（拟） | 现有精确标记检查保留，不批量重写；将来需绑定原 homeID 的显式迁移记录 |

原发布 TGZ SHA-256 `76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c` 和旧纯文本 ZIP SHA-256 `d366f04c8eee8f7beaf635c63e292ab21be3b2d77b1a464968170e5605190e76` 均保持不变。线上 URL、catalog、归档测试字节、原版本和许可证不可原地替换。

## Canonical 技能清单（本轮保留来源，只列迁移）

这十项的实际使用范围不完全已知，不能将 draft catalog 等同“无人安装”。拟新独立 metadata.version 均为 `0.1.0-qcu.1`；发布前分别审核业务内容、精确新 hash、依赖与重复名，不能仅批量替换文本就发布。

| 旧 ID | 新 ID |
|---|---|
| chengyuan-acct-entry-coach | qcu-acct-entry-coach |
| chengyuan-acct-practice-brief | qcu-acct-practice-brief |
| chengyuan-acct-statement-reader | qcu-acct-statement-reader |
| chengyuan-acct-teacher-draft | qcu-acct-teacher-draft |
| chengyuan-course-qa | qcu-course-qa |
| chengyuan-exam-review | qcu-exam-review |
| chengyuan-integrity-guard | qcu-integrity-guard |
| chengyuan-note-organizer | qcu-note-organizer |
| chengyuan-reading-outline | qcu-reading-outline |
| chengyuan-study-coach | qcu-study-coach |

已有 qcu-document-diff、qcu-meeting-actions、qcu-table-audit、qcu-thesis-format-check 无需因本次前缀要求改名。未来 Hub 显示改 QCU，但已部署页面、旧下载路径与 catalog 必须另走新版本发布流程。

## 迁移顺序与验收

1. 冻结旧版本/hash、来源和版权；新 ID 与新版本建立独立清单，不改历史回执。
2. 对明确目标取得迁移批准；冲突即停，不覆盖、不修改其他 Home，不复制 key。
3. 新纯 Skill 先校验/安装/发现；新代码插件使用官方安装审批、bundle 与 row 启用、重启和兼容性规则。名称一致不等于权限批准。
4. 新旧共存期间明确展示来源，避免重复调用；官方同名包升级使用独立试验 Home，不能假称同 profile 两版本共存。
5. 新身份验收后，单独确认旧入口停用和有备份退役；用户修改过的旧内容必须保留。未知状态不自动清理。

仍保留的旧字样按用途分类：不可变 archive fixtures / manifest、历史准备记录、canonical 来源、Home marker 和 bundle ID 的兼容性检查。第三方名称、许可证全文及作者版权不得重写。

## 本轮源码验证

2026-10-10：71 项隔离 XCTest、2 项 Hub 请求测试、6 项纯文本安全测试通过；追加旧 chengyuan 协议拒绝用例单独通过。OfficialChecksTests 显式跳过，无真实进程扫描或官方 App 操作。逐字节对比旧 manifest/准备记录未变、固定 TGZ hash 未变，新 QCU 清单与内存候选字节一致。新 Swift 开发可执行文件仅编译，未启动；既有 .app、系统标识和已安装技能未更改。
