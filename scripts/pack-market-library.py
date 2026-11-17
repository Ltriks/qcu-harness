"""Build market 16.5 from its explicit file list; no installation or publishing."""
import argparse
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path

def build(out,package='qcu-market'):
    root=Path(__file__).resolve().parents[1]/'hub/plugins'/package
    pkg=json.loads((root/'package.json').read_text())
    names=sorted(['package.json',*pkg['files']])
    actual=sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file())
    if names!=actual or any(p.is_symlink() for p in root.rglob('*')):
        raise ValueError('Unexpected source inventory')
    raw=io.BytesIO()
    with tarfile.open(fileobj=raw,mode='w',format=tarfile.USTAR_FORMAT) as tar:
        for name in names:
            data=(root/name).read_bytes()
            member=tarfile.TarInfo('package/'+name)
            member.size,member.mode,member.mtime=len(data),0o644,0
            tar.addfile(member,io.BytesIO(data))
    compressed=io.BytesIO()
    with gzip.GzipFile(fileobj=compressed,mode='wb',filename='',mtime=0,compresslevel=9) as gz:gz.write(raw.getvalue())
    data=compressed.getvalue();sha=hashlib.sha256(data).hexdigest()
    filename=f'{pkg["name"]}-{pkg["version"]}-{sha}.tgz'
    out.mkdir(parents=True,exist_ok=True)
    (out/filename).write_bytes(data)
    result={'id':pkg['name'],'version':pkg['version'],'file':filename,'sha256':sha,'bytes':len(data),'members':len(names)}
    (out/'release.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--package',choices=['qcu-market','qcu-expert-teams','qcu-branding'],default='qcu-market')
    args=p.parse_args();print(json.dumps(build(args.out,args.package)))
