#!/usr/bin/env python3
"""Independent dialogue pilot materials only; no App launch, install or approval automation."""
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
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

NAME = 'qcu-dialogue-install-probe'
VERSION = '0.0.1-test.1'
FILE = NAME + '-' + VERSION + '.tgz'
SHA256 = '8b8ad2afc154278eb835a48305ce54c01d4ccc733b8f1896f807aa06dd00632e'
MARKER = '.qcu-dialogue-pilot-owned.json'
PURPOSE = 'QCU isolated official dialogue installation pilot'
MEMBERS = {'package/package.json', 'package/index.js', 'package/cordis.patch.yml', 'package/README.md'}

def fail(message):
    raise ValueError(message)

def run(arguments, **options):
    return subprocess.run(arguments, check=True, capture_output=True, text=True, timeout=60, **options)

def package_bytes(kit):
    path = kit / 'plugins' / FILE
    if path.is_symlink():
        fail('Refusing a package symlink.')
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA256:
        fail('Fixed probe SHA256 mismatch.')
    with tarfile.open(path) as archive:
        if set(archive.getnames()) != MEMBERS or any(not m.isfile() for m in archive.getmembers()):
            fail('Unexpected probe archive entries.')
        manifest = json.load(archive.extractfile('package/package.json'))
        if manifest['name'] != NAME or manifest['version'] != VERSION or manifest.get('scripts') or manifest.get('dependencies'):
            fail('Unexpected probe identity or installation behavior.')
        patch = json.load(archive.extractfile('package/cordis.patch.yml'))
        if patch[0]['insert'][0]['disabled'] is not True:
            fail('Probe must remain disabled by default.')
    return data

def app_resources(app):
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        fail('Native Apple Silicon macOS is required.')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != 'com.deepseek.dsh' or info.get('CFBundleShortVersionString') != '0.2.0-rc.2':
        fail('Use the fixed official rc.2 App.')
    run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)])
    if 'TeamIdentifier=NAN929V4UM' not in run(['/usr/bin/codesign', '-dv', '--verbose=4', str(app)]).stderr:
        fail('Unexpected signing team.')
    run(['/usr/sbin/spctl', '--assess', '--type', 'execute', str(app)])
    return app / 'Contents/Resources'

def private_directory(path):
    if path.is_symlink() or path.stat().st_uid != os.getuid() or path.stat().st_mode & 0o077:
        fail('Pilot directory must be owned, private (0700) and not a symlink.')

def managed_home(home):
    private_directory(home)
    marker = home / MARKER
    if marker.is_symlink() or not marker.is_file() or json.loads(marker.read_text()).get('purpose') != PURPOSE:
        fail('Not an independently prepared dialogue-pilot Home.')
    for name in ['workspace', 'agents', 'shell-empty']:
        private_directory(home / name)

def prepare(kit, app, home):
    package_bytes(kit)
    resources = app_resources(app)
    environment = {k: v for k, v in os.environ.items() if k in ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL']}
    environment.update(PATH='/usr/bin:/bin', ELECTRON_RUN_AS_NODE='1')
    overlay = run([str(app / 'Contents/MacOS/DeepSeek Harness'), '--expose-internals',
                   str(kit / 'make-dialogue-profile.mjs'), str(resources)], env=environment).stdout
    if not overlay or 'tool-plugin-manager' not in overlay or 'workspace-write' not in overlay:
        fail('Official Standard generation failed.')
    if home.is_symlink():
        fail('Refusing a symlink Home.')
    if home.exists() and any(home.iterdir()) and not (home / MARKER).exists():
        fail('Choose a new empty Home; the accepted CSV Home is never adopted.')
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    private_directory(home)
    marker = home / MARKER
    if marker.is_symlink():
        fail('Refusing a pilot marker symlink.')
    if not marker.exists():
        marker.write_text(json.dumps({'purpose': PURPOSE, 'version': VERSION}) + '\n')
    managed = json.loads(marker.read_text())
    if managed.get('purpose') != PURPOSE or managed.get('version') != VERSION:
        fail('Unexpected existing pilot marker.')
    for name in ['workspace', 'agents', 'shell-empty']:
        path = home / name
        path.mkdir(exist_ok=True, mode=0o700)
        private_directory(path)
    patch = home / 'cordis.patch.yml'
    if patch.is_symlink() or (patch.exists() and patch.read_text() != overlay):
        fail('Existing pilot configuration differs; preserving it.')
    if not patch.exists():
        patch.write_text(overlay)
    print('Prepared independent Home; Standard management enabled, workspace-write+ask. No App opened or package installed.')

def catalog(kit):
    value = json.loads((kit / 'catalog.json').read_text())
    entries = value.get('plugins')
    if value.get('localOnly') is not True or value.get('publicRelease') is not False or len(entries or []) != 1:
        fail('Use the private one-package fixture catalog.')
    row = entries[0]
    if any(row.get(k) != v for k, v in [('id', NAME), ('version', VERSION), ('file', FILE), ('sha256', SHA256), ('status', 'published')]):
        fail('Unexpected fixture catalog.')
    return value

def serve(kit, port):
    payload = package_bytes(kit)
    listing = json.dumps(catalog(kit)).encode()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_GET(self):
            if self.headers.get('Host') != '127.0.0.1:' + str(self.server.server_port):
                self.send_error(403)
                return
            rows = {'/catalog.json': (listing, 'application/json'), '/plugins/' + FILE: (payload, 'application/octet-stream')}
            item = rows.get(self.path)
            if item is None:
                self.send_error(404)
                return
            data, mime = item
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
    with HTTPServer(('127.0.0.1', port), Handler) as server:
        print('Private catalog: http://127.0.0.1:' + str(server.server_port) + '/catalog.json', flush=True)
        print('Keep this terminal open. Ctrl+C stops only this fixture.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        fail('Redirects are not accepted for the private fixture.')

def fetch(kit, home, url):
    managed_home(home)
    package_bytes(kit)
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or not parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path != '/catalog.json':
        fail('Use the exact plain loopback catalog URL printed by serve.')
    opener = urllib.request.build_opener(NoRedirect())
    def get(address, bound):
        with opener.open(address, timeout=10) as response:
            data = response.read(bound + 1)
            if len(data) > bound:
                fail('Fixture response exceeded its byte budget.')
            return data
    value = json.loads(get(url, 65536))
    if value != catalog(kit):
        fail('Downloaded catalog differs from the fixed private fixture.')
    address = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, '/plugins/' + FILE, '', ''))
    data = get(address, 16384)
    if hashlib.sha256(data).hexdigest() != SHA256:
        fail('Downloaded package SHA256 mismatch; nothing installed.')
    target_dir = home / 'workspace/downloaded'
    target_dir.mkdir(exist_ok=True, mode=0o700)
    private_directory(target_dir)
    target = target_dir / FILE
    if target.is_symlink() or (target.exists() and target.read_bytes() != data):
        fail('Existing download differs; preserving it.')
    if not target.exists():
        target.write_bytes(data)
        target.chmod(0o444)
    print('Verified local package target (use only in your own App; do not post the path):')
    print(target)
    print('SHA256: ' + SHA256)

