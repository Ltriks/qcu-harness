#!/usr/bin/env python3
"""Pin reviewed rc4.3 inputs without building, installing, fetching or executing packages."""
import argparse
import copy
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.1.0-rc.4.3'
CORE = '0.2.0-rc.2'
POLICY = {'autoInstallPeers': False, 'ignoreScripts': True, 'packageImportMethod': 'copy'}
RELEASES = {'0.1.0-rc.4.1': ('0.2.3',), '0.1.0-rc.4.2': ('0.2.4',),
            VERSION: ('0.2.6-pilot.2', '0.2.6-pilot.3')}
ORIGINAL_CONFIG_SHA256 = '3c721d1ab3747ccb2195cacd21a5756495b0b73903db13cfa79925e79df3ead5'
CUSTOM_ASAR = '759bf095f7e4e6b97380f6103a9a6b8c34fc980c4b7b9b34bd1c1cf1f8ed0583'
MANAGED_SCRIPT = '11e672bb28e57e58a811996dcd52fafa95c3980d0ee0c878a270699a3d8f1d92'
FIXED_ROOT = Path('/Users/mcq/Artifacts/qcu-harness/0.1.0-rc.4.1/local-font-install-20261027/packages')
FIXED = {
    'qcu-course-workbench': ('0.1.0-pilot.1.3.font.1', 54521,
        'd46ba9e2deb27f7cd6296a5bfd24b3e8db0f0d99bcc4cddc734f82b794197411',
        '5117f210e2fffc953cb8072f435b24ae6d3261e7aafe61dacc4690f06c383b41'),
    'qcu-expert-teams': ('0.2.0-pilot.3.font.1', 59991,
        '4835ab751ccef3f11089a5b5ad198ea22d1ef7d34a334ac231ef83052cdbad93',
        'c67dc10463e74a3282019489b17e9948b03c97d81dd88ab2068e67199c75a1ec'),
}
THEME_FILES = {'LICENSE', 'client.js', 'cordis.patch.yml', 'icon.svg', 'index.js', 'package.json'}
PEERS = {**{k: CORE for k in (
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-theme', '@deepseek-ai/dsh-client-ui-workspace',
    '@deepseek-ai/dsh-client-ui-plugin-manager', '@deepseek-ai/dsh-plugin-manager',
    '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-typert-protocol',
    '@deepseek-ai/dsh-typert-registry', '@deepseek-ai/dsh-app-boot', '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-workspace', '@deepseek-ai/dsh-agent-default-model', '@deepseek-ai/dsh-skill')},
    '@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/schemastery': '3.18.4'}
MARKET_PEERS = {k: PEERS[k] for k in (
    '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-plugin-manager', '@deepseek-ai/dsh-api-remotes',
    '@deepseek-ai/dsh-client-ui-plugin-manager', '@deepseek-ai/dsh-typert-registry',
    '@deepseek-ai/dsh-typert-protocol', '@deepseek-ai/dsh-app-boot')}


def load_sources():
    spec = importlib.util.spec_from_file_location('pinned_sources', ROOT / 'scripts/prepare-preinstalled-local-sources.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SOURCES = load_sources()
sha = SOURCES.sha


def file_pin(file):
    file = Path(file).absolute()
    SOURCES.no_links(file)
    if not file.is_file():
        raise ValueError('Expected plain input file: ' + str(file))
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'path': str(file), 'bytes': file.stat().st_size, 'sha256': h.hexdigest()}


def checked_pin(pin):
    path = Path(pin['path'])
    if not path.is_absolute():
        path = ROOT / path
    actual = file_pin(path)
    if any(actual[k] != pin[k] for k in ('bytes', 'sha256')):
        raise ValueError('Pinned build input mismatch: ' + str(path))
    return path


def read_json(file, expected_sha=None):
    data = SOURCES.bounded_read(Path(file).absolute(), 1024 * 1024)
    if expected_sha is not None and sha(data) != expected_sha:
        raise ValueError('Reviewed manifest/config hash mismatch')
    return json.loads(data)


