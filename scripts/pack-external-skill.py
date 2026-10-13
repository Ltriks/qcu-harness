"""One reviewed Apache instruction bundle. Build only; no runtime loader or installer."""
import argparse, gzip, io, json, re, tarfile
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('teaching_archive_helpers', ROOT / 'scripts/pack-teaching-skills.py')
helpers = module_from_spec(spec); spec.loader.exec_module(helpers)
sha, encoded, immutable, PEERS = helpers.sha, helpers.encoded, helpers.immutable, helpers.PEERS
ID = 'qcu-team-briefing'
VERSION = '0.1.0-pilot.1'
REVISION = 'dbd4588f9e1033efb41dad4bef2f7947c8993d44'
URL = f'https://github.com/anthropics/skills/tree/{REVISION}/skills/internal-comms'
PINS = [{'path': 'skills/internal-comms/SKILL.md', 'vendoredPath': 'third_party/anthropic-internal-comms/SKILL.md', 'bytes': 1511, 'sha256': '067b7587a344a928fc6534ef66b1bcd591fc7c26d207ea7ca3334aeb678d6475'}, {'path': 'skills/internal-comms/LICENSE.txt', 'vendoredPath': 'third_party/anthropic-internal-comms/LICENSE.txt', 'bytes': 11345, 'sha256': 'bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362'}, {'path': 'skills/internal-comms/examples/3p-updates.md', 'vendoredPath': 'third_party/anthropic-internal-comms/examples/3p-updates.md', 'bytes': 3274, 'sha256': '087e4363c0f3513728a7e695eeb9ead5c3ecd12a4681b59340691180e65b68fc'}, {'path': 'skills/internal-comms/examples/company-newsletter.md', 'vendoredPath': 'third_party/anthropic-internal-comms/examples/company-newsletter.md', 'bytes': 3295, 'sha256': '30f81cfbdb03858a006169c72169024089c7c5d3d32611d337782da4f38c86b5'}, {'path': 'skills/internal-comms/examples/faq-answers.md', 'vendoredPath': 'third_party/anthropic-internal-comms/examples/faq-answers.md', 'bytes': 2366, 'sha256': '5ecd3356cd6666937f2ebefa753253edfdbdca15e368d07baf398bfcced72484'}, {'path': 'skills/internal-comms/examples/general-comms.md', 'vendoredPath': 'third_party/anthropic-internal-comms/examples/general-comms.md', 'bytes': 602, 'sha256': '4d3a4bb198a77626bcf018e96b2b45a2dbabed172d4ade0fcd70d23ae8a47a47'}]
SOURCE_MEMBERS = {'SKILL.md', 'LICENSE', 'SOURCE.json', 'NOTICE', 'WRAPPER-LICENSE'}
VENDOR_MEMBERS = {p['vendoredPath'] for p in PINS}
MEMBERS = SOURCE_MEMBERS | VENDOR_MEMBERS | {'package.json', 'index.js', 'skill-content.js', 'cordis.patch.yml', 'README.md'}

def read_safe(root, name):
    path = root / name
    assert path.is_file() and not path.is_symlink()
    for part in Path(name).parents:
        assert not (root / part).is_symlink(), 'Symlink source directory refused'
    return path.read_bytes()

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

