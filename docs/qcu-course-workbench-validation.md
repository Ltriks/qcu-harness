# QCU 课程工作台重写与本地验收

任务 `QCU-COURSE-WORKBENCH`，2026-10-16。用户明确要求舍弃同事源码重写；输入为《数学课程设计工作台-原型v1.html》与两份交接文档。视觉沿用奶油白/绿色、课程与组件选择；首版聚焦一条课堂活动草案流程，不实现原型中教务排课、学生或成绩系统。

## 接入与区别

源码 `hub/plugins/qcu-course-workbench/`；官方 DSH 0.2.0-rc.2，Cordis 4.0.4，JS模块，与现有市场保持一致。Host/Client/包内说明Skill为一个产品：一个默认禁用的Host配置行，Client由官方清单发现。Client使用lazy-CJS factory及宿主React；sidebar.panellist只贡献图标，官方侧栏拥有按钮、selectPanel及selector hook；main为keyed slot。Remote先挂载再消费自身命名空间，释放顺序相反。

旧交接的两个对话工具和14项全局禁用策略不复用。新方案由教师在工作台中明确创建任务，直接调用官方LLM服务，不创建代理对话或增加代理工具。Skill只描述UI流程。资料中的文本及模型输出均是数据，不执行任意代码。Host无shell、外部引擎或私有原生桥。零新运行依赖，不随包携带node_modules、Key、用户profile或样本。

## 数据与确认

- 工作区来自官方workspaceRegistry，由教师选择；不接收任意路径。按工作区保存`.qcu-course-workbench/state.json`和`Course Studio/<course_id>/`。课程同名不合并；ID用128位随机值。任务和课程各上限100，保存回执1000；状态文件最多24MB，不自动删除用户成果。
- 教师选文件字节或粘贴摘录；TXT/MD/CSV/DOCX/PPTX，单文件8MB、提取文字6万字符、全局暂存24万字符。正文以外的图片/公式对象/批注不解析。PDF/扫描件/旧二进制Office不支持，明确提示转换为已核对文字。ZIP只读取指定正文XML、不解压路径，拒绝加密、过量膨胀、实体定义。
- 资料仅Host内存，30分钟有效、绑定课程、单任务消费。浏览/预览/导出不调用模型；点击生成前确认发送资料，修改资料或目标后撤销勾选。Host核对页面显示的默认模型路由，模型变化拒绝生成；插件不读取凭据。
- 所有11项目标字段纳入任务指纹；课程+客户端逻辑会话+输入+引用+模型路由绑定幂等。同一请求重放不新建。取消太晚返回成功状态；超时为unknown，不自动重试；Host退出未完成任务为restart-required，不自动恢复。
- 模型仅返回严格JSON内容：完整组件集合、时间总和、枚举、数量和长度均校验。交互SVG和离线HTML由可信模板绘制。14种组件可选，六种创意组件实验性；几何仅三角形、函数仅二次函数。课程框架是本地设计标签，不声称学校/考试机构认证，AP/MCAA/portfolio对标默认关闭。
- 先预览，可修订并应用；保存确认绑定草案摘要和导出字节摘要。默认另存版本，覆盖须现有摘要一致；拒绝符号链接和危险文件名。保存先写意图日志，再写成果并核对摘要；写后断连/崩溃可只读核对原意图，避免重复版本。停用保留已保存内容。

## Remote契约

唯一命名空间`qcuCourse.dispatch(payload, signal)`，输入/输出均为有界JSON字符串（12,000,000/1,500,000字符）。所有操作走官方认证Typert/Gateway；没有额外本地HTTP或WebSocket生产服务。

`workspaces`读取已登记工作区和当前模型，不读用户文件。其余请求为`{workspaceId,request}`；生成另外带`expectedModel`。Host只通过该workspaceId解析目录。

