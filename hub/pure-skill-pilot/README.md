# QCU 纯文本 Skill 开发候选

当前源码生成 `qcu-study-coach-text-pilot@0.1.0-pilot.2`。此次仅源码命名整理和隔离测试：没有生成对外分发 ZIP、没有安装新 ID、没有修改真实 Home、运行中的 DSH 或线上 Hub。

旧 `chengyuan-study-coach-text-pilot@0.1.0-pilot.1` 是不同安装身份，不原地替换其内容、版本或 hash。原清单完整保存在 [历史清单](history/chengyuan-study-coach-text-pilot-0.1.0-pilot.1.manifest.json)，原离线说明保存在 [当时的准备记录](history/README-v1.md)；该历史说明不是当前安装状态。

## 内容和核验

来源仍为已固定 hash 的 canonical `skills/chengyuan-study-coach/SKILL.md`；该路径是来源记录，不是新产品 ID。生成时改 frontmatter 名称/版本及正文中的产品显示“城院”为“QCU”，业务指导不变。许可证全文不改。当前 [manifest.json](manifest.json) 是内存构建计算的开发清单，未签名、未发布。

| 内容 | 字节 | SHA-256 |
|---|---:|---|
| qcu-study-coach-text-pilot/SKILL.md | 1470 | f638947891025ac189a8abfd8dce0b176a11e6ccf5b52ed393d5a7ef90327603 |
| qcu-study-coach-text-pilot/LICENSE.txt | 1093 | 79832ece489707e2f1c9d5ddeaa9c38958a3bbce2a0d5b67645af5a4039ad787 |
| 预期 ZIP | 1961 | e78dfac5b0cc1b27e462fe8cf59136ba6493c97732e9b93ed2084bbdd524b4eb |

`python3 hub/pure-skill-pilot/prepare.py --test-only` 只在隔离临时目录测试，不生成候选发布文件；省略选项才生成本机临时离线 ZIP，仍不会安装/联网/调用 App。本轮只执行 test-only，并在内存计算新清单。压缩实现变化导致 hash 不同必须重新核查，不能替换旧审批对象。

安全测试覆盖精确成员、字节/UTF-8、大小、mode、路径越界、多余脚本、符号链接、重复项、内容变化与合成目录阶段演练。合成演练不等于生产并发安全或崩溃恢复认证。

## 待确认迁移

拟新增相对目标 `skills/qcu-study-coach-text-pilot/`；不是把旧目录直接改名。需批准绑定真实 Home、新版本/hash、no-replace 原子提交、发现测试及失败时有备份的受限回滚。旧 ID 暂留，待新 ID 被真实 DSH 发现后再批准退役；不会自动同时调用两者。

官方 rc.2 provider/watch/同名优先级证据保留在历史准备记录中；命名不改变这些规则。无 key 时必须区分文件落盘、真实 DSH 发现和模型实际调用。当前新 QCU ID 三项均未真实验收。

总命名清单、系统标识兼容与退役流程见 [QCU-NAMING-MIGRATION.md](../QCU-NAMING-MIGRATION.md)。
