"""Insert maintained capability UI into the frozen market client, idempotently."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / 'hub/plugins/qcu-market'
p = ROOT / 'client.js'
text = (ROOT.parents[2] / 'sources/qcu-market/client-shell.js').read_text()
start, end = '// QCU CAPABILITY LIBRARY BEGIN\n', '// QCU CAPABILITY LIBRARY END\n'
suite = json.loads((ROOT.parents[2] / 'packages/qcu-accounting-suite/skill-bundle.json').read_text())
registry = '// Generated display metadata from reviewed package skill-bundle.json; no instruction bodies.\nexport const departmentSuites=Object.freeze(' + json.dumps({suite['id']: suite}, ensure_ascii=False, indent=2) + ')\n'
(ROOT / 'src/department-suites.mjs').write_text(registry)
module = registry.replace('export ', '') + '\n' + (ROOT / 'src/capability-library.mjs').read_text().replace("import {departmentSuites} from './department-suites.mjs'\n", '').replace('export ', '')
if start in text:
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    text = before + start + module + '\n' + end + after
else:
    marker = 'function createLoopPlugin(React){'
    assert text.count(marker) == 1
    text = text.replace(marker, start + module + '\n' + end + marker)
    text = text.replace("category==='all'||productKindOf(e)===(category==='skills'?'skill':'plugin')", 'matchesCapability(e,category)')
    text = text.replace("(category==='all'||category==='plugins'&&productKindOf(e)==='plugin'||category==='skills'&&productKindOf(e)==='skill')", 'matchesCapability(e,category)')
    text = text.replace("['skills','技能 Skill'],['plugins','插件 Plugin']", "['skills','技能'],['teams','专家团队'],['plugins','其他插件']")
    text = text.replace('function MarketPage({availability,onBack,catalog=bundledCatalog})', 'function MarketPage({availability,onBack,catalog=bundledCatalog,initialItem=null})')
    text = text.replace('[selected,setSelected]=React.useState(null)\n  const [aux', '[selected,setSelected]=React.useState(initialItem)\n  const [aux', 1)
    text = text.replace(' const {MarketPage,Icon}=createMarketViews(React)\n', ' const {MarketPage,Icon}=createMarketViews(React)\n const {Library,Entry}=createCapabilityLibrary(React,{marketStyles,releaseKeyOf})\n', 1)
    marker = "    ctx.effect(()=>()=>listeners.clear())\n"
    assert text.count(marker) == 1
    integration = '''    ctx.inject(['qcuTeamNavigation'],scope=>{update({openStudio:id=>scope.qcuTeamNavigation.open(id)});scope.effect(()=>()=>update({openStudio:null}))})
    let marketItem=null
    const openMarket=id=>{marketItem=id??null;ctx.layout.selectPanel('qcu-market')}
    update({openLegacy:()=>ctx.layout.selectPanel('qcu-expert-teams')})
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'qcu-capabilities',inject:()=>({availability,onMarket:openMarket,onBack:()=>ctx.layout.selectPanel(null)})},Library))
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'qcu-capabilities',order:31,label:'能力库'},Entry))
'''
    text = text.replace(marker, marker + integration)
    text = text.replace("inject:()=>({availability,onBack:()=>ctx.layout.selectPanel(null)})},MarketPage)", "inject:()=>({availability,initialItem:marketItem,onBack:()=>ctx.layout.selectPanel(null)})},MarketPage)")
# Optional home integration shares current catalog/status flows, never a second hardcoded catalog.
bridge_marker = '// QCU HOME CAPABILITIES BRIDGE'
if bridge_marker not in text:
    marker = "    const openMarket=id=>{marketItem=id??null;ctx.layout.selectPanel('qcu-market')}"
    assert text.count(marker) == 1
    text = text.replace(marker, marker + """
    // QCU HOME CAPABILITIES BRIDGE
    ctx.effect(()=>ctx.reflect.provide('qcuHomeCapabilities',{availability,openMarket,isTeam:item=>!!expertTeams[item.id],openTeam:async id=>{if(!ready.openStudio)throw Error('专家团工作室尚未就绪，请稍后重试。');await ready.openStudio(id)}}))
    ctx.inject(['qcuHomePersonalization'],scope=>{update({personalization:scope.qcuHomePersonalization});scope.effect(()=>()=>update({personalization:null}))})
""")
# Installed skills use the local official manager, independently of market refresh.
if '// QCU INSTALLED SKILLS RUNTIME' not in text:
    text = text.replace('    const update=patch=>{ready={...ready,...patch};for(const fn of listeners)fn()}', '    let installedInventory=null\n    const update=patch=>{ready={...ready,...patch};for(const fn of listeners)fn();if(patch.catalog&&installedInventory)void installedInventory.refresh()}')
    marker = '    update({openLegacy:()=>ctx.layout.selectPanel(\'qcu-expert-teams\')})'
    assert text.count(marker) == 1
    text = text.replace(marker, marker + """
    // QCU INSTALLED SKILLS RUNTIME
    ctx.inject(['remote','remote.pluginManager'],scope=>{
      const manager={listBundles:()=>boundedMarketRead(()=>scope.remote.pluginManager.listBundles(),12000),listPlugins:()=>boundedMarketRead(()=>scope.remote.pluginManager.listPlugins(),12000)}
      const inventory=new InstalledSkillInventory(manager,()=>[...new Map([...bundledCatalog.entries,...(ready.catalog?.entries??[])].map(item=>[item.id,item])).values()],update)
      installedInventory=inventory;update({refreshInstalled:()=>inventory.refresh()});void inventory.refresh()
      scope.effect(()=>()=>{inventory.dispose();if(installedInventory===inventory)installedInventory=null;update({refreshInstalled:null,localSkills:{phase:'error',items:[],error:'本机技能连接已断开，请稍后刷新。'},localSkillFlows:{}})})
    })
    ctx.inject(['workspaces','sessions','conversation','uiWorkspace'],scope=>{
      update({skillRuntime:{workspaces:scope.workspaces,sessions:scope.sessions,conversation:scope.conversation,uiWorkspace:scope.uiWorkspace,layout:ctx.layout,isSkillActive:async id=>{const inventory=installedInventory;if(!inventory)return false;await inventory.refresh();return !inventory.closed&&inventory.flow(id).snapshot().status?.state==='component-active'}}})
      scope.effect(()=>()=>update({skillRuntime:null}))
    })
