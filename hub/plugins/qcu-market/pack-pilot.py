"""Create a deterministic review artifact. Never install, fetch, or run package scripts."""
from pathlib import Path
import argparse, gzip, hashlib, io, json, tarfile
parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path, help='persistent artifact directory')
args = parser.parse_args()
root = Path(__file__).resolve().parent
manifest = json.loads((root / 'package.json').read_text())
assert manifest['name'] == 'qcu-market'
assert manifest['version'] in ['0.1.0-pilot.1','0.1.0-pilot.2']
assert 'scripts' not in manifest
assert not any(manifest.get(k) for k in ['dependencies', 'optionalDependencies', 'bundledDependencies'])
assert manifest['peerDependencies'] == {'@deepseek-ai/cordis':'4.0.4', '@deepseek-ai/dsh-client-ui-layout':'0.2.0-rc.2', '@deepseek-ai/dsh-client-ui-sidebar':'0.2.0-rc.2'}
assert json.loads((root/'cordis.patch.yml').read_text())[0]['insert'] == [{'id':'qcu-market','name':'qcu-market','disabled':True}]
files = sorted(['package.json', *manifest['files']])
assert len(files) == len(set(files))
assert set(files) == ({'package.json','index.js','client.js','cordis.patch.yml','README.md','LICENSE'} | ({'icon.svg','locale/zh.json','locale/en.json'} if manifest['version']=='0.1.0-pilot.2' else set()))
for path in manifest['exports'].values():
    assert all(path.removeprefix('./').replace('*',language) in files for language in ['zh','en'])
assert manifest['dsh']['bundle']['patch'].removeprefix('./') in files
args.output.mkdir(parents=True, exist_ok=True)
payload = io.BytesIO()
records=[]
with tarfile.open(fileobj=payload, mode='w', format=tarfile.USTAR_FORMAT) as archive:
    for name in files:
        file=root/name
        assert file.is_file() and not file.is_symlink()
        data=file.read_bytes();data.decode('utf8',errors='strict')
        entry=tarfile.TarInfo('package/'+name)
        entry.size=len(data);entry.mode=0o644;entry.mtime=0;entry.uid=entry.gid=0
        archive.addfile(entry,io.BytesIO(data))
        records.append({'path':entry.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':'0644'})
compressed=gzip.compress(payload.getvalue(),mtime=0)
filename=f"qcu-market-{manifest['version']}.tgz"
path=args.output/filename
if path.exists() and path.read_bytes()!=compressed:
    raise SystemExit('Refusing to replace different bytes at the same pilot artifact path')
path.write_bytes(compressed)
report={'package':'qcu-market','version':manifest['version'],'file':filename,'bytes':len(compressed),'sha256':hashlib.sha256(compressed).hexdigest(),'defaultRowDisabled':True,'peerDependencies':manifest['peerDependencies'],'scripts':{},'files':records,'bundledSkills':[],'status':'offline-reviewed-not-installed','visualAcceptance':'not-tested-browser-policy-blocked'}
(args.output/'MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(args.output/'SHA256SUMS').write_text(f"{report['sha256']}  {filename}\n")
print(json.dumps(report,ensure_ascii=False,indent=2))
