#!/usr/bin/env python3
"""Add the offline HTML manual outside the unchanged rc.3 teacher application."""
import argparse
import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / 'tools/teacher-guide/QCU助手使用指南.html'
BASES = {
    'mac-arm64': ('QCU-Teacher-0.1.0-rc.3-mac-arm64-r2', '8b51324c84b5d166f38e55b1e52096f0b2f28aecaeb4865e294fc0e4e9d7fbf1', 'r3'),
    'win-x64': ('QCU-Teacher-0.1.0-rc.3-win-x64', 'e26caff128df28ea0b59a2dbfe105c1d187d9772e558f322a644ea6e06111246', 'r2'),
}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def normalized(name, root):
    # ditto stores legacy UTF-8 names without always setting the ZIP UTF-8 flag.
    return name.replace(root + '/', '<root>/', 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=BASES, required=True)
    parser.add_argument('--release-dir', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    stem, expected_hash, revision = BASES[args.target]
    base = args.release_dir.resolve() / (stem + '.zip')
    if digest(base) != expected_hash:
        raise ValueError('Base archive does not match the accepted frozen package')
    if args.out.exists():
        raise ValueError('Fresh output directory required')
    args.out.mkdir(parents=True)
    new_stem = f'QCU-Teacher-0.1.0-rc.3-{args.target}-{revision}'
    archive = args.out / (new_stem + '.zip')
    guide_hash = digest(GUIDE)
    receipt = {'schemaVersion': 1, 'runtimeVersion': '0.1.0-rc.3', 'packagingRevision': revision,
               'guide': {'file': GUIDE.name, 'sha256': guide_hash, 'updatedAt': '2026-10-22'},
               'baseArchive': base.name, 'baseArchiveSha256': expected_hash,
               'applicationChanged': False, 'personalDataIncluded': False,
               'dataHomeChanged': False}
    if args.target == 'mac-arm64':
        subprocess.run(['/usr/bin/ditto', '-x', '-k', str(base), str(args.out)], check=True)
        package = args.out / new_stem
        (args.out / stem).rename(package)
        shutil.copyfile(GUIDE, package / GUIDE.name)
        (package / 'guide-package.json').write_bytes(json_bytes(receipt))
        readme = package / '先读我.txt'
        readme.write_text('请先双击“QCU助手使用指南.html”：从首次打开、配置自己的API Key，到七项技能示例与课程工作台。\n指南可离线阅读；云端模型使用需要网络、个人密钥和额度。\n本次仅增加使用说明，应用及个人数据目录不变。\n\n' + readme.read_text())
        subprocess.run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(package), str(archive)], check=True)
        # Verify the final shipped ZIP, including executable modes and symlinks.
        extracted = args.out / 'verify 中文 空格'
        subprocess.run(['/usr/bin/ditto', '-x', '-k', str(archive), str(extracted)], check=True)
        final = extracted / new_stem
        spec = importlib.util.spec_from_file_location('mac_builder', ROOT / 'scripts/build-teacher-macos.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        inventory = json.loads((final / 'app-files.json').read_text())
        if builder.inventory(final / 'QCU助手.app', digest) != inventory:
            raise ValueError('Final Mac app bytes/modes/symlinks differ from accepted inventory')
        app_inventory_verified = True
        old_root, new_root, changed = stem, new_stem, {'<root>/先读我.txt'}
    else:
        # Preserve all original Windows entry metadata and unchanged bytes.
        old_root = new_root = 'QCU助手'
        with zipfile.ZipFile(base) as source:
            text_name = old_root + '/使用说明.txt'
            text = ('请先双击“QCU助手使用指南.html”：首次打开、配置自己的API Key、七项技能及课程工作台。\r\n'
                    '指南可离线阅读；云端模型使用需要网络、个人密钥和额度。\r\n'
                    '本次仅增加使用说明，应用及个人数据目录不变。\r\n\r\n' + source.read(text_name).decode()).encode()
            additions = {old_root + '/' + GUIDE.name: GUIDE.read_bytes(), old_root + '/guide-package.json': json_bytes(receipt)}
            replacements = {text_name: text}
            rows = json.loads(source.read(old_root + '/support/files.json'))
            for row in rows:
                key = old_root + '/' + row['path']
                if key in replacements:
                    row.update(bytes=len(replacements[key]), sha256=hashlib.sha256(replacements[key]).hexdigest())
            for name, data in additions.items():
                rows.append({'path': name[len(old_root) + 1:], 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            replacements[old_root + '/support/files.json'] = json_bytes(sorted(rows, key=lambda row: row['path']))
            with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as output:
                for info in source.infolist():
                    metadata = copy.copy(info)
                    with output.open(metadata, 'w', force_zip64=True) as dst:
                        if info.filename in replacements:
                            dst.write(replacements[info.filename])
                        else:
                            with source.open(info) as src:
                                shutil.copyfileobj(src, dst, length=1024 * 1024)
                for name, data in additions.items():
                    output.writestr(name, data)
        with zipfile.ZipFile(archive) as final:
            rows = json.loads(final.read(old_root + '/support/files.json'))
            if {old_root + '/' + row['path'] for row in rows} != set(final.namelist()) - {old_root + '/support/files.json'}:
                raise ValueError('Windows inventory coverage mismatch')
            for row in rows:
                data = final.read(old_root + '/' + row['path'])
                if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
                    raise ValueError('Windows final inventory mismatch: ' + row['path'])
        app_inventory_verified = True
        changed = {'<root>/使用说明.txt', '<root>/support/files.json'}
    # Compare every old payload, allowing only the declared guide pointer/inventory edits.
    with zipfile.ZipFile(base, metadata_encoding='utf-8') as before, zipfile.ZipFile(archive, metadata_encoding='utf-8') as after:
        old = {normalized(i.filename, old_root): i for i in before.infolist() if not i.filename.startswith('__MACOSX/') and not i.is_dir()}
        new = {normalized(i.filename, new_root): i for i in after.infolist() if not i.filename.startswith('__MACOSX/') and not i.is_dir()}
        added = {'<root>/' + GUIDE.name, '<root>/guide-package.json'}
        if set(new) - set(old) != added or set(old) - set(new):
            raise ValueError('Unexpected file additions/removals')
        for name, info in old.items():
            if name in changed:
                continue
            if info.external_attr != new[name].external_attr or before.read(info) != after.read(new[name]):
                raise ValueError('Unexpected payload or permission change: ' + name)
        if hashlib.sha256(after.read(new['<root>/' + GUIDE.name])).hexdigest() != guide_hash:
            raise ValueError('Guide content mismatch')
    result = {**receipt, 'target': args.target, 'archive': {'file': archive.name, 'bytes': archive.stat().st_size, 'sha256': digest(archive)},
              'createdAt': datetime.now(timezone(timedelta(hours=8))).isoformat(),
              'verification': {'finalArchiveInventory': 'passed', 'applicationBytesModesAndSymlinksUnchanged': app_inventory_verified,
                               'allOtherPayloadsUnchanged': True, 'guideHashMatched': True,
                               'changedExistingFiles': sorted(changed), 'addedFiles': sorted(added),
                               'visualBrowserReview': 'not-run-local-file-policy-denied', 'modelCalls': 0, 'feishuCalls': 0}}
    (args.out / 'guide-delivery.json').write_bytes(json_bytes(result))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