def theme_version(config):
    version = config.get('version')
    # rc4.3 always requires an explicit, exact composition pin, including pilot.3.
    theme = config.get('brandingVersion') if version == VERSION else RELEASES.get(version, (None,))[0]
    if version != VERSION and 'brandingVersion' in config and config['brandingVersion'] != theme:
        raise ValueError('Historical release theme override refused')
    if theme not in RELEASES.get(version, ()) or config.get('target') != 'mac-arm64':
        raise ValueError('Only exact pinned rc4.1/rc4.2/rc4.3 Mac compositions are supported')
    if config.get('packagePolicy') != POLICY:
        raise ValueError('Unexpected twelve-source package policy')
    return theme


def original_config(file):
    config = read_json(file, ORIGINAL_CONFIG_SHA256)
    # No path replacements: this historical config is public and contains no used Home.
    pins = {k: checked_pin(v) for k, v in config.items() if isinstance(v, dict) and 'sha256' in v}
    if len(pins) != 12 or config['customAsarSha256'] != CUSTOM_ASAR or config['managedUpdatesScript']['sha256'] != MANAGED_SCRIPT:
        raise ValueError('Original twelve-pin/managed-ASAR contract mismatch')
    return config, pins


def inspect_package(manifest_file, archive_file, id, version, manifest_sha):
    manifest = read_json(manifest_file, manifest_sha)
    archive_file = Path(archive_file).absolute()
    market = id == 'qcu-market'
    # The existing market packer uses package + exact peers, without a top-level runtime.
    # Validate that schema as-is; never rewrite immutable manifests into another shape.
    manifest_id = manifest.get('package') if market else manifest.get('id')
    runtime_valid = ('runtime' not in manifest or manifest['runtime'] == CORE) if market else manifest.get('runtime') == CORE
    if (manifest_id != id or manifest.get('version') != version
            or not runtime_valid or manifest.get('file') != archive_file.name
            or not re.fullmatch(r'[a-z0-9.-]+\.tgz', archive_file.name)):
        raise ValueError('Unexpected package manifest identity/runtime/filename')
    data = SOURCES.bounded_read(archive_file, 4 * 1024 * 1024)
    SOURCES.checked(data, manifest)
    rows = manifest.get('files')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Plain package inventory required')
    expected = {}
    for row in rows:
        name = SOURCES.safe_path(row['path'])
        if not name.startswith('package/') or name in expected:
            raise ValueError('Duplicate or unprefixed package inventory')
        if type(row['bytes']) is not int or not 0 <= row['bytes'] <= 4 * 1024 * 1024 or not re.fullmatch(r'[a-f0-9]{64}', row['sha256']):
            raise ValueError('Invalid package inventory hash/size')
        if 'mode' in row and row['mode'] != '0644':
            raise ValueError('Unexpected declared package member mode')
        expected[name] = row
    # Inspect raw headers too: tarfile otherwise silently consumes GNU/PAX extension records.
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
        raw = stream.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError('Expanded TGZ size bound exceeded')
    offset = 0
    while offset + 512 <= len(raw):
        header = raw[offset:offset + 512]
        if header == bytes(512):
            if len(raw) - offset < 1024 or any(raw[offset:]):
                raise ValueError('Unexpected trailing archive data')
            break
        if header[156:157] not in (b'0', b'\0') or header[257:263] != b'ustar\0':
            raise ValueError('Only plain USTAR file members are admitted')
        try:
            size = int(header[124:136].rstrip(b'\0 '), 8)
        except ValueError as error:
            raise ValueError('Invalid plain archive size') from error
        if not 0 <= size <= 4 * 1024 * 1024:
            raise ValueError('Plain archive member size bound exceeded')
        offset += 512 + ((size + 511) // 512) * 512
    else:
        raise ValueError('Truncated plain archive')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as tar:
        total = 0
        for member in tar:
            name = SOURCES.safe_path(member.name)
            # Plain files only: reject directories, links, devices, PAX headers and duplicate entries.
            if (name not in expected or name in files or not member.isfile() or member.mode != 0o644
                    or member.pax_headers or not name.startswith('package/')):
                raise ValueError('Unsafe or unexpected plain TGZ member')
            total += member.size
            if total > 16 * 1024 * 1024 or member.size != expected[name]['bytes']:
                raise ValueError('Package member size bound/mismatch')
            content = tar.extractfile(member).read()
            SOURCES.checked(content, expected[name])
            files[name] = content
    if set(files) != set(expected):
        raise ValueError('Package member inventory mismatch')
    flat = {name.removeprefix('package/'): content for name, content in files.items()}
    SOURCES.identity(flat, id, version)
    pkg = json.loads(flat['package.json'])
    if any(pkg.get(k) for k in ('bundledDependencies', 'bundleDependencies', 'devDependencies', 'peerDependenciesMeta')):
        raise ValueError('Unexpected bundled/development/optional peer dependencies')
    peers = pkg.get('peerDependencies', {})
    if not isinstance(peers, dict) or any(PEERS.get(k) != v for k, v in peers.items()):
        raise ValueError('Unexpected or incompatible host peers')
    if market and (peers != MARKET_PEERS or manifest.get('peerDependencies') != MARKET_PEERS or manifest.get('scripts')):
        raise ValueError('Exact market manifest/package host peers and no scripts required')
    if id == 'qcu-branding':
        if set(flat) != THEME_FILES or SOURCES.branding_archive(flat) != data:
            raise ValueError('Exact six-file deterministic theme repack required')
    product = {'id': id, **{k: manifest[k] for k in ('version', 'file', 'bytes', 'sha256')}}
    return product, flat, manifest


def fixed_package(id, manifest_file=None):
    version, size, digest, manifest_sha = FIXED[id]
    manifest_file = Path(manifest_file or FIXED_ROOT / id / 'MANIFEST.json')
    manifest = read_json(manifest_file, manifest_sha)
    product, files, _ = inspect_package(manifest_file, manifest_file.parent / manifest['file'], id, version, manifest_sha)
    if (product['bytes'], product['sha256']) != (size, digest):
        raise ValueError('Frozen font.1 archive mismatch')
    return product, files


def validate_rc43(config, pins):
    theme = theme_version(config)
    if config['version'] != VERSION:
        raise ValueError('Expected rc4.3 config')
    original = read_json(ROOT / 'release/integrated-teacher-macos-rc42.json', ORIGINAL_CONFIG_SHA256)
    unchanged = ('base', 'legacyInputs', 'legacyManifest', 'courseSource', 'managedUpdatesScript',
                 'sdkAnchor', 'sdkRuntime', 'trustedRuntime', 'officialSdk', 'customAsarSha256', 'packagePolicy')
    if any(config.get(k) != original[k] for k in unchanged) or config.get('originalConfig') != {
            'sha256': ORIGINAL_CONFIG_SHA256, 'sourceCommit': '67768251d96aa189a2819c0da18a63d0f0d9bdec'}:
        raise ValueError('Original program/runtime/source pins must remain exact')
    if config.get('marketManifest') != config.get('marketPackageManifest'):
        raise ValueError('Market composition manifest alias mismatch')
    products = []
    for key, id, version in [('branding', 'qcu-branding', theme), ('market', 'qcu-market', '0.1.0-pilot.16.1')]:
        product, files, _ = inspect_package(pins[key + 'PackageManifest'], pins[key + 'Archive'], id, version,
                                          config[key + 'PackageManifest']['sha256'])
        products.append(product)
        if key == 'branding':
            staged = read_json(pins['themeManifest'])
            rows = [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(files.items())]
            if staged != {'version': theme, 'files': rows}:
                raise ValueError('Transformed theme inventory mismatch')
            SOURCES.inspect_tree(pins['themeManifest'].parent / 'qcu-branding', {r['path']: r for r in rows})
            for row in rows:
                content = SOURCES.bounded_read(pins['themeManifest'].parent / 'qcu-branding' / row['path'], row['bytes'])
                SOURCES.checked(content, row)
    for key, id in [('courseManifest', 'qcu-course-workbench'), ('expertManifest', 'qcu-expert-teams')]:
        product, _ = fixed_package(id, pins[key])
        products.append(product)
    if config.get('reviewedComponents') != products:
        raise ValueError('Reviewed composition record mismatch')
    if config['customAsarSha256'] != CUSTOM_ASAR or config['managedUpdatesScript']['sha256'] != MANAGED_SCRIPT:
        raise ValueError('Frozen managed-ASAR policy mismatch')
    return products


def generate(args):
    config, _ = original_config(args.base_config)
    output, staging = Path(args.output).absolute(), Path(args.staging).absolute()
    for dest in (output, staging):
        SOURCES.no_links(dest)
        if dest.exists():
            raise ValueError('Fresh config/staging required; existing output preserved')
    if output == staging or staging in output.parents or output in staging.parents:
        raise ValueError('Config and staging must be separate')
    inputs = [Path(p).absolute() for p in (args.base_config, args.branding_manifest, args.branding_archive,
              args.market_manifest, args.market_archive, args.course_manifest, args.expert_manifest)]
    if any(staging == p or staging in p.parents or output == p for p in inputs):
        raise ValueError('Output overlaps a reviewed input')
    brand, files, _ = inspect_package(args.branding_manifest, args.branding_archive, 'qcu-branding',
                                     args.branding_version, args.branding_manifest_sha256)
    if args.branding_version not in RELEASES[VERSION]:
        raise ValueError('Only reviewed pilot.2/pilot.3 branding is admitted')
    market, _, _ = inspect_package(args.market_manifest, args.market_archive, 'qcu-market',
                                  '0.1.0-pilot.16.1', args.market_manifest_sha256)
    course, _ = fixed_package('qcu-course-workbench', args.course_manifest)
    expert, _ = fixed_package('qcu-expert-teams', args.expert_manifest)
    config = copy.deepcopy(config)
    config.update(version=VERSION, brandingVersion=args.branding_version,
                  reviewedComponents=[brand, market, course, expert],
                  originalConfig={'sha256': ORIGINAL_CONFIG_SHA256, 'sourceCommit': '67768251d96aa189a2819c0da18a63d0f0d9bdec'})
    for key, value in [('brandingPackageManifest', args.branding_manifest), ('brandingArchive', args.branding_archive),
                       ('marketPackageManifest', args.market_manifest), ('marketArchive', args.market_archive),
                       ('marketManifest', args.market_manifest), ('courseManifest', args.course_manifest), ('expertManifest', args.expert_manifest)]:
        config[key] = file_pin(value)
    # All checks finish before the first output mutation. Staging comes only from exact TGZ members.
    staging.mkdir(parents=True, exist_ok=False)
    for name, data in sorted(files.items()):
        target = staging / 'qcu-branding' / name
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(data)
        target.chmod(0o644)
    theme_manifest = staging / 'MANIFEST.json'
    theme_manifest.write_text(json.dumps({'version': args.branding_version, 'files': [
        {'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(files.items())]}, indent=2) + '\n')
    config['themeManifest'] = file_pin(theme_manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        stream.write(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    return {'status': 'pinned-inputs-only-not-built', 'config': file_pin(output), 'brandingDeterministicRepackByteIdentical': True,
            'components': config['reviewedComponents'], 'originalPinsChecked': 12}


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base-config', type=Path, default=ROOT / 'release/integrated-teacher-macos-rc42.json')
    for key in ('branding', 'market'):
        p.add_argument('--' + key + '-manifest', type=Path, required=True)
        p.add_argument('--' + key + '-manifest-sha256', required=True)
        p.add_argument('--' + key + '-archive', type=Path, required=True)
    p.add_argument('--branding-version', choices=RELEASES[VERSION], default='0.2.6-pilot.2')
    p.add_argument('--course-manifest', type=Path, default=FIXED_ROOT / 'qcu-course-workbench/MANIFEST.json')
    p.add_argument('--expert-manifest', type=Path, default=FIXED_ROOT / 'qcu-expert-teams/MANIFEST.json')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--staging', type=Path, required=True)
    return p


if __name__ == '__main__':
    print(json.dumps(generate(parser().parse_args()), ensure_ascii=False))
