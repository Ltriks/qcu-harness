# 专家团 pilot.2 自主开发交付

用户不便周末手工验收。本轮由代理在独立 worktree 完成可自动执行的开发、审阅、隔离安装及真实浏览器渲染；合成结果不代表真实模型或教学质量通过。

## 源码与产物

- 开发分支：`dev/qcu-expert-teams-hardening`。插件源码修订：`45bb6ed23e9990118e1ecd20114c32233e6c4b13`。
- worktree：`$HOME/Repos/worktrees/qcu-harness/expert-teams-hardening`，与原专家团开发目录隔离。
- 固定包：`qcu-expert-teams@0.2.0-pilot.2`，57,940 字节，SHA256 `4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581`。
- 交付入口：`$HOME/Artifacts/qcu-harness/0.2.0-expert-library.2/DELIVERY.md`。其中 `handoff/` 为审核材料，`release/` 为不可变归档。当前为候选，未发布生产 Hub、未加入完整离线套装。

## 已实现与验证

在已有专家库、团队编排基础上增加历史容量提示、所选记录 JSON 备份、绑定内容和工作区的预览确认清理、失败/停止/中断的部分 Markdown 报告，以及耗时和完成步骤。修复历史查询失败导致停止轮询、清理后迟到响应恢复旧记录、窄屏内部裁切。

源码和解包候选分别通过同一套 35 项核心/控制器和 6 项官方 SDK 检查，即 41 项不同用例；不因执行两次而翻倍。候选另用桌面内置 Node24.18.1 重跑这 41 项，通过。源码和候选浏览器综合场景分别通过：1280/360px、明暗主题、清理取消/确认和实际 JSON/Markdown 下载；候选保存 13 张截图与 3 个下载文件。浏览器结果不计作原生文件选择器通过。

真实 devkit handoff 通过 P10 静态检查（0 错误、0 不支持）和管理端上传入口尺寸/路径预检，保留原生与教学复核要求。静态通过不等于上架批准。

## 构建与复现

预装本地来源准备器、输入边界用例及官方安装/升级/冷加载证明见[预装本地来源说明](qcu-preinstalled-local-sources.md)。工具仅创建全新的干净构建输入；不修复已使用的 Home。

集成用例依赖公开固定输入，已保存为产物目录的 `preinstalled-proof-inputs.zip`：121,734 字节，SHA256 `f591fec81348ba1e4f56870bef91a7c4cd813fe0f95d8db5d6bd28e6f477b35b`。核对 hash，在独立 worktree 的全新 `.work/preinstalled-proof-inputs` 中解包后运行 helper 测试。不得用真实 Home 替代这组输入；ZIP 不是教师应用安装包。官方 SDK 与旧/新插件 TGZ 按测试环境变量指定。

## 待后续验证

代理优先承担可执行步骤；用户无需现在传包、解压或点击验收。当前候选在日常 DSH 的原生导入/下载/重启、真实模型质量/限流/费用、教师教学复核、已使用 Home 的迁移、最终 Mac 离线套装集成、Windows 后续验证，以及生产 Hub 审核发布和固定更新策略，均须独立记录结果。

匿名材料与建议质量量表见[验收说明](qcu-expert-teams-hardening.md)。两个 fixture 均为自编资料，没有真实师生信息。仅在具体步骤确需本人确认时集中提出。
