# P16 父审查恢复与最终候选说明

TASK-ID: QCU-P16-PARENT-REVIEW。跨端数据契约见 [原契约中的父审查章节](qcu-teacher-product-polish.md)。当前候选市场 `0.1.0-pilot.16.1`、主题 `0.2.6-pilot.2`。初版 16.0 / pilot.1 的包、清单及结果留在 `.work/product-polish/`，不覆盖、不分发为本轮最终包；两轮均未批准或部署。父流程沿用组件审查阶段预先约定的 pilot.2；旧 pilot.2 候选及清单完整保留，以表中精确哈希确定最终字节。候选尚未发布，未覆盖旧包。

本文记录组件审查阶段；后续主线程完整 Mac 候选与最终交付见 [P16交付和验收](qcu-p16-delivery.md)。组件审查阶段不重建完整 Mac 应用，不安装、迁移或读取使用中的 Home，不读取 Key，不调用真实模型，不部署或续期。课程与专家源码、课程专属测试和归档冻结。课程产品仅在通用发布元数据核对中作为已有条目读取，不纳入功能验收。

## 恢复行为

反馈正文仍只留当前表单。只有用户检查全部预览并单独确认后，Host 才在该 profile 的专属 `qcu-feedback-receipts` 目录保存最小查询 intent，随后访问固定校内 Hub。目录 0700、文件 0600；不保存标题、正文、材料、输出、路径、Key 或账号。最多 32 条，不自动清理，不扩展更新水位/更新日志白名单。满额或不安全状态会拒绝发送，已有回执仍可查询。

重新打开后只读取本地历史，不自动提交或查询 Hub。“待查询”表示查询凭据存在，不表示 Hub 已收到；点击一条回执才联网查询。维护者处理后仍需教师确认实际问题是否解决。短编号便于浏览，复制按钮复制完整回执编号供维护者定位；公开查询能力由本机保存的随机 requestId 提供。

超时、中断、非法响应或 5xx 均保留为未知结果。先查询旧回执；需要改写内容时点击“另建一条反馈（保留原回执）”，再生成、检查和确认。禁止用同一请求重复 POST。导航、连接重置或插件销毁会撤销确认并取消等待，迟到回包不能覆盖新回执；已被 Hub 接受的反馈不会因取消而撤销。

首页仅保留一条紧凑的首次任务入口。完成记录来自教师明确确认，仅持久化有限步骤、真实任务 ID 和确认布尔值；重开不恢复草稿或“已打开草稿”的推断。旧教程/初始化标记不代表完成。重置指引不改字体、主题或其他用户设置。独立市场没有主题时继续提供 P9 手动路径：“设置 → 模型”，准备匿名任务，进入对话核对模型并手动发送。

## 维护与恢复步骤

1. 公开接收器仍需显式 `--feedback-root`；不配置则原只读写响应不变。管理员仍为 qcu-admin、仅绑定 127.0.0.1，沿用原登录和同源校验。新增收件箱锁总等待最多 1 秒；超时返回忙碌，不能把客户端超时当作服务端取消成功。
2. 管理员等锁并读取后会重验会话，过期时不返回原文、不修改状态。界面提示重新登录，操作不会自动重试。接收器重开严格检查时间戳和审计链，损坏时保持失败关闭。
3. 备份前正常关闭拥有该 profile 的客户端，确认相关操作已停止；仅备份专属回执目录，保留 0700/0600、单链接和精确文件字节，不复制整个 Home。恢复到新的隔离私有位置，先验证并只读加载，再明确查询。此轮只对临时合成 profile 演练，没有读取真实 Home。
4. `intent-00.json` 至 `intent-31.json` 是不可变已发布 intent。`.intent-NN.lock` 是发送前的预留；正常写入会原子 rename 发布。中断预留会阻止该槽位后的新写入，等待有界；它不证明反馈已发送。维护者停机后先完整私有备份再核对，不自动删除或重发。完整预留也不能直接当作网络发送授权。无法确认时保留现场，交由维护者恢复；已发布 intent 不覆盖。
5. 管理端、收件箱、签名/账号和公开快照仍互相独立。备份不放入仓库、公共 HTTP 或候选包。公开路径、编码路径、管理员 API 均不能读取收件箱文件。

## 维护一致性

只读审计使用已有两个独立公钥与固定策略：`updates.json` 只能为 pilot，`updates-v2.json` 只能为 pilot-experts。缺少 v2 时仍支持旧源回退。签名、归档完整性、真实包名/版本、成员清单、脚本/依赖/peer 表面和有效期分别核对，不执行包。

父审查 public-only 快照仅在本地离线读取。审计会比较目录与当前有效投影的逐产品最新版本；初装目录可用不等于更新源覆盖。覆盖缺口会使机器报告非零并给出独立审核/更高修订建议，不改公钥、不扩展产品策略、不自动加入目录或发布新版本。快照不是此刻线上状态，不能据此声称已续期。

```sh
rtk proxy node scripts/audit-product-polish.mjs --root /private/tmp/qcu-p16-public-observed-64m3hgr8
rtk proxy node scripts/audit-product-polish.mjs --root .work/product-polish-review --release-only
rtk proxy python3 scripts/draft-product-polish-renewal.py --audit .work/product-polish-review/PUBLIC-SNAPSHOT-AUDIT.json --output .work/product-polish-review/UNSIGNED-RENEWAL.json
```

续期草案包含各域当前修订、公钥身份、当前指纹、更高修订下限和建议 7 天时间窗。它明确 `signed:false`、`deployable:false`，不能作为 feed 部署。更新投影仍遵守既有共同修订下限；真正发布须经过原独立预览/确认流程，缺失投影不会自动创建。

