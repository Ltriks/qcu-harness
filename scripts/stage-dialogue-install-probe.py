"""Stage a deterministic, private Hub probe; never install, serve or modify profiles."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / 'hub/pilot/dialogue-install-probe'
NAME = 'qcu-dialogue-install-probe'
VERSION = '0.0.1-test.1'
FILES = ('package.json', 'index.js', 'cordis.patch.yml', 'README.md')

def stage(destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('Choose a new output directory; existing contents are never replaced.')
    contents = {}
    for name in FILES:
        path = PROBE / name
        if path.is_symlink():
            raise ValueError('Fixture source must not be a symlink.')
        contents[name] = path.read_bytes()
    package = json.loads(contents['package.json'])
    patch = json.loads(contents['cordis.patch.yml'])
    if package['name'] != NAME or package['version'] != VERSION:
        raise ValueError('Fixture identity changed; review and version it first.')
    if package.get('scripts') or package.get('dependencies'):
        raise ValueError('Fixture must not declare lifecycle scripts or runtime dependencies.')
    if package['peerDependencies'] != {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/dsh-skill': '0.2.0-rc.2'}:
        raise ValueError('Use only the fixed official peer versions.')
    row = patch[0]['insert'][0]
    if row['name'] != NAME or row['disabled'] is not True or row['config'] != {'enabled': True}:
        raise ValueError('Fixture Bundle must remain disabled by default.')
    tar_bytes = io.BytesIO()
    with tarfile.open(fileobj=tar_bytes, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name in FILES:
            member = tarfile.TarInfo('package/' + name)
            member.size = len(contents[name])
            member.mode = 0o644
            member.mtime = 0
            archive.addfile(member, io.BytesIO(contents[name]))
    packed = io.BytesIO()
    with gzip.GzipFile(fileobj=packed, mode='wb', filename='', mtime=0) as compressed:
        compressed.write(tar_bytes.getvalue())
    payload = packed.getvalue()
    digest = hashlib.sha256(payload).hexdigest()
    filename = NAME + '-' + VERSION + '.tgz'
    destination.mkdir(parents=True, mode=0o700)
    (destination / 'plugins').mkdir(mode=0o700)
    (destination / 'plugins' / filename).write_bytes(payload)
    helper_hashes = {}
    for name in ['dialogue-pilot.py', 'make-dialogue-profile.mjs']:
        data = (ROOT / 'hub/pilot' / name).read_bytes()
        (destination / name).write_bytes(data)
        helper_hashes[name] = hashlib.sha256(data).hexdigest()
    (destination / 'README.zh-CN.md').write_bytes((ROOT / 'docs/HUB-DIALOGUE-INSTALL-SECOND-MAC.md').read_bytes())
    (destination / 'CHECKLIST.txt').write_text('QCU dialogue-install test.1: PASS / FAIL / not tested\n'
        'Official rc.2; new independent Home; accepted CSV Home unchanged: \n'
        'Standard plugin_manager visible; real list approval allowed once: \n'
        'Fixed loopback catalog and downloaded TGZ SHA256: \n'
        'Install rejected; check-rejected passes: \n'
        'Install allowed once; check-installed passes; fixed version: \n'
        'Normal restart; default fixture row disabled: \n'
        'Exact row explicitly enabled; normal restart; actual skill marker: \n'
        'Session remains workspace-write+ask: \n'
        'Bundle disabled; normal restart; marker absent: \n'
        'Optional removal; check-removed; normal restart; marker absent: \n'
        'No build approval/version exemption/permanent Full Access: \n'
        'Do not include auth URLs, keys, logs, personal paths or screenshot originals.\n')
    catalog = {'title': 'Private synthetic dialogue-install probe', 'localOnly': True,
               'publicRelease': False, 'compatible_dsh': '0.2.0-rc.2', 'skills': [],
               'plugins': [{'id': NAME, 'name': NAME, 'version': VERSION,
                            'status': 'published', 'file': filename, 'sha256': digest,
                            'summary': 'Private fixture only. Disabled Bundle row; no file/network/tool actions.'}]}
    (destination / 'catalog.json').write_text(json.dumps(catalog, indent=2) + '\n')
    receipt = {'fixture': NAME, 'version': VERSION, 'sha256': digest, 'bytes': len(payload),
               'sourceFileSha256': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()},
               'helperFileSha256': helper_hashes,
               'localOnly': True, 'publicRelease': False, 'appOrProfileModified': False,
               'serverStarted': False, 'installed': False, 'modelInvoked': False,
               'defaultDisabled': True, 'packageReady': False}
    (destination / 'PREPARATION.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(stage(args.out)))

if __name__ == '__main__':
    main()

