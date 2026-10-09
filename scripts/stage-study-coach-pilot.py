"""Build a reviewed offline Skill provider; never install, serve or modify profiles."""
import argparse
import gzip
import hashlib
import io
import json
import re
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'hub/plugins/qcu-study-coach'
SKILL = ROOT / 'skills/chengyuan-study-coach/SKILL.md'
NAME = 'qcu-study-coach'
VERSION = '0.1.0-pilot.1'
SOURCE_FILES = ('package.json', 'index.js', 'provider.js', 'cordis.patch.yml', 'README.md', 'SOURCE.json')


def stage(destination, source_root=PACKAGE, skill_path=SKILL):
    destination, source_root, skill_path = map(Path, (destination, source_root, skill_path))
    if destination.exists() or destination.is_symlink():
        raise ValueError('Existing output is never replaced.')
    if source_root.is_symlink() or skill_path.is_symlink():
        raise ValueError('Source symlinks are not adopted.')
    contents = {}
    for name in SOURCE_FILES:
        path = source_root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Source must be a regular allowlisted file.')
        contents[name] = path.read_bytes()
    source = json.loads(contents['SOURCE.json'])
    skill_bytes = skill_path.read_bytes()
    digest = hashlib.sha256(skill_bytes).hexdigest()
    if digest != source['skillSha256'] or len(skill_bytes) != source['skillBytes']:
        raise ValueError('Canonical Skill changed; review and version first.')
    text = skill_bytes.decode('utf-8')
    if not re.match(r'^---\nname: chengyuan-study-coach\ndescription: [^\n]+\n---\n', text):
        raise ValueError('Canonical metadata changed.')
    manifest = json.loads(contents['package.json'])
    if manifest['name'] != NAME or manifest['version'] != VERSION:
        raise ValueError('Provider identity changed.')
    if manifest.get('scripts') or manifest.get('dependencies'):
        raise ValueError('No installation scripts or runtime dependencies allowed.')
    if manifest['peerDependencies'] != {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/dsh-skill': '0.2.0-rc.2'}:
        raise ValueError('Fixed official peers required.')
    patch = json.loads(contents['cordis.patch.yml'])
    if patch != [{'insert': [{'id': NAME, 'name': NAME, 'disabled': True, 'config': {'enabled': True}}]}]:
        raise ValueError('Bundle must remain disabled by default.')
    if digest.encode() not in contents['provider.js']:
        raise ValueError('Runtime source pin changed.')
    contents['skill-content.js'] = ('export const content = ' + json.dumps(text, ensure_ascii=False) + '\n').encode('utf-8')
    contents['skills/chengyuan-study-coach/SKILL.md'] = skill_bytes
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name in sorted(contents):
            member = tarfile.TarInfo('package/' + name)
            member.size = len(contents[name]); member.mode = 0o644; member.mtime = 0
            archive.addfile(member, io.BytesIO(contents[name]))
    packed = io.BytesIO()
    with gzip.GzipFile(fileobj=packed, mode='wb', filename='', mtime=0) as compressed:
        compressed.write(raw.getvalue())
    payload = packed.getvalue()
    sha = hashlib.sha256(payload).hexdigest()
    filename = NAME + '-' + VERSION + '-' + sha + '.tgz'
    catalog = {
        'schemaVersion': 1, 'revision': 'study-coach-pilot-one',
        'title': 'QCU private study coach candidate', 'tagline': 'Offline preparation; not deployed',
        'updated_at': '2026-10-09', 'compatible_dsh': 'Exact entry version; official gates remain mandatory',
        'install_hint': 'Verify trusted hashes, then review each official management call.',
        'skill_hint': 'Canonical generic study guidance only.',
        'plugin_hint': 'Disabled by default; explicit approval and normal restart required.',
        'audience': 'lan-private', 'publicRelease': False, 'skills': [],
        'plugins': [{'id': NAME, 'name': 'Canonical study coach pilot', 'category': 'Study support',
                     'version': VERSION, 'risk': 'Guidance only; reviewed activation required',
                     'summary': 'Unchanged canonical instructions; no private materials or executable teaching workflow.',
                     'status': 'published', 'review': 'approved', 'synthetic': False,
                     'defaultDisabled': True, 'file': filename, 'sha256': sha, 'bytes': len(payload),
                     'dshVersions': ['0.2.0-rc.2']}]
    }
    catalog_bytes = (json.dumps(catalog, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    receipt = {'provider': NAME, 'version': VERSION, 'skillName': source['skillName'],
               'bytes': len(payload), 'sha256': sha, 'file': filename,
               'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
               'skillSource': source,
               'archiveMembers': ['package/' + name for name in sorted(contents)],
               'sourceFileSha256': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()},
               'reviewMeaning': 'Developer source review of offline private candidate, not user approval of installation or public release',
               'installed': False, 'activated': False, 'modelCalled': False,
               'miniDirectoryOrServiceChanged': False, 'packageReady': False}
    # published means locally downloadable candidate, not a LAN/public publication.
    destination.mkdir(parents=True, mode=0o700)
    (destination / 'plugins').mkdir(mode=0o700)
    for name, data in [('plugins/' + filename, payload), ('catalog.json', catalog_bytes),
                       ('PREPARATION.json', (json.dumps(receipt, indent=2) + '\n').encode())]:
        (destination / name).write_bytes(data)
    (destination / 'ACCEPTANCE.zh-CN.md').write_bytes((ROOT / 'docs/HUB-STUDY-COACH-PILOT.md').read_bytes())
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    print(json.dumps(stage(parser.parse_args().out)))


if __name__ == '__main__':
    main()
