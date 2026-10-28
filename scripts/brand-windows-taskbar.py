#!/usr/bin/env python3
"""Apply one explicit Windows-main-process branding patch to the verified startup fix."""
import argparse, copy, hashlib, io, json, shutil, struct, subprocess, zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE_HASH='f41508533d5a3cbd87d61c20caf26c86d14b1b29d8641fd0433c9335cdcc1a11'
MAIN_HASH='10325004a1ddbd8118ed0607ea28d50a7b0d692dcaeb25a67a7d8aea9165019d'
FUSE_SENTINEL=b'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
def sha(data):return hashlib.sha256(data).hexdigest()
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def encode(data):return (json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode()
def header(data):
    a,b,c,d=struct.unpack('<4I',data[:16])
    if a!=4 or c!=b-4 or d>c-4:raise ValueError('Unexpected ASAR header')
    return json.loads(data[16:16+d]),8+b
def entries(node,prefix=''):
    for name,entry in node.get('files',{}).items():
        key=prefix+name
        if 'files' in entry:yield from entries(entry,key+'/')
        else:yield key,entry
def patch_asar(original,patch):
    h,base=header(original);old_entries=dict(entries(h));entry=old_entries['lib/main.js'];offset=int(entry['offset']);size=entry['size']
    main=original[base+offset:base+offset+size]
    if sha(main)!=MAIN_HASH:raise ValueError('Unexpected vendor main script')
    anchor=b'protocol.registerSchemesAsPrivileged([{'  # before app readiness and any window creation
    if main.count(anchor)!=1:raise ValueError('Branding hook anchor is not unique')
    branded=main.replace(anchor,patch+b'\n'+anchor,1);delta=len(branded)-len(main)
    for name,row in entries(h):
        if 'offset' in row and int(row['offset'])>offset:row['offset']=str(int(row['offset'])+delta)
    entry['size']=len(branded)
    block=entry['integrity']['blockSize']
    if entry['integrity']['algorithm']!='SHA256':raise ValueError('Unexpected integrity algorithm')
    entry['integrity'].update(hash=sha(branded),blocks=[sha(branded[i:i+block]) for i in range(0,len(branded),block)])
    body=json.dumps(h,ensure_ascii=False,separators=(',',':')).encode();padding=(-len(body))%4
    pickle=struct.pack('<II',4+len(body)+padding,len(body))+body+b'\0'*padding
    result=struct.pack('<II',4,len(pickle))+pickle+original[base:base+offset]+branded+original[base+offset+size:]
    new_h,new_base=header(result);new_entries=dict(entries(new_h));old_h,_=header(original);expected=dict(entries(old_h))
    if set(expected)!=set(new_entries):raise ValueError('ASAR member set changed')
    checked=0
    for name,row in expected.items():
        new=new_entries[name]
        if 'offset' not in row:
            if row!=new:raise ValueError('Unpacked/link metadata changed')
            continue
        old_data=original[base+int(row['offset']):base+int(row['offset'])+row['size']]
        new_data=result[new_base+int(new['offset']):new_base+int(new['offset'])+new['size']]
        if name=='lib/main.js':
            if new_data!=branded or sha(new_data)!=new['integrity']['hash']:raise ValueError('Patched entry mismatch')
        elif old_data!=new_data or {k:v for k,v in row.items() if k!='offset'}!={k:v for k,v in new.items() if k!='offset'}:raise ValueError('Other ASAR member changed: '+name)
        checked+=1
    return result,branded,checked
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);a=parser.parse_args()
    if digest(a.base)!=BASE_HASH:raise ValueError('Unexpected startup-fix base archive')
    if a.out.exists():raise ValueError('Fresh output required')
    a.out.mkdir(parents=True);archive=a.out/'QCU-Teacher-0.1.0-rc.3-win-x64-r4.zip';prefix='QCU助手/'
    patch=(ROOT/'tools/teacher-branding/windows-taskbar.js').read_bytes()
    with zipfile.ZipFile(a.base) as source:
        executable=source.read(prefix+'program/DeepSeek Harness.exe');pos=executable.find(FUSE_SENTINEL)
        if pos<0:raise ValueError('Cannot verify Electron fuse wire')
        fuse=executable[pos+len(FUSE_SENTINEL):pos+len(FUSE_SENTINEL)+11]
        if fuse[:2]!=bytes([1,9]) or fuse[2+4]!=ord('0'):raise ValueError('This vendor build does not permit an external ASAR customization; no fuses will be changed')
        original=source.read(prefix+'program/resources/app.asar');branded,main_script,checked=patch_asar(original,patch)
        (a.out/'branded-main.mjs').write_bytes(main_script);subprocess.run(['node','--check',str(a.out/'branded-main.mjs')],check=True)
        note={'schemaVersion':1,'target':'win-x64','packagingRevision':'r4','applicationId':'cn.qcu.assistant.teacher',
              'baseArchive':a.base.name,'baseArchiveSha256':BASE_HASH,'originalAsarSha256':sha(original),'customAsarSha256':sha(branded),
              'originalMainSha256':MAIN_HASH,'customMainSha256':sha(main_script),'patchFile':'support/windows-taskbar.js',
              'modifiedAsarMembers':['lib/main.js'],'otherPackedAsarMembersUnchanged':checked-1,
              'vendorExecutableChanged':False,'securityFusesChanged':False,'seedChanged':False,'dataHomeChanged':False,
              'description':'Set the icon and Windows taskbar app/relaunch properties on each application-owned window.'}
        package=json.loads(source.read(prefix+'guide-package.json'));package.update(packagingRevision='r4',baseArchive=a.base.name,baseArchiveSha256=BASE_HASH,applicationChanged=True,startupSupportChanged=True)
        text=('Windows任务栏与启动修正版r4（运行版本仍为0.1.0-rc.3）\r\n'
              '图标修复需要先保存工作，并从助手菜单或托盘菜单正常退出已有助手，再从本目录双击QCU助手.exe。\r\n'
              '任务栏使用独立QCU标识；固定到任务栏后仍由QCU启动器打开。无需清空系统图标缓存。\r\n'
              '本包对桌面主脚本做了窗口图标定制，官方EXE签名保留，个人目录和预装内容不变。\r\n\r\n'+source.read(prefix+'使用说明.txt').decode()).encode()
        replacements={prefix+'program/resources/app.asar':branded,prefix+'support/windows-taskbar.js':patch,
                      prefix+'support/vendor-customization.json':encode(note),prefix+'guide-package.json':encode(package),prefix+'使用说明.txt':text}
        rows=json.loads(source.read(prefix+'support/files.json'));known={r['path'] for r in rows}
        for row in rows:
            key=prefix+row['path']
            if key in replacements:row.update(bytes=len(replacements[key]),sha256=sha(replacements[key]))
        for key,data in replacements.items():
            if key[len(prefix):] not in known:rows.append({'path':key[len(prefix):],'bytes':len(data),'sha256':sha(data)})
        replacements[prefix+'support/files.json']=encode(sorted(rows,key=lambda row:row['path']))
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as out:
            for info in source.infolist():
                with out.open(copy.copy(info),'w',force_zip64=True) as dst:
                    if info.filename in replacements:dst.write(replacements[info.filename])
                    else:
                        with source.open(info) as src:shutil.copyfileobj(src,dst,1024*1024)
            for key,data in replacements.items():
                if key not in source.namelist():out.writestr(key,data)
        with zipfile.ZipFile(archive) as final:
            expected=set(source.namelist())|set(replacements)
            if set(final.namelist())!=expected:raise ValueError('Unexpected ZIP members')
            for info in source.infolist():
                if info.filename not in replacements and (source.read(info)!=final.read(info.filename) or info.external_attr!=final.getinfo(info.filename).external_attr):raise ValueError('Unexpected ZIP change: '+info.filename)
            inventory=json.loads(final.read(prefix+'support/files.json'))
            if {prefix+r['path'] for r in inventory}!=expected-{prefix+'support/files.json'}:raise ValueError('Inventory coverage mismatch')
            for row in inventory:
                data=final.read(prefix+row['path'])
                if len(data)!=row['bytes'] or sha(data)!=row['sha256']:raise ValueError('Final inventory mismatch')
    result={**note,'runtimeVersion':'0.1.0-rc.3','createdAt':datetime.now(timezone(timedelta(hours=8))).isoformat(),
            'archive':{'file':archive.name,'bytes':archive.stat().st_size,'sha256':digest(archive)},
            'verification':{'mainScriptSyntax':'passed','otherAsarMembersUnchanged':checked-1,'finalInventory':'passed','files':len(expected),
                            'vendorExeAndSecurityFusesUnchanged':True,'gui':'pending-manual'}}
    (a.out/'build.json').write_bytes(encode(result));print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
