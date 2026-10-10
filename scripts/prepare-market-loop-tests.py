"""Prepare isolated import fixtures. No installation, profile access or network."""
from pathlib import Path
import argparse, hashlib, json, shutil, tarfile
p=argparse.ArgumentParser();p.add_argument('--dependencies',required=True,type=Path);p.add_argument('--coach',required=True,type=Path);a=p.parse_args()
r=Path(__file__).resolve().parents[1];entry=json.loads((r/'hub/market/coach-release.json').read_text())
assert hashlib.sha256(a.coach.read_bytes()).hexdigest()==entry['sha256']
work=r/'.work/host-check';work.mkdir(parents=True,exist_ok=True)
shutil.copytree(r/'hub/plugins/qcu-market',work/'market',dirs_exist_ok=True)
link=work/'node_modules';expected=(a.dependencies/'node_modules').resolve()
assert expected.is_dir()
if link.is_symlink():assert link.resolve()==expected
elif link.exists():raise SystemExit('Unexpected dependency fixture; do not overwrite')
else:link.symlink_to(expected,target_is_directory=True)
with tarfile.open(a.coach) as t:
 for m in t.getmembers():
  assert m.isfile() and m.name.startswith('package/') and '..' not in Path(m.name).parts
 t.extractall(work/'coach',filter='data')
print('Prepared isolated module fixtures; no runtime modified')
