"""Create a deterministic review artifact. Never install, fetch, or run package scripts."""
from pathlib import Path
import argparse, gzip, hashlib, io, json, tarfile
parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path, help='persistent artifact directory')
args = parser.parse_args()
root = Path(__file__).resolve().parent
manifest = json.loads((root / 'package.json').read_text())
assert manifest['name'] == 'qcu-market'
assert manifest['version'] in ['0.1.0-pilot.15.2', '0.1.0-pilot.15.2.font.1']
assert 'scripts' not in manifest
assert not any(manifest.get(k) for k in ['dependencies', 'optionalDependencies', 'bundledDependencies'])
assert manifest['peerDependencies']['@deepseek-ai/cordis']=='4.0.4'
assert all(v=='0.2.0-rc.2' for k,v in manifest['peerDependencies'].items() if k!='@deepseek-ai/cordis')
assert json.loads((root/'cordis.patch.yml').read_text())[0]['insert'] == [{'id':'qcu-market','name':'qcu-market','disabled':True}]
files = sorted(['package.json', *manifest['files']])
assert len(files) == len(set(files))
assert set(files)=={'package.json','index.js','client.js','cordis.patch.yml','README.md','LICENSE','icon.svg','locale/zh.json','locale/en.json','src/host-core.mjs','src/trusted-release.mjs','src/remote-contract.mjs','src/catalog-core.mjs','src/bundled-catalog.mjs','src/catalog-authority.mjs','src/public-trust.mjs','src/update-host.mjs','src/update-archive.mjs','src/update-policy.mjs','src/update-storage.mjs','src/update-model.mjs'}
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
buffer=io.BytesIO()
with gzip.GzipFile(fileobj=buffer,filename='',mode='wb',compresslevel=9,mtime=0) as gz:
    gz.write(payload.getvalue())
compressed=buffer.getvalue()
filename=f"qcu-market-{manifest['version']}-{hashlib.sha256(compressed).hexdigest()}.tgz"
path=args.output/filename
if path.is_symlink():
    raise SystemExit('Refusing symlink archive path')
try:
    with path.open('xb') as stream:
        stream.write(compressed)
except FileExistsError:
    if path.read_bytes()!=compressed:
        raise SystemExit('Refusing to replace different bytes at the same pilot artifact path')
report={'package':'qcu-market','version':manifest['version'],'file':filename,'bytes':len(compressed),'sha256':hashlib.sha256(compressed).hexdigest(),'defaultRowDisabled':True,'peerDependencies':manifest['peerDependencies'],'scripts':{},'files':records,'dynamicTrustConfigured': 'publicTrust=null' not in (root/'src/public-trust.mjs').read_text(), 'productionReady':False,'bundledSkills':[],'status':'offline-reviewed-not-installed','visualAcceptance':'not-tested-no-live-install-authorized'}
(args.output/'MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(args.output/'SHA256SUMS').write_text(f"{report['sha256']}  {filename}\n")
print(json.dumps(report,ensure_ascii=False,indent=2))
