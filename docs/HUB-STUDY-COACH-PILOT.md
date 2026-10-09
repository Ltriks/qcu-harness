# 学习教练：首个真实技能的离线候选

候选qcu-study-coach 0.1.0-pilot.1仅封装canonical `skills/chengyuan-study-coach/SKILL.md`，提供任务拆解、一周节奏及错题复盘指引。正文逐字节保留，不包含私人材料，不是正式学校评分规范。SHA256：dfd2fac7624c2f46f0bdcb15c7ea475156082d538b44d023f39b7e445e42de32。

Bundle默认停用；代码只注册内存Skill，校验正文固定哈希，不读文件、不联网、不执行工具/子进程。固定Cordis4.0.4及DSH Skill0.2.0-rc.2 peers，无runtime dependencies或安装脚本，不改DSH源码。

## 当前产物与边界

使用 `scripts/stage-study-coach-pilot.py --out NEW_DIRECTORY` 生成确定性8文件TGZ、schemaVersion1目录、来源/哈希回执和本说明。生成的JS字面量与MD共同打包，没有在Git维护第二份正文。完整文件名、包与目录SHA256以随包PREPARATION.json为准；目录published/approved仅表示离线候选经过本次源码审阅、可下载，不是用户已批准安装、LAN上线或公开上架。包synthetic=false表示真实通用指引，验收问题仍必须人工合成。

本轮只完成源码审阅、离线打包及单元/真实Cordis服务生命周期检查；没有模型调用、官方管理器实际安装、原生GUI验收或修改`.68`的目录/服务。packageReady=false。单元重建context不等于App重启，不证明学习效果或正式规范符合。

## 首次安装：需要批准的明确范围

使用此前test.1的独立Home和官方rc.2，保持workspace-write+ask、HMR关闭。确认原CSV Home及用户任务不受影响；先list实际插件/Skill，若已有同名`chengyuan-study-coach`就停止确认来源，不覆盖。

1. 从独立受信渠道取得本次目录/包SHA256，在自己的机器核验TGZ；旧test.1助手固定检查合成探针，不能拿它的PASS证明此包。不要把Hub主页当package spec，也不要从旧安装器同版包代装。
2. 仅调用官方plugin_manager安装该核验本机TGZ。先拒绝并确认包依赖/Bundle状态不变，再重试只允许一次；不得approvedBuilds、版本豁免或永久Full Access。包名必须qcu-study-coach、版本必须0.1.0-pilot.1。
3. 正常Quit/restart独立App；默认row仍停用。通过真实list_plugins取得精确entryId，按次批准set_plugin(enabled=true)，再次正常重启。
4. 展开真实skill调用`chengyuan-study-coach`，确认返回canonical标题、任务拆解/一周节奏/错题复盘及“不代写”的规则。助手正文自述不是工具证据。
5. 只用合成问题：一门虚构课程，三天后需要自己完成一章阅读提纲，每天两小时；请求4～7步可勾选计划。应提供方法与检查点，不代写应交正文、不编造学校评分标准；缺信息可先问。真实模型调用仅在另获此测试批准后进行，模型设置私下留在自己的官方App。
6. 按次批准set_bundle(false)，正常重启后Skill不再可用；如移除，须在已取消Bundle选择的重启后remove_bundle，再重启检查消失。保留官方stop-profile及兼容门槛，不shell强删。

反馈只需包版本、逐步PASS/FAIL/未测、真实工具动作和固定正文要点；不交API Key、认证地址、个人路径、原日志、学生材料或完整思考正文。`.68`现有合成站保持原样；将候选上架到LAN或执行实际安装需另获具体批准。

## 历史内容核对

10份旧Skill正文匹配canonical；均为通用教学指引，未发现其中含账号密钥、实名学生或私文档。涉及资料、分数或教学口径的技能需相应后续验收，未全部标为已可用。course-qa引用的3份缺失文件是基础会计“大纲/讲义摘录/习题”样例，不是学校正式资料；旧ZIP缺少UTF-8文件名标记，按原UTF-8字节还原后与历史源码一致，本轮不导入。旧安装器TGZ的CLI帮助、默认URL、manifest测试项、补丁固定地址及README共5/8文件与canonical不同；旧包仍固定10.77.0.67，不能因都叫0.1.0而当同一版。该安装器与本候选无运行依赖。
