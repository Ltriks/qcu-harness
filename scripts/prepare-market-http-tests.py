"""Extract immutable packages into a disposable test tree; never install or access profiles."""
import argparse,tarfile,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--dependencies',type=Path,required=True);p.add_argument('--archive',type=Path,required=True);p.add_argument('--old',type=Path,required=True);p.add_argument('--coach',type=Path,required=True);a=p.parse_args()
w=Path(__file__).resolve().parents[1]/'.work/http-e2e';w.mkdir(parents=True,exist_ok=True)
records={}
for label,path in [('market',a.archive),('old',a.old),('coach',a.coach)]:
 d=w/label
 assert d.parent==w and not d.is_symlink()
 if d.exists():shutil.rmtree(d)
 d.mkdir()
 with tarfile.open(path) as t:
  for m in t.getmembers():
   assert m.isfile() and m.name.startswith('package/') and '..' not in Path(m.name).parts
  t.extractall(d,filter='data')
 records[label]={'path':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
link=w/'node_modules';target=(a.dependencies/'node_modules').resolve()
if link.is_symlink():assert link.resolve()==target
else:assert not link.exists();link.symlink_to(target,target_is_directory=True)
(w/'inputs.json').write_text(json.dumps(records,indent=2)+'\n')
print(w)
