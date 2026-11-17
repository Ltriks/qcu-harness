"""Package the reviewed Hallmark DSH source; no downloads, install or publication."""
import argparse
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'packages/qcu-hallmark-design'
EXPECTED = 'edbcd3c30b74ec21986a84eea3aedb9904e39e2757df14d4cb24e47e2855cfe9'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def build(output):
    pkg = json.loads((SOURCE / 'package.json').read_text())
    names = sorted(['package.json', *pkg['files']])
    actual = sorted(p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*') if p.is_file())
    if names != actual or any(p.is_symlink() for p in SOURCE.rglob('*')):
        raise ValueError('Source inventory changed; review a new immutable release')
    files = {name: (SOURCE / name).read_bytes() for name in names}
    source = json.loads(files['SOURCE.json'])
    if source['revision'] != '04977e15f3dfd6ee4b74c887dac3eb52665d6c92':
        raise ValueError('Unexpected upstream revision')
    for pin in source['upstreamFiles']:
        name = pin['path'].removeprefix('skills/hallmark/')
        if name == 'SKILL.md':
            continue  # DSH entry is explicitly adapted; original hash is provenance.
        if digest(files[name]) != pin['sha256'] or len(files[name]) != pin['bytes']:
            raise ValueError('Pinned upstream file changed: ' + name)
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in files.items():
            item = tarfile.TarInfo('package/' + name)
            item.size, item.mode, item.mtime = len(data), 0o644, 0
            tar.addfile(item, io.BytesIO(data))
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
        gz.write(raw.getvalue())
    data = compressed.getvalue()
    sha = digest(data)
    if sha != EXPECTED:
        raise ValueError('Published bytes differ; increment version and review before publication')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / (pkg['name'] + '-' + pkg['version'] + '-' + sha + '.tgz')
    if archive.exists():
        if archive.read_bytes() != data:
            raise ValueError('Refusing existing archive overwrite')
    else:
        with archive.open('xb') as stream:
            stream.write(data)
    return {'file': str(archive), 'bytes': len(data), 'sha256': sha, 'members': len(files)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.out), ensure_ascii=False))
