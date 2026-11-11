from pathlib import Path
import json,hashlib,shutil,subprocess,tarfile,io,gzip,plistlib,os
ROOT=Path(__file__).resolve().parent
BASE=Path('/Users/mcq/Artifacts/qcu-harness/0.1.0-rc.4.3/mac-arm64/QCU助手.app')
OUT=ROOT/'dist';APP=OUT/'QCU助手.app';RES=APP/'Contents/Resources'
def run(*args):subprocess.run(args,check=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
OUT.mkdir(exist_ok=True)
if not APP.exists():run('/usr/bin/ditto','--noqtn',str(BASE),str(APP))
shutil.rmtree(RES/'seed');shutil.copytree(BASE/'Contents/Resources/seed',RES/'seed')
# deterministic package, without credentials or development extras
brand=ROOT/'artifacts/qcu-branding';stream=io.BytesIO()
with gzip.GzipFile(fileobj=stream,mode='wb',mtime=0,filename='') as gz:
 with tarfile.open(fileobj=gz,mode='w',format=tarfile.USTAR_FORMAT) as tar:
  for p in sorted(brand.iterdir()):
   t=tarfile.TarInfo('package/'+p.name);b=p.read_bytes();t.size=len(b);t.mode=0o644;t.mtime=0;tar.addfile(t,io.BytesIO(b))
b=stream.getvalue();digest=hashlib.sha256(b).hexdigest();tgz=ROOT/'artifacts'/f'qcu-branding-0.2.7-pilot.2-{digest}.tgz';tgz.write_bytes(b)
market=ROOT.parent/'artifacts/qcu-market-16.4';marketInfo=json.loads((market/'MANIFEST.json').read_text())
m=json.loads((BASE/'Contents/Resources/support/manifest.json').read_text());oldSources=m['localSources']
profile=RES/'seed/profiles/desktop';pkg=json.loads((profile/'package.json').read_text())
replacements={'qcu-branding':(brand,tgz,'0.2.7-pilot.2'),'qcu-market':(market/'extracted/package',market/marketInfo['file'],marketInfo['version'])}
for old in oldSources:
 if old['id'] in [*replacements,'qcu-course-workbench']:
  shutil.rmtree(profile/'node_modules'/old['id'],ignore_errors=True);(profile/'.qcu-bundles'/old['file']).unlink(missing_ok=True)
rows=[]
for old in oldSources:
 id=old['id']
 if id=='qcu-course-workbench':continue
 if id in replacements:
  folder,archive,version=replacements[id];shutil.copytree(folder,profile/'node_modules'/id);shutil.copy2(archive,profile/'.qcu-bundles'/archive.name)
  row={'id':id,'version':version,'file':archive.name,'bytes':archive.stat().st_size,'sha256':sha(archive),'source':'file:./.qcu-bundles/'+archive.name,'status':'reviewed-frozen-input-not-published'}
 else:row=old
 rows.append(row)
pkg['dependencies']={r['id']:r['source'] for r in rows};pkg['dsh']['profile']['bundles']=[x for x in pkg['dsh']['profile']['bundles'] if x!='qcu-course-workbench'];write(profile/'package.json',pkg)
patch=json.loads((profile/'cordis.patch.yml').read_text());write(profile/'cordis.patch.yml',[r for r in patch if r['id']!='qcu-course-workbench'])
# Drop stale lock data containing previous managed versions; shipped runtime uses installed local packages.
for name in ['pnpm-lock.yaml','node_modules/.modules.yaml']:
 (profile/name).unlink(missing_ok=True)
for p in (ROOT/'support').iterdir():
 if p.is_file():shutil.copy2(p,RES/'support'/p.name)
baselines={}
for version,directory in [('0.1.0-rc.4.1','mac-arm64-final'),('0.1.0-rc.4.3','mac-arm64')]:
 old=json.loads((Path('/Users/mcq/Artifacts/qcu-harness')/version/directory/'QCU助手.app/Contents/Resources/support/manifest.json').read_text())
 baselines[version]={'version':version,'seedId':old['seedId'],'products':[{'id':p['id'],'version':p['version']} for p in old['products']],'localSources':[{'id':p['id'],'source':p['source'],'sha256':p['sha256']} for p in old['localSources']]}
write(RES/'support/supported-upgrades.json',baselines)
m.update(version='0.1.0-rc.4.4',buildId='rc44.2',localSources=rows,branding={'id':'qcu-branding','version':'0.2.7-pilot.2'},products=[{k:v for k,v in r.items() if k in ['id','version','file','bytes','sha256']} for r in rows if r['id']!='qcu-branding'])
m.pop('migrationBaselineSha256',None)
seed=[]
for p in sorted((RES/'seed').rglob('*')):
 if p.is_file():
  assert not p.is_symlink();seed.append({'path':p.relative_to(RES).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p),'mode':p.stat().st_mode&0o777})
m['seedFiles']=seed;m['seedId']=hashlib.sha256(json.dumps(seed,ensure_ascii=False,separators=(',',':')).encode()).hexdigest();write(RES/'support/manifest.json',m)
info=plistlib.loads((APP/'Contents/Info.plist').read_bytes());info.update(QCUReleaseVersion=m['version'],CFBundleVersion='4.4.2',CFBundleShortVersionString='0.1.0',CFBundleIdentifier='cn.qcu.teacher.rc44',QCUReleaseBuild='rc44.2');(APP/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
launcher=APP/'Contents/MacOS'/info['CFBundleExecutable']
run('/usr/bin/clang','-fobjc-arc','-mmacosx-version-min=13.0','-framework','Cocoa',str(ROOT/'Launcher.m'),'-o',str(launcher))
run('/usr/bin/codesign','--force','--sign','-','--timestamp=none',str(APP))
run('/usr/bin/codesign','--verify','--deep','--strict',str(APP))
write(ROOT/'artifacts/COMPOSITION.json',{'version':m['version'],'build':'rc44.2','seedId':m['seedId'],'components':[{'id':r['id'],'version':r['version'],'sha256':r['sha256']} for r in rows],'coursePreinstalled':False,'vendorRuntimeUnchanged':sha(RES/'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness')==sha(BASE/'Contents/Resources/program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness')})
print(APP)
