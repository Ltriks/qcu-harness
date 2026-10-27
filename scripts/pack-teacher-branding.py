"""Package exact existing branding build output; never build, install or fetch."""
from pathlib import Path
import argparse, gzip, hashlib, io, json, tarfile


def build(root):
    files = ['LICENSE', 'client.js', 'cordis.patch.yml', 'icon.svg', 'index.js', 'package.json']
    assert root.is_dir() and not root.is_symlink()
    assert sorted(p.name for p in root.iterdir()) == files
    manifest = json.loads((root / 'package.json').read_text(encoding='utf8'))
    assert manifest['name'] == 'qcu-branding'
    assert manifest['version'] == '0.2.5-font.1'
    assert not any(k in manifest for k in ['scripts', 'dependencies', 'optionalDependencies', 'bundledDependencies', 'peerDependencies'])
    assert json.loads((root / 'cordis.patch.yml').read_text(encoding='utf8')) == [{'id': 'ui-brand-official', 'disabled': True}, {'id': 'ui-sidebar', 'disabled': True}, {'insert': [{'id': 'qcu-branding', 'name': 'qcu-branding'}]}]
    for p in [*manifest['exports'].values(), manifest['dsh']['bundle']['patch']]:
        assert p.removeprefix('./') in files
    client = (root / 'client.js').read_text(encoding='utf8')
    assert 'window.__ModuleLoader__.load(' in client and "require('react')" in client
    assert 'QCU清蓝 ' + manifest['version'] in client
    assert not any(line.startswith(('import ', 'export ')) for line in client.splitlines())
    raw = io.BytesIO(); records = []
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name in files:
            p = root / name
            assert p.is_file() and not p.is_symlink()
            data = p.read_bytes(); data.decode('utf8')
            entry = tarfile.TarInfo('package/' + name)
            entry.size = len(data); entry.mode = 0o644; entry.mtime = 0
            tar.addfile(entry, io.BytesIO(data))
            records.append({'path': entry.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
        gz.write(raw.getvalue())
    data = output.getvalue(); assert len(data) <= 1048576
    return manifest, data, records


def immutable(path, data):
    assert not path.is_symlink()
    try:
        with path.open('xb') as stream:
            stream.write(data)
    except FileExistsError:
        assert path.is_file() and path.read_bytes() == data
    path.chmod(0o444)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path, help='existing output of build-teacher-theme.mjs')
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    manifest, data, records = build(args.root)
    assert build(args.root)[1] == data
    sha = hashlib.sha256(data).hexdigest()
    filename = f"{manifest['name']}-{manifest['version']}-{sha}.tgz"
    args.output.mkdir(parents=True, exist_ok=True)
    immutable(args.output / filename, data)
    report = {'id': manifest['name'], 'version': manifest['version'], 'file': filename, 'bytes': len(data), 'sha256': sha, 'files': records, 'status': 'local-candidate-not-published', 'defaultDisabled': False, 'runtime': '0.2.0-rc.2'}
    immutable(args.output / 'MANIFEST.json', (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode())
    immutable(args.output / 'SHA256SUMS', f'{sha}  {filename}\n'.encode())
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=False))
