// Reviewed source input; generated snapshot is shared by Host and Client.
import {release} from './src/trusted-release.mjs'
export default {schemaVersion:2,revision:1,protocol:2,entries:[{
 id:release.id,title:'QCU学习方法教练',scenario:'阅读笔记与复习',purpose:'拆解任务、安排复习节奏与错题复盘；不代写应交作业。',sourceLabel:'QCU自有',
 prerequisites:'DSH 0.2.0-rc.2；安装无需模型，发送学习任务需用户自行配置模型。',
 risk:'Host代码以应用用户权限运行；安装改写当前profile依赖、锁文件、缓存与日志，可能访问配置的registry。安装默认不启用，包与组件启用分别确认。',
 example:'/qcu-study-coach\n我今天有30分钟复习一个知识点。请先问我课程与卡点，再给出可执行计划。',
 testStatus:'教练P2在既有实例已验收；本目录客户端及全新Home首次安装尚未真机验收。',kind:'bundle',release
}]}
