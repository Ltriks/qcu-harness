#!/usr/bin/env python3
"""Build a clean preinstalled teacher seed and unchanged official Windows app."""
import argparse, hashlib, importlib.util, json, shutil, struct, tarfile, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    p=argparse.ArgumentParser();p.add_argument('--inputs',type=Path,required=True);p.add_argument('--application',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--launcher',type=Path);p.add_argument('--zip',action='store_true');a=p.parse_args()
    if a.out.exists():raise ValueError('Fresh output required')
    if a.zip and not a.launcher:raise ValueError('A compiled native launcher is required for delivery')
    if a.launcher:
        binary=a.launcher.read_bytes();offset=struct.unpack_from('<I',binary,60)[0]
        if binary[:2]!=b'MZ' or binary[offset:offset+4]!=b'PE\0\0' or struct.unpack_from('<H',binary,offset+4)[0]!=0x8664 or struct.unpack_from('<H',binary,offset+24+68)[0]!=2:raise ValueError('Requires an x64 Windows GUI executable')
    spec=importlib.util.spec_from_file_location('offline_builder',ROOT/'scripts/build-offline-suite.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
    config=json.loads((ROOT/'release/offline-products.json').read_text());client=config['clients']['win-x64'];base.checked(a.inputs/client['file'],client['sha256'],client['bytes'])
    products=[r for r in config['products'] if r['id']!='qcu-market']
    for r in products:base.bundle_metadata(base.checked(a.inputs/'bundles'/r['file'],r['sha256'],r['bytes']),r)
    if not (a.application/'resources/app.asar').is_file():raise ValueError('Extract the verified official application first')
    a.out.mkdir(parents=True);shutil.copytree(a.application,a.out/'program',symlinks=True)
    if any(p.is_symlink() for p in (a.out/'program').rglob('*')):raise ValueError('Unexpected link in Windows application')
    support=a.out/'support';support.mkdir();templates=ROOT/'tools/teacher-suite'
    for name in ['Launcher.cs','start.cjs']:base.copy(templates/name,support/name)
    base.copy(templates/'使用说明.txt',a.out/'使用说明.txt')
    for name in ['offline.cjs','smoke.cjs','deny-network.cjs']:base.copy(ROOT/'tools/offline-suite'/name,support/name)
    seed=a.out/'seed';profile=seed/'profiles/desktop';profile.mkdir(parents=True)
    for r in products:
        dest=profile/'node_modules'/r['id'];dest.mkdir(parents=True)
        with tarfile.open(a.inputs/'bundles'/r['file']) as t:
            for member in t.getmembers():
                relative=Path(member.name).relative_to('package');file=dest/relative;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(t.extractfile(member).read())
    manifest={'name':'qcu-teacher-desktop','private':True,'dependencies':{r['id']:r['version'] for r in products},'dsh':{'profile':{'bundles':['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']+[r['id'] for r in products]}}}
    (profile/'package.json').write_text(json.dumps(manifest,indent=2)+'\n');(profile/'cordis.yml').write_text('[]\n')
    patches=[{'id':r['componentId'],'disabled':False,**({'config':{'cliPath':'','documentUrl':''}} if r['id']=='qcu-feishu-readonly' else {})} for r in products]
    patches.append({'id':'webserver','config':{'host':'127.0.0.1','port':0}})
    (profile/'cordis.patch.yml').write_text(json.dumps(patches,indent=2)+'\n')
    asset,expected,name=base.LARK['win-x64'];native=base.lark_binary(base.checked(a.inputs/asset,expected),'win-x64');(seed/'bin').mkdir();(seed/'bin'/name).write_bytes(native)
    base.copy(a.inputs/'lark-cli.LICENSE',a.out/'licenses/lark-cli/LICENSE');base.copy(ROOT/'LICENSE',a.out/'licenses/QCU-MIT-LICENSE')
    buddy=base.checked(a.inputs/'QCU-WorkBuddy-Skills-0.1.0-rc.1.zip',base.WORKBUDDY,43243);base.copy(buddy,support/'WorkBuddy-Skills.zip')
    rows=[{'path':f.relative_to(a.out).as_posix(),'bytes':f.stat().st_size,'sha256':digest(f)} for f in sorted(seed.rglob('*')) if f.is_file()]
    result={'schemaVersion':1,'version':'0.1.0-rc.2','target':'win-x64','dshVersion':'0.2.0-rc.2','products':products,'seedFiles':rows,'seedId':hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest(),'client':client,'modelConfigured':False,'marketIncluded':False}
    (support/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if a.launcher:base.copy(a.launcher,a.out/'城院助手.exe')
    output={'directory':str(a.out.resolve()),'products':len(products),'seedId':result['seedId'],'launcherCompiled':bool(a.launcher)}
    if a.zip:
        records=[{'path':f.relative_to(a.out).as_posix(),'bytes':f.stat().st_size,'sha256':base.digest(f)} for f in sorted(a.out.rglob('*')) if f.is_file()]
        (support/'files.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (a.out/'SHA256SUMS').write_text(''.join(r['sha256']+'  '+r['path']+'\n' for r in records)+base.digest(support/'files.json')+'  support/files.json\n',encoding='utf-8')
        archive=Path(str(a.out)+'.zip')
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
            for f in sorted(a.out.rglob('*')):
                if not f.is_file():continue
                info=zipfile.ZipInfo(a.out.name+'/'+f.relative_to(a.out).as_posix(),(2026,10,21,0,0,0));info.create_system=3;info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED
                with f.open('rb') as src,z.open(info,'w',force_zip64=True) as dst:shutil.copyfileobj(src,dst,1024*1024)
        output['archive']={'file':archive.name,'bytes':archive.stat().st_size,'sha256':base.digest(archive)}
    print(json.dumps(output))
if __name__=='__main__':main()
