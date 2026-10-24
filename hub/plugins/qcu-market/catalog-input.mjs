// Reviewed source input; generated snapshot is shared by Host and Client.
import {release} from './src/trusted-release.mjs'
import {readFileSync} from 'node:fs'
const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'))
const products=readJson('../../skill-products/products-input.json')
const releases=readJson('../../market/skill-releases.json')
if(products.length!==5||releases.length!==5||products.some((p,i)=>p.id!==releases[i].id))throw Error('Reviewed Skill release coverage mismatch')
const externalProduct=readJson('../../skill-products/external-product-input.json')
const externalRelease=readJson('../../market/external-skill-release.json')
if(externalProduct.id!=='qcu-team-briefing'||externalRelease.id!==externalProduct.id)throw Error('Reviewed external release coverage mismatch')
const allProducts=[...products,externalProduct],allReleases=[...releases,externalRelease]
const skills=allProducts.map((product,i)=>({...product,sourceLabel:product.id===externalProduct.id?'第三方改编':'QCU自有',kind:'skill',
 capabilities:['skill'],
 provenance:readJson(`../../../skills/${product.id}/SOURCE.json`).provenance,
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，使用静态说明需在目标会话确认技能发现并自行配置模型。',
 risk:'提供方在Host进程以应用用户权限运行，仅注册静态说明；不增加工具权限。官方安装会改写profile依赖、锁文件、缓存与日志，可能访问registry。安装默认不启用；另一次确认覆盖本包及唯一组件。',
 testStatus:'合成示例；源与隔离测试阶段，未部署、未测试模型输出或教学效果。',release:allReleases[i]}))
