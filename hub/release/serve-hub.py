#!/usr/bin/env python3
"""Pinned static Hub snapshot on an existing Python runtime; never installs."""
import argparse
import hashlib
import ipaddress
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

MAX_FILE = 32 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024
HASH = re.compile(r'^[a-f0-9]{64}$')
PACKAGE = re.compile(r'^(plugins/[a-z][a-z0-9-]*-[0-9][a-zA-Z0-9.-]*-[a-f0-9]{64}\.tgz|skills/[a-z][a-z0-9-]*-[0-9][a-zA-Z0-9.-]*-[a-f0-9]{64}\.zip)$')
ROOT_NAMES = {'catalog.json', 'index.html', 'themes.html', 'serve-hub.py', 'README.txt'}


def check(condition, code):
    if not condition:
        raise ValueError(code)


def read_regular(path, cap):
    check(not path.is_symlink() and path.is_file(), 'unsafe-file')
    check(path.stat().st_size <= cap, 'file-too-large')
    data = path.read_bytes()
    check(len(data) <= cap, 'file-too-large')
    return data


def load_snapshot(root, manifest_pin):
    """Manifest pin is trusted separately; Node validator owns catalog schema."""
    root = Path(root)
    check(not root.is_symlink() and root.is_dir(), 'unsafe-root')
    check(HASH.fullmatch(manifest_pin or ''), 'missing-manifest-pin')
    raw = read_regular(root / 'manifest.json', 256 * 1024)
    check(hashlib.sha256(raw).hexdigest() == manifest_pin, 'manifest-trust-mismatch')
    manifest = json.loads(raw)
    check(set(manifest) == {'schemaVersion', 'files'}, 'manifest-fields')
    check(manifest['schemaVersion'] == 1 and isinstance(manifest['files'], dict), 'manifest-schema')
    check(3 <= len(manifest['files']) <= 205, 'manifest-file-count')
    check({'catalog.json', 'index.html', 'themes.html'} <= set(manifest['files']), 'missing-site-file')
    resources = {}
    total = 0
    for name, expected in manifest['files'].items():
        check(isinstance(name, str) and (name in ROOT_NAMES or PACKAGE.fullmatch(name)), 'unknown-file')
        check(isinstance(expected, dict) and set(expected) == {'bytes', 'sha256'}, 'file-fields')
        check(type(expected['bytes']) is int and 0 < expected['bytes'] <= MAX_FILE, 'invalid-file-size')
        check(isinstance(expected['sha256'], str) and HASH.fullmatch(expected['sha256']), 'invalid-file-hash')
        total += expected['bytes']
        check(total <= MAX_TOTAL, 'snapshot-too-large')
        if '/' in name:
            parent = root / name.split('/')[0]
            check(not parent.is_symlink() and parent.is_dir(), 'unsafe-package-directory')
        data = read_regular(root / name, expected['bytes'])
        check(len(data) == expected['bytes'] and hashlib.sha256(data).hexdigest() == expected['sha256'], 'file-integrity-mismatch')
        # Helper and operator README never become HTTP routes.
        if name not in {'serve-hub.py', 'README.txt'}:
            resources['/' + name] = data
    catalog = json.loads(resources['/catalog.json'])
    check(catalog.get('schemaVersion') == 1 and catalog.get('audience') == 'lan-private' and catalog.get('publicRelease') is False, 'not-private-lan-catalog')
    expected_packages = set()
    for kind in ['plugins', 'skills']:
        for entry in catalog[kind]:
            name = kind + '/' + entry['file']
            expected_packages.add('/' + name)
            check(PACKAGE.fullmatch(name) and entry['status'] == 'published' and entry['review'] == 'approved', 'invalid-catalog-package')
            check('/' + name in resources, 'missing-catalog-package')
            data = resources['/' + name]
            check(len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], 'catalog-package-mismatch')
    actual_packages = {name for name in resources if name.startswith(('/plugins/', '/skills/'))}
    check(actual_packages == expected_packages, 'unlisted-package')
    resources['/'] = resources['/index.html']
    return resources


def make_server(resources, host='127.0.0.1', port=8080, lan_approved=False):
    ip = ipaddress.ip_address(host)
    private_lan = ip.version == 4 and any(ip in ipaddress.ip_network(n) for n in ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'])
    check(host == '127.0.0.1' or (lan_approved and private_lan), 'explicit-private-lan-bind-required')

    class Handler(BaseHTTPRequestHandler):
        server_version = 'QCUStaticHub'
        sys_version = ''

        def log_message(self, *args):
            pass

        def do_GET(self):
            self.respond(False)

        def do_HEAD(self):
            self.respond(True)

        def do_POST(self):
            self.send_error(405)

        def respond(self, head):
            if self.headers.get('Host') != '%s:%s' % (host, self.server.server_port):
                self.send_error(403)
                return
            if self.path not in resources:
                self.send_error(404)
                return
            data = resources[self.path]
            content_type = 'text/html; charset=utf-8' if self.path in {'/', '/index.html', '/themes.html'} else 'application/json; charset=utf-8' if self.path == '/catalog.json' else 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if self.path.startswith(('/plugins/', '/skills/')) else 'no-store')
            self.end_headers()
            if not head:
                self.wfile.write(data)

    return HTTPServer((host, port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--lan-approved', action='store_true')
    args = parser.parse_args()
    try:
        resources = load_snapshot(args.root, args.manifest_sha256)
        print(json.dumps({'verified': True, 'servableResources': len(resources), 'serviceStarted': False}), flush=True)
        if not args.serve:
            return
        check(1024 <= args.port <= 65535, 'nonprivileged-port-required')
        with make_server(resources, args.host, args.port, args.lan_approved) as server:
            print(json.dumps({'host': args.host, 'port': args.port, 'readOnly': True, 'authenticated': False}), flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
