"""Deterministic npm TGZ. No scripts, dependency downloads, installation or deployment."""
from pathlib import Path
import argparse, gzip, hashlib, io, json, tarfile

def build(root):
    manifest=json.loads((root/'package.json').read_text())
    assert manifest['name']=='qcu-course-workbench'
    assert manifest['version']=='0.1.0-pilot.1.1'
    assert not any(manifest.get(k) for k in ['scripts','dependencies','optionalDependencies','bundledDependencies'])
    assert json.loads((root/'cordis.patch.yml').read_text())==[{'insert':[{'id':'qcu-course-workbench','name':'qcu-course-workbench','disabled':True,'config':{'enabled':True,'frameworkJson':'{}'}}]}]
    files=sorted(['package.json',*manifest['files']]);assert len(files)==len(set(files))
    for p in [*manifest['exports'].values(),manifest['dsh']['bundle']['patch']]:assert p.removeprefix('./') in files
    client=(root/'client.js').read_text()
    assert client.startswith('// Generated official lazy-CJS Client;')
    assert 'window.__ModuleLoader__.load(' in client and "require('react')" in client
    assert "name:'main',key:'qcu-course-workbench'" in client and "name:'sidebar.panellist'" in client
    assert not any(line.startswith(('import ','export ')) for line in client.splitlines())
    raw=io.BytesIO();records=[]
    with tarfile.open(fileobj=raw,mode='w',format=tarfile.USTAR_FORMAT) as tar:
        for name in files:
            p=root/name;assert p.is_file() and not p.is_symlink() and not any(x in p.parts for x in ['node_modules','.env'])
            b=p.read_bytes();b.decode('utf8');entry=tarfile.TarInfo('package/'+name);entry.size=len(b);entry.mode=0o644;entry.mtime=0;tar.addfile(entry,io.BytesIO(b))
            records.append({'path':entry.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
    out=io.BytesIO()
    with gzip.GzipFile(fileobj=out,mode='wb',filename='',mtime=0,compresslevel=9) as gz:gz.write(raw.getvalue())
    data=out.getvalue();assert len(data)<=1048576
    return manifest,data,records

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();root=Path(__file__).resolve().parent
    manifest,data,records=build(root);assert build(root)[1]==data
    sha=hashlib.sha256(data).hexdigest();file=f"{manifest['name']}-{manifest['version']}-{sha}.tgz";args.output.mkdir(parents=True,exist_ok=True)
    target=args.output/file
    if target.exists():assert target.read_bytes()==data
    else:target.write_bytes(data)
    report={'id':manifest['name'],'version':manifest['version'],'file':file,'bytes':len(data),'sha256':sha,'files':records,'status':'local-candidate-not-published','defaultDisabled':True,'runtime':'0.2.0-rc.2'}
    (args.output/'MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');(args.output/'SHA256SUMS').write_text(f'{sha}  {file}\n');print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