| action | 内容与边界 | 写入与确认 |
| --- | --- | --- |
| snapshot | 当前课程、任务摘要与未过期资料元数据 | 首次访问建立工作台目录；不发送模型 |
| createCourse | requestId、≤120字课程名 | 持久化；同请求幂等 |
| addReference/removeReference | courseId、浏览器字节/不透明referenceId | 内存暂存/撤销，不读其他文件 |
| generate | courseId、requestId、sessionId、目标、≤8个资料ID、consent=true | 持久化running后消费资料并调用官方LLM；同时仅一个任务；120秒超时 |
| task/cancel | courseId、taskId | 查询/持久化取消；不自动重新生成 |
| revise | taskId、courseId、旧draftHash、严格draft | 应用教师修改；旧摘要拒绝 |
| prepareSave | taskId、component、draftHash | 只准备目录与核对目标，返回路径/摘要仅供工作台，不进模型 |
| save | saveId、双摘要、mode、confirmed=true | 明确另存或覆盖；日志先于成果，回执幂等 |
| saveStatus/abandonSave | courseId、saveId | 核对原文件，或放弃未完成意图；不删除已生成文件 |

资料正文、服务URL、凭据和路径都不作为模型工具输出。错误用固定码，底层路径/栈/提供方原始错误不传给模型。未知结果先核对原任务；saveStatus不会创建成果。

## 已执行本地验证

核心回归覆盖14项完整闭环、两门同名课程隔离、过期/一次性引用、全部目标字段变更、重复请求、取消太晚、超时、Host中断、保存意图崩溃恢复、覆盖变化、符号链接和危险ZIP。Client测试执行构建后的lazy-CJS并真实React渲染；官方服务测试使用本机固定rc.2依赖中的真实Cordis、Typert Host/Client、LLM流组装、Skill和SlotRegistry，验证挂载与停用释放。

Chrome在有永久合成标记的预览中完成：选工作区→创建课程→中文界面→加入匿名摘录→14项组件→确认生成→查看预览→确认保存，实际文件与页面摘要一致。预览LLM是显式合成适配器，不是实际模型效果证据。

15份合成导出包含7份DOCX/PPTX、8份离线HTML。Python zipfile/XML、python-docx/python-pptx独立检查通过。已用本机官方LibreOffice引擎实际将DOCX渲染为2页PDF、PPTX为8页PDF，并核对文字内容。直接Office转PNG在该本机引擎产生透明图，不能作为布局证据；改用Office→PDF→官方PDFium转PNG，已目视核对Word第1页、PPT第1/6页，中英文字可见、无缺字体、无截断。未把透明图记为通过。

## 复现

已有审计依赖：`QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source`。不需要npm安装。

```sh
rtk proxy node hub/plugins/qcu-course-workbench/build.mjs
rtk proxy node --test tests/qcu-course-core.test.mjs tests/qcu-course-client.test.mjs
rtk proxy node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-course-official.test.mjs
rtk proxy node scripts/course-export-fixtures.mjs
rtk proxy /Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python tests/test_course_exports.py
rtk proxy node scripts/course-render-check.mjs
rtk proxy node scripts/course-image-check.mjs
rtk proxy python3 hub/plugins/qcu-course-workbench/pack.py <输出目录>
rtk proxy node hub/plugins/qcu-course-workbench/preview.mjs
```

Client与官方测试/预览需要导出上述环境变量。渲染脚本的输出目录须全新，官方引擎拒绝覆盖；可在独立worktree或新验证根目录复现。预览仅监听127.0.0.1，资料/成果只进入临时合成工作区，不打入TGZ。

## 待现场验收

真实DSH安装/启用与真实侧栏挂载、本人模型真实输出及成本、教师逐项审核、目标Word/PowerPoint/Keynote打开、Windows、资料公式/图片提取均未声明通过。局域网Hub部署另需明确确认，不替换既有固定包，不在本次中合并main或改用户Home。市场候选增加固定课程工作台包，保留原8个发行条目；以本次最终manifest和交付记录核对实际摘要。
