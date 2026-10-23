"""Read-only live overlay. Exact allowlist; never instantiate an administrator Store."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

REPO = Path(__file__).absolute().parents[2]
spec = importlib.util.spec_from_file_location('public_io', REPO / 'hub/admin/server.py')
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)


class PublicationReader:
    def __init__(self, root, trust, node, *, test=False):
        self.disk, self.trust, self.node, self.test = io.Disk(root), trust, str(node), test
        fd = self.disk.directory()
        import os
        os.close(fd)
        io.need(Path(node).is_absolute() and Path(node).is_file(), 'publication.node')

    def read(self, path):
        if path != '/market/catalog.signed.json' and not re.fullmatch(r'/plugins/qcu-[a-z0-9-]+-[0-9][a-z0-9.-]*-[a-f0-9]{64}\.tgz', path):
            return None
        p = io.parse(self.disk.read('current.json', 2048), 2048)
        io.need(type(p) is dict and set(p) == {'revision', 'digest', 'snapshot'}, 'publication.pointer')
        if not p['revision']:
            return None
        io.need(type(p['revision']) is int and p['revision'] > 0 and type(p['digest']) is str and re.fullmatch(r'[a-f0-9]{64}', p['digest']) and p['snapshot'] == str(p['revision']) + '-' + p['digest'], 'publication.pointer')
        directory = 'snapshots/' + p['snapshot']
        raw = self.disk.read(directory + '/catalog.signed.json', 524288)
        io.need(hashlib.sha256(raw).hexdigest() == p['digest'], 'publication.digest')
        # Verify every pointer observation. Expiry is enforced by Host; stale display remains available.
        body = json.dumps(dict(raw=base64.b64encode(raw).decode(), trust=self.trust, test=self.test, allowExpired=True)).encode()
        r = subprocess.run([self.node, str(REPO / 'scripts/qcu-market-sign.mjs'), 'verify'], input=body, capture_output=True, timeout=10, env={'PATH': '/usr/bin:/bin'}, cwd='/')
        io.need(r.returncode == 0 and len(r.stdout) <= 1048576, 'publication.signature')
        if path == '/market/catalog.signed.json':
            return raw
        files = io.parse(self.disk.read(directory + '/downloads.json', 262144))
        name = path[len('/plugins/'):]
        if type(files) is not list or name not in files:
            return None
        data = self.disk.read('archives/' + name, 1048576)
        io.need(hashlib.sha256(data).hexdigest() == name[-68:-4], 'publication.package')
        return data