def fingerprints(home):
    profile = home / 'profiles/desktop'
    if not (profile / 'package.json').is_file():
        fail('Initialize this independent Home through the official App first.')
    result = {}
    for name in ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml']:
        path = profile / name
        if path.is_symlink():
            fail('Unexpected profile metadata symlink.')
        result[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    target = profile / 'node_modules' / NAME
    if target.exists():
        if home.resolve() not in target.resolve().parents:
            fail('Probe package resolves outside the pilot Home.')
        for name in sorted(MEMBERS):
            path = target / name.removeprefix('package/')
            result['probe/' + name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    return result

def inspect(kit, home, action):
    managed_home(home)
    package_bytes(kit)
    baseline = home / '.qcu-approval-before.json'
    if baseline.is_symlink():
        fail('Unexpected snapshot symlink.')
    if action == 'snapshot':
        manifest = json.loads((home / 'profiles/desktop/package.json').read_text())
        if NAME in manifest.get('dependencies', {}) or NAME in manifest.get('dsh', {}).get('profile', {}).get('bundles', []) or (home / 'profiles/desktop/node_modules' / NAME).exists():
            fail('The rejection baseline requires the probe to be absent; do not overwrite or remove it automatically.')
        baseline.write_text(json.dumps(fingerprints(home), indent=2) + '\n')
        print('Installation-state baseline saved; no model settings or file contents displayed.')
    elif action == 'check-rejected':
        if not baseline.is_file() or json.loads(baseline.read_text()) != fingerprints(home):
            fail('Installation state differs after rejection; stop and report, do not repair automatically.')
        print('PASS: profile installation metadata and probe package state unchanged after rejection.')
    elif action == 'check-installed':
        profile = home / 'profiles/desktop'
        manifest = json.loads((profile / 'package.json').read_text())
        if NAME not in manifest.get('dependencies', {}):
            fail('Probe is absent from profile dependencies.')
        fingerprints(home)
        with tarfile.open(kit / 'plugins' / FILE) as archive:
            target = profile / 'node_modules' / NAME
            for member in archive.getmembers():
                if (target / member.name.removeprefix('package/')).read_bytes() != archive.extractfile(member).read():
                    fail('Installed probe bytes differ.')
        print('PASS: fixed probe installed byte-for-byte. Activation/Skill and restart still require real App evidence.')
    else:
        profile = home / 'profiles/desktop'
        manifest = json.loads((profile / 'package.json').read_text())
        if NAME in manifest.get('dependencies', {}) or NAME in manifest.get('dsh', {}).get('profile', {}).get('bundles', []) or (profile / 'node_modules' / NAME).exists():
            fail('Probe remains in profile installation state.')
        print('PASS: probe removed from profile installation state. Verify Skill absence after normal restart.')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'serve', 'fetch', 'snapshot', 'check-rejected', 'check-installed', 'check-removed'])
    parser.add_argument('--app', type=Path)
    parser.add_argument('--home', type=Path)
    parser.add_argument('--url')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    kit = Path(__file__).resolve().parent
    if args.action == 'serve':
        serve(kit, args.port)
        return
    if args.home is None:
        fail('--home is required.')
    home = args.home.expanduser().absolute()
    if home.is_symlink():
        fail('Refusing a symlink Home.')
    if args.action == 'prepare':
        if args.app is None:
            fail('--app is required.')
        prepare(kit, args.app.expanduser().resolve(), home)
    elif args.action == 'fetch':
        fetch(kit, home, args.url or '')
    else:
        inspect(kit, home, args.action)

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, urllib.error.URLError) as error:
        print('Pilot stopped: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)

