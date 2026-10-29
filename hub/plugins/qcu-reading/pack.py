"""Deterministic local candidate. Does not install, publish or deploy."""
from pathlib import Path
import argparse
import gzip
import hashlib
import io
import json
import tarfile


def build(root):
    manifest = json.loads((root / 'package.json').read_text())
    assert manifest['name'] == 'qcu-reading' and manifest['version'] == '0.1.0-pilot.1'
    assert not any(manifest.get(k) for k in ['scripts', 'dependencies', 'optionalDependencies', 'bundledDependencies'])
    assert all(v == ('4.0.4' if k.endswith('/cordis') else '3.18.4' if k.endswith('/schemastery') else '0.2.0-rc.2') for k, v in manifest['peerDependencies'].items())
    assert json.loads((root / 'cordis.patch.yml').read_text()) == [{'insert':[{'id':'qcu-reading', 'name':'qcu-reading', 'disabled':True, 'config':{'enabled':True}}]}]
    files = sorted(['package.json', *manifest['files']])
    assert len(files) == len(set(files))
    for value in [*manifest['exports'].values(), manifest['dsh']['bundle']['patch']]:
        assert value.removeprefix('./') in files
    client = (root / 'client.js').read_text()
    assert client.startswith('// Generated official lazy-CJS Client;')
    assert "require('react')" in client and "name:'main', key:'qcu-reading'" in client
    assert not any(line.startswith(('import ', 'export ')) for line in client.splitlines())
    raw, records = io.BytesIO(), []
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name in files:
            path = root / name
            assert not Path(name).is_absolute() and '..' not in Path(name).parts
            assert path.is_file() and not path.is_symlink()
            assert not any(part in ['node_modules', '.env', '.work'] for part in path.parts)
            data = path.read_bytes()
            data.decode('utf-8')
            entry = tarfile.TarInfo('package/' + name)
            entry.size, entry.mode, entry.mtime = len(data), 0o644, 0
            tar.addfile(entry, io.BytesIO(data))
            records.append({'path':entry.name, 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()})
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb', filename='', mtime=0, compresslevel=9) as zipped:
        zipped.write(raw.getvalue())
    data = out.getvalue()
    assert len(data) <= 1048576
    return manifest, data, records


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    manifest, data, records = build(root)
    assert build(root)[1] == data
    sha = hashlib.sha256(data).hexdigest()
    filename = f"{manifest['name']}-{manifest['version']}-{sha}.tgz"
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'id':manifest['name'], 'version':manifest['version'], 'file':filename, 'bytes':len(data), 'sha256':sha, 'files':records, 'status':'local-candidate-not-published', 'defaultDisabled':True, 'runtime':'0.2.0-rc.2'}
    def immutable(path, content):
        if path.exists():
            assert path.is_file() and not path.is_symlink() and path.read_bytes() == content
        else:
            with path.open('xb') as target:
                target.write(content)
    immutable(args.output / filename, data)
    immutable(args.output / 'MANIFEST.json', (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode())
    immutable(args.output / 'SHA256SUMS', f'{sha}  {filename}\n'.encode())
    print(json.dumps({k:v for k,v in report.items() if k != 'files'}, ensure_ascii=False))