## 构建、预览与后续验收

新成果统一输出 `.work/product-polish-review/`。构建器支持 `QCU_PRODUCT_POLISH_OUT`；最终预览还指定 `QCU_PRODUCT_POLISH_CLIENTS`，读取新 TGZ 提取出的精确文件，而不冒用初版字节。

```sh
rtk proxy node scripts/build-teacher-theme.mjs .work/product-polish-review/clients/qcu-branding
rtk proxy node hub/plugins/qcu-market/build.mjs --client-only
# 最终包提取后，按 RESULT 中的路径构建预览：
rtk proxy env QCU_PRODUCT_POLISH_OUT=.work/product-polish-review QCU_PRODUCT_POLISH_CLIENTS=.work/product-polish-review/packaged-clients-reviewed-final node scripts/build-product-polish-preview.mjs
rtk proxy env QCU_PRODUCT_POLISH_OUT=.work/product-polish-review node scripts/serve-product-polish-preview.mjs
```

预览脚本只启动 loopback，打印教师与合成管理员地址；qcu-admin / `synthetic-preview-password` 仅用于临时 fixture。Ctrl-C 停止进程并清理合成状态；无实际发送模型或安装动作。最终 RESULT 记录本轮完整受影响套件、精确客户端哈希、当前截图、失败修正及未测范围，preflight 不冒充最终结果。

教师稍后验收：选择真实可用文件夹，编辑匿名样例、打开草稿，自行核对模型并发送和审阅；确认完成后重开，检查入口变为回看且设置未变。反馈先检查全部预览；未知结果时查询旧回执，重开后再次查询，再明确另建一条，检查两条回执都保留。维护者处理后由教师实测问题是否解决。课程严格排除。

完整 Mac 候选由父流程在审核本轮归档后决定，从已有 rc4.2/source `67768251d96aa189a2819c0da18a63d0f0d9bdec` 进入下一阶段。此轮不做完整 App 重建、签名、生产部署、Windows 或真实教师效果验收。

## 本轮实际结果

最终证据为 `.work/product-polish-review/RESULT.json`，最终分发输入只采用 `packages/reviewed-final/`。该目录下两个包均已复包一致、逐成员核对；`packaged-clients-reviewed-final/` 来自它们的精确提取，`PREVIEW-BUILD.json` 记录客户端与浏览器 bundle 指纹。`packages/final/`、`packages/reviewed/` 中更早的本轮候选保留为历史；前者市场包由总字节上限修正替代，后者主题包由问题帮助修正替代，均不作为最终交付。`core-reviewed-evidence/` 保留旧描述符、bundle 和浏览器记录。市场 16.1 沿用已经核对的精确归档，无重新构建或换字节。

| 包 | 字节 | SHA256 |
| --- | ---: | --- |
| qcu-branding 0.2.6-pilot.2 | 16657 | `b57d69aeb6516a5650962a4afd5e1b28320c0b9c8dabc5c0e5b02dfe9fa40f2e` |
| qcu-market 0.1.0-pilot.16.1 | 86390 | `edcacdc3f9de83f08f2dca21f3f1f54e60161e314a58529ced819bc2ee4a3c69` |

193 项独立检查通过：核心 107 项、额外安装锁/反馈整合 1 项、官方 SDK/Gateway 27 项、收件箱/真实锁/登录过期 15 项、管理员 26 项、公开只读服务 10 项、完整浏览器 7 组。重复运行不重复计数。浏览器覆盖 108 个布局组合和 35 张本轮截图，包含六类折叠问题帮助及展开零网络/模型/安装作用检查、跨 Host/Client 重开、未知结果查询、保留旧回执的新建操作、管理员状态闭环及独立市场；所有本地进程在套件结束时关闭，浏览器沙箱保持启用，无外部浏览器请求。

公开快照离线验证了目录修订 3、旧更新源修订 2、两套签名和 24 个真实归档的身份/成员。v2 的 404 保持正常回退；目录有效，旧更新源不足 72 小时。两项覆盖缺口仍需父流程另行处理：专家目录版本没有更新记录；课程目录版本高于旧更新源。本轮只核对这些发布元数据，不改模块或开展课程验收。审计因此有意退出 2，属于保留的发布发现，不是已修复或已续期声明。

`UNSIGNED-RENEWAL.json` 建议目录至少修订 4、旧更新源至少修订 3，包含各自当前指纹、公钥身份和建议时间窗；明确未签名、不可部署。`MAC-STAGING-INPUTS.json` 仅准备下一阶段输入。未测原生完整 Mac、Windows、生产当前状态/真实登录、真实模型、教师效果及旧归档协议全配对矩阵；未提交或推送。

## 后补检查已落实

使用指南将网络/Hub、Key、繁忙/限流、明确额度拒绝、工作文件夹、安装不确定分为六项折叠帮助。繁忙不推断为余额耗尽；Key 只在官方设置核对；安装不确定先检查回执与正常重开。帮助不做探测或自动重试。实际新包客户端浏览器检查六项均可达，展开前后调用列表相同，无请求。离线使用指南不在此处改写。

接收器移除邮箱本地部分的逐字符贪婪重试，并按非重叠 URL 片段扫描私人链接，保持原有隐私拒绝语义。四种 6000 字合成输入各 20 次，共 80 次校验约 0.064 秒，门槛 1.5 秒；原有凭据/邮箱/私人路径/授权链接回归和新增边界均通过。见 `PRIVACY-PERF.json` 与 `logs/feedback-privacy-final.log`。初次性能测试的重复 URL fixture 超过 6000 字被正确拒绝，已修正 fixture 后完整 15 项通过，不计为产品缺陷。
