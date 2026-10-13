"""Extract immutable packages into a disposable test tree; never install or access profiles."""
import argparse,tarfile,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--dependencies',type=Path,required=True);p.add_argument('--archive',type=Path,required=True);p.add_argument('--old',type=Path,required=True);p.add_argument('--previous',type=Path,required=True);p.add_argument('--coach',type=Path,required=True);p.add_argument('--skills',type=Path);p.add_argument('--external',type=Path);p.add_argument('--feishu',type=Path,required=True);a=p.parse_args()
w=Path(__file__).resolve().parents[1]/'.work/http-e2e';w.mkdir(parents=True,exist_ok=True)
records={}
root=Path(__file__).resolve().parents[1]
feishu=json.loads((root/'hub/market/feishu-release.json').read_text())
raw=a.feishu.read_bytes()
assert a.feishu.name==feishu['file'] and len(raw)==feishu['bytes'] and hashlib.sha256(raw).hexdigest()==feishu['sha256']
with tarfile.open(a.feishu) as t:
 members=t.getmembers()
 expected={'package.json','index.js','src/core.mjs','src/authority.mjs','cordis.patch.yml','README.md','LICENSE','NOTICE'}
 assert len(members)==8 and {m.name for m in members}=={'package/'+name for name in expected}
 for m in members:
  assert m.isfile() and not m.issym() and t.extractfile(m).read()==(root/'hub/plugins/qcu-feishu-readonly'/m.name.removeprefix('package/')).read_bytes()
records['plugins']={feishu['id']:{'path':str(a.feishu.resolve()),'sha256':feishu['sha256']}}
assert hashlib.sha256(a.previous.read_bytes()).hexdigest()=='994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288'
for label,path in [('market',a.archive),('old',a.old),('previous',a.previous),('coach',a.coach)]:
 d=w/label
 assert d.parent==w and not d.is_symlink()
 if d.exists():shutil.rmtree(d)
 d.mkdir()
 with tarfile.open(path) as t:
  for m in t.getmembers():
   assert m.isfile() and m.name.startswith('package/') and '..' not in Path(m.name).parts
  t.extractall(d,filter='data')
 records[label]={'path':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
if a.skills:
 entries=json.loads((Path(__file__).resolve().parents[1]/'hub/market/skill-releases.json').read_text())
 records['skills']={}
 external=json.loads((Path(__file__).resolve().parents[1]/'hub/market/external-skill-release.json').read_text())
 assert a.external, 'Fresh external archive directory required'
 for e in [*entries,external]:
  path=(a.external if e['id']==external['id'] else a.skills)/e['file'];raw=path.read_bytes()
  assert len(raw)==e['bytes'] and hashlib.sha256(raw).hexdigest()==e['sha256']
  records['skills'][e['id']]={'path':str(path.resolve()),'sha256':e['sha256']}
link=w/'node_modules';target=(a.dependencies/'node_modules').resolve()
if link.is_symlink():assert link.resolve()==target
else:assert not link.exists();link.symlink_to(target,target_is_directory=True)
(w/'inputs.json').write_text(json.dumps(records,indent=2)+'\n')
print(w)
