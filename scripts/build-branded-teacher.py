#!/usr/bin/env python3
"""Brand a verified rc.2 teacher package without editing the vendor ASAR."""
import argparse, hashlib, importlib.util, json, plistlib, shutil, subprocess, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASES={'mac-arm64':'24870f0a1a8379fa47d9f838447ee0761be88cabd1db086277b34686c3a3bf14',
       'win-x64':'6ed057410c61257ff88fa13216533fd0f262b79d6c00e2f8bc1b1a819059b9c2'}
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def run(*args):subprocess.run([str(a) for a in args],check=True)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base',type=Path,required=True);p.add_argument('--target',choices=BASES,required=True);p.add_argument('--assets',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--launcher',type=Path);a=p.parse_args()
    if a.out.exists() or Path(str(a.out)+'.zip').exists():raise ValueError('Fresh output required')
    if digest(a.base)!=BASES[a.target]:raise ValueError('Unexpected base teacher archive')
    if a.target=='win-x64' and not a.launcher:raise ValueError('Compiled Windows GUI launcher required')
    if json.loads((a.assets/'qcu-branding/package.json').read_text()).get('version')!='0.1.0':raise ValueError('This historical rc.3 builder requires branding 0.1.0; use stage-teacher-theme.py for the 0.2.0 preview')
    a.out.parent.mkdir(parents=True,exist_ok=True)
    # ditto preserves Mac bundle links, executable bits and signing metadata.
    if a.target=='mac-arm64':
        run('/usr/bin/ditto','-x','-k',a.base,a.out.parent)
        (a.out.parent/a.base.stem).rename(a.out)
        oldapp=a.out/'城院助手.app';app=a.out/'QCU助手.app';oldapp.rename(app)
        kit=app/'Contents/Resources';vendor=kit/'program/DeepSeek Harness.app';resources=vendor/'Contents/Resources'
        run('/usr/bin/codesign','--verify','--deep','--strict',vendor)
    else:
        with zipfile.ZipFile(a.base) as z:z.extractall(a.out.parent)
        (a.out.parent/a.base.stem).rename(a.out)
        kit=a.out;resources=kit/'program/resources'
    before_asar=digest(resources/'app.asar')
    manifest=json.loads((kit/'support/manifest.json').read_text());oldseed=manifest['seedId']
    profile=kit/'seed/profiles/desktop'
    shutil.copytree(a.assets/'qcu-branding',profile/'node_modules/qcu-branding')
    pkg=json.loads((profile/'package.json').read_text());pkg['dependencies']['qcu-branding']='0.1.0';pkg['dsh']['profile']['bundles'].append('qcu-branding')
    (profile/'package.json').write_text(json.dumps(pkg,indent=2)+'\n')
    patches=json.loads((profile/'cordis.patch.yml').read_text());patches.append({'id':'ui-brand-official','disabled':True});(profile/'cordis.patch.yml').write_text(json.dumps(patches,indent=2)+'\n')
    shutil.copyfile(ROOT/'tools/teacher-suite/start.cjs',kit/'support/start.cjs')
    manifest.update(version='0.1.0-rc.3',displayName='QCU助手',branding={'id':'qcu-branding','version':'0.1.0'},migrateFrom={'version':'0.1.0-rc.2','seedId':oldseed})
    rows=[{'path':f.relative_to(kit).as_posix(),'bytes':f.stat().st_size,'sha256':digest(f)} for f in sorted((kit/'seed').rglob('*')) if f.is_file()]
    manifest['seedFiles']=rows;manifest['seedId']=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
    (kit/'support/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    if a.target=='mac-arm64':
        for bundle in [vendor,app]:
            infofile=bundle/'Contents/Info.plist';info=plistlib.loads(infofile.read_bytes())
            info.update(CFBundleDisplayName='QCU助手',CFBundleIconFile='QCU.icns')
            if bundle==app:info.update(CFBundleName='QCU助手',CFBundleVersion='3')
            # Electron derives '<CFBundleName> Helper.app' before any JS runs.
            # Keep the vendor's internal name in sync with its unchanged helpers.
            elif not (bundle/'Contents/Frameworks'/(info['CFBundleName']+' Helper.app')).is_dir():
                raise ValueError('Electron helper bundle does not match CFBundleName')
            infofile.write_bytes(plistlib.dumps(info))
            shutil.copyfile(a.assets/'QCU.icns',bundle/'Contents/Resources/QCU.icns')
        # Re-sign only the changed main app; nested third-party frameworks stay untouched.
        run('/usr/bin/codesign','--force','--sign','-','--preserve-metadata=entitlements',vendor)
        run('/usr/bin/codesign','--verify','--deep','--strict',vendor)
        run('/usr/bin/codesign','--force','--sign','-',app)
        run('/usr/bin/codesign','--verify','--deep','--strict',app)
        spec=importlib.util.spec_from_file_location('mac_builder',ROOT/'scripts/build-teacher-macos.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        records=builder.inventory(app,digest)
        (a.out/'app-files.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
        (a.out/'先读我.txt').write_text('QCU助手 · Mac教师预装版0.1.0-rc.3（Apple Silicon，macOS13+）\n\n解压后双击“QCU助手.app”，也可将整个APP移到“应用程序”。\n无需卸载旧DSH或运行安装脚本，九项能力预装启用，无市场。\n首次由维护人员配置模型；飞书需要本人授权。\n已识别的城院助手rc.2数据会复制到新目录，旧数据保留。\n个人数据：~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.3/\n自有启动器及定制图标后的客户端为本地签名，尚无Developer ID和公证。\n跨机下载首次运行请由维护人员验收，不要关闭安全防护。\n')
        archive=Path(str(a.out)+'.zip');run('/usr/bin/ditto','-c','-k','--sequesterRsrc','--keepParent',a.out,archive)
    else:
        shutil.copyfile(a.assets/'icon-256.png',resources/'icon.png');shutil.copyfile(a.assets/'QCU.ico',resources/'tray.ico')
        (a.out/'support/Launcher.cs').write_text((ROOT/'tools/teacher-suite/Launcher.cs').read_text().replace('城院助手','QCU助手'))
        shutil.copyfile(a.launcher,a.out/'QCU助手.exe');(a.out/'城院助手.exe').unlink()
        (a.out/'使用说明.txt').write_text('QCU助手 · Windows教师预装版0.1.0-rc.3\n\n解压整个文件夹，双击“QCU助手.exe”，不要单独移动EXE。\n无需卸载旧DSH或运行安装脚本，九项能力预装启用，无市场。\n首次由维护人员配置模型；飞书需要本人授权。\n已识别的城院助手rc.2数据会复制到新目录，旧数据保留。\n个人数据：%LOCALAPPDATA%\\QCU-DSH\\teacher\\0.1.0-rc.3\\\n启动器尚无商业代码签名，学校电脑首次运行由维护人员验收。\n')
        # Do not carry stale checksum sidecars from the historical package.
        for name in ['SHA256SUMS','support/files.json']:(a.out/name).unlink(missing_ok=True)
        records=[{'path':f.relative_to(a.out).as_posix(),'bytes':f.stat().st_size,'sha256':digest(f)} for f in sorted(a.out.rglob('*')) if f.is_file()]
        (a.out/'support/files.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
        archive=Path(str(a.out)+'.zip')
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
            for f in sorted(a.out.rglob('*')):
                if f.is_file():z.write(f,'QCU助手/'+f.relative_to(a.out).as_posix())
    if digest(resources/'app.asar')!=before_asar:raise ValueError('Vendor ASAR was unexpectedly modified')
    result={'version':'0.1.0-rc.3','target':a.target,'displayName':'QCU助手','functionalProducts':9,'brandingComponent':'qcu-branding@0.1.0','marketIncluded':False,'asarUnchanged':True,'baseArchiveSha256':BASES[a.target],'seedId':manifest['seedId'],'archive':{'file':archive.name,'bytes':archive.stat().st_size,'sha256':digest(archive)}}
    (a.out.parent/('build-'+a.target+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
