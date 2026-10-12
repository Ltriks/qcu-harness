// Reviewed source input; generated snapshot is shared by Host and Client.
import {release} from './src/trusted-release.mjs'
import {readFileSync} from 'node:fs'
const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'))
const products=readJson('../../skill-products/products-input.json')
const releases=readJson('../../market/skill-releases.json')
if(products.length!==5||releases.length!==5||products.some((p,i)=>p.id!==releases[i].id))throw Error('Reviewed Skill release coverage mismatch')
const skills=products.map((product,i)=>({...product,sourceLabel:'QCU自有',kind:'skill',
 provenance:readJson(`../../../skills/${product.id}/SOURCE.json`).provenance,
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，使用静态说明需在目标会话确认技能发现并自行配置模型。',
 risk:'提供方在Host进程以应用用户权限运行，仅注册静态说明；不增加工具权限。官方安装会改写profile依赖、锁文件、缓存与日志，可能访问registry。安装默认不启用；另一次确认覆盖本包及唯一组件。',
 testStatus:'合成示例；源与隔离测试阶段，未部署、未测试模型输出或教学效果。',release:releases[i]}))
export default {schemaVersion:3,revision:2,protocol:3,entries:[{
 id:release.id,title:'QCU学习方法教练',scenario:'阅读笔记与复习',purpose:'拆解任务、安排复习节奏与错题复盘；不代写应交作业。',sourceLabel:'QCU自有',
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，发送学习任务需用户自行配置模型。',
 risk:'Host代码以应用用户权限运行；安装改写当前profile依赖、锁文件、缓存与日志，可能访问配置的registry。安装默认不启用；另一次确认覆盖本包及唯一组件。',
 example:'/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。',
 testStatus:'教练P2在既有实例已验收；本目录客户端及全新Home首次安装尚未真机验收。',kind:'bundle',
 provenance:{ownership:'qcu',author:'lqtriks and QCU Harness contributors',upstreamSource:'skills/chengyuan-study-coach/SKILL.md',pinnedRevision:'ab362184c917554354486cd13d300f4c934be138',license:'MIT',modifications:'QCU标识、匿名资料与诚信边界；固定coach P2发行条目保持原样。'},release
},...skills]}
