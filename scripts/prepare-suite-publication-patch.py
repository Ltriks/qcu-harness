"""Prepare a narrowly scoped patch from an exact reviewed publisher source."""
from pathlib import Path
import argparse
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
source = args.source.read_text()
old = "        api.need(meta['components'] == [meta['id']] and meta['skills'] in ([], [meta['id']]) and meta['license'] in ('MIT', 'Apache-2.0'), 'entry.unsupported_shape_use_single_component', 409)\n        api.need(meta['productType'] != 'skill' or meta['skills'] == [meta['id']], 'entry.skill_mismatch')\n"
workbench_old = old.replace("and meta['skills'] in ([], [meta['id']])", "and (workbench or meta['skills'] in ([], [meta['id']]))")
if source.count(old) == 0 and source.count(workbench_old) == 1:
    old = workbench_old
assert source.count(old) == 1, 'Publisher contract changed; do not guess'
source = source.replace(old, '')
marker = "        skill = meta['id'] if meta['skills'] else None\n"
if source.count(marker) == 0:
    marker = "        skill = 'qcu-course-draft' if workbench else meta['id'] if meta['skills'] else None\n"
assert source.count(marker) == 1
source = source.replace(marker, '        validate_skill_bundle(api, meta, files)\n' + marker)
# Inline the reviewed pure validator: no deployment-time import or path changes.
helper = (Path(__file__).resolve().parents[1] / 'hub/admin/department_suite_contract.py').read_text()
helper = helper[helper.index('def validate_skill_bundle'):]
source = source.replace('\nclass Publication:', '\n' + helper + '\n\nclass Publication:', 1)
args.out.mkdir(parents=True, exist_ok=True)
(args.out / 'publication.py').write_text(source)
(args.out / 'patch.json').write_text(json.dumps({'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(), 'candidateSha256': hashlib.sha256(source.encode()).hexdigest(), 'scope': 'single-component multi-skill declaration validation only'}, indent=2)+'\n')
print((args.out / 'patch.json').read_text())
