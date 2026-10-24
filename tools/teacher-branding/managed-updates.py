"""Narrow, pinned customization of the frozen desktop updater. Never changes security fuses."""
import hashlib,json,struct
from pathlib import Path
MAIN_SHA='10325004a1ddbd8118ed0607ea28d50a7b0d692dcaeb25a67a7d8aea9165019d'
GENERAL='dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js'
SENTINEL=b'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
def sha(data):return hashlib.sha256(data).hexdigest()
def header(data):
 a,b,c,d=struct.unpack('<4I',data[:16])
 if a!=4 or c!=b-4 or d>c-4:raise ValueError('Unexpected ASAR header')
 return json.loads(data[16:16+d]),8+b
def entries(node,prefix=''):
 for name,value in node.get('files',{}).items():
  if 'files' in value:yield from entries(value,prefix+name+'/')
  else:yield prefix+name,value
def member(data,name):
 h,base=header(data);r=dict(entries(h))[name]
 return data[base+int(r['offset']):base+int(r['offset'])+r['size']]
def once(source,old,new):
 if source.count(old)!=1:raise ValueError('Updater patch anchor must occur exactly once: '+old[:80])
 return source.replace(old,new,1)
def patch_main(raw):
 if sha(raw)!=MAIN_SHA:raise ValueError('Unexpected frozen main script')
 s=raw.decode()
 s=once(s,'const { autoUpdater } = electronUpdater;','const QCU_MANAGED_UPDATES = true;\nconst { autoUpdater } = electronUpdater;')
 for old,new in [
  ('async check(manual = false) {\n\t\tthis.assertLive();','async check(manual = false) {\n\t\tthis.assertLive();\n\t\tif (QCU_MANAGED_UPDATES) return this.current;'),
  ('async download(version) {\n\t\tthis.assertLive();','async download(version) {\n\t\tthis.assertLive();\n\t\tif (QCU_MANAGED_UPDATES) throw new Error("QCU助手由维护者统一更新，请获取完整QCU套件。");'),
  ('async install(version) {\n\t\tthis.assertLive();','async install(version) {\n\t\tthis.assertLive();\n\t\tif (QCU_MANAGED_UPDATES) throw new Error("QCU助手由维护者统一更新，请获取完整QCU套件。");'),
  ('async doCheck() {\n\t\ttry {','async doCheck() {\n\t\tif (QCU_MANAGED_UPDATES) return this.setState({ phase: "idle" });\n\t\ttry {'),
  ('async check(manual = false, force = manual) {','async check(manual = false, force = manual) {\n\t\tif (QCU_MANAGED_UPDATES) return this.updates.state;'),
  ('schedule(failed) {\n\t\tif (this.disposed) return;','schedule(failed) {\n\t\tif (QCU_MANAGED_UPDATES || this.disposed) return;'),
  ('if (!quitting) updateSchedule.check().catch','if (!quitting && !QCU_MANAGED_UPDATES) updateSchedule.check().catch'),
  ('const openUpdatePrompt = (manual = false) => {','const openUpdatePrompt = (manual = false) => {\n\t\tif (QCU_MANAGED_UPDATES) return ordinaryMessageBox({ type: "info", title: "QCU助手套件版本说明", message: "QCU助手由维护者统一更新", detail: "教师套件基线：0.1.0-rc.3（清蓝主题测试）\\n客户端内核：" + app.getVersion() + "\\n新版会在验证技能、插件及配置保留后，以完整QCU套件交付。模型服务要求更高版本时，请联系维护人员。" });'),
  ('label: currentDesktopLocale().messages.checkUpdatesMenu,','label: "套件版本说明",'),
  ('mandatoryDetail: "当前版本已停止支持，请更新后继续使用。确认安装并重启前，进行中的任务会继续运行。",','mandatoryDetail: "当前版本已停止支持。请联系维护人员获取新版完整QCU套件；官方最低版本要求继续生效。",'),
  ('mandatoryDetail: "This version is no longer supported. Update to continue. Tasks in progress will keep running until you confirm installation and restart.",','mandatoryDetail: "This version is no longer supported. Contact your QCU maintainer for a complete, verified suite update. The official minimum-version requirement still applies.",')
 ]:s=once(s,old,new)
 # Prove the policy decision engine was not edited, removed or bypassed.
 start='var DesktopMandatoryUpdatePolicy = class'
 def policy(text):return text[text.index(start):text.index('//#endregion',text.index(start))]
 if policy(s)!=policy(raw.decode()):raise ValueError('Minimum-version policy engine changed')
 return s.encode()
