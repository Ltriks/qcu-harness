"""P16 deterministic package staging and full-app input plan; never builds an app."""
import os
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).absolute().parents[1]
OUT = Path(os.environ.get('QCU_PRODUCT_POLISH_OUT', str(ROOT / '.work/product-polish-review'))).absolute()

def read(path): return json.loads(path.read_bytes())
def sha(raw): return hashlib.sha256(raw).hexdigest()
def save_staging(path, value):
    raw = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    if path.exists():
        assert not path.is_symlink(), 'staging link'
        previous = path.read_bytes()
        if previous == raw: return
        history = OUT / 'staging-history'; history.mkdir(exist_ok=True)
        saved = history / (path.stem + '-' + sha(previous) + '.json')
        if not saved.exists():
            with saved.open('xb') as f: f.write(previous)
        path.write_bytes(raw)
    else:
        with path.open('xb') as f: f.write(raw)

def main():
    descriptor = read(ROOT / 'releases/qcu-teacher-product-polish.json')
    schema = read(ROOT / 'releases/qcu-teacher-product-polish.schema.json')
    assert set(descriptor) == set(schema['required'])
    packages = []
    for short, source in [('branding', 'tools/teacher-branding'), ('market', 'hub/plugins/qcu-market')]:
        manifest = read(ROOT / source / 'package.json')
        assert manifest['version'] == descriptor['versions'][short]
        report = read(OUT / 'packages/reviewed-final' / manifest['name'] / 'MANIFEST.json')
        raw = (OUT / 'packages/reviewed-final' / manifest['name'] / report['file']).read_bytes()
        assert len(raw) == report['bytes'] and sha(raw) == report['sha256']
        packages.append(dict(id=manifest['name'], version=manifest['version'], path='packages/reviewed-final/' + manifest['name'] + '/' + report['file'], bytes=len(raw), sha256=sha(raw)))
    descriptor['archives'] = packages
    save_staging(OUT / 'release.json', descriptor)
    # Freeze exactly the excluded source trees against this checkout's base.
    frozen = {}
    for tree in ['hub/plugins/qcu-course-workbench', 'hub/plugins/qcu-expert-teams', 'upstream/source']:
        result = subprocess.run(['rtk','proxy','git','diff','--exit-code','HEAD','--',tree], cwd=ROOT, capture_output=True)
        assert result.returncode == 0, 'frozen source changed: ' + tree
        files = subprocess.check_output(['rtk','proxy','git','ls-tree','-r','HEAD','--',tree], cwd=ROOT)
        frozen[tree] = dict(baseTreeInventorySha256=sha(files), unchanged=True)
    fixed = []
    for name in ['coach-release', 'skill-releases', 'external-skill-release', 'feishu-release']:
        value = read(ROOT / 'hub/market' / (name + '.json'))
        fixed.extend(value if isinstance(value, list) else [value])
    assert read(ROOT / 'hub/plugins/qcu-expert-teams/package.json')['version'] == descriptor['versions']['expert']
    plan = dict(schema=1, taskId=descriptor['taskId'], reviewTaskId='QCU-P16-PARENT-REVIEW', status='review-required-not-built', target='next-immutable-Mac-candidate', appRelease=None,
                pendingDecision={'existingRc42Source':'67768251d96aa189a2819c0da18a63d0f0d9bdec','action':'Parent reviews this implementation and existing rc4.2 before deciding full app build.'},
                changedPackages=packages, frozenSources=frozen, fixedExistingPackages=fixed,
                expert={'version':descriptor['versions']['expert'],'mode':'retain-existing-exact-package','rebuilt':False},
                course={'mode':'unchanged','acceptance':'excluded'}, windows='not-built', production='not-deployed',
                usedHomes='not-read-or-copied', migration='not-performed', publicPins='unchanged')
    save_staging(OUT / 'MAC-STAGING-INPUTS.json', plan)
    print(json.dumps({'descriptor':'release.json','archives':len(packages),'fullApp':'not-built','frozenSourcesVerified':len(frozen)}))

if __name__ == '__main__': main()
