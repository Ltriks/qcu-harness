"""Read-only ASAR code audit; extract exact official app-boot LIB for isolated tests.
No application launch, profile inspection, installation or network.
"""
import argparse,struct,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--asar',type=Path,required=True);p.add_argument('--dependencies',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
w=Path(__file__).resolve().parents[1]/'.work/http-e2e';w.mkdir(parents=True,exist_ok=True)
files={'cordis':['lib/index.js'],'cordis-plugin-loader':['lib/index.js'],'dsh-api-gateway':['lib/index.js','lib/client.js'],'dsh-client-connection':['lib/index.js','lib/client.js'],'dsh-typert-protocol':['lib/index.js'],'dsh-typert-registry':['lib/index.js'],'dsh-plugin-manager':['lib/index.js','lib/typert.host.js','lib/typert.remote-client.js'],'dsh-app-boot':['lib/index.js']}
records=[]
with a.asar.open('rb') as f:
 _,size,_,n=struct.unpack('<4I',f.read(16));header=json.loads(f.read(n))
 for package,names in files.items():
  for name in names:
   v=header
   for part in ('dsh/node_modules/@deepseek-ai/'+package+'/'+name).split('/'):v=v['files'][part]
   assert not v.get('unpacked') and not v.get('link')
   f.seek(8+size+int(v['offset']));official=f.read(v['size']);local=(a.dependencies/'node_modules/@deepseek-ai'/package/name).read_bytes()
   same=official==local
   r={'package':package,'file':name,'dependencyBytesEqualOfficial':same,'officialSha256':hashlib.sha256(official).hexdigest(),'dependencySha256':hashlib.sha256(local).hexdigest()}
   if package=='dsh-app-boot':
    d=w/'official-app-boot';d.mkdir(exist_ok=True);(d/'index.mjs').write_bytes(official)
    link=d/'node_modules';target=(a.dependencies/'node_modules/@deepseek-ai/dsh-app-boot/node_modules').resolve()
    if link.is_symlink():assert link.resolve()==target
    else:assert not link.exists();link.symlink_to(target,target_is_directory=True)
    r['testRuntime']='exact ASAR bytes extracted to .work/http-e2e/official-app-boot/index.mjs'
   else:assert same,f'Unreviewed runtime drift: {package}/{name}';r['testRuntime']='byte-identical dependency artifact'
   records.append(r)
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps({'asarSha256':hashlib.sha256(a.asar.read_bytes()).hexdigest(),'files':records},indent=2)+'\n')
print(f'Verified {len(records)} official runtime artifacts; app-boot uses exact extracted ASAR bytes')
