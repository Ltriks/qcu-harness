"""Prepare a clean build input from hash-pinned public seed data. Never installs code."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tarfile

MAX_INVENTORY_BYTES = 64 * 1024
MAX_INPUT_FILE_BYTES = 1024 * 1024
MAX_INPUT_BYTES = 4 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value:
        raise ValueError('unsafe path')
    p = PurePosixPath(value)
    if p.is_absolute() or any(x in ('', '.', '..') for x in value.split('/')):
        raise ValueError('unsafe path: ' + value)
    return value


def no_links(path):
    for p in [path, *path.parents]:
        if p.is_symlink():
            raise ValueError('unsafe symlink: ' + str(p))


def checked(data, entry):
    if len(data) != entry['bytes'] or sha(data) != entry['sha256']:
        raise ValueError('source hash/size mismatch: ' + str(entry.get('path', entry.get('file'))))
    return data


def bounded_read(path, limit):
    no_links(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
        raise ValueError('unsafe source type or size bound exceeded: ' + str(path))
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('unsafe source type or size bound exceeded: ' + str(path))
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError('source size bound exceeded: ' + str(path))
    return data


def input_entries(frozen, seed):
    if frozen['archiveCount'] != 9 or len(frozen['products']) != 9:
        raise ValueError('unexpected product count')
    if len(frozen['brandingMembers']) != 6:
        raise ValueError('unexpected branding file count')
    entries = {'profile-template/' + name: seed[name] for name in ('package.json', 'cordis.yml', 'cordis.patch.yml')}
    for prefix, rows, field in [('archives/', frozen['products'], 'file'), ('branding/', frozen['brandingMembers'], 'path')]:
        for entry in rows:
            name = safe_path(entry[field])
            if prefix == 'archives/' and '/' in name:
                raise ValueError('unsafe archive filename')
            key = prefix + name
            if key in entries:
                raise ValueError('duplicate input path')
            entries[key] = entry
    total = 0
    for entry in entries.values():
        size = entry['bytes']
        if type(size) is not int or not 0 <= size <= MAX_INPUT_FILE_BYTES:
            raise ValueError('declared source size bound exceeded')
        total += size
    if total > MAX_INPUT_BYTES:
        raise ValueError('aggregate source size bound exceeded')
    return entries


def inspect_tree(inputs, expected):
    directories = {p.as_posix() for name in expected for p in PurePosixPath(name).parents if p != PurePosixPath('.')}
    found = set()

    def visit(root):
        with os.scandir(root) as entries:
            for entry in entries:
                path = Path(entry.path)
                name = path.relative_to(inputs).as_posix()
                if entry.is_symlink():
                    raise ValueError('unsafe symlink: ' + name)
                if entry.is_dir(follow_symlinks=False) and name in directories:
                    visit(path)
                elif entry.is_file(follow_symlinks=False) and name in expected:
                    if entry.stat(follow_symlinks=False).st_size != expected[name]['bytes']:
                        raise ValueError('source hash/size mismatch: ' + name)
                    found.add(name)
                else:
                    raise ValueError('unexpected source entry or unsafe source type: ' + name)

    visit(inputs)
    if found != set(expected):
        raise ValueError('missing source files')


def archive_files(data):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
        seen = set()
        total = 0
        for member in tar:
            name = safe_path(member.name.rstrip('/') if member.isdir() else member.name)
            if name in seen or not (name == 'package' or name.startswith('package/')):
                raise ValueError('duplicate or unsafe archive member')
            seen.add(name)
            if member.isdir():
                continue
            if not member.isfile() or member.mode & 0o7000:
                raise ValueError('unsafe archive member type/mode')
            total += member.size
            if total > 16 * 1024 * 1024:
                raise ValueError('archive too large')
            files[name.removeprefix('package/')] = tar.extractfile(member).read()
    return files


def branding_archive(files):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in sorted(files.items()):
            entry = tarfile.TarInfo('package/' + name)
            entry.size, entry.mode, entry.mtime = len(data), 0o644, 0
            tar.addfile(entry, io.BytesIO(data))
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()


def identity(files, name, version):
    package = json.loads(files['package.json'])
    if package['name'] != name or package['version'] != version:
        raise ValueError('mismatched package identity')
    # Package bytes are treated as data here, including code; none is executed.
    if any(package.get(k) for k in ('scripts', 'dependencies', 'optionalDependencies')):
        raise ValueError('unexpected executable scripts or runtime dependencies')


def prepare(inputs, output, inputs_sha256, teacher_manifest_sha256):
    if '..' in Path(inputs).parts or '..' in Path(output).parts:
        raise ValueError('unsafe input/output path')
    inputs, output = Path(inputs).absolute(), Path(output).absolute()
    no_links(inputs)
    no_links(output)
    if output.exists():
        raise ValueError('output already exists; preserved')
    if inputs == output or inputs in output.parents or output in inputs.parents:
        raise ValueError('input/output overlap')
    # A wrongly selected used Home must fail here, before any tree traversal.
    inventories = {name: bounded_read(inputs / name, MAX_INVENTORY_BYTES) for name in ('INPUTS.json', 'teacher-manifest.json')}
    if sha(inventories['INPUTS.json']) != inputs_sha256 or sha(inventories['teacher-manifest.json']) != teacher_manifest_sha256:
        raise ValueError('untrusted input inventory')
    frozen, teacher = json.loads(inventories['INPUTS.json']), json.loads(inventories['teacher-manifest.json'])
    seed = {safe_path(e['path']).removeprefix('seed/profiles/desktop/'): e for e in teacher['seedFiles'] if e['path'].startswith('seed/profiles/desktop/')}
    entries = input_entries(frozen, seed)
    expected = {**entries, **{name: {'bytes': len(data)} for name, data in inventories.items()}}
    if sum(e['bytes'] for e in expected.values()) > MAX_INPUT_BYTES:
        raise ValueError('aggregate source size bound exceeded')
    inspect_tree(inputs, expected)
    source = {name: checked(bounded_read(inputs / name, entry['bytes']), entry) for name, entry in entries.items()}
    result = {}
    for name in ('package.json', 'cordis.yml', 'cordis.patch.yml'):
        key = 'profile-template/' + name
        result[name] = checked(source[key], seed[name])
    manifest = json.loads(result['package.json'])
    dependencies = manifest['dependencies']
    sources = []
    products = list(frozen['products'])
    branding = {}
    for member in frozen['brandingMembers']:
        name = safe_path(member['path'])
        key = 'branding/' + name
        branding[name] = checked(source[key], member)
    identity(branding, 'qcu-branding', dependencies['qcu-branding'])
    brand_data = branding_archive(branding)
    products.append({'id': 'qcu-branding', 'version': dependencies['qcu-branding'], 'file': 'qcu-branding-' + dependencies['qcu-branding'] + '-local-build-' + sha(brand_data) + '.tgz', 'bytes': len(brand_data), 'sha256': sha(brand_data)})
    if len({p['id'] for p in products}) != 10 or set(dependencies) != {p['id'] for p in products}:
        raise ValueError('mismatched direct dependency identities')
    for product in products:
        name, version, filename = safe_path(product['id']), product['version'], safe_path(product['file'])
        if '/' in name or '/' in filename or dependencies[name] != version:
            raise ValueError('mismatched declaration')
        local = name == 'qcu-branding'
        if local:
            data, files = brand_data, branding
        else:
            key = 'archives/' + filename
            data = checked(source[key], product)
            files = archive_files(data)
        identity(files, name, version)
        package_seed = {p.removeprefix('node_modules/' + name + '/'): e for p, e in seed.items() if p.startswith('node_modules/' + name + '/')}
        if set(files) != set(package_seed):
            raise ValueError('package contents differ from clean teacher seed: ' + name)
        for path, content in files.items():
            result['node_modules/' + name + '/' + safe_path(path)] = checked(content, package_seed[path])
        relative = '.qcu-bundles/' + filename
        result[relative] = data
        dependencies[name] = 'file:./' + relative
        sources.append({**product, 'source': 'file:./' + relative, 'provenance': 'deterministic-local-build-not-published' if local else 'original-release-tgz-byte-identical'})
    result['package.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    result['pnpm-workspace.yaml'] = (json.dumps({'autoInstallPeers': False, 'ignoreScripts': True}, indent=2) + '\n').encode()
    report = {'schemaVersion': 1, 'purpose': 'next-clean-offline-build-input-not-live-migration', 'inputInventorySha256': inputs_sha256, 'teacherManifestSha256': teacher_manifest_sha256, 'sourceZipSha256': frozen['sourceZipSha256'], 'sources': sources, 'declarationAndPatchOrderPreserved': True, 'installed': False, 'files': [{'path': p, 'bytes': len(b), 'sha256': sha(b)} for p, b in sorted(result.items())]}
    result['PREPARATION.json'] = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
    # All checks finish before creating output. Never repair or merge an existing tree.
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir()
    try:
        for name, data in result.items():
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as f:
                f.write(data)
    except BaseException:
        shutil.rmtree(output)
        raise
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--inputs-sha256', required=True)
    parser.add_argument('--teacher-manifest-sha256', required=True)
    args = parser.parse_args()
    report = prepare(args.inputs, args.output, args.inputs_sha256, args.teacher_manifest_sha256)
    print(json.dumps({'output': str(args.output), 'sources': len(report['sources']), 'inventory': 'PREPARATION.json', 'installed': False}))