const feishuRelease=readJson('../../market/feishu-release.json')
if(feishuRelease.id!=='qcu-feishu-readonly'||feishuRelease.version!=='0.1.0-pilot.1.1'||feishuRelease.bytes!==11263||feishuRelease.sha256!=='37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17')throw Error('Reviewed Feishu release coverage mismatch')
const feishu={
 id:'qcu-feishu-readonly',title:'飞书文档只读',scenario:'教学文档',purpose:'列出一个已配置文档的目录，待老师选择后返回其中一节供审阅。',sourceLabel:'QCU自有',kind:'bundle',capabilities:['tools'],
 prerequisites:'本机已有可信原生 lark-cli、本人正常用户只读授权；在官方插件设置中填写 CLI 绝对路径和一个授权文档的基础链接（不含查询或锚点）。开发机授权不会转移。',
 risk:'Host 与已选原生 CLI 子进程以应用用户权限运行，不是 OS 沙箱；CLI 可正常刷新自身凭据或缓存。安装默认不启用，另一次确认覆盖包及唯一组件；配置与用户只读授权另行由本人完成。只读工具仍遵守官方审批；选中内容进入当前模型/会话，DSH 可能按会话策略保存工具输出。',
 example:'先列出已配置文档的目录，等我选择章节后再读取。',
 testStatus:'固定1.1源/归档与合成官方设置检查已通过；父线程已验证本机CLI目录及一节读取。章节回执绑定目录版本快照，修改配置或重列目录后需重新选择；原生DSH安装/配置表单、目标会话工具发现与模型读取、教师验收仍待确认。',
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'hub/plugins/qcu-feishu-readonly',pinnedRevision:'cc54be21d20b37491ea32805b6d58ac36048f1f8',license:'MIT',modifications:'QCU单文档只读适配：只注册 qcu_feishu_outline 与 qcu_feishu_section 两个工具，无 Skill；本次市场集成保留已审核1.1源码与归档字节。'},
 release:feishuRelease
}
const courseRelease=readJson('../../market/course-release.json')
if(courseRelease.id!=='qcu-course-workbench'||courseRelease.version!=='0.1.0-pilot.1.3')throw Error('Course workbench release mismatch')
const course={
 id:courseRelease.id,title:'课程设计工作台',scenario:'备课与课堂活动',purpose:'选择参考资料与学习目标，生成14种课堂草案组件，教师预览修订后保存。',sourceLabel:'QCU自有',kind:'bundle',capabilities:['workbench'],
 prerequisites:'DSH 0.2.0-rc.2；先建立工作区并在官方设置配置默认模型。英文/中文界面，支持TXT/MD/CSV/DOCX/PPTX；PDF须提供经核对文字摘录。',
 risk:'Host以应用用户权限运行；只读取教师选择的资料字节。确认生成后将所选文字及目标发送给本人默认模型，可能产生费用。课程/草案存于选定工作区；参考资料只留Host内存、30分钟有效、单任务消费。预览后另确认保存，重名另存或明确覆盖；不创建对话、不修改其他插件或读取Key。安装与启用分别确认。',
 example:'侧栏 Course Studio → 选择工作区并创建课程 → 加入匿名参考资料 → 填写学习目标 → 选择2至4项组件 → 确认生成 → 教师审阅修订 → 查看位置并保存。',
 testStatus:'固定1.3本地候选，未生产发布；归档与所供源码及提交7e647436f0849be617b360add1cd771d47fa8339逐文件核对。原生DSH、真实模型成功生成、教学质量、费用和限流、教师试用及Office验收仍待确认。',
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'hub/plugins/qcu-course-workbench',pinnedRevision:readJson('../../market/course-source.json').revision,license:'MIT',modifications:'依据用户提供的课程工作台原型及交接要求重写。复用现有官方插件/Client/Remote机制，新增真实任务与本地导出；不复用旧版全局禁用清单、两个模型工具或私有桥接。源码身份以本分支交付记录与固定TGZ摘要共同核对。'},
 release:courseRelease
}
const expertRelease=readJson('../../market/expert-release.json')
if(expertRelease.id!=='qcu-expert-teams'||expertRelease.version!=='0.2.0-pilot.2'||expertRelease.bytes!==57940||expertRelease.sha256!=='4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581')throw Error('Frozen expert release mismatch')
// Schema-4 legacy no-Skill wire categorization; this panel exposes no DSH tools.
const expert={
 id:expertRelease.id,title:'QCU 专家团与专家库',scenario:'教研沟通与总结',purpose:'专家协作插件：复用专家与团队，按依赖流程形成意见，交由教师复核。',sourceLabel:'QCU自有',kind:'bundle',capabilities:['tools'],
 prerequisites:'DSH 0.2.0-rc.2；启用后打开专家团面板，选择工作区；模型服务由本人在官方设置配置。',
 risk:'Host 与 Client 以应用用户权限运行，不是 OS 沙箱。保存所选工作区内的专家、团队与运行记录；确认任务后才将指定材料与上游意见发给本人配置的默认模型，可能产生费用。JSON/Markdown 导出包含任务材料和意见；清理仅限预览并确认的已结束记录。不执行专家脚本、MCP 或任意工具，不注册 DSH 工具或 Skill；方法文本不增加权限。安装与启用分别确认。',
 example:'打开专家团 → 选择工作区 → 选择或编辑专家与团队 → 填写匿名材料 → 核对模型发送范围并确认 → 审阅意见；历史备份与清理分别操作，清理须预览并确认。',
 testStatus:'冻结 pilot.2 归档；既有源、隔离官方 SDK、浏览器和临时 profile 安装升级证据可供审阅。本轮仅验证市场集成；日常原生 DSH、真实模型、教学质量、费用和限流、教师验收、Windows 及生产发布仍未验收。',
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'hub/plugins/qcu-expert-teams',pinnedRevision:'45bb6ed23e9990118e1ecd20114c32233e6c4b13',license:'MIT',modifications:'保持冻结专家包全部字节。专家协作插件使用 Host/Client RPC 面板；tools 仅为 schema-4 兼容的无 Skill 传输分类，不表示注册工具。'},release:expertRelease
}
export default {schemaVersion:4,revision:6,protocol:4,entries:[{
 id:release.id,title:'QCU学习方法教练',scenario:'阅读笔记与复习',purpose:'拆解任务、安排复习节奏与错题复盘；不代写应交作业。',sourceLabel:'QCU自有',
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，发送学习任务需用户自行配置模型。',
 risk:'Host代码以应用用户权限运行；安装改写当前profile依赖、锁文件、缓存与日志，可能访问配置的registry。安装默认不启用；另一次确认覆盖本包及唯一组件。',
 example:'/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。',
 testStatus:'教练P2在既有实例已验收；本目录客户端及全新Home首次安装尚未真机验收。',kind:'bundle',capabilities:['skill'],
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'skills/chengyuan-study-coach/SKILL.md',pinnedRevision:'ab362184c917554354486cd13d300f4c934be138',license:'MIT',modifications:'QCU标识、匿名资料与诚信边界；固定coach P2发行条目保持原样。'},release
},...skills,feishu,course,expert]}
