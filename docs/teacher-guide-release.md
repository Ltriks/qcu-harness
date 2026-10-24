# QCU助手教师离线指南交付记录

日期：2026-10-22。运行版本保持0.1.0-rc.3，本次只增加手册和包装记录，不更新应用、技能、启动器或个人数据目录；不触发新迁移。

## 成果与固定位置

固定根目录：`/Users/mcq/Repos/cowork/qcu-harness/releases/`。

| 成果 | 相对固定根目录的位置 | 字节 | SHA256 |
| --- | --- | --- | --- |
| 单独离线指南 | `QCU助手使用指南.html` | 34954 | `3d8b2a0a6df0dcb7edce322a9766b44493557e0129a36581669b7492f3e80274` |
| Mac Apple Silicon指南包装r3 | `0.1.0-rc.3/QCU-Teacher-0.1.0-rc.3-mac-arm64-r3.zip` | 397489603 | `db2614d10649d7fe05315fd85a4d94bc38e6f80469a975272d1bb44e9a7e0f63` |
| Windows x64指南包装r2 | `0.1.0-rc.3/QCU-Teacher-0.1.0-rc.3-win-x64-r2.zip` | 401556152 | `710e88eee01c03c8dd77553b33c2f8fd53481c94ae55011ac77a5439f61d579d` |

新用户完整解压ZIP，先双击根目录“QCU助手使用指南.html”；Mac双击“QCU助手.app”，Windows进入短目录“QCU助手”后双击“QCU助手.exe”。已有用户可以只阅读独立HTML，不必替换正在使用的APP，也不用卸载旧DSH或重配密钥。

## 内容与依据

- 首次启动、中英文界面入口，以及“离线预装”与云模型调用的区别。
- API Key概念、本人在开放平台创建密钥、助手“更多/More → 设置/Settings → 模型/Models”配置、保存和一句话连接测试。指南无密钥表单，不读写用户配置。
- 冻结版本内置DeepSeek使用Anthropic Messages兼容地址，保留提供商默认；自定义模型需要核对地址、协议、模型ID和密钥。查实际ASAR设置组件和运行界面，附DeepSeek官方文档链接，日期2026-10-22。
- 七项主技能：备课教案、分层练习、学习教练、笔记整理、教材精读、学术诚信、教研简报。示例使用合成材料，先请求加载准确技能，观察“加载技能”记录。没有把普通模型回答当作技能加载成功。
- Course Studio工作区、课程、参考资料格式/大小、确认模型生成、预览修订与明确保存；提醒参考资料过期和未确认任务不要重复生成。
- 飞书只读工具作为选读，区分本人飞书授权和模型密钥；先目录再读指定一节。
- 常见错误码、配置检查、个人数据和求助信息，按老师能理解的步骤编排。

历史 rc3 源文件：[tools/teacher-guide/rc3/QCU助手使用指南.html](../tools/teacher-guide/rc3/QCU助手使用指南.html)，保留上述 34954 字节及 SHA256。该文件逐字节复制自原公开离线发布源；仅支持固定 rc3 Mac/Windows 基包的 `scripts/add-teacher-guide.py` 使用此版本化路径，输出文件名仍为 `QCU助手使用指南.html`。共享路径 `tools/teacher-guide/QCU助手使用指南.html` 现为 Mac rc4 指南，不供此历史包装器使用。设计说明：`docs/teacher-guide-design.md`。无需新增依赖或在线资源；此次仅隔离历史输入，未重建或修改任何冻结交付物。

## 已完成核对与边界

HTML单文件26个唯一ID、8个复制目标、全部内部锚点有效；无CDN/外部字体/自动网络资源、密钥表单或持久化存储；Node脚本语法通过。官方外链只由用户主动点击，标明联网。浏览器安全策略拒绝自动打开file协议，未通过HTTP或其他方式绕过；页面视觉、实际复制/打印及小屏布局尚未浏览器实测。

Mac从固定摘要的r2归档用ditto解压、添加外部指南、重新打包，再把最终ZIP解压到中文空格路径；应用逐文件内容、模式、符号链接与原app-files.json完全一致。另比对旧归档全部非资源叉文件，只允许修改“先读我.txt”及新增HTML和guide-package.json。APP内容和签名相关字节未改变，保留r2此前用户手动验收证据；本次未重新启动GUI或重跑原生初始化，未把r2GUI观察改称r3观察。

Windows保留原ZIP所有条目元数据及二进制内容，仅更新“使用说明.txt”和support/files.json，新增同一份HTML和guide-package.json。最终ZIP所有9877个文件中，9876个由清单记录、摘要全部匹配，其余文件与原包逐个比对完全一致。本次不重复此前Windows运行时检查；原rc.3GUI待验收状态保持。

本次无真实模型调用、无飞书授权/读取、未触碰个人数据。Mac仍是本地签名且未公证；Windows自有启动器签名状态不变。跨电脑首次运行、正式分发签名和真实教学效果沿用之前待验收事项。

固定交付记录：`0.1.0-rc.3/guide-verification-mac-arm64.json`、`guide-verification-win-x64.json`、`guide-static-validation.json`及当前delivery双平台JSON。此前delivery另存为`delivery-mac-arm64-r2.json`和`delivery-win-x64-original.json`，原归档均保留。目录索引及SHA256SUMS同步，源码尚未提交或推送Git。