def build(output, check_records=False, root=ROOT):
    source = root / 'skills' / ID
    assert not source.is_symlink()
    fixed = {n: read_safe(root, 'skills/' + ID + '/' + n) for n in SOURCE_MEMBERS}
    metadata = json.loads(fixed['SOURCE.json'])
    assert set(metadata) == {'upstreamURL','revision','upstreamFiles','license','provenance'}
    assert metadata['upstreamURL'] == URL and metadata['revision'] == REVISION
    assert metadata['license'] == 'Apache-2.0' and metadata['upstreamFiles'] == PINS
    provenance = metadata['provenance']
    assert set(provenance) == {'ownership','author','upstreamSource','pinnedRevision','license','modifications'}
    assert provenance['ownership'] == 'third-party' and provenance['license'] == 'Apache-2.0'
    assert provenance['pinnedRevision'] == REVISION and provenance['upstreamSource'] == 'anthropics/skills: skills/internal-comms'
    assert all(isinstance(provenance[k], str) and 0 < len(provenance[k]) <= 2000 for k in provenance)
    vendor = {p['vendoredPath']: read_safe(root, p['vendoredPath']) for p in PINS}
    for pin in PINS:
        data = vendor[pin['vendoredPath']]
        assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], 'Pinned upstream tamper: ' + pin['path']
    assert fixed['LICENSE'] == vendor['third_party/anthropic-internal-comms/LICENSE.txt']
    assert fixed['WRAPPER-LICENSE'] == read_safe(root, 'LICENSE')
    assert b'Copyright 2026 Anthropic, PBC.' in fixed['NOTICE'] and b'Modified files:' in fixed['NOTICE']
    content = fixed['SKILL.md'].decode('utf8')
    assert f'name: {ID}\n' in content and len(fixed['SKILL.md']) < 65536
    description = re.search(r'^description: (.+)$', content, re.M).group(1)
    product = json.loads(read_safe(root, 'hub/skill-products/external-product-input.json'))
    assert product['id'] == ID and product['title'] == '教研简报与工作总结'
    pkg = {'name': ID, 'version': VERSION, 'type': 'module', 'private': True,
           'license': 'Apache-2.0', 'description': description,
           'exports': {'.': './index.js', './package.json': './package.json'},
           'dsh': {'bundle': {'patch': './cordis.patch.yml'}},
           'peerDependencies': PEERS, 'files': sorted(MEMBERS - {'package.json'})}
    values = {'content': content, 'contentSha256': sha(fixed['SKILL.md']), 'skillName': ID,
              'description': description, 'provider': f'{ID}@{VERSION}'}
    compiled = ''.join('export const ' + key + ' = ' + json.dumps(value, ensure_ascii=False) + ';\n'
                       for key, value in values.items()).encode()
    readme = (f'# {product["title"]} · {VERSION}\n\n'
              '第三方改编；Apache-2.0 instructions, unchanged MIT provider wrapper (WRAPPER-LICENSE).\n'
              'One static Skill/one bundle. Explicit activation; installed row disabled with config.enabled=true.\n'
              'Embedded instructions are self-contained. Original six files are provenance text only, never loaded at runtime.\n'
              'No runtime file/network/tool/session/model operations or credential setup. Teacher-reviewed drafts from provided text.\n'
              'SHA256 verified before public official registerProvider; visible collisions refused. Same-release provider name/layer registration is atomic; arbitrary concurrent different providers are outside that guarantee. Cordis owns disposal.\n'
              'Read LICENSE, WRAPPER-LICENSE, NOTICE and SOURCE.json. Not published, installed or tested with a live model/teacher.\n').encode()
    files = {**fixed, **vendor, 'package.json': encoded(pkg),
             'index.js': read_safe(root, 'hub/skill-products/provider-template.mjs'),
             'skill-content.js': compiled, 'README.md': readme,
             'cordis.patch.yml': encoded([{'insert': [{'id': ID, 'name': ID, 'disabled': True, 'config': {'enabled': True}}]}])}
    raw = archive(files); digest = sha(raw); filename = f'{ID}-{VERSION}-{digest}.tgz'
    record = {'id': ID, 'version': VERSION, 'skill': ID, 'skillSha256': values['contentSha256'],
              'provider': values['provider'], 'origin': 'http://192.168.1.68:8080', 'file': filename,
              'bytes': len(raw), 'sha256': digest, 'runtime': '0.2.0-rc.2',
              'releaseStatus': 'local-candidate-not-published', 'license': 'Apache-2.0'}
    record_path = root / 'hub/market/external-skill-release.json'
    if check_records:
        assert record_path.read_bytes() == encoded(record), 'Reviewed external release differs'
    output.mkdir(parents=True, exist_ok=True)
    immutable(output / filename, raw)
    immutable(output / 'MANIFEST.json', encoded({'release': record, 'members': {k: sha(v) for k, v in sorted(files.items())}}))
    immutable(output / 'SHA256SUMS', f'{digest}  {filename}\n'.encode())
    if not check_records:
        record_path.write_bytes(encoded(record))
    return record

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--check-records', action='store_true')
    args = parser.parse_args(); print(json.dumps(build(args.out, args.check_records), ensure_ascii=False, indent=2))
