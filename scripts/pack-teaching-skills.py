"""Reproducible fixed Skill bundles; no install, network, scripts or runtime reads."""
import argparse, gzip, hashlib, io, json, re, tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IDS = ('qcu-lesson-planning', 'qcu-tiered-practice', 'qcu-note-organizer',
       'qcu-reading-outline', 'qcu-integrity-guard')
VERSION = '0.1.0-pilot.1.1'
PEERS = {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/dsh-skill': '0.2.0-rc.2',
         '@deepseek-ai/dsh-scope': '0.2.0-rc.2'}
MEMBERS = {'package.json', 'index.js', 'skill-content.js', 'cordis.patch.yml',
           'README.md', 'LICENSE', 'SKILL.md', 'SOURCE.json'}
sha = lambda data: hashlib.sha256(data).hexdigest()
encoded = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def immutable(path, data):
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError(f'Immutable artifact collision: {path.name}')
        return
    with path.open('xb') as file:
        file.write(data)

def archive(files):
    assert set(files) == MEMBERS
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in sorted(files.items()):
            data.decode('utf8', errors='strict')
            item = tarfile.TarInfo('package/' + name)
            item.size = len(data); item.mode = 0o644; item.mtime = 0
            item.uid = item.gid = 0; item.uname = item.gname = ''
            tar.addfile(item, io.BytesIO(data))
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, filename='', mode='wb', compresslevel=9, mtime=0) as gz:
        gz.write(buf.getvalue())
    return out.getvalue()

def build(output, check_records=False):
    products = json.loads((ROOT / 'hub/skill-products/products-input.json').read_text())
    assert tuple(p['id'] for p in products) == IDS
    output.mkdir(parents=True, exist_ok=True)
    records, manifests = [], []
    for product in products:
        skill_id = product['id']; source = ROOT / 'skills' / skill_id
        # Explicit source allowlist: no recursive enumeration or symlink reads.
        for filename in ['SKILL.md', 'LICENSE', 'SOURCE.json']:
            assert (source / filename).is_file() and not (source / filename).is_symlink()
        content = (source / 'SKILL.md').read_bytes().decode('utf8')
        assert f'name: {skill_id}\n' in content and len(content.encode()) < 65536
        description = re.search(r'^description: (.+)$', content, re.M).group(1)
        provenance = json.loads((source / 'SOURCE.json').read_text())['provenance']
        assert provenance['license'] == 'MIT'
        pkg = {'name': skill_id, 'version': VERSION, 'type': 'module', 'private': True,
               'license': 'MIT', 'description': description,
               'exports': {'.': './index.js', './package.json': './package.json'},
               'dsh': {'bundle': {'patch': './cordis.patch.yml'}},
               'peerDependencies': PEERS, 'files': sorted(MEMBERS - {'package.json'})}
        values = {'content': content, 'contentSha256': sha(content.encode()),
                  'skillName': skill_id, 'description': description, 'provider': f'{skill_id}@{VERSION}'}
        compiled = ''.join('export const ' + key + ' = ' + json.dumps(value, ensure_ascii=False) + ';\n'
                           for key, value in values.items()).encode()
        readme = (f'# {product["title"]} · {VERSION}\n\n'
                  f'One product, one Skill, one DSH bundle: `{skill_id}`.\n'
                  'DSH 0.2.0-rc.2; disabled row with config.enabled=true. Installation, bundle '
                  'activation and row activation each require the normal reviewed user flow.\n'
                  'The provider verifies embedded UTF-8 SHA256 and refuses an existing same-name '
                  'Skill. Cordis owns disposal; unrelated registrations are preserved.\n'
                  'Runtime only registers static instructions; no network, tools, sessions, '
                  'file reads or automatic model calls. It grants no permissions.\n'
                  'SOURCE.json retains author, upstream, pinned revision, license and modifications. '
                  'Read SKILL.md and LICENSE before use. Synthetic examples only; teaching outcomes, '
                  'live installation and chat discovery have not been tested.\n').encode()
        files = {'package.json': encoded(pkg), 'index.js': (ROOT / 'hub/skill-products/provider-template.mjs').read_bytes(),
                 'skill-content.js': compiled, 'cordis.patch.yml': encoded([{'insert': [{'id': skill_id,
                 'name': skill_id, 'disabled': True, 'config': {'enabled': True}}]}]), 'README.md': readme,
                 **{name: (source / name).read_bytes() for name in ['SKILL.md', 'LICENSE', 'SOURCE.json']}}
        raw = archive(files); digest = sha(raw); filename = f'{skill_id}-{VERSION}-{digest}.tgz'
        immutable(output / filename, raw)
        record = {'id': skill_id, 'version': VERSION, 'skill': skill_id,
                  'skillSha256': values['contentSha256'], 'provider': values['provider'],
                  'origin': 'http://192.168.1.68:8080', 'file': filename, 'bytes': len(raw),
                  'sha256': digest, 'runtime': '0.2.0-rc.2',
                  'releaseStatus': 'local-candidate-not-published', 'license': 'MIT'}
        records.append(record)
        manifests.append({'release': record, 'members': {k: sha(v) for k, v in sorted(files.items())}})
    # Tracked reviewed release records; consumed together with products-input.json.
    record_path = ROOT / 'hub/market/skill-releases.json'
    if check_records:
        assert record_path.read_bytes() == encoded(records), 'Reviewed release records differ; rebuild explicitly'
    else:
        record_path.write_bytes(encoded(records))
    immutable(output / 'MANIFEST.json', encoded(manifests))
    immutable(output / 'SHA256SUMS', ''.join(f'{r["sha256"]}  {r["file"]}\n' for r in records).encode())
    return records

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--check-records', action='store_true', help='verify instead of writing tracked release records')
    args = parser.parse_args()
    print(json.dumps(build(args.out, args.check_records), ensure_ascii=False, indent=2))
