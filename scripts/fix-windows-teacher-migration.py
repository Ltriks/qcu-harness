#!/usr/bin/env python3
"""Patch the Windows rc.3 teacher bootstrap, retaining every vendor/seed byte."""
import argparse
import copy
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE_HASH='710e88eee01c03c8dd77553b33c2f8fd53481c94ae55011ac77a5439f61d579d'

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def encode(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    a=parser.parse_args()
    if digest(a.base)!=BASE_HASH:raise ValueError('Unexpected frozen guide base')
    if a.out.exists():raise ValueError('Fresh output required')
    a.out.mkdir(parents=True)
    archive=a.out/'QCU-Teacher-0.1.0-rc.3-win-x64-r3.zip'
    prefix='QCU助手/'
    bootstrap=(ROOT/'tools/teacher-suite/start.cjs').read_bytes()
    with zipfile.ZipFile(a.base) as source:
        manifest=json.loads(source.read(prefix+'support/manifest.json'))
        package=json.loads(source.read(prefix+'guide-package.json'))
        package.update(packagingRevision='r3',baseArchive=a.base.name,baseArchiveSha256=BASE_HASH,startupSupportChanged=True)
        receipt={'runtimeVersion':'0.1.0-rc.3','packagingRevision':'r3','target':'win-x64',
                 'baseArchive':a.base.name,'baseArchiveSha256':BASE_HASH,'seedId':manifest['seedId'],
                 'bootstrapSha256':hashlib.sha256(bootstrap).hexdigest(),'vendorApplicationChanged':False,
                 'nativeLauncherChanged':False,'seedChanged':False,'dataHomeChanged':False,
                 'fixes':['Skip transient Electron caches and process locks during migration',
                          'Require the previous Windows profile to stop before copying',
                          'Preserve the original error if cleanup also fails']}
        readme=('Windows启动修正版r3（运行版本仍为0.1.0-rc.3）\r\n'
                '升级前先保存工作，并正常退出旧版城院助手，包括托盘后台实例。\r\n'
                '新版只复制个人配置和工作数据，跳过可重建的Electron缓存。\r\n'
                '无需卸载旧版、删除数据或使用管理员身份运行；已有数据目录保持不变。\r\n\r\n'+source.read(prefix+'使用说明.txt').decode()).encode()
        replacements={prefix+'support/start.cjs':bootstrap,prefix+'使用说明.txt':readme,
                      prefix+'guide-package.json':encode(package),prefix+'migration-fix.json':encode(receipt)}
        rows=json.loads(source.read(prefix+'support/files.json'))
        known={row['path'] for row in rows}
        for row in rows:
            key=prefix+row['path']
            if key in replacements:row.update(bytes=len(replacements[key]),sha256=hashlib.sha256(replacements[key]).hexdigest())
        for key,data in replacements.items():
            if key[len(prefix):] not in known:rows.append({'path':key[len(prefix):],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        replacements[prefix+'support/files.json']=encode(sorted(rows,key=lambda row:row['path']))
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as out:
            for info in source.infolist():
                with out.open(copy.copy(info),'w',force_zip64=True) as dst:
                    if info.filename in replacements:dst.write(replacements[info.filename])
                    else:
                        with source.open(info) as src:shutil.copyfileobj(src,dst,1024*1024)
            for key,data in replacements.items():
                if key not in source.namelist():out.writestr(key,data)
    with zipfile.ZipFile(a.base) as before,zipfile.ZipFile(archive) as final:
        expected=set(before.namelist())|{prefix+'migration-fix.json'}
        if set(final.namelist())!=expected:raise ValueError('Unexpected files')
        for info in before.infolist():
            if info.filename not in replacements:
                if before.read(info)!=final.read(info.filename) or info.external_attr!=final.getinfo(info.filename).external_attr:raise ValueError('Unexpected modification: '+info.filename)
        inventory=json.loads(final.read(prefix+'support/files.json'))
        if {prefix+r['path'] for r in inventory}!=expected-{prefix+'support/files.json'}:raise ValueError('Inventory coverage mismatch')
        for row in inventory:
            data=final.read(prefix+row['path'])
            if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('Inventory mismatch: '+row['path'])
    result={**receipt,'createdAt':datetime.now(timezone(timedelta(hours=8))).isoformat(),
            'archive':{'file':archive.name,'bytes':archive.stat().st_size,'sha256':digest(archive)},
            'verification':{'allOriginalVendorSeedAndLauncherBytesUnchanged':True,'completeFinalFileInventory':'passed',
                            'files':len(expected),'changedOrAdded':sorted(replacements)}}
    (a.out/'build.json').write_bytes(encode(result));print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
