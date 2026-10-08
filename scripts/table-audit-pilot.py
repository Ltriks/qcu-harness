#!/usr/bin/env python3
"""Small opt-in pilot helper: official CLI + dedicated mutable profile, no App installer."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import subprocess
import sys
import tarfile

VERSION = '0.2.0-prototype.7'
PACKAGE_SHA256 = 'c1192607639435922fe48216030b2507e77f372240be57c80031a0ff84382305'
CONFIG_SHA256 = '0a60b42e614e15a6e781165f61f5652e0465d1254e687b51d5fafcdadd52649d'
MARKER = '.qcu-csv-pilot-owned.json'
PURPOSE = 'QCU synthetic CSV isolated pilot'


def fail(message):
    raise RuntimeError(message)


def run(args, **options):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=120, **options)


def verify_kit(kit):
    package = kit / ('qcu-table-audit-' + VERSION + '.tgz')
    if hashlib.sha256(package.read_bytes()).hexdigest() != PACKAGE_SHA256:
        fail('Plugin SHA256 mismatch; do not install.')
    if hashlib.sha256((kit / 'csv-native-candidate.patch.json').read_bytes()).hexdigest() != CONFIG_SHA256:
        fail('Candidate configuration SHA256 mismatch.')
    with tarfile.open(package) as archive:
        members = archive.getmembers()
        if any(not member.isfile() or not member.name.startswith('package/')
               or '..' in Path(member.name).parts for member in members):
            fail('Unexpected package entry.')
        manifest = json.loads(archive.extractfile('package/package.json').read())
        if manifest['name'] != 'qcu-table-audit' or manifest['version'] != VERSION:
            fail('Unexpected plugin identity.')
        if manifest.get('dependencies') != {'ws': '8.21.0'}:
            fail('Unexpected runtime dependency.')
        if any(name in manifest.get('scripts', {}) for name in ['prepare', 'preinstall', 'install', 'postinstall']):
            fail('Unexpected install hook.')
    return package


def app_resources(app):
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        fail('This pilot requires native Apple Silicon macOS.')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != 'com.deepseek.dsh' or info.get('CFBundleShortVersionString') != '0.2.0-rc.2':
        fail('Use the fixed official 0.2.0-rc.2 App; no version exemption is used.')
    run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)])
    identity = run(['/usr/bin/codesign', '-dv', '--verbose=4', str(app)])
    if 'TeamIdentifier=NAN929V4UM' not in identity.stderr:
        fail('Unexpected official signing team.')
    run(['/usr/sbin/spctl', '--assess', '--type', 'execute', str(app)])
    resources = app / 'Contents/Resources'
    for path in ['runtime/primary-runtime/dependencies/python/bin/python3.12',
                 'runtime/primary-runtime/dependencies/node/bin/node', 'runtime/cli/bin/dsh']:
        if not (resources / path).is_file():
            fail('Official bundled runtime/CLI is incomplete.')
    return resources


def configuration(kit, resources, home):
    rows = json.loads((kit / 'csv-native-candidate.patch.json').read_text())
    for row in rows:
        if row['id'] == 'qcu-table-audit-task':
            row['config']['python'] = str(resources / 'runtime/primary-runtime/dependencies/python/bin/python3.12')
            row['config']['workRoot'] = str(home / 'work')
    return rows


def managed_home(home):
    marker = home / MARKER
    if not marker.is_file() or json.loads(marker.read_text()).get('purpose') != PURPOSE:
        fail('Home is not owned by this pilot. Run prepare on a new dedicated directory.')
    if home.is_symlink() or home.stat().st_uid != os.getuid() or home.stat().st_mode & 0o077:
        fail('Pilot Home must be owned, private (0700), and not a symlink.')


def prepare(kit, resources, home):
    if home.exists() and any(home.iterdir()) and not (home / MARKER).exists():
        fail('Refusing a nonempty existing Home; choose a new dedicated directory.')
    if home.is_symlink():
        fail('Refusing a symlink Home.')
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not (home / MARKER).exists():
        os.chmod(home, 0o700)
        (home / MARKER).write_text(json.dumps({'purpose': PURPOSE, 'version': VERSION}) + '\n')
    managed_home(home)
    for name in ['work', 'shell-empty', 'agents']:
        directory = home / name
        if directory.is_symlink():
            fail('Refusing a symlink pilot directory.')
        directory.mkdir(mode=0o700, exist_ok=True)
        if directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o077:
            fail('Pilot directories must remain owned and private.')
    patch = home / 'cordis.patch.yml'
    if not patch.exists():
        base = [row for row in configuration(kit, resources, home) if not row['id'].startswith('qcu-table-audit')]
        base += [{'id': 'webserver', 'config': {'host': '127.0.0.1', 'port': 0}},
                 {'id': 'plugin-manager', 'config': {'registry': 'https://registry.npmjs.org/', 'fallbackRegistries': []}}]
        patch.write_text(json.dumps(base, indent=2) + '\n')
    print('Prepared dedicated Home. Open the official App with this Home once, then fully quit before install.')


def assert_stopped(app, home):
    profile = home / 'profiles/desktop'
    if not (profile / 'package.json').is_file():
        fail('Official Desktop must initialize this Home first; the helper does not fabricate a reserved profile.')
    if (profile / 'lock').exists():
        fail('Desktop profile is locked; fully quit the App. Do not delete the lock.')
    processes = run(['/bin/ps', '-axo', 'comm=']).stdout.splitlines()
    executable = str(app / 'Contents/MacOS/DeepSeek Harness')
    if any(line.strip() == executable for line in processes):
        fail('The selected official App is still running; fully quit it before package management.')


def installed_matches(package, profile):
    target = profile / 'node_modules/qcu-table-audit'
    with tarfile.open(package) as archive:
        for member in archive.getmembers():
            path = target / member.name.removeprefix('package/')
            if not path.is_file() or path.read_bytes() != archive.extractfile(member).read():
                return False
    return True


def install(kit, package, resources, app, home):
    managed_home(home)
    assert_stopped(app, home)
    profile = home / 'profiles/desktop'
    environment = {key: value for key, value in os.environ.items()
                   if key in ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL']}
    environment.update(PATH='/usr/bin:/bin', DSH_HOME=str(home), DSH_AGENTS_HOME=str(home / 'agents'),
                       ZDOTDIR=str(home / 'shell-empty'))
    if not installed_matches(package, profile):
        run([str(resources / 'runtime/cli/bin/dsh'), 'plugin', '--profile', 'desktop', 'add', str(package),
             '--registry=https://registry.npmjs.org/'], env=environment, cwd=kit)
    if not installed_matches(package, profile):
        fail('Official CLI installed files differ from the verified plugin.')
    filename = profile / 'package.json'
    manifest = json.loads(filename.read_text())
    bundles = manifest['dsh']['profile']['bundles']
    if 'qcu-table-audit' not in bundles:
        bundles.append('qcu-table-audit')
        filename.write_text(json.dumps(manifest, indent=2) + '\n')
    patch = profile / 'cordis.patch.yml'
    text = patch.read_text() if patch.exists() else '[]\n'
    stamp = '# QCU isolated prototype.7 CSV pilot'
    if stamp not in text:
        # Normalize the empty array before appending YAML entries; retain other official user patches.
        meaningful = '\n'.join(line for line in text.splitlines() if line.strip() and not line.lstrip().startswith('#'))
        rows = configuration(kit, resources, home)
        if meaningful.startswith('['):
            previous = json.loads(meaningful)
            if not isinstance(previous, list):
                fail('Expected a profile patch array.')
            patch.write_text(stamp + '\n' + json.dumps(previous + rows, indent=2) + '\n')
        else:
            patch.write_text(text + '\n' + stamp + '\n' + '\n'.join('- ' + json.dumps(row) for row in rows) + '\n')
    print('Verified plugin installed and enabled only in the dedicated pilot Home. Start the same official App/Home again.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['verify', 'prepare', 'install'])
    parser.add_argument('--app', required=True, type=Path)
    parser.add_argument('--home', required=True, type=Path)
    args = parser.parse_args()
    kit = Path(__file__).resolve().parent
    app = args.app.expanduser().resolve()
    raw_home = args.home.expanduser().absolute()
    if raw_home.is_symlink():
        fail('Refusing a symlink Home.')
    home = raw_home.resolve()
    package = verify_kit(kit)
    resources = app_resources(app)
    if args.action == 'prepare':
        prepare(kit, resources, home)
    elif args.action == 'install':
        install(kit, package, resources, app, home)
    else:
        print(json.dumps({'plugin': VERSION, 'pluginSha256': PACKAGE_SHA256, 'officialApp': '0.2.0-rc.2',
                          'arch': platform.machine(), 'signatureAndGatekeeperVerified': True, 'appOrProfileModified': False}))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
        # Do not surface captured child stdout/stderr, which may contain authenticated addresses.
        print('Pilot setup stopped: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