""")
# Reviewed multi-skill packages disclose their members without changing catalog/install identity.
if '// QCU SUITE CONTENTS' not in text:
    marker = "   h('p',{className:'qcu-purpose'},item.purpose),"
    assert text.count(marker) == 1
    text = text.replace(marker, marker + """
   // QCU SUITE CONTENTS
   departmentSuites[item.id]?.version===release.version&&h('section',{className:'qcu-section','aria-label':'技能包内容'},h('h2',null,'本包包含'),h('p',null,'一个选用入口与四项独立教学技能。安装后可分别使用、收藏与固定到首页；整个包统一启停和升级。'),h('ul',null,departmentSuites[item.id].skills.map(skill=>h('li',{key:skill.id},skill.title))),h('p',{className:'qcu-hint'},'示例版本，教师教学验收尚未完成；不连接真实账套或申报服务。')),
""")
if 'src/department-suites.mjs' not in json.loads((ROOT / 'package.json').read_text())['files']:
    pkg = json.loads((ROOT / 'package.json').read_text()); pkg['files'].append('src/department-suites.mjs'); (ROOT / 'package.json').write_text(json.dumps(pkg, ensure_ascii=False, indent=2)+'\n')
# Work assistant built-in tasks share the same draft-only path and personal shortcuts.
if '// QCU WORK ASSISTANT' not in text:
    text = text.replace('    let marketItem=null', '    let marketItem=null,pendingWorkTask=null')
    marker = "    // QCU HOME CAPABILITIES BRIDGE"
    text = text.replace(marker, "    // QCU WORK ASSISTANT\n    update({officeTasks})\n" + marker)
    text = text.replace("{availability,openMarket,isTeam:", "{availability,openMarket,openTask:async(id,workspaceId,task)=>{if(!officeTasks.some(t=>t.id===id))throw Error('任务不可用');if(!task?.trim()){pendingWorkTask=id;ctx.layout.selectPanel('qcu-capabilities');return}if(!ready.skillRuntime)throw Error('对话服务未就绪');return launchOfficeDraft(ready.skillRuntime,{id,workspaceId,task})},isTeam:")
    text = text.replace("inject:()=>({availability,onMarket:openMarket,onBack:", "inject:()=>({availability,initialTask:pendingWorkTask,onInitialTaskHandled:()=>{pendingWorkTask=null},onMarket:openMarket,onBack:")
# Home shortcuts always prepare a draft; blank input is completed in conversation.
text = text.replace('let marketItem=null,pendingWorkTask=null', 'let marketItem=null')
text = text.replace("if(!task?.trim()){pendingWorkTask=id;ctx.layout.selectPanel('qcu-capabilities');return}", '')
text = text.replace('return launchOfficeDraft(ready.skillRuntime,{id,workspaceId,task})', 'return launchOfficeDraft(ready.skillRuntime,{id,workspaceId,task,allowEmpty:true})')
text = text.replace('initialTask:pendingWorkTask,onInitialTaskHandled:()=>{pendingWorkTask=null},', '')
# Hide first-run walkthrough until the surrounding interface is settled.
text = text.replace("onLaunch&&button('进入首次任务指引'", "false&&onLaunch&&button('进入首次任务指引'")
text = text.replace("['guide','新手指引'],['tasks','常用任务']", "['guide','使用指南']")
text = text.replace("const navigate=page=>{setSelected(null);", "const navigate=page=>{if(page==='guide'){ready.openFirstTask?.();return}setSelected(null);")
text = text.replace("h('section',{className:'qcu-onboarding','aria-label':'首次使用指引'}", "false&&h('section',{className:'qcu-onboarding','aria-label':'首次使用指引'}")
while 'false&&false&&' in text:
    text = text.replace('false&&false&&', 'false&&')
text = '\n'.join(line for line in text.split('\n') if not ("sidebar.panellist" in line and "id:'qcu-capabilities'" in line))
p.write_text(text)
pkgfile = ROOT / 'package.json'
pkg = json.loads(pkgfile.read_text())
for module in ['@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-workspace']:
    if module not in pkg['dsh']['client']['inject']:
        pkg['dsh']['client']['inject'].append(module)
    pkg['peerDependencies'][module] = '0.2.0-rc.2'
if 'src/capability-library.mjs' not in pkg['files']:
    pkg['files'].append('src/capability-library.mjs')
pkgfile.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')
print('Built market capability tabs and studio navigation')
