#!/usr/bin/env python3
"""Stage isolated teacher-theme candidates from the accepted rc.3 guide/startup bases."""
import argparse,hashlib,importlib.util,json,plistlib,shutil,subprocess,zipfile
from pathlib import Path

BASES={'mac-arm64':'db2614d10649d7fe05315fd85a4d94bc38e6f80469a975272d1bb44e9a7e0f63',
       'win-x64':'f41508533d5a3cbd87d61c20caf26c86d14b1b29d8641fd0433c9335cdcc1a11'}
def digest(file):
 h=hashlib.sha256()
 with file.open('rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def run(*args):subprocess.run([str(x) for x in args],check=True)
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--base',type=Path,required=True);p.add_argument('--target',choices=BASES,required=True)
 p.add_argument('--package',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
 p.add_argument('--namespace',default='theme-preview-20261023');p.add_argument('--resume-preview',action='store_true');p.add_argument('--refresh-preview',action='store_true')
 p.add_argument('--managed-updates',action='store_true')
 a=p.parse_args()
 if a.out.exists() and not(a.resume_preview or a.refresh_preview):raise ValueError('Fresh output directory required')
 if a.resume_preview and (not a.out.is_dir() or (a.out/'theme-build.json').exists()):raise ValueError('Only an incomplete preview can resume')
 if not a.namespace.startswith('theme-preview-') or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in a.namespace):raise ValueError('Isolated preview namespace required')
 if digest(a.base)!=BASES[a.target]:raise ValueError('Unexpected base archive')
 pkg=json.loads((a.package/'package.json').read_text())
 if (pkg['name'],pkg['version'])!=('qcu-branding','0.2.0'):raise ValueError('Unexpected theme package')
 if a.refresh_preview:
  previous=json.loads((a.out/'theme-build.json').read_text())
  if previous.get('formalRelease') is not False or previous.get('guiAccepted') is not False:raise ValueError('Only an unpublished preview can refresh')
 a.out.mkdir(parents=True,exist_ok=a.resume_preview or a.refresh_preview)
 if a.resume_preview or a.refresh_preview:
  app=a.out/'QCU助手主题预览.app';kit=app/'Contents/Resources' if a.target=='mac-arm64' else a.out/'QCU助手'
  marker=json.loads((kit/'support/manifest.json').read_text()).get('themePreview',{})
  if marker.get('sourceBaseSha256')!=BASES[a.target] or marker.get('namespace')!=a.namespace:raise ValueError('Incomplete preview identity mismatch')
  vendor=kit/'program/DeepSeek Harness.app';resources=vendor/'Contents/Resources' if a.target=='mac-arm64' else kit/'program/resources'
 elif a.target=='mac-arm64':
  run('/usr/bin/ditto','-x','-k',a.base,a.out)
  extracted=a.out/a.base.stem
  app=extracted/'QCU助手.app';app.rename(a.out/'QCU助手主题预览.app');app=a.out/'QCU助手主题预览.app'
  # Retain the existing guide and notices alongside the preview app.
  for file in extracted.iterdir():
   if file.is_file() and file.name!='app-files.json':shutil.copy2(file,a.out/file.name)
  shutil.rmtree(extracted)
  kit=app/'Contents/Resources';vendor=kit/'program/DeepSeek Harness.app';resources=vendor/'Contents/Resources'
 else:
  with zipfile.ZipFile(a.base) as z:
   for member in z.infolist():
    if Path(member.filename).is_absolute() or '..' in Path(member.filename).parts:raise ValueError('Unsafe archive member')
   z.extractall(a.out)
  kit=a.out/'QCU助手';resources=kit/'program/resources'
 before=digest(resources/'app.asar')
 customization=None
 if a.managed_updates:
  source=Path(__file__).resolve().parents[1]/'tools/teacher-branding/managed-updates.py'
  spec=importlib.util.spec_from_file_location('qcu_managed_updates',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  customization=module.apply(resources,a.target)
  (kit/'support/managed-updates.json').write_text(json.dumps(customization,ensure_ascii=False,indent=2)+'\n')
  (a.out/'patched-main.mjs').write_bytes(module.member((resources/'app.asar').read_bytes(),'lib/main.js'))
  run('node','--check',a.out/'patched-main.mjs')
 theme=kit/'seed/profiles/desktop/node_modules/qcu-branding';shutil.rmtree(theme);shutil.copytree(a.package,theme)
 profile=kit/'seed/profiles/desktop'
 v=json.loads((profile/'package.json').read_text());v['dependencies']['qcu-branding']='0.2.0';(profile/'package.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
 patches=json.loads((profile/'cordis.patch.yml').read_text())
 for component in ['ui-brand-official','ui-sidebar']:
  row=next((r for r in patches if r.get('id')==component),None)
  if row is None:row={'id':component};patches.append(row)
  row['disabled']=True
 (profile/'cordis.patch.yml').write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
 manifest=json.loads((kit/'support/manifest.json').read_text())
 manifest['branding']['version']='0.2.0';manifest.pop('migrateFrom',None)
 manifest['themePreview']={'namespace':a.namespace,'guiAccepted':False,'sourceBaseSha256':BASES[a.target],'formalRelease':False}
 manifest['managedUpdates']=bool(a.managed_updates)
 rows=[{'path':f.relative_to(kit).as_posix(),'bytes':f.stat().st_size,'sha256':digest(f)} for f in sorted((kit/'seed').rglob('*')) if f.is_file()]
 manifest['seedFiles']=rows;manifest['seedId']=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
 (kit/'support/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 start=kit/'support/start.cjs';code=start.read_text();old='const testing=process.env.QCU_TEACHER_TEST_HOME,'
 isolated='const testing=process.env.QCU_TEACHER_TEST_HOME||defaultHome('+json.dumps(a.namespace)+'),'
 if code.count(old)==1:start.write_text(code.replace(old,isolated))
 elif not((a.resume_preview or a.refresh_preview) and code.count(isolated)==1):raise ValueError('Unexpected launcher preparation code')
 if a.target=='mac-arm64':
  file=app/'Contents/Info.plist';info=plistlib.loads(file.read_bytes());info['CFBundleDisplayName']='QCU助手主题预览';info['CFBundleIdentifier']='cn.qcu.assistant.teacher.'+a.namespace;file.write_bytes(plistlib.dumps(info))
  # The inner frozen Electron bundle and its signature stay intact.
  if a.managed_updates:run('/usr/bin/codesign','--force','--sign','-','--preserve-metadata=entitlements',vendor)
  run('/usr/bin/codesign','--verify','--deep','--strict',vendor)
  run('/usr/bin/codesign','--force','--sign','-',app)
  run('/usr/bin/codesign','--verify','--deep','--strict',app)
 else:
  # Regenerate the candidate inventory; never inherit a checksum for changed files.
  (kit/'SHA256SUMS').unlink(missing_ok=True);(kit/'support/files.json').unlink(missing_ok=True)
  records=[{'path':f.relative_to(kit).as_posix(),'bytes':f.stat().st_size,'sha256':digest(f)} for f in sorted(kit.rglob('*')) if f.is_file()]
  (kit/'support/files.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
 if not a.managed_updates and digest(resources/'app.asar')!=before:raise ValueError('Vendor ASAR changed')
 (a.out/'主题预览说明.txt').write_text('QCU清蓝主题 · 独立测试候选\n\n'+('双击“QCU助手主题预览.app”。' if a.target=='mac-arm64' else '打开“QCU助手”文件夹，双击“QCU助手.exe”，不要单独移动EXE。')+'\n请先正常退出旧版QCU助手，避免混淆窗口；不用卸载。\n本候选使用独立数据目录，不迁移或覆盖原版的模型密钥、聊天和工作文件。\n首次需配置本人模型；仅检查主题不需要填写API Key或调用模型。\n数据目录位于教师数据根目录下的 '+a.namespace+'。\n请核对首页、七项教学工具、课程工作台、深色切换和大字模式。\n选择任务只填草稿，不会自动发送。已有正式可用包保持原状。\n本候选尚未通过GUI验收，不用于批量发给老师；原厂更新通道锁定仍待正式下版实施。\n',encoding='utf-8')
 if a.managed_updates:
  note=a.out/'主题预览说明.txt';note.write_text(note.read_text().replace('原厂更新通道锁定仍待正式下版实施。','本候选已移除原厂升级按钮并锁定普通检查/下载/安装；官方最低版本要求保留，更新由维护者交付完整套件。'))
 result={'target':a.target,'candidate':str(a.out.resolve()),'kit':str(kit.resolve()),'themeVersion':'0.2.0','vendorAsarSha256':digest(resources/'app.asar'),'vendorAsarUnchanged':not a.managed_updates,'isolatedDataNamespace':a.namespace,'migrationEnabled':False,'guiAccepted':False,'formalRelease':False,'seedId':manifest['seedId'],'managedUpdates':bool(a.managed_updates),'customization':customization}
 (a.out/'theme-build.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
