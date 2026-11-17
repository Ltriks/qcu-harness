export async function launchInstalledTeam(runtime,{team,workspaceId,task,materials}){
 if(team?.execution!=='native-dsh-agent'||team.unavailable||team.enabled===false||!/^qcu-[a-z0-9-]+$/.test(team.id))throw Error('已安装团队不可用，请重新连接或核对安装。')
 if(!runtime.workspaces.list.getSnapshot().items.some(w=>w.workspaceId===workspaceId))throw Error('工作区已变化，请重新选择。')
 if(typeof task!=='string'||!task.trim()||task.length>8000||typeof materials!=='string'||materials.length>40000)throw Error('请填写有效任务；目标最多8000字，资料说明最多40000字。')
 const prompt=`/${team.id}\n\n请使用专家团工作室选定的“${team.name}”，保留全部${team.members.length}位角色的分工。\n\n任务：\n${task.trim()}\n\n参考资料与说明：\n${materials.trim()||'暂无资料，先确认所需输入。'}\n\n先给出工作计划、实际可用的工具和产物位置。按已安装团队的DSH适配契约执行；没有检索、代码执行或独立代理时明确说明，不能伪造执行。`
 const sessionId=await runtime.sessions.create({workspaceId})
 try{
  const shell=runtime.conversation.input.shell(sessionId)
  if(shell.snapshot.draft||shell.snapshot.attachmentIds?.length)throw Error('新会话已有草稿，未覆盖内容。')
  shell.actions.setDraft(prompt)
  runtime.uiWorkspace.openSession(sessionId)
  runtime.layout.selectPanel(null)
  return {sessionId,sent:false}
 }catch(e){throw Error('会话已建立但任务未发送，请在会话列表核对。'+e.message)}
}
