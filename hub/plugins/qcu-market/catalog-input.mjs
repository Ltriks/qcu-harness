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
export default {schemaVersion:4,revision:4,protocol:4,entries:[{
 id:release.id,title:'QCU学习方法教练',scenario:'阅读笔记与复习',purpose:'拆解任务、安排复习节奏与错题复盘；不代写应交作业。',sourceLabel:'QCU自有',
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，发送学习任务需用户自行配置模型。',
 risk:'Host代码以应用用户权限运行；安装改写当前profile依赖、锁文件、缓存与日志，可能访问配置的registry。安装默认不启用；另一次确认覆盖本包及唯一组件。',
 example:'/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。',
 testStatus:'教练P2在既有实例已验收；本目录客户端及全新Home首次安装尚未真机验收。',kind:'bundle',capabilities:['skill'],
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'skills/chengyuan-study-coach/SKILL.md',pinnedRevision:'ab362184c917554354486cd13d300f4c934be138',license:'MIT',modifications:'QCU标识、匿名资料与诚信边界；固定coach P2发行条目保持原样。'},release
},...skills,feishu]}
