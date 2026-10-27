"""Create a marked synthetic launcher seed, never an App or publishable release."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('pins', ROOT / 'scripts/generate-integrated-teacher-macos-config.py')
pins = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pins)


def make(output, version, theme):
    if theme not in pins.RELEASES[version]:
        raise ValueError('Unexpected test composition')
    pins.SOURCES.no_links(output.absolute())
    output.mkdir(parents=True, exist_ok=False)
    original = pins.read_json(ROOT / 'release/integrated-teacher-macos-rc42.json', pins.ORIGINAL_CONFIG_SHA256)
    legacy = pins.checked_pin(original['legacyInputs'])
    frozen = pins.read_json(legacy)
    products, archives = [], {}
    for row in frozen['products']:
        if row['id'] == 'qcu-course-workbench':
            continue
        data = pins.SOURCES.bounded_read(legacy.parent / 'archives' / row['file'], 4 * 1024 * 1024)
        pins.SOURCES.checked(data, row)
        products.append(row.copy())
        archives[row['id']] = data
    for id in pins.FIXED:
        product, _ = pins.fixed_package(id)
        products.append(product)
        archives[id] = (pins.FIXED_ROOT / id / product['file']).read_bytes()
    for id, pkg_version in [('qcu-market', '0.1.0-pilot.16.1'), ('qcu-branding', theme)]:
        data = pins.SOURCES.branding_archive({'package.json': json.dumps({'name': id, 'version': pkg_version}).encode(),
                                             'index.js': b'// SYNTHETIC; never execute\n'})
        row = {'id': id, 'version': pkg_version, 'file': id + '-synthetic.tgz', 'bytes': len(data), 'sha256': pins.sha(data)}
        products.append(row)
        archives[id] = data
    profile = output / 'seed/profiles/desktop'
    local = []
    for product in products:
        id = product['id']
        for name, data in pins.SOURCES.archive_files(archives[id]).items():
            target = profile / 'node_modules' / id / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o644)
        target = profile / '.qcu-bundles' / product['file']
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(archives[id])
        target.chmod(0o644)
        local.append({**product, 'source': 'file:./.qcu-bundles/' + product['file']})
    def write(file, value):
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(value) + '\n')
        file.chmod(0o644)
    write(profile / 'package.json', {'dependencies': {p['id']: p['source'] for p in local},
        'dsh': {'profile': {'bundles': ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] + [p['id'] for p in local]}}})
    write(profile / 'cordis.yml', [])
    write(profile / 'cordis.patch.yml', [{'id': p['id'], 'disabled': False, 'config': {}} for p in local] +
          [{'id': id, 'disabled': True} for id in ['ui-brand-official', 'ui-sidebar']])
    write(profile / 'pnpm-workspace.yaml', pins.POLICY)
    binary = output / 'seed/bin/lark-cli'
    binary.parent.mkdir()
    binary.write_text('#!/bin/sh\n# SYNTHETIC; never execute\nexit 23\n')
    binary.chmod(0o755)
    rows = [{'path': p.relative_to(output).as_posix(), 'bytes': p.stat().st_size,
             'sha256': pins.sha(p.read_bytes()), 'mode': p.stat().st_mode & 0o777}
            for p in sorted((output / 'seed').rglob('*')) if p.is_file()]
    manifest = {'version': version, 'target': 'mac-arm64', 'seedFiles': rows,
        'seedId': pins.sha(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()),
        'products': [p for p in products if p['id'] != 'qcu-branding'],
        'branding': {'id': 'qcu-branding', 'version': theme}, 'localSources': local}
    write(output / 'support/manifest.json', manifest)
    for name in ['start.cjs', 'integrated.cjs']:
        shutil.copy2(ROOT / 'tools/teacher-suite' / name, output / 'support' / name)
    # The CLI resolves js-yaml through its kit. This marked source-only fixture accepts JSON
    # configuration only; it provides no App, ASAR archive, host runtime or plugin loader.
    parser = output / 'program/DeepSeek Harness.app/Contents/Resources/app.asar/dsh'
    write(parser / 'package.json', {'name': 'synthetic-json-parser-anchor', 'private': True})
    write(parser / 'node_modules/js-yaml/package.json', {'name': 'js-yaml', 'main': 'index.cjs'})
    (parser / 'node_modules/js-yaml/index.cjs').write_text('exports.load=JSON.parse; // SYNTHETIC JSON ONLY\n')
    write(output / 'SYNTHETIC-NOT-A-RELEASE.json', {'status': 'launcher-contract-fixture-only', 'appBuilt': False})


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--version', choices=pins.RELEASES, required=True)
    p.add_argument('--theme', required=True)
    args = p.parse_args()
    make(args.out, args.version, args.theme)