def replace_members(original,replacements):
 h,base=header(original);old=dict(entries(h));changed=sorted([(int(old[n]['offset']),old[n]['size'],n,v) for n,v in replacements.items()])
 for name,row in entries(h):
  if 'offset' not in row:continue
  offset=int(row['offset']);row['offset']=str(offset+sum(len(data)-size for pos,size,_,data in changed if pos<offset))
  if name in replacements:
   data=replacements[name];row['size']=len(data);integrity=row['integrity']
   if integrity['algorithm']!='SHA256':raise ValueError('Unexpected ASAR integrity algorithm')
   block=integrity['blockSize'];integrity.update(hash=sha(data),blocks=[sha(data[i:i+block]) for i in range(0,len(data),block)])
 body=original[base:]
 for offset,size,_,data in reversed(changed):body=body[:offset]+data+body[offset+size:]
 encoded=json.dumps(h,ensure_ascii=False,separators=(',',':')).encode();padding=(-len(encoded))%4
 pickle=struct.pack('<II',4+len(encoded)+padding,len(encoded))+encoded+b'\0'*padding
 result=struct.pack('<II',4,len(pickle))+pickle+body
 previous,previous_base=header(original);current,current_base=header(result);prev=dict(entries(previous));curr=dict(entries(current))
 if set(prev)!=set(curr):raise ValueError('ASAR member set changed')
 verified=0
 for name,row in prev.items():
  other=curr[name]
  if name in replacements:
   if member(result,name)!=replacements[name]:raise ValueError('Changed ASAR member does not match')
  elif 'offset' in row:
   old_data=original[previous_base+int(row['offset']):previous_base+int(row['offset'])+row['size']]
   new_data=result[current_base+int(other['offset']):current_base+int(other['offset'])+other['size']]
   if new_data!=old_data or {k:v for k,v in row.items() if k!='offset'}!={k:v for k,v in other.items() if k!='offset'}:raise ValueError('Unrelated ASAR member changed: '+name)
   verified+=1
  elif row!=other:raise ValueError('Unpacked/link metadata changed')
 return result,verified
def apply(resources,target):
 resources=Path(resources)
 fusefile=resources.parent/'Frameworks/Electron Framework.framework/Versions/A/Electron Framework' if target=='mac-arm64' else resources.parent/'DeepSeek Harness.exe'
 binary=fusefile.read_bytes();pos=binary.find(SENTINEL)
 if pos<0:raise ValueError('Missing Electron fuse wire')
 wire=binary[pos+len(SENTINEL):pos+len(SENTINEL)+11]
 if wire[:2]!=bytes([1,9]) or wire[6]!=ord('0'):raise ValueError('External customization is not supported by this frozen runtime; fuses remain unchanged')
 file=resources/'app.asar';original=file.read_bytes()
 main=patch_main(member(original,'lib/main.js'))
 general=member(original,GENERAL).decode()
 general=once(general,'function DesktopUpdateIndicator({ wide, hidden, t, view, onOpen }) {','function DesktopUpdateIndicator({ wide, hidden, t, view, onOpen }) {\n return null; // QCU managed suite: native upgrade actions are unavailable.')
 general=once(general,'function DesktopUpdateBadge({ useDesktopUpdate, useConnectionState, t }) {','function DesktopUpdateBadge({ useDesktopUpdate, useConnectionState, t }) {\n return null; // QCU managed suite.')
 patched,count=replace_members(original,{'lib/main.js':main,GENERAL:general.encode()})
 before_package=json.loads(member(original,'package.json'));after_package=json.loads(member(patched,'package.json'))
 if before_package.get('dshMandatoryUpdatePolicy')!=after_package.get('dshMandatoryUpdatePolicy'):raise ValueError('Minimum-version policy configuration changed')
 file.write_bytes(patched)
 return {'managedUpdates':True,'originalAsarSha256':sha(original),'customAsarSha256':sha(patched),'modifiedAsarMembers':['lib/main.js',GENERAL],'otherPackedMembersUnchanged':count,'securityFusesChanged':False,'vendorExecutableCodePatched':False,'minimumVersionPolicyUnchanged':True}
