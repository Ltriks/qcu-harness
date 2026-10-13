"""Deterministic standalone allowlisted packer. Never edits catalogs/profiles or downloads anything."""
import argparse
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path

MEMBERS = ('LICENSE', 'NOTICE', 'README.md', 'cordis.patch.yml', 'index.js', 'package.json', 'src/authority.mjs', 'src/core.mjs')
PEERS = {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/cosmokit': '1.8.5', '@deepseek-ai/dsh-tools': '0.2.0-rc.2', '@deepseek-ai/schemastery': '3.18.4'}
VERSION = '0.1.0-pilot.1.1'
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'hub/plugins/qcu-feishu-readonly'
ARTIFACTS = Path.home() / 'Artifacts/qcu-harness/0.1.0-pilot.8.1'

def build(source=SOURCE):
    contents = {}
    for name in MEMBERS:
        path = source / name
        assert path.is_file() and not path.is_symlink(), ('non-regular member', name)
        contents[name] = path.read_bytes()
    manifest = json.loads(contents['package.json'])
    assert manifest['name'] == 'qcu-feishu-readonly' and manifest['version'] == VERSION
    assert manifest['peerDependencies'] == PEERS
    assert not any(key in manifest for key in ['dependencies', 'optionalDependencies', 'scripts', 'bundledDependencies'])
    assert set(manifest['files']) == set(MEMBERS) - {'package.json'}
    patch = json.loads(contents['cordis.patch.yml'])
    assert patch == [{'insert': [{'id': 'qcu-feishu-readonly', 'name': 'qcu-feishu-readonly', 'disabled': True,
                                 'config': {'enabled': True, 'cliPath': '', 'documentUrl': ''}}]}]
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, body in sorted(contents.items()):
            member = tarfile.TarInfo('package/' + name)
            member.size = len(body); member.mode = 0o644; member.mtime = 0
            member.uid = member.gid = 0; member.uname = member.gname = ''
            archive.addfile(member, io.BytesIO(body))
    # Explicit gzip header avoids OS-byte drift across Python/zlib versions.
    compressed = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=compressed, mtime=0, compresslevel=9) as zipped:
        zipped.write(raw.getvalue())
    body = compressed.getvalue(); sha = hashlib.sha256(body).hexdigest()
    return body, {'name': manifest['name'], 'version': VERSION, 'runtime': '0.2.0-rc.2', 'bytes': len(body),
                  'sha256': sha, 'file': f'qcu-feishu-readonly-{VERSION}-{sha}.tgz',
                  'releaseStatus': 'standalone-local-candidate-not-published', 'peers': PEERS,
                  'members': {n: hashlib.sha256(b).hexdigest() for n, b in sorted(contents.items())}}

def immutable(path, body):
    if path.exists():
        if path.read_bytes() != body:
            raise RuntimeError('immutable artifact collision: ' + str(path))
        return
    with path.open('xb') as f:
        f.write(body)

def main():
    p = argparse.ArgumentParser(); p.add_argument('--out', type=Path, default=ARTIFACTS); a = p.parse_args()
    assert a.out.resolve() == ARTIFACTS.resolve(), 'Production artifacts must remain in the authorized artifact directory'
    body, report = build(); a.out.mkdir(parents=True, exist_ok=True)
    immutable(a.out / report['file'], body)
    immutable(a.out / (report['file'] + '.json'), (json.dumps(report, indent=2) + '\n').encode())
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
