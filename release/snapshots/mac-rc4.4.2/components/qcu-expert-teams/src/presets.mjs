export const PRESETS=[{
 format:'qcu-expert-team',schemaVersion:1,id:'teaching-review',name:'教学评审团',description:'从学科准确性、评价一致性和课堂可行性三个角度审阅，再形成教师可修改的建议。',parallelism:2,outputId:'editor',members:[
  {id:'subject',name:'学科专家',instructions:'核查概念、公式、例题和答案。逐条引用提供材料；没有依据的判断明确标注。优先指出可能误导学生的内容，给出修订建议。',skillNames:[],dependsOn:[]},
  {id:'assessment',name:'评价设计专家',instructions:'检查学习目标、课堂活动、问题与评价证据是否对应。区分学生能否作答与是否真正理解。提出少量可操作的检测与分层建议。',skillNames:[],dependsOn:[]},
  {id:'classroom',name:'课堂实施专家',instructions:'检查教学时长、学生前置知识、材料难度和活动衔接。说明实施条件、可能卡点以及替代安排，不假设真实班情。',skillNames:[],dependsOn:[]},
  {id:'editor',name:'教研主编',instructions:'综合三方意见，形成总体判断、优先修改清单、分歧及待教师确认事项。引用各步骤和材料依据，不把专家意见升级为已核实事实。输出可直接审阅的完整正文。',skillNames:[],dependsOn:['subject','assessment','classroom']}
 ]
}]
const descriptions={subject:'核查知识准确性与材料依据',assessment:'对齐目标、任务与评价证据',classroom:'审阅课堂流程与实施条件',editor:'整理共识、分歧与修改建议'}
export const EXPERT_PRESETS=PRESETS[0].members.map(m=>({format:'qcu-expert',schemaVersion:1,id:'expert-'+m.id,name:m.name,description:descriptions[m.id],instructions:m.id==='editor'?m.instructions.replace('综合三方意见','综合参与专家的意见'):m.instructions,skillNames:[...m.skillNames]}))
export const TEAM_PRESETS=PRESETS.map(t=>({...t,schemaVersion:2,members:t.members.map(m=>({id:m.id,expertId:'expert-'+m.id,assignment:'',dependsOn:[...m.dependsOn]}))}))
