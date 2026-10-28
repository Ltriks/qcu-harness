import {errors,safeCode,REVIEW_CHAR_LIMIT,FINAL_CHAR_LIMIT} from './protocol.mjs'
// Unicode codepoints excluding whitespace; never cut model text or trigger paid retries.
export function outputLengthNotice(step,isFinal){
 const count=Array.from(typeof step?.output==='string'?step.output.replace(/\s/gu,''):'').length,limit=isFinal?FINAL_CHAR_LIMIT:REVIEW_CHAR_LIMIT
 return count>limit?'篇幅提示：'+count+'个非空白字符，超过建议的'+limit+'字符。完整内容已保留，请按任务要求复核；不会自动重试。':''
}
export const terminalRun=r=>['completed','failed','cancelled','interrupted'].includes(r?.status)
export const stateLabel=value=>({running:'运行中',completed:'已完成',failed:'失败',cancelled:'已停止',interrupted:'已中断',queued:'等待中'}[value]??'未知状态')
const time=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=8640000000000000?value:null
export const timestamp=value=>time(value)===null?'未记录':new Date(value).toISOString()
export function elapsed(start,end){return time(start)!==null&&time(end)!==null&&end>=start?end-start:null}
export const duration=ms=>ms===null?'耗时未记录':ms<1000?ms+'毫秒':ms<60000?(ms/1000).toFixed(1)+'秒':Math.floor(ms/60000)+'分'+Math.floor(ms%60000/1000)+'秒'
export function runProgress(run,now=Date.now()){
 const steps=run.steps??[],completed=steps.filter(s=>s.status==='completed'&&s.output?.trim()).length
 return {completed,total:steps.length,elapsedMs:elapsed(run.createdAt,run.status==='running'?now:run.finishedAt)}
}
// Deliberately project data fields: never serialize adapters, methods, credentials or raw errors.
export function historyRecord(run){
 return {id:run.id,teamName:run.team?.name??'专家团',outputId:run.team?.outputId??'',task:run.input?.task??'',materials:run.input?.materials??'',model:{provider:run.model?.provider??'未记录',model:run.model?.model??'未记录'},status:run.status,createdAt:time(run.createdAt),finishedAt:time(run.finishedAt),error:run.error?safeCode({code:run.error}):null,steps:(run.steps??[]).map(s=>({id:s.id,name:s.name,status:s.status,output:typeof s.output==='string'?s.output:'',startedAt:time(s.startedAt),finishedAt:time(s.finishedAt),error:s.error?safeCode({code:s.error}):null}))}
}
export function historyBackup(runs,workspaceId,exportedAt){
 return {format:'qcu-expert-history-backup',schemaVersion:1,dataOnly:true,notice:'仅供备份和教师复核，不能导入为专家团或执行任务。',workspaceId,exportedAt,runs:runs.map(historyRecord)}
}
export function renderReport(run){
 const r=historyRecord(run),p=runProgress(run),final=r.steps.find(s=>s.id===r.outputId),complete=r.status==='completed'&&p.completed===p.total&&p.total>0&&final?.status==='completed'&&!!final.output.trim()
 const lines=['# '+r.teamName,'','> 待教师复核'+(complete?'':' / 未完成'),'','运行状态：'+stateLabel(r.status)+' ('+r.status+')','完成步骤：'+p.completed+'/'+p.total,'开始时间：'+timestamp(r.createdAt),'结束时间：'+timestamp(r.finishedAt),'耗时：'+duration(p.elapsedMs),'','任务：'+r.task,'','模型：'+r.model.provider+'/'+r.model.model,'',complete?'最终汇总已完成，以下保留各位专家意见。':'未完成：最终汇总缺失或本次运行未完整结束，以下内容不能视为完整结论。']
 if(r.error)lines.push('','运行提示：'+r.error+' · '+errors[r.error])
 for(const s of r.steps){
  lines.push('','## '+s.name+(s.id===r.outputId?'（最终汇总）':''),'','步骤状态：'+stateLabel(s.status)+' ('+s.status+')','开始：'+timestamp(s.startedAt)+' · 结束：'+timestamp(s.finishedAt)+' · '+duration(elapsed(s.startedAt,s.finishedAt)))
  if(s.error)lines.push('提示：'+s.error+' · '+errors[s.error])
  const lengthNotice=outputLengthNotice(s,s.id===r.outputId);if(lengthNotice)lines.push('',lengthNotice)
  lines.push('',s.status==='completed'&&s.output.trim()?s.output:s.output.trim()?'未完成 / 部分输出（不可视为完整意见）：\n\n'+s.output:'未完成 / 无完整意见。')
 }
 return lines.join('\n')+'\n'
}
