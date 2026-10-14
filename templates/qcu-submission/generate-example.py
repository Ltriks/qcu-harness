"""Generate deterministic SYNTHETIC handoffs only, never a market product.

Python 3.9+ standard library. Output must be a new directory with an existing
parent; examples contain no executable behavior and are never installed.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

PRODUCT = 'qcu-synthetic-submission'
VERSION = '0.0.1-example.1'
PEERS = {'@deepseek-ai/cordis': '4.0.4', '@deepseek-ai/dsh-scope': '0.2.0-rc.2'}


def encoded(value):
    return (json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def archive(files):
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in sorted(files.items()):
            entry = tarfile.TarInfo('package/' + name)
            entry.size, entry.mode, entry.mtime = len(data), 0o644, 0
            tar.addfile(entry, io.BytesIO(data))
    buffer = io.BytesIO()
    with gzip.GzipFile(filename='', fileobj=buffer, mode='wb', mtime=0, compresslevel=9) as file:
        file.write(tar_buffer.getvalue())
    return buffer.getvalue()


def example_files():
    return {
        'package.json': encoded({'name': PRODUCT, 'version': VERSION, 'type': 'module', 'private': True,
                                'license': 'MIT', 'exports': {'.': './index.js', './package.json': './package.json'},
                                'files': ['index.js', 'src', 'cordis.patch.yml', 'README.md', 'LICENSE'],
                                'peerDependencies': PEERS, 'dsh': {'bundle': {'patch': './cordis.patch.yml'}}}),
        'index.js': b'// SYNTHETIC fixture, no runtime behavior or product implementation.\nexport default {};\n',
        'src/host.mjs': b'// SYNTHETIC packaged Host source; never executed by checker.\nexport const synthetic = true;\n',
        'cordis.patch.yml': encoded([{'insert': [{'id': PRODUCT, 'name': PRODUCT, 'disabled': True, 'config': {'enabled': True}}]}]),
        'README.md': b'# Synthetic submission fixture\nNot published or functional. No permissions. Never install.\n',
        'LICENSE': b'MIT License\nCopyright (c) 2026 QCU synthetic fixture authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n',
    }


def write_handoff(root, files=None, reject=False):
    """Caller supplies a new directory; useful to stdlib tests as fixture data."""
    files = example_files() if files is None else files
    root.mkdir()
    raw = archive(files)
    filename = f'{PRODUCT}-{VERSION}-{digest(raw)}.tgz'
    (root / filename).write_bytes(raw)
    manifest = {'schemaVersion': 1, 'members': [{'path': name, 'bytes': len(data), 'sha256': digest(data)} for name, data in sorted(files.items())]}
    (root / 'members.json').write_bytes(encoded(manifest))
    materials = {
        'PLUGIN-SPEC.md': '# Synthetic PLUGIN-SPEC\n\nFixture only, not a finished product. Owner: QCU fixture authors.\n'
                          'Target: checker maintenance. Inputs: synthetic JSON; output: static report.\n'
                          'Host: inert index.js; client/slots/RPC/tools/Skill provider: none.\n'
                          'One disabled component; config.enabled=true does not activate its row.\n'
                          'Permissions, model/network, account scopes, processes and persistent state: none.\n'
                          'No operational installation/upgrade behavior is claimed; do not install.\n'
                          'No real student, teacher, mail or business data. License: MIT.\n',
        'BUILD.md': '# Synthetic build instructions\n\nPython 3.9+ stdlib, no dependencies or lock required.\n'
                    'Run this trusted repository generator with --output pointing to a new local directory.\n'
                    'Sorted USTAR, mode 0644, uid/gid/mtime zero; gzip mtime zero, empty filename.\n'
                    'No package scripts execute. No native or teacher tests were performed.\n',
        'SOURCE.md': '# Synthetic source provenance\n\nAll example strings are authored here. The 40-hex revision in metadata is\n'
                     'a synthetic value, not an independently verified Git revision.\n'
                     'Source is this template generator; no upstream service/SDK/product is claimed.\n',
        'source-evidence.md': '# Synthetic source evidence\n\nDeclared passed means fixture construction only; not a real test attestation.\n',
        'preview-evidence.md': '# Synthetic preview evidence\n\nDeclared passed for exercising status parsing; no UI/native preview occurred.\n',
        'native-evidence.md': '# Native evidence\n\nUntested: no DSH, model, install, activation or Skill/tool discovery executed.\n',
        'teacher-evidence.md': '# Teacher evidence\n\nUntested: no real business or teacher acceptance executed.\n',
    }
    for name, text in materials.items():
        (root / name).write_text(text, encoding='utf-8')
    (root / 'LICENSE.txt').write_bytes(files['LICENSE'])
    submission = {'schemaVersion': 1, 'templateOnly': False, 'id': PRODUCT,
                  'title': 'Synthetic checker example (not a product)', 'version': VERSION,
                  'sourceRevision': '0123456789abcdef0123456789abcdef01234567', 'license': 'MIT',
                  'productType': 'plugin', 'runtime': '0.2.0-rc.2', 'components': [PRODUCT], 'skills': [],
                  'peerDependencies': PEERS, 'runtimeDependencies': {}, 'installScripts': [],
                  'permissionSummary': ['No runtime permissions; inert synthetic fixture.'],
                  'archive': {'file': filename, 'bytes': len(raw), 'sha256': digest(raw)},
                  'materials': {'spec': 'PLUGIN-SPEC.md', 'build': 'BUILD.md', 'license': 'LICENSE.txt',
                                'source': 'SOURCE.md', 'memberManifest': 'members.json', 'lock': None},
                  'testEvidence': {stage: {'status': status, 'file': filename} for stage, status, filename in [
                      ('source', 'passed', 'source-evidence.md'), ('preview', 'passed', 'preview-evidence.md'),
                      ('liveInstall', 'untested', 'native-evidence.md'), ('businessAcceptance', 'untested', 'teacher-evidence.md')]},
                  'knownLimits': ['Synthetic fixture only; no product, native execution or teacher acceptance.'], 'published': False}
    if reject:
        submission['archive']['bytes'] += 1
        submission['testEvidence']['businessAcceptance']['status'] = 'failed'
    (root / 'submission.json').write_bytes(encoded(submission))
    return submission


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='New directory under an existing artifact/temp parent.')
    args = parser.parse_args()
    # No traversal through existing symlink ancestors; refuse an existing output.
    if '..' in args.output.parts or any(p.is_symlink() for p in [args.output, *args.output.parents]):
        parser.exit(2, 'Output must have regular directory ancestors.\n')
    try:
        args.output.mkdir()
        write_handoff(args.output / 'static-pass')
        write_handoff(args.output / 'reject', reject=True)
    except OSError:
        parser.exit(2, 'Output requires a new directory with an existing writable parent.\n')
    print('Created synthetic static-pass and reject handoffs. Neither is a market product.')


if __name__ == '__main__':
    main()
